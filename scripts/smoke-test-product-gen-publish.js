import "dotenv/config";

import { getPool } from "../lib/db.js";
import { createShopifyDraftForGeneratedProduct } from "../lib/shopify.js";
import { getServiceState } from "../lib/store.js";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function argValue(name) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? clean(entry.slice(prefix.length)) : "";
}

function smokeSuffix() {
  return `-smoke-${Date.now()}`;
}

function findSmokeProduct(state, requestedProductId) {
  if (requestedProductId) {
    return (state.products || []).find((product) => String(product.id) === String(requestedProductId));
  }

  return (
    (state.products || []).find((product) => String(product.title || "").includes("GG GOLD LOGO SMALL | Premium T-Shirt")) ||
    (state.products || []).find((product) => String(product.title || "").includes("Premium T-Shirt"))
  );
}

try {
  const productId = argValue("product-id");
  const state = await getServiceState();
  const product = findSmokeProduct(state, productId);
  if (!product) throw new Error(productId ? `product_not_found:${productId}` : "premium_tshirt_product_not_found");

  const template = (state.templates || []).find((entry) => String(entry.id) === String(product.templateProductId));
  if (!template) throw new Error(`template_not_found:${product.templateProductId}`);

  const result = await createShopifyDraftForGeneratedProduct({
    product,
    template,
    handleSuffix: smokeSuffix(),
    titleSuffix: " [Smoke Test]"
  });

  console.log(
    JSON.stringify(
      {
        productId: product.id,
        productTitle: product.title,
        templateId: template.id,
        shopifyProductId: result.shopify.productId,
        shopifyHandle: result.shopify.handle,
        adminUrl: result.shopify.adminUrl,
        status: result.shopify.status,
        variants: result.shopify.variantCount,
        media: result.shopify.mediaCount,
        inventoryLocation: result.shopify.inventoryLocation,
        inventoryQuantity: result.shopify.inventoryQuantity,
        verification: result.shopify.variantVerification
      },
      null,
      2
    )
  );
} finally {
  await getPool()?.end();
}
