"use client";

import { useEffect, useMemo, useState } from "react";

import { CART_UPDATED_EVENT } from "../../lib/constants.js";
import { formatGbp } from "../../lib/format.js";
import { clearCart, loadStoredCartItems } from "../../lib/cart-client.js";

export default function CheckoutPage() {
  const [items, setItems] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => setItems(loadStoredCartItems());
    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CART_UPDATED_EVENT, sync);
  }, []);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.priceGbp || 0) * Number(item.quantity || 1), 0),
    [items]
  );

  async function handleCheckout() {
    if (!items.length) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/store/checkout/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          items
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "checkout_failed");
      }
      clearCart();
      window.location.href = payload.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Unable to create checkout session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">Checkout</p>
        <h1>Review and continue to Stripe</h1>
      </div>

      <div className="pg-cart-page-grid">
        <div className="pg-checkout-form">
          <label className="pg-selector-group">
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <div className="pg-checkout-lines">
            {items.map((item) => (
              <div key={item.id} className="pg-checkout-line">
                <span>
                  {item.title} ({item.colourName} / {item.sizeName}) x {item.quantity}
                </span>
                <strong>{formatGbp(Number(item.priceGbp || 0) * Number(item.quantity || 1))}</strong>
              </div>
            ))}
          </div>

          {error ? <p className="pg-error-copy">{error}</p> : null}
          <button type="button" className="pg-primary-button" disabled={loading || !items.length} onClick={handleCheckout}>
            {loading ? "CREATING SESSION..." : "PAY WITH STRIPE"}
          </button>
        </div>

        <aside className="pg-cart-summary">
          <div className="pg-summary-row">
            <span>Total</span>
            <strong>{formatGbp(total)}</strong>
          </div>
          <p className="pg-muted-copy">Hosted Stripe Checkout handles payment collection and returns to this service for confirmation.</p>
        </aside>
      </div>
    </div>
  );
}
