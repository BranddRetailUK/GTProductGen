import "dotenv/config";

import { getPool } from "../lib/db.js";
import { syncBaseProductImages } from "../lib/base-images.js";

const dryRun = !process.argv.includes("--apply");
const pruneUnmatched = !process.argv.includes("--keep-unmatched");

try {
  const summary = await syncBaseProductImages({ dryRun, pruneUnmatched });
  console.log(
    JSON.stringify(
      {
        dryRun: summary.dryRun,
        pruneUnmatched,
        folder: summary.folder,
        scannedResources: summary.scannedResources,
        matchedTemplates: summary.matchedTemplates,
        matchedAssets: summary.matchedAssets,
        unmatchedTemplates: summary.unmatchedTemplates,
        prunedTemplates: summary.prunedTemplates,
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
