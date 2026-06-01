import { getAIProvider } from "@/lib/ai";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { getDefaultResearchProvider, getAiPromptConfig, AI_PROMPT_KEYS } from "@/lib/services/config.service";
import type { DiscoveryAiClassifyInput, DiscoveryAiClassifyOutput } from "./types";

export async function classifyCandidateWithAI(
  input: DiscoveryAiClassifyInput
): Promise<DiscoveryAiClassifyOutput> {
  const providerName = await getDefaultResearchProvider();
  const provider = getAIProvider(providerName);
  const mode = input.discoveryMode || "mixed";
  const systemPrompt = await getAiPromptConfig(AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_SYSTEM);
  const userPromptTemplate = await getAiPromptConfig(AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_USER);
  const prompt = buildClassifierPrompt(input, systemPrompt, userPromptTemplate, mode);

  let rawOutput: string;
  try {
    rawOutput = await provider.researchProspect({
      prompt,
      systemPrompt,
      maxTokens: 2200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(wrapAiConfigError(message, providerName));
  }

  try {
    return normalizeAiOutput(parseJsonWithRepair<Partial<DiscoveryAiClassifyOutput>>(sanitize(rawOutput)));
  } catch {
    return fallbackAiOutput(rawOutput);
  }
}

function buildClassifierPrompt(
  input: DiscoveryAiClassifyInput,
  systemPrompt: string,
  userPromptTemplate: string,
  mode: string
): string {
  // 生成场景描述标题
  const description = mode === "b2b"
    ? "B2B 外贸获客（找海外进口商/批发商/分销商）"
    : mode === "b2c"
      ? "B2C/DTC 跨境获客（找海外品牌商/零售商）"
      : "综合外贸获客（同时评估 B2B 和 B2C 两种可能性）";

  // 生成 ICP 画像摘要
  const icpSummary = [
    `画像名称：${input.icpProfile.name}`,
    input.icpProfile.industry ? `行业：${input.icpProfile.industry}` : null,
    input.icpProfile.targetCustomerText ? `目标客户描述：${input.icpProfile.targetCustomerText}` : null,
    input.icpProfile.mustHave?.length ? `必须具备特征：${input.icpProfile.mustHave.join("、")}` : null,
    input.icpProfile.mustNotHave?.length ? `排除特征：${input.icpProfile.mustNotHave.join("、")}` : null,
    input.icpProfile.positiveKeywords?.length ? `正向关键词：${input.icpProfile.positiveKeywords.join("、")}` : null,
    input.icpProfile.negativeKeywords?.length ? `负向关键词：${input.icpProfile.negativeKeywords.join("、")}` : null,
    input.icpProfile.productCategories?.length ? `产品分类：${input.icpProfile.productCategories.join("、")}` : null,
    input.icpProfile.salesModel ? `销售模式：${input.icpProfile.salesModel}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // 替换用户提示词模板中的占位符
  return userPromptTemplate
    .replace("{description}", description)
    .replace("{companyName}", input.companyName || "")
    .replace("{domain}", input.domain)
    .replace("{homepageText}", input.homepageText || "")
    .replace("{aboutText}", input.aboutText || "")
    .replace("{productText}", input.productText || "")
    .replace("{faqText}", input.faqText || "")
    .replace("{searchSnippet}", input.searchSnippet || "")
    .replace("{detectorScore}", String(input.detectorScore || ""))
    .replace("{icpProfile}", icpSummary)
    .replace(
      "{outputSchema}",
      JSON.stringify(
        {
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
          companyRole: "importer | distributor | wholesaler | brand | retailer | unknown",
        },
        null,
        2
      )
    );
}

function sanitize(value: string) {
  return value
    .replace(/<\/?think>/gi, "")
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
    companyRole: output.companyRole || "unknown",
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
    companyRole: "unknown",
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value?: number) {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  return Math.max(0, Math.min(100, numericValue));
}

function wrapAiConfigError(message: string, providerName: string): string {
  const configGuide =
    providerName === "custom"
      ? "请到「系统配置 > AI 模型」中检查 API Base URL 和 API Key 是否正确配置"
      : providerName === "claude"
        ? "请检查环境变量 ANTHROPIC_API_KEY 是否已设置"
        : "请检查环境变量 OPENAI_API_KEY 是否已设置";

  if (
    message.includes("not configured") ||
    message.includes("not found") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("401 Unauthorized") ||
    message.includes("Incorrect API key") ||
    message.includes("Invalid API key")
  ) {
    return `AI 模型未正确配置（${providerName}）：${message}。${configGuide}`;
  }

  return `AI 模型调用失败：${message}`;
}