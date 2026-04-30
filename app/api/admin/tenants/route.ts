import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { normalizeAgentPlan } from "@/lib/agent/permissions";
import { getMonthlyAgentCreditsByTenant } from "@/lib/agent/usage-summary";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ count: count() }).from(tenants);

    const allTenants = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(limit)
      .offset(offset);
    const tenantCredits = await getMonthlyAgentCreditsByTenant(
      allTenants.map((tenant) => tenant.id)
    );
    const tenantsWithCredits = allTenants.map((tenant) => {
      const planPolicy = getAgentPlanPolicy(normalizeAgentPlan(tenant.plan));
      return {
        ...tenant,
        agentCreditsUsed: tenantCredits.get(tenant.id) || 0,
        agentCreditsLimit: planPolicy.monthlyCredits,
      };
    });

    return apiResponse({
      tenants: tenantsWithCredits,
      total: Number(totalResult?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
