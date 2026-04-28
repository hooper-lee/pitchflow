import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import {
  enableTenantAgent,
  getActiveTenantAgent,
  updateTenantAgent,
} from "@/lib/agent/agent-service";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { canManageAgent } from "@/lib/agent/policies/role-policy";
import { normalizeAgentPlan, normalizeAgentRole } from "@/lib/agent/permissions";
import { getTenant } from "@/lib/services/tenant.service";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const updateAgentSchema = z.object({
  agentId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const { user, tenantId } = await requireTenant();
    const tenant = await getTenant(tenantId);
    const userRole = normalizeAgentRole(user.role);
    const tenantPlan = normalizeAgentPlan(tenant?.plan);
    const agent = await getActiveTenantAgent(tenantId);

    return apiResponse({
      agent,
      enabled: Boolean(agent),
      canManage: canManageAgent(userRole),
      policy: getAgentPlanPolicy(tenantPlan),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const { user, tenantId } = await requireTenant();
    const userRole = normalizeAgentRole(user.role);
    if (!canManageAgent(userRole)) return apiError("Only team admins can enable Agent", 403);

    const agent = await enableTenantAgent(tenantId, user.id);
    return apiResponse({ agent, enabled: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const userRole = normalizeAgentRole(user.role);
    if (!canManageAgent(userRole)) return apiError("Only team admins can manage Agent", 403);

    const body = updateAgentSchema.parse(await request.json());
    const agent = await updateTenantAgent(tenantId, body.agentId, {
      name: body.name,
      isActive: body.isActive,
    });
    if (!agent) return apiError("Agent not found", 404);

    return apiResponse({ agent });
  } catch (error) {
    return handleApiError(error);
  }
}
