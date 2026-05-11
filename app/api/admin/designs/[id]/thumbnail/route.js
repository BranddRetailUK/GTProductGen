import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../../lib/auth.js";
import { listDesignAssets } from "../../../../../../lib/catalog.js";
import { getDropboxThumbnail } from "../../../../../../lib/dropbox.js";

export async function GET(_request, { params }) {
  if (!getAdminSession(cookies())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const designs = await listDesignAssets();
  const design = designs.find((entry) => String(entry.id) === String(params.id));

  if (!design || design.source !== "dropbox" || !design.pathDisplay) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const thumbnail = await getDropboxThumbnail(design.pathDisplay);

  if (!thumbnail) {
    return Response.json({ error: "thumbnail_unavailable" }, { status: 404 });
  }

  return new Response(thumbnail.buffer, {
    headers: {
      "Content-Type": thumbnail.contentType,
      "Cache-Control": "private, max-age=300"
    }
  });
}
