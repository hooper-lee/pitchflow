import { db } from "@/lib/db";
import { campaigns, emails, prospects, emailTemplates, followupSequences, campaignProspects } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { getAIProviderWithConfig, buildOutreachPrompt } from "@/lib/ai";
import { getFromAddress } from "@/lib/integrations/resend";

interface CreateCampaignParams {
  name: string;
  industry?: string;
  targetPersona?: string;
  templateId?: string;
  prospectIds?: string[];
  aiProvider?: "claude" | "openai" | "custom";
  aiConfig?: {
    baseURL?: string;
    apiKey?: string;
    model?: string;
  };
}

export async function listCampaigns(tenantId: string, limit = 20) {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId))
    .orderBy(desc(campaigns.createdAt))
    .limit(limit);
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

export async function createCampaign(
  tenantId: string,
  data: CreateCampaignParams
) {
  const { prospectIds, ...campaignData } = data;

  const [campaign] = await db
    .insert(campaigns)
    .values({
      ...campaignData,
      aiConfig: campaignData.aiConfig || null,
      tenantId,
      status: "draft",
    })
    .returning();

  // Bind prospects to campaign
  if (prospectIds && prospectIds.length > 0) {
    await db.insert(campaignProspects).values(
      prospectIds.map((pid) => ({
        campaignId: campaign.id,
        prospectId: pid,
      }))
    );
  }

  // Create default 3-step follow-up sequence
  await db.insert(followupSequences).values([
    {
      campaignId: campaign.id,
      stepNumber: 1,
      delayDays: 3,
      angle: "value_prop",
      enabled: true,
    },
    {
      campaignId: campaign.id,
      stepNumber: 2,
      delayDays: 7,
      angle: "social_proof",
      enabled: true,
    },
    {
      campaignId: campaign.id,
      stepNumber: 3,
      delayDays: 14,
      angle: "urgency",
      enabled: true,
    },
  ]);

  return campaign;
}

export async function startCampaign(
  id: string,
  tenantId: string,
  defaultFromEmail?: string
) {
  const campaign = await getCampaign(id, tenantId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign is not in draft status");

  // Get prospects bound to this campaign
  const boundProspects = await db
    .select({ prospect: prospects })
    .from(campaignProspects)
    .innerJoin(prospects, eq(campaignProspects.prospectId, prospects.id))
    .where(eq(campaignProspects.campaignId, campaign.id));

  const prospectsWithEmail = boundProspects
    .map((r) => r.prospect)
    .filter((p) => p.email);

  if (prospectsWithEmail.length === 0) {
    throw new Error("该活动未绑定客户或客户没有邮箱，请先在活动配置中选择客户");
  }

  // Get template if specified
  let template = null;
  if (campaign.templateId) {
    [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, campaign.templateId))
      .limit(1);
  }

  const resolvedFromEmail = await resolveCampaignFromEmail(
    template?.senderEmail || null,
    defaultFromEmail
  );

  // Create email records for each prospect with AI-generated content
  const ai = getAIProviderWithConfig(
    campaign.aiProvider || "custom",
    campaign.aiConfig as { baseURL?: string; apiKey?: string; model?: string } | undefined
  );
  const emailRecords = [];

  for (const prospect of prospectsWithEmail) {
    try {
      const prompt = buildOutreachPrompt({
        prospectName: prospect.contactName || "there",
        companyName: prospect.companyName || "your company",
        industry: prospect.industry || "",
        country: prospect.country || "",
        researchSummary: prospect.researchSummary || undefined,
        productName: template?.productName || "our products and services",
        senderName: template?.senderName || "Our Team",
        angle: template?.angle || undefined,
        templateBody: template?.body || undefined,
      });

      const result = await ai.generateEmail({ prompt });

      const [emailRecord] = await db
        .insert(emails)
        .values({
          campaignId: campaign.id,
          prospectId: prospect.id,
          templateId: campaign.templateId,
          stepNumber: 1,
          subject: result.subject,
          body: result.body,
          status: "queued",
        })
        .returning();

      emailRecords.push(emailRecord);

      // Move to contacted as soon as outreach is queued for this prospect.
      await db
        .update(prospects)
        .set({ status: "contacted", updatedAt: new Date() })
        .where(eq(prospects.id, prospect.id));
    } catch (err) {
      console.error(`Failed to generate email for prospect ${prospect.id}:`, err);
    }
  }

  // Update campaign status
  if (emailRecords.length > 0) {
    await db
      .update(campaigns)
      .set({
        status: "active",
        totalProspects: emailRecords.length,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaign.id));
  }

  // Queue email sends (inline for simplicity, in production use BullMQ)
  await db
    .update(campaigns)
    .set({
      fromEmail: resolvedFromEmail,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id));

  for (const emailRecord of emailRecords) {
    try {
      const prospect = prospectsWithEmail.find(
        (p) => p.id === emailRecord.prospectId
      );
      if (!prospect?.email) continue;

      // Import sendEmail directly since we're in the same process
      const { sendEmail } = await import("@/lib/integrations/resend");
      const html = (emailRecord.body || "")
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br/>")
        .replace(/^/, "<p>")
        .replace(/$/, "</p>");

      const result = await sendEmail({
        from: resolvedFromEmail,
        to: prospect.email,
        subject: emailRecord.subject || "",
        html,
      });

      await db
        .update(emails)
        .set({
          status: "sent",
          resendId: result.id,
          sentAt: new Date(),
        })
        .where(eq(emails.id, emailRecord.id));

      await db
        .update(campaigns)
        .set({ sentCount: emailRecords.length })
        .where(eq(campaigns.id, campaign.id));
    } catch (err) {
      console.error(`Failed to send email ${emailRecord.id}:`, err);
      await db
        .update(emails)
        .set({ status: "failed" })
        .where(eq(emails.id, emailRecord.id));
    }
  }

  return { campaign, emailCount: emailRecords.length };
}

async function resolveCampaignFromEmail(
  templateSenderEmail: string | null,
  defaultFromEmail?: string
) {
  if (templateSenderEmail) {
    return templateSenderEmail;
  }

  if (defaultFromEmail) {
    return defaultFromEmail;
  }

  return getFromAddress();
}

export async function pauseCampaign(id: string, tenantId: string) {
  const [campaign] = await db
    .update(campaigns)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning();

  return campaign;
}

export async function deleteCampaign(id: string, tenantId: string) {
  await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)));
}

export async function getCampaignEmails(campaignId: string) {
  const emailList = await db
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

  return emailList;
}
