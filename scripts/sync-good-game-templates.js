import "dotenv/config";

import { closeProductGenPool, syncGoodGameTemplates } from "../lib/good-game-templates.js";

const dryRun = !process.argv.includes("--apply");
const keepExisting = process.argv.includes("--keep-existing");

try {
  const summary = await syncGoodGameTemplates({ dryRun, keepExisting });
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await closeProductGenPool();
}
