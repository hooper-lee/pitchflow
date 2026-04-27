import { db } from "@/lib/db";
import { agentUsageRecords } from "@/lib/db/schema";
import type { AgentContext } from "@/lib/agent/types";

export async function recordAgentToolUsage(
  context: AgentContext,
  toolName: string,
  credits: number
) {
  await db.insert(agentUsageRecords).values({
    tenantId: context.tenantId,
    userId: context.userId,
    agentId: context.agentId,
    runId: context.runId,
    usageType: "tool",
    toolCalls: 1,
    credits,
    metadata: { toolName },
  });
}
