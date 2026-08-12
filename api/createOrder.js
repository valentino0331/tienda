import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";

function adminApp() {
  if (getApps().length) return getApps()[0];
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  const localEmulator = process.env.LOCAL_EMULATOR === "true"
    && FIREBASE_PROJECT_ID === "demo-exclusive-shop"
    && !process.env.VERCEL && !process.env.VERCEL_ENV;
  if (localEmulator) return initializeApp({ projectId: FIREBASE_PROJECT_ID });
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error("Firebase Admin no está configurado en el servidor.");
  return initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
}
function localAppCheckBypass() {
  return process.env.LOCAL_EMULATOR === "true"
    && process.env.FIREBASE_PROJECT_ID === "demo-exclusive-shop"
    && !process.env.VERCEL && !process.env.VERCEL_ENV;
}
const clean = (value, min, max) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max ? value.trim() : null;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function phone(value) { const d = typeof value === "string" ? value.replace(/\D/g, "") : ""; return d.length === 9 && d.startsWith("9") ? `+51${d}` : d.length === 11 && d.startsWith("519") ? `+${d}` : null; }
function email(value) { if (!value) return null; const result = typeof value === "string" ? value.trim().toLowerCase() : ""; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result) ? result : false; }

/** Authoritative checkout transaction. Only server code calls this function. */
export async function createOrder(db, payload, uid = null) {
  if (!payload || typeof payload !== "object") throw fail("El cuerpo de la solicitud debe ser un objeto válido.");
  const key = clean(payload.idempotencyKey, 8, 128);
  if (!key) throw fail("La clave de idempotencia es obligatoria.");
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.length > 50) throw fail("El pedido debe contener entre 1 y 50 artículos.");
  const ids = new Set(); const items = payload.items.map((item) => { const productId = clean(item?.productId, 1, 100), quantity = Number(item?.quantity); if (!productId || ids.has(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw fail("Artículos de pedido inválidos."); ids.add(productId); return { productId, quantity }; });
  const customer = payload.customer || {}, firstName = clean(customer.firstName, 2, 80), lastName = clean(customer.lastName, 2, 80), normalizedPhone = phone(customer.phone), normalizedEmail = email(customer.email);
  if (!firstName || !lastName || !normalizedPhone || normalizedEmail === false) throw fail("Datos del cliente inválidos.");
  const delivery = payload.delivery || {}; const method = delivery.method;
  const address = method === "delivery" ? clean(delivery.address, 5, 180) : null, district = method === "delivery" ? clean(delivery.district, 2, 100) : null;
  if (!((method === "pickup") || (method === "delivery" && address && district))) throw fail("Datos de entrega inválidos.");
  if (!["yape", "manual"].includes(payload.payment?.method)) throw fail("Método de pago inválido.");
  const customerId = `cust_${normalizedPhone.replace(/\D/g, "")}`;
  return db.runTransaction(async (tx) => {
    const idempotencyRef = db.collection("order_idempotency").doc(key), existing = await tx.get(idempotencyRef);
    if (existing.exists) return existing.data().response;
    const settingsRef = db.collection("settings").doc("store"), settings = await tx.get(settingsRef);
    if (!settings.exists || !Number.isInteger(settings.data().nextOrderNumber) || settings.data().nextOrderNumber < 1) throw fail("La numeración de pedidos no está configurada.", 412);
    const products = [];
    for (const item of items) { const ref = db.collection("products").doc(item.productId), privateRef = db.collection("product_private").doc(item.productId); const [product, privateData] = await Promise.all([tx.get(ref), tx.get(privateRef)]); const p = product.data(), cost = privateData.data()?.costPrice;
      if (!product.exists || p.isActive !== true || !Number.isInteger(p.stock) || p.stock < item.quantity) throw fail("Producto no disponible o sin stock.", 412);
      const regular = Number.isFinite(p.regularPrice) ? p.regularPrice : p.price, sale = Number.isFinite(p.salePrice) && p.salePrice >= 0 && p.salePrice < regular ? p.salePrice : null;
      if (!Number.isFinite(regular) || regular < 0 || !privateData.exists || !Number.isFinite(cost) || cost < 0 || !clean(p.categoryId, 1, 100)) throw fail("Datos internos de producto inválidos.", 412);
      const category = await tx.get(db.collection("categories").doc(p.categoryId)); if (!category.exists) throw fail("Categoría inexistente.", 412);
      products.push({ item, ref, p, cost, regular, sale, category: category.data().name || "Sin categoría" }); }
    const customerRef = db.collection("customers").doc(customerId), previousCustomer = await tx.get(customerRef);
    let subtotal = 0, totalCost = 0, discountTotal = 0, itemCount = 0;
    const lines = products.map((x) => { const regular = Math.round(x.regular * 100), unit = x.sale === null ? regular : Math.round(x.sale * 100), cost = Math.round(x.cost * 100), subtotalLine = unit * x.item.quantity, costLine = cost * x.item.quantity; subtotal += subtotalLine; totalCost += costLine; discountTotal += (regular - unit) * x.item.quantity; itemCount += x.item.quantity; return { ...x, regular, unit, cost, subtotalLine, costLine }; });
    const total = subtotal, n = settings.data().nextOrderNumber, prefix = clean(settings.data().orderNumberPrefix, 1, 20) || "EX", orderNumber = `${prefix}-${String(n).padStart(8, "0")}`;
    tx.update(settingsRef, { nextOrderNumber: n + 1, updatedAt: FieldValue.serverTimestamp() });
    const sharedCustomer = { firstName, lastName, fullName: `${firstName} ${lastName}`, email: normalizedEmail, phone: customer.phone.trim(), updatedAt: FieldValue.serverTimestamp() };
    previousCustomer.exists ? tx.update(customerRef, { ...sharedCustomer, totalOrders: (previousCustomer.data().totalOrders || 0) + 1, totalSpent: (previousCustomer.data().totalSpent || 0) + total, lastOrderAt: FieldValue.serverTimestamp() }) : tx.set(customerRef, { ...sharedCustomer, phoneNormalized: normalizedPhone, addresses: method === "delivery" ? [{ address, district }] : [], totalOrders: 1, totalSpent: total, lastOrderAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
    const orderRef = db.collection("orders").doc(), orderId = orderRef.id;
    tx.set(orderRef, { orderNumber, customerId, customerSnapshot: { ...sharedCustomer, deliveryMethod: method, address, district }, delivery: { method, address, district }, status: "pending", paymentStatus: "pending", fulfillmentStatus: method === "pickup" ? "pickup_pending" : "delivery_pending", paymentMethod: payload.payment.method, currency: "PEN", subtotal, discountTotal, taxTotal: 0, shippingTotal: 0, total, totalCost, grossProfit: total - totalCost, itemCount, notes: null, idempotencyKey: key, createdByUserId: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), paidAt: null, cancelledAt: null });
    tx.set(db.collection("payments").doc(), { orderId, orderNumber, customerId, method: payload.payment.method, status: "pending", amount: total, currency: "PEN", reference: null, notes: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), verifiedAt: null, verifiedByUserId: null });
    for (const x of lines) { const after = x.p.stock - x.item.quantity; tx.update(x.ref, { stock: after, updatedAt: FieldValue.serverTimestamp() }); tx.set(db.collection("order_items").doc(), { orderId, productId: x.item.productId, productName: x.p.name, brand: x.p.brand || null, sku: x.p.sku || null, categoryId: x.p.categoryId, categoryName: x.category, imageUrl: x.p.image || null, quantity: x.item.quantity, regularUnitPrice: x.regular, unitPrice: x.unit, unitCost: x.cost, subtotal: x.subtotalLine, costSubtotal: x.costLine, grossProfit: x.subtotalLine - x.costLine, currency: "PEN", createdAt: FieldValue.serverTimestamp() }); tx.set(db.collection("inventory_movements").doc(), { productId: x.item.productId, productName: x.p.name, sku: x.p.sku || null, type: "sale", quantityChange: -x.item.quantity, stockBefore: x.p.stock, stockAfter: after, unitCost: x.cost, referenceType: "order", referenceId: orderId, notes: null, createdAt: FieldValue.serverTimestamp(), createdByUserId: null }); }
    const response = { success: true, orderId, orderNumber, total, currency: "PEN" }; tx.set(idempotencyRef, { ...response, response, createdAt: FieldValue.serverTimestamp() }); return response;
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try { const app = adminApp(), appCheckToken = req.headers["x-firebase-appcheck"];
    if (!localAppCheckBypass()) {
      if (!appCheckToken) throw fail("App Check token requerido.", 401);
      await getAppCheck(app).verifyToken(appCheckToken);
    }
    const authHeader = req.headers.authorization || "", token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) throw fail("Firebase ID token requerido.", 401);
    const decoded = await getAuth(app).verifyIdToken(token);
    return res.status(200).json(await createOrder(getFirestore(app), req.body, decoded.uid));
  } catch (error) { return res.status(error.status || 401).json({ error: error.message || "Solicitud rechazada." }); }
}
