import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { updateAdminProduct } from "../../../../../lib/catalog.js";

export async function PATCH(request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const product = await updateAdminProduct(params.id, body);
  if (!product) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json({ product });
}
