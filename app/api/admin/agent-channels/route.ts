import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentChannelBindings, tenants, users } from "@/lib/db/schema";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const bindings = await db
      .select({
        id: agentChannelBindings.id,
        channel: agentChannelBindings.channel,
        externalUserId: agentChannelBindings.externalUserId,
        externalOpenId: agentChannelBindings.externalOpenId,
        isActive: agentChannelBindings.isActive,
        createdAt: agentChannelBindings.createdAt,
        updatedAt: agentChannelBindings.updatedAt,
        tenantId: agentChannelBindings.tenantId,
        tenantName: tenants.name,
        tenantPlan: tenants.plan,
        userId: agentChannelBindings.userId,
        userEmail: users.email,
        userName: users.name,
        userRole: users.role,
      })
      .from(agentChannelBindings)
      .leftJoin(tenants, eq(agentChannelBindings.tenantId, tenants.id))
      .leftJoin(users, eq(agentChannelBindings.userId, users.id))
      .orderBy(desc(agentChannelBindings.createdAt))
      .limit(100);

    return apiResponse({ bindings });
  } catch (error) {
    return handleApiError(error);
  }
}
