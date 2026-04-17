import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/services/template.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const template = await getTemplate(params.id, tenantId);
    if (!template) return apiError("Template not found", 404);
    return apiResponse(template);
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
    const template = await updateTemplate(params.id, tenantId, body);
    if (!template) return apiError("Template not found", 404);
    return apiResponse(template);
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
    await deleteTemplate(params.id, tenantId);
    return apiResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
