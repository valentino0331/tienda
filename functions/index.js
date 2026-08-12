import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

function normalizePhone(phone) {
  if (typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) {
    return `+51${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("519")) {
    return `+${digits}`;
  }
  return null;
}

function customerIdFromPhone(phoneNormalized) {
  if (!phoneNormalized || typeof phoneNormalized !== "string") return null;
  const digits = phoneNormalized.replace(/\D/g, "");
  return `cust_${digits}`;
}

function normalizeEmail(email) {
  if (email === undefined || email === null || email === "") return null;
  if (typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;
  return trimmed;
}

function sanitizeString(str, minLength, maxLength) {
  if (typeof str !== "string") return null;
  const trimmed = str.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Función de prueba Callable v2 para verificar el runtime de Firebase Cloud Functions.
 */
export const testFunction = onCall((request) => {
  return {
    status: "ok",
    message: "Firebase Cloud Functions v2 runtime configurado correctamente.",
    timestamp: new Date().toISOString()
  };
});

/**
 * Función autoritativa para la creación segura de pedidos en Exclusive Shop.
 */
// Se verifican tokens App Check presentes para obtener métricas, pero todavía
// no se rechazan solicitudes sin token. Enforcement se habilitará después de
// observar tráfico real verificado en producción.
export const createOrder = onCall({ enforceAppCheck: false }, async (request) => {
  const payload = request.data;
  if (!payload || typeof payload !== "object") {
    throw new HttpsError("invalid-argument", "El cuerpo de la solicitud debe ser un objeto válido.");
  }

  const { items: rawItems, customer: rawCustomer, delivery: rawDelivery, payment: rawPayment, idempotencyKey: rawIdempotencyKey } = payload;

  // 1. Validación de idempotencyKey
  const idempotencyKey = sanitizeString(rawIdempotencyKey, 8, 128);
  if (!idempotencyKey) {
    throw new HttpsError("invalid-argument", "La clave de idempotencia (idempotencyKey) es obligatoria (entre 8 y 128 caracteres).");
  }

  // 2. Validación de items
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new HttpsError("invalid-argument", "El pedido debe contener entre 1 y 50 artículos.");
  }

  const validatedItems = [];
  const productIdsSet = new Set();

  for (const item of rawItems) {
    if (!item || typeof item !== "object") {
      throw new HttpsError("invalid-argument", "Formato de artículo inválido.");
    }
    const productId = sanitizeString(item.productId, 1, 100);
    const quantity = Number(item.quantity);

    if (!productId) {
      throw new HttpsError("invalid-argument", "Cada artículo debe especificar un productId válido.");
    }
    if (productIdsSet.has(productId)) {
      throw new HttpsError("invalid-argument", `El producto ${productId} aparece duplicado en la lista de compras.`);
    }
    productIdsSet.add(productId);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new HttpsError("invalid-argument", "La cantidad por artículo debe ser un número entero entre 1 y 99.");
    }

    validatedItems.push({ productId, quantity });
  }

  // 3. Validación de customer
  if (!rawCustomer || typeof rawCustomer !== "object") {
    throw new HttpsError("invalid-argument", "Datos del cliente no especificados.");
  }
  const firstName = sanitizeString(rawCustomer.firstName, 2, 80);
  const lastName = sanitizeString(rawCustomer.lastName, 2, 80);
  const phoneNormalized = normalizePhone(rawCustomer.phone);
  const emailNormalized = normalizeEmail(rawCustomer.email);

  if (!firstName || !lastName) {
    throw new HttpsError("invalid-argument", "Ingresa un nombre y apellido válidos (mínimo 2 caracteres).");
  }
  if (!phoneNormalized) {
    throw new HttpsError("invalid-argument", "Ingresa un número de celular peruano válido (ej. 999999999 o +51999999999).");
  }
  if (emailNormalized === false) {
    throw new HttpsError("invalid-argument", "El formato del email ingresado no es válido.");
  }

  const customerId = customerIdFromPhone(phoneNormalized);

  // 4. Validación de delivery
  if (!rawDelivery || typeof rawDelivery !== "object") {
    throw new HttpsError("invalid-argument", "Datos de entrega no especificados.");
  }
  const deliveryMethod = rawDelivery.method;
  let deliveryAddress = null;
  let deliveryDistrict = null;

  if (deliveryMethod === "delivery") {
    deliveryAddress = sanitizeString(rawDelivery.address, 5, 180);
    deliveryDistrict = sanitizeString(rawDelivery.district, 2, 100);
    if (!deliveryAddress || !deliveryDistrict) {
      throw new HttpsError("invalid-argument", "Para entrega a domicilio, se requiere dirección y distrito válidos.");
    }
  } else if (deliveryMethod === "pickup") {
    deliveryAddress = null;
    deliveryDistrict = null;
  } else {
    throw new HttpsError("invalid-argument", "Método de entrega no válido (debe ser 'pickup' o 'delivery').");
  }

  // 5. Validación de payment
  if (!rawPayment || typeof rawPayment !== "object" || !["yape", "manual"].includes(rawPayment.method)) {
    throw new HttpsError("invalid-argument", "Método de pago no válido (debe ser 'yape' o 'manual').");
  }
  const paymentMethod = rawPayment.method;

  // Transacción atómica de Firestore
  return await db.runTransaction(async (transaction) => {
    // A) Verificar idempotencia existente
    const idempotencyRef = db.collection("order_idempotency").doc(idempotencyKey);
    const idempotencySnap = await transaction.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return idempotencySnap.data().response;
    }

    // B) Leer numeración de tienda
    const settingsRef = db.collection("settings").doc("store");
    const settingsSnap = await transaction.get(settingsRef);
    if (!settingsSnap.exists) {
      throw new HttpsError("failed-precondition", "La configuración de numeración de pedidos (settings/store) no se encuentra inicializada en el sistema.");
    }
    const settingsData = settingsSnap.data();
    const nextOrderNumber = settingsData.nextOrderNumber;
    const orderNumberPrefix = typeof settingsData.orderNumberPrefix === "string" && settingsData.orderNumberPrefix.trim() ? settingsData.orderNumberPrefix.trim() : "EX";

    if (!Number.isInteger(nextOrderNumber) || nextOrderNumber < 1) {
      throw new HttpsError("failed-precondition", "La numeración de pedidos en settings/store (nextOrderNumber) no es válida.");
    }

    // C) Leer productos públicos y privados
    const productReads = [];
    const categoryIdsSet = new Set();

    for (const item of validatedItems) {
      const productRef = db.collection("products").doc(item.productId);
      const privateRef = db.collection("product_private").doc(item.productId);
      productReads.push({
        item,
        productRef,
        privateRef,
        productSnapPromise: transaction.get(productRef),
        privateSnapPromise: transaction.get(privateRef)
      });
    }

    const fetchedProducts = [];
    for (const read of productReads) {
      const productSnap = await read.productSnapPromise;
      const privateSnap = await read.privateSnapPromise;

      if (!productSnap.exists) {
        throw new HttpsError("failed-precondition", `El producto solicitado no existe (ID: ${read.item.productId}).`);
      }
      const productData = productSnap.data();

      if (productData.isActive !== true) {
        throw new HttpsError("failed-precondition", `El producto “${productData.name || read.item.productId}” no está disponible.`);
      }

      const stock = productData.stock;
      if (!Number.isInteger(stock) || stock < read.item.quantity) {
        throw new HttpsError("failed-precondition", `Stock insuficiente para “${productData.name || read.item.productId}”. Disponible: ${stock ?? 0}, solicitado: ${read.item.quantity}.`);
      }

      const regularPrice = Number.isFinite(productData.regularPrice) ? productData.regularPrice : productData.price;
      if (!Number.isFinite(regularPrice) || regularPrice < 0) {
        throw new HttpsError("failed-precondition", `El precio del producto “${productData.name}” no es válido.`);
      }

      let salePrice = null;
      if (Number.isFinite(productData.salePrice) && productData.salePrice >= 0 && productData.salePrice < regularPrice) {
        salePrice = productData.salePrice;
      }

      if (!privateSnap.exists) {
        throw new HttpsError("failed-precondition", `El producto “${productData.name}” no tiene precio de costo registrado.`);
      }

      const costPrice = privateSnap.data()?.costPrice;
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        throw new HttpsError("failed-precondition", `El precio de costo del producto “${productData.name}” no es válido.`);
      }

      if (!productData.categoryId || typeof productData.categoryId !== "string") {
        throw new HttpsError("failed-precondition", `El producto “${productData.name}” no tiene una categoría válida asignada.`);
      }
      categoryIdsSet.add(productData.categoryId);

      fetchedProducts.push({
        item: read.item,
        productRef: read.productRef,
        data: productData,
        regularPrice,
        salePrice,
        costPrice
      });
    }

    // D) Leer categorías requeridas
    const categoryNameMap = new Map();
    for (const catId of categoryIdsSet) {
      const catRef = db.collection("categories").doc(catId);
      const catSnap = await transaction.get(catRef);
      if (!catSnap.exists) {
        throw new HttpsError("failed-precondition", `La categoría asociada (ID: ${catId}) no existe.`);
      }
      categoryNameMap.set(catId, catSnap.data().name || "Sin categoría");
    }

    // E) Leer cliente con ID determinístico derivado del teléfono normalizado
    const customerRef = db.collection("customers").doc(customerId);
    const customerSnap = await transaction.get(customerRef);

    // FIN DE LECTURAS — COMIENZO DE CÁLCULOS (TODOS EN CÉNTIMOS ENTEROS)
    let subtotal = 0;
    let costTotal = 0;
    let discountTotal = 0;
    let itemCount = 0;

    const lineCalculations = fetchedProducts.map((p) => {
      const regUnitPrice = Math.round(p.regularPrice * 100);
      const unitPrice = p.salePrice !== null ? Math.round(p.salePrice * 100) : regUnitPrice;
      const unitCost = Math.round(p.costPrice * 100);

      const qty = p.item.quantity;
      const lineSubtotal = unitPrice * qty;
      const lineCostSubtotal = unitCost * qty;
      const lineGrossProfit = lineSubtotal - lineCostSubtotal;
      const lineDiscount = (regUnitPrice - unitPrice) * qty;

      subtotal += lineSubtotal;
      costTotal += lineCostSubtotal;
      discountTotal += lineDiscount;
      itemCount += qty;

      return {
        ...p,
        regUnitPrice,
        unitPrice,
        unitCost,
        lineSubtotal,
        lineCostSubtotal,
        lineGrossProfit,
        lineDiscount
      };
    });

    const shippingTotal = 0;
    const taxTotal = 0;
    const total = subtotal + shippingTotal;
    const grossProfit = total - costTotal;

    // F) ESCRITURAS

    // F1. Incrementar numeración de pedidos
    const formattedOrderNumber = `${orderNumberPrefix}-${String(nextOrderNumber).padStart(8, "0")}`;
    transaction.update(settingsRef, {
      nextOrderNumber: nextOrderNumber + 1,
      updatedAt: FieldValue.serverTimestamp()
    });

    // F2. Crear/Actualizar Customer determinístico
    const displayPhone = rawCustomer.phone.trim();

    if (customerSnap.exists) {
      const existingData = customerSnap.data();
      const newTotalSpent = (existingData.totalSpent || 0) + total;

      transaction.update(customerRef, {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: emailNormalized || existingData.email || null,
        phone: displayPhone,
        totalOrders: (existingData.totalOrders || 0) + 1,
        totalSpent: newTotalSpent,
        lastOrderAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      transaction.set(customerRef, {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: emailNormalized,
        phone: displayPhone,
        phoneNormalized,
        addresses: deliveryMethod === "delivery" ? [{ address: deliveryAddress, district: deliveryDistrict }] : [],
        totalOrders: 1,
        totalSpent: total,
        lastOrderAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    // F3. Crear Order
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;

    const customerSnapshot = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: emailNormalized,
      phone: displayPhone,
      deliveryMethod,
      address: deliveryAddress,
      district: deliveryDistrict
    };

    transaction.set(orderRef, {
      orderNumber: formattedOrderNumber,
      customerId,
      customerSnapshot,
      delivery: {
        method: deliveryMethod,
        address: deliveryAddress,
        district: deliveryDistrict
      },
      status: "pending",
      paymentStatus: "pending",
      fulfillmentStatus: deliveryMethod === "pickup" ? "pickup_pending" : "delivery_pending",
      paymentMethod,
      currency: "PEN",
      subtotal,
      discountTotal,
      taxTotal: 0,
      shippingTotal: 0,
      total,
      totalCost: costTotal,
      grossProfit,
      itemCount,
      notes: null,
      idempotencyKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      paidAt: null,
      cancelledAt: null
    });

    // F4. Crear el pago inicial junto con el pedido. El total procede únicamente del backend.
    const paymentRef = db.collection("payments").doc();
    transaction.set(paymentRef, {
      orderId,
      orderNumber: formattedOrderNumber,
      customerId,
      method: paymentMethod,
      status: "pending",
      amount: total,
      currency: "PEN",
      reference: null,
      notes: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      verifiedAt: null,
      verifiedByUserId: null
    });

    // F5. Crear Order Items, Movimientos de Inventario y Descontar Stock
    for (const line of lineCalculations) {
      const stockBefore = line.data.stock;
      const stockAfter = stockBefore - line.item.quantity;

      // Descontar stock
      transaction.update(line.productRef, {
        stock: stockAfter,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Crear order_item (importes unificados en céntimos)
      const itemRef = db.collection("order_items").doc();
      transaction.set(itemRef, {
        orderId,
        productId: line.item.productId,
        productName: line.data.name,
        brand: line.data.brand || null,
        sku: line.data.sku || null,
        categoryId: line.data.categoryId,
        categoryName: categoryNameMap.get(line.data.categoryId) || "Sin categoría",
        imageUrl: line.data.image || null,
        quantity: line.item.quantity,
        regularUnitPrice: line.regUnitPrice,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        subtotal: line.lineSubtotal,
        costSubtotal: line.lineCostSubtotal,
        grossProfit: line.lineGrossProfit,
        currency: "PEN",
        createdAt: FieldValue.serverTimestamp()
      });

      // Crear movimiento de inventario (unitCost en céntimos)
      const movementRef = db.collection("inventory_movements").doc();
      transaction.set(movementRef, {
        productId: line.item.productId,
        productName: line.data.name,
        sku: line.data.sku || null,
        type: "sale",
        quantityChange: -line.item.quantity,
        stockBefore,
        stockAfter,
        unitCost: line.unitCost,
        referenceType: "order",
        referenceId: orderId,
        notes: null,
        createdAt: FieldValue.serverTimestamp(),
        createdByUserId: null
      });
    }

    // F6. Guardar registro de idempotencia
    const clientResponse = {
      success: true,
      orderId,
      orderNumber: formattedOrderNumber,
      total,
      currency: "PEN"
    };

    transaction.set(idempotencyRef, {
      orderId,
      orderNumber: formattedOrderNumber,
      total,
      currency: "PEN",
      response: clientResponse,
      createdAt: FieldValue.serverTimestamp()
    });

    return clientResponse;
  });
});
