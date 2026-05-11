import { recordCompletedCheckout, getStripeClient } from "../../../../lib/stripe.js";

export async function POST(request) {
  const rawBody = await request.text();
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  let event = null;

  if (stripe && process.env.STRIPE_WEBHOOK_SECRET && signature) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return Response.json({ error: "invalid_signature" }, { status: 400 });
    }
  } else {
    event = JSON.parse(rawBody || "{}");
  }

  if (event?.type === "checkout.session.completed") {
    const session = event.data?.object || {};
    await recordCompletedCheckout({
      sessionId: session.id,
      email: session.customer_details?.email || session.customer_email || null,
      amountTotal: Number(session.amount_total || 0) / 100,
      lineItems: [],
      shippingAddress: session.customer_details?.address || {}
    });
  }

  return Response.json({ received: true });
}
