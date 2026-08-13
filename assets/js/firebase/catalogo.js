import { addToCart, syncCartCount } from "../cart.js";

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
  allBtn.className = `filter-pill ${!selectedCategoryId ? "active" : ""}`;
  allBtn.innerHTML = `<i data-lucide="grid"></i> Todas las categorías`;
  allBtn.onclick = () => {
    selectedCategoryId = "";
    renderCategoryFilters();
    renderProducts();
  };
  categoryFiltersNode.append(allBtn);

  categories.filter((c) => c.isActive).forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-pill ${selectedCategoryId === c.id ? "active" : ""}`;
    btn.innerHTML = `<i data-lucide="tag"></i> ${c.name}`;
    btn.onclick = () => {
      selectedCategoryId = c.id;
      renderCategoryFilters();
      renderProducts();
    };
    categoryFiltersNode.append(btn);
  });

  if (window.lucide) window.lucide.createIcons();
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
    resultCountNode.textContent = `${filtered.length} producto(s) disponible(s)`;
    resultCountNode.hidden = false;
  }

  filtered.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card";

    // Image & Badge Container
    const imgContainer = document.createElement("div");
    imgContainer.className = "product-card__image-container";

    const linkImg = document.createElement("a");
    linkImg.href = `producto.html?id=${p.id}`;

    if (p.image) {
      const img = document.createElement("img");
      img.className = "product-card__image";
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      linkImg.append(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-card__image--placeholder";
      placeholder.innerHTML = `<i data-lucide="image"></i> Sin imagen`;
      linkImg.append(placeholder);
    }

    imgContainer.append(linkImg);

    if (p.salePrice && p.salePrice < p.regularPrice) {
      const discountPercent = Math.round(((p.regularPrice - p.salePrice) / p.regularPrice) * 100);
      const saleBadge = document.createElement("span");
      saleBadge.className = "product-card__badge product-card__badge--sale";
      saleBadge.innerHTML = `<i data-lucide="sparkles"></i> -${discountPercent}%`;
      imgContainer.append(saleBadge);
    }

    // Card Body
    const body = document.createElement("div");
    body.className = "product-card__body";

    const title = document.createElement("h3");
    title.className = "product-card__title";
    const titleLink = document.createElement("a");
    titleLink.href = `producto.html?id=${p.id}`;
    titleLink.textContent = p.name;
    title.append(titleLink);

    const desc = document.createElement("p");
    desc.className = "product-card__description";
    desc.textContent = p.description;

    // Price Row
    const priceRow = document.createElement("div");
    priceRow.className = "product-card__price-row";

    const regPrice = Number.isFinite(p.regularPrice) ? p.regularPrice : p.price;
    const salPrice = Number.isFinite(p.salePrice) && p.salePrice < regPrice ? p.salePrice : null;

    if (salPrice !== null) {
      const curPrice = document.createElement("span");
      curPrice.className = "product-card__price";
      curPrice.textContent = money(salPrice);

      const oldPrice = document.createElement("span");
      oldPrice.className = "product-card__regular-price";
      oldPrice.textContent = money(regPrice);

      priceRow.append(curPrice, oldPrice);
    } else {
      const curPrice = document.createElement("span");
      curPrice.className = "product-card__price";
      curPrice.textContent = money(regPrice);
      priceRow.append(curPrice);
    }

    // Card Actions
    const actions = document.createElement("div");
    actions.className = "product-card__actions";

    const addCartBtn = document.createElement("button");
    addCartBtn.type = "button";
    addCartBtn.className = "button button--small button--outline";
    addCartBtn.innerHTML = `<i data-lucide="shopping-bag"></i> Añadir`;
    addCartBtn.onclick = () => {
      addToCart(p);
    };

    const buyNowBtn = document.createElement("button");
    buyNowBtn.type = "button";
    buyNowBtn.className = "button button--small button--accent";
    buyNowBtn.innerHTML = `<i data-lucide="zap"></i> Comprar`;
    buyNowBtn.onclick = () => {
      addToCart(p);
      window.location.assign("checkout.html");
    };

    actions.append(addCartBtn, buyNowBtn);

    body.append(title, desc, priceRow, actions);
    card.append(imgContainer, body);
    grid.append(card);
  });

  if (window.lucide) window.lucide.createIcons();
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
    syncCartCount();
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = "Error al cargar el catálogo de productos.";
      statusNode.hidden = false;
    }
  }
}

search?.addEventListener("input", renderProducts);

loadData();
