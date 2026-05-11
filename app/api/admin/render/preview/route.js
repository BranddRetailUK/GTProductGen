import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { listDesignAssets, getTemplate } from "../../../../../lib/catalog.js";
import { renderTemplatePreview } from "../../../../../lib/render/engine.js";

export async function POST(request) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const template = await getTemplate(body.templateId);
  const designs = await listDesignAssets();
  const design = designs.find((entry) => String(entry.id) === String(body.designId));

  if (!template || !design) {
    return Response.json({ error: "missing_template_or_design" }, { status: 400 });
  }

  const preview = await renderTemplatePreview({
    template,
    design,
    colourName: body.colourName || template.colours?.[0]
  });

  return Response.json({ preview });
}
