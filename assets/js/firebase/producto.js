import { addToCart } from "../cart.js";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const statusNode = document.querySelector("#product-status"),
  detailNode = document.querySelector("#product-detail"),
  cartMsgNode = document.querySelector("#product-cart-message");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

async function loadProduct() {
  if (!productId) {
    if (statusNode) {
      statusNode.textContent = "Producto no especificado.";
      statusNode.hidden = false;
    }
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) throw new Error("Producto no encontrado.");
    const p = await res.json();

    if (statusNode) statusNode.hidden = true;
    if (!detailNode) return;

    detailNode.replaceChildren();
    detailNode.hidden = false;

    const card = document.createElement("article");
    card.className = "card glass-card product-detail-card fade-up";
    card.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:2.5rem;padding:2.5rem;align-items:start;";

    const imgContainer = document.createElement("div");
    imgContainer.style.cssText = "position:relative;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.1);";
    if (p.image) {
      const img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.style.cssText = "width:100%;max-height:460px;object-fit:cover;border-radius:18px;display:block;";
      imgContainer.append(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-card__image--placeholder";
      placeholder.style.cssText = "width:100%;height:350px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;border-radius:18px;color:#64748b;";
      placeholder.innerHTML = `<i data-lucide="image" style="width:32px;height:32px;"></i>`;
      imgContainer.append(placeholder);
    }

    const info = document.createElement("div");

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "yape-badge";
    categoryBadge.style.cssText = "background:var(--color-accent-gradient);display:inline-flex;align-items:center;gap:0.4rem;margin-bottom:0.75rem;";
    categoryBadge.innerHTML = `<i data-lucide="award"></i> ${p.brand ? p.brand : "Exclusive Shop"}`;

    const title = document.createElement("h1");
    title.style.cssText = "font-size:2.2rem;line-height:1.2;margin-bottom:0.75rem;";
    title.textContent = p.name;

    const priceRow = document.createElement("div");
    priceRow.style.cssText = "display:flex;align-items:center;gap:1rem;margin:1rem 0;";
    
    const price = document.createElement("span");
    price.className = "product-card__price";
    price.style.fontSize = "2rem";
    price.textContent = money(p.price);
    priceRow.append(price);

    if (p.regularPrice && p.regularPrice > p.price) {
      const regPrice = document.createElement("span");
      regPrice.className = "product-card__regular-price";
      regPrice.style.fontSize = "1.3rem";
      regPrice.textContent = money(p.regularPrice);
      priceRow.append(regPrice);
    }

    const desc = document.createElement("p");
    desc.style.cssText = "color:var(--color-muted);font-size:1.05rem;line-height:1.6;margin-bottom:1.5rem;";
    desc.textContent = p.description;

    const trustBadges = document.createElement("div");
    trustBadges.style.cssText = "display:flex;flex-direction:column;gap:0.6rem;padding:1rem;background:rgba(241,245,249,0.7);border-radius:12px;margin-bottom:1.5rem;font-size:0.88rem;";
    trustBadges.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;"><i data-lucide="truck" style="color:var(--color-accent);"></i> Envío rápido a todo el Perú</div>
      <div style="display:flex;align-items:center;gap:0.5rem;"><i data-lucide="shield-check" style="color:var(--color-success);"></i> Producto 100% Genuino con Garantía</div>
    `;

    const stockInfo = document.createElement("p");
    stockInfo.style.cssText = "font-weight:600;display:flex;align-items:center;gap:0.4rem;margin-bottom:1.25rem;";
    stockInfo.innerHTML = p.stock > 0 
      ? `<span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span> Stock disponible: ${p.stock}`
      : `<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span> Agotado`;

    const actionsRow = document.createElement("div");
    actionsRow.style.cssText = "display:flex;gap:1rem;flex-wrap:wrap;";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "button button--accent shimmer-btn";
    addBtn.style.cssText = "flex:1;min-width:180px;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;";
    addBtn.innerHTML = `<i data-lucide="shopping-bag"></i> ${p.stock > 0 ? "Agregar al Carrito" : "Agotado"}`;
    addBtn.disabled = p.stock <= 0 || !p.isActive;

    addBtn.onclick = () => {
      addToCart({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        stock: p.stock
      });
    };

    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "button button--primary";
    buyBtn.style.cssText = "flex:1;min-width:180px;display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;";
    buyBtn.innerHTML = `<i data-lucide="zap"></i> Comprar Ahora`;
    buyBtn.disabled = p.stock <= 0 || !p.isActive;

    buyBtn.onclick = () => {
      addToCart({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        stock: p.stock
      });
      window.location.assign("checkout.html");
    };

    actionsRow.append(addBtn, buyBtn);
    info.append(categoryBadge, title, priceRow, desc, trustBadges, stockInfo, actionsRow);
    card.append(imgContainer, info);
    detailNode.append(card);

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = err.message;
      statusNode.hidden = false;
    }
  }
}

loadProduct();
