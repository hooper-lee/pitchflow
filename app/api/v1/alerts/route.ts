import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getTenant, updateTenantSettings } from "@/lib/services/tenant.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

function resolveTrackingSettings(settings: Record<string, unknown>) {
  return (
    (settings.tracking as Record<string, unknown>) ||
    (settings.alerts as Record<string, unknown>) ||
    {}
  );
}

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const tenant = await getTenant(tenantId);
    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};
    const tracking = resolveTrackingSettings(currentSettings);

    return apiResponse({
      ...currentSettings,
      tracking,
    });
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
    const nextTracking = {
      ...resolveTrackingSettings(currentSettings),
      ...((body.tracking as Record<string, unknown>) || {}),
      ...((body.alerts as Record<string, unknown>) || {}),
      recipientEmail: user.email,
    };
    const nextSettings = {
      ...currentSettings,
      ...body,
      tracking: nextTracking,
    };

    delete nextSettings.alerts;

    const updatedTenant = await updateTenantSettings(tenantId, nextSettings);
    const updatedSettings = (updatedTenant?.settings as Record<string, unknown>) || {};

    return apiResponse({
      ...updatedSettings,
      tracking: resolveTrackingSettings(updatedSettings),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
