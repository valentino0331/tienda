import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-products-content"),
  identity = document.querySelector("#admin-identity"),
  form = document.querySelector("#product-form"),
  idInput = document.querySelector("#product-id"),
  nameInput = document.querySelector("#product-name"),
  descriptionInput = document.querySelector("#product-description"),
  brandInput = document.querySelector("#product-brand"),
  skuInput = document.querySelector("#product-sku"),
  regularPriceInput = document.querySelector("#product-regular-price"),
  salePriceInput = document.querySelector("#product-sale-price"),
  costPriceInput = document.querySelector("#product-cost-price"),
  categoryInput = document.querySelector("#product-category"),
  imageInput = document.querySelector("#product-image"),
  stockInput = document.querySelector("#product-stock"),
  minStockInput = document.querySelector("#product-min-stock"),
  activeInput = document.querySelector("#product-active"),
  formTitle = document.querySelector("#product-form-title"),
  submitButton = document.querySelector("#product-submit"),
  cancelButton = document.querySelector("#product-cancel"),
  list = document.querySelector("#products-list"),
  status = document.querySelector("#products-status"),
  logoutButton = document.querySelector("#admin-logout");

let categories = [], products = [], currentAdmin = null;

function showStatus(message, success = false) {
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("admin-status--success", success);
}

function clearStatus() {
  if (status) status.hidden = true;
}

function button(label, className, handler) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `button button--small ${className}`;
  item.textContent = label;
  item.addEventListener("click", handler);
  return item;
}

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function prices(product) {
  const regularPrice = Number.isFinite(product.regularPrice) ? product.regularPrice : product.price;
  const salePrice = Number.isFinite(product.salePrice) && product.salePrice < regularPrice ? product.salePrice : null;
  return { regularPrice, salePrice };
}

function priceLabel(product) {
  const { regularPrice, salePrice } = prices(product);
  return salePrice === null ? money(regularPrice) : `${money(regularPrice)} → ${money(salePrice)}`;
}

function resetForm() {
  form.reset();
  idInput.value = "";
  brandInput.value = "";
  skuInput.value = "";
  costPriceInput.value = "";
  minStockInput.value = "0";
  stockInput.readOnly = false;
  activeInput.value = "true";
  formTitle.textContent = "Nuevo producto";
  submitButton.textContent = "Guardar producto";
  cancelButton.hidden = true;
  renderCategoryOptions();
}

function renderCategoryOptions(selected = "") {
  categoryInput.replaceChildren(new Option("Selecciona una categoría", ""));
  categories.filter((category) => category.isActive).forEach((category) => {
    categoryInput.add(new Option(category.name, category.id, false, category.id === selected));
  });
  categoryInput.disabled = !categories.some((category) => category.isActive);
}

async function loadCategories(selected = "") {
  const response = await fetch('/api/categories');
  if (response.ok) {
    categories = await response.json();
    renderCategoryOptions(selected);
  }
}

function categoryName(id) {
  return categories.find((category) => category.id === id)?.name || "Categoría no disponible";
}

function imageNode(product) {
  if (!product.image) {
    const placeholder = document.createElement("div");
    placeholder.className = "product-thumbnail product-thumbnail--placeholder";
    placeholder.textContent = "Sin imagen";
    return placeholder;
  }
  const image = document.createElement("img");
  image.className = "product-thumbnail";
  image.src = product.image;
  image.alt = "";
  return image;
}

function renderProducts() {
  list.replaceChildren();
  if (!products.length) {
    const empty = document.createElement("p");
    empty.className = "card admin-empty";
    empty.textContent = "Aún no hay productos registrados.";
    list.append(empty);
    return;
  }
  products.forEach((product) => {
    const item = document.createElement("article");
    item.className = "card admin-item product-admin-item";
    const details = document.createElement("div"), title = document.createElement("h3"), description = document.createElement("p"), meta = document.createElement("p"), badge = document.createElement("span"), actions = document.createElement("div");

    title.textContent = product.name;
    description.textContent = product.description;
    meta.className = "admin-meta";

    const brandStr = product.brand ? `Marca: ${product.brand} · ` : "";
    const skuStr = product.sku ? `SKU: ${product.sku} · ` : "";
    const costStr = Number.isFinite(product.costPrice) ? ` · Costo: ${money(product.costPrice)}` : " · Sin costo";

    meta.textContent = `${brandStr}${skuStr}Categoría: ${categoryName(product.categoryId)} · Precio: ${priceLabel(product)}${costStr} · Stock: ${product.stock} (mín: ${product.minStock})`;
    badge.className = `admin-badge ${product.isActive ? "admin-badge--success" : "admin-badge--muted"}`;
    badge.textContent = product.isActive ? "Activo" : "Inactivo";

    details.append(title, description, meta, badge);
    actions.className = "admin-actions";

    actions.append(
      button("Editar", "button--outline", () => startEdit(product)),
      button("Eliminar", "button--danger", () => deleteProductItem(product.id))
    );

    item.append(imageNode(product), details, actions);
    list.append(item);
  });
}

async function loadProducts() {
  const response = await fetch('/api/products');
  if (response.ok) {
    products = await response.json();
    renderProducts();
  }
}

function startEdit(product) {
  idInput.value = product.id;
  nameInput.value = product.name;
  descriptionInput.value = product.description;
  brandInput.value = product.brand || "";
  skuInput.value = product.sku || "";

  const { regularPrice, salePrice } = prices(product);
  regularPriceInput.value = regularPrice;
  salePriceInput.value = salePrice ?? "";
  costPriceInput.value = Number.isFinite(product.costPrice) ? product.costPrice : "";

  renderCategoryOptions(product.categoryId);
  categoryInput.value = product.categoryId;
  imageInput.value = product.image || "";
  stockInput.value = product.stock;
  stockInput.readOnly = true;
  minStockInput.value = product.minStock;
  activeInput.value = String(product.isActive);

  formTitle.textContent = "Editar producto";
  submitButton.textContent = "Guardar cambios";
  cancelButton.hidden = false;
  clearStatus();
  form.scrollIntoView({ behavior: "smooth" });
}

async function deleteProductItem(id) {
  if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error("Error al eliminar producto");
    showStatus("Producto eliminado.", true);
    await loadProducts();
  } catch (error) {
    showStatus(error.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();

  const isEditing = Boolean(idInput.value);
  const payload = {
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    brand: brandInput.value.trim(),
    sku: skuInput.value.trim(),
    regularPrice: parseFloat(regularPriceInput.value),
    salePrice: salePriceInput.value ? parseFloat(salePriceInput.value) : null,
    costPrice: costPriceInput.value ? parseFloat(costPriceInput.value) : null,
    categoryId: categoryInput.value,
    image: imageInput.value.trim(),
    stock: parseInt(stockInput.value, 10),
    minStock: parseInt(minStockInput.value, 10),
    active: activeInput.value === "true"
  };

  try {
    const url = isEditing ? `/api/products/${idInput.value}` : '/api/products';
    const method = isEditing ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar el producto.");

    showStatus(`Producto ${isEditing ? "actualizado" : "creado"} exitosamente.`, true);
    resetForm();
    await loadProducts();
  } catch (error) {
    showStatus(error.message);
  }
});

cancelButton.addEventListener("click", resetForm);

logoutButton?.addEventListener("click", () => {
  setToken(null);
  window.location.assign("login.html");
});

async function init() {
  try {
    currentAdmin = await requireAdmin();
    identity.textContent = currentAdmin.user.email;
    identity.hidden = false;
    content.hidden = false;

    await loadCategories();
    await loadProducts();
  } catch (error) {
    if (shouldRedirectToAdminLogin(error)) {
      window.location.assign("login.html");
    } else {
      showStatus(error.message);
    }
  }
}

init();
