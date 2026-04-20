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
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import { logAuditEvent } from "@/lib/services/audit.service";

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

    return apiResponse({ items: result.items, total: result.total, page: result.page, totalPages: result.totalPages }, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();

    // Check if it's a discovery request (domain or industry/keywords)
    if (body.domain || body.industry || body.keywords) {
      const input = discoverProspectsSchema.parse(body);
      const quota = await checkProspectQuota(tenantId, 1);
      if (!quota.allowed) {
        return apiError(quota.message || "Quota exceeded", 403);
      }
      const prospects = await discoverProspects(tenantId, input);
      await logAuditEvent({
        userId: user.id,
        tenantId,
        action: "discover",
        resource: "prospect",
        detail: {
          domain: input.domain || null,
          industry: input.industry || null,
          keywords: input.keywords || null,
          count: prospects.length,
        },
        ip: request.headers.get("x-forwarded-for") || null,
      });
      return apiResponse(prospects, 201);
    }

    const input = createProspectSchema.parse(body);
    const quota = await checkProspectQuota(tenantId, 1);
    if (!quota.allowed) {
      return apiError(quota.message || "Quota exceeded", 403);
    }
    const prospect = await createProspect(tenantId, input);
    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "create",
      resource: "prospect",
      resourceId: prospect.id,
      detail: {
        companyName: prospect.companyName,
        email: prospect.email,
      },
      ip: request.headers.get("x-forwarded-for") || null,
    });
    return apiResponse(prospect, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
