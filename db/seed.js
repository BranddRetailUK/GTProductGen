import { ensureProductGenSchema } from "../lib/db.js";
import { getServiceState } from "../lib/store.js";

await ensureProductGenSchema();
const state = await getServiceState();

console.log(
  `[product-gen] level=info action=seed_complete templates=${state.templates.length} designs=${state.designs.length} products=${state.products.length}`
);
