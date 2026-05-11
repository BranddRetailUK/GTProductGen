import { createCheckoutSession } from "../../../../../lib/stripe.js";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!items.length) {
    return Response.json({ error: "cart_empty" }, { status: 400 });
  }

  try {
    const session = await createCheckoutSession({
      email: body?.email || null,
      items
    });

    return Response.json(session);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "checkout_failed" },
      { status: 400 }
    );
  }
}
