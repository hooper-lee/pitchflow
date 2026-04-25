import { db } from "@/lib/db";
import {
  campaigns,
  emails,
  prospects,
  emailReplies,
  emailTemplates,
  followupSequences,
  campaignProspects,
} from "@/lib/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import {
  getAIProviderWithConfig,
  buildOutreachPromptFromTemplate,
  buildReplyFollowupPromptFromTemplate,
} from "@/lib/ai";
import { submitEmailEngineMessage } from "@/lib/integrations/emailengine";
import {
  getMailAccountById,
  getUserMailAccountByRegisteredEmail,
} from "@/lib/services/mail-account.service";
import { getProductProfile } from "@/lib/services/product-profile.service";
import {
  AI_PROMPT_KEYS,
  getAiPromptConfig,
  interpolatePromptTemplate,
} from "@/lib/services/config.service";

interface CreateCampaignParams {
  name: string;
  industry?: string;
  targetPersona?: string;
  campaignType?: "cold_outreach" | "reply_followup";
  templateId?: string;
  prospectIds?: string[];
  aiProvider?: "claude" | "openai" | "custom";
  aiConfig?: {
    baseURL?: string;
    apiKey?: string;
    model?: string;
  };
}

interface ResolvedSender {
  fromEmail: string;
  mailAccount: {
    id: string;
    accountKey: string;
    email: string;
  };
}

export interface StartCampaignProgress {
  type: "status" | "progress";
  message: string;
  processed: number;
  total: number;
  successCount: number;
  failedCount: number;
  companyName?: string;
}

export interface RetryEmailProgress {
  type: "status";
  message: string;
}

export async function listCampaigns(tenantId: string, page = 1, limit = 20) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId));

  const items = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId))
    .orderBy(desc(campaigns.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    items,
    total: Number(total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}

export async function getCampaign(id: string, tenantId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .limit(1);

  return campaign || null;
}

export async function getCampaignProspectCount(campaignId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(campaignProspects)
    .where(eq(campaignProspects.campaignId, campaignId));
  return Number(total);
}

export async function createCampaign(tenantId: string, data: CreateCampaignParams) {
  const { prospectIds, ...campaignData } = data;
  if (prospectIds?.length) {
    await assertCampaignProspectsMatchType(tenantId, prospectIds, campaignData.campaignType || "cold_outreach");
  }
  const totalProspects = prospectIds?.length || 0;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      ...campaignData,
      campaignType: campaignData.campaignType || "cold_outreach",
      aiConfig: campaignData.aiConfig || null,
      tenantId,
      status: "draft",
      totalProspects,
    })
    .returning();

  if (prospectIds && prospectIds.length > 0) {
    await db.insert(campaignProspects).values(
      prospectIds.map((prospectId) => ({
        campaignId: campaign.id,
        prospectId,
      }))
    );
  }

  if ((campaign.campaignType || "cold_outreach") === "cold_outreach") {
    await db.insert(followupSequences).values([
      { campaignId: campaign.id, stepNumber: 1, delayDays: 3, angle: "value_prop", enabled: true },
      { campaignId: campaign.id, stepNumber: 2, delayDays: 7, angle: "social_proof", enabled: true },
      { campaignId: campaign.id, stepNumber: 3, delayDays: 14, angle: "urgency", enabled: true },
    ]);
  }

  return campaign;
}

export async function startCampaign(
  id: string,
  tenantId: string,
  userId: string,
  userEmail?: string,
  onProgress?: (event: StartCampaignProgress) => void | Promise<void>
) {
  const campaign = await getCampaign(id, tenantId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign is not in draft status");

  const template = await getCampaignTemplate(campaign.templateId);
  const productProfile = await getProductProfile(tenantId);
  const sender = await resolveSender(tenantId, userId, userEmail);
  const prospectsWithEmail = await getBoundProspectsWithEmail(campaign.id);

  if (prospectsWithEmail.length === 0) {
    throw new Error("该活动未绑定客户或客户没有邮箱，请先在活动配置中选择客户");
  }

  const ai = getAIProviderWithConfig(
    campaign.aiProvider || "custom",
    campaign.aiConfig as { baseURL?: string; apiKey?: string; model?: string } | undefined
  );

  const queuedEmailIds: string[] = [];
  let processedCount = 0;
  let failedCount = 0;

  await db
    .update(campaigns)
    .set({
      status: "active",
      totalProspects: prospectsWithEmail.length,
      mailAccountId: sender.mailAccount.id,
      fromEmail: sender.fromEmail,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));

  await onProgress?.({
    type: "status",
    message: "已启动活动，正在生成首批邮件",
    processed: processedCount,
    total: prospectsWithEmail.length,
    successCount: queuedEmailIds.length,
    failedCount,
  });

  for (const prospect of prospectsWithEmail) {
    try {
      await onProgress?.({
        type: "progress",
        message: `正在为 ${prospect.companyName || prospect.email || "当前客户"} 生成邮件`,
        processed: processedCount,
        total: prospectsWithEmail.length,
        successCount: queuedEmailIds.length,
        failedCount,
        companyName: prospect.companyName || undefined,
      });

      const generatedEmail = await ai.generateEmail({
        prompt: await buildCampaignEmailPrompt({
          tenantId,
          campaign,
          prospect,
          template,
          productProfile,
        }),
      });

      const [emailRecord] = await db
        .insert(emails)
        .values({
          campaignId: campaign.id,
          prospectId: prospect.id,
          templateId: campaign.templateId,
          mailAccountId: sender.mailAccount.id,
          stepNumber: 1,
          subject: generatedEmail.subject,
          body: generatedEmail.body,
          provider: "emailengine",
          status: "queued",
        })
        .returning();

      const messageHeaderId = buildTrackedMessageId(emailRecord.id, sender.fromEmail);
      const html = formatEmailHtml(emailRecord.body || "");
      const submitResult = await submitEmailEngineMessage(sender.mailAccount.accountKey, {
        from: { address: sender.fromEmail, name: template?.senderName || null },
        to: [buildRecipient(prospect.email!, prospect.contactName)],
        subject: emailRecord.subject || "",
        text: emailRecord.body || "",
        html,
        messageId: messageHeaderId,
        headers: buildBaseHeaders(emailRecord.id, campaign.id),
        trackOpens: true,
        trackClicks: true,
      });

      await db
        .update(emails)
        .set({
          providerQueueId: submitResult?.queueId || null,
          providerMessageId: submitResult?.messageId || messageHeaderId,
          messageHeaderId,
          threadId: submitResult?.messageId || messageHeaderId,
        })
        .where(eq(emails.id, emailRecord.id));

      await db
        .update(prospects)
        .set({
          status: campaign.campaignType === "reply_followup" ? "following_up" : "contacted",
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, prospect.id));

      queuedEmailIds.push(emailRecord.id);
      processedCount += 1;
      await onProgress?.({
        type: "progress",
        message: `${prospect.companyName || prospect.email || "当前客户"} 已加入发送队列`,
        processed: processedCount,
        total: prospectsWithEmail.length,
        successCount: queuedEmailIds.length,
        failedCount,
        companyName: prospect.companyName || undefined,
      });
    } catch (error) {
      console.error(`Failed to queue campaign email for prospect ${prospect.id}:`, error);
      await db
        .update(emails)
        .set({ status: "failed" })
        .where(
          and(
            eq(emails.campaignId, campaign.id),
            eq(emails.prospectId, prospect.id),
            eq(emails.status, "queued")
          )
        );
      processedCount += 1;
      failedCount += 1;
      await onProgress?.({
        type: "progress",
        message: `${prospect.companyName || prospect.email || "当前客户"} 生成失败`,
        processed: processedCount,
        total: prospectsWithEmail.length,
        successCount: queuedEmailIds.length,
        failedCount,
        companyName: prospect.companyName || undefined,
      });
    }
  }

  await db
    .update(campaigns)
    .set({ sentCount: queuedEmailIds.length, updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));

  await onProgress?.({
    type: "status",
    message: "活动启动完成",
    processed: processedCount,
    total: prospectsWithEmail.length,
    successCount: queuedEmailIds.length,
    failedCount,
  });

  return { campaign, emailCount: queuedEmailIds.length };
}

export async function pauseCampaign(id: string, tenantId: string) {
  const [campaign] = await db
    .update(campaigns)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning();

  return campaign;
}

export async function retryCampaignEmail(campaignId: string, emailId: string, tenantId: string) {
  const campaign = await getCampaign(campaignId, tenantId);
  if (!campaign) throw new Error("Campaign not found");

  const [emailRecord] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.campaignId, campaignId)))
    .limit(1);

  if (!emailRecord) throw new Error("Email not found");
  if (!["failed", "bounced"].includes(emailRecord.status)) {
    throw new Error("Email status does not support retry");
  }

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, emailRecord.prospectId))
    .limit(1);

  if (!prospect?.email) {
    throw new Error("Prospect email not found");
  }

  const template = await getCampaignTemplate(campaign.templateId);
  const mailAccount = campaign.mailAccountId
    ? await getMailAccountById(campaign.mailAccountId)
    : null;

  if (!mailAccount || !campaign.fromEmail) {
    throw new Error("Campaign sender not configured");
  }

  const messageHeaderId = buildTrackedMessageId(emailRecord.id, campaign.fromEmail);
  const html = formatEmailHtml(emailRecord.body || "");
  const submitResult = await submitEmailEngineMessage(mailAccount.accountKey, {
    from: { address: campaign.fromEmail, name: template?.senderName || null },
    to: [buildRecipient(prospect.email, prospect.contactName)],
    subject: emailRecord.subject || "",
    text: emailRecord.body || "",
    html,
    messageId: messageHeaderId,
    headers: buildBaseHeaders(emailRecord.id, campaign.id),
    trackOpens: true,
    trackClicks: true,
  });

  const [updatedEmail] = await db
    .update(emails)
    .set({
      status: "queued",
      bouncedAt: null,
      sentAt: null,
      providerQueueId: submitResult?.queueId || null,
      providerMessageId: submitResult?.messageId || messageHeaderId,
      messageHeaderId,
      threadId: submitResult?.messageId || messageHeaderId,
    })
    .where(eq(emails.id, emailRecord.id))
    .returning();

  return updatedEmail;
}

export async function retryCampaignEmailWithProgress(
  campaignId: string,
  emailId: string,
  tenantId: string,
  onProgress?: (event: RetryEmailProgress) => void | Promise<void>
) {
  await onProgress?.({ type: "status", message: "正在校验邮件状态" });

  const campaign = await getCampaign(campaignId, tenantId);
  if (!campaign) throw new Error("Campaign not found");

  const [emailRecord] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.campaignId, campaignId)))
    .limit(1);

  if (!emailRecord) throw new Error("Email not found");
  if (!["failed", "bounced"].includes(emailRecord.status)) {
    throw new Error("Email status does not support retry");
  }

  await onProgress?.({ type: "status", message: "正在重新提交到发送队列" });
  const updatedEmail = await retryCampaignEmail(campaignId, emailId, tenantId);
  await onProgress?.({ type: "status", message: "邮件已重新加入队列" });
  return updatedEmail;
}

export async function deleteCampaign(id: string, tenantId: string) {
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
}

export async function getCampaignEmails(campaignId: string) {
  const campaignEmails = await db
    .select({
      id: emails.id,
      subject: emails.subject,
      body: emails.body,
      status: emails.status,
      stepNumber: emails.stepNumber,
      sentAt: emails.sentAt,
      openedAt: emails.openedAt,
      repliedAt: emails.repliedAt,
      openCount: emails.openCount,
      clickCount: emails.clickCount,
      createdAt: emails.createdAt,
      prospectName: prospects.contactName,
      prospectEmail: prospects.email,
      prospectCompany: prospects.companyName,
    })
    .from(emails)
    .leftJoin(prospects, eq(emails.prospectId, prospects.id))
    .where(eq(emails.campaignId, campaignId))
    .orderBy(desc(emails.createdAt));

  if (campaignEmails.length === 0) {
    return campaignEmails;
  }

  const latestReplies = await getLatestRepliesByEmailId(
    campaignEmails.map((email) => email.id)
  );

  return campaignEmails.map((email) => ({
    ...email,
    latestReply: latestReplies.get(email.id) || null,
  }));
}

async function getCampaignTemplate(templateId: string | null) {
  if (!templateId) return null;

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId))
    .limit(1);

  return template || null;
}

async function assertCampaignProspectsMatchType(
  tenantId: string,
  prospectIds: string[],
  campaignType: "cold_outreach" | "reply_followup"
) {
  const rows = await db
    .select({ id: prospects.id, status: prospects.status })
    .from(prospects)
    .where(and(eq(prospects.tenantId, tenantId), inArray(prospects.id, prospectIds)));
  const allowedStatuses =
    campaignType === "reply_followup"
      ? new Set(["replied", "following_up", "interested"])
      : new Set(["new", "contacted"]);
  const invalidProspect = rows.find((row) => !allowedStatuses.has(row.status));

  if (invalidProspect) {
    throw new Error(
      campaignType === "reply_followup"
        ? "已回复跟进活动只能选择已回复、跟进中或有意向客户"
        : "冷启动开发活动只能选择新线索或已联系但未回复客户"
    );
  }
}

async function buildCampaignEmailPrompt(input: {
  tenantId: string;
  campaign: typeof campaigns.$inferSelect;
  prospect: typeof prospects.$inferSelect;
  template: typeof emailTemplates.$inferSelect | null;
  productProfile: Awaited<ReturnType<typeof getProductProfile>>;
}) {
  const commonInput = {
    prospectName: input.prospect.contactName || "there",
    companyName: input.prospect.companyName || "your company",
    industry: input.prospect.industry || "",
    country: input.prospect.country || "",
    researchSummary: input.prospect.researchSummary || "",
    productName: input.template?.productName || input.productProfile.productName,
    productDescription: input.productProfile.productDescription || "",
    valueProposition: input.productProfile.valueProposition || "",
    senderName: input.template?.senderName || input.productProfile.senderName,
    senderTitle: input.productProfile.senderTitle || "",
    angle: input.template?.angle || "",
    templateBody: input.template?.body || "",
  };

  if (input.campaign.campaignType !== "reply_followup") {
    const template = await getAiPromptConfig(AI_PROMPT_KEYS.EMAIL_OUTREACH_USER);
    return buildOutreachPromptFromTemplate(interpolatePromptTemplate(template, commonInput));
  }

  const replyContext = await getLatestReplyForProspect(input.prospect.id);
  const template = await getAiPromptConfig(AI_PROMPT_KEYS.EMAIL_REPLY_FOLLOWUP_USER);
  return buildReplyFollowupPromptFromTemplate(interpolatePromptTemplate(template, {
    ...commonInput,
    previousEmailBody: replyContext?.previousEmailBody || "",
    replyBody: replyContext?.replyBody || input.prospect.researchSummary || "",
    replySubject: replyContext?.replySubject || "",
  }));
}

async function getLatestReplyForProspect(prospectId: string) {
  const [reply] = await db
    .select({
      replyBody: emailReplies.textBody,
      replySubject: emailReplies.subject,
      emailBody: emails.body,
    })
    .from(emailReplies)
    .leftJoin(emails, eq(emailReplies.emailId, emails.id))
    .where(eq(emailReplies.prospectId, prospectId))
    .orderBy(desc(emailReplies.receivedAt))
    .limit(1);

  if (!reply) return null;
  return {
    replyBody: reply.replyBody || "",
    replySubject: reply.replySubject || undefined,
    previousEmailBody: reply.emailBody || undefined,
  };
}

async function getBoundProspectsWithEmail(campaignId: string) {
  const rows = await db
    .select({ prospect: prospects })
    .from(campaignProspects)
    .innerJoin(prospects, eq(campaignProspects.prospectId, prospects.id))
    .where(eq(campaignProspects.campaignId, campaignId));

  return rows.map((row) => row.prospect).filter((prospect) => prospect.email);
}

async function resolveSender(
  tenantId: string,
  userId: string,
  userEmail?: string
): Promise<ResolvedSender> {
  if (!userEmail) {
    throw new Error("当前登录账号缺少注册邮箱，无法作为活动发件邮箱");
  }

  const userMailAccount = await getUserMailAccountByRegisteredEmail(tenantId, userId, userEmail);
  if (!userMailAccount) {
    throw new Error(`当前账号邮箱 ${userEmail} 未绑定，请先在设置中连接该邮箱`);
  }

  return {
    fromEmail: userMailAccount.email,
    mailAccount: userMailAccount,
  };
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

function buildBaseHeaders(emailId: string, campaignId: string) {
  return {
    "X-PitchFlow-Email-ID": emailId,
    "X-PitchFlow-Campaign-ID": campaignId,
    "X-Auto-Response-Suppress": "OOF, AutoReply",
  };
}

function buildRecipient(address: string, name: string | null) {
  if (!name) {
    return { address };
  }

  return { address, name };
}

async function getLatestRepliesByEmailId(emailIds: string[]) {
  const replies = await db
    .select({
      emailId: emailReplies.emailId,
      subject: emailReplies.subject,
      textBody: emailReplies.textBody,
      htmlBody: emailReplies.htmlBody,
      fromEmail: emailReplies.fromEmail,
      fromName: emailReplies.fromName,
      receivedAt: emailReplies.receivedAt,
    })
    .from(emailReplies)
    .where(inArray(emailReplies.emailId, emailIds))
    .orderBy(desc(emailReplies.receivedAt));

  return replies.reduce((replyMap, reply) => {
    const currentReply = replyMap.get(reply.emailId);
    if (!currentReply || reply.receivedAt > currentReply.receivedAt) {
      replyMap.set(reply.emailId, reply);
    }
    return replyMap;
  }, new Map<string, (typeof replies)[number]>());
}
