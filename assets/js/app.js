/**
 * Punto de entrada para las futuras interacciones de Exclusive Shop.
 * Integraciones, catálogo y cálculos de precios se añadirán por módulos.
 */

document.documentElement.classList.add("js-ready");

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = new Date().getFullYear();
});
