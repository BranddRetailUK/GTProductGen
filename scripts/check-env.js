import "dotenv/config";

const OPTIONAL_VARS = [
  "DATABASE_SSL",
  "SHOPIFY_DEFAULT_VENDOR",
  "SHOPIFY_DEFAULT_PRODUCT_TYPE",
  "SHOPIFY_LOCATION_ID",
  "SHOPIFY_LOCATION_NAME"
];

const DEFAULTED_VARS = {
  SHOPIFY_PRODUCT_STATUS: "draft",
  SHOPIFY_DEFAULT_INVENTORY_QUANTITY: "99"
};

const ALIASES = {
  SHOPIFY_STORE_DOMAIN: ["SHOP_DOMAIN", "SHOPIFY_SHOP_DOMAIN"],
  SHOPIFY_ADMIN_ACCESS_TOKEN: ["SHOPIFY_ACCESS_TOKEN"],
  SHOPIFY_API_VERSION: ["SHOPIFY_ADMIN_API_VERSION"]
};

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function hasVar(name) {
  return Boolean(clean(process.env[name]));
}

function hasConfiguredVar(name) {
  if (hasVar(name)) return true;
  return (ALIASES[name] || []).some((alias) => hasVar(alias));
}

function missingRequired(names) {
  return names.filter((name) => !hasConfiguredVar(name));
}

function firstSatisfiedGroup(groups) {
  return groups.find((group) => missingRequired(group).length === 0) || null;
}

function printStatus(label, status, details = []) {
  const suffix = details.length ? ` (${details.join(", ")})` : "";
  console.log(`${status} ${label}${suffix}`);
}

const checks = [
  {
    label: "Core runtime",
    required: [
      "DATABASE_URL",
      "NEXT_PUBLIC_SITE_URL",
      "PRODUCT_GEN_ADMIN_EMAIL",
      "PRODUCT_GEN_ADMIN_PASSWORD",
      "PRODUCT_GEN_SESSION_SECRET"
    ]
  },
  {
    label: "Cloudinary rendered image output",
    required: ["CLOUDINARY_URL", "CLOUDINARY_UPLOAD_FOLDER"]
  },
  {
    label: "Cloudinary base product image source",
    required: ["CLOUDINARY_BASE_FOLDER"],
    alternatives: [
      ["CLOUDINARY_BASE_CLOUD_NAME", "CLOUDINARY_BASE_API_KEY", "CLOUDINARY_BASE_API_SECRET"],
      ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    ]
  },
  {
    label: "Dropbox artwork ingest",
    required: ["DROPBOX_ROOT_PATH"],
    alternatives: [
      ["DROPBOX_ACCESS_TOKEN"],
      ["DROPBOX_REFRESH_TOKEN", "DROPBOX_APP_KEY", "DROPBOX_APP_SECRET"]
    ]
  },
  {
    label: "Shopify Admin API publishing",
    required: [
      "SHOPIFY_STORE_DOMAIN",
      "SHOPIFY_ADMIN_ACCESS_TOKEN",
      "SHOPIFY_API_VERSION"
    ]
  }
];

let missingCount = 0;

for (const check of checks) {
  const missing = missingRequired(check.required || []);
  const satisfiedAlternative = check.alternatives ? firstSatisfiedGroup(check.alternatives) : true;

  if (!missing.length && satisfiedAlternative) {
    printStatus("OK", check.label);
    continue;
  }

  const missingAlternative =
    check.alternatives && !satisfiedAlternative
      ? check.alternatives.map((group) => `[${group.join(" + ")}]`).join(" or ")
      : null;
  const details = [...missing, missingAlternative ? `one of ${missingAlternative}` : null].filter(Boolean);
  missingCount += details.length;
  printStatus("MISSING", check.label, details);
}

const apiVersion = clean(process.env.SHOPIFY_API_VERSION || process.env.SHOPIFY_ADMIN_API_VERSION);
if (apiVersion && !/^\d{4}-\d{2}$/.test(apiVersion)) {
  missingCount += 1;
  printStatus("INVALID", "SHOPIFY_API_VERSION", ["expected YYYY-MM"]);
}

const productStatus = clean(process.env.SHOPIFY_PRODUCT_STATUS || DEFAULTED_VARS.SHOPIFY_PRODUCT_STATUS).toLowerCase();
if (productStatus && !["active", "archived", "draft"].includes(productStatus)) {
  missingCount += 1;
  printStatus("INVALID", "SHOPIFY_PRODUCT_STATUS", ["expected active, archived, or draft"]);
}

const unsetOptional = OPTIONAL_VARS.filter((name) => !hasVar(name));
if (unsetOptional.length) {
  printStatus("OPTIONAL", "Unset optional variables", unsetOptional);
}

const unsetDefaulted = Object.entries(DEFAULTED_VARS)
  .filter(([name]) => !hasConfiguredVar(name))
  .map(([name, value]) => `${name}=${value}`);
if (unsetDefaulted.length) {
  printStatus("DEFAULT", "Unset variables using safe defaults", unsetDefaulted);
}

if (missingCount > 0) {
  console.log("\nAdd missing values to .env locally and to Railway Variables before enabling Shopify publishing.");
  process.exit(1);
}

console.log("\nEnvironment is ready for the currently wired Product Gen runtime and Shopify publishing setup.");
