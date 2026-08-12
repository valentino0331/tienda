import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { getApps, deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PROJECT_ID, seedShop, validPayload } from "./fixtures/shop.js";

process.env.LOCAL_EMULATOR = "true";
process.env.FIREBASE_PROJECT_ID = PROJECT_ID;

let handler;
let db;

function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function call(headers = {}, body = validPayload()) {
  const res = response();
  await handler({ method: "POST", headers, body }, res);
  return res;
}

async function authToken() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  const result = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `endpoint-${Date.now()}@test.local`, password: "TestPass123!", returnSecureToken: true }) });
  return (await result.json()).idToken;
}

before(async () => {
  ({ default: handler } = await import("../api/createOrder.js"));
  if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
  db = getFirestore(getApps()[0]);
});

after(async () => { await Promise.all(getApps().map(deleteApp)); });

test("Vercel endpoint: Auth obligatorio y App Check obligatorio fuera de local", async () => {
  const noAuth = await call();
  assert.equal(noAuth.statusCode, 401);
  process.env.LOCAL_EMULATOR = "false";
  const noAppCheck = await call();
  assert.equal(noAppCheck.statusCode, 401);
  process.env.LOCAL_EMULATOR = "true";
});

test("Vercel endpoint: pedido autoritativo e idempotente en Emulator", async () => {
  await db.recursiveDelete(db.collection("orders"));
  await db.recursiveDelete(db.collection("order_items"));
  await db.recursiveDelete(db.collection("payments"));
  await db.recursiveDelete(db.collection("customers"));
  await db.recursiveDelete(db.collection("inventory_movements"));
  await db.recursiveDelete(db.collection("order_idempotency"));
  await db.recursiveDelete(db.collection("products"));
  await db.recursiveDelete(db.collection("product_private"));
  await db.recursiveDelete(db.collection("categories"));
  await db.recursiveDelete(db.collection("settings"));
  await seedShop(db);
  const token = await authToken();
  const payload = { ...validPayload(), total: 1, price: 1, items: [{ productId: "product-active", quantity: 2, unitPrice: 1 }] };
  const first = await call({ authorization: `Bearer ${token}` }, payload);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.total, 16000);
  const second = await call({ authorization: `Bearer ${token}` }, payload);
  assert.deepEqual(second.body, first.body);
  assert.equal((await db.collection("products").doc("product-active").get()).data().stock, 8);
});
