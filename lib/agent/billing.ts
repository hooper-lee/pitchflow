import { db } from "@/lib/db";
import { agentUsageRecords } from "@/lib/db/schema";
import type { AgentContext } from "@/lib/agent/types";
import {
  AGENT_PLANNER_CREDIT_COST,
  AGENT_RUN_CREDIT_COST,
  type AgentPlanPolicy,
} from "@/lib/agent/policies/plan-policy";
import { and, eq, gte, sql } from "drizzle-orm";

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getMonthlyAgentCreditsUsed(tenantId: string) {
  const [usage] = await db
    .select({
      credits: sql<number>`coalesce(sum(${agentUsageRecords.credits}), 0)`,
    })
    .from(agentUsageRecords)
    .where(
      and(
        eq(agentUsageRecords.tenantId, tenantId),
        gte(agentUsageRecords.createdAt, getCurrentMonthStart())
      )
    );

  return Number(usage?.credits || 0);
}

export async function ensureAgentCreditsAvailable(
  tenantId: string,
  policy: AgentPlanPolicy,
  credits: number
) {
  const usedCredits = await getMonthlyAgentCreditsUsed(tenantId);
  if (usedCredits + credits <= policy.monthlyCredits) return;

  throw new Error("本月 Agent 使用额度已用完，请升级套餐或下月再试。");
}

export async function recordAgentRunUsage(context: AgentContext, credits: number) {
  await db.insert(agentUsageRecords).values({
    tenantId: context.tenantId,
    userId: context.userId,
    agentId: context.agentId,
    runId: context.runId,
    usageType: "conversation",
    credits,
    metadata: { channel: context.channel, plan: context.tenantPlan },
  });
}

export function getInitialAgentUsageCredits() {
  return {
    conversationCredits: AGENT_RUN_CREDIT_COST,
    plannerCredits: AGENT_PLANNER_CREDIT_COST,
    totalCredits: AGENT_RUN_CREDIT_COST + AGENT_PLANNER_CREDIT_COST,
  };
}

export async function recordAgentPlannerUsage(context: AgentContext, credits: number) {
  await db.insert(agentUsageRecords).values({
    tenantId: context.tenantId,
    userId: context.userId,
    agentId: context.agentId,
    runId: context.runId,
    usageType: "model",
    credits,
    metadata: { purpose: "planner" },
  });
}

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
