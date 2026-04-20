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
    const { tenantId, user } = await requireTenant();
    const body = await request.json();
    const tenant = await getTenant(tenantId);
    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
    const nextAlerts = {
      ...((currentSettings.alerts as Record<string, unknown>) || {}),
      ...((body.alerts as Record<string, unknown>) || {}),
      recipientEmail: user.email,
    };
    const nextSettings = {
      ...currentSettings,
      ...body,
      alerts: nextAlerts,
    };
    const updatedTenant = await updateTenantSettings(tenantId, nextSettings);
    return apiResponse(updatedTenant?.settings);
  } catch (error) {
    return handleApiError(error);
  }
}
