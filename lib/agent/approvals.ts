import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentActionApprovals, agentToolCalls } from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/services/audit.service";
import { recordAgentToolUsage } from "@/lib/agent/billing";
import { getAgentTool } from "@/lib/agent/tool-registry";
import type { AgentContext, AgentPlan, AgentRole } from "@/lib/agent/types";
import { isAgentPlanAtLeast, isAgentRoleAtLeast } from "@/lib/agent/permissions";
import { canApproveAgentAction } from "@/lib/agent/policies/role-policy";

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
  status: "approved" | "rejected",
  context: { tenantId: string; userRole: AgentRole; tenantPlan: AgentPlan }
) {
  const [currentApproval] = await db
    .select()
    .from(agentActionApprovals)
    .where(
      and(
        eq(agentActionApprovals.id, approvalId),
        eq(agentActionApprovals.tenantId, context.tenantId)
      )
    )
    .limit(1);

  if (!currentApproval) return null;
  if (currentApproval.status !== "pending") throw new Error("该审批已经处理过。");
  if (currentApproval.expiresAt && currentApproval.expiresAt < new Date()) {
    throw new Error("该审批已过期。");
  }
  if (!canApproveAgentAction(context.userRole)) {
    throw new Error("当前账号没有审批权限。");
  }

  const [approval] = await db
    .update(agentActionApprovals)
    .set({ status, decidedBy: userId, decidedAt: new Date() })
    .where(eq(agentActionApprovals.id, approvalId))
    .returning();

  if (approval && status === "approved") {
    await resumeApprovedAction(approval, context.tenantPlan, context.userRole);
  }

  return approval || null;
}

async function resumeApprovedAction(
  approval: typeof agentActionApprovals.$inferSelect,
  tenantPlan: AgentPlan,
  userRole: AgentRole
) {
  const tool = getAgentTool(approval.toolName);
  if (!tool) throw new Error("审批对应的工具不存在。");
  if (!isAgentRoleAtLeast(userRole, tool.requiredRole)) throw new Error("审批人角色权限不足。");
  if (!isAgentPlanAtLeast(tenantPlan, tool.requiredPlan)) throw new Error("当前套餐不支持该操作。");
  if (!approval.runId) throw new Error("审批缺少 Agent 运行上下文。");
  if (!approval.userId && !approval.decidedBy) throw new Error("审批缺少执行用户上下文。");

  const context = {
    tenantId: approval.tenantId,
    userId: approval.userId || approval.decidedBy || "",
    userRole,
    tenantPlan,
    channel: "web" as const,
    agentId: approval.agentId,
    runId: approval.runId,
  };
  const [toolCall] = await db.insert(agentToolCalls).values({
    tenantId: approval.tenantId,
    userId: approval.userId,
    agentId: approval.agentId,
    runId: approval.runId,
    toolName: approval.toolName,
    toolkit: tool.toolkit,
    input: approval.input,
    status: "running",
    riskLevel: tool.riskLevel,
    approvalId: approval.id,
  }).returning();

  try {
    const output = await tool.execute(context, tool.schema.parse(approval.input));
    await db.update(agentToolCalls).set({
      status: "completed",
      output: output as Record<string, unknown>,
      completedAt: new Date(),
    }).where(eq(agentToolCalls.id, toolCall.id));
    await recordAgentToolUsage(context, tool.name, tool.creditCost);
    await logAuditEvent({
      userId: approval.decidedBy || approval.userId || undefined,
      tenantId: approval.tenantId,
      action: "agent.approval.execute",
      resource: "agent_approval",
      resourceId: approval.id,
      detail: { toolName: approval.toolName, status: "completed" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "审批操作执行失败";
    await db.update(agentToolCalls).set({
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    }).where(eq(agentToolCalls.id, toolCall.id));
    throw error;
  }
}
