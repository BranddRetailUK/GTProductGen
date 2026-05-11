import { cookies } from "next/headers";

import { getAdminSession } from "../../../../lib/auth.js";
import { RUN_MODE_SINGLE } from "../../../../lib/constants.js";
import { createRun, listRuns } from "../../../../lib/catalog.js";
import { enqueueGenerationRun } from "../../../../server/runtime.js";

export async function GET() {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    runs: await listRuns()
  });
}

export async function POST(request) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.mode === RUN_MODE_SINGLE && !body?.designIds?.length) {
    return Response.json({ error: "design_selection_required" }, { status: 400 });
  }
  const run = await createRun(body);
  if (!run?.templateIds?.length) {
    return Response.json({ error: "template_selection_required" }, { status: 400 });
  }
  await enqueueGenerationRun(run.id);
  return Response.json({ run });
}
