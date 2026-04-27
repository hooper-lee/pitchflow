import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentConversations,
  agentMessages,
  agentRuns,
  agents,
  agentToolCalls,
} from "@/lib/db/schema";
import { logAuditEvent } from "@/lib/services/audit.service";
import { createApprovalRequest } from "@/lib/agent/approvals";
import { recordAgentToolUsage } from "@/lib/agent/billing";
import { planAgentResponseWithModel } from "@/lib/agent/planner";
import { authorizeAgentTool } from "@/lib/agent/permissions";
import { summarizeAgentResult } from "@/lib/agent/response-summarizer";
import { getAgentTool } from "@/lib/agent/tool-registry";
import { handleWorkflowTurn } from "@/lib/agent/workflows/engine";
import type {
  AgentContext,
  AgentResponseCard,
  AgentRunResult,
  AgentToolCallResult,
  RunAgentInput,
} from "@/lib/agent/types";

const defaultAgentName = "PitchFlow Agent";
const defaultSystemPrompt =
  "你是 PitchFlow 数字员工，负责帮助外贸团队使用系统完成获客、调研、邮件和跟进。";

function buildConversationTitle(message: string) {
  return message.trim().slice(0, 48) || "新对话";
}

function buildToolReply(toolCallResult: AgentToolCallResult, fallbackReply: string) {
  if (toolCallResult.status !== "completed") {
    return `${fallbackReply}\n\n工具执行未完成：${toolCallResult.errorMessage || "请稍后重试。"}`;
  }

  const output = toolCallResult.output;
  if (output && typeof output === "object" && "summary" in output) {
    return String((output as { summary: unknown }).summary);
  }

  return fallbackReply;
}

async function ensureDefaultAgent(tenantId: string, userId: string) {
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.tenantId, tenantId), eq(agents.name, defaultAgentName)))
    .limit(1);

  if (existingAgent) return existingAgent;

  const [createdAgent] = await db
    .insert(agents)
    .values({
      tenantId,
      name: defaultAgentName,
      description: "PitchFlow 站内数字员工",
      systemPrompt: defaultSystemPrompt,
      enabledToolkits: ["pitchflow.setup"],
      enabledTools: ["pitchflow.setup.check_readiness"],
      createdBy: userId,
    })
    .returning();

  return createdAgent;
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

async function createAgentRun(input: RunAgentInput, agentId: string, conversationId: string) {
  const [run] = await db
    .insert(agentRuns)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      agentId,
      conversationId,
      channel: input.channel,
      status: "running",
      input: { message: input.message },
      startedAt: new Date(),
    })
    .returning();

  return run;
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
  const agent = await ensureDefaultAgent(input.tenantId, input.userId);
  const conversation = await getOrCreateConversation(input, agent.id);
  const run = await createAgentRun(input, agent.id, conversation.id);
  await saveMessage(input.tenantId, conversation.id, "user", input.message);

  const plan = await planAgentResponseWithModel(input.message);
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
