export const CART_STORAGE_KEY = "exclusiveShopCart";

export function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  syncCartCount();
}

export function syncCartCount() {
  const items = getCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = count;
    element.hidden = count === 0;
    element.classList.remove("pulse");
    void element.offsetWidth; // trigger reflow
    if (count > 0) element.classList.add("pulse");
  });
  if (window.lucide) window.lucide.createIcons();
}

export function showToast(title, message = "Guardado en tu carrito de compras.", type = "success") {
  let container = document.getElementById("toast-container") || document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.append(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast--${type} glass-card toast--visible`;
  toast.innerHTML = `
    <div class="toast__icon">
      <i data-lucide="${type === 'error' ? 'alert-circle' : 'shopping-bag'}"></i>
    </div>
    <div class="toast__content">
      <div class="toast__title">${title}</div>
      <div class="toast__message">${message}</div>
    </div>
    <button class="toast__close" type="button" aria-label="Cerrar">
      <i data-lucide="x"></i>
    </button>
  `;

  toast.querySelector(".toast__close").onclick = () => {
    toast.classList.remove("toast--visible");
    toast.classList.add("toast--hiding");
    setTimeout(() => toast.remove(), 300);
  };
  container.append(toast);

  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove("toast--visible");
      toast.classList.add("toast--hiding");
      setTimeout(() => toast.remove(), 300);
    }
  }, 3500);
}

export function addToCart(product) {
  const items = getCart();
  const existing = items.find((entry) => entry.id === product.id);

  if (existing) {
    if (product.stock && existing.quantity >= product.stock) {
      showToast("Sin stock adicional", "Alcanzaste el límite disponible de este producto.", "error");
      return false;
    }
    existing.quantity += 1;
  } else {
    items.push({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      regularPrice: product.regularPrice ? parseFloat(product.regularPrice) : parseFloat(product.price),
      salePrice: product.salePrice ? parseFloat(product.salePrice) : null,
      image: product.image || "",
      stock: product.stock || 999,
      quantity: 1
    });
  }

  saveCart(items);
  showToast(`¡${product.name} añadido!`, "Se agregó correctamente a tu carrito.", "success");
  return true;
}

export function updateQuantity(id, quantity) {
  const items = getCart();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  if (quantity < 1) {
    removeFromCart(id);
    return;
  }

  item.quantity = quantity;
  saveCart(items);
}

export function removeFromCart(id) {
  saveCart(getCart().filter((item) => item.id !== id));
}

export function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  syncCartCount();
}

document.addEventListener("DOMContentLoaded", () => {
  syncCartCount();
  if (window.lucide) window.lucide.createIcons();
});
