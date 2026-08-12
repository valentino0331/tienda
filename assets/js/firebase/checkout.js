import { getCart, clearCart } from "../cart.js";

const form = document.querySelector("#checkout-form"),
  nameInput = document.querySelector("#customer-name"),
  emailInput = document.querySelector("#customer-email"),
  phoneInput = document.querySelector("#customer-phone"),
  addressInput = document.querySelector("#customer-address"),
  deliverySelect = document.querySelector("#delivery-method"),
  paymentSelect = document.querySelector("#payment-method"),
  totalNode = document.querySelector("#checkout-total"),
  statusNode = document.querySelector("#checkout-status"),
  submitBtn = document.querySelector("#checkout-submit");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function calculateTotal() {
  const items = getCart();
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (totalNode) totalNode.textContent = money(subtotal);
  return subtotal;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const items = getCart();
  if (!items.length) {
    alert("El carrito está vacío.");
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (statusNode) statusNode.hidden = true;

  const subtotal = calculateTotal();
  const payload = {
    customerName: nameInput?.value.trim(),
    customerEmail: emailInput?.value.trim(),
    customerPhone: phoneInput?.value.trim() || "",
    address: addressInput?.value.trim() || "",
    deliveryMethod: deliverySelect?.value || "envio",
    paymentMethod: paymentSelect?.value || "transferencia",
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
    if (!res.ok) throw new Error(data.error || "No se pudo procesar el pedido.");

    clearCart();
    alert(`¡Pedido registrado exitosamente! ID del pedido: #${data.id}`);
    window.location.assign("../index.html");
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = err.message;
      statusNode.hidden = false;
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

calculateTotal();
