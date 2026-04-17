import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { emails, campaigns } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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

    // Find the email by resend_id (stored in email tags or email_id)
    // Resend sends events with the email ID we got when sending
    const emailId = data.email_id;
    if (!emailId) {
      return Response.json({ received: true });
    }

    // Note: We need to find by resendId, not by our internal id
    // For now, we'll process the event type
    console.log(`Resend webhook: ${type} for email ${emailId}`);

    switch (type) {
      case "email.delivered":
        // Update email status
        break;
      case "email.opened":
        // Increment open count and update openedAt
        await handleEmailOpen(emailId);
        break;
      case "email.clicked":
        // Increment click count and update clickedAt
        await handleEmailClick(emailId);
        break;
      case "email.bounced":
        // Mark as bounced
        await handleEmailBounce(emailId);
        break;
      case "email.replied":
        // Mark as replied
        await handleEmailReply(emailId);
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
  } catch (err) {
    console.error("Failed to handle email reply:", err);
  }
}
