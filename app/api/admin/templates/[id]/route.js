import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { getTemplate, updateTemplate } from "../../../../../lib/catalog.js";

export async function GET(_request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const template = await getTemplate(params.id);
  if (!template) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ template });
}

export async function PATCH(request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const template = await updateTemplate(params.id, body);
  if (!template) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ template });
}
