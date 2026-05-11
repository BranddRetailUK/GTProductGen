import crypto from "node:crypto";

import {
  ITEM_STATUS_QUEUED,
  RUN_MODE_BULK,
  RUN_MODE_SINGLE,
  RUN_STATUS_QUEUED
} from "./constants.js";
import { matchesShopFilters, titleFromShopSegment } from "./tags.js";
import { updateServiceState, getServiceState } from "./store.js";
import { rescanDesignAssets } from "./dropbox.js";

function clone(value) {
  return structuredClone(value);
}

function sortNewest(items) {
  return items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getHomePayload() {
  const state = await getServiceState();
  return {
    collections: sortCollections(state.shopCollections).filter((entry) => entry.homepageVisible),
    products: sortNewest(state.products).slice(0, 12)
  };
}

export function sortCollections(collections) {
  return (Array.isArray(collections) ? collections : [])
    .slice()
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export async function getStoreCollections() {
  const state = await getServiceState();
  return sortCollections(state.shopCollections);
}

export async function getStoreProducts(filters = {}) {
  const state = await getServiceState();
  let products = sortNewest(state.products).filter((entry) => entry.status !== "draft");

  if (filters.audience || filters.productType) {
    products = products.filter((product) =>
      matchesShopFilters(product, filters.audience, filters.productType)
    );
  }

  if (filters.handle) {
    return products.find((product) => product.handle === filters.handle) || null;
  }

  return products;
}

export async function getStoreProductByHandle(handle) {
  return getStoreProducts({ handle });
}

export async function getNewInProducts() {
  return getStoreProducts();
}

export async function getShopListingFromSegments(audienceSegment, productTypeSegment) {
  const audience =
    audienceSegment && audienceSegment !== "all" ? titleFromShopSegment(audienceSegment) : null;
  const productType = productTypeSegment ? titleFromShopSegment(productTypeSegment) : null;

  return {
    audience,
    productType,
    products: await getStoreProducts({
      audience,
      productType
    })
  };
}

export async function listTemplates() {
  const state = await getServiceState();
  return clone(state.templates);
}

export async function getTemplate(templateId) {
  const state = await getServiceState();
  return clone(state.templates.find((entry) => String(entry.id) === String(templateId)) || null);
}

export async function updateTemplate(templateId, patch) {
  let updated = null;
  await updateServiceState((draft) => {
    const template = draft.templates.find((entry) => String(entry.id) === String(templateId));
    if (!template) return;
    Object.assign(template, {
      ...patch,
      updatedAt: new Date().toISOString()
    });
    updated = clone(template);
  });
  return updated;
}

export async function listDesignAssets() {
  const state = await getServiceState();
  return sortNewest(state.designs);
}

export async function rescanDesignLibrary() {
  return rescanDesignAssets();
}

export async function listRuns() {
  const state = await getServiceState();
  return sortNewest(state.runs);
}

export async function getRun(runId) {
  const state = await getServiceState();
  return clone(state.runs.find((entry) => entry.id === runId) || null);
}

export async function createRun({ mode, designIds, templateIds, forceRerun = false }) {
  const state = await getServiceState();
  const selectedTemplates = state.templates.filter((entry) =>
    (Array.isArray(templateIds) ? templateIds : []).some((id) => String(id) === String(entry.id))
  );
  const selectedDesigns =
    mode === RUN_MODE_SINGLE
      ? state.designs.filter((entry) =>
          (Array.isArray(designIds) ? designIds : []).some((id) => String(id) === String(entry.id))
        )
      : state.designs.slice();

  const orderedPairs = [];
  for (const template of selectedTemplates) {
    for (const design of selectedDesigns) {
      orderedPairs.push({ templateId: template.id, designId: design.id });
    }
  }

  const run = {
    id: `run_${Date.now()}`,
    mode: mode === RUN_MODE_SINGLE ? RUN_MODE_SINGLE : RUN_MODE_BULK,
    status: RUN_STATUS_QUEUED,
    forceRerun: Boolean(forceRerun),
    templateIds: selectedTemplates.map((entry) => entry.id),
    designIds: selectedDesigns.map((entry) => entry.id),
    queuedCount: orderedPairs.length,
    completedCount: 0,
    failedCount: 0,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    updatedAt: new Date().toISOString(),
    items: orderedPairs.map((pair) => ({
      id: `run_item_${crypto.randomUUID()}`,
      templateId: pair.templateId,
      designId: pair.designId,
      status: ITEM_STATUS_QUEUED,
      productId: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
  };

  await updateServiceState((draft) => {
    draft.runs.unshift(run);
  });

  return run;
}

export async function listAdminProducts() {
  const state = await getServiceState();
  return sortNewest(state.products);
}

export async function updateAdminProduct(productId, patch) {
  let updated = null;
  await updateServiceState((draft) => {
    const product = draft.products.find((entry) => String(entry.id) === String(productId));
    if (!product) return;
    Object.assign(product, {
      ...patch,
      updatedAt: new Date().toISOString()
    });
    updated = clone(product);
  });
  return updated;
}

export async function listShopCollections() {
  const state = await getServiceState();
  return sortCollections(state.shopCollections);
}

export async function updateShopCollection(collectionId, patch) {
  let updated = null;
  await updateServiceState((draft) => {
    const collection = draft.shopCollections.find((entry) => String(entry.id) === String(collectionId));
    if (!collection) return;
    Object.assign(collection, {
      ...patch
    });
    updated = clone(collection);
  });
  return updated;
}

export async function getCheckoutConfirmation(sessionId) {
  const state = await getServiceState();
  const order = state.orders.find((entry) => entry.stripeSessionId === sessionId);
  if (order) return clone(order);

  const checkout = state.checkoutSessions.find((entry) => entry.stripeSessionId === sessionId);
  if (!checkout) return null;

  return {
    id: checkout.orderId || checkout.id,
    stripeSessionId: checkout.stripeSessionId,
    status: checkout.status,
    email: checkout.email,
    currency: checkout.currency,
    amountTotal: checkout.amountTotal,
    lineItems: checkout.cartSnapshot,
    shippingAddress: {},
    createdAt: checkout.createdAt,
    updatedAt: checkout.updatedAt
  };
}
