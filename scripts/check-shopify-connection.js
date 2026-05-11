import "dotenv/config";

const REQUIRED_SCOPES = ["write_products", "write_inventory"];
const RECOMMENDED_SCOPES = ["read_products", "read_inventory"];

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

async function shopifyGraphql({ shopDomain, apiVersion, accessToken, query }) {
  const response = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query })
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

function printScopeStatus(scopes) {
  const granted = new Set(scopes);
  const missingRequired = REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
  const missingRecommended = RECOMMENDED_SCOPES.filter((scope) => !granted.has(scope));

  console.log(`Granted scopes: ${scopes.length ? scopes.join(", ") : "none returned"}`);

  if (missingRequired.length) {
    console.log(`Missing required scopes: ${missingRequired.join(", ")}`);
  } else {
    console.log(`Required scopes OK: ${REQUIRED_SCOPES.join(", ")}`);
  }

  if (missingRecommended.length) {
    console.log(`Recommended for readback checks: ${missingRecommended.join(", ")}`);
  }

  const hasLocationId = Boolean(firstEnv(["SHOPIFY_LOCATION_ID", "SHOPIFY_INVENTORY_LOCATION_ID"]));
  if (!hasLocationId && !granted.has("read_locations")) {
    console.log("Recommended for automatic location lookup: read_locations");
  }

  return missingRequired.length === 0;
}

const shopDomain = normalizeShopDomain(firstEnv(["SHOPIFY_STORE_DOMAIN", "SHOP_DOMAIN", "SHOPIFY_SHOP_DOMAIN"]));
const accessToken = firstEnv(["SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_ACCESS_TOKEN"]);
const apiVersion = firstEnv(["SHOPIFY_API_VERSION", "SHOPIFY_ADMIN_API_VERSION"]) || "2026-04";

async function main() {
  if (!shopDomain || !accessToken) {
    console.log("Missing Shopify connection values.");
    if (!shopDomain) console.log("Missing one of: SHOPIFY_STORE_DOMAIN, SHOP_DOMAIN, SHOPIFY_SHOP_DOMAIN");
    if (!accessToken) console.log("Missing one of: SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_ACCESS_TOKEN");
    process.exit(1);
  }

  console.log(`Shopify Admin API probe: ${redactDomain(shopDomain)} @ ${apiVersion}`);

  const shopData = await shopifyGraphql({
    shopDomain,
    apiVersion,
    accessToken,
    query: `
      query ProductGenShopProbe {
        shop {
          name
          myshopifyDomain
          currencyCode
          primaryDomain {
            host
            url
          }
        }
      }
    `
  });

  console.log(`Connected shop: ${shopData.shop?.name || "unknown"} (${shopData.shop?.myshopifyDomain || shopDomain})`);
  console.log(`Currency: ${shopData.shop?.currencyCode || "unknown"}`);

  const scopeData = await shopifyGraphql({
    shopDomain,
    apiVersion,
    accessToken,
    query: `
      query ProductGenScopeProbe {
        appInstallation {
          accessScopes {
            handle
          }
        }
      }
    `
  });

  const scopes = (scopeData.appInstallation?.accessScopes || [])
    .map((scope) => scope?.handle)
    .filter(Boolean)
    .sort();

  if (!printScopeStatus(scopes)) {
    process.exit(1);
  }

  console.log("Shopify connection and required product creation scope are ready.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message.replaceAll(shopDomain, redactDomain(shopDomain));
  console.log(`Shopify probe failed: ${safeMessage}`);
  process.exit(1);
});
