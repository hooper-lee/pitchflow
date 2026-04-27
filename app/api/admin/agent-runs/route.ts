import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns, agentToolCalls, agentUsageRecords } from "@/lib/db/schema";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const [runs, toolCalls, usage] = await Promise.all([
      db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(50),
      db.select().from(agentToolCalls).orderBy(desc(agentToolCalls.createdAt)).limit(50),
      db.select().from(agentUsageRecords).orderBy(desc(agentUsageRecords.createdAt)).limit(50),
    ]);

    return apiResponse({ runs, toolCalls, usage });
  } catch (error) {
    return handleApiError(error);
  }
}
