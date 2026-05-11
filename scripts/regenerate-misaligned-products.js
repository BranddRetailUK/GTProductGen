import "dotenv/config";

import crypto from "node:crypto";

import {
  ITEM_STATUS_QUEUED,
  RUN_STATUS_QUEUED
} from "../lib/constants.js";
import { getPool } from "../lib/db.js";
import { processGenerationRun } from "../lib/generation.js";
import { buildShopifyPublishPlan } from "../lib/shopify.js";
import { getServiceState, updateServiceState } from "../lib/store.js";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function needsRegeneration(product, template) {
  if (!product || !template) return { stale: false, reason: "missing_product_or_template" };

  const templateVariants = Array.isArray(template.variants) ? template.variants : [];
  const productVariants = Array.isArray(product.variants) ? product.variants : [];
  if (templateVariants.length && productVariants.length !== templateVariants.length) {
    return {
      stale: true,
      reason: `variant_count:${productVariants.length}/${templateVariants.length}`
    };
  }

  if (templateVariants.length && productVariants.some((variant) => !variant.templateVariantId)) {
    return {
      stale: true,
      reason: "missing_template_variant_links"
    };
  }

  try {
    buildShopifyPublishPlan({ product, template });
  } catch (error) {
    return {
      stale: true,
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  return { stale: false, reason: "aligned" };
}

function buildRun(pairs) {
  const now = new Date().toISOString();
  return {
    id: `run_regen_${Date.now()}`,
    mode: "regenerate_misaligned",
    status: RUN_STATUS_QUEUED,
    forceRerun: true,
    templateIds: Array.from(new Set(pairs.map((pair) => pair.templateId))),
    designIds: Array.from(new Set(pairs.map((pair) => pair.designId))),
    queuedCount: pairs.length,
    completedCount: 0,
    failedCount: 0,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
    items: pairs.map((pair) => ({
      id: `run_item_${crypto.randomUUID()}`,
      templateId: pair.templateId,
      designId: pair.designId,
      status: ITEM_STATUS_QUEUED,
      productId: pair.productId,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    }))
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const state = await getServiceState();
  const templatesById = new Map((state.templates || []).map((template) => [String(template.id), template]));
  const designsById = new Map((state.designs || []).map((design) => [String(design.id), design]));
  const staleProducts = [];
  const skippedProducts = [];

  for (const product of state.products || []) {
    const template = templatesById.get(String(product.templateProductId));
    const check = needsRegeneration(product, template);
    if (!check.stale) continue;
    if (!template) {
      skippedProducts.push({
        productId: product.id,
        title: product.title,
        templateId: product.templateProductId || null,
        designId: product.designAssetId || null,
        reason: "missing_template"
      });
      continue;
    }
    if (!product.designAssetId || !designsById.has(String(product.designAssetId))) {
      skippedProducts.push({
        productId: product.id,
        title: product.title,
        templateId: product.templateProductId || null,
        designId: product.designAssetId || null,
        reason: "missing_design_asset"
      });
      continue;
    }
    staleProducts.push({
      productId: product.id,
      title: product.title,
      templateId: product.templateProductId,
      designId: product.designAssetId,
      reason: check.reason,
      shopifyProductId: product.shopify?.productId || null
    });
  }

  const uniquePairs = [];
  const seenPairs = new Set();
  for (const staleProduct of staleProducts) {
    const key = `${staleProduct.templateId}:${staleProduct.designId}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    uniquePairs.push(staleProduct);
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          staleProducts: staleProducts.length,
          skippedProducts: skippedProducts.length,
          uniqueRegenerationPairs: uniquePairs.length,
          products: staleProducts,
          skipped: skippedProducts
        },
        null,
        2
      )
    );
    return;
  }

  if (!uniquePairs.length) {
    console.log(JSON.stringify({ dryRun: false, staleProducts: 0, skippedProducts: skippedProducts.length, runId: null, skipped: skippedProducts }, null, 2));
    return;
  }

  const run = buildRun(uniquePairs);
  await updateServiceState((draft) => {
    draft.runs = Array.isArray(draft.runs) ? draft.runs : [];
    draft.runs.unshift(run);
  });

  await processGenerationRun(run.id);
  const nextState = await getServiceState();
  const finishedRun = (nextState.runs || []).find((entry) => entry.id === run.id);

  console.log(
    JSON.stringify(
      {
        dryRun: false,
        runId: run.id,
        staleProducts: staleProducts.length,
        skippedProducts: skippedProducts.length,
        queuedPairs: uniquePairs.length,
        completedCount: finishedRun?.completedCount || 0,
        failedCount: finishedRun?.failedCount || 0,
        status: finishedRun?.status || null,
        products: staleProducts.map((product) => ({
          productId: product.productId,
          title: product.title,
          templateId: product.templateId,
          designId: product.designId,
          reason: product.reason,
          shopifyProductId: clean(product.shopifyProductId) || null
        })),
        skipped: skippedProducts
      },
      null,
      2
    )
  );
}

try {
  await main();
} finally {
  await getPool()?.end();
}
