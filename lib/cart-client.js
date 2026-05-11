import {
  CART_DRAWER_OPEN_EVENT,
  CART_STORAGE_KEY,
  CART_UPDATED_EVENT
} from "./constants.js";

export function loadStoredCartItems() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCartItems(items) {
  if (typeof window === "undefined") return [];
  const normalized = Array.isArray(items) ? items : [];
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: normalized }));
  return normalized;
}

export function addCartItem(item) {
  const current = loadStoredCartItems();
  const existing = current.find(
    (entry) =>
      entry.productId === item.productId &&
      entry.variantId === item.variantId &&
      entry.colourName === item.colourName &&
      entry.sizeName === item.sizeName
  );

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) + Number(item.quantity || 1);
    return saveStoredCartItems(current);
  }

  return saveStoredCartItems([
    ...current,
    {
      ...item,
      quantity: Number(item.quantity || 1)
    }
  ]);
}

export function removeCartItem(itemId) {
  return saveStoredCartItems(loadStoredCartItems().filter((entry) => entry.id !== itemId));
}

export function updateCartQuantity(itemId, quantity) {
  const nextQuantity = Math.max(1, Number(quantity || 1));
  return saveStoredCartItems(
    loadStoredCartItems().map((entry) =>
      entry.id === itemId ? { ...entry, quantity: nextQuantity } : entry
    )
  );
}

export function clearCart() {
  return saveStoredCartItems([]);
}

export function requestCartDrawerOpen() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_DRAWER_OPEN_EVENT));
}
