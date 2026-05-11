import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { getRun } from "../../../../../lib/catalog.js";

export async function GET(_request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = await getRun(params.id);
  if (!run) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ run });
}
