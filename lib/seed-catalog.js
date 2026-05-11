import crypto from "node:crypto";

import {
  ACCESSORY_SIZES,
  DEFAULT_COLOURS,
  DEFAULT_PRINT_AREAS,
  DEFAULT_SIZES
} from "./constants.js";
import { resolvePlaceholderByProductType, buildCatalogTags, resolveProductTypeTag } from "./tags.js";
import { buildProductHandle, stripTemplatePrefix, slugify } from "./slugs.js";

function clone(value) {
  return structuredClone(value);
}

function buildId(prefix, input) {
  const digest = crypto.createHash("sha1").update(String(input || "")).digest("hex").slice(0, 10);
  return `${prefix}_${digest}`;
}

function getTemplateSizes(template, productType) {
  const sizes = Array.isArray(template?.sizes) ? template.sizes.filter(Boolean) : [];
  if (sizes.length) return sizes.slice(0, 6);
  return productType === "Accessories" ? ACCESSORY_SIZES : DEFAULT_SIZES;
}

function getTemplateColours(template) {
  const colours = Array.isArray(template?.colours) ? template.colours.filter(Boolean) : [];
  return (colours.length ? colours : DEFAULT_COLOURS).slice(0, 4);
}

function buildDefaultViewAssets(productType) {
  const assetUrl = resolvePlaceholderByProductType(productType);
  return [
    {
      id: buildId("view", `${productType}:front`),
      viewId: "front",
      assetType: "base",
      colourName: null,
      assetUrl,
      outputWidth: 1400,
      outputHeight: 1400
    }
  ];
}

export function buildSeedTemplates(snapshotProducts) {
  return (Array.isArray(snapshotProducts) ? snapshotProducts : []).map((product, index) => {
    const productType = resolveProductTypeTag({
      title: product?.title,
      tags: product?.tags
    });
    const title = stripTemplatePrefix(product?.title);

    return {
      id: String(product?.id ?? buildId("template", title)),
      sourceId: product?.id ?? null,
      title,
      rawTitle: product?.title || title,
      handle: product?.handle || slugify(title),
      bodyHtml: `${title} template ready for automated product generation.`,
      vendor: "Good Game Apparel",
      productType,
      tags: buildCatalogTags({ title, tags: product?.tags }),
      options: Array.isArray(product?.options) ? clone(product.options) : [],
      sizes: getTemplateSizes(product, productType),
      colours: getTemplateColours(product),
      images: Array.isArray(product?.images) ? clone(product.images) : [],
      printAreas: [clone(DEFAULT_PRINT_AREAS[productType] || DEFAULT_PRINT_AREAS["T-Shirts"])],
      viewAssets: buildDefaultViewAssets(productType),
      hidden: false,
      sizeOptionHidden: productType === "Accessories",
      displayOrder: index,
      priceConfig: {
        defaultPriceGbp:
          Number(
            Array.isArray(product?.variants) && product.variants[0]?.price ? product.variants[0].price : null
          ) || (productType === "Accessories" ? 16.99 : productType === "Hoodies" ? 34.99 : 24.99)
      },
      variants: (Array.isArray(product?.variants) ? product.variants : []).slice(0, 24).map((variant) => ({
        id: String(variant?.id ?? buildId("variant", `${title}:${variant?.title}`)),
        title: variant?.title || "",
        sku: variant?.sku || "",
        price: Number(variant?.price || 0) || null,
        options: clone(variant?.options || {})
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

export function buildSeedGeneratedProducts(templates, designs) {
  const createdProducts = [];
  const selectedTemplates = [];
  const typeSeen = new Set();

  for (const template of templates) {
    if (!typeSeen.has(template.productType)) {
      selectedTemplates.push(template);
      typeSeen.add(template.productType);
    }
    if (selectedTemplates.length >= 4) break;
  }

  const baseDate = Date.parse("2026-04-04T09:00:00.000Z");
  let offset = 0;

  for (const design of designs.slice(0, 3)) {
    for (const template of selectedTemplates) {
      const handle = buildProductHandle(design.displayName, template.title);
      const colourOptions = getTemplateColours(template);
      const sizeOptions = getTemplateSizes(template, template.productType);
      const primaryImage = resolvePlaceholderByProductType(template.productType);
      const variants = [];
      const images = [];

      for (const colour of colourOptions) {
        images.push({
          id: buildId("image", `${handle}:${colour}:front`),
          colourName: colour,
          viewId: "front",
          imageUrl: primaryImage,
          isPrimary: images.length === 0,
          sortOrder: images.length
        });

        for (const size of sizeOptions) {
          variants.push({
            id: buildId("product_variant", `${handle}:${colour}:${size}`),
            colourName: colour,
            sizeName: size,
            sku: `${slugify(template.title).toUpperCase()}-${slugify(design.displayName).toUpperCase()}-${slugify(
              `${colour}-${size}`
            ).toUpperCase()}`,
            priceGbp: Number(template?.priceConfig?.defaultPriceGbp || 24.99),
            imageUrl: primaryImage
          });
        }
      }

      createdProducts.push({
        id: buildId("product", handle),
        handle,
        title: `${design.displayName} | ${template.title}`,
        description: `${design.displayName} applied to ${template.title} using the standalone product-gen render pipeline.`,
        templateProductId: template.id,
        designAssetId: design.id,
        tags: Array.from(new Set([...template.tags, template.productType])),
        priceGbp: Number(template?.priceConfig?.defaultPriceGbp || 24.99),
        status: "published",
        heroImageUrl: primaryImage,
        variants,
        images,
        artworkState: {
          designAssetId: design.id,
          artworkBox: template.printAreas[0],
          sourceFileUrl: design.sourceUrl || null,
          artworkFileId: design.id,
          artworkFileUrl: design.sourceUrl || null
        },
        createdAt: new Date(baseDate + offset * 3600 * 1000).toISOString(),
        updatedAt: new Date(baseDate + offset * 3600 * 1000).toISOString()
      });

      offset += 1;
    }
  }

  return createdProducts;
}
