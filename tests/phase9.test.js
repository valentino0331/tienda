import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test, before, after } from "node:test";
import { initializeApp, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { ADMIN_UID, INACTIVE_ADMIN_UID, PROJECT_ID, USER_UID, seedShop, validPayload } from "./fixtures/shop.js";

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = firestoreHost.split(":");
const port = Number(portText);
const functionsUrl = `http://${host}:5001/${PROJECT_ID}/us-central1/createOrder`;
const authUrl = `http://${host}:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`;
let adminApp;
let adminDb;
let testEnv;

function callable(payload) {
  return fetch(functionsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload })
  }).then(async (response) => ({ response, body: await response.json() }));
}

function callableStatus(code) {
  return code.toUpperCase().replaceAll("-", "_");
}

async function createAuthUser(email) {
  const response = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestPass123!", returnSecureToken: true })
  });
  return { response, body: await response.json() };
}

async function reset(overrides = {}) {
  await testEnv.clearFirestore();
  await seedShop(adminDb, overrides);
}

async function collectionCount(name) {
  return (await adminDb.collection(name).get()).size;
}

before(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;
  adminApp = initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() }, "phase9-tests");
  adminDb = getFirestore(adminApp);
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host, port, rules: await readFile("firestore.rules", "utf8") }
  });
});

after(async () => {
  await testEnv.clearFirestore();
  await testEnv.cleanup();
  await deleteApp(adminApp);
});

test("Firestore Rules: catálogo público y administración", { concurrency: false }, async (t) => {
  await reset();
  const anonymous = testEnv.unauthenticatedContext().firestore();
  const normal = testEnv.authenticatedContext(USER_UID).firestore();
  const inactive = testEnv.authenticatedContext(INACTIVE_ADMIN_UID).firestore();
  const admin = testEnv.authenticatedContext(ADMIN_UID).firestore();

  await t.test("PASS público lee solo catálogo activo", async () => {
    await assertSucceeds(anonymous.doc("products/product-active").get());
    await assertSucceeds(anonymous.doc("categories/cat-active").get());
    await assertFails(anonymous.doc("products/product-inactive").get());
    await assertFails(anonymous.doc("categories/cat-inactive").get());
    await assertFails(anonymous.doc("product_private/product-active").get());
  });
  await t.test("PASS público no escribe datos administrativos", async () => {
    for (const path of ["products/product-active", "categories/cat-active", "orders/x", "order_items/x", "customers/x", "payments/x", "inventory_movements/x"]) {
      await assertFails(anonymous.doc(path).set({ forbidden: true }));
    }
  });
  await t.test("PASS normal e inactivo son rechazados; admin activo accede", async () => {
    await assertFails(normal.doc("orders/x").get());
    await assertFails(inactive.doc("products/product-active").update({ stock: 9 }));
    await assertSucceeds(admin.doc("product_private/product-active").get());
    await assertSucceeds(admin.doc("products/product-active").update({ stock: 9 }));
  });
});

test("Auth Emulator: usuarios de prueba locales", { concurrency: false }, async () => {
  const users = await Promise.all(["normal", "admin-active", "admin-inactive"].map((role) => createAuthUser(`${role}@phase9.test`)));
  assert.ok(users.every(({ response, body }) => response.status === 200 && typeof body.localId === "string"));
});

test("createOrder: pedido válido, importes, idempotencia y cliente", { concurrency: false }, async (t) => {
  await reset();
  const first = await callable(validPayload());
  await t.test("PASS respuesta y persistencia autoritativa", async () => {
    assert.equal(first.response.status, 200);
    assert.equal(first.body.result.success, true);
    assert.equal(first.body.result.orderNumber, "EX-00000001");
    assert.equal(first.body.result.total, 16000);
    assert.equal(first.body.result.currency, "PEN");
    const order = (await adminDb.collection("orders").doc(first.body.result.orderId).get()).data();
    assert.deepEqual([order.subtotal, order.discountTotal, order.total, order.totalCost, order.grossProfit], [16000, 4000, 16000, 10000, 6000]);
    assert.equal((await adminDb.collection("products").doc("product-active").get()).data().stock, 8);
    const item = (await adminDb.collection("order_items").get()).docs[0].data();
    assert.deepEqual([item.regularUnitPrice, item.unitPrice, item.unitCost, item.subtotal, item.costSubtotal, item.grossProfit], [10000, 8000, 5000, 16000, 10000, 6000]);
    const movement = (await adminDb.collection("inventory_movements").get()).docs[0].data();
    assert.deepEqual([movement.quantityChange, movement.stockBefore, movement.stockAfter], [-2, 10, 8]);
    assert.equal((await adminDb.collection("payments").get()).docs[0].data().status, "pending");
  });
  await t.test("PASS misma idempotencyKey no duplica documentos ni descuenta stock", async () => {
    const second = await callable(validPayload());
    assert.deepEqual(second.body.result, first.body.result);
    for (const collection of ["orders", "payments", "order_items", "inventory_movements"]) assert.equal(await collectionCount(collection), 1);
    assert.equal((await adminDb.collection("products").doc("product-active").get()).data().stock, 8);
  });
  await t.test("PASS mismo teléfono reutiliza customer y acumula totales", async () => {
    const next = await callable(validPayload({ idempotencyKey: "idemp-customer-0002" }));
    assert.equal(next.response.status, 200);
    const customer = (await adminDb.collection("customers").doc("cust_51999999999").get()).data();
    assert.equal(customer.totalOrders, 2);
    assert.equal(customer.totalSpent, 32000);
  });
});

test("createOrder: rechazos no dejan documentos parciales", { concurrency: false }, async (t) => {
  const scenarios = [
    ["payload inválido", {}, "invalid-argument"],
    ["stock insuficiente", validPayload({ items: [{ productId: "product-active", quantity: 2 }] }), "failed-precondition", { product: { stock: 1 } }],
    ["producto inactivo", validPayload({ items: [{ productId: "product-inactive", quantity: 1 }] }), "failed-precondition"],
    ["costPrice ausente", validPayload(), "failed-precondition", null, "private"],
    ["categoría ausente", validPayload(), "failed-precondition", null, "category"]
  ];
  for (const [name, payload, code, fixture, mutation] of scenarios) {
    await t.test(`PASS ${name}`, async () => {
      await reset(fixture || {});
      if (mutation === "private") await adminDb.collection("product_private").doc("product-active").delete();
      if (mutation === "category") await adminDb.collection("categories").doc("cat-active").delete();
      const beforeStock = (await adminDb.collection("products").doc("product-active").get()).data().stock;
      const result = await callable(payload);
      assert.equal(result.response.status, 400);
      assert.equal(result.body.error.status, callableStatus(code));
      for (const collection of ["orders", "payments", "order_items", "inventory_movements", "order_idempotency", "customers"]) assert.equal(await collectionCount(collection), 0);
      assert.equal((await adminDb.collection("products").doc("product-active").get()).data().stock, beforeStock);
    });
  }
});

test("createOrder: concurrencia de stock, cliente y números", { concurrency: false }, async (t) => {
  await t.test("PASS stock=1 permite exactamente una compra", async () => {
    await reset({ product: { stock: 1 } });
    const [a, b] = await Promise.all([callable(validPayload({ items: [{ productId: "product-active", quantity: 1 }], idempotencyKey: "idemp-stock-a" })), callable(validPayload({ items: [{ productId: "product-active", quantity: 1 }], idempotencyKey: "idemp-stock-b" }))]);
    assert.deepEqual([a.response.status, b.response.status].sort(), [200, 400]);
    assert.equal(await collectionCount("orders"), 1);
    assert.equal((await adminDb.collection("products").doc("product-active").get()).data().stock, 0);
  });
  await t.test("PASS mismo teléfono concurrente crea un customer", async () => {
    await reset();
    const payloadA = validPayload({ idempotencyKey: "idemp-phone-a", customer: { firstName: "Eva", lastName: "Concurrente", phone: "988888888" } });
    const payloadB = validPayload({ idempotencyKey: "idemp-phone-b", customer: { firstName: "Eva", lastName: "Concurrente", phone: "988888888" } });
    const responses = await Promise.all([callable(payloadA), callable(payloadB)]);
    assert.ok(responses.every(({ response }) => response.status === 200));
    assert.equal(await collectionCount("customers"), 1);
    assert.equal((await adminDb.collection("customers").doc("cust_51988888888").get()).data().totalOrders, 2);
  });
  await t.test("PASS números concurrentes son únicos y secuenciales", async () => {
    await reset();
    const responses = await Promise.all([1, 2, 3].map((n) => callable(validPayload({ items: [{ productId: "product-active", quantity: 1 }], idempotencyKey: `idemp-order-${n}`, customer: { firstName: "Nora", lastName: `Prueba${n}`, phone: `97${n}111111` } }))));
    assert.ok(responses.every(({ response }) => response.status === 200));
    const numbers = (await adminDb.collection("orders").get()).docs.map((doc) => doc.data().orderNumber).sort();
    assert.deepEqual(numbers, ["EX-00000001", "EX-00000002", "EX-00000003"]);
  });
});

test("Payments e Inventory: transacciones administrativas autorizadas", { concurrency: false }, async (t) => {
  await reset();
  const created = await callable(validPayload());
  const orderId = created.body.result.orderId;
  const payment = (await adminDb.collection("payments").get()).docs[0];
  const admin = testEnv.authenticatedContext(ADMIN_UID).firestore();
  await t.test("PASS pago pending pasa a paid junto con el pedido", async () => {
    await assertSucceeds(admin.runTransaction(async (tx) => {
      tx.update(admin.doc(`payments/${payment.id}`), { status: "paid", verifiedAt: new Date(), verifiedByUserId: ADMIN_UID });
      tx.update(admin.doc(`orders/${orderId}`), { paymentStatus: "paid", paidAt: new Date() });
    }));
    assert.equal((await adminDb.collection("payments").doc(payment.id).get()).data().status, "paid");
    assert.equal((await adminDb.collection("orders").doc(orderId).get()).data().paymentStatus, "paid");
  });
  await t.test("PASS pago pending puede pasar a failed junto con el pedido", async () => {
    const rejected = await callable(validPayload({ idempotencyKey: "idemp-payment-failed" }));
    const rejectedOrderId = rejected.body.result.orderId;
    const rejectedPayment = (await adminDb.collection("payments").get()).docs.find((doc) => doc.data().orderId === rejectedOrderId);
    await assertSucceeds(admin.runTransaction(async (tx) => {
      tx.update(admin.doc(`payments/${rejectedPayment.id}`), { status: "failed", verifiedAt: new Date(), verifiedByUserId: ADMIN_UID });
      tx.update(admin.doc(`orders/${rejectedOrderId}`), { paymentStatus: "failed" });
    }));
    assert.equal((await adminDb.collection("payments").doc(rejectedPayment.id).get()).data().status, "failed");
    assert.equal((await adminDb.collection("orders").doc(rejectedOrderId).get()).data().paymentStatus, "failed");
  });
  await t.test("PASS ajuste de inventario conserva stock no negativo y atribución", async () => {
    const productRef = admin.doc("products/product-active");
    const movementRef = admin.collection("inventory_movements").doc("manual-adjustment");
    let stockBefore;
    await assertSucceeds(admin.runTransaction(async (tx) => {
      const snap = await tx.get(productRef); stockBefore = snap.data().stock;
      tx.update(productRef, { stock: stockBefore + 5 });
      tx.set(movementRef, { productId: "product-active", quantityChange: 5, stockBefore, stockAfter: stockBefore + 5, createdByUserId: ADMIN_UID });
    }));
    const movement = (await adminDb.collection("inventory_movements").doc("manual-adjustment").get()).data();
    assert.deepEqual([movement.quantityChange, movement.stockBefore, movement.stockAfter, movement.createdByUserId], [5, stockBefore, stockBefore + 5, ADMIN_UID]);
  });
  await t.test("PASS salida manual y salida superior al stock", async () => {
    const productRef = admin.doc("products/product-active");
    const movementRef = admin.collection("inventory_movements").doc("manual-out");
    let stockBefore;
    await assertSucceeds(admin.runTransaction(async (tx) => {
      const snap = await tx.get(productRef); stockBefore = snap.data().stock;
      tx.update(productRef, { stock: stockBefore - 3 });
      tx.set(movementRef, { productId: "product-active", quantityChange: -3, stockBefore, stockAfter: stockBefore - 3, createdByUserId: ADMIN_UID });
    }));
    assert.equal((await adminDb.collection("products").doc("product-active").get()).data().stock, stockBefore - 3);
    await assertFails(admin.doc("products/product-active").update({ stock: -1 }));
  });
  await t.test("stock negativo es rechazado incluso para un administrador", async () => {
    await assertFails(admin.doc("products/product-active").update({ stock: -1 }));
  });
});
