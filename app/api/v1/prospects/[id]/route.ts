import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  getProspect,
  getProspectContacts,
  updateProspect,
  deleteProspect,
} from "@/lib/services/prospect.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import { logAuditEvent } from "@/lib/services/audit.service";

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

    const contacts = await getProspectContacts(params.id, tenantId);
    return apiResponse({ ...prospect, contacts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = await request.json();
    const prospect = await updateProspect(params.id, tenantId, body);

    if (!prospect) {
      return apiError("Prospect not found", 404);
    }

    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "update",
      resource: "prospect",
      resourceId: prospect.id,
      detail: body,
      ip: request.headers.get("x-forwarded-for") || null,
    });
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
    const { user, tenantId } = await requireTenant();
    await deleteProspect(params.id, tenantId);
    await logAuditEvent({
      userId: user.id,
      tenantId,
      action: "delete",
      resource: "prospect",
      resourceId: params.id,
      ip: request.headers.get("x-forwarded-for") || null,
    });
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
