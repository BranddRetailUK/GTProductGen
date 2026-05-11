"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CART_DRAWER_OPEN_EVENT,
  CART_UPDATED_EVENT
} from "../../lib/constants.js";
import { formatGbp } from "../../lib/format.js";
import {
  loadStoredCartItems,
  removeCartItem,
  updateCartQuantity
} from "../../lib/cart-client.js";
import AnimatedRouteLink from "./AnimatedRouteLink.jsx";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const sync = () => setItems(loadStoredCartItems());
    const openDrawer = () => {
      sync();
      setOpen(true);
    };

    sync();
    window.addEventListener(CART_UPDATED_EVENT, sync);
    window.addEventListener(CART_DRAWER_OPEN_EVENT, openDrawer);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, sync);
      window.removeEventListener(CART_DRAWER_OPEN_EVENT, openDrawer);
    };
  }, []);

  const total = useMemo(
    () =>
      items.reduce((sum, item) => sum + Number(item.priceGbp || 0) * Number(item.quantity || 1), 0),
    [items]
  );

  return (
    <div className={`pg-cart-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
      <button
        type="button"
        className={`pg-cart-backdrop${open ? " is-open" : ""}`}
        aria-label="Close cart"
        onClick={() => setOpen(false)}
      />
      <aside className="pg-cart-panel">
        <div className="pg-cart-head">
          <div>
            <p className="pg-kicker">Cart</p>
            <h2>Your basket</h2>
          </div>
          <button type="button" className="pg-cart-close" onClick={() => setOpen(false)}>
            CLOSE
          </button>
        </div>

        <div className="pg-cart-body">
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className="pg-cart-item">
                <div className="pg-cart-thumb">
                  <img src={item.imageUrl || "/mock/placeholder-tee.svg"} alt={item.title} />
                </div>
                <div className="pg-cart-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {item.colourName} / {item.sizeName}
                  </span>
                  <span>{formatGbp(item.priceGbp)}</span>
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
                    <button
                      type="button"
                      className="pg-inline-button"
                      onClick={() => setItems(removeCartItem(item.id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="pg-empty-state">
              <p>Your cart is empty.</p>
            </div>
          )}
        </div>

        <div className="pg-cart-footer">
          <div className="pg-cart-total">
            <span>Total</span>
            <strong>{formatGbp(total)}</strong>
          </div>
          <AnimatedRouteLink href="/cart" className="pg-outline-button" onClick={() => setOpen(false)}>
            VIEW CART
          </AnimatedRouteLink>
          <AnimatedRouteLink href="/checkout" className="pg-primary-button" onClick={() => setOpen(false)}>
            CHECKOUT
          </AnimatedRouteLink>
        </div>
      </aside>
    </div>
  );
}
