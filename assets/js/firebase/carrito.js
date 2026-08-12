import { getCart, removeFromCart, updateQuantity, clearCart } from "../cart.js";

const list = document.querySelector("#cart-items"),
  totalNode = document.querySelector("#cart-total"),
  emptyMsg = document.querySelector("#cart-empty"),
  checkoutLink = document.querySelector("#cart-checkout");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function renderCart() {
  const items = getCart();
  if (!list) return;

  list.replaceChildren();

  if (!items.length) {
    if (emptyMsg) emptyMsg.hidden = false;
    if (checkoutLink) checkoutLink.classList.add("disabled");
    if (totalNode) totalNode.textContent = money(0);
    return;
  }

  if (emptyMsg) emptyMsg.hidden = true;
  if (checkoutLink) checkoutLink.classList.remove("disabled");

  let total = 0;

  items.forEach((item) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    const row = document.createElement("div");
    row.className = "cart-item card";

    const title = document.createElement("h4");
    title.textContent = item.name;

    const price = document.createElement("p");
    price.textContent = `${money(item.price)} x ${item.quantity} = ${money(itemTotal)}`;

    const removeBtn = document.createElement("button");
    removeBtn.className = "button button--small button--danger";
    removeBtn.textContent = "Eliminar";
    removeBtn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    row.append(title, price, removeBtn);
    list.append(row);
  });

  if (totalNode) totalNode.textContent = money(total);
}

renderCart();
