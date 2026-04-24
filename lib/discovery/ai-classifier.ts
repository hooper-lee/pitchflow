import { getAIProvider } from "@/lib/ai";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { getDefaultResearchProvider } from "@/lib/services/config.service";
import type { DiscoveryAiClassifyInput, DiscoveryAiClassifyOutput } from "./types";

const AI_CLASSIFIER_SYSTEM_PROMPT = [
  "你是 B2B/B2C 外贸获客 ICP 评估器。",
  "只能基于输入证据判断，不允许编造。",
  "如果证据不足，返回 needs_review。",
  "输出严格 JSON，不要 markdown。",
].join("\n");

export async function classifyCandidateWithAI(
  input: DiscoveryAiClassifyInput
): Promise<DiscoveryAiClassifyOutput> {
  const provider = getAIProvider(await getDefaultResearchProvider());
  const prompt = buildClassifierPrompt(input);
  const rawOutput = await provider.researchProspect({
    prompt,
    systemPrompt: AI_CLASSIFIER_SYSTEM_PROMPT,
    maxTokens: 1800,
  });

  try {
    return normalizeAiOutput(parseJsonWithRepair<Partial<DiscoveryAiClassifyOutput>>(sanitize(rawOutput)));
  } catch {
    return fallbackAiOutput(rawOutput);
  }
}

function buildClassifierPrompt(input: DiscoveryAiClassifyInput) {
  return JSON.stringify(
    {
      task: "Classify whether this company matches the ICP profile.",
      companyName: input.companyName,
      domain: input.domain,
      homepageText: input.homepageText,
      aboutText: input.aboutText,
      productText: input.productText,
      faqText: input.faqText,
      searchSnippet: input.searchSnippet,
      detectorSignals: {
        detectorScore: input.detectorScore,
        detectorDimensions: input.detectorDimensions,
      },
      customInstructions: input.icpProfile.promptTemplate || undefined,
      icpProfile: input.icpProfile,
      outputSchema: {
        isTargetCustomer: true,
        confidence: 0.8,
        scores: {
          businessModelFit: 0,
          productFit: 0,
          salesModelFit: 0,
          exclusionRisk: 0,
        },
        matchedRequirements: ["string"],
        rejectionReasons: ["string"],
        evidence: [{ source: "about", quote: "string", reason: "string" }],
        recommendedDecision: "accepted | rejected | needs_review",
        reasoning: "short reasoning",
      },
    },
    null,
    2
  );
}

function sanitize(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function normalizeAiOutput(
  output: Partial<DiscoveryAiClassifyOutput>
): DiscoveryAiClassifyOutput {
  return {
    isTargetCustomer: Boolean(output.isTargetCustomer),
    confidence: clamp(output.confidence ?? 0.5),
    scores: {
      businessModelFit: clampScore(output.scores?.businessModelFit),
      productFit: clampScore(output.scores?.productFit),
      salesModelFit: clampScore(output.scores?.salesModelFit),
      exclusionRisk: clampScore(output.scores?.exclusionRisk),
    },
    matchedRequirements: output.matchedRequirements || [],
    rejectionReasons: output.rejectionReasons || [],
    evidence: output.evidence || [],
    recommendedDecision: output.recommendedDecision || "needs_review",
    reasoning: output.reasoning || "Insufficient evidence.",
  };
}

function fallbackAiOutput(rawOutput: string): DiscoveryAiClassifyOutput {
  return {
    isTargetCustomer: false,
    confidence: 0.3,
    scores: {
      businessModelFit: 0,
      productFit: 0,
      salesModelFit: 0,
      exclusionRisk: 50,
    },
    matchedRequirements: [],
    rejectionReasons: ["ai_parse_failed"],
    evidence: rawOutput
      ? [{ source: "ai", quote: rawOutput.slice(0, 280), reason: "raw AI response" }]
      : [],
    recommendedDecision: "needs_review",
    reasoning: "AI output could not be parsed safely.",
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value?: number) {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  return Math.max(0, Math.min(100, numericValue));
}
