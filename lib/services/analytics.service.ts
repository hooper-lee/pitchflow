import { db } from "@/lib/db";
import { prospects, emails, campaigns } from "@/lib/db/schema";
import { eq, count, and, gte, sql } from "drizzle-orm";

export async function getDashboardStats(tenantId: string) {
  const [totalProspects] = await db
    .select({ count: count() })
    .from(prospects)
    .where(eq(prospects.tenantId, tenantId));

  const [emailsSent] = await db
    .select({ count: count() })
    .from(emails)
    .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        sql`${emails.sentAt} IS NOT NULL`
      )
    );

  const [emailsOpened] = await db
    .select({ count: count() })
    .from(emails)
    .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        sql`${emails.openedAt} IS NOT NULL`
      )
    );

  const [activeCampaigns] = await db
    .select({ count: count() })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        eq(campaigns.status, "active")
      )
    );

  const sentCount = Number(emailsSent?.count || 0);
  const openedCount = Number(emailsOpened?.count || 0);
  const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;

  return {
    totalProspects: Number(totalProspects?.count || 0),
    emailsSent: sentCount,
    openRate,
    activeCampaigns: Number(activeCampaigns?.count || 0),
  };
}

export async function getCampaignStats(campaignId: string) {
  const [totalEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(eq(emails.campaignId, campaignId));

  const [sentEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.campaignId, campaignId),
        sql`${emails.sentAt} IS NOT NULL`
      )
    );

  const [openedEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.campaignId, campaignId),
        sql`${emails.openedAt} IS NOT NULL`
      )
    );

  const [repliedEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.campaignId, campaignId),
        sql`${emails.repliedAt} IS NOT NULL`
      )
    );

  const [bouncedEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.campaignId, campaignId),
        eq(emails.status, "bounced")
      )
    );

  const sent = Number(sentEmails?.count || 0);
  const opened = Number(openedEmails?.count || 0);
  const replied = Number(repliedEmails?.count || 0);

  return {
    total: Number(totalEmails?.count || 0),
    sent,
    opened,
    replied,
    bounced: Number(bouncedEmails?.count || 0),
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
  };
}

export async function getSendVolumeOverTime(
  tenantId: string,
  days = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await db
    .select({
      date: sql<string>`DATE(${emails.sentAt})`.as("date"),
      count: count(),
    })
    .from(emails)
    .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        gte(emails.sentAt, since)
      )
    )
    .groupBy(sql`DATE(${emails.sentAt})`)
    .orderBy(sql`DATE(${emails.sentAt})`);

  return results.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}
