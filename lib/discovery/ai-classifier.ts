import { getAIProvider } from "@/lib/ai";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { getDefaultResearchProvider } from "@/lib/services/config.service";
import type { DiscoveryAiClassifyInput, DiscoveryAiClassifyOutput } from "./types";

/**
 * B2B 模式 AI 分类系统 Prompt
 * 侧重判断公司是否为海外进口商/批发商/分销商
 */
const B2B_SYSTEM_PROMPT = [
  "你是 B2B 外贸获客 ICP 评估器，专门评估一家海外公司是否值得作为外贸客户开发。",
  "你的目标是找出真正的海外进口商、批发商和分销商。",
  "只能基于输入证据判断，不允许编造。",
  "如果证据不足，返回 needs_review。",
  "输出严格 JSON，不要 markdown。",
].join("\n");

/**
 * B2C/DTC 模式 AI 分类系统 Prompt
 * 侧重判断公司是否为品牌商/零售商/DTC品牌
 */
const B2C_SYSTEM_PROMPT = [
  "你是 B2C/DTC 跨境获客 ICP 评估器，专门评估一家海外品牌/零售商是否值得开发。",
  "你的目标是找出有合作潜力的品牌商、零售商和 DTC 品牌。",
  "只能基于输入证据判断，不允许编造。",
  "如果证据不足，返回 needs_review。",
  "输出严格 JSON，不要 markdown。",
].join("\n");

/**
 * 混合模式系统 Prompt
 */
const MIXED_SYSTEM_PROMPT = [
  "你是外贸获客 ICP 评估器，同时评估 B2B 和 B2C/DTC 两种场景。",
  "你的目标是找出值得开发的海外客户，无论是进口商/批发商还是品牌商/零售商。",
  "只能基于输入证据判断，不允许编造。",
  "如果证据不足，返回 needs_review。",
  "输出严格 JSON，不要 markdown。",
].join("\n");

const DEFAULT_SYSTEM_PROMPT = [
  "你是 B2B/B2C 外贸获客 ICP 评估器。",
  "只能基于输入证据判断，不允许编造。",
  "如果证据不足，返回 needs_review。",
  "输出严格 JSON，不要 markdown。",
].join("\n");

export async function classifyCandidateWithAI(
  input: DiscoveryAiClassifyInput
): Promise<DiscoveryAiClassifyOutput> {
  const providerName = await getDefaultResearchProvider();
  const provider = getAIProvider(providerName);
  const mode = input.discoveryMode || "mixed";
  const systemPrompt = getSystemPrompt(mode);
  const prompt = buildClassifierPrompt(input);
  const roleDescription = getB2BOrB2CRoleInstruction(mode);

  let rawOutput: string;
  try {
    rawOutput = await provider.researchProspect({
      prompt: `${roleDescription}\n\n${prompt}`,
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

function getSystemPrompt(mode: string): string {
  if (mode === "b2b") return B2B_SYSTEM_PROMPT;
  if (mode === "b2c") return B2C_SYSTEM_PROMPT;
  if (mode === "mixed") return MIXED_SYSTEM_PROMPT;
  return DEFAULT_SYSTEM_PROMPT;
}

/**
 * 根据场景生成角色判断说明，注入到 user prompt 头部
 */
function getB2BOrB2CRoleInstruction(mode: string): string {
  if (mode === "b2b") {
    return [
      "## 评估场景：B2B 外贸获客（找海外进口商/批发商/分销商）",
      "",
      "评估标准（按优先级从高到低）:",
      "1. 公司角色（最高优先）",
      "   这家公司是海外进口商、批发商或分销商吗？",
      "   → importer / distributor / wholesaler / trader → 高度匹配",
      "   → manufacturer（特别是需要从海外采购原材料的） → 中度匹配",
      "   → retailer / B2C brand / DTC brand → 低度匹配",
      "",
      "2. 从中国/亚洲采购的迹象",
      "   有没有以下信号？",
      "   - \"import from China\" / \"global sourcing\" 等表述",
      "   - 网站有多语言版本（暗示国际业务）",
      "   - 有 \"supplier\" / \"vendor\" / \"partner\" 页面",
      "   - 提及 OEM / ODM / contract manufacturing",
      "",
      "3. 商业规模",
      "   公司规模是否支持批量采购？",
      "   - 员工人数、办公地点数量",
      "   - 产品线广度",
      "   - 是否有多个分销渠道",
      "",
      "4. 可触达性",
      "   有没有采购决策者的线索？",
      "   - Procurement Manager / Sourcing Director / Purchasing Manager",
      "   - CEO / VP of Operations",
      "",
      "5. 产品匹配",
      "   产品线是否与你的供应品类匹配？",
      "",
      "加分项: international, export, global, multi-language, ISO certification",
      "减分项: consumer direct only, B2C only, local business only, single location",
      "",
    ].join("\n");
  }

  if (mode === "b2c") {
    return [
      "## 评估场景：B2C/DTC 跨境获客（找海外品牌商/零售商）",
      "",
      "评估标准（按优先级从高到低）:",
      "1. 公司角色（最高优先）",
      "   这家公司是品牌商、零售商还是 DTC 品牌？",
      "   → brand / DTC brand / retailer → 高度匹配",
      "   → 有实体店的品牌 → 中度匹配",
      "",
      "2. 合作潜力",
      "   产品线是否与你的供应品类匹配？",
      "   有没有代工/贴牌/OEM 可能性？",
      "",
      "3. 增长信号",
      "   - 新品牌、融资品牌、快速增长品牌 → 加分",
      "   - 多平台销售（Shopify/Amazon/实体店）→ 加分",
      "",
      "4. 可触达性",
      "   有没有决策者线索？",
      "   - Founder / Co-Founder / CEO",
      "   - Brand Manager / Head of Product / Merchandising Manager",
      "",
      "加分项: multiple sales channels, growing brand, social media presence",
      "减分项: no online store, very small operation, no clear brand identity",
      "",
    ].join("\n");
  }

  // mixed
  return [
    "## 评估场景：综合外贸获客（同时评估 B2B 和 B2C 两种可能性）",
    "",
    "请从两个角度分别评估这家公司：",
    "",
    "【B2B 角度】是否适合作为外贸客户的信号：",
    "- 公司角色：importer / distributor / wholesaler / trader → 高分",
    "- 从中国/亚洲采购的迹象：sourcing / OEM / import from China",
    "- 商业规模支持批量采购",
    "",
    "【B2C/DTC 角度】是否适合作为品牌合作客户的信号：",
    "- 公司角色：brand / DTC brand / retailer → 高分",
    "- 产品线匹配、代工可能性",
    "- 增长潜力和品牌知名度",
    "",
    "综合评估时，只要有一方面达标即可给出较高分数。",
    "",
  ].join("\n");
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
        companyRole: "importer | distributor | wholesaler | brand | retailer | unknown",
      },
    },
    null,
    2
  );
}

function sanitize(value: string) {
  return value
    .replace(/ thinking[\s\S]*?<\/think>/gi, "")
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