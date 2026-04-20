import { db } from "@/lib/db";
import { prospects, emails, campaigns } from "@/lib/db/schema";
import { eq, count, and, gte, sql, desc } from "drizzle-orm";

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

  const [clickedEmails] = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.campaignId, campaignId),
        sql`${emails.clickedAt} IS NOT NULL`
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
  const clicked = Number(clickedEmails?.count || 0);
  const replied = Number(repliedEmails?.count || 0);

  return {
    total: Number(totalEmails?.count || 0),
    sent,
    opened,
    clicked,
    replied,
    bounced: Number(bouncedEmails?.count || 0),
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
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

export interface ActivityItem {
  type: "sent" | "opened" | "clicked" | "replied" | "bounced" | "followup";
  prospectName: string | null;
  prospectCompany: string | null;
  campaignName: string;
  stepNumber: number | null;
  timestamp: string;
}

export async function getRecentActivity(tenantId: string, limit = 20): Promise<ActivityItem[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentEmails = await db
    .select({
      status: emails.status,
      stepNumber: emails.stepNumber,
      sentAt: emails.sentAt,
      openedAt: emails.openedAt,
      clickedAt: emails.clickedAt,
      repliedAt: emails.repliedAt,
      bouncedAt: emails.bouncedAt,
      createdAt: emails.createdAt,
      prospectName: prospects.contactName,
      prospectCompany: prospects.companyName,
      campaignName: campaigns.name,
    })
    .from(emails)
    .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
    .leftJoin(prospects, eq(emails.prospectId, prospects.id))
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        gte(emails.createdAt, sevenDaysAgo)
      )
    )
    .orderBy(desc(emails.createdAt))
    .limit(limit);

  const activities: ActivityItem[] = [];

  for (const email of recentEmails) {
    const base = {
      prospectName: email.prospectName,
      prospectCompany: email.prospectCompany,
      campaignName: email.campaignName,
      stepNumber: email.stepNumber,
    };

    if (email.repliedAt) {
      activities.push({ ...base, type: "replied", timestamp: email.repliedAt.toISOString() });
    }
    if (email.clickedAt) {
      activities.push({ ...base, type: "clicked", timestamp: email.clickedAt.toISOString() });
    }
    if (email.openedAt) {
      activities.push({ ...base, type: "opened", timestamp: email.openedAt.toISOString() });
    }
    if (email.bouncedAt) {
      activities.push({ ...base, type: "bounced", timestamp: email.bouncedAt.toISOString() });
    }
    if (email.sentAt) {
      const isFollowup = (email.stepNumber || 1) > 1;
      activities.push({
        ...base,
        type: isFollowup ? "followup" : "sent",
        timestamp: email.sentAt.toISOString(),
      });
    }
  }

  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, limit);
}
