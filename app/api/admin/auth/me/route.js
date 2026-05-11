import { cookies } from "next/headers";

import { getAdminSession } from "../../../../../lib/auth.js";

export async function GET() {
  const session = getAdminSession(cookies());
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({
    authenticated: true,
    user: {
      email: session.sub
    }
  });
}
