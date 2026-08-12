const grid = document.querySelector("#catalog-grid"),
  empty = document.querySelector("#catalog-empty"),
  search = document.querySelector("#catalog-search"),
  category = document.querySelector("#catalog-category"),
  status = document.querySelector("#catalog-status");

let products = [], categories = [];

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function renderCategoryOptions() {
  if (!category) return;
  category.replaceChildren(new Option("Todas las categorías", ""));
  categories.filter((c) => c.isActive).forEach((c) => {
    category.add(new Option(c.name, c.id));
  });
}

function renderProducts() {
  if (!grid) return;
  grid.replaceChildren();

  const term = search?.value.trim().toLowerCase() || "";
  const catId = category?.value || "";

  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (p.stock <= 0) return false;
    if (catId && p.categoryId !== catId) return false;
    if (term && !p.name.toLowerCase().includes(term) && !p.description.toLowerCase().includes(term)) return false;
    return true;
  });

  if (empty) empty.hidden = filtered.length > 0;

  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "card product-card";

    const img = document.createElement("img");
    img.className = "product-card__image";
    img.src = p.image || "assets/images/placeholder.webp";
    img.alt = p.name;

    const body = document.createElement("div");
    body.className = "product-card__body";

    const title = document.createElement("h3");
    title.className = "product-card__title";
    const link = document.createElement("a");
    link.href = `producto.html?id=${p.id}`;
    link.textContent = p.name;
    title.append(link);

    const price = document.createElement("p");
    price.className = "product-card__price";
    price.textContent = money(p.price);

    body.append(title, price);
    card.append(img, body);
    grid.append(card);
  });
}

async function loadData() {
  try {
    const [resCat, resProd] = await Promise.all([
      fetch('/api/categories'),
      fetch('/api/products')
    ]);

    if (resCat.ok) categories = await resCat.json();
    if (resProd.ok) products = await resProd.json();

    renderCategoryOptions();
    renderProducts();
  } catch (err) {
    if (status) {
      status.textContent = "Error al cargar catálogo.";
      status.hidden = false;
    }
  }
}

search?.addEventListener("input", renderProducts);
category?.addEventListener("change", renderProducts);

loadData();
