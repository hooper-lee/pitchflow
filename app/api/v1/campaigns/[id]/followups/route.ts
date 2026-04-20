import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getCampaign } from "@/lib/services/campaign.service";
import {
  getSequenceConfig,
  saveSequenceConfig,
} from "@/lib/services/followup.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import { logAuditEvent } from "@/lib/services/audit.service";

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
    const { user, tenantId } = await requireTenant();
    const campaign = await getCampaign(params.id, tenantId);
    if (!campaign) return apiError("Campaign not found", 404);

    const body = await request.json();
    await saveSequenceConfig(params.id, body.steps || []);
    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "update_followups",
      resource: "campaign",
      resourceId: params.id,
      detail: { steps: body.steps || [] },
      ip: request.headers.get("x-forwarded-for") || null,
    });
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
