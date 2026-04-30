import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentConversations,
  agentMessages,
  agentRuns,
  agentToolCalls,
} from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/services/audit.service";
import { getActiveTenantAgent } from "@/lib/agent/agent-service";
import { createApprovalRequest } from "@/lib/agent/approvals";
import {
  ensureAgentCreditsAvailable,
  getInitialAgentUsageCredits,
  recordAgentPlannerUsage,
  recordAgentRunUsage,
  recordAgentToolUsage,
} from "@/lib/agent/billing";
import { authorizeAgentChannel } from "@/lib/agent/policies/channel-policy";
import { getAgentPlanPolicy, isAgentIntentAllowed } from "@/lib/agent/policies/plan-policy";
import { authorizeAgentWorkflow } from "@/lib/agent/policies/workflow-policy";
import { canUseAgent } from "@/lib/agent/policies/role-policy";
import { planAgentResponseWithModel } from "@/lib/agent/planner";
import { authorizeAgentTool } from "@/lib/agent/permissions";
import { summarizeAgentResult } from "@/lib/agent/response-summarizer";
import { getAgentTool } from "@/lib/agent/tool-registry";
import { buildAgentDisabledResult } from "@/lib/agent/runtime-results";
import { handleWorkflowTurn } from "@/lib/agent/workflows/engine";
import type {
  AgentContext,
  AgentResponseCard,
  AgentRunResult,
  AgentToolCallResult,
  RunAgentInput,
} from "@/lib/agent/types";

function buildConversationTitle(message: string) {
  return message.trim().slice(0, 48) || "新对话";
}

function buildToolReply(toolCallResult: AgentToolCallResult, fallbackReply: string) {
  if (toolCallResult.status !== "completed") {
    return `${fallbackReply}\n\n工具执行未完成：${toolCallResult.errorMessage || "请稍后重试。"}`;
  }

  const output = toolCallResult.output;
  if (output && typeof output === "object" && "summary" in output) {
    const toolSummary = String((output as { summary: unknown }).summary);
    return fallbackReply && fallbackReply !== toolSummary
      ? `${fallbackReply}\n\n${toolSummary}`
      : toolSummary;
  }

  return fallbackReply;
}

async function getOrCreateConversation(input: RunAgentInput, agentId: string) {
  if (input.conversationId) {
    const [existingConversation] = await db
      .select()
      .from(agentConversations)
      .where(
        and(
          eq(agentConversations.id, input.conversationId),
          eq(agentConversations.tenantId, input.tenantId)
        )
      )
      .limit(1);

    if (existingConversation) return existingConversation;
  }

  const [createdConversation] = await db
    .insert(agentConversations)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId,
      channel: input.channel,
      title: buildConversationTitle(input.message),
    })
    .returning();

  return createdConversation;
}

async function createAgentRun(
  input: RunAgentInput,
  agentId: string,
  conversationId: string,
  contextMessages: Array<{ role: string; content: string }>
) {
  const [run] = await db
    .insert(agentRuns)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId,
      conversationId,
      channel: input.channel,
      status: "running",
      input: { message: input.message, contextMessages: contextMessages || [] },
      startedAt: new Date(),
    })
    .returning();

  return run;
}

async function loadConversationContextMessages(
  tenantId: string,
  conversationId: string,
  limit: number
) {
  if (limit <= 0) return [];

  const recentMessages = await db
    .select({
      role: agentMessages.role,
      content: agentMessages.content,
      createdAt: agentMessages.createdAt,
    })
    .from(agentMessages)
    .where(
      and(
        eq(agentMessages.tenantId, tenantId),
        eq(agentMessages.conversationId, conversationId)
      )
    )
    .orderBy(desc(agentMessages.createdAt))
    .limit(limit);

  return recentMessages.reverse().map(({ role, content }) => ({ role, content }));
}

async function saveMessage(
  tenantId: string,
  conversationId: string,
  role: "user" | "assistant" | "tool",
  content: string,
  metadata: Record<string, unknown> = {}
) {
  await db.insert(agentMessages).values({
    tenantId,
    conversationId,
    role,
    content,
    metadata,
  });
}

function buildRunStatus(toolCalls: AgentToolCallResult[]) {
  if (toolCalls.some((toolCall) => toolCall.status === "requires_approval")) {
    return "requires_approval" as const;
  }
  if (toolCalls.some((toolCall) => toolCall.status === "failed")) return "failed" as const;
  return "completed" as const;
}

async function executePlannedTool(
  context: AgentContext,
  toolName: string,
  input: Record<string, unknown>
) {
  const tool = getAgentTool(toolName);
  if (!tool) {
    return { toolName, status: "failed" as const, errorMessage: "未找到可用工具" };
  }
  if (!context.runId) {
    return { toolName, status: "failed" as const, errorMessage: "缺少 Agent 运行上下文" };
  }
  const executableContext = { ...context, runId: context.runId };

  const authorization = authorizeAgentTool(executableContext, tool);
  if (!authorization.allowed) {
    if (authorization.status === "requires_approval") {
      const approval = await createApprovalRequest(
        executableContext,
        tool.name,
        input,
        authorization.reason || "该操作需要审批"
      );
      return {
        toolName,
        status: "requires_approval" as const,
        errorMessage: authorization.reason,
        approvalId: approval.id,
      };
    }
    return { toolName, status: authorization.status, errorMessage: authorization.reason };
  }

  await ensureAgentCreditsAvailable(
    context.tenantId,
    getAgentPlanPolicy(context.tenantPlan),
    tool.creditCost
  );

  const toolCall = await createToolCall(executableContext, tool, input);

  try {
    const parsedInput = tool.schema.parse(input);
    const output = await tool.execute(executableContext, parsedInput);
    await db
      .update(agentToolCalls)
      .set({
        status: "completed",
        output: output as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(agentToolCalls.id, toolCall.id));
    await recordAgentToolUsage(context, tool.name, tool.creditCost);
    return { toolName, status: "completed" as const, output };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "工具执行失败";
    await db
      .update(agentToolCalls)
      .set({ status: "failed", errorMessage, completedAt: new Date() })
      .where(eq(agentToolCalls.id, toolCall.id));
    return { toolName, status: "failed" as const, errorMessage };
  }
}

async function createToolCall(
  context: AgentContext & { runId: string },
  tool: NonNullable<ReturnType<typeof getAgentTool>>,
  input: Record<string, unknown>
) {
  const [toolCall] = await db
    .insert(agentToolCalls)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      agentId: context.agentId,
      conversationId: context.conversationId,
      runId: context.runId,
      toolName: tool.name,
      toolkit: tool.toolkit,
      input,
      status: "running",
      riskLevel: tool.riskLevel,
    })
    .returning();

  return toolCall;
}

async function completeAgentRun(
  input: RunAgentInput,
  agentId: string,
  conversationId: string,
  runId: string,
  result: Pick<AgentRunResult, "status" | "intent" | "reply" | "toolCalls">
    & { cards?: AgentResponseCard[]; plannerType?: string }
) {
  await saveMessage(input.tenantId, conversationId, "assistant", result.reply, {
    intent: result.intent,
    plannerType: result.plannerType,
  });
  await db
    .update(agentRuns)
    .set({
      status: result.status,
      intent: result.intent,
      output: {
        reply: result.reply,
        toolCalls: result.toolCalls,
        cards: result.cards || [],
        plannerType: result.plannerType,
      },
      completedAt: new Date(),
    })
    .where(eq(agentRuns.id, runId));
  await db
    .update(agentConversations)
    .set({ updatedAt: new Date() })
    .where(eq(agentConversations.id, conversationId));
  await logAuditEvent({
    userId: input.userId,
    tenantId: input.tenantId,
    action: "agent.run",
    resource: "agent",
    resourceId: agentId,
    detail: { runId, intent: result.intent, status: result.status, plannerType: result.plannerType },
  });
}

async function updateConversationMetadata(conversationId: string, metadata: Record<string, unknown>) {
  await db
    .update(agentConversations)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(agentConversations.id, conversationId));
}

async function failAgentRunWithReply(
  input: RunAgentInput,
  agentId: string,
  conversationId: string,
  runId: string,
  error: unknown
) {
  const errorMessage = error instanceof Error ? error.message : "操作失败";
  const reply = `这一步没有执行成功：${errorMessage}。你可以补充信息后重试，或让我先检查当前配置。`;
  await completeAgentRun(input, agentId, conversationId, runId, {
    status: "failed",
    intent: "agent_error",
    reply,
    toolCalls: [],
    cards: [],
    plannerType: "workflow",
  });
  return {
    conversationId,
    runId,
    status: "failed" as const,
    intent: "agent_error",
    reply,
    toolCalls: [],
    cards: [],
  };
}

async function completePolicyBlockedRun(
  input: RunAgentInput,
  agentId: string,
  conversationId: string,
  runId: string,
  intent: string,
  reason: string
) {
  const cards = [{ kind: "status" as const, title: "套餐策略", status: "已拦截", detail: reason }];
  await completeAgentRun(input, agentId, conversationId, runId, {
    status: "failed",
    intent,
    reply: reason,
    toolCalls: [],
    cards,
    plannerType: "rules",
  });

  return {
    conversationId,
    runId,
    status: "failed" as const,
    intent,
    reply: reason,
    toolCalls: [],
    cards,
  };
}

async function completeWorkflowQuestionRun(
  input: RunAgentInput,
  agentId: string,
  conversationId: string,
  runId: string,
  intent: string,
  reply: string,
  cards: AgentResponseCard[]
) {
  await completeAgentRun(input, agentId, conversationId, runId, {
    status: "completed",
    intent,
    reply,
    toolCalls: [],
    cards,
    plannerType: "workflow",
  });
  return {
    conversationId,
    runId,
    status: "completed" as const,
    intent,
    reply,
    toolCalls: [],
    cards,
  };
}

export async function runAgent(input: RunAgentInput): Promise<AgentRunResult> {
  const planPolicy = getAgentPlanPolicy(input.tenantPlan);
  if (!canUseAgent(input.userRole)) {
    throw new Error("当前账号角色不能使用 Agent。");
  }

  const agent = await getActiveTenantAgent(input.tenantId);
  if (!agent) {
    return buildAgentDisabledResult();
  }

  const channelAuthorization = authorizeAgentChannel(planPolicy, input.channel);
  if (!channelAuthorization.allowed) {
    throw new Error(channelAuthorization.reason);
  }

  const conversation = await getOrCreateConversation(input, agent.id);
  await saveMessage(input.tenantId, conversation.id, "user", input.message);
  const contextMessages = await loadConversationContextMessages(
    input.tenantId,
    conversation.id,
    planPolicy.contextMessageLimit
  );
  const initialUsageCredits = getInitialAgentUsageCredits();

  await ensureAgentCreditsAvailable(
    input.tenantId,
    planPolicy,
    initialUsageCredits.totalCredits
  );

  const run = await createAgentRun(input, agent.id, conversation.id, contextMessages);
  const context: AgentContext = {
    tenantId: input.tenantId,
    userId: input.userId,
    userRole: input.userRole,
    tenantPlan: input.tenantPlan,
    channel: input.channel,
    agentId: agent.id,
    conversationId: conversation.id,
    runId: run.id,
  };

  await recordAgentRunUsage(context, initialUsageCredits.conversationCredits);
  await recordAgentPlannerUsage(context, initialUsageCredits.plannerCredits);

  const plan = await planAgentResponseWithModel(input.message);
  if (!isAgentIntentAllowed(planPolicy, plan.intent)) {
    return completePolicyBlockedRun(
      input,
      agent.id,
      conversation.id,
      run.id,
      plan.intent,
      "当前 Free 套餐只支持普通对话、配置检查和只读查询。创建资料、挖掘任务、活动或客户需要 Pro 套餐。"
    );
  }

  let workflowResult;
  try {
    workflowResult = handleWorkflowTurn({
      message: input.message,
      metadata: conversation.metadata || {},
      planIntent: plan.intent,
      planReply: plan.reply,
      planSlots: plan.slots || {},
    });
  } catch (error) {
    return failAgentRunWithReply(input, agent.id, conversation.id, run.id, error);
  }
  if (workflowResult.handled) {
    const workflowAuthorization = authorizeAgentWorkflow(
      planPolicy,
      workflowResult.intent || plan.intent
    );
    if (!workflowAuthorization.allowed) {
      return completePolicyBlockedRun(
        input,
        agent.id,
        conversation.id,
        run.id,
        workflowResult.intent || plan.intent,
        workflowAuthorization.reason || "当前套餐不允许执行这个工作流。"
      );
    }
    if (workflowResult.metadata) {
      await updateConversationMetadata(conversation.id, workflowResult.metadata);
    }
    if (!workflowResult.toolCall && workflowResult.reply) {
      return completeWorkflowQuestionRun(
        input,
        agent.id,
        conversation.id,
        run.id,
        workflowResult.intent || plan.intent,
        workflowResult.reply,
        workflowResult.cards || []
      );
    }
  }

  const plannedToolCall = workflowResult?.toolCall || plan.toolCall;
  const toolCalls = plannedToolCall
    ? [await executePlannedTool(context, plannedToolCall.toolName, plannedToolCall.input)]
    : [];
  const fallbackReply = toolCalls[0]
    ? buildToolReply(toolCalls[0], workflowResult?.reply || plan.reply)
    : plan.reply;
  const reply = await summarizeAgentResult({ userMessage: input.message, plan, toolCalls, fallbackReply });
  const status = buildRunStatus(toolCalls);
  const cards = workflowResult?.cards || [];

  await completeAgentRun(input, agent.id, conversation.id, run.id, {
    status,
    intent: workflowResult?.intent || plan.intent,
    reply,
    toolCalls,
    cards,
    plannerType: plan.plannerType,
  });

  return {
    conversationId: conversation.id,
    runId: run.id,
    status,
    intent: workflowResult?.intent || plan.intent,
    reply,
    toolCalls,
    cards,
  };
}
