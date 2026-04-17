import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { usageRecords, tenants } from "@/lib/db/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get usage by tenant
    const tenantUsage = await db
      .select({
        tenantId: usageRecords.tenantId,
        tenantName: tenants.name,
        tenantPlan: tenants.plan,
        resource: usageRecords.resource,
        total: sql<number>`COALESCE(SUM(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .leftJoin(tenants, eq(usageRecords.tenantId, tenants.id))
      .where(gte(usageRecords.createdAt, since))
      .groupBy(usageRecords.tenantId, tenants.name, tenants.plan, usageRecords.resource)
      .orderBy(desc(sql`COALESCE(SUM(${usageRecords.quantity}), 0)`));

    // Get usage over time
    const usageOverTime = await db
      .select({
        date: sql<string>`DATE(${usageRecords.createdAt})`.as("date"),
        resource: usageRecords.resource,
        total: sql<number>`COALESCE(SUM(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, since))
      .groupBy(sql`DATE(${usageRecords.createdAt})`, usageRecords.resource)
      .orderBy(sql`DATE(${usageRecords.createdAt})`);

    return apiResponse({
      tenantUsage,
      usageOverTime,
      days,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
