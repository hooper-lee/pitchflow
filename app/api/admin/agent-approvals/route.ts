import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentActionApprovals } from "@/lib/db/schema";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const approvals = await db
      .select()
      .from(agentActionApprovals)
      .orderBy(desc(agentActionApprovals.createdAt))
      .limit(100);

    return apiResponse({ approvals });
  } catch (error) {
    return handleApiError(error);
  }
}
