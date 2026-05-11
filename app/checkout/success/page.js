import { formatDateTime, formatGbp } from "../../../lib/format.js";
import { getCheckoutConfirmation } from "../../../lib/catalog.js";

export default async function CheckoutSuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id || null;
  const order = sessionId ? await getCheckoutConfirmation(sessionId) : null;

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">Order Confirmation</p>
        <h1>Checkout complete</h1>
        <p>Your order has been stored inside the standalone product-gen service.</p>
      </div>

      {order ? (
        <div className="pg-order-card">
          <div className="pg-summary-row">
            <span>Reference</span>
            <strong>{order.id}</strong>
          </div>
          <div className="pg-summary-row">
            <span>Status</span>
            <strong>{order.status}</strong>
          </div>
          <div className="pg-summary-row">
            <span>Email</span>
            <strong>{order.email || "Not supplied"}</strong>
          </div>
          <div className="pg-summary-row">
            <span>Total</span>
            <strong>{formatGbp(order.amountTotal)}</strong>
          </div>
          <div className="pg-summary-row">
            <span>Created</span>
            <strong>{formatDateTime(order.createdAt)}</strong>
          </div>
        </div>
      ) : (
        <div className="pg-empty-state">
          <p>No confirmation record was found for this session.</p>
        </div>
      )}
    </div>
  );
}
