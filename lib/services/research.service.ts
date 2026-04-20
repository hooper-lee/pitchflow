import { db } from "@/lib/db";
import { prospects, prospectResearch, prospectScores } from "@/lib/db/schema";
import { eq, and, sql, or } from "drizzle-orm";
import { searchCompany, searchNews } from "@/lib/integrations/serpapi";
import { RESEARCH_SYSTEM_PROMPT, ProspectResearchInput } from "@/lib/ai/prompts";
import { researchProspect as claudeResearch, extractProspectResearch, ProspectResearchOutput, scoreProspectWithAI, ProspectScoringOutput } from "@/lib/ai/claude";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { researchProspect as openaiResearch } from "@/lib/ai/openai";
import { researchProspect as customResearch } from "@/lib/ai/custom";
import { getTenantPlan } from "@/lib/services/quota.service";
import {
  AI_PROMPT_KEYS,
  getAiPromptConfig,
  getDefaultResearchProvider,
  getProspectScoringWeights,
  interpolatePromptTemplate,
} from "@/lib/services/config.service";

export interface ResearchResult {
  summary: string;
  companyScore?: number;
  matchScore?: number;
  basicInfo?: string;
}

export async function researchProspect(
  prospectId: string,
  tenantId: string,
  aiProvider?: "claude" | "openai" | "custom"
): Promise<ResearchResult> {
  const resolvedProvider = aiProvider || (await getDefaultResearchProvider());
  // Get prospect
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId))
    )
    .limit(1);

  if (!prospect) throw new Error("Prospect not found");

  // Check plan tier
  const plan = await getTenantPlan(tenantId);

  // Gather search data (always)
  const [companyResults, newsResults] = await Promise.all([
    searchCompany(prospect.companyName || prospect.website || ""),
    searchNews(prospect.companyName || ""),
  ]);

  // Free plan: basic info only
  if (plan === "free") {
    const basicInfo = companyResults.length > 0
      ? companyResults.slice(0, 3).map((r) => `- ${r.title}: ${r.snippet}`).join("\n")
      : "暂无搜索结果";

    await db
      .update(prospects)
      .set({
        researchSummary: basicInfo,
        researchData: {
          companyResults: companyResults.slice(0, 3),
          researchedAt: new Date().toISOString(),
          plan: "free",
        },
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, prospectId));

    return { summary: basicInfo, basicInfo };
  }

  // Pro/Enterprise: deep research
  let websiteContent = "";
  let aboutContent = "";

  // Fetch main website
  if (prospect.website) {
    try {
      const res = await fetch(prospect.website, {
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
    } catch {
      // Website not accessible
    }

    // Try About page
    try {
      const domain = new URL(prospect.website).origin;
      const aboutRes = await fetch(`${domain}/about`, {
        signal: AbortSignal.timeout(10000),
      });
      const aboutHtml = await aboutRes.text();
      aboutContent = aboutHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
    } catch {
      // About page not available
    }
  }

  // Build research context
  const context = `
Company: ${prospect.companyName || "Unknown"}
Contact: ${prospect.contactName || "Unknown"}
Email: ${prospect.email || "Unknown"}
Industry: ${prospect.industry || "Unknown"}
Country: ${prospect.country || "Unknown"}
Website: ${prospect.website || "Unknown"}

--- Website Content ---
${websiteContent || "Not available"}

${aboutContent ? `--- About Page ---\n${aboutContent}\n` : ""}

--- Google Search Results (${companyResults.length}) ---
${companyResults.slice(0, 10).map((r) => `- ${r.title}: ${r.snippet} [${r.link}]`).join("\n") || "None"}

--- Recent News (${newsResults.length}) ---
${newsResults.slice(0, 8).map((r) => `- ${r.title}: ${r.snippet}`).join("\n") || "None"}
`;

  // Generate AI research report
  const structuredPrompt = `${RESEARCH_SYSTEM_PROMPT}

Analyze this company and output a JSON object with these fields:
{
  "companyOverview": "1-2 sentence company description",
  "keyFacts": { "industry": "", "size": "", "location": "", "products": "" },
  "recentDevelopments": "any recent news",
  "talkingPoints": ["point1", "point2", "point3"],
  "recommendedApproach": "best angle for outreach",
  "companyScore": 1-10,
  "matchScore": 1-10,
  "verdict": "brief conclusion on whether to pursue this prospect"
}

Score guide:
- companyScore: 1=fake/non-existent, 5=small/incomplete info, 10=large verified company
- matchScore: 1=completely irrelevant, 5=somewhat related, 10=perfect target customer

Output ONLY valid JSON, no markdown wrapping.

Analyze this company:\n\n${context}`;

  let summary: string;
  if (resolvedProvider === "openai") {
    summary = await openaiResearch({ prompt: structuredPrompt });
  } else if (resolvedProvider === "custom") {
    summary = await customResearch({ prompt: structuredPrompt });
  } else {
    summary = await claudeResearch({ prompt: structuredPrompt });
  }

  // Parse scores from AI response
  let companyScore: number | undefined;
  let matchScore: number | undefined;
  let formattedSummary = summary;

  try {
    const parsed = parseJsonWithRepair<{
      companyOverview?: string;
      keyFacts?: {
        industry?: string;
        size?: string;
        location?: string;
        products?: string;
      };
      recentDevelopments?: string;
      talkingPoints?: string[];
      recommendedApproach?: string;
      companyScore?: number;
      matchScore?: number;
      verdict?: string;
    }>(summary);

    companyScore = parsed.companyScore;
    matchScore = parsed.matchScore;

    formattedSummary = [
      `## 公司概况\n${parsed.companyOverview || ""}`,
      `## 关键信息`,
      `- 行业: ${parsed.keyFacts?.industry || "未知"}`,
      `- 规模: ${parsed.keyFacts?.size || "未知"}`,
      `- 位置: ${parsed.keyFacts?.location || "未知"}`,
      `- 产品/服务: ${parsed.keyFacts?.products || "未知"}`,
      parsed.recentDevelopments ? `## 近期动态\n${parsed.recentDevelopments}` : "",
      `## 联系建议`,
      ...(parsed.talkingPoints || []).map((point) => `- ${point}`),
      `## 推荐策略\n${parsed.recommendedApproach || ""}`,
      `## 综合评估\n- 公司真实性: ${companyScore}/10\n- 业务匹配度: ${matchScore}/10`,
      parsed.verdict ? `\n**结论: ${parsed.verdict}**` : "",
    ].filter(Boolean).join("\n");
  } catch {
    // If JSON parsing fails, use raw summary
  }

  // Update prospect with research data
  await db
    .update(prospects)
    .set({
      researchSummary: formattedSummary,
      companyScore: companyScore || null,
      matchScore: matchScore || null,
      researchData: {
        companyResults: companyResults.slice(0, 10),
        newsResults: newsResults.slice(0, 8),
        websiteContent: websiteContent.slice(0, 2000),
        aboutContent: aboutContent.slice(0, 1000),
        researchedAt: new Date().toISOString(),
        plan,
      },
      updatedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  return { summary: formattedSummary, companyScore, matchScore };
}

// ── New Research + Scoring Functions ─────────────────────────────────

export interface CreateResearchParams {
  prospectId: string;
}

function isResearchRunning(status: string) {
  return status === "pending" || status === "processing";
}

/**
 * 创建调研记录并触发异步调研
 */
export async function createProspectResearch(prospectId: string) {
  const [inserted] = await db
    .insert(prospectResearch)
    .values({
      prospectId,
      status: "pending",
      errorMessage: null,
    })
    .onConflictDoNothing({
      target: prospectResearch.prospectId,
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  const [existing] = await db
    .select()
    .from(prospectResearch)
    .where(eq(prospectResearch.prospectId, prospectId))
    .limit(1);

  if (!existing) {
    throw new Error("Failed to create research record");
  }

  if (isResearchRunning(existing.status)) {
    return existing;
  }

  const [resetResearch] = await db
    .update(prospectResearch)
    .set({
      status: "pending",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(prospectResearch.prospectId, prospectId))
    .returning();

  return resetResearch;
}

async function claimProspectResearchStart(prospectId: string) {
  const [claimedResearch] = await db
    .update(prospectResearch)
    .set({
      status: "processing",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(prospectResearch.prospectId, prospectId),
        eq(prospectResearch.status, "pending")
      )
    )
    .returning();

  return claimedResearch || null;
}

/**
 * 执行 AI 调研抽取 - 从官网内容提取结构化字段
 */
export async function executeProspectResearch(
  prospectId: string,
  aiProvider?: "claude" | "openai" | "custom"
): Promise<typeof prospectResearch.$inferSelect> {
  const resolvedProvider = aiProvider || (await getDefaultResearchProvider());
  // 获取 prospect
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (!prospect) {
    throw new Error("Prospect not found");
  }

  await db
    .update(prospects)
    .set({ updatedAt: new Date() })
    .where(eq(prospects.id, prospectId));

  // 抓取网站内容
  let websiteContent = "";
  let aboutContent = "";

  if (prospect.website) {
    try {
      const res = await fetch(prospect.website, {
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
    } catch {
      console.error("Failed to fetch website:", prospect.website);
    }

    // Try About page
    try {
      const domain = new URL(prospect.website).origin;
      const aboutRes = await fetch(`${domain}/about`, {
        signal: AbortSignal.timeout(10000),
      });
      const aboutHtml = await aboutRes.text();
      aboutContent = aboutHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
    } catch {
      // About page not available
    }
  }

  // 搜索结果
  let searchResults = "";
  try {
    const companyResults = await searchCompany(prospect.companyName || "");
    searchResults = companyResults
      .slice(0, 10)
      .map((r) => `- ${r.title}: ${r.snippet}`)
      .join("\n");
  } catch {
    // Search failed, continue without
  }

  // 构建 AI 输入
  const input: ProspectResearchInput = {
    companyName: prospect.companyName || "",
    website: prospect.website || undefined,
    industry: prospect.industry || undefined,
    country: prospect.country || undefined,
    existingResearch: prospect.researchSummary || undefined,
    websiteContent: websiteContent + (aboutContent ? "\n\n" + aboutContent : ""),
    searchResults: searchResults || undefined,
  };

  // 调用 AI 提取
  const [systemPrompt, promptTemplate] = await Promise.all([
    getAiPromptConfig(AI_PROMPT_KEYS.PROSPECT_RESEARCH_SYSTEM),
    getAiPromptConfig(AI_PROMPT_KEYS.PROSPECT_RESEARCH_USER),
  ]);

  let result: ProspectResearchOutput;
  try {
    const prompt = interpolatePromptTemplate(promptTemplate, {
      companyName: input.companyName,
      website: input.website || "N/A",
      industry: input.industry || "N/A",
      country: input.country || "N/A",
      existingResearch: input.existingResearch || "N/A",
      websiteContent: input.websiteContent || "N/A",
      searchResults: input.searchResults || "N/A",
    });

    if (resolvedProvider === "openai") {
      throw new Error("OpenAI not implemented for structured extraction");
    }
    if (resolvedProvider === "custom") {
      const text = await customResearch({
        prompt,
        systemPrompt,
        maxTokens: 4096,
      });
      result = parseProspectResearchOutput(text);
    } else {
      result = await extractProspectResearch({ prompt, systemPrompt });
    }
  } catch (error) {
    // 更新状态为 failed
    await db
      .update(prospectResearch)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(prospectResearch.prospectId, prospectId));
    throw error;
  }

  // 保存调研结果
  const [updated] = await db
    .update(prospectResearch)
    .set({
      status: "completed",
      aiSummary: result.aiSummary,
      companyDescription: result.companyDescription,
      foundingYear: result.foundingYear,
      employeeCount: result.employeeCount,
      companyType: result.companyType,
      businessModel: result.businessModel,
      mainProducts: result.mainProducts,
      productCategories: result.productCategories,
      productionCapacity: result.productionCapacity,
      certifications: result.certifications,
      targetMarkets: result.targetMarkets,
      exportRegions: result.exportRegions,
      keyMarkets: result.keyMarkets,
      procurementKeywords: result.procurementKeywords,
      typicalOrderValue: result.typicalOrderValue,
      supplierCriteria: result.supplierCriteria,
      decisionMakers: result.decisionMakers,
      phoneNumbers: result.phoneNumbers,
      addresses: result.addresses,
      socialMedia: result.socialMedia,
      rawAiOutput: result as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(prospectResearch.prospectId, prospectId))
    .returning();

  const primaryDecisionMaker = result.decisionMakers[0];
  if (primaryDecisionMaker && (!prospect.contactName || !prospect.linkedinUrl)) {
    await db
      .update(prospects)
      .set({
        contactName: prospect.contactName || primaryDecisionMaker.name,
        linkedinUrl: prospect.linkedinUrl || primaryDecisionMaker.linkedin || null,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, prospectId));
  }

  return updated;
}

export async function runProspectResearchPipeline(
  prospectId: string,
  aiProvider?: "claude" | "openai" | "custom"
) {
  const research = await createProspectResearch(prospectId);

  if (research.status === "processing") {
    return { research, scores: null, started: false };
  }

  const claimedResearch = await claimProspectResearchStart(prospectId);
  if (!claimedResearch) {
    return { research, scores: null, started: false };
  }

  const completedResearch = await executeProspectResearch(prospectId, aiProvider);
  const scores = await scoreProspect(prospectId, aiProvider);
  return { research: completedResearch, scores, started: true };
}

/**
 * 计算 Lead 等级
 */
function calculateLeadGrade(scores: {
  icpFit: number;
  buyingIntent: number;
  reachability: number;
  dealPotential: number;
  riskPenalty: number;
  weights: {
    icpFit: number;
    buyingIntent: number;
    reachability: number;
    dealPotential: number;
    riskPenalty: number;
  };
}): { grade: "A" | "B" | "C" | "D"; priority: number; action: string; reason: string } {
  const totalWeight = Math.max(
    scores.weights.icpFit +
      scores.weights.buyingIntent +
      scores.weights.reachability +
      scores.weights.dealPotential +
      scores.weights.riskPenalty,
    1
  );
  const overall =
    (scores.icpFit * scores.weights.icpFit +
      scores.buyingIntent * scores.weights.buyingIntent +
      scores.reachability * scores.weights.reachability +
      scores.dealPotential * scores.weights.dealPotential +
      scores.riskPenalty * scores.weights.riskPenalty) /
    totalWeight;

  // 等级判定
  let grade: "A" | "B" | "C" | "D";
  let priority: number;
  let action: string;
  let reason: string;

  if (overall >= 75) {
    grade = "A";
    priority = 1;
    action = "优先联系 - 立即发送个性化开发信";
    reason = `综合评分 ${overall}，高 ICP 匹配度和采购意向`;
  } else if (overall >= 50) {
    grade = "B";
    priority = 2;
    action = "加入培育序列 - 先发送介绍邮件";
    reason = `综合评分 ${overall}，有一定潜力但需要培育`;
  } else if (overall >= 25) {
    grade = "C";
    priority = 3;
    action = "观察 - 补充更多信息后再联系";
    reason = `综合评分 ${overall}，信息不足或匹配度一般`;
  } else {
    grade = "D";
    priority = 4;
    action = "暂不跟进，保留观察";
    reason = `综合评分 ${overall}，不符合目标客户画像`;
  }

  // 风险扣分影响
  if (scores.riskPenalty < 30) {
    action += "（注意：存在风险因素，建议进一步核实）";
  }

  return { grade, priority, action, reason };
}

/**
 * 执行 AI 评分 - 基于调研结果进行5维度评分
 */
export async function scoreProspect(
  prospectId: string,
  aiProvider?: "claude" | "openai" | "custom"
): Promise<typeof prospectScores.$inferSelect> {
  const resolvedProvider = aiProvider || (await getDefaultResearchProvider());
  // 获取 prospect 和调研结果
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (!prospect) {
    throw new Error("Prospect not found");
  }

  const [research] = await db
    .select()
    .from(prospectResearch)
    .where(eq(prospectResearch.prospectId, prospectId))
    .limit(1);

  if (!research || research.status !== "completed") {
    throw new Error("Research not completed");
  }

  // 官网评分（从 metadata 中获取）
  const websiteScore = prospect.companyScore || null;
  const websiteDimensions = prospect.metadata?.detectorDimensions as Record<string, number> | undefined;

  const [systemPrompt, promptTemplate, scoringWeights] = await Promise.all([
    getAiPromptConfig(AI_PROMPT_KEYS.PROSPECT_SCORING_SYSTEM),
    getAiPromptConfig(AI_PROMPT_KEYS.PROSPECT_SCORING_USER),
    getProspectScoringWeights(),
  ]);

  const scoringInput = {
    companyName: prospect.companyName || "",
    industry: prospect.industry,
    country: prospect.country,
    website: prospect.website,
    research: {
      aiSummary: research.aiSummary,
      companyDescription: research.companyDescription,
      employeeCount: research.employeeCount,
      companyType: research.companyType,
      businessModel: research.businessModel,
      mainProducts: research.mainProducts,
      targetMarkets: research.targetMarkets,
      exportRegions: research.exportRegions,
      procurementKeywords: research.procurementKeywords,
      typicalOrderValue: research.typicalOrderValue,
      supplierCriteria: research.supplierCriteria,
      decisionMakers: research.decisionMakers,
    },
  };

  // 调用 AI 评分
  let scoreResult: {
    icpFitScore: number;
    buyingIntentScore: number;
    reachabilityScore: number;
    dealPotentialScore: number;
    riskPenaltyScore: number;
    reasoning: string;
  };

  try {
    const scoringPrompt = interpolatePromptTemplate(promptTemplate, {
      companyName: scoringInput.companyName,
      industry: scoringInput.industry || "N/A",
      country: scoringInput.country || "N/A",
      website: scoringInput.website || "N/A",
      aiSummary: scoringInput.research.aiSummary || "N/A",
      companyDescription: scoringInput.research.companyDescription || "N/A",
      companyType: scoringInput.research.companyType || "N/A",
      employeeCount: scoringInput.research.employeeCount || "N/A",
      businessModel: scoringInput.research.businessModel || "N/A",
      mainProducts: (scoringInput.research.mainProducts || []).join(", ") || "N/A",
      targetMarkets: (scoringInput.research.targetMarkets || []).join(", ") || "N/A",
      exportRegions: (scoringInput.research.exportRegions || []).join(", ") || "N/A",
      procurementKeywords:
        (scoringInput.research.procurementKeywords || []).join(", ") || "N/A",
      typicalOrderValue: scoringInput.research.typicalOrderValue || "N/A",
      supplierCriteria: scoringInput.research.supplierCriteria || "N/A",
      decisionMakers:
        (scoringInput.research.decisionMakers || [])
          .map((d) => `${d.name} (${d.position})`)
          .join(", ") || "N/A",
    });

    if (resolvedProvider === "openai") {
      throw new Error("OpenAI not implemented for structured scoring");
    }

    if (resolvedProvider === "custom") {
      const text = await customResearch({
        prompt: scoringPrompt,
        systemPrompt,
        maxTokens: 2048,
      });
      scoreResult = parseProspectScoringOutput(text);
    } else {
      scoreResult = await scoreProspectWithAI({
        prompt: scoringPrompt,
        systemPrompt,
      });
    }
  } catch (error) {
    console.error("AI scoring failed:", error);
    throw new Error("AI scoring failed: " + (error instanceof Error ? error.message : "Unknown error"));
  }

  // 计算等级
  const { grade, priority, action, reason } = calculateLeadGrade({
    icpFit: scoreResult.icpFitScore,
    buyingIntent: scoreResult.buyingIntentScore,
    reachability: scoreResult.reachabilityScore,
    dealPotential: scoreResult.dealPotentialScore,
    riskPenalty: scoreResult.riskPenaltyScore,
    weights: scoringWeights,
  });

  const totalWeight = Math.max(
    scoringWeights.icpFit +
      scoringWeights.buyingIntent +
      scoringWeights.reachability +
      scoringWeights.dealPotential +
      scoringWeights.riskPenalty,
    1
  );
  const overallScore = Math.round(
    (scoreResult.icpFitScore * scoringWeights.icpFit +
      scoreResult.buyingIntentScore * scoringWeights.buyingIntent +
      scoreResult.reachabilityScore * scoringWeights.reachability +
      scoreResult.dealPotentialScore * scoringWeights.dealPotential +
      scoreResult.riskPenaltyScore * scoringWeights.riskPenalty) /
      totalWeight
  );

  // 保存评分
  const [scores] = await db
    .insert(prospectScores)
    .values({
      prospectId,
      websiteScore,
      websiteDimensions: websiteDimensions || null,
      icpFitScore: scoreResult.icpFitScore,
      buyingIntentScore: scoreResult.buyingIntentScore,
      reachabilityScore: scoreResult.reachabilityScore,
      dealPotentialScore: scoreResult.dealPotentialScore,
      riskPenaltyScore: scoreResult.riskPenaltyScore,
      overallScore,
      leadGrade: grade,
      priorityLevel: priority,
      recommendedAction: action,
      actionReason: scoreResult.reasoning || reason,
      rawAiOutput: scoreResult as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: prospectScores.prospectId,
      set: {
        websiteScore,
        websiteDimensions: websiteDimensions || null,
        icpFitScore: scoreResult.icpFitScore,
        buyingIntentScore: scoreResult.buyingIntentScore,
        reachabilityScore: scoreResult.reachabilityScore,
        dealPotentialScore: scoreResult.dealPotentialScore,
        riskPenaltyScore: scoreResult.riskPenaltyScore,
        overallScore,
        leadGrade: grade,
        priorityLevel: priority,
        recommendedAction: action,
        actionReason: reason,
        rawAiOutput: scoreResult as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    })
    .returning();

  // 更新 prospect 状态
  await db
    .update(prospects)
    .set({ updatedAt: new Date() })
    .where(eq(prospects.id, prospectId));

  return scores;
}

/**
 * 获取客户的调研和评分信息
 */
export async function getProspectResearchAndScores(prospectId: string) {
  const [research] = await db
    .select()
    .from(prospectResearch)
    .where(eq(prospectResearch.prospectId, prospectId))
    .limit(1);

  const [scores] = await db
    .select()
    .from(prospectScores)
    .where(eq(prospectScores.prospectId, prospectId))
    .limit(1);

  return { research, scores };
}

/**
 * 批量处理调研任务
 */
export async function processBatchResearch(params: {
  limit?: number;
  status?: string;
}) {
  const { limit = 10, status = "new" } = params;

  // 查找需要调研的 prospects
  // 条件：status = 'new' 且没有调研记录，或者调研失败
  const prospectsToResearch = await db
    .select({
      id: prospects.id,
      companyName: prospects.companyName,
      website: prospects.website,
    })
    .from(prospects)
    .leftJoin(
      prospectResearch,
      eq(prospects.id, prospectResearch.prospectId)
    )
    .where(
      and(
        eq(prospects.status, status as typeof prospects.status.enumValues[number]),
        or(
          eq(prospectResearch.status, "failed"),
          sql`${prospectResearch.id} IS NULL`
        )
      )
    )
    .limit(limit);

  const results: {
    prospectId: string;
    companyName: string | null;
    status: "success" | "failed" | "skipped";
    error?: string;
  }[] = [];

  for (const prospect of prospectsToResearch) {
    try {
      // 创建调研记录
      await createProspectResearch(prospect.id);

      // 执行调研（同步）
      await executeProspectResearch(prospect.id);

      // 执行评分
      await scoreProspect(prospect.id);

      results.push({
        prospectId: prospect.id,
        companyName: prospect.companyName,
        status: "success",
      });
    } catch (error) {
      results.push({
        prospectId: prospect.id,
        companyName: prospect.companyName,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    processed: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}

function parseProspectResearchOutput(text: string): ProspectResearchOutput {
  const parsed = parseJsonWithRepair<Partial<ProspectResearchOutput>>(text);
  return {
    aiSummary: parsed.aiSummary || "",
    companyDescription: parsed.companyDescription || null,
    foundingYear: parsed.foundingYear || null,
    employeeCount: parsed.employeeCount || null,
    companyType: parsed.companyType || null,
    businessModel: parsed.businessModel || null,
    mainProducts: parsed.mainProducts || [],
    productCategories: parsed.productCategories || [],
    productionCapacity: parsed.productionCapacity || null,
    certifications: parsed.certifications || [],
    targetMarkets: parsed.targetMarkets || [],
    exportRegions: parsed.exportRegions || [],
    keyMarkets: parsed.keyMarkets || [],
    procurementKeywords: parsed.procurementKeywords || [],
    typicalOrderValue: parsed.typicalOrderValue || null,
    supplierCriteria: parsed.supplierCriteria || null,
    decisionMakers: parsed.decisionMakers || [],
    phoneNumbers: parsed.phoneNumbers || [],
    addresses: parsed.addresses || [],
    socialMedia: parsed.socialMedia || {},
  };
}

function parseProspectScoringOutput(text: string): ProspectScoringOutput {
  const parsed = parseJsonWithRepair<Partial<ProspectScoringOutput>>(text);
  return {
    icpFitScore: Math.min(100, Math.max(0, parsed.icpFitScore || 50)),
    buyingIntentScore: Math.min(100, Math.max(0, parsed.buyingIntentScore || 50)),
    reachabilityScore: Math.min(100, Math.max(0, parsed.reachabilityScore || 50)),
    dealPotentialScore: Math.min(100, Math.max(0, parsed.dealPotentialScore || 50)),
    riskPenaltyScore: Math.min(100, Math.max(0, parsed.riskPenaltyScore || 50)),
    reasoning: parsed.reasoning || "",
  };
}
