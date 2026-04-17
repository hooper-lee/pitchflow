import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  getProspect,
  updateProspect,
  deleteProspect,
} from "@/lib/services/prospect.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const prospect = await getProspect(params.id, tenantId);

    if (!prospect) {
      return apiError("Prospect not found", 404);
    }

    return apiResponse(prospect);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const prospect = await updateProspect(params.id, tenantId, body);

    if (!prospect) {
      return apiError("Prospect not found", 404);
    }

    return apiResponse(prospect);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    await deleteProspect(params.id, tenantId);
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
