import { getCart, removeFromCart, updateQuantity, clearCart } from "../cart.js";

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
    emptyMsg.style.padding = "2rem";
    emptyMsg.style.textAlign = "center";
    emptyMsg.innerHTML = `<h2 style="margin-bottom:0.5rem;">Tu carrito está vacío</h2><p class="muted" style="margin-bottom:1.5rem;">Agrega productos desde el catálogo para continuar.</p><a class="button button--outline" href="catalogo.html">Ir al catálogo</a>`;
    cartList.append(emptyMsg);

    if (cartSummary) cartSummary.hidden = true;
    return;
  }

  if (cartSummary) cartSummary.hidden = false;

  let total = 0;

  items.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:1rem 0;border-bottom:1px solid #eee;";

    const info = document.createElement("div");
    const title = document.createElement("h4");
    title.style.margin = "0 0 0.25rem 0";
    title.textContent = item.name;

    const priceText = document.createElement("p");
    priceText.style.margin = "0";
    priceText.className = "muted";
    priceText.textContent = `${money(item.price)} c/u`;

    info.append(title, priceText);

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex;align-items:center;gap:0.75rem;";

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = item.quantity;
    qtyInput.style.width = "60px";
    qtyInput.className = "field";
    qtyInput.onchange = () => {
      const val = parseInt(qtyInput.value, 10);
      if (val > 0) {
        updateQuantity(item.id, val);
        renderCart();
      }
    };

    const itemTotalText = document.createElement("strong");
    itemTotalText.textContent = money(itemTotal);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "button button--small button--danger";
    removeBtn.textContent = "✕";
    removeBtn.title = "Eliminar producto";
    removeBtn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    controls.append(qtyInput, itemTotalText, removeBtn);
    row.append(info, controls);
    cartList.append(row);
  });

  if (regularTotalNode) regularTotalNode.textContent = money(total);
  if (discountTotalNode) discountTotalNode.textContent = "-S/ 0.00";
  if (totalNode) totalNode.textContent = money(total);
}

clearBtn?.addEventListener("click", () => {
  if (confirm("¿Deseas vaciar todo el carrito?")) {
    clearCart();
    renderCart();
  }
});

renderCart();
