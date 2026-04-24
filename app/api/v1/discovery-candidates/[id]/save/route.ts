import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { saveCandidateToProspect } from "@/lib/services/discovery.service";

interface RouteContext {
  params: { id: string };
}

export async function POST(_: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId, user } = await requireTenant();
    const prospectId = await saveCandidateToProspect(params.id, tenantId, user.id);
    return apiResponse({ candidateId: params.id, prospectId });
  } catch (error) {
    return handleApiError(error);
  }
}
