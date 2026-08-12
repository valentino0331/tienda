import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-categories-content"),
  identity = document.querySelector("#admin-identity"),
  form = document.querySelector("#category-form"),
  idInput = document.querySelector("#category-id"),
  nameInput = document.querySelector("#category-name"),
  slugInput = document.querySelector("#category-slug"),
  activeInput = document.querySelector("#category-active"),
  formTitle = document.querySelector("#category-form-title"),
  submitButton = document.querySelector("#category-submit"),
  cancelButton = document.querySelector("#category-cancel"),
  list = document.querySelector("#categories-list"),
  status = document.querySelector("#categories-status"),
  logoutButton = document.querySelector("#admin-logout");

let categories = [];

function showStatus(message, success = false) {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("admin-status--success", success);
}

function clearStatus() {
  if (status) status.hidden = true;
}

function resetForm() {
  form.reset();
  idInput.value = "";
  activeInput.value = "true";
  formTitle.textContent = "Nueva categoría";
  submitButton.textContent = "Guardar categoría";
  cancelButton.hidden = true;
}

function button(label, className, handler) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `button button--small ${className}`;
  item.textContent = label;
  item.addEventListener("click", handler);
  return item;
}

function renderCategories() {
  list.replaceChildren();
  if (!categories.length) {
    const empty = document.createElement("p");
    empty.className = "card admin-empty";
    empty.textContent = "No hay categorías registradas.";
    list.append(empty);
    return;
  }
  categories.forEach((cat) => {
    const item = document.createElement("article");
    item.className = "card admin-item";
    const details = document.createElement("div"), title = document.createElement("h3"), meta = document.createElement("p"), badge = document.createElement("span"), actions = document.createElement("div");

    title.textContent = cat.name;
    meta.className = "admin-meta";
    meta.textContent = `Slug: ${cat.slug}`;
    badge.className = `admin-badge ${cat.isActive ? "admin-badge--success" : "admin-badge--muted"}`;
    badge.textContent = cat.isActive ? "Activo" : "Inactivo";

    details.append(title, meta, badge);
    actions.className = "admin-actions";
    actions.append(
      button("Editar", "button--outline", () => startEdit(cat)),
      button("Eliminar", "button--danger", () => deleteCategory(cat.id))
    );

    item.append(details, actions);
    list.append(item);
  });
}

async function loadCategories() {
  const response = await fetch('/api/categories');
  if (response.ok) {
    categories = await response.json();
    renderCategories();
  }
}

function startEdit(cat) {
  idInput.value = cat.id;
  nameInput.value = cat.name;
  slugInput.value = cat.slug;
  activeInput.value = String(cat.isActive);
  formTitle.textContent = "Editar categoría";
  submitButton.textContent = "Guardar cambios";
  cancelButton.hidden = false;
  clearStatus();
}

async function deleteCategory(id) {
  if (!confirm("¿Eliminar esta categoría?")) return;
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Error al eliminar categoría");
    showStatus("Categoría eliminada.", true);
    await loadCategories();
  } catch (err) {
    showStatus(err.message);
  }
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();
  const isEditing = Boolean(idInput.value);
  const payload = {
    name: nameInput.value.trim(),
    slug: slugInput.value.trim(),
    active: activeInput.value === "true"
  };

  try {
    const url = isEditing ? `/api/categories/${idInput.value}` : '/api/categories';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Error al guardar categoría");

    showStatus(`Categoría ${isEditing ? "actualizada" : "creada"}.`, true);
    resetForm();
    await loadCategories();
  } catch (err) {
    showStatus(err.message);
  }
});

cancelButton?.addEventListener("click", resetForm);

logoutButton?.addEventListener("click", () => {
  setToken(null);
  window.location.assign("login.html");
});

async function init() {
  try {
    const admin = await requireAdmin();
    if (identity) { identity.textContent = admin.user.email; identity.hidden = false; }
    if (content) content.hidden = false;
    await loadCategories();
  } catch (err) {
    if (shouldRedirectToAdminLogin(err)) window.location.assign("login.html");
    else showStatus(err.message);
  }
}

init();
