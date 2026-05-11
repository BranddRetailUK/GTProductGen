import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../../lib/auth.js";
import { publishAdminProduct } from "../../../../../../lib/catalog.js";

export async function POST(_request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await publishAdminProduct(params.id);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "shopify_publish_failed" },
      { status: 400 }
    );
  }
}
