import { readFile } from "node:fs/promises";

import { resolveProductGenPath } from "./paths.js";

const cache = new Map();

async function readJson(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const absolutePath = resolveProductGenPath(relativePath);
  const parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  cache.set(relativePath, parsed);
  return parsed;
}

export async function loadTemplateSnapshot() {
  const snapshot = await readJson("db/seeds/template-products.snapshot.json");
  return Array.isArray(snapshot?.products) ? snapshot.products : [];
}

export async function loadShopCollectionsSeed() {
  return readJson("db/seeds/shop-collections.json");
}

export async function loadDesignAssetsSeed() {
  return readJson("db/seeds/design-assets.seed.json");
}
