import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getCampaign } from "@/lib/services/campaign.service";
import { getCampaignStats } from "@/lib/services/analytics.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const campaign = await getCampaign(params.id, tenantId);
    if (!campaign) return apiError("Campaign not found", 404);

    const stats = await getCampaignStats(params.id);
    return apiResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
