import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { emails, campaigns, tenants } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { processAlert } from "@/lib/services/alert.service";

// Resend webhook events
interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    created_at: string;
    to: string[];
    from: string;
    subject: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ResendWebhookEvent = await request.json();
    const { type, data } = body;

    const resendId = data.email_id;
    if (!resendId) {
      return Response.json({ received: true });
    }

    console.log(`Resend webhook: ${type} for email ${resendId}`);

    switch (type) {
      case "email.delivered":
        await db
          .update(emails)
          .set({ status: "delivered" })
          .where(eq(emails.resendId, resendId));
        break;
      case "email.opened":
        await handleEmailOpen(resendId);
        break;
      case "email.clicked":
        await handleEmailClick(resendId);
        break;
      case "email.bounced":
        await handleEmailBounce(resendId);
        break;
      case "email.replied":
        await handleEmailReply(resendId);
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Resend webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function getOpenThreshold(emailInternalId: string): Promise<number> {
  try {
    const [email] = await db
      .select({ campaignId: emails.campaignId })
      .from(emails)
      .where(eq(emails.id, emailInternalId))
      .limit(1);
    if (!email) return 3;

    const [campaign] = await db
      .select({ tenantId: campaigns.tenantId })
      .from(campaigns)
      .where(eq(campaigns.id, email.campaignId))
      .limit(1);
    if (!campaign) return 3;

    const [tenant] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, campaign.tenantId))
      .limit(1);
    if (!tenant) return 3;

    const settings = (tenant.settings as Record<string, unknown>) || {};
    const alerts = (settings.alerts as Record<string, unknown>) || {};
    return (alerts.openThreshold as number) || 3;
  } catch {
    return 3;
  }
}

async function handleEmailOpen(resendId: string) {
  try {
    // Increment open count
    await db
      .update(emails)
      .set({
        openCount: sql`${emails.openCount} + 1`,
        openedAt: emails.openedAt ?? new Date(),
        status: "opened",
      })
      .where(eq(emails.resendId, resendId));

    // Check if should trigger high-intent alert
    const [email] = await db
      .select({ id: emails.id, openCount: emails.openCount, highIntentAlertedAt: emails.highIntentAlertedAt })
      .from(emails)
      .where(eq(emails.resendId, resendId))
      .limit(1);

    if (!email || email.highIntentAlertedAt) return;

    const threshold = await getOpenThreshold(email.id);
    const currentCount = (email.openCount || 0) + 1; // +1 because the update above just happened

    if (currentCount >= threshold) {
      await db
        .update(emails)
        .set({ highIntentAlertedAt: new Date() })
        .where(eq(emails.id, email.id));

      processAlert(email.id, {
        type: "high_intent",
        emailId: email.id,
        openCount: currentCount,
      }).catch((err) => console.error("Alert dispatch failed:", err));
    }
  } catch (err) {
    console.error("Failed to handle email open:", err);
  }
}

async function handleEmailClick(resendId: string) {
  try {
    await db
      .update(emails)
      .set({
        clickCount: sql`${emails.clickCount} + 1`,
        clickedAt: emails.clickedAt ?? new Date(),
        status: "clicked",
      })
      .where(eq(emails.resendId, resendId));

    // Trigger click alert (once per email)
    const [email] = await db
      .select({ id: emails.id, clickCount: emails.clickCount, clickAlertedAt: emails.clickAlertedAt })
      .from(emails)
      .where(eq(emails.resendId, resendId))
      .limit(1);

    if (!email || email.clickAlertedAt) return;

    await db
      .update(emails)
      .set({ clickAlertedAt: new Date() })
      .where(eq(emails.id, email.id));

    processAlert(email.id, {
      type: "clicked",
      emailId: email.id,
      clickCount: (email.clickCount || 0) + 1,
    }).catch((err) => console.error("Alert dispatch failed:", err));
  } catch (err) {
    console.error("Failed to handle email click:", err);
  }
}

async function handleEmailBounce(resendId: string) {
  try {
    await db
      .update(emails)
      .set({
        status: "bounced",
        bouncedAt: new Date(),
      })
      .where(eq(emails.resendId, resendId));
  } catch (err) {
    console.error("Failed to handle email bounce:", err);
  }
}

async function handleEmailReply(resendId: string) {
  try {
    await db
      .update(emails)
      .set({
        status: "replied",
        repliedAt: new Date(),
      })
      .where(eq(emails.resendId, resendId));

    // Trigger reply alert (once per email)
    const [email] = await db
      .select({ id: emails.id, replyAlertedAt: emails.replyAlertedAt })
      .from(emails)
      .where(eq(emails.resendId, resendId))
      .limit(1);

    if (!email || email.replyAlertedAt) return;

    await db
      .update(emails)
      .set({ replyAlertedAt: new Date() })
      .where(eq(emails.id, email.id));

    processAlert(email.id, {
      type: "replied",
      emailId: email.id,
    }).catch((err) => console.error("Alert dispatch failed:", err));
  } catch (err) {
    console.error("Failed to handle email reply:", err);
  }
}
