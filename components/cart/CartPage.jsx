"use client";

import { useEffect, useMemo, useState } from "react";

import { CART_UPDATED_EVENT } from "../../lib/constants.js";
import { formatGbp } from "../../lib/format.js";
import {
  loadStoredCartItems,
  removeCartItem,
  updateCartQuantity
} from "../../lib/cart-client.js";
import AnimatedRouteLink from "../layout/AnimatedRouteLink.jsx";

export default function CartPage() {
  const [items, setItems] = useState([]);

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

  return (
    <div className="pg-page-shell">
      <div className="pg-page-head">
        <p className="pg-kicker">Cart</p>
        <h1>Review your order</h1>
      </div>

      {items.length ? (
        <div className="pg-cart-page-grid">
          <div className="pg-cart-list">
            {items.map((item) => (
              <div key={item.id} className="pg-cart-item pg-cart-item-page">
                <div className="pg-cart-thumb">
                  <img src={item.imageUrl || "/mock/placeholder-tee.svg"} alt={item.title} />
                </div>
                <div className="pg-cart-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {item.colourName} / {item.sizeName}
                  </span>
                  <div className="pg-cart-row">
                    <select
                      value={item.quantity}
                      onChange={(event) => setItems(updateCartQuantity(item.id, Number(event.target.value)))}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          Qty {value}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="pg-inline-button" onClick={() => setItems(removeCartItem(item.id))}>
                      Remove
                    </button>
                  </div>
                </div>
                <strong>{formatGbp(Number(item.priceGbp || 0) * Number(item.quantity || 1))}</strong>
              </div>
            ))}
          </div>
          <aside className="pg-cart-summary">
            <div className="pg-summary-row">
              <span>Subtotal</span>
              <strong>{formatGbp(total)}</strong>
            </div>
            <AnimatedRouteLink href="/checkout" className="pg-primary-button">
              CONTINUE TO CHECKOUT
            </AnimatedRouteLink>
          </aside>
        </div>
      ) : (
        <div className="pg-empty-state">
          <p>Your cart is empty.</p>
          <AnimatedRouteLink href="/new-in" className="pg-outline-button">
            SHOP NEW IN
          </AnimatedRouteLink>
        </div>
      )}
    </div>
  );
}
