import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { getMaskedFromAddress } from "@/lib/integrations/resend";

// Returns which services are configured (no secret values exposed)
export async function GET() {
  try {
    const keys = [
      "CUSTOM_AI_BASE_URL",
      "CUSTOM_AI_API_KEY",
      "HUNTER_IO_API_KEY",
      "SNOV_CLIENT_ID",
      "SNOV_CLIENT_SECRET",
    ];

    const rows = await db
      .select({ key: systemConfigs.key, value: systemConfigs.value })
      .from(systemConfigs)
      .where(
        or(...keys.map((k) => eq(systemConfigs.key, k)))!
      );

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const fromAddress = await getMaskedFromAddress();

    return apiResponse({
      aiModel: !!(map["CUSTOM_AI_BASE_URL"] && map["CUSTOM_AI_API_KEY"]),
      hunter: !!map["HUNTER_IO_API_KEY"],
      snovio: !!(map["SNOV_CLIENT_ID"] && map["SNOV_CLIENT_SECRET"]),
      fromAddress,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
