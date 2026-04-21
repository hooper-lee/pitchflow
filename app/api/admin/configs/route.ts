import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

const ENV_BACKED_CONFIGS = [
  "EMAILENGINE_URL",
  "EMAILENGINE_ACCESS_TOKEN",
  "EMAILENGINE_WEBHOOK_SECRET",
  "REDIS_URL",
  "CRON_SECRET",
] as const;

export async function GET() {
  try {
    const configs = await db.select().from(systemConfigs);
    const envConfigs = ENV_BACKED_CONFIGS
      .map((key) => ({
        key,
        value: process.env[key] || "",
        description: "环境变量注入",
        updatedAt: new Date(),
      }))
      .filter((config) => config.value);

    const merged = [...configs.filter((config) => !ENV_BACKED_CONFIGS.includes(config.key as (typeof ENV_BACKED_CONFIGS)[number])), ...envConfigs];
    return apiResponse(merged);
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
