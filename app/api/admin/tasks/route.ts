import { db } from "@/lib/db";
import { emails, campaigns } from "@/lib/db/schema";
import { eq, count, and, gte, sql, desc, isNotNull } from "drizzle-orm";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Last follow-up email (stepNumber > 1)
    const [lastFollowup] = await db
      .select({
        createdAt: emails.createdAt,
        campaignName: campaigns.name,
        stepNumber: emails.stepNumber,
      })
      .from(emails)
      .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
      .where(sql`${emails.stepNumber} > 1`)
      .orderBy(desc(emails.createdAt))
      .limit(1);

    // Pending follow-ups: active campaigns with emails that haven't been replied to
    const activeCampaignIds = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.status, "active"));

    let pendingFollowupCount = 0;
    if (activeCampaignIds.length > 0) {
      const [result] = await db
        .select({ count: count() })
        .from(emails)
        .where(
          and(
            sql`${emails.stepNumber} = 1`,
            eq(emails.status, "sent"),
            isNotNull(emails.sentAt),
            sql`${emails.repliedAt} IS NULL`
          )
        );
      pendingFollowupCount = Number(result?.count || 0);
    }

    // Alert stats
    const [todayReplied] = await db
      .select({ count: count() })
      .from(emails)
      .where(gte(emails.replyAlertedAt, today));

    const [weekReplied] = await db
      .select({ count: count() })
      .from(emails)
      .where(gte(emails.replyAlertedAt, weekAgo));

    // Email queue stats
    const [queuedEmails] = await db
      .select({ count: count() })
      .from(emails)
      .where(eq(emails.status, "queued"));

    const [failedEmails] = await db
      .select({ count: count() })
      .from(emails)
      .where(eq(emails.status, "failed"));

    return apiResponse({
      followup: {
        lastRun: lastFollowup
          ? {
              time: lastFollowup.createdAt,
              campaignName: lastFollowup.campaignName,
              stepNumber: lastFollowup.stepNumber,
            }
          : null,
        pendingCount: pendingFollowupCount,
        cronSchedule: "*/15 * * * *",
      },
      tracking: {
        today: {
          replied: Number(todayReplied?.count || 0),
        },
        thisWeek: {
          replied: Number(weekReplied?.count || 0),
        },
      },
      emailQueue: {
        queued: Number(queuedEmails?.count || 0),
        failed: Number(failedEmails?.count || 0),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
