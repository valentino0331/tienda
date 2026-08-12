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
    card.className = "card product-detail-card";
    card.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:2rem;padding:2rem;align-items:start;";

    const imgContainer = document.createElement("div");
    if (p.image) {
      const img = document.createElement("img");
      img.src = p.image;
      img.alt = p.name;
      img.style.cssText = "width:100%;max-height:400px;object-fit:cover;border-radius:8px;";
      imgContainer.append(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "product-card__image--placeholder";
      placeholder.style.cssText = "width:100%;height:300px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;color:#888;";
      placeholder.textContent = "Sin imagen";
      imgContainer.append(placeholder);
    }

    const info = document.createElement("div");

    const categoryBadge = document.createElement("p");
    categoryBadge.className = "eyebrow";
    categoryBadge.textContent = p.brand ? `${p.brand}` : "Exclusive Shop";

    const title = document.createElement("h1");
    title.textContent = p.name;

    const price = document.createElement("p");
    price.className = "product-card__price";
    price.style.fontSize = "1.5rem";
    price.style.margin = "1rem 0";
    price.textContent = money(p.price);

    const desc = document.createElement("p");
    desc.textContent = p.description;

    const stockInfo = document.createElement("p");
    stockInfo.className = "muted";
    stockInfo.style.marginTop = "1rem";
    stockInfo.textContent = p.stock > 0 ? `Stock disponible: ${p.stock}` : "Agotado";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "button button--full";
    addBtn.style.marginTop = "1.5rem";
    addBtn.textContent = p.stock > 0 ? "Agregar al carrito" : "Sin stock";
    addBtn.disabled = p.stock <= 0 || !p.isActive;

    addBtn.onclick = () => {
      addToCart({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        stock: p.stock
      });
      if (cartMsgNode) {
        cartMsgNode.textContent = `¡${p.name} fue agregado al carrito!`;
        cartMsgNode.hidden = false;
        cartMsgNode.className = "cart-message cart-message--success";
        setTimeout(() => { cartMsgNode.hidden = true; }, 3000);
      }
    };

    info.append(categoryBadge, title, price, desc, stockInfo, addBtn);
    card.append(imgContainer, info);
    detailNode.append(card);
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = err.message;
      statusNode.hidden = false;
    }
  }
}

loadProduct();
