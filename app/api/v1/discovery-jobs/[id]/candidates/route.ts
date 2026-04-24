import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { discoveryCandidateListSchema } from "@/lib/utils/validators";
import { listDiscoveryCandidates } from "@/lib/services/discovery.service";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenant();
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = discoveryCandidateListSchema.parse(searchParams);
    const candidates = await listDiscoveryCandidates(tenantId, params.id, query);
    return apiResponse(candidates);
  } catch (error) {
    return handleApiError(error);
  }
}
