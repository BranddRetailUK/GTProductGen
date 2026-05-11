import "dotenv/config";

import { getPool } from "../lib/db.js";
import { syncBaseProductImages } from "../lib/base-images.js";

const dryRun = !process.argv.includes("--apply");

try {
  const summary = await syncBaseProductImages({ dryRun });
  console.log(
    JSON.stringify(
      {
        dryRun: summary.dryRun,
        folder: summary.folder,
        scannedResources: summary.scannedResources,
        matchedTemplates: summary.matchedTemplates,
        matchedAssets: summary.matchedAssets,
        templates: summary.matches.map((match) => ({
          templateId: match.templateId,
          title: match.title,
          matchedAssets: match.matchedAssets
        }))
      },
      null,
      2
    )
  );
} finally {
  await getPool()?.end();
}
