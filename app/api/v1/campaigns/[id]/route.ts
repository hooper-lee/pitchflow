import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  getCampaign,
  deleteCampaign,
  getCampaignEmails,
} from "@/lib/services/campaign.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const campaign = await getCampaign(params.id, tenantId);
    if (!campaign) return apiError("Campaign not found", 404);

    const emailList = await getCampaignEmails(campaign.id);
    return apiResponse({ ...campaign, emails: emailList });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    await deleteCampaign(params.id, tenantId);
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
