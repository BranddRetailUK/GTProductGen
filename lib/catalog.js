import crypto from "node:crypto";

import {
  ITEM_STATUS_QUEUED,
  RUN_MODE_BULK,
  RUN_MODE_SINGLE,
  RUN_STATUS_QUEUED
} from "./constants.js";
import { updateServiceState, getServiceState } from "./store.js";
import { rescanDesignAssets } from "./dropbox.js";
import { publishProductToShopify } from "./shopify.js";

function clone(value) {
  return structuredClone(value);
}

function sortNewest(items) {
  return items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listTemplates({ includeHidden = false } = {}) {
  const state = await getServiceState();
  const templates = includeHidden ? state.templates : state.templates.filter((entry) => !entry.hidden);
  return clone(templates);
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

export async function createRun({ mode, designIds, templateIds }) {
  const state = await getServiceState();
  const selectedTemplates = state.templates.filter((entry) =>
    !entry.hidden &&
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

export async function publishAdminProduct(productId) {
  return publishProductToShopify(productId);
}
