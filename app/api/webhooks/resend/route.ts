import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { emails, campaigns, prospects } from "@/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
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

async function handleEmailOpen(resendId: string) {
  try {
    await db
      .update(emails)
      .set({
        openCount: sql`${emails.openCount} + 1`,
        openedAt: emails.openedAt ?? new Date(),
        status: "opened",
      })
      .where(eq(emails.resendId, resendId));
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
      .select({
        id: emails.id,
        prospectId: emails.prospectId,
        campaignId: emails.campaignId,
        replyAlertedAt: emails.replyAlertedAt,
      })
      .from(emails)
      .where(eq(emails.resendId, resendId))
      .limit(1);

    if (!email || email.replyAlertedAt) return;

    await db
      .update(prospects)
      .set({ status: "replied", updatedAt: new Date() })
      .where(
        and(
          eq(prospects.id, email.prospectId),
          inArray(prospects.status, ["new", "contacted"])
        )
      );

    await db
      .update(campaigns)
      .set({ repliedCount: sql`${campaigns.repliedCount} + 1` })
      .where(eq(campaigns.id, email.campaignId));

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
