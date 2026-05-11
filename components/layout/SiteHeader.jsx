"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CART_UPDATED_EVENT,
  SHOP_AUDIENCES,
  SHOP_PRODUCT_TYPES
} from "../../lib/constants.js";
import { loadStoredCartItems, requestCartDrawerOpen } from "../../lib/cart-client.js";
import { buildShopHref } from "../../lib/tags.js";
import AnimatedRouteLink from "./AnimatedRouteLink.jsx";

function countCart(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (sum, item) => sum + Math.max(1, Number(item?.quantity || 1)),
    0
  );
}

export default function SiteHeader() {
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedAudience, setExpandedAudience] = useState("Mens");
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const syncCart = () => setCartCount(countCart(loadStoredCartItems()));
    syncCart();
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    return () => window.removeEventListener(CART_UPDATED_EVENT, syncCart);
  }, []);

  const mobileMenu = useMemo(
    () =>
      SHOP_AUDIENCES.map((audience) => ({
        audience,
        items: SHOP_PRODUCT_TYPES.map((productType) => ({
          label: productType,
          href: buildShopHref(audience, productType)
        }))
      })),
    []
  );

  return (
    <header className="pg-header-wrap">
      <div className="pg-top-strip">
        <span>Standalone product generation storefront</span>
        <AnimatedRouteLink href="/new-in" className="pg-top-link">
          NEW IN
        </AnimatedRouteLink>
      </div>

      <div className="pg-header-shell">
        <div className="pg-header-brand">
          <AnimatedRouteLink href="/" className="pg-brand-link">
            GOOD GAME APPAREL
          </AnimatedRouteLink>
        </div>

        <nav className="pg-nav-desktop" aria-label="Primary navigation">
          <div
            className="pg-shop-nav"
            onMouseEnter={() => setShopOpen(true)}
            onMouseLeave={() => setShopOpen(false)}
          >
            <button
              type="button"
              className={`pg-nav-trigger${shopOpen ? " is-open" : ""}`}
              aria-expanded={shopOpen}
              onClick={() => setShopOpen((value) => !value)}
            >
              SHOP
            </button>

            {shopOpen ? (
              <div className="pg-shop-flyout">
                <div className="pg-shop-level pg-shop-audience">
                  {SHOP_AUDIENCES.map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      className={`pg-shop-audience-button${
                        expandedAudience === audience ? " is-active" : ""
                      }`}
                      onMouseEnter={() => setExpandedAudience(audience)}
                      onClick={() => setExpandedAudience(audience)}
                    >
                      {audience}
                    </button>
                  ))}
                </div>
                <div className="pg-shop-level pg-shop-product-types">
                  {SHOP_PRODUCT_TYPES.map((productType) => (
                    <AnimatedRouteLink
                      key={`${expandedAudience}-${productType}`}
                      href={buildShopHref(expandedAudience, productType)}
                      className="pg-shop-leaf-link"
                    >
                      <span>{productType}</span>
                      <small>{expandedAudience}</small>
                    </AnimatedRouteLink>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <AnimatedRouteLink href="/new-in" className="pg-nav-link">
            NEW IN
          </AnimatedRouteLink>
          <AnimatedRouteLink href="/admin/templates" className="pg-nav-link">
            ADMIN
          </AnimatedRouteLink>
        </nav>

        <div className="pg-header-actions">
          <button
            type="button"
            className="pg-cart-button"
            onClick={() => requestCartDrawerOpen()}
            aria-label={`Open cart with ${cartCount} items`}
          >
            CART
            <span className="pg-cart-count">{cartCount}</span>
          </button>
          <button
            type="button"
            className={`pg-mobile-toggle${mobileOpen ? " is-open" : ""}`}
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
          >
            MENU
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="pg-mobile-nav">
          <div className="pg-mobile-links">
            <AnimatedRouteLink href="/new-in" className="pg-mobile-link" onClick={() => setMobileOpen(false)}>
              NEW IN
            </AnimatedRouteLink>
            <AnimatedRouteLink href="/admin/templates" className="pg-mobile-link" onClick={() => setMobileOpen(false)}>
              ADMIN
            </AnimatedRouteLink>
          </div>
          {mobileMenu.map((group) => (
            <div key={group.audience} className="pg-mobile-group">
              <div className="pg-mobile-group-title">{group.audience}</div>
              <div className="pg-mobile-group-links">
                {group.items.map((item) => (
                  <AnimatedRouteLink
                    key={item.href}
                    href={item.href}
                    className="pg-mobile-leaf"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </AnimatedRouteLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
