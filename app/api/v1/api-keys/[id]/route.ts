import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();

    const [apiKey] = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, params.id), eq(apiKeys.tenantId, tenantId)))
      .limit(1);

    if (!apiKey) return apiError("API key not found", 404);
    return apiResponse(apiKey);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();

    const [apiKey] = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, params.id), eq(apiKeys.tenantId, tenantId)))
      .returning();

    if (!apiKey) return apiError("API key not found", 404);
    return apiResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
