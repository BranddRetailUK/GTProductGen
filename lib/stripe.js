import Stripe from "stripe";

import { getServiceState, updateServiceState } from "./store.js";

const STRIPE_API_VERSION = "2026-02-25.clover";
const MAX_CHECKOUT_QUANTITY = 99;

function getSiteUrl() {
  const configured =
    String(process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  return configured || "http://localhost:3000";
}

export function getStripeClient() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secretKey) return null;
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION
  });
}

function normalizeQuantity(value) {
  const quantity = Math.floor(Number(value || 1));
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(Math.max(quantity, 1), MAX_CHECKOUT_QUANTITY);
}

function stripeImageUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : null;
}

async function buildTrustedCheckoutItems(items) {
  const state = await getServiceState();
  const requestedItems = Array.isArray(items) ? items : [];
  const trustedItems = [];

  for (const item of requestedItems) {
    const product = state.products.find(
      (entry) => String(entry.id) === String(item?.productId) && entry.status !== "draft"
    );
    if (!product) continue;

    const variant =
      (Array.isArray(product.variants)
        ? product.variants.find((entry) => String(entry.id) === String(item?.variantId))
        : null) || product.variants?.[0] || null;
    const priceGbp = Number(variant?.priceGbp || product.priceGbp || 0);
    if (!Number.isFinite(priceGbp) || priceGbp <= 0) continue;

    trustedItems.push({
      id: String(item?.id || `${product.id}:${variant?.id || "default"}`),
      productId: product.id,
      variantId: variant?.id || null,
      title: product.title,
      colourName: variant?.colourName || item?.colourName || null,
      sizeName: variant?.sizeName || item?.sizeName || null,
      quantity: normalizeQuantity(item?.quantity),
      priceGbp,
      imageUrl: variant?.imageUrl || product.heroImageUrl || null
    });
  }

  return trustedItems;
}

export async function createCheckoutSession({ items, email }) {
  const trustedItems = await buildTrustedCheckoutItems(items);
  if (!trustedItems.length) {
    throw new Error("cart_invalid");
  }

  const amountTotal = trustedItems.reduce((sum, item) => {
    return sum + Number(item?.priceGbp || 0) * Number(item?.quantity || 1);
  }, 0);

  const localRecord = {
    id: `checkout_${Date.now()}`,
    stripeSessionId: null,
    status: "pending",
    amountTotal,
    currency: "gbp",
    email: email || null,
    cartSnapshot: trustedItems,
    orderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const stripe = getStripeClient();
  if (!stripe) {
    const sessionId = `mock_checkout_${Date.now()}`;
    await updateServiceState((draft) => {
      draft.checkoutSessions.unshift({
        ...localRecord,
        stripeSessionId: sessionId
      });
    });
    return {
      id: sessionId,
      url: `${getSiteUrl()}/checkout/success?session_id=${encodeURIComponent(sessionId)}`
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${getSiteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getSiteUrl()}/checkout`,
    customer_email: email || undefined,
    allow_promotion_codes: String(process.env.STRIPE_ALLOW_PROMOTION_CODES || "true") !== "false",
    line_items: trustedItems.map((item) => ({
      quantity: Number(item?.quantity || 1),
      price_data: {
        currency: "gbp",
        unit_amount: Math.round(Number(item?.priceGbp || 0) * 100),
        product_data: {
          name: [item?.title, item?.colourName, item?.sizeName].filter(Boolean).join(" / "),
          images: stripeImageUrl(item?.imageUrl) ? [stripeImageUrl(item.imageUrl)] : []
        }
      }
    }))
  });

  await updateServiceState((draft) => {
    draft.checkoutSessions.unshift({
      ...localRecord,
      stripeSessionId: session.id
    });
  });

  return {
    id: session.id,
    url: session.url
  };
}

export async function recordCompletedCheckout({
  sessionId,
  email,
  amountTotal,
  lineItems,
  shippingAddress
}) {
  let createdOrder = null;

  await updateServiceState((draft) => {
    const checkout = draft.checkoutSessions.find((entry) => entry.stripeSessionId === sessionId);
    const trustedLineItems =
      Array.isArray(lineItems) && lineItems.length
        ? lineItems
        : Array.isArray(checkout?.cartSnapshot)
          ? checkout.cartSnapshot
          : [];
    const trustedAmountTotal =
      Number(amountTotal || 0) || Number(checkout?.amountTotal || 0) || trustedLineItems.reduce((sum, item) => {
        return sum + Number(item?.priceGbp || 0) * Number(item?.quantity || 1);
      }, 0);
    const existingOrder = draft.orders.find((order) => order.stripeSessionId === sessionId);
    if (existingOrder) {
      createdOrder = existingOrder;
      return;
    }

    const order = {
      id: `order_${Date.now()}`,
      stripeSessionId: sessionId,
      status: "paid",
      email: email || null,
      currency: "gbp",
      amountTotal: trustedAmountTotal,
      lineItems: trustedLineItems,
      shippingAddress: shippingAddress || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    draft.orders.unshift(order);
    if (checkout) {
      checkout.status = "completed";
      checkout.orderId = order.id;
      checkout.updatedAt = new Date().toISOString();
    }
    createdOrder = order;
  });

  return createdOrder;
}
