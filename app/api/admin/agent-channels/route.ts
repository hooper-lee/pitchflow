import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentChannelBindings } from "@/lib/db/schema";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const bindings = await db
      .select()
      .from(agentChannelBindings)
      .orderBy(desc(agentChannelBindings.createdAt))
      .limit(100);

    return apiResponse({ bindings });
  } catch (error) {
    return handleApiError(error);
  }
}
