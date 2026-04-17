import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { createApiKey, listApiKeys } from "@/lib/services/api-key.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const keys = await listApiKeys(tenantId);
    return apiResponse(keys);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { name, permissions } = await request.json();
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    const key = await createApiKey(tenantId, name, permissions);
    return apiResponse(key, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
