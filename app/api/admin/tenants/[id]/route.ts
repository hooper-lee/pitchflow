import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, params.id))
      .limit(1);

    if (!tenant) return apiError("Tenant not found", 404);
    return apiResponse(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.plan) updateData.plan = body.plan;
    if (body.apiQuota !== undefined) updateData.apiQuota = body.apiQuota;
    if (body.name) updateData.name = body.name;

    const [tenant] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, params.id))
      .returning();

    if (!tenant) return apiError("Tenant not found", 404);
    return apiResponse(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}
