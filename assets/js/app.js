/**
 * Exclusive Shop - Modern UI Core & Toast System (21st.dev Standard)
 * Zero emojis, clean vector Lucide iconography, dynamic toasts, micro-interactions.
 */

document.documentElement.classList.add("js-ready");

// Dynamic Year Updater
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  // Re-initialize Lucide Icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Setup Toast Container
  setupToastContainer();

  // Scroll Animation Observer
  initScrollAnimations();
});

// Toast Container Setup
function setupToastContainer() {
  if (!document.getElementById("toast-container")) {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
}

/**
 * Toast Notification System (21st.dev Glass style)
 * @param {string} message - Message text
 * @param {'success'|'error'|'info'} type - Type of toast notification
 * @param {string} iconName - Optional Lucide icon name
 */
export function showToast(message, type = "success", iconName = null) {
  setupToastContainer();
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type} glass-card`;

  let defaultIcon = "check-circle-2";
  if (type === "error") defaultIcon = "alert-circle";
  if (type === "info") defaultIcon = "info";

  const activeIcon = iconName || defaultIcon;

  toast.innerHTML = `
    <div class="toast__icon">
      <i data-lucide="${activeIcon}"></i>
    </div>
    <div class="toast__content">
      <p class="toast__message">${message}</p>
    </div>
    <button type="button" class="toast__close" aria-label="Cerrar">
      <i data-lucide="x"></i>
    </button>
  `;

  const closeBtn = toast.querySelector(".toast__close");
  closeBtn.onclick = () => removeToast(toast);

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons({ props: { element: toast } });

  // Entrance transition
  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });

  // Auto dismiss after 3.5 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 3500);
}

function removeToast(toast) {
  if (!toast || toast.classList.contains("toast--hiding")) return;
  toast.classList.remove("toast--visible");
  toast.classList.add("toast--hiding");
  toast.addEventListener("transitionend", () => {
    toast.remove();
  });
}

/**
 * Smooth entrance animation trigger for .fade-up elements
 */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animated");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".fade-up, .card, .product-card").forEach((el) => {
    observer.observe(el);
  });
}

/**
 * Copy text to clipboard helper with Toast feedback
 */
export function copyToClipboard(text, successMsg = "Texto copiado al portapapeles") {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, "success", "copy");
    }).catch(() => {
      fallbackCopy(text, successMsg);
    });
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, "success", "copy");
  } catch (err) {
    showToast("No se pudo copiar", "error", "alert-triangle");
  }
  document.body.removeChild(textArea);
}

// Make functions globally accessible for non-module scripts
window.showToast = showToast;
window.copyToClipboard = copyToClipboard;

