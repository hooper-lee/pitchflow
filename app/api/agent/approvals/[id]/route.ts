import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { decideApproval } from "@/lib/agent/approvals";
import { normalizeAgentPlan, normalizeAgentRole } from "@/lib/agent/permissions";
import { getTenant } from "@/lib/services/tenant.service";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const approvalDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const tenant = await getTenant(tenantId);
    const body = approvalDecisionSchema.parse(await request.json());
    const approval = await decideApproval(params.id, user.id, body.status, {
      tenantId,
      userRole: normalizeAgentRole(user.role),
      tenantPlan: normalizeAgentPlan(tenant?.plan),
    });
    if (!approval) return apiError("Approval not found", 404);
    return apiResponse(approval);
  } catch (error) {
    return handleApiError(error);
  }
}
