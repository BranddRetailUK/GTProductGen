import { hasDatabase, loadStateValue, saveStateValue } from "./db.js";
import { loadDesignAssetsSeed, loadTemplateSnapshot } from "./snapshots.js";
import { buildSeedGeneratedProducts, buildSeedTemplates } from "./seed-catalog.js";

const STORE_KEY = Symbol.for("product-gen.state-cache");

function clone(value) {
  return structuredClone(value);
}

async function buildInitialState() {
  const [snapshotProducts, designSeed] = await Promise.all([
    loadTemplateSnapshot(),
    loadDesignAssetsSeed()
  ]);

  const templates = buildSeedTemplates(snapshotProducts);
  const designs = Array.isArray(designSeed) ? clone(designSeed) : [];
  const products = buildSeedGeneratedProducts(templates, designs);

  return {
    templates,
    designs,
    runs: [],
    products
  };
}

export async function getServiceState() {
  if (globalThis[STORE_KEY]) return globalThis[STORE_KEY];

  if (hasDatabase()) {
    const saved = await loadStateValue("service_state");
    if (saved && typeof saved === "object") {
      globalThis[STORE_KEY] = saved;
      return globalThis[STORE_KEY];
    }
  }

  const initialState = await buildInitialState();
  globalThis[STORE_KEY] = initialState;

  if (hasDatabase()) {
    await saveStateValue("service_state", initialState);
  }

  return globalThis[STORE_KEY];
}

export async function updateServiceState(mutator) {
  const currentState = clone(await getServiceState());
  const result = await mutator(currentState);
  globalThis[STORE_KEY] = currentState;
  if (hasDatabase()) {
    await saveStateValue("service_state", currentState);
  }
  return {
    state: currentState,
    result
  };
}
