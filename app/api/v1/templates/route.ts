import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import {
  listTemplates,
  createTemplate,
} from "@/lib/services/template.service";
import { checkTemplateQuota } from "@/lib/services/quota.service";
import { createTemplateSchema } from "@/lib/utils/validators";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const templates = await listTemplates(tenantId);
    return apiResponse(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const body = await request.json();
    const input = createTemplateSchema.parse(body);
    const quota = await checkTemplateQuota(tenantId);
    if (!quota.allowed) {
      return apiError(quota.message || "Quota exceeded", 403);
    }
    const template = await createTemplate(tenantId, input);
    return apiResponse(template, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
