import "dotenv/config";

const SMOKE_TAG = "product-gen-smoke-test";
const ENFORCED_STATUS = "DRAFT";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function firstEnv(names) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

function normalizeShopDomain(value) {
  return clean(value)
    .replace(/^https?:\/\//i, "")
    .replace(/\/admin(?:\/.*)?$/i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function redactDomain(value) {
  const domain = normalizeShopDomain(value);
  if (!domain) return "";
  const [shop, ...rest] = domain.split(".");
  if (shop.length <= 4) return domain;
  return `${shop.slice(0, 2)}...${shop.slice(-2)}.${rest.join(".")}`;
}

function productAdminUrl(shopDomain, productId) {
  const numericId = String(productId || "").split("/").pop();
  return numericId ? `https://${shopDomain}/admin/products/${numericId}` : null;
}

async function shopifyGraphql({ shopDomain, apiVersion, accessToken, query, variables }) {
  const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
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

function summarizeProduct(product) {
  return {
    id: product?.id || null,
    title: product?.title || null,
    handle: product?.handle || null,
    status: product?.status || null,
    vendor: product?.vendor || null,
    productType: product?.productType || null,
    tags: product?.tags || [],
    variantCount: product?.variants?.nodes?.length || 0
  };
}

const PRODUCT_FIELDS = `
  id
  title
  handle
  status
  vendor
  productType
  tags
  createdAt
  updatedAt
  variants(first: 5) {
    nodes {
      id
      title
      sku
      price
    }
  }
`;

async function createDraftProduct({ shopDomain, apiVersion, accessToken, product }) {
  const data = await shopifyGraphql({
    shopDomain,
    apiVersion,
    accessToken,
    query: `
      mutation ProductGenSmokeCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            ${PRODUCT_FIELDS}
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: { product }
  });

  assertNoUserErrors("product_create", data.productCreate?.userErrors);
  return data.productCreate?.product || null;
}

async function readProduct({ shopDomain, apiVersion, accessToken, productId }) {
  const data = await shopifyGraphql({
    shopDomain,
    apiVersion,
    accessToken,
    query: `
      query ProductGenSmokeRead($id: ID!) {
        product(id: $id) {
          ${PRODUCT_FIELDS}
        }
      }
    `,
    variables: { id: productId }
  });

  if (!data.product) {
    throw new Error("product_read_not_found");
  }

  return data.product;
}

async function setProductDraft({ shopDomain, apiVersion, accessToken, productId, tags }) {
  const data = await shopifyGraphql({
    shopDomain,
    apiVersion,
    accessToken,
    query: `
      mutation ProductGenSmokeSetDraft($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            ${PRODUCT_FIELDS}
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    variables: {
      product: {
        id: productId,
        status: ENFORCED_STATUS,
        tags: Array.from(new Set([...(Array.isArray(tags) ? tags : []), "product-gen-draft-confirmed"]))
      }
    }
  });

  assertNoUserErrors("product_update", data.productUpdate?.userErrors);
  return data.productUpdate?.product || null;
}

async function main() {
  const shopDomain = normalizeShopDomain(firstEnv(["SHOPIFY_STORE_DOMAIN", "SHOP_DOMAIN", "SHOPIFY_SHOP_DOMAIN"]));
  const accessToken = firstEnv(["SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_ACCESS_TOKEN"]);
  const apiVersion = firstEnv(["SHOPIFY_API_VERSION", "SHOPIFY_ADMIN_API_VERSION"]) || "2026-04";
  const vendor = firstEnv(["SHOPIFY_DEFAULT_VENDOR"]) || "Good Game Apparel";
  const productType = firstEnv(["SHOPIFY_DEFAULT_PRODUCT_TYPE"]) || "Smoke Test";

  if (!shopDomain || !accessToken) {
    console.log("Missing Shopify connection values.");
    if (!shopDomain) console.log("Missing one of: SHOPIFY_STORE_DOMAIN, SHOP_DOMAIN, SHOPIFY_SHOP_DOMAIN");
    if (!accessToken) console.log("Missing one of: SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_ACCESS_TOKEN");
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const handle = `product-gen-smoke-test-${stamp}`;
  const productInput = {
    title: `Product Gen Smoke Test ${stamp}`,
    handle,
    descriptionHtml:
      "<p>Temporary draft product created by the Product Gen Shopify smoke test. Safe to delete after verification.</p>",
    vendor,
    productType,
    status: ENFORCED_STATUS,
    tags: ["product-gen", SMOKE_TAG, `smoke-${stamp}`]
  };

  console.log(`Creating draft Shopify smoke product on ${redactDomain(shopDomain)} @ ${apiVersion}`);

  const created = await createDraftProduct({
    shopDomain,
    apiVersion,
    accessToken,
    product: productInput
  });
  if (!created?.id) {
    throw new Error("product_create_missing_id");
  }
  console.log("Created:", summarizeProduct(created));

  const readBack = await readProduct({
    shopDomain,
    apiVersion,
    accessToken,
    productId: created.id
  });
  console.log("Read back:", summarizeProduct(readBack));

  const drafted = await setProductDraft({
    shopDomain,
    apiVersion,
    accessToken,
    productId: created.id,
    tags: readBack.tags
  });
  console.log("Draft enforced:", summarizeProduct(drafted));

  const finalProduct = await readProduct({
    shopDomain,
    apiVersion,
    accessToken,
    productId: created.id
  });

  if (finalProduct.status !== ENFORCED_STATUS) {
    throw new Error(`product_status_not_draft:${finalProduct.status}`);
  }

  console.log("Final read:", summarizeProduct(finalProduct));
  const adminUrl = productAdminUrl(shopDomain, finalProduct.id);
  if (adminUrl) {
    console.log(`Admin URL: ${adminUrl}`);
  }
  console.log("Shopify draft product smoke test passed.");
}

main().catch((error) => {
  const shopDomain = normalizeShopDomain(firstEnv(["SHOPIFY_STORE_DOMAIN", "SHOP_DOMAIN", "SHOPIFY_SHOP_DOMAIN"]));
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = shopDomain ? message.replaceAll(shopDomain, redactDomain(shopDomain)) : message;
  console.log(`Shopify draft product smoke test failed: ${safeMessage}`);
  process.exit(1);
});
