import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { desc, ilike, count, eq } from "drizzle-orm";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { normalizeAgentPlan } from "@/lib/agent/permissions";
import { getMonthlyAgentCreditsByUser } from "@/lib/agent/usage-summary";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(ilike(users.email, `%${search}%`));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        tenantId: users.tenantId,
        tenantPlan: tenants.plan,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(tenants, eq(users.tenantId, tenants.id))
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const userCredits = await getMonthlyAgentCreditsByUser(allUsers.map((user) => user.id));
    const usersWithCredits = allUsers.map((user) => ({
      ...user,
      agentCreditsUsed: userCredits.get(user.id) || 0,
      agentCreditsLimit: getAgentPlanPolicy(normalizeAgentPlan(user.tenantPlan || undefined)).monthlyCredits,
    }));

    return apiResponse({
      users: usersWithCredits,
      total: Number(totalResult?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
