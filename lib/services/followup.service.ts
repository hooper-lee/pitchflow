import { db } from "@/lib/db";
import { emails, followupSequences, campaigns, prospects } from "@/lib/db/schema";
import { eq, and, lt, isNull, sql } from "drizzle-orm";
import { getAIProviderWithConfig, buildFollowupPrompt } from "@/lib/ai";

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
  // Delete existing config
  await db
    .delete(followupSequences)
    .where(eq(followupSequences.campaignId, campaignId));

  // Insert new config
  if (steps.length > 0) {
    await db
      .insert(followupSequences)
      .values(
        steps.map((s) => ({
          campaignId,
          stepNumber: s.stepNumber,
          delayDays: s.delayDays,
          angle: s.angle,
          enabled: s.enabled,
        }))
      );
  }
}

export async function processPendingFollowups() {
  const now = new Date();

  // Find all active campaigns with follow-up sequences
  const activeCampaigns = await db
    .select({ id: campaigns.id, aiProvider: campaigns.aiProvider, aiConfig: campaigns.aiConfig })
    .from(campaigns)
    .where(eq(campaigns.status, "active"));

  let totalProcessed = 0;

  for (const campaign of activeCampaigns) {
    const sequences = await getSequenceConfig(campaign.id);
    if (sequences.length === 0) continue;

    for (const seq of sequences) {
      if (!seq.enabled) continue;

      // Find emails that need follow-up:
      // - Sent N+ days ago (where N = delayDays for this step)
      // - No reply yet
      // - This step not yet sent
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - seq.delayDays);

      // Find initial emails (step 1) that need this follow-up step
      const eligibleEmails = await db
        .select({
          id: emails.id,
          prospectId: emails.prospectId,
          campaignId: emails.campaignId,
          body: emails.body,
          subject: emails.subject,
        })
        .from(emails)
        .where(
          and(
            eq(emails.campaignId, campaign.id),
            eq(emails.stepNumber, seq.stepNumber - 1 || 1), // Previous step
            lt(emails.sentAt, cutoffDate),
            eq(emails.status, "sent"), // Was sent successfully
            isNull(emails.repliedAt) // No reply yet
          )
        );

      for (const email of eligibleEmails) {
        // Check if this follow-up step was already sent
        const [existingFollowup] = await db
          .select()
          .from(emails)
          .where(
            and(
              eq(emails.campaignId, campaign.id),
              eq(emails.prospectId, email.prospectId),
              eq(emails.stepNumber, seq.stepNumber)
            )
          )
          .limit(1);

        if (existingFollowup) continue;

        // Get prospect data for AI generation
        const [prospect] = await db
          .select()
          .from(prospects)
          .where(eq(prospects.id, email.prospectId))
          .limit(1);

        if (!prospect?.email) continue;

        // Generate follow-up email with AI
        try {
          const ai = getAIProviderWithConfig(
            campaign.aiProvider || "custom",
            campaign.aiConfig as { baseURL?: string; apiKey?: string; model?: string } | undefined
          );
          const prompt = buildFollowupPrompt({
            prospectName: prospect.contactName || "there",
            companyName: prospect.companyName || "your company",
            industry: prospect.industry || "",
            country: prospect.country || "",
            productName: "our products and services",
            senderName: "Our Team",
            angle: seq.angle || "value_prop",
            previousEmailBody: email.body || "",
            stepNumber: seq.stepNumber,
          });

          const result = await ai.generateEmail({ prompt });

          // Create follow-up email record
          const [followupEmail] = await db
            .insert(emails)
            .values({
              campaignId: campaign.id,
              prospectId: email.prospectId,
              templateId: seq.templateId,
              stepNumber: seq.stepNumber,
              subject: result.subject,
              body: result.body,
              status: "queued",
            })
            .returning();

          // Send the follow-up
          const { sendEmail } = await import("@/lib/integrations/resend");
          const fromAddress =
            process.env.RESEND_FROM_EMAIL || "noreply@localhost";
          const html = (result.body || "")
            .replace(/\n\n/g, "</p><p>")
            .replace(/\n/g, "<br/>")
            .replace(/^/, "<p>")
            .replace(/$/, "</p>");

          const sendResult = await sendEmail({
            from: fromAddress,
            to: prospect.email,
            subject: result.subject,
            html,
            tags: [
              { name: "email_id", value: followupEmail.id },
              { name: "campaign_id", value: campaign.id },
              { name: "step", value: String(seq.stepNumber) },
            ],
          });

          await db
            .update(emails)
            .set({
              status: "sent",
              resendId: sendResult.id,
              sentAt: new Date(),
            })
            .where(eq(emails.id, followupEmail.id));

          totalProcessed++;
        } catch (err) {
          console.error(
            `Failed to process follow-up for prospect ${email.prospectId}:`,
            err
          );
        }
      }
    }
  }

  return { totalProcessed };
}
