import { and, eq, inArray, isNull, lt, desc } from "drizzle-orm";
import { getAIProviderWithConfig, buildFollowupPrompt } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignProspects,
  emails,
  followupSequences,
  prospects,
} from "@/lib/db/schema";
import { submitEmailEngineMessage } from "@/lib/integrations/emailengine";
import { getFollowupSettings } from "@/lib/services/config.service";
import { getMailAccountById } from "@/lib/services/mail-account.service";

const FOLLOWUP_ELIGIBLE_EMAIL_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;

export async function getSequenceConfig(campaignId: string) {
  return db
    .select()
    .from(followupSequences)
    .where(eq(followupSequences.campaignId, campaignId))
    .orderBy(followupSequences.stepNumber);
}

export async function saveSequenceConfig(
  campaignId: string,
  steps: {
    stepNumber: number;
    delayDays: number;
    angle: string;
    enabled: boolean;
  }[]
) {
  await db.delete(followupSequences).where(eq(followupSequences.campaignId, campaignId));

  if (steps.length === 0) {
    return;
  }

  const normalizedSteps = [...steps]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((step, index) => ({
      campaignId,
      stepNumber: index + 1,
      delayDays: Math.max(1, step.delayDays),
      angle: step.angle,
      enabled: step.enabled,
    }));

  await db.insert(followupSequences).values(normalizedSteps);
}

export async function processPendingFollowups() {
  const now = new Date();
  const followupSettings = await getFollowupSettings();
  const activeCampaigns = await db
    .select({
      id: campaigns.id,
      aiProvider: campaigns.aiProvider,
      aiConfig: campaigns.aiConfig,
      fromEmail: campaigns.fromEmail,
      mailAccountId: campaigns.mailAccountId,
    })
    .from(campaigns)
    .where(eq(campaigns.status, "active"));

  let totalProcessed = 0;

  for (const campaign of activeCampaigns) {
    const sequence = await getSequenceConfig(campaign.id);
    if (sequence.length === 0) continue;

    const sender = await resolveFollowupSender(
      campaign.mailAccountId || null,
      campaign.fromEmail || null
    );

    for (const step of sequence) {
      if (!step.enabled) continue;

      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - step.delayDays);

      const eligibleEmails = await db
        .select({
          id: emails.id,
          campaignId: emails.campaignId,
          prospectId: emails.prospectId,
          body: emails.body,
          providerMessageId: emails.providerMessageId,
          threadId: emails.threadId,
        })
        .from(emails)
        .where(
          and(
            eq(emails.campaignId, campaign.id),
            eq(emails.stepNumber, step.stepNumber),
            lt(emails.sentAt, cutoffDate),
            inArray(emails.status, FOLLOWUP_ELIGIBLE_EMAIL_STATUSES),
            isNull(emails.repliedAt)
          )
        );

      for (const previousEmail of eligibleEmails) {
        const [existingFollowup] = await db
          .select({ id: emails.id })
          .from(emails)
          .where(
            and(
              eq(emails.campaignId, campaign.id),
              eq(emails.prospectId, previousEmail.prospectId),
              eq(emails.stepNumber, step.stepNumber + 1)
            )
          )
          .limit(1);

        if (existingFollowup) continue;

        const [prospect] = await db
          .select()
          .from(prospects)
          .where(eq(prospects.id, previousEmail.prospectId))
          .limit(1);

        if (!prospect?.email) continue;

        try {
          const ai = getAIProviderWithConfig(
            campaign.aiProvider || "custom",
            campaign.aiConfig as { baseURL?: string; apiKey?: string; model?: string } | undefined
          );
          const generatedEmail = await ai.generateEmail({
            prompt: buildFollowupPrompt({
              prospectName: prospect.contactName || "there",
              companyName: prospect.companyName || "your company",
              industry: prospect.industry || "",
              country: prospect.country || "",
              productName: "our products and services",
              senderName: "Our Team",
              angle: step.angle || "value_prop",
              previousEmailBody: previousEmail.body || "",
              stepNumber: step.stepNumber,
            }),
          });

          const [followupEmail] = await db
            .insert(emails)
            .values({
              campaignId: campaign.id,
              prospectId: previousEmail.prospectId,
              templateId: step.templateId,
              mailAccountId: sender.mailAccount.id,
              stepNumber: step.stepNumber + 1,
              subject: generatedEmail.subject,
              body: generatedEmail.body,
              provider: "emailengine",
              status: "queued",
            })
            .returning();

          const messageHeaderId = buildTrackedMessageId(followupEmail.id, sender.fromEmail);
          const html = formatEmailHtml(generatedEmail.body || "");
          const submitResult = await submitEmailEngineMessage(sender.mailAccount.accountKey, {
            from: { address: sender.fromEmail },
            to: [buildRecipient(prospect.email, prospect.contactName)],
            subject: generatedEmail.subject,
            text: generatedEmail.body || "",
            html,
            messageId: messageHeaderId,
            headers: buildThreadHeaders(
              followupEmail.id,
              campaign.id,
              previousEmail.providerMessageId
            ),
            trackOpens: true,
            trackClicks: true,
          });

          await db
            .update(emails)
            .set({
              providerQueueId: submitResult?.queueId || null,
              providerMessageId: submitResult?.messageId || messageHeaderId,
              messageHeaderId,
              mailAccountId: sender.mailAccount.id,
              threadId: previousEmail.threadId || submitResult?.messageId || messageHeaderId,
            })
            .where(eq(emails.id, followupEmail.id));

          totalProcessed++;
        } catch (error) {
          console.error(`Failed to process follow-up for prospect ${previousEmail.prospectId}:`, error);
          await db
            .update(emails)
            .set({ status: "failed" })
            .where(
              and(
                eq(emails.campaignId, campaign.id),
                eq(emails.prospectId, previousEmail.prospectId),
                eq(emails.stepNumber, step.stepNumber + 1),
                eq(emails.status, "queued")
              )
            );
        }
      }
    }

    await completeCampaignIfFinished(campaign.id, followupSettings.stopAfterDays);
  }

  return { totalProcessed };
}

export async function completeCampaignIfFinished(
  campaignId: string,
  stopAfterDays: number
) {
  const campaignProspectRows = await db
    .select({ prospectId: campaignProspects.prospectId })
    .from(campaignProspects)
    .where(eq(campaignProspects.campaignId, campaignId));

  if (campaignProspectRows.length === 0) {
    return;
  }

  const finalStepNumber = (await getFinalOutboundStepNumber(campaignId)) || 1;
  const latestEmails = await db
    .select({
      prospectId: emails.prospectId,
      stepNumber: emails.stepNumber,
      sentAt: emails.sentAt,
      repliedAt: emails.repliedAt,
    })
    .from(emails)
    .where(eq(emails.campaignId, campaignId))
    .orderBy(desc(emails.stepNumber), desc(emails.createdAt));

  const latestEmailMap = buildLatestEmailMap(latestEmails);
  const stopDate = buildStopDate(stopAfterDays);
  const allFinished = campaignProspectRows.every(({ prospectId }) =>
    hasProspectFinished(latestEmailMap.get(prospectId), finalStepNumber, stopDate)
  );

  if (!allFinished) {
    return;
  }

  await db
    .update(campaigns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));
}

async function resolveFollowupSender(mailAccountId: string | null, fromEmail: string | null) {
  if (!mailAccountId || !fromEmail) {
    throw new Error("跟进发件邮箱缺失：请先启动活动并固化发件邮箱");
  }

  const mailAccount = await getMailAccountById(mailAccountId);
  if (!mailAccount) {
    throw new Error("跟进邮箱账号不存在，请重新绑定后再执行跟进");
  }

  return { mailAccount, fromEmail };
}

function buildTrackedMessageId(emailId: string, fromEmail: string) {
  const domain = fromEmail.split("@")[1] || "pitchflow.local";
  return `<pitchflow-${emailId}@${domain}>`;
}

function formatEmailHtml(body: string) {
  return body
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function buildThreadHeaders(
  emailId: string,
  campaignId: string,
  previousMessageId: string | null
) {
  const headers: Record<string, string> = {
    "X-PitchFlow-Email-ID": emailId,
    "X-PitchFlow-Campaign-ID": campaignId,
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };

  if (previousMessageId) {
    headers["In-Reply-To"] = previousMessageId;
    headers["References"] = previousMessageId;
  }

  return headers;
}

function buildRecipient(address: string, name: string | null) {
  if (!name) {
    return { address };
  }

  return { address, name };
}

async function getFinalOutboundStepNumber(campaignId: string) {
  const sequence = await getSequenceConfig(campaignId);
  if (sequence.length === 0) {
    return 1;
  }

  return Math.max(...sequence.map((step) => step.stepNumber)) + 1;
}

function buildLatestEmailMap(
  latestEmails: {
    prospectId: string;
    stepNumber: number | null;
    sentAt: Date | null;
    repliedAt: Date | null;
  }[]
) {
  return latestEmails.reduce((emailMap, email) => {
    if (!emailMap.has(email.prospectId)) {
      emailMap.set(email.prospectId, email);
    }
    return emailMap;
  }, new Map<string, (typeof latestEmails)[number]>());
}

function buildStopDate(stopAfterDays: number) {
  const stopDate = new Date();
  stopDate.setDate(stopDate.getDate() - stopAfterDays);
  return stopDate;
}

function hasProspectFinished(
  latestEmail:
    | {
        stepNumber: number | null;
        sentAt: Date | null;
        repliedAt: Date | null;
      }
    | undefined,
  finalStepNumber: number,
  stopDate: Date
) {
  if (!latestEmail) {
    return false;
  }

  if (latestEmail.repliedAt) {
    return true;
  }

  return (
    (latestEmail.stepNumber || 1) >= finalStepNumber &&
    !!latestEmail.sentAt &&
    latestEmail.sentAt <= stopDate
  );
}
