import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { startCampaign } from "@/lib/services/campaign.service";
import { checkEmailQuota } from "@/lib/services/quota.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import { logAuditEvent } from "@/lib/services/audit.service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const quota = await checkEmailQuota(tenantId);
    if (!quota.allowed) {
      return apiError(quota.message || "Quota exceeded", 403);
    }
    const result = await startCampaign(params.id, tenantId, user.email || undefined);
    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "start",
      resource: "campaign",
      resourceId: params.id,
      detail: { emailCount: result.emailCount },
      ip: request.headers.get("x-forwarded-for") || null,
    });
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
