import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../connection";
import { sendEmail } from "@/lib/integrations/resend";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { SendEmailJobData } from "../jobs/send-email.job";

export async function processSendEmailJob(job: Job<SendEmailJobData>) {
  const { emailId, to, subject, body, from } = job.data;

  try {
    // Convert plain text body to simple HTML
    const html = body
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>");

    const result = await sendEmail({
      from,
      to,
      subject,
      html,
      tags: [
        { name: "email_id", value: emailId },
        { name: "campaign_id", value: job.data.campaignId },
      ],
    });

    // Update email record with Resend ID
    await db
      .update(emails)
      .set({
        status: "sent",
        resendId: result.id,
        sentAt: new Date(),
      })
      .where(eq(emails.id, emailId));
  } catch (error) {
    console.error(`Failed to send email ${emailId}:`, error);

    await db
      .update(emails)
      .set({ status: "failed" })
      .where(eq(emails.id, emailId));

    throw error;
  }
}

// Only start worker if not in serverless environment
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_WORKERS === "true") {
  const connection = getRedisConnection();
  const worker = new Worker("email-send", processSendEmailJob, {
    connection,
    limiter: { max: 1, duration: 2000 }, // 1 email per 2 seconds
    concurrency: 1,
  });

  worker.on("completed", (job) => {
    console.log(`Email sent: ${job.data.emailId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Email failed: ${job?.data?.emailId}`, err);
  });
}
