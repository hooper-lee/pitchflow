import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { pauseCampaign } from "@/lib/services/campaign.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const campaign = await pauseCampaign(params.id, tenantId);
    return apiResponse(campaign);
  } catch (error) {
    return handleApiError(error);
  }
}
