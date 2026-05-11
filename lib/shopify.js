import { getServiceState, updateServiceState } from "./store.js";
import { uniqueValues } from "./tags.js";

const DEFAULT_API_VERSION = "2026-04";
const DEFAULT_PRODUCT_STATUS = "DRAFT";
const DEFAULT_INVENTORY_QUANTITY = 99;
const MAX_PRODUCT_OPTIONS = 3;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integerOrDefault(value, fallback) {
  const cleaned = clean(value);
  if (!cleaned) return fallback;
  const number = Number(cleaned);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function money(value, fallback = 0) {
  const number = numberOrNull(value);
  return (number == null ? Number(fallback || 0) : number).toFixed(2);
}

function normalizeShopDomain(value) {
  return clean(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/admin(?:\/.*)?$/i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function firstEnv(names) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

function normalizeShopifyGid(resourceType, value) {
  const cleaned = clean(value);
  if (!cleaned) return "";
  if (cleaned.startsWith(`gid://shopify/${resourceType}/`)) return cleaned;
  const numericId = cleaned.match(/(\d+)(?:\D*)$/)?.[1] || cleaned.match(/(\d+)/)?.[1];
  return numericId ? `gid://shopify/${resourceType}/${numericId}` : cleaned;
}

export function getShopifyConfig() {
  const shopDomain = normalizeShopDomain(firstEnv(["SHOPIFY_STORE_DOMAIN", "SHOP_DOMAIN", "SHOPIFY_SHOP_DOMAIN"]));
  const accessToken = firstEnv(["SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_ACCESS_TOKEN"]);
  const apiVersion = firstEnv(["SHOPIFY_API_VERSION", "SHOPIFY_ADMIN_API_VERSION"]) || DEFAULT_API_VERSION;
  const status = normalizeProductStatus(process.env.SHOPIFY_PRODUCT_STATUS);
  const defaultInventoryQuantity = integerOrDefault(
    firstEnv(["SHOPIFY_DEFAULT_INVENTORY_QUANTITY", "SHOPIFY_INITIAL_INVENTORY_QUANTITY"]),
    DEFAULT_INVENTORY_QUANTITY
  );

  return {
    shopDomain,
    accessToken,
    apiVersion,
    status,
    vendor: firstEnv(["SHOPIFY_DEFAULT_VENDOR"]) || "Good Game Apparel",
    productType: firstEnv(["SHOPIFY_DEFAULT_PRODUCT_TYPE"]),
    locationId: normalizeShopifyGid("Location", firstEnv(["SHOPIFY_LOCATION_ID", "SHOPIFY_INVENTORY_LOCATION_ID"])),
    locationName: firstEnv(["SHOPIFY_LOCATION_NAME", "SHOPIFY_INVENTORY_LOCATION_NAME"]),
    defaultInventoryQuantity
  };
}

export function isShopifyConfigured() {
  const config = getShopifyConfig();
  return Boolean(config.shopDomain && config.accessToken && config.apiVersion);
}

function normalizeProductStatus(value) {
  const status = clean(value || DEFAULT_PRODUCT_STATUS).toUpperCase();
  return ["ACTIVE", "ARCHIVED", "DRAFT"].includes(status) ? status : DEFAULT_PRODUCT_STATUS;
}

function adminProductUrl(shopDomain, productGid) {
  const numericId = clean(productGid).split("/").pop();
  return numericId ? `https://${shopDomain}/admin/products/${numericId}` : null;
}

function htmlDescription(value) {
  const text = clean(value);
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
}

async function shopifyGraphql({ query, variables }) {
  const config = getShopifyConfig();
  if (!config.shopDomain || !config.accessToken) {
    throw new Error("missing_shopify_credentials");
  }

  const response = await fetch(`https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { errors: [{ message: text.slice(0, 240) }] };
  }

  if (!response.ok) {
    const message = payload?.errors?.[0]?.message || response.statusText;
    throw new Error(`shopify_http_${response.status}:${message}`);
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(`shopify_graphql:${payload.errors.map((error) => error.message).join("; ")}`);
  }

  return payload?.data || {};
}

function assertNoUserErrors(action, userErrors) {
  const errors = Array.isArray(userErrors) ? userErrors : [];
  if (!errors.length) return;

  const detail = errors
    .map((error) => `${(error.field || []).join(".") || "field"}: ${error.message}`)
    .join("; ");
  throw new Error(`${action}_user_error:${detail}`);
}

async function listShopifyLocations() {
  const data = await shopifyGraphql({
    query: `
      query ProductGenLocations {
        locations(first: 50) {
          nodes {
            id
            name
          }
        }
      }
    `
  });

  return data.locations?.nodes || [];
}

function selectInventoryLocation(locations, preferredName) {
  const availableLocations = Array.isArray(locations) ? locations.filter((location) => location?.id) : [];
  if (!availableLocations.length) return null;

  const normalizedPreferredName = normalizeToken(preferredName);
  if (normalizedPreferredName) {
    const exact = availableLocations.find((location) => normalizeToken(location.name) === normalizedPreferredName);
    if (exact) return exact;

    const partial = availableLocations.find((location) => normalizeToken(location.name).includes(normalizedPreferredName));
    if (partial) return partial;
  }

  return (
    availableLocations.find((location) => normalizeToken(location.name).includes("ggapparel")) ||
    availableLocations[0]
  );
}

async function resolveInventoryLocation() {
  const config = getShopifyConfig();
  if (config.locationId) {
    return {
      id: config.locationId,
      name: config.locationName || null,
      source: "env"
    };
  }

  let locations = [];
  try {
    locations = await listShopifyLocations();
  } catch (error) {
    throw new Error(
      `missing_shopify_inventory_location_id:set SHOPIFY_LOCATION_ID or grant read_locations (${error instanceof Error ? error.message : String(error)})`
    );
  }

  const location = selectInventoryLocation(locations, config.locationName);
  if (!location?.id) {
    throw new Error("missing_shopify_inventory_location_id:no active locations returned by Shopify");
  }

  return {
    id: location.id,
    name: location.name || null,
    source: "shopify_locations"
  };
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

function optionValuesFromVariants(optionName, variants) {
  return uniqueValues(
    variants.map((variant) => getVariantOptionValue(variant, optionName)).filter(Boolean)
  );
}

function buildProductOptions(template, variants) {
  const templateOptions = Array.isArray(template?.options) ? template.options : [];
  const variantOptionNames = uniqueValues(
    variants.flatMap((variant) => Object.keys(variant?.options || {})).filter(Boolean)
  );
  const optionNames = uniqueValues([
    ...templateOptions.map((option) => clean(option?.name)).filter(Boolean),
    ...variantOptionNames
  ]).slice(0, MAX_PRODUCT_OPTIONS);

  return optionNames.map((name, index) => {
    const templateOption = templateOptions.find((option) => normalizeToken(option?.name) === normalizeToken(name));
    const values = uniqueValues([
      ...((Array.isArray(templateOption?.values) ? templateOption.values : []).map(clean).filter(Boolean)),
      ...optionValuesFromVariants(name, variants)
    ]);

    return {
      name,
      position: Number(templateOption?.position || index + 1),
      values: values.map((value) => ({ name: value }))
    };
  });
}

function buildImageByColour(product) {
  return new Map(
    (Array.isArray(product?.images) ? product.images : [])
      .filter((image) => image?.colourName && /^https?:\/\//i.test(String(image.imageUrl || "")))
      .map((image) => [normalizeToken(image.colourName), image])
  );
}

function mediaForVariant({ product, template, variant, imageByColour }) {
  const colourOptionName = findOptionName(template, ["Colour", "Color"]);
  const colourName = getVariantOptionValue(variant, colourOptionName);
  if (!colourOptionName) {
    const firstImage = (Array.isArray(product.images) ? product.images : []).find((image) =>
      /^https?:\/\//i.test(String(image?.imageUrl || ""))
    );
    return { colourName: null, image: firstImage || null };
  }

  return {
    colourName,
    image: colourName ? imageByColour.get(normalizeToken(colourName)) || null : null
  };
}

function validateImageCoverage({ product, template, variants, imageByColour }) {
  const colourOptionName = findOptionName(template, ["Colour", "Color"]);
  if (!colourOptionName) {
    const hasImage = (Array.isArray(product.images) ? product.images : []).some((image) =>
      /^https?:\/\//i.test(String(image?.imageUrl || ""))
    );
    if (!hasImage) throw new Error("missing_product_image");
    return;
  }

  const missingColours = uniqueValues(
    variants
      .map((variant) => getVariantOptionValue(variant, colourOptionName))
      .filter(Boolean)
      .filter((colour) => !imageByColour.has(normalizeToken(colour)))
  );

  if (missingColours.length) {
    throw new Error(`missing_colour_images:${missingColours.slice(0, 12).join(", ")}`);
  }
}

function buildMediaInputs({ product, template, variants, imageByColour }) {
  const seen = new Set();
  const media = [];

  for (const variant of variants) {
    const { colourName, image } = mediaForVariant({ product, template, variant, imageByColour });
    if (!image?.imageUrl || seen.has(image.imageUrl)) continue;
    seen.add(image.imageUrl);
    media.push({
      mediaContentType: "IMAGE",
      originalSource: image.imageUrl,
      alt: [product.title, colourName || image.colourName].filter(Boolean).join(" - ")
    });
  }

  return media;
}

function buildVariantInputs({ product, template, variants, imageByColour, inventoryLocationId, inventoryQuantity }) {
  return variants.map((variant) => {
    const { image } = mediaForVariant({ product, template, variant, imageByColour });
    const optionValues = Object.entries(variant.options || {})
      .filter(([, value]) => clean(value))
      .slice(0, MAX_PRODUCT_OPTIONS)
      .map(([optionName, value]) => ({
        optionName,
        name: clean(value)
      }));
    const inventoryItem = {
      sku: clean(variant.sku),
      tracked: true,
      requiresShipping: true
    };
    const cost = numberOrNull(variant.costPrice);
    const weightGrams = numberOrNull(variant.weightGrams);
    const input = {
      price: money(variant.price, product.priceGbp),
      taxable: true,
      inventoryPolicy: "DENY",
      optionValues,
      inventoryItem,
      mediaSrc: image?.imageUrl ? [image.imageUrl] : undefined,
      metafields: [
        {
          namespace: "product_gen",
          key: "template_variant_id",
          type: "single_line_text_field",
          value: clean(variant.id || variant.sourceId || variant.sku || "unknown")
        }
      ]
    };

    if (cost != null) inventoryItem.cost = String(cost);
    if (weightGrams != null) {
      inventoryItem.measurement = {
        weight: {
          unit: "GRAMS",
          value: weightGrams
        }
      };
    }
    if (inventoryLocationId && inventoryQuantity != null) {
      input.inventoryQuantities = [
        {
          locationId: inventoryLocationId,
          availableQuantity: inventoryQuantity
        }
      ];
    }

    return input;
  });
}

function buildProductInput({ product, template, productOptions }) {
  const config = getShopifyConfig();
  const tags = uniqueValues([
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(template.tags) ? template.tags : []),
    "product-gen",
    `product-gen-template-${template.id}`
  ]).filter(Boolean);

  return {
    title: clean(product.title),
    handle: clean(product.handle),
    descriptionHtml: htmlDescription(product.description),
    vendor: clean(template.vendor) || config.vendor,
    productType: clean(template.productType) || config.productType || undefined,
    status: config.status,
    tags,
    productOptions,
    metafields: [
      {
        namespace: "product_gen",
        key: "product_id",
        type: "single_line_text_field",
        value: String(product.id)
      },
      {
        namespace: "product_gen",
        key: "template_product_id",
        type: "single_line_text_field",
        value: String(template.id)
      }
    ]
  };
}

export function buildShopifyPublishPlan({ product, template, inventoryLocationId = null, inventoryQuantity = null } = {}) {
  if (!product) throw new Error("missing_product");
  if (!template) throw new Error("missing_template");

  const variants = Array.isArray(template.variants) && template.variants.length ? template.variants : product.variants || [];
  if (!variants.length) throw new Error("missing_template_variants");

  const imageByColour = buildImageByColour(product);
  validateImageCoverage({ product, template, variants, imageByColour });

  const productOptions = buildProductOptions(template, variants);
  if (!productOptions.length) throw new Error("missing_product_options");

  const media = buildMediaInputs({ product, template, variants, imageByColour });
  const variantInputs = buildVariantInputs({ product, template, variants, imageByColour, inventoryLocationId, inventoryQuantity });
  const productInput = buildProductInput({ product, template, productOptions });
  const variantsWithSku = variantInputs.filter((variant) => clean(variant.inventoryItem?.sku)).length;
  const variantsWithCost = variantInputs.filter((variant) => variant.inventoryItem?.cost != null).length;
  const variantsWithInventory = variantInputs.filter((variant) => Array.isArray(variant.inventoryQuantities) && variant.inventoryQuantities.length).length;

  return {
    productInput,
    media,
    variants: variantInputs,
    summary: {
      productTitle: productInput.title,
      handle: productInput.handle,
      status: productInput.status,
      options: productOptions.map((option) => ({
        name: option.name,
        values: option.values.length
      })),
      variants: variantInputs.length,
      variantsWithSku,
      variantsWithCost,
      variantsWithInventory,
      inventoryLocationId: inventoryLocationId || null,
      inventoryQuantity,
      media: media.length
    }
  };
}

async function createShopifyProduct(productInput) {
  const data = await shopifyGraphql({
    query: `
      mutation ProductGenProductCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            handle
            status
            options {
              id
              name
              position
              optionValues {
                id
                name
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: { product: productInput }
  });

  assertNoUserErrors("product_create", data.productCreate?.userErrors);
  return data.productCreate?.product;
}

async function bulkCreateShopifyVariants({ productId, variants, media }) {
  const data = await shopifyGraphql({
    query: `
      mutation ProductGenVariantsBulkCreate(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
        $media: [CreateMediaInput!]
      ) {
        productVariantsBulkCreate(
          productId: $productId
          variants: $variants
          media: $media
          strategy: REMOVE_STANDALONE_VARIANT
        ) {
          product {
            id
            handle
            status
          }
          productVariants {
            id
            title
            sku
            price
            selectedOptions {
              name
              value
            }
            media(first: 5) {
              nodes {
                id
                alt
                mediaContentType
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      productId,
      variants,
      media
    }
  });

  assertNoUserErrors("product_variants_bulk_create", data.productVariantsBulkCreate?.userErrors);
  return data.productVariantsBulkCreate;
}

async function readShopifyProduct(productId, inventoryLocationId) {
  const data = await shopifyGraphql({
    query: `
      query ProductGenProductRead($id: ID!, $inventoryLocationId: ID!) {
        product(id: $id) {
          id
          handle
          status
          media(first: 250) {
            nodes {
              id
              alt
              mediaContentType
            }
          }
          variants(first: 250) {
            nodes {
              id
              sku
              inventoryQuantity
              inventoryItem {
                id
                sku
                tracked
                unitCost {
                  amount
                  currencyCode
                }
                inventoryLevel(locationId: $inventoryLocationId) {
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                }
              }
              selectedOptions {
                name
                value
              }
              media(first: 5) {
                nodes {
                  id
                  alt
                  mediaContentType
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: productId, inventoryLocationId }
  });

  return data.product;
}

function inventoryLevelQuantity(variant, name = "available") {
  const quantities = variant?.inventoryItem?.inventoryLevel?.quantities || [];
  const quantity = quantities.find((entry) => entry?.name === name)?.quantity;
  return numberOrNull(quantity);
}

function validatePublishedVariantData({ planVariants, product, inventoryQuantity }) {
  const expectedVariants = planVariants.length;
  const variants = product?.variants?.nodes || [];
  const variantsWithMedia = variants.filter((variant) => (variant.media?.nodes || []).length > 0).length;
  if (variants.length && variantsWithMedia === 0 && expectedVariants > 0) {
    throw new Error("shopify_variant_media_link_verification_failed");
  }

  const expectedSkuCount = planVariants.filter((variant) => clean(variant.inventoryItem?.sku)).length;
  const expectedCostCount = planVariants.filter((variant) => variant.inventoryItem?.cost != null).length;
  const expectedInventoryCount = planVariants.filter((variant) => Array.isArray(variant.inventoryQuantities) && variant.inventoryQuantities.length).length;
  const variantsWithSku = variants.filter((variant) => clean(variant.sku || variant.inventoryItem?.sku)).length;
  const variantsWithCost = variants.filter((variant) => numberOrNull(variant.inventoryItem?.unitCost?.amount) != null).length;
  const trackedVariants = variants.filter((variant) => variant.inventoryItem?.tracked === true).length;
  const variantsWithInventoryQuantity = variants.filter((variant) => numberOrNull(variant.inventoryQuantity) === inventoryQuantity).length;
  const variantsWithAvailableQuantity = variants.filter((variant) => inventoryLevelQuantity(variant) === inventoryQuantity).length;
  const distinctSkus = new Set(variants.map((variant) => clean(variant.sku || variant.inventoryItem?.sku)).filter(Boolean));

  if (variants.length === expectedVariants && expectedSkuCount && variantsWithSku < Math.min(expectedSkuCount, variants.length)) {
    throw new Error("shopify_variant_sku_verification_failed");
  }
  if (variants.length === expectedVariants && expectedSkuCount > 1 && distinctSkus.size <= 1) {
    throw new Error("shopify_variant_sku_uniqueness_verification_failed");
  }
  if (variants.length === expectedVariants && expectedCostCount && variantsWithCost < Math.min(expectedCostCount, variants.length)) {
    throw new Error("shopify_variant_cost_verification_failed");
  }
  if (variants.length === expectedVariants && expectedInventoryCount && trackedVariants < Math.min(expectedInventoryCount, variants.length)) {
    throw new Error("shopify_variant_inventory_tracking_verification_failed");
  }
  if (variants.length === expectedVariants && expectedInventoryCount && variantsWithAvailableQuantity < Math.min(expectedInventoryCount, variants.length)) {
    throw new Error("shopify_variant_inventory_quantity_verification_failed");
  }

  return {
    checkedVariants: variants.length,
    variantsWithMedia,
    variantsWithSku,
    distinctSkus: distinctSkus.size,
    variantsWithCost,
    trackedVariants,
    variantsWithInventoryQuantity,
    variantsWithAvailableQuantity
  };
}

function productWithPublishOverrides(product, { handleSuffix = "", titleSuffix = "" } = {}) {
  const cleanedHandleSuffix = clean(handleSuffix);
  const cleanedTitleSuffix = clean(titleSuffix);
  if (!cleanedHandleSuffix && !cleanedTitleSuffix) return product;

  return {
    ...product,
    handle: `${clean(product.handle)}${cleanedHandleSuffix}`,
    title: `${clean(product.title)}${cleanedTitleSuffix}`
  };
}

export async function createShopifyDraftForGeneratedProduct({ product, template, handleSuffix = "", titleSuffix = "" } = {}) {
  if (!product) throw new Error("missing_product");
  if (!template) throw new Error("missing_template");

  const config = getShopifyConfig();
  const inventoryLocation = await resolveInventoryLocation();
  const inventoryQuantity = config.defaultInventoryQuantity;
  const productForPublish = productWithPublishOverrides(product, { handleSuffix, titleSuffix });
  const plan = buildShopifyPublishPlan({
    product: productForPublish,
    template,
    inventoryLocationId: inventoryLocation.id,
    inventoryQuantity
  });
  const createdProduct = await createShopifyProduct(plan.productInput);
  if (!createdProduct?.id) throw new Error("shopify_product_create_missing_id");

  const variantResult = await bulkCreateShopifyVariants({
    productId: createdProduct.id,
    variants: plan.variants,
    media: plan.media
  });
  const readBack = await readShopifyProduct(createdProduct.id, inventoryLocation.id);
  const variantVerification = validatePublishedVariantData({
    planVariants: plan.variants,
    inventoryQuantity,
    product: readBack
  });
  const shopify = {
    productGid: createdProduct.id,
    productId: clean(createdProduct.id).split("/").pop(),
    handle: createdProduct.handle,
    status: readBack?.status || createdProduct.status,
    adminUrl: adminProductUrl(config.shopDomain, createdProduct.id),
    apiVersion: config.apiVersion,
    publishedAt: new Date().toISOString(),
    variantCount: plan.variants.length,
    mediaCount: plan.media.length,
    variantsCreated: variantResult?.productVariants?.length || 0,
    inventoryLocation,
    inventoryQuantity,
    variantVerification
  };

  return {
    shopify,
    summary: {
      ...plan.summary,
      inventoryLocation
    },
    readBack
  };
}

export async function publishProductToShopify(productId) {
  const state = await getServiceState();
  const product = (state.products || []).find((entry) => String(entry.id) === String(productId));
  if (!product) throw new Error("product_not_found");
  if (product.shopify?.productGid) throw new Error("product_already_published_to_shopify");

  const template = (state.templates || []).find((entry) => String(entry.id) === String(product.templateProductId));
  if (!template) throw new Error("template_not_found");

  const { shopify, summary } = await createShopifyDraftForGeneratedProduct({ product, template });

  let updated = null;
  await updateServiceState((draft) => {
    const target = (draft.products || []).find((entry) => String(entry.id) === String(productId));
    if (!target) return;
    target.shopify = shopify;
    target.updatedAt = new Date().toISOString();
    updated = structuredClone(target);
  });

  return {
    product: updated,
    shopify,
    summary
  };
}
