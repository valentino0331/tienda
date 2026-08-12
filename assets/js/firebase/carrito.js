import { getCart, removeFromCart, updateQuantity, clearCart, syncCartCount } from "../cart.js";

const cartList = document.querySelector("#cart-list"),
  cartSummary = document.querySelector("#cart-summary"),
  regularTotalNode = document.querySelector("#cart-regular-total"),
  discountTotalNode = document.querySelector("#cart-discount-total"),
  totalNode = document.querySelector("#cart-total"),
  clearBtn = document.querySelector("#cart-clear");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function renderCart() {
  const items = getCart();
  if (!cartList) return;

  cartList.replaceChildren();

  if (!items.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "cart-empty";
    emptyMsg.style.cssText = "padding: 3.5rem 1.5rem; text-align: center;";
    emptyMsg.innerHTML = `
      <div style="width:64px;height:64px;margin:0 auto 1rem;background:#f1f5f9;border-radius:50%;display:grid;place-items:center;color:#64748b;">
        <i data-lucide="shopping-bag" style="width:32px;height:32px;"></i>
      </div>
      <h2 style="margin-bottom: 0.5rem;">Tu carrito está vacío</h2>
      <p class="muted" style="margin-bottom: 1.5rem;">Explora nuestros productos exclusivos y agrega tus favoritos.</p>
      <a class="button button--accent" href="catalogo.html">
        <i data-lucide="arrow-right"></i> Explorar Catálogo
      </a>
    `;
    cartList.append(emptyMsg);

    if (cartSummary) cartSummary.hidden = true;
    syncCartCount();
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (cartSummary) cartSummary.hidden = false;

  let total = 0;

  items.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item";

    // Item Image
    if (item.image) {
      const img = document.createElement("img");
      img.className = "cart-item__image";
      img.src = item.image;
      img.alt = item.name;
      row.append(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "cart-item__image";
      placeholder.style.cssText = "display:grid;place-items:center;background:#f1f5f9;color:#94a3b8;";
      placeholder.innerHTML = `<i data-lucide="image"></i>`;
      row.append(placeholder);
    }

    // Item Details
    const details = document.createElement("div");
    details.className = "cart-item__details";

    const title = document.createElement("h4");
    title.className = "cart-item__name";
    title.textContent = item.name;

    const price = document.createElement("div");
    price.className = "cart-item__price";
    price.textContent = `${money(item.price)} c/u`;

    details.append(title, price);

    // Quantity Controls
    const qtyContainer = document.createElement("div");
    qtyContainer.className = "cart-item__quantity";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "qty-btn";
    minusBtn.innerHTML = `<i data-lucide="minus"></i>`;
    minusBtn.onclick = () => {
      if (item.quantity > 1) {
        updateQuantity(item.id, item.quantity - 1);
        renderCart();
      } else {
        removeFromCart(item.id);
        renderCart();
      }
    };

    const qtyText = document.createElement("span");
    qtyText.style.fontWeight = "700";
    qtyText.style.minWidth = "24px";
    qtyText.style.textAlign = "center";
    qtyText.textContent = item.quantity;

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "qty-btn";
    plusBtn.innerHTML = `<i data-lucide="plus"></i>`;
    plusBtn.onclick = () => {
      updateQuantity(item.id, item.quantity + 1);
      renderCart();
    };

    qtyContainer.append(minusBtn, qtyText, plusBtn);

    // Total & Remove
    const itemTotalNode = document.createElement("div");
    itemTotalNode.className = "cart-item__total";
    itemTotalNode.textContent = money(itemTotal);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "button button--small button--danger";
    removeBtn.style.padding = "0.4rem 0.6rem";
    removeBtn.innerHTML = `<i data-lucide="trash-2"></i>`;
    removeBtn.title = "Eliminar artículo";
    removeBtn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    row.append(details, qtyContainer, itemTotalNode, removeBtn);
    cartList.append(row);
  });

  if (regularTotalNode) regularTotalNode.textContent = money(total);
  if (discountTotalNode) discountTotalNode.textContent = "-S/ 0.00";
  if (totalNode) totalNode.textContent = money(total);

  syncCartCount();
  if (window.lucide) window.lucide.createIcons();
}

clearBtn?.addEventListener("click", () => {
  if (confirm("¿Deseas vaciar todo tu carrito de compras?")) {
    clearCart();
    renderCart();
  }
});

renderCart();
