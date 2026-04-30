import { and, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentUsageRecords } from "@/lib/db/schema";

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function buildCreditsMap(rows: Array<{ id: string | null; credits: number }>) {
  return new Map(
    rows
      .filter((row): row is { id: string; credits: number } => Boolean(row.id))
      .map((row) => [row.id, Number(row.credits || 0)])
  );
}

export async function getMonthlyAgentCreditsByTenant(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      id: agentUsageRecords.tenantId,
      credits: sql<number>`coalesce(sum(${agentUsageRecords.credits}), 0)`,
    })
    .from(agentUsageRecords)
    .where(
      and(
        inArray(agentUsageRecords.tenantId, tenantIds),
        gte(agentUsageRecords.createdAt, getCurrentMonthStart())
      )
    )
    .groupBy(agentUsageRecords.tenantId);

  return buildCreditsMap(rows);
}

export async function getMonthlyAgentCreditsByUser(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      id: agentUsageRecords.userId,
      credits: sql<number>`coalesce(sum(${agentUsageRecords.credits}), 0)`,
    })
    .from(agentUsageRecords)
    .where(
      and(
        inArray(agentUsageRecords.userId, userIds),
        gte(agentUsageRecords.createdAt, getCurrentMonthStart())
      )
    )
    .groupBy(agentUsageRecords.userId);

  return buildCreditsMap(rows);
}
