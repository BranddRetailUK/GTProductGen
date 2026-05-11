import { cookies } from "next/headers";

import { getAdminSession } from "../../../../lib/auth.js";
import { listDesignAssets } from "../../../../lib/catalog.js";

export async function GET() {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    designs: await listDesignAssets()
  });
}
