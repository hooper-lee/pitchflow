import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getCampaign } from "@/lib/services/campaign.service";
import {
  getSequenceConfig,
  saveSequenceConfig,
} from "@/lib/services/followup.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const campaign = await getCampaign(params.id, tenantId);
    if (!campaign) return apiError("Campaign not found", 404);

    const config = await getSequenceConfig(params.id);
    return apiResponse(config);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const campaign = await getCampaign(params.id, tenantId);
    if (!campaign) return apiError("Campaign not found", 404);

    const body = await request.json();
    await saveSequenceConfig(params.id, body.steps || []);
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
