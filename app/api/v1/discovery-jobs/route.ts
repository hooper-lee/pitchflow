import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import {
  createDiscoveryJobSchema,
  discoveryJobListSchema,
} from "@/lib/utils/validators";
import {
  createDiscoveryJob,
  listDiscoveryJobs,
} from "@/lib/services/discovery.service";

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const params = discoveryJobListSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const jobs = await listDiscoveryJobs(tenantId, params);
    return apiResponse(jobs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireTenant();
    const input = createDiscoveryJobSchema.parse(await request.json());
    const job = await createDiscoveryJob(tenantId, user.id, input);
    return apiResponse({ id: job.id, status: job.status, job }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
