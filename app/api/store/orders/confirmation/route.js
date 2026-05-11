import { getCheckoutConfirmation } from "../../../../../lib/catalog.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return Response.json({ error: "session_id_required" }, { status: 400 });
  }

  const order = await getCheckoutConfirmation(sessionId);
  if (!order) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ order });
}
