import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { updateShopCollection } from "../../../../../lib/catalog.js";

export async function PATCH(request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const collection = await updateShopCollection(params.id, body);
  if (!collection) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ collection });
}
