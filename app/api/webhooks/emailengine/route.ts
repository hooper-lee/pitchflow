import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, emailReplies, emails, prospects } from "@/lib/db/schema";
import { processAlert } from "@/lib/services/alert.service";
import {
  completeCampaignIfFinished,
} from "@/lib/services/followup.service";
import { getFollowupSettings } from "@/lib/services/config.service";

interface EmailEngineWebhookEvent {
  event: string;
  account?: string;
  date?: string;
  data?: {
    id?: string;
    messageId?: string;
    queueId?: string;
    originalMessageId?: string;
    inReplyTo?: string;
    references?: string[];
    path?: string;
    specialUse?: string;
    threadId?: string;
    subject?: string;
    from?: { name?: string; address?: string };
    text?: { plain?: string; html?: string };
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as EmailEngineWebhookEvent;

    switch (payload.event) {
      case "messageSent":
        await handleMessageSent(payload);
        break;
      case "messageFailed":
      case "messageBounce":
        await handleDeliveryFailure(payload);
        break;
      case "trackOpen":
        await handleTrackOpen(payload);
        break;
      case "trackClick":
        await handleTrackClick(payload);
        break;
      case "messageNew":
        await handleReply(payload);
        break;
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("EmailEngine webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handleMessageSent(payload: EmailEngineWebhookEvent) {
  const email = await findEmailByProviderIdentifiers(payload);
  if (!email) return;

  await db
    .update(emails)
    .set({
      status: "sent",
      providerMessageId: payload.data?.messageId || email.providerMessageId,
      sentAt: payload.date ? new Date(payload.date) : new Date(),
      threadId: payload.data?.threadId || email.threadId,
    })
    .where(eq(emails.id, email.id));
}

async function handleDeliveryFailure(payload: EmailEngineWebhookEvent) {
  const email = await findEmailByProviderIdentifiers(payload);
  if (!email) return;

  await db
    .update(emails)
    .set({
      status: payload.event === "messageBounce" ? "bounced" : "failed",
      bouncedAt: payload.event === "messageBounce" ? new Date(payload.date || Date.now()) : email.bouncedAt,
    })
    .where(eq(emails.id, email.id));
}

async function handleTrackOpen(payload: EmailEngineWebhookEvent) {
  const email = await findEmailByProviderIdentifiers(payload);
  if (!email) return;

  await db
    .update(emails)
    .set({
      openCount: sql`${emails.openCount} + 1`,
      openedAt: email.openedAt ?? new Date(payload.date || Date.now()),
      status: "opened",
    })
    .where(eq(emails.id, email.id));
}

async function handleTrackClick(payload: EmailEngineWebhookEvent) {
  const email = await findEmailByProviderIdentifiers(payload);
  if (!email) return;

  await db
    .update(emails)
    .set({
      clickCount: sql`${emails.clickCount} + 1`,
      clickedAt: email.clickedAt ?? new Date(payload.date || Date.now()),
      status: "clicked",
    })
    .where(eq(emails.id, email.id));
}

async function handleReply(payload: EmailEngineWebhookEvent) {
  const replyToMessageId = payload.data?.inReplyTo || payload.data?.references?.[0];
  if (!replyToMessageId) return;

  const [email] = await db
    .select()
    .from(emails)
    .where(
      inArray(emails.providerMessageId, [replyToMessageId, normalizeMessageId(replyToMessageId)])
    )
    .limit(1);

  if (!email || email.replyAlertedAt) return;

  await db
    .update(emails)
    .set({
      status: "replied",
      repliedAt: new Date(payload.date || Date.now()),
      replyAlertedAt: new Date(),
      threadId: payload.data?.threadId || email.threadId,
    })
    .where(eq(emails.id, email.id));

  await db
    .insert(emailReplies)
    .values({
      emailId: email.id,
      campaignId: email.campaignId,
      prospectId: email.prospectId,
      mailAccountId: email.mailAccountId,
      providerMessageId: payload.data?.messageId || null,
      threadId: payload.data?.threadId || null,
      fromEmail: payload.data?.from?.address || null,
      fromName: payload.data?.from?.name || null,
      subject: payload.data?.subject || null,
      textBody: payload.data?.text?.plain || null,
      htmlBody: payload.data?.text?.html || null,
      receivedAt: new Date(payload.date || Date.now()),
    });

  await db
    .update(prospects)
    .set({
      status: sql`CASE WHEN ${prospects.status} = 'following_up' THEN 'interested'::prospect_status ELSE 'replied'::prospect_status END`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(prospects.id, email.prospectId),
        inArray(prospects.status, ["new", "contacted", "following_up"])
      )
    );

  await db
    .update(campaigns)
    .set({ repliedCount: sql`${campaigns.repliedCount} + 1` })
    .where(eq(campaigns.id, email.campaignId));

  const followupSettings = await getFollowupSettings();
  await completeCampaignIfFinished(email.campaignId, followupSettings.stopAfterDays);

  processAlert(email.id, {
    type: "replied",
    emailId: email.id,
  }).catch((error) => console.error("Alert dispatch failed:", error));
}

async function findEmailByProviderIdentifiers(payload: EmailEngineWebhookEvent) {
  const identifiers = [
    payload.data?.queueId,
    payload.data?.messageId,
    payload.data?.originalMessageId,
  ].filter(Boolean) as string[];

  if (identifiers.length === 0) return null;

  const [email] = await db
    .select()
    .from(emails)
    .where(
      inArray(
        emails.providerQueueId,
        identifiers
      )
    )
    .limit(1);

  if (email) return email;

  const [matchedByMessageId] = await db
    .select()
    .from(emails)
    .where(inArray(emails.providerMessageId, identifiers))
    .limit(1);

  if (matchedByMessageId) return matchedByMessageId;

  const [matchedByHeaderId] = await db
    .select()
    .from(emails)
    .where(inArray(emails.messageHeaderId, identifiers.map(normalizeMessageId)))
    .limit(1);

  return matchedByHeaderId || null;
}

function normalizeMessageId(value: string) {
  return value.trim();
}
