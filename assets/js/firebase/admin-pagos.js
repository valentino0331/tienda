import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-payments-content"),
  identity = document.querySelector("#admin-identity"),
  list = document.querySelector("#payments-list"),
  status = document.querySelector("#payments-status"),
  logoutButton = document.querySelector("#admin-logout");

let orders = [];

function showStatus(message, success = false) {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("admin-status--success", success);
}

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function renderOrders() {
  list.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement("p");
    empty.className = "card admin-empty";
    empty.textContent = "No hay pedidos registrados.";
    list.append(empty);
    return;
  }

  orders.forEach((o) => {
    const item = document.createElement("article");
    item.className = "card admin-item";
    const details = document.createElement("div"), title = document.createElement("h3"), meta = document.createElement("p"), actions = document.createElement("div");

    title.textContent = `Pedido #${o.id} - ${o.customerName}`;
    meta.className = "admin-meta";
    meta.textContent = `Correo: ${o.customerEmail} · Total: ${money(o.total)} · Estado Pedido: ${o.status} · Estado Pago: ${o.paymentStatus}`;

    const markPaidBtn = document.createElement("button");
    markPaidBtn.textContent = "Marcar Pagado";
    markPaidBtn.className = "button button--small";
    markPaidBtn.onclick = async () => {
      try {
        const res = await fetch(`/api/orders/${o.id}/status`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ paymentStatus: 'pagado', status: 'completado' })
        });
        if (!res.ok) throw new Error("Error al actualizar pedido");
        showStatus(`Pedido #${o.id} marcado como pagado`, true);
        await loadOrders();
      } catch (err) {
        showStatus(err.message);
      }
    };

    details.append(title, meta);
    actions.className = "admin-actions";
    actions.append(markPaidBtn);
    item.append(details, actions);
    list.append(item);
  });
}

async function loadOrders() {
  const res = await fetch('/api/orders', { headers: getAuthHeaders() });
  if (res.ok) {
    orders = await res.json();
    renderOrders();
  }
}

logoutButton?.addEventListener("click", () => {
  setToken(null);
  window.location.assign("login.html");
});

async function init() {
  try {
    const admin = await requireAdmin();
    if (identity) { identity.textContent = admin.user.email; identity.hidden = false; }
    if (content) content.hidden = false;
    await loadOrders();
  } catch (err) {
    if (shouldRedirectToAdminLogin(err)) window.location.assign("login.html");
    else showStatus(err.message);
  }
}

init();
