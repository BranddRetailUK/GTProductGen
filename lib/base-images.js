import crypto from "node:crypto";

import { v2 as cloudinary } from "cloudinary";

import { getServiceState, updateServiceState } from "./store.js";
import { buildSeedTemplates } from "./seed-catalog.js";
import { loadTemplateSnapshot } from "./snapshots.js";

const DEFAULT_BASE_FOLDER = "template_product_images";
const SYNC_SOURCE = "cloudinary_base";
const VIEW_IDS = ["front", "back"];
const TEMPLATE_RESOURCE_FOLDERS = {
  "10085551997255": {
    front: "hoodie_fronts",
    back: "hoodie_backs"
  }
};

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeToken(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

function searchableName(resource) {
  return [resource?.public_id, resource?.display_name, resource?.asset_folder]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasDelimitedToken(value, token) {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(value);
}

function colourAliases(colourName) {
  const normalized = normalizeToken(colourName);
  const aliases = new Set([normalized]);

  if (normalized.startsWith("new")) aliases.add(normalized.replace(/^new/, ""));
  if (normalized === "arcticwhite") aliases.add("white");
  if (normalized === "newfrenchnavy") {
    aliases.add("frenchnavy");
    aliases.add("navy");
  }
  if (normalized === "royalblue") {
    aliases.add("brightroyal");
    aliases.add("royal");
  }
  if (normalized === "brightroyal") aliases.add("royal");

  return Array.from(aliases).filter(Boolean);
}

function resourceViewId(resource) {
  const name = searchableName(resource);
  if (hasDelimitedToken(name, "back") || name.includes("-back_") || name.includes("_back_")) {
    return "back";
  }
  return "front";
}

function uniqueSkus(template) {
  return Array.from(
    new Set(
      (Array.isArray(template?.variants) ? template.variants : [])
        .map((variant) => normalizeToken(variant?.sku))
        .filter(Boolean)
    )
  );
}

function getColours(template) {
  const colours = Array.isArray(template?.colours) ? template.colours.filter(Boolean) : [];
  return colours.length ? colours : ["Default"];
}

function scoreResource(resource, { aliases, sku, viewId }) {
  const rawName = searchableName(resource);
  const normalizedName = normalizeToken(rawName);
  if (!normalizedName.includes(sku)) return -1;

  const isBack = resourceViewId(resource) === "back";
  if (viewId === "front" && isBack) return -1;
  if (viewId === "back" && !isBack) return -1;

  let matchedColour = aliases.length === 0;
  let score = 100;

  for (const alias of aliases) {
    if (normalizedName.includes(alias)) {
      matchedColour = true;
      score += 30;
    }
    if (hasDelimitedToken(rawName, alias)) {
      score += 20;
    }
  }

  if (!matchedColour) return -1;

  if (viewId === "front" && /(^|[^a-z0-9])(front|ft|ft2|lb)($|[^a-z0-9])/i.test(rawName)) {
    score += 25;
  }
  if (viewId === "back") {
    score += 25;
  }

  if (/sleeve|side|detail/i.test(rawName)) score -= 25;

  return score - rawName.length / 1000;
}

function templateResourceFolders(template) {
  const byId = TEMPLATE_RESOURCE_FOLDERS[String(template?.id || "")];
  if (byId) return byId;
  return null;
}

function resourcePublicId(resource) {
  return clean(resource?.public_id).toLowerCase();
}

function resourceLeafName(resource) {
  const publicIdLeaf = resourcePublicId(resource).split("/").pop() || "";
  return normalizeToken(resource?.display_name || publicIdLeaf);
}

function scoreFolderResource(resource, { aliases, folder }) {
  const publicId = resourcePublicId(resource);
  if (!publicId.startsWith(`${String(folder || "").toLowerCase()}/`)) return -1;

  const leafName = resourceLeafName(resource);
  let score = 100;
  for (const alias of aliases) {
    if (leafName === alias) return score + 50;
    if (leafName.includes(alias) || alias.includes(leafName)) score += 20;
  }

  return score > 100 ? score - publicId.length / 1000 : -1;
}

function pickResource(resources, params) {
  return resources
    .map((resource) => ({
      resource,
      score: scoreResource(resource, params)
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.resource || null;
}

function pickFolderResource(resources, params) {
  return resources
    .map((resource) => ({
      resource,
      score: scoreFolderResource(resource, params)
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.resource || null;
}

function buildAssetId(templateId, viewId, colourName, publicId) {
  return `view_${crypto
    .createHash("sha1")
    .update(`${templateId}:${viewId}:${colourName}:${publicId}`)
    .digest("hex")
    .slice(0, 12)}`;
}

function buildViewAssets(template, resources) {
  const skus = uniqueSkus(template);
  const foldersByViewId = templateResourceFolders(template);
  if (!skus.length && !foldersByViewId) return [];

  const assets = [];
  for (const colourName of getColours(template)) {
    const aliases = colourName === "Default" ? [] : colourAliases(colourName);

    for (const viewId of VIEW_IDS) {
      let match = skus
        .map((sku) => pickResource(resources, { aliases, sku, viewId }))
        .filter(Boolean)[0];
      if (!match && foldersByViewId?.[viewId] && aliases.length) {
        match = pickFolderResource(resources, { aliases, folder: foldersByViewId[viewId] });
      }

      if (!match?.secure_url) continue;

      assets.push({
        id: buildAssetId(template.id, viewId, colourName, match.public_id),
        viewId,
        assetType: "base",
        colourName: colourName === "Default" ? null : colourName,
        assetUrl: match.secure_url,
        outputWidth: match.width || null,
        outputHeight: match.height || null,
        source: SYNC_SOURCE,
        sourcePublicId: match.public_id
      });
    }
  }

  return assets;
}

function mergeCatalogTemplate(template, catalogTemplate) {
  if (!catalogTemplate) return template;

  return {
    ...template,
    sourceId: catalogTemplate.sourceId,
    title: catalogTemplate.title,
    rawTitle: catalogTemplate.rawTitle,
    handle: catalogTemplate.handle,
    bodyHtml: catalogTemplate.bodyHtml,
    vendor: catalogTemplate.vendor,
    productType: catalogTemplate.productType,
    tags: catalogTemplate.tags,
    options: catalogTemplate.options,
    sizes: catalogTemplate.sizes,
    colours: catalogTemplate.colours,
    images: catalogTemplate.images,
    sizeOptionHidden: catalogTemplate.sizeOptionHidden,
    displayOrder: catalogTemplate.displayOrder,
    priceConfig: catalogTemplate.priceConfig,
    variants: catalogTemplate.variants,
    printAreas: Array.isArray(template?.printAreas) && template.printAreas.length ? template.printAreas : catalogTemplate.printAreas,
    viewAssets: Array.isArray(template?.viewAssets) && template.viewAssets.length ? template.viewAssets : catalogTemplate.viewAssets
  };
}

export function getBaseCloudinaryConfig() {
  return {
    cloudName: clean(process.env.CLOUDINARY_BASE_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME),
    apiKey: clean(process.env.CLOUDINARY_BASE_API_KEY || process.env.CLOUDINARY_API_KEY),
    apiSecret: clean(process.env.CLOUDINARY_BASE_API_SECRET || process.env.CLOUDINARY_API_SECRET),
    folder: clean(process.env.CLOUDINARY_BASE_FOLDER) || DEFAULT_BASE_FOLDER
  };
}

export function hasBaseCloudinaryConfig() {
  const config = getBaseCloudinaryConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function configureBaseCloudinary() {
  const config = getBaseCloudinaryConfig();
  if (!hasBaseCloudinaryConfig()) {
    throw new Error("missing_cloudinary_base_credentials");
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  });

  return config;
}

export async function listBaseImageResources() {
  const config = configureBaseCloudinary();
  const resources = [];
  let nextCursor = null;

  do {
    const response = await cloudinary.api.resources_by_asset_folder(config.folder, {
      max_results: 500,
      next_cursor: nextCursor || undefined,
      fields: "public_id,asset_folder,display_name,secure_url,width,height,format"
    });

    resources.push(...(Array.isArray(response?.resources) ? response.resources : []));
    nextCursor = response?.next_cursor || null;
  } while (nextCursor);

  return {
    folder: config.folder,
    resources
  };
}

export async function syncBaseProductImages({ dryRun = true, pruneUnmatched = true } = {}) {
  const [{ folder, resources }, state, snapshotProducts] = await Promise.all([
    listBaseImageResources(),
    getServiceState(),
    loadTemplateSnapshot()
  ]);
  const catalogTemplates = buildSeedTemplates(snapshotProducts);
  const catalogById = new Map(catalogTemplates.map((template) => [String(template.id), template]));
  const matches = [];
  const unmatched = [];

  for (const template of state.templates || []) {
    const catalogTemplate = catalogById.get(String(template.id));
    const reconciledTemplate = mergeCatalogTemplate(template, catalogTemplate);
    const viewAssets = buildViewAssets(reconciledTemplate, resources);
    if (!viewAssets.length) {
      unmatched.push({
        templateId: template.id,
        title: reconciledTemplate.title || template.title
      });
      continue;
    }
    matches.push({
      templateId: template.id,
      title: reconciledTemplate.title,
      matchedAssets: viewAssets.length,
      catalogTemplate: reconciledTemplate,
      viewAssets
    });
  }

  if (!dryRun) {
    const matchesById = new Map(matches.map((match) => [String(match.templateId), match]));
    await updateServiceState((draft) => {
      for (const template of draft.templates || []) {
        const match = matchesById.get(String(template.id));
        const catalogTemplate = catalogById.get(String(template.id));
        Object.assign(template, mergeCatalogTemplate(template, catalogTemplate));

        if (!match) {
          if (pruneUnmatched) {
            template.hidden = true;
            template.updatedAt = new Date().toISOString();
          }
          continue;
        }

        const existing = (Array.isArray(template.viewAssets) ? template.viewAssets : []).filter(
          (asset) => asset?.source !== SYNC_SOURCE && !String(asset?.assetUrl || "").includes("/mock/")
        );
        template.viewAssets = [...existing, ...match.viewAssets];
        template.hidden = false;
        template.updatedAt = new Date().toISOString();
      }
    });
  }

  return {
    dryRun,
    folder,
    scannedResources: resources.length,
    matchedTemplates: matches.length,
    matchedAssets: matches.reduce((total, match) => total + match.matchedAssets, 0),
    unmatchedTemplates: unmatched.length,
    prunedTemplates: pruneUnmatched ? unmatched.length : 0,
    matches
  };
}
