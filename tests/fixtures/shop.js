export const PROJECT_ID = "demo-exclusive-shop";
export const ADMIN_UID = "admin-active";
export const INACTIVE_ADMIN_UID = "admin-inactive";
export const USER_UID = "user-normal";

export const product = {
  name: "Perfume de prueba",
  description: "Fixture exclusivo para Emulator Suite.",
  brand: "Test Brand",
  sku: "TEST-001",
  categoryId: "cat-active",
  image: "https://example.test/perfume.jpg",
  regularPrice: 100,
  salePrice: 80,
  stock: 10,
  minStockQuantity: 2,
  isActive: true
};

export function validPayload(overrides = {}) {
  return {
    items: [{ productId: "product-active", quantity: 2 }],
    customer: { firstName: "Ana", lastName: "Prueba", phone: "999999999", email: "ana@example.test" },
    delivery: { method: "pickup" },
    payment: { method: "yape" },
    idempotencyKey: "idemp-valid-0001",
    ...overrides
  };
}

export async function seedShop(db, overrides = {}) {
  const activeProduct = { ...product, ...(overrides.product || {}) };
  const batch = db.batch();
  batch.set(db.collection("users").doc(ADMIN_UID), { role: "admin", isActive: true, displayName: "Admin Activo" });
  batch.set(db.collection("users").doc(INACTIVE_ADMIN_UID), { role: "admin", isActive: false, displayName: "Admin Inactivo" });
  batch.set(db.collection("users").doc(USER_UID), { role: "customer", isActive: true, displayName: "Usuario Normal" });
  batch.set(db.collection("categories").doc("cat-active"), { name: "Activa", isActive: true });
  batch.set(db.collection("categories").doc("cat-inactive"), { name: "Inactiva", isActive: false });
  batch.set(db.collection("products").doc("product-active"), activeProduct);
  batch.set(db.collection("products").doc("product-inactive"), { ...activeProduct, isActive: false, sku: "TEST-INACTIVE" });
  batch.set(db.collection("product_private").doc("product-active"), { productId: "product-active", costPrice: 50 });
  batch.set(db.collection("product_private").doc("product-inactive"), { productId: "product-inactive", costPrice: 50 });
  batch.set(db.collection("settings").doc("store"), { nextOrderNumber: 1, orderNumberPrefix: "EX" });
  await batch.commit();
}
