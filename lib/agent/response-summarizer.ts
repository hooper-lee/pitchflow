import { getAIProvider } from "@/lib/ai";
import {
  AI_PROMPT_KEYS,
  getAiPromptConfig,
  getDefaultResearchProvider,
  interpolatePromptTemplate,
} from "@/lib/services/config.service";
import type { AgentPlanResult, AgentToolCallResult } from "@/lib/agent/types";

interface SummarizeAgentResultInput {
  userMessage: string;
  plan: AgentPlanResult;
  toolCalls: AgentToolCallResult[];
  fallbackReply: string;
}

const resultSummaryTimeoutMs = 10000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function buildToolResultPayload(toolCalls: AgentToolCallResult[]) {
  return toolCalls.map((toolCall) => ({
    toolName: toolCall.toolName,
    status: toolCall.status,
    errorMessage: toolCall.errorMessage,
    output: toolCall.output,
    approvalId: toolCall.approvalId,
  }));
}

function cleanModelSummary(summary: string) {
  return summary
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^Let me[\s\S]*?:\s*/i, "")
    .trim();
}

export async function summarizeAgentResult(input: SummarizeAgentResultInput) {
  if (input.toolCalls.length === 0) return input.fallbackReply;

  try {
    const [providerType, systemPrompt, promptTemplate] = await Promise.all([
      getDefaultResearchProvider(),
      getAiPromptConfig(AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_SYSTEM),
      getAiPromptConfig(AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_USER),
    ]);
    const provider = getAIProvider(providerType);
    const prompt = interpolatePromptTemplate(promptTemplate, {
      userMessage: input.userMessage,
      intent: input.plan.intent,
      toolResults: JSON.stringify(buildToolResultPayload(input.toolCalls), null, 2),
    });
    const summary = await withTimeout(
      provider.researchProspect({ prompt, systemPrompt, maxTokens: 500 }),
      resultSummaryTimeoutMs,
      "Agent result summary"
    );
    return cleanModelSummary(summary) || input.fallbackReply;
  } catch {
    return input.fallbackReply;
  }
}
