import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { cancelDiscoveryJob } from "@/lib/services/discovery.service";

interface RouteContext {
  params: { id: string };
}

export async function POST(_: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenant();
    const job = await cancelDiscoveryJob(params.id, tenantId);
    if (!job) {
      return apiError("Discovery job not found", 404);
    }
    return apiResponse(job);
  } catch (error) {
    return handleApiError(error);
  }
}
