const grid = document.querySelector("#catalog-products"),
  statusNode = document.querySelector("#catalog-status"),
  search = document.querySelector("#catalog-search"),
  categoryFiltersNode = document.querySelector("#category-filters"),
  resultCountNode = document.querySelector("#catalog-result-count");

let products = [], categories = [], selectedCategoryId = "";

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function renderCategoryFilters() {
  if (!categoryFiltersNode) return;
  categoryFiltersNode.replaceChildren();

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `filter ${!selectedCategoryId ? "filter--active" : ""}`;
  allBtn.textContent = "Todas las categorías";
  allBtn.onclick = () => {
    selectedCategoryId = "";
    renderCategoryFilters();
    renderProducts();
  };
  categoryFiltersNode.append(allBtn);

  categories.filter((c) => c.isActive).forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter ${selectedCategoryId === c.id ? "filter--active" : ""}`;
    btn.textContent = c.name;
    btn.onclick = () => {
      selectedCategoryId = c.id;
      renderCategoryFilters();
      renderProducts();
    };
    categoryFiltersNode.append(btn);
  });
}

function renderProducts() {
  if (!grid) return;
  grid.replaceChildren();

  const term = search?.value.trim().toLowerCase() || "";

  const filtered = products.filter((p) => {
    if (!p.isActive) return false;
    if (selectedCategoryId && p.categoryId !== selectedCategoryId) return false;
    if (term && !p.name.toLowerCase().includes(term) && !p.description.toLowerCase().includes(term)) return false;
    return true;
  });

  if (statusNode) {
    if (filtered.length === 0) {
      statusNode.textContent = "No hay productos disponibles en esta categoría.";
      statusNode.hidden = false;
      grid.hidden = true;
    } else {
      statusNode.hidden = true;
      grid.hidden = false;
    }
  }

  if (resultCountNode) {
    resultCountNode.textContent = `${filtered.length} producto(s) encontrado(s)`;
    resultCountNode.hidden = false;
  }

  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "card product-card";

    const link = document.createElement("a");
    link.href = `producto.html?id=${p.id}`;

    if (p.image) {
      const img = document.createElement("img");
      img.className = "product-card__image";
      img.src = p.image;
      img.alt = p.name;
      link.append(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-card__image product-card__image--placeholder";
      placeholder.textContent = "Sin imagen";
      link.append(placeholder);
    }

    const body = document.createElement("div");
    body.className = "product-card__body";

    const title = document.createElement("h3");
    title.className = "product-card__title";
    const titleLink = document.createElement("a");
    titleLink.href = `producto.html?id=${p.id}`;
    titleLink.textContent = p.name;
    title.append(titleLink);

    const price = document.createElement("p");
    price.className = "product-card__price";
    const regPrice = Number.isFinite(p.regularPrice) ? p.regularPrice : p.price;
    const salPrice = Number.isFinite(p.salePrice) && p.salePrice < regPrice ? p.salePrice : null;

    if (salPrice !== null) {
      price.innerHTML = `<s>${money(regPrice)}</s> <strong>${money(salPrice)}</strong>`;
    } else {
      price.textContent = money(regPrice);
    }

    body.append(title, price);
    card.append(link, body);
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

    renderCategoryFilters();
    renderProducts();
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = "Error al cargar el catálogo de productos.";
      statusNode.hidden = false;
    }
  }
}

search?.addEventListener("input", renderProducts);

loadData();
