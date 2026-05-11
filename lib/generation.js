import crypto from "node:crypto";

import {
  ITEM_STATUS_COMPLETED,
  ITEM_STATUS_FAILED,
  ITEM_STATUS_QUEUED,
  ITEM_STATUS_RUNNING,
  RUN_STATUS_COMPLETED,
  RUN_STATUS_FAILED,
  RUN_STATUS_RUNNING
} from "./constants.js";
import { renderAllProductImages } from "./render/engine.js";
import { updateServiceState, getServiceState } from "./store.js";
import { buildCatalogTags } from "./tags.js";
import { buildProductHandle } from "./slugs.js";
import { writeServiceLog } from "./service-log.js";

function buildVariantSku(template, design, colour, size) {
  return crypto
    .createHash("sha1")
    .update(`${template.id}:${design.id}:${colour}:${size}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function findOptionName(template, candidates) {
  const normalizedCandidates = candidates.map(normalizeToken);
  return (Array.isArray(template?.options) ? template.options : []).find((option) =>
    normalizedCandidates.includes(normalizeToken(option?.name))
  )?.name || null;
}

function getVariantOptionValue(variant, optionName) {
  if (!optionName || !variant?.options || typeof variant.options !== "object") return null;
  const normalizedOptionName = normalizeToken(optionName);
  const key = Object.keys(variant.options).find((entry) => normalizeToken(entry) === normalizedOptionName);
  return key ? clean(variant.options[key]) : null;
}

function buildImageByColour(images) {
  return new Map(
    (Array.isArray(images) ? images : [])
      .filter((image) => image?.colourName && image?.imageUrl)
      .map((image) => [normalizeToken(image.colourName), image.imageUrl])
  );
}

function buildGeneratedVariantsFromTemplate(template, design, images, fallbackImageUrl, priceGbp) {
  const templateVariants = Array.isArray(template?.variants) ? template.variants : [];
  if (!templateVariants.length) return [];

  const colourOptionName = findOptionName(template, ["Colour", "Color"]);
  const sizeOptionName = findOptionName(template, ["Size"]);
  const imageByColour = buildImageByColour(images);

  return templateVariants.map((templateVariant) => {
    const colourName = getVariantOptionValue(templateVariant, colourOptionName);
    const sizeName = getVariantOptionValue(templateVariant, sizeOptionName);
    const imageUrl = colourName ? imageByColour.get(normalizeToken(colourName)) || fallbackImageUrl : fallbackImageUrl;
    const variantKey = templateVariant.id || templateVariant.sourceId || templateVariant.sku || JSON.stringify(templateVariant.options);

    return {
      id: `variant_${buildVariantSku(template, design, variantKey, templateVariant.sku || "")}`,
      templateVariantId: templateVariant.id || null,
      templateVariantSourceId: templateVariant.sourceId || null,
      colourName,
      sizeName,
      options: templateVariant.options || {},
      sku: templateVariant.sku || buildVariantSku(template, design, colourName || "default", sizeName || "one-size"),
      priceGbp: Number(templateVariant.price ?? priceGbp),
      costPrice: templateVariant.costPrice ?? null,
      weightGrams: templateVariant.weightGrams ?? null,
      inventoryItemId: templateVariant.inventoryItemId || null,
      imageUrl
    };
  });
}

function buildGeneratedProduct(template, design, images) {
  const handle = buildProductHandle(design.displayName, template.title);
  const tags = buildCatalogTags(template);
  const priceGbp = Number(template?.priceConfig?.defaultPriceGbp || template?.variants?.[0]?.price || 24.99);
  const colours = Array.isArray(template?.colours) && template.colours.length ? template.colours : ["Default"];
  const sizes = Array.isArray(template?.sizes) && template.sizes.length ? template.sizes : ["One Size"];
  const primaryImage = images[0]?.imageUrl || null;
  const variants = buildGeneratedVariantsFromTemplate(template, design, images, primaryImage, priceGbp);

  if (!variants.length) {
    for (const colour of colours) {
      for (const size of sizes) {
        variants.push({
          id: `variant_${buildVariantSku(template, design, colour, size)}`,
          colourName: colour,
          sizeName: size,
          options: {
            Colour: colour,
            Size: size
          },
          sku: buildVariantSku(template, design, colour, size),
          priceGbp,
          imageUrl: primaryImage
        });
      }
    }
  }

  return {
    id: `product_${crypto.createHash("sha1").update(handle).digest("hex").slice(0, 12)}`,
    handle,
    title: `${design.displayName} | ${template.title}`,
    description: `${design.displayName} generated from ${template.title} via the standalone product-gen pipeline.`,
    templateProductId: template.id,
    designAssetId: design.id,
    tags,
    priceGbp,
    status: "published",
    heroImageUrl: primaryImage,
    variants,
    images,
    artworkState: {
      designAssetId: design.id,
      artworkBox: template?.printAreas?.[0] || null,
      sourceFileUrl: design?.sourceUrl || null,
      artworkFileId: design.id,
      artworkFileUrl: design?.sourceUrl || null
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function processGenerationRun(runId) {
  const state = await getServiceState();
  const run = state.runs.find((entry) => entry.id === runId);
  if (!run) return null;

  await updateServiceState((draft) => {
    const target = draft.runs.find((entry) => entry.id === runId);
    if (!target) return;
    target.status = RUN_STATUS_RUNNING;
    target.startedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    for (const item of target.items) {
      if (item.status === ITEM_STATUS_QUEUED) {
        item.status = ITEM_STATUS_QUEUED;
      }
    }
  });

  const latestState = await getServiceState();
  const activeRun = latestState.runs.find((entry) => entry.id === runId);
  if (!activeRun) return null;

  for (const item of activeRun.items) {
    try {
      await updateServiceState((draft) => {
        const targetRun = draft.runs.find((entry) => entry.id === runId);
        const targetItem = targetRun?.items.find((entry) => entry.id === item.id);
        if (targetItem) {
          targetItem.status = ITEM_STATUS_RUNNING;
          targetItem.updatedAt = new Date().toISOString();
        }
      });

      const current = await getServiceState();
      const template = current.templates.find((entry) => String(entry.id) === String(item.templateId));
      const design = current.designs.find((entry) => String(entry.id) === String(item.designId));

      if (!template || !design) {
        throw new Error("missing_template_or_design");
      }

      const images = await renderAllProductImages({ template, design });
      const product = buildGeneratedProduct(template, design, images);

      await updateServiceState((draft) => {
        const existingProduct = draft.products.find(
          (entry) =>
            String(entry.id) === String(product.id) ||
            String(entry.handle) === String(product.handle)
        );
        const sameTemplate = existingProduct && String(existingProduct.templateProductId) === String(product.templateProductId);
        if (sameTemplate && existingProduct?.shopify) {
          product.shopify = existingProduct.shopify;
        } else if (existingProduct?.shopify) {
          product.shopifyHistory = [
            ...(Array.isArray(existingProduct.shopifyHistory) ? existingProduct.shopifyHistory : []),
            {
              ...existingProduct.shopify,
              clearedAt: new Date().toISOString(),
              reason: "template_changed_on_regeneration",
              previousTemplateProductId: existingProduct.templateProductId,
              replacementTemplateProductId: product.templateProductId
            }
          ];
        } else if (Array.isArray(existingProduct?.shopifyHistory)) {
          product.shopifyHistory = existingProduct.shopifyHistory;
        }
        if (existingProduct?.status) {
          product.status = existingProduct.status;
        }
        draft.products = draft.products.filter(
          (entry) =>
            String(entry.id) !== String(product.id) &&
            String(entry.handle) !== String(product.handle)
        );
        draft.products.unshift(product);

        const targetRun = draft.runs.find((entry) => entry.id === runId);
        const targetItem = targetRun?.items.find((entry) => entry.id === item.id);
        if (targetItem) {
          targetItem.status = ITEM_STATUS_COMPLETED;
          targetItem.productId = product.id;
          targetItem.updatedAt = new Date().toISOString();
        }
        if (targetRun) {
          targetRun.completedCount += 1;
          targetRun.updatedAt = new Date().toISOString();
        }
      });
    } catch (error) {
      await writeServiceLog("error", "generation_item_failed", {
        runId,
        itemId: item.id,
        error: error instanceof Error ? error.message : String(error)
      });

      await updateServiceState((draft) => {
        const targetRun = draft.runs.find((entry) => entry.id === runId);
        const targetItem = targetRun?.items.find((entry) => entry.id === item.id);
        if (targetItem) {
          targetItem.status = ITEM_STATUS_FAILED;
          targetItem.errorMessage = error instanceof Error ? error.message : String(error);
          targetItem.updatedAt = new Date().toISOString();
        }
        if (targetRun) {
          targetRun.failedCount += 1;
          targetRun.updatedAt = new Date().toISOString();
        }
      });
    }
  }

  const finalState = await getServiceState();
  const finishedRun = finalState.runs.find((entry) => entry.id === runId);
  if (!finishedRun) return null;

  await updateServiceState((draft) => {
    const target = draft.runs.find((entry) => entry.id === runId);
    if (!target) return;
    target.status = target.failedCount > 0 ? RUN_STATUS_FAILED : RUN_STATUS_COMPLETED;
    target.completedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
  });

  return finishedRun;
}
