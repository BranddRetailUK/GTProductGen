import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";
import { rescanDesignLibrary } from "../../../../../lib/catalog.js";

export async function POST() {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return Response.json({
      designs: await rescanDesignLibrary()
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "dropbox_rescan_failed"
      },
      { status: 502 }
    );
  }
}
