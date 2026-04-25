import { db } from "@/lib/db";
import { emails, prospects, emailTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { emailSendQueue } from "@/lib/queue";
import { getAIProviderWithConfig, buildOutreachPromptFromTemplate } from "@/lib/ai";
import { getProductProfile } from "@/lib/services/product-profile.service";
import {
  AI_PROMPT_KEYS,
  getAiPromptConfig,
  interpolatePromptTemplate,
} from "@/lib/services/config.service";

export async function composeEmail(
  prospectId: string,
  templateId: string | null,
  tenantId: string,
  aiProvider: "claude" | "openai" | "custom" = "custom"
) {
  // Get prospect data
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (!prospect) throw new Error("Prospect not found");

  // Get template if specified
  let template = null;
  if (templateId) {
    [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, templateId),
          eq(emailTemplates.tenantId, tenantId)
        )
      )
      .limit(1);
  }

  // Use AI to generate personalized email
  const ai = getAIProviderWithConfig(aiProvider);
  const productProfile = await getProductProfile(tenantId);
  const promptTemplate = await getAiPromptConfig(AI_PROMPT_KEYS.EMAIL_OUTREACH_USER);
  const prompt = buildOutreachPromptFromTemplate(interpolatePromptTemplate(promptTemplate, {
    prospectName: prospect.contactName || "there",
    companyName: prospect.companyName || "your company",
    industry: prospect.industry || "your industry",
    country: prospect.country || "",
    researchSummary: prospect.researchSummary || "",
    productName: template?.productName || productProfile.productName,
    productDescription: productProfile.productDescription || "",
    valueProposition: productProfile.valueProposition || "",
    senderName: template?.senderName || productProfile.senderName,
    senderTitle: productProfile.senderTitle || "",
    angle: template?.angle || "",
    templateBody: template?.body || "",
  }));

  const result = await ai.generateEmail({ prompt });

  return {
    subject: result.subject,
    body: result.body,
    prospect,
  };
}

export async function queueEmailSend(
  emailId: string,
  from: string
) {
  const [email] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1);

  if (!email) throw new Error("Email not found");

  await emailSendQueue.add("send-email", {
    emailId: email.id,
    to: "", // Will be populated from prospect in worker
    subject: email.subject || "",
    body: email.body || "",
    from,
    campaignId: email.campaignId,
    prospectId: email.prospectId,
  });
}
