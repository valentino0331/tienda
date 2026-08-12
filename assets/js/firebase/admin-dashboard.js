import { requireAdmin, shouldRedirectToAdminLogin, getAuthHeaders, setToken } from "./admin-guard.js";

const content = document.querySelector("#admin-dashboard-content");
const identity = document.querySelector("#admin-identity");
const status = document.querySelector("#dashboard-status");
const periodSelect = document.querySelector("#dashboard-period");
const customDates = document.querySelector("#dashboard-custom-dates");
const values = Object.fromEntries(["sales-total", "gross-profit", "cost-total", "orders-count", "orders-detail", "customers-count", "new-customers-detail", "stock-total", "stock-detail", "pending-payments-count", "pending-payments-detail", "low-stock-count", "out-of-stock-detail"].map((id) => [id, document.querySelector(`#${id}`)]));
const orderSummaryNode = document.querySelector("#order-status-summary");
const paymentSummaryNode = document.querySelector("#payment-status-summary");
const logoutButton = document.querySelector("#admin-logout");

function money(value) {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
}

function showStatus(message) {
  if (status) {
    status.textContent = message;
    status.hidden = false;
  }
}

function renderSummary(container, rows) {
  if (!container) return;
  container.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = document.createElement("p");
    const name = document.createElement("span");
    const amount = document.createElement("strong");
    name.textContent = label;
    amount.textContent = value;
    row.append(name, amount);
    container.append(row);
  });
}

async function loadDashboardMetrics() {
  try {
    const res = await fetch('/api/admin/metrics', {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("No se pudieron cargar las métricas.");
    const data = await res.json();

    values["sales-total"].textContent = money(data.salesTotal || 0);
    values["gross-profit"].textContent = money(data.grossProfit || 0);
    values["cost-total"].textContent = money(data.costTotal || 0);
    values["orders-count"].textContent = data.ordersCount || 0;
    values["orders-detail"].textContent = `${data.orderStatusSummary?.pendiente || 0} pendiente(s) · ${data.orderStatusSummary?.completado || 0} completado(s)`;
    values["customers-count"].textContent = data.customersCount || 0;
    values["new-customers-detail"].textContent = `Clientes registrados`;
    values["stock-total"].textContent = data.stockTotal || 0;
    values["stock-detail"].textContent = `Stock total acumulado`;
    values["pending-payments-count"].textContent = data.pendingPaymentsCount || 0;
    values["pending-payments-detail"].textContent = `Pagos pendientes de confirmación`;
    values["low-stock-count"].textContent = data.lowStockCount || 0;
    values["out-of-stock-detail"].textContent = `Productos con stock bajo o agotado`;

    renderSummary(orderSummaryNode, [
      ["Pendientes", data.orderStatusSummary?.pendiente || 0],
      ["Completados", data.orderStatusSummary?.completado || 0],
      ["Cancelados", data.orderStatusSummary?.cancelado || 0]
    ]);

    renderSummary(paymentSummaryNode, [
      ["Pendientes", data.paymentStatusSummary?.pendiente || 0],
      ["Pagados", data.paymentStatusSummary?.pagado || 0],
      ["Rechazados", data.paymentStatusSummary?.rechazado || 0]
    ]);
  } catch (err) {
    showStatus(err.message);
  }
}

periodSelect?.addEventListener("change", () => {
  if (customDates) {
    customDates.hidden = periodSelect.value !== "custom";
  }
});

logoutButton?.addEventListener("click", () => {
  setToken(null);
  window.location.assign("login.html");
});

async function init() {
  try {
    const admin = await requireAdmin();
    if (identity) {
      identity.textContent = admin.user.email;
      identity.hidden = false;
    }
    if (content) content.hidden = false;
    await loadDashboardMetrics();
  } catch (error) {
    if (shouldRedirectToAdminLogin(error)) {
      window.location.assign("login.html");
    } else {
      showStatus(error.message);
    }
  }
}

init();
