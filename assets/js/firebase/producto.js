import { addToCart } from "../cart.js";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const title = document.querySelector("#product-title"),
  description = document.querySelector("#product-description"),
  price = document.querySelector("#product-price"),
  image = document.querySelector("#product-image"),
  stock = document.querySelector("#product-stock"),
  addBtn = document.querySelector("#add-to-cart"),
  status = document.querySelector("#product-status");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

let currentProduct = null;

async function loadProduct() {
  if (!productId) {
    if (status) { status.textContent = "Producto no especificado."; status.hidden = false; }
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) throw new Error("Producto no encontrado.");
    const p = await res.json();
    currentProduct = p;

    if (title) title.textContent = p.name;
    if (description) description.textContent = p.description;
    if (price) price.textContent = money(p.price);
    if (image && p.image) image.src = p.image;
    if (stock) stock.textContent = `Stock disponible: ${p.stock}`;

    if (addBtn) {
      addBtn.disabled = p.stock <= 0 || !p.isActive;
      addBtn.onclick = () => {
        addToCart({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image,
          stock: p.stock
        });
        alert("Producto agregado al carrito.");
      };
    }
  } catch (err) {
    if (status) {
      status.textContent = err.message;
      status.hidden = false;
    }
  }
}

loadProduct();
