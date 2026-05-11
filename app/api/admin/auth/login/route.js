import { cookies } from "next/headers";

import {
  buildAdminSessionOptions,
  createAdminSession,
  validateAdminCredentials
} from "../../../../../lib/auth.js";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");

  if (!validateAdminCredentials(email, password)) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = createAdminSession(email);
  cookies().set(buildAdminSessionOptions(token));

  return Response.json({
    ok: true,
    user: {
      email
    }
  });
}
