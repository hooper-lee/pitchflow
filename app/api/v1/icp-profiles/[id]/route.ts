import { NextRequest } from "next/server";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { requireTenant } from "@/lib/auth";
import { upsertIcpProfileSchema } from "@/lib/utils/validators";
import {
  deleteIcpProfile,
  getIcpProfile,
  updateIcpProfile,
} from "@/lib/services/icp-profile.service";

interface RouteContext {
  params: { id: string };
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenant();
    const profile = await getIcpProfile(params.id, tenantId);
    if (!profile) {
      return apiError("ICP profile not found", 404);
    }
    return apiResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenant();
    const input = upsertIcpProfileSchema.parse(await request.json());
    const profile = await updateIcpProfile(params.id, tenantId, input);
    if (!profile) {
      return apiError("ICP profile not found", 404);
    }
    return apiResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenant();
    const deleted = await deleteIcpProfile(params.id, tenantId);
    if (!deleted) {
      return apiError("ICP profile not found", 404);
    }
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
