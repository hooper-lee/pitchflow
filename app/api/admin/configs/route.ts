import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const configs = await db.select().from(systemConfigs);
    return apiResponse(configs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return apiError("key and value are required", 400);
    }

    const [config] = await db
      .insert(systemConfigs)
      .values({ key, value, description: description || null })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value, description: description || null, updatedAt: new Date() },
      })
      .returning();

    return apiResponse(config);
  } catch (error) {
    return handleApiError(error);
  }
}
