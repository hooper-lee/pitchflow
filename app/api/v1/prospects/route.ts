import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  listProspects,
  createProspect,
  discoverProspects,
} from "@/lib/services/prospect.service";
import { checkProspectQuota } from "@/lib/services/quota.service";
import {
  createProspectSchema,
  discoverProspectsSchema,
  paginationSchema,
} from "@/lib/utils/validators";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const params = paginationSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );

    const result = await listProspects({
      tenantId,
      ...params,
    });

    return apiResponse(result.items, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();

    // Check if it's a discovery request (domain or industry/keywords)
    if (body.domain || body.industry || body.keywords) {
      const input = discoverProspectsSchema.parse(body);
      const quota = await checkProspectQuota(tenantId, 1);
      if (!quota.allowed) {
        return apiResponse({ error: quota.message }, 403);
      }
      const prospects = await discoverProspects(tenantId, input);
      return apiResponse(prospects, 201);
    }

    const input = createProspectSchema.parse(body);
    const quota = await checkProspectQuota(tenantId, 1);
    if (!quota.allowed) {
      return apiResponse({ error: quota.message }, 403);
    }
    const prospect = await createProspect(tenantId, input);
    return apiResponse(prospect, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
