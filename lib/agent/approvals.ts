import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentActionApprovals } from "@/lib/db/schema";
import type { AgentContext } from "@/lib/agent/types";

export async function createApprovalRequest(
  context: AgentContext & { runId: string },
  toolName: string,
  input: Record<string, unknown>,
  reason: string
) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const [approval] = await db
    .insert(agentActionApprovals)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      agentId: context.agentId,
      runId: context.runId,
      toolName,
      input,
      reason,
      expiresAt,
    })
    .returning();

  return approval;
}

export async function decideApproval(
  approvalId: string,
  userId: string,
  status: "approved" | "rejected"
) {
  const [approval] = await db
    .update(agentActionApprovals)
    .set({ status, decidedBy: userId, decidedAt: new Date() })
    .where(eq(agentActionApprovals.id, approvalId))
    .returning();

  return approval || null;
}
