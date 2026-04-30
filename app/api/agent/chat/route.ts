import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { getTenant } from "@/lib/services/tenant.service";
import { handleApiError } from "@/lib/utils/api-handler";
import { normalizeAgentPlan, normalizeAgentRole } from "@/lib/agent/permissions";
import { runAgent } from "@/lib/agent/runtime";

type AgentResponseCard = {
  kind: "tool" | "status";
  title: string;
  status: string;
  detail?: string;
};

const agentChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
});

function buildCards(toolCalls: Awaited<ReturnType<typeof runAgent>>["toolCalls"]): AgentResponseCard[] {
  const cards: AgentResponseCard[] = [];

  for (const toolCall of toolCalls) {
    if (!toolCall.output || typeof toolCall.output !== "object") {
      cards.push({
        kind: "tool",
        title: toolCall.toolName,
        status: toolCall.status,
        detail: toolCall.errorMessage || "",
      });
      continue;
    }

    const output = toolCall.output as {
      checks?: Array<{ title: string; ready: boolean; detail: string; action: string }>;
    };

    if (!Array.isArray(output.checks)) {
      cards.push({ kind: "tool", title: toolCall.toolName, status: toolCall.status });
      continue;
    }

    for (const check of output.checks) {
      cards.push({
        kind: "status",
        title: check.title,
        status: check.ready ? "已完成" : "待处理",
        detail: check.ready ? check.detail : `${check.detail} ${check.action}`,
      });
    }
  }

  return cards;
}

export async function POST(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const tenant = await getTenant(tenantId);
    const body = agentChatRequestSchema.parse(await request.json());
    const agentResult = await runAgent({
      tenantId,
      userId: user.id,
      userRole: normalizeAgentRole(user.role),
      tenantPlan: normalizeAgentPlan(tenant?.plan),
      channel: "web",
      message: body.message,
      conversationId: body.conversationId,
    });

    return NextResponse.json({
      reply: agentResult.reply,
      conversationId: agentResult.conversationId,
      runId: agentResult.runId,
      status: agentResult.status,
      intent: agentResult.intent,
      cards: [...(agentResult.cards || []), ...buildCards(agentResult.toolCalls)],
      tools: agentResult.toolCalls.map((toolCall) => ({
        title: toolCall.toolName,
        status: toolCall.status,
        detail: toolCall.errorMessage,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
