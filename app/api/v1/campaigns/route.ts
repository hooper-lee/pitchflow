import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { listCampaigns, createCampaign } from "@/lib/services/campaign.service";
import { checkCampaignQuota } from "@/lib/services/quota.service";
import { createCampaignSchema } from "@/lib/utils/validators";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import { logAuditEvent } from "@/lib/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const result = await listCampaigns(tenantId, limit);
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();
    const input = createCampaignSchema.parse(body);
    const quota = await checkCampaignQuota(tenantId);
    if (!quota.allowed) {
      return apiError(quota.message || "Quota exceeded", 403);
    }
    const campaign = await createCampaign(tenantId, input);
    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "create",
      resource: "campaign",
      resourceId: campaign.id,
      detail: {
        name: campaign.name,
        prospectCount: input.prospectIds?.length || 0,
      },
      ip: request.headers.get("x-forwarded-for") || null,
    });
    return apiResponse(campaign, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
