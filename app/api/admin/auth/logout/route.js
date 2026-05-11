import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAdminSessionOptions } from "../../../../../lib/auth.js";

export async function POST() {
  cookies().set(clearAdminSessionOptions());
  return NextResponse.redirect(new URL("/admin/templates", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}
