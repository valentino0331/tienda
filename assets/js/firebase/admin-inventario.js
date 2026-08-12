import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-inventory-content"),
  identity = document.querySelector("#admin-identity"),
  list = document.querySelector("#inventory-list"),
  status = document.querySelector("#inventory-status"),
  logoutButton = document.querySelector("#admin-logout");

let products = [];

function showStatus(message, success = false) {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("admin-status--success", success);
}

function renderInventory() {
  list.replaceChildren();
  if (!products.length) {
    const empty = document.createElement("p");
    empty.className = "card admin-empty";
    empty.textContent = "No hay productos en inventario.";
    list.append(empty);
    return;
  }

  products.forEach((p) => {
    const item = document.createElement("article");
    item.className = "card admin-item";
    const details = document.createElement("div"), title = document.createElement("h3"), meta = document.createElement("p"), actions = document.createElement("div"), input = document.createElement("input"), btn = document.createElement("button");

    title.textContent = p.name;
    meta.className = "admin-meta";
    meta.textContent = `Stock actual: ${p.stock} (Mínimo: ${p.minStock})`;

    input.type = "number";
    input.min = "0";
    input.value = p.stock;
    input.className = "field";
    input.style.width = "100px";

    btn.textContent = "Actualizar Stock";
    btn.className = "button button--small";
    btn.onclick = async () => {
      try {
        const res = await fetch(`/api/inventory/${p.id}`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ stock: parseInt(input.value, 10) })
        });
        if (!res.ok) throw new Error("Error al actualizar stock");
        showStatus(`Stock actualizado para ${p.name}`, true);
        await loadInventory();
      } catch (err) {
        showStatus(err.message);
      }
    };

    details.append(title, meta);
    actions.className = "admin-actions";
    actions.append(input, btn);
    item.append(details, actions);
    list.append(item);
  });
}

async function loadInventory() {
  const res = await fetch('/api/products');
  if (res.ok) {
    products = await res.json();
    renderInventory();
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
    await loadInventory();
  } catch (err) {
    if (shouldRedirectToAdminLogin(err)) window.location.assign("login.html");
    else showStatus(err.message);
  }
}

init();
