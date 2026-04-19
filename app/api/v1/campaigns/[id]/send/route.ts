import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { startCampaign } from "@/lib/services/campaign.service";
import { checkEmailQuota } from "@/lib/services/quota.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const quota = await checkEmailQuota(tenantId);
    if (!quota.allowed) {
      return apiError(quota.message || "Quota exceeded", 403);
    }
    const result = await startCampaign(params.id, tenantId);
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
