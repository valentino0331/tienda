import { getCart, clearCart } from "../cart.js";

const checkoutEmpty = document.querySelector("#checkout-empty"),
  checkoutContent = document.querySelector("#checkout-content"),
  checkoutSuccess = document.querySelector("#checkout-success"),
  form = document.querySelector("#checkout-form"),
  firstNameInput = document.querySelector("#checkout-first-name"),
  lastNameInput = document.querySelector("#checkout-last-name"),
  phoneInput = document.querySelector("#checkout-phone"),
  emailInput = document.querySelector("#checkout-email"),
  addressInput = document.querySelector("#checkout-address"),
  checkoutItemsNode = document.querySelector("#checkout-items"),
  regularTotalNode = document.querySelector("#checkout-regular-total"),
  totalNode = document.querySelector("#checkout-total"),
  statusNode = document.querySelector("#checkout-status"),
  successNumberNode = document.querySelector("#success-order-number"),
  successTotalNode = document.querySelector("#success-order-total"),
  successPaymentNode = document.querySelector("#success-payment-method");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function initCheckout() {
  const items = getCart();
  if (!items.length) {
    if (checkoutEmpty) checkoutEmpty.hidden = false;
    if (checkoutContent) checkoutContent.hidden = true;
    return;
  }

  if (checkoutEmpty) checkoutEmpty.hidden = true;
  if (checkoutContent) checkoutContent.hidden = false;

  let total = 0;
  if (checkoutItemsNode) {
    checkoutItemsNode.replaceChildren();
    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      total += itemTotal;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;margin-bottom:0.5rem;";
      row.innerHTML = `<span>${item.name} (x${item.quantity})</span><strong>${money(itemTotal)}</strong>`;
      checkoutItemsNode.append(row);
    });
  }

  if (regularTotalNode) regularTotalNode.textContent = money(total);
  if (totalNode) totalNode.textContent = money(total);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const items = getCart();
  if (!items.length) {
    alert("El carrito está vacío.");
    return;
  }

  if (statusNode) statusNode.hidden = true;

  const firstName = firstNameInput?.value.trim() || "";
  const lastName = lastNameInput?.value.trim() || "";
  const customerName = `${firstName} ${lastName}`.trim();
  const customerPhone = phoneInput?.value.trim() || "";
  const customerEmail = emailInput?.value.trim() || "cliente@ejemplo.com";
  const address = addressInput?.value.trim() || "";

  const deliveryElem = form.querySelector('input[name="delivery"]:checked');
  const paymentElem = form.querySelector('input[name="payment"]:checked');

  const deliveryMethod = deliveryElem ? deliveryElem.value : "recoge";
  const paymentMethod = paymentElem ? paymentElem.value : "yape";

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const payload = {
    customerName,
    customerEmail,
    customerPhone,
    address,
    deliveryMethod,
    paymentMethod,
    items,
    subtotal,
    shippingCost: 0,
    total: subtotal
  };

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo registrar el pedido.");

    clearCart();

    if (checkoutContent) checkoutContent.hidden = true;
    if (checkoutSuccess) {
      if (successNumberNode) successNumberNode.textContent = `#${data.id}`;
      if (successTotalNode) successTotalNode.textContent = money(subtotal);
      if (successPaymentNode) successPaymentNode.textContent = paymentMethod.toUpperCase();
      checkoutSuccess.hidden = false;
    }
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = err.message;
      statusNode.hidden = false;
    }
  }
});

initCheckout();
