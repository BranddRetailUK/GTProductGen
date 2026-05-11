import crypto from "node:crypto";

import { Client } from "pg";

import { DEFAULT_PRINT_AREAS } from "./constants.js";
import { getPool } from "./db.js";
import { resolveProductTypeTag, uniqueValues } from "./tags.js";
import { getServiceState, updateServiceState } from "./store.js";

const SYNC_SOURCE = "good_game_db";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function clone(value) {
  return structuredClone(value);
}

function normalizeToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function hashId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12)}`;
}

function getGoodGameDatabaseConfig() {
  return {
    connectionString: clean(process.env.GOOD_GAME_DATABASE_URL),
    ssl:
      clean(process.env.GOOD_GAME_DATABASE_SSL).toLowerCase() === "false"
        ? false
        : { rejectUnauthorized: false }
  };
}

function createGoodGameClient() {
  const config = getGoodGameDatabaseConfig();
  if (!config.connectionString) {
    throw new Error("missing_good_game_database_url");
  }
  return new Client(config);
}

function normalizeOptions(options) {
  return (Array.isArray(options) ? options : [])
    .filter((option) => option && clean(option.name))
    .map((option, index) => ({
      name: clean(option.name),
      position: Number(option.position || index + 1),
      values: uniqueValues((Array.isArray(option.values) ? option.values : []).map(clean).filter(Boolean))
    }))
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
}

function findOption(options, names) {
  const normalizedNames = names.map(normalizeToken);
  return options.find((option) => normalizedNames.includes(normalizeToken(option.name))) || null;
}

function optionNames(options) {
  return [0, 1, 2].map((index) => options[index]?.name || `Option ${index + 1}`);
}

function buildVariantOptions(optionNameList, variant) {
  return [variant.option1, variant.option2, variant.option3].reduce((options, value, index) => {
    const cleanedValue = clean(value);
    if (cleanedValue) options[optionNameList[index]] = cleanedValue;
    return options;
  }, {});
}

function variantTitle(variant) {
  return [variant.option1, variant.option2, variant.option3].map(clean).filter(Boolean).join(" / ") || "Default Title";
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOrNow(value) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function imageViewId(image) {
  const name = `${image?.original_filename || ""} ${image?.file_url || ""}`.toLowerCase();
  return name.includes("back") ? "back" : "front";
}

function buildColourLookup(colours) {
  return new Map((Array.isArray(colours) ? colours : []).map((colour) => [normalizeToken(colour), colour]));
}

function buildViewAssets(templateId, colours, variantImages) {
  const colourLookup = buildColourLookup(colours);
  const seen = new Set();
  const assets = [];

  for (const image of variantImages) {
    const normalizedColour = normalizeToken(image.color_raw);
    const colourName = colourLookup.get(normalizedColour);
    if (!colourName || !image.file_url) continue;

    const viewId = imageViewId(image);
    const key = `${templateId}:${colourName}:${viewId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    assets.push({
      id: hashId("view", `${key}:${image.file_url}`),
      viewId,
      assetType: "base",
      colourName,
      assetUrl: image.file_url,
      outputWidth: null,
      outputHeight: null,
      source: SYNC_SOURCE,
      sourceTable: "template_variant_images",
      sourceId: image.id ? String(image.id) : null,
      sourceFilename: image.original_filename || null
    });
  }

  return assets;
}

function mapTemplate({ row, variants, images, variantImages }) {
  const options = normalizeOptions(row.options);
  const colourOption = findOption(options, ["Colour", "Color"]);
  const sizeOption = findOption(options, ["Size"]);
  const colours = colourOption?.values?.length ? colourOption.values : ["Default"];
  const sizes = sizeOption?.values?.length ? sizeOption.values : ["One Size"];
  const productType = clean(row.product_type) || resolveProductTypeTag({ title: row.title, tags: row.tags });
  const resolvedPrintAreaType = resolveProductTypeTag({ title: row.title, productType, tags: row.tags });
  const optionNameList = optionNames(options);
  const mappedVariants = variants.map((variant) => ({
    id: String(variant.shopify_variant_id || hashId("variant", `${row.shopify_product_id}:${variant.sku}`)),
    sourceId: variant.shopify_variant_id ? String(variant.shopify_variant_id) : null,
    title: variantTitle(variant),
    sku: variant.sku || "",
    price: numberOrNull(variant.price),
    costPrice: numberOrNull(variant.cost_price),
    weightGrams: numberOrNull(variant.weight_grams),
    inventoryItemId: variant.inventory_item_id ? String(variant.inventory_item_id) : null,
    imageId: variant.image_id ? String(variant.image_id) : null,
    position: numberOrNull(variant.position),
    options: buildVariantOptions(optionNameList, variant)
  }));
  const defaultPriceGbp =
    mappedVariants.map((variant) => variant.price).find((price) => price != null) ||
    numberOrNull(row.price_config?.base) ||
    0;

  return {
    id: String(row.shopify_product_id),
    sourceId: row.shopify_product_id ? String(row.shopify_product_id) : null,
    source: SYNC_SOURCE,
    gid: row.gid || (row.shopify_product_id ? `gid://shopify/Product/${row.shopify_product_id}` : null),
    title: clean(row.title),
    rawTitle: clean(row.raw_title) || clean(row.title),
    handle: clean(row.handle),
    bodyHtml: row.body_html || "",
    vendor: clean(row.vendor) || "Good Game Apparel",
    productType,
    tags: uniqueValues(Array.isArray(row.tags) ? row.tags.map(clean).filter(Boolean) : []),
    productCategoryNodeId: row.product_category_node_id || null,
    status: clean(row.status) || "draft",
    options,
    sizes,
    colours,
    images: images.map((image) => ({
      id: String(image.image_id),
      imageUrl: image.src || "",
      src: image.src || "",
      alt: image.alt || "",
      position: numberOrNull(image.position),
      sortOrder: numberOrNull(image.position) || 0
    })),
    printAreas:
      Array.isArray(row.print_areas) && row.print_areas.length
        ? row.print_areas
        : [clone(DEFAULT_PRINT_AREAS[resolvedPrintAreaType] || DEFAULT_PRINT_AREAS["T-Shirts"])],
    viewAssets: buildViewAssets(row.shopify_product_id, colours, variantImages),
    hidden: Boolean(row.hidden),
    sizeOptionHidden: Boolean(row.size_option_hidden || !sizeOption),
    displayOrder: numberOrNull(row.display_order) || 0,
    priceConfig: {
      ...(row.price_config && typeof row.price_config === "object" ? row.price_config : {}),
      defaultPriceGbp
    },
    customs: {
      description: row.customs_description || null,
      commodityCode: row.customs_commodity_code || null,
      countryOfOrigin: row.customs_country_of_origin || null
    },
    allowEmbroidery: Boolean(row.allow_embroidery),
    embroideryAreas: Array.isArray(row.embroidery_areas) ? row.embroidery_areas : [],
    variants: mappedVariants,
    createdAt: dateOrNow(row.updated_at),
    updatedAt: dateOrNow(row.updated_at)
  };
}

async function fetchGoodGameTemplateRows() {
  const client = createGoodGameClient();
  await client.connect();

  try {
    await client.query("begin read only");

    const products = await client.query(`
      SELECT *
      FROM public.template_products
      ORDER BY COALESCE(display_order, 999999), title
    `);
    const variants = await client.query(`
      SELECT *
      FROM public.template_variants
      ORDER BY product_id, COALESCE(position, 999999), sku
    `);
    const images = await client.query(`
      SELECT *
      FROM public.template_images
      ORDER BY product_id, COALESCE(position, 999999), image_id
    `);
    const variantImages = await client.query(`
      SELECT *
      FROM public.template_variant_images
      ORDER BY template_product_id, updated_at DESC NULLS LAST, color_raw, original_filename
    `);

    await client.query("rollback");
    return {
      products: products.rows,
      variants: variants.rows,
      images: images.rows,
      variantImages: variantImages.rows
    };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = String(row[key] || "");
    if (!value) continue;
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(row);
  }
  return grouped;
}

export async function loadGoodGameTemplates() {
  const rows = await fetchGoodGameTemplateRows();
  const variantsByProduct = groupBy(rows.variants, "product_id");
  const imagesByProduct = groupBy(rows.images, "product_id");
  const variantImagesByProduct = groupBy(rows.variantImages, "template_product_id");

  return rows.products.map((row) =>
    mapTemplate({
      row,
      variants: variantsByProduct.get(String(row.shopify_product_id)) || [],
      images: imagesByProduct.get(String(row.shopify_product_id)) || [],
      variantImages: variantImagesByProduct.get(String(row.shopify_product_id)) || []
    })
  );
}

function mergeTemplate(existing, imported) {
  if (!existing) return imported;
  const supplementalViewAssets = (Array.isArray(existing.viewAssets) ? existing.viewAssets : []).filter(
    (asset) => asset?.source && asset.source !== SYNC_SOURCE
  );

  return {
    ...existing,
    ...imported,
    printAreas: imported.printAreas?.length ? imported.printAreas : existing.printAreas || [],
    viewAssets: imported.viewAssets?.length ? [...imported.viewAssets, ...supplementalViewAssets] : existing.viewAssets || [],
    createdAt: existing.createdAt || imported.createdAt,
    updatedAt: new Date().toISOString()
  };
}

function templateMatchKeys(template) {
  const title = normalizeToken(template?.title);
  const rawTitle = normalizeToken(template?.rawTitle);
  const handle = normalizeToken(template?.handle);
  const productType = normalizeToken(template?.productType);
  return uniqueValues([
    handle ? `handle:${handle}` : "",
    title && productType ? `title-type:${title}:${productType}` : "",
    rawTitle && productType ? `title-type:${rawTitle}:${productType}` : "",
    title ? `title:${title}` : "",
    rawTitle ? `title:${rawTitle}` : ""
  ].filter(Boolean));
}

function buildTemplateReplacementLookup(importedTemplates) {
  const lookup = new Map();
  const ambiguous = new Set();

  for (const template of importedTemplates) {
    for (const key of templateMatchKeys(template)) {
      if (lookup.has(key) && String(lookup.get(key).id) !== String(template.id)) {
        ambiguous.add(key);
      } else {
        lookup.set(key, template);
      }
    }
  }

  for (const key of ambiguous) lookup.delete(key);
  return lookup;
}

function findReplacementTemplate(template, lookup) {
  for (const key of templateMatchKeys(template)) {
    const replacement = lookup.get(key);
    if (replacement) return replacement;
  }
  return null;
}

function sortTemplates(templates) {
  return templates.sort(
    (a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0) || String(a.title).localeCompare(String(b.title))
  );
}

export async function syncGoodGameTemplates({ dryRun = true, keepExisting = false } = {}) {
  const [state, importedTemplates] = await Promise.all([getServiceState(), loadGoodGameTemplates()]);
  const importedById = new Map(importedTemplates.map((template) => [String(template.id), template]));
  const existingById = new Map((state.templates || []).map((template) => [String(template.id), template]));
  const importedReplacementLookup = buildTemplateReplacementLookup(importedTemplates);
  const matched = importedTemplates.filter((template) => existingById.has(String(template.id)));
  const added = importedTemplates.filter((template) => !existingById.has(String(template.id)));
  const removed = (state.templates || []).filter((template) => !importedById.has(String(template.id)));
  const replacementByRemovedId = new Map(
    removed
      .map((template) => [String(template.id), findReplacementTemplate(template, importedReplacementLookup)])
      .filter(([, replacement]) => replacement)
      .map(([id, replacement]) => [id, replacement])
  );
  const productTemplateRemaps = (state.products || [])
    .filter((product) => replacementByRemovedId.has(String(product.templateProductId || "")))
    .map((product) => {
      const replacement = replacementByRemovedId.get(String(product.templateProductId));
      return {
        productId: product.id,
        title: product.title,
        fromTemplateId: product.templateProductId,
        toTemplateId: replacement.id,
        toTemplateTitle: replacement.title,
        clearedShopifyLink: Boolean(product.shopify?.productGid)
      };
    });

  if (!dryRun) {
    await updateServiceState((draft) => {
      const now = new Date().toISOString();
      const nextTemplates = keepExisting ? [] : importedTemplates.map((imported) => mergeTemplate(existingById.get(String(imported.id)), imported));
      const seen = new Set(nextTemplates.map((template) => String(template.id)));

      if (keepExisting) {
        for (const existing of draft.templates || []) {
          const imported = importedById.get(String(existing.id));
          if (!imported) {
            nextTemplates.push(existing);
            continue;
          }
          nextTemplates.push(mergeTemplate(existing, imported));
          seen.add(String(existing.id));
        }

        for (const imported of importedTemplates) {
          if (!seen.has(String(imported.id))) {
            nextTemplates.push(imported);
          }
        }
      }

      for (const product of draft.products || []) {
        const replacement = replacementByRemovedId.get(String(product.templateProductId || ""));
        if (!replacement) continue;

        if (product.shopify?.productGid) {
          product.shopifyHistory = [
            ...(Array.isArray(product.shopifyHistory) ? product.shopifyHistory : []),
            {
              ...product.shopify,
              clearedAt: now,
              reason: "template_replaced_from_good_game_sync",
              previousTemplateProductId: product.templateProductId,
              replacementTemplateProductId: replacement.id
            }
          ];
          delete product.shopify;
        }

        product.templateProductId = replacement.id;
        product.updatedAt = now;
      }

      draft.templates = sortTemplates(nextTemplates);
    });
  }

  const totalVariants = importedTemplates.reduce((total, template) => total + (template.variants?.length || 0), 0);
  const totalViewAssets = importedTemplates.reduce((total, template) => total + (template.viewAssets?.length || 0), 0);

  return {
    dryRun,
    keepExisting,
    importedTemplates: importedTemplates.length,
    matchedTemplates: matched.length,
    addedTemplates: added.length,
    removedTemplates: keepExisting ? 0 : removed.length,
    remappedProducts: keepExisting ? 0 : productTemplateRemaps.length,
    totalVariants,
    totalViewAssets,
    removed: keepExisting
      ? []
      : removed.slice(0, 50).map((template) => {
          const replacement = replacementByRemovedId.get(String(template.id));
          return {
            id: template.id,
            title: template.title,
            replacementTemplateId: replacement?.id || null,
            replacementTemplateTitle: replacement?.title || null
          };
        }),
    productTemplateRemaps: keepExisting ? [] : productTemplateRemaps,
    templates: importedTemplates.map((template) => ({
      id: template.id,
      title: template.title,
      productType: template.productType,
      colours: template.colours.length,
      sizes: template.sizes.length,
      variants: template.variants.length,
      viewAssets: template.viewAssets.length,
      status: template.status
    }))
  };
}

export async function closeProductGenPool() {
  await getPool()?.end();
}
