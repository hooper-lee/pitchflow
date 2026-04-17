import { NextRequest } from "next/server";
import { constructWebhookEvent } from "@/lib/integrations/stripe";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return Response.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = await constructWebhookEvent(body, signature);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const tenantId = session.metadata?.tenantId;
        if (tenantId && session.customer) {
          await db
            .update(tenants)
            .set({
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              plan: "pro",
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          const isActive = subscription.status === "active";
          await db
            .update(tenants)
            .set({
              plan: isActive ? "pro" : "free",
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
          await db
            .update(tenants)
            .set({
              plan: "free",
              stripeSubscriptionId: null,
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
