import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { getDefaultResearchProvider } from "@/lib/services/config.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

const parseIcpProfileSchema = z.object({
  message: z.string().min(2).max(10000).optional(),
  text: z.string().min(2).max(10000).optional(),
  currentDraft: z.unknown().optional(),
}).refine((value) => value.message || value.text, {
  message: "message is required",
});

interface ParsedIcpProfile {
  name?: string;
  description?: string;
  industry?: string;
  targetCustomerText?: string;
  mustHave?: string[];
  mustNotHave?: string[];
  positiveKeywords?: string[];
  negativeKeywords?: string[];
  productCategories?: string[];
  salesModel?: string;
  scoreWeights?: {
    detectorScore?: number;
    ruleScore?: number;
    aiScore?: number;
    feedbackScore?: number;
  };
  minScoreToSave?: number;
  minScoreToReview?: number;
  promptTemplate?: string;
}

const ICP_PARSE_SYSTEM_PROMPT = [
  "你是外贸获客 ICP 画像结构化助手。",
  "把用户自然语言要求拆成可执行的客户筛选规则。",
  "只输出 JSON，不要 markdown、代码块、解释、think 内容。",
].join("\n");

export async function POST(request: NextRequest) {
  try {
    await requireTenant();
    const requestBody = parseIcpProfileSchema.parse(await request.json());
    const userMessage = requestBody.message || requestBody.text || "";
    const provider = getAIProvider(await getDefaultResearchProvider());
    const rawOutput = await provider.researchProspect({
      prompt: buildIcpParsePrompt(userMessage, requestBody.currentDraft),
      systemPrompt: ICP_PARSE_SYSTEM_PROMPT,
      maxTokens: 1800,
    });

    const parsedProfile = parseJsonWithRepair<ParsedIcpProfile>(sanitize(rawOutput));
    return apiResponse(normalizeParsedProfile(parsedProfile, userMessage));
  } catch (error) {
    return handleApiError(error);
  }
}

function buildIcpParsePrompt(userMessage: string, currentDraft: unknown) {
  return JSON.stringify(
    {
      task: currentDraft
        ? "Update the current ICP draft based on the user's latest instruction."
        : "Parse this ICP request into structured rules for prospect discovery.",
      userMessage,
      currentDraft: currentDraft || null,
      rules: [
        "如果 currentDraft 存在，必须在其基础上修改，保留用户没有要求变更的字段。",
        "每次都返回完整画像 JSON，不要只返回 diff。",
        "mustHave 写硬性必须满足条件，每条一句话。",
        "mustNotHave 写明确排除条件，每条一句话。",
        "positiveKeywords 写官网/搜索片段中可识别的正向词。",
        "negativeKeywords 写应排除的负向词。",
        "productCategories 写目标产品或服务类别。",
        "salesModel 写一句话销售模式，例如 DTC brand / distributor / manufacturer。",
        "promptTemplate 写给后续 AI 分类器的补充判断说明。",
        "用户说更严格时，提高筛选条件和阈值；用户说放宽时，减少硬性条件或降低阈值。",
      ],
      outputSchema: {
        name: "short Chinese profile name",
        description: "one sentence summary",
        industry: "target industry",
        targetCustomerText: "cleaned user request",
        mustHave: ["string"],
        mustNotHave: ["string"],
        positiveKeywords: ["string"],
        negativeKeywords: ["string"],
        productCategories: ["string"],
        salesModel: "string",
        scoreWeights: {
          detectorScore: 20,
          ruleScore: 25,
          aiScore: 40,
          feedbackScore: 15,
        },
        minScoreToSave: 80,
        minScoreToReview: 60,
        promptTemplate: "string",
      },
    },
    null,
    2
  );
}

function sanitize(value: string) {
  return value
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function normalizeParsedProfile(
  parsedProfile: ParsedIcpProfile,
  fallbackText: string
): ParsedIcpProfile {
  return {
    name: normalizeString(parsedProfile.name) || "自定义客户画像",
    description: normalizeString(parsedProfile.description),
    industry: normalizeString(parsedProfile.industry),
    targetCustomerText: normalizeString(parsedProfile.targetCustomerText) || fallbackText,
    mustHave: normalizeStringList(parsedProfile.mustHave),
    mustNotHave: normalizeStringList(parsedProfile.mustNotHave),
    positiveKeywords: normalizeStringList(parsedProfile.positiveKeywords),
    negativeKeywords: normalizeStringList(parsedProfile.negativeKeywords),
    productCategories: normalizeStringList(parsedProfile.productCategories),
    salesModel: normalizeString(parsedProfile.salesModel),
    scoreWeights: {
      detectorScore: clampScore(parsedProfile.scoreWeights?.detectorScore ?? 20),
      ruleScore: clampScore(parsedProfile.scoreWeights?.ruleScore ?? 25),
      aiScore: clampScore(parsedProfile.scoreWeights?.aiScore ?? 40),
      feedbackScore: clampScore(parsedProfile.scoreWeights?.feedbackScore ?? 15),
    },
    minScoreToSave: clampScore(parsedProfile.minScoreToSave ?? 80),
    minScoreToReview: clampScore(parsedProfile.minScoreToReview ?? 60),
    promptTemplate: normalizeString(parsedProfile.promptTemplate),
  };
}

function normalizeString(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringList(values?: string[]) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.trim()).filter(Boolean).slice(0, 20);
}

function clampScore(value: number) {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}
