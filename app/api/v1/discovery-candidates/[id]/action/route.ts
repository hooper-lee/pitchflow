import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { discoveryCandidateActionSchema } from "@/lib/utils/validators";
import { actOnDiscoveryCandidate } from "@/lib/services/discovery.service";

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId, user } = await requireTenant();
    const input = discoveryCandidateActionSchema.parse(await request.json());
    const result = await actOnDiscoveryCandidate(params.id, tenantId, user.id, input);
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
