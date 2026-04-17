import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getTenant, updateTenantSettings } from "@/lib/services/tenant.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const tenant = await getTenant(tenantId);
    return apiResponse(tenant?.settings || {});
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const tenant = await updateTenantSettings(tenantId, body);
    return apiResponse(tenant?.settings);
  } catch (error) {
    return handleApiError(error);
  }
}
