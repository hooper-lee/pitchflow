import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export async function createCheckoutSession(
  tenantId: string,
  priceId: string,
  customerEmail?: string
) {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
    customer_email: customerEmail,
    metadata: { tenantId },
  });

  return session;
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return session;
}

export async function constructWebhookEvent(
  body: string | Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

  return stripe.webhooks.constructEvent(body, signature, secret);
}
