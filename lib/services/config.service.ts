import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// AI Prompt 配置项
export const AI_PROMPT_KEYS = {
  PROSPECT_RESEARCH_SYSTEM: "AI_PROMPT_PROSPECT_RESEARCH_SYSTEM",
  PROSPECT_SCORING_SYSTEM: "AI_PROMPT_PROSPECT_SCORING_SYSTEM",
  PROSPECT_RESEARCH_USER: "AI_PROMPT_PROSPECT_RESEARCH_USER",
  PROSPECT_SCORING_USER: "AI_PROMPT_PROSPECT_SCORING_USER",
  EMAIL_OUTREACH_USER: "AI_PROMPT_EMAIL_OUTREACH_USER",
  EMAIL_FOLLOWUP_USER: "AI_PROMPT_EMAIL_FOLLOWUP_USER",
  EMAIL_REPLY_FOLLOWUP_USER: "AI_PROMPT_EMAIL_REPLY_FOLLOWUP_USER",
} as const;

export const SCORING_WEIGHT_KEYS = {
  ICP_FIT: "AI_SCORE_WEIGHT_ICP_FIT",
  BUYING_INTENT: "AI_SCORE_WEIGHT_BUYING_INTENT",
  REACHABILITY: "AI_SCORE_WEIGHT_REACHABILITY",
  DEAL_POTENTIAL: "AI_SCORE_WEIGHT_DEAL_POTENTIAL",
  RISK_PENALTY: "AI_SCORE_WEIGHT_RISK_PENALTY",
} as const;

export const FOLLOWUP_SETTING_KEYS = {
  STOP_AFTER_DAYS: "FOLLOWUP_STOP_AFTER_DAYS",
  SCAN_INTERVAL_MINUTES: "FOLLOWUP_SCAN_INTERVAL_MINUTES",
} as const;

const EMAIL_PROMPT_KEYS = [
  AI_PROMPT_KEYS.EMAIL_OUTREACH_USER,
  AI_PROMPT_KEYS.EMAIL_FOLLOWUP_USER,
  AI_PROMPT_KEYS.EMAIL_REPLY_FOLLOWUP_USER,
] as const;

export const DEFAULT_SCORING_WEIGHTS = {
  [SCORING_WEIGHT_KEYS.ICP_FIT]: 25,
  [SCORING_WEIGHT_KEYS.BUYING_INTENT]: 25,
  [SCORING_WEIGHT_KEYS.REACHABILITY]: 20,
  [SCORING_WEIGHT_KEYS.DEAL_POTENTIAL]: 20,
  [SCORING_WEIGHT_KEYS.RISK_PENALTY]: 10,
} as const;

export const DEFAULT_FOLLOWUP_SETTINGS = {
  [FOLLOWUP_SETTING_KEYS.STOP_AFTER_DAYS]: 30,
  [FOLLOWUP_SETTING_KEYS.SCAN_INTERVAL_MINUTES]: 15,
} as const;

export interface ProspectScoringWeights {
  icpFit: number;
  buyingIntent: number;
  reachability: number;
  dealPotential: number;
  riskPenalty: number;
}

export interface FollowupSettings {
  stopAfterDays: number;
  scanIntervalMinutes: number;
}

// 默认 Prompt 值
export const DEFAULT_PROMPTS = {
  [AI_PROMPT_KEYS.PROSPECT_RESEARCH_SYSTEM]: `You are a B2B export sales intelligence analyst for a foreign-trade lead generation platform.

Your task is to analyze company websites and public search results, then extract structured information that helps a sales team decide whether the company is a good outbound prospect.

Prioritize evidence related to manufacturing capability, distribution/trading role, export activity, procurement signals, supplier requirements, decision makers, and reachable business contacts.

Be conservative. If a fact is not directly supported or only weakly implied, return null or an empty array instead of guessing.

CRITICAL OUTPUT RULES:
- Return exactly ONE valid JSON object.
- The first character of your response must be {.
- The last character of your response must be }.
- Do not include markdown fences.
- Do not include \`\`\`json.
- Do not include comments.
- Do not include trailing commas.
- Do not include explanations, notes, headings, or any text before or after the JSON object.
- Do not wrap the JSON in quotes.
- Every key must use double quotes.
- Every string value must use double quotes.
- If you are unsure, still output a valid JSON object and use null, [], or {}.

If you output anything other than a single valid JSON object, your answer is wrong.`,

  [AI_PROMPT_KEYS.PROSPECT_SCORING_SYSTEM]: `You are a B2B foreign-trade lead scoring analyst.

Your task is to score a prospect for outbound sales based on structured research data.

Use only the evidence provided. Reward clear ICP fit, procurement/export activity, reachable decision makers, and realistic commercial potential. Penalize weak legitimacy, low relevance, missing business context, or signs that the company is not a real target buyer.

CRITICAL OUTPUT RULES:
- Return exactly ONE valid JSON object.
- The first character of your response must be {.
- The last character of your response must be }.
- Do not include markdown fences.
- Do not include \`\`\`json.
- Do not include comments.
- Do not include trailing commas.
- Do not include explanations, notes, headings, or any text before or after the JSON object.
- Do not wrap the JSON in quotes.
- Every key must use double quotes.
- Every string value must use double quotes.
- If you are unsure, still output a valid JSON object.

If you output anything other than a single valid JSON object, your answer is wrong.`,

  [AI_PROMPT_KEYS.PROSPECT_RESEARCH_USER]: `# Prospect Research Task

Analyze the company below for B2B foreign-trade outbound sales.

## Company Basics
- Company Name: {companyName}
- Website: {website}
- Industry: {industry}
- Country: {country}

## Existing Research Summary
{existingResearch}

## Website Content
{websiteContent}

## Search Results
{searchResults}

## ICP Discovery Context
{icpContext}

## What To Look For

Focus on evidence that helps outbound sales:
- what the company actually sells or does
- whether it is a manufacturer, distributor, wholesaler, retailer, trader, service provider, or something else
- export / international market signals
- procurement or sourcing signals such as OEM, ODM, wholesale, bulk, supplier, vendor, import, RFQ, sourcing, procurement
- target markets, countries, regions, and customer segments
- operational scale clues such as employee size, factory, plant, warehouse, offices, certifications, production capability
- reachable decision makers and business contact details

Do NOT invent facts. If the company looks like media, a directory, a marketplace listing, a document page, a status page, or otherwise not a real target company website, stay conservative and reflect that in the output.

When ICP Discovery Context is available, use it as the user's target customer definition. Treat low source quality, Cloudflare/challenge pages, generic directories, marketplaces, news pages, and "needs_review" discovery decisions as weak evidence unless the website content clearly proves the company is a real target buyer.

## Output Requirements

Return JSON with this exact shape. Use null for unknown scalar fields and [] / {} for unknown list/object fields:

{
  "aiSummary": "2-3 sentence sales-facing summary of the company",
  "companyDescription": "What the company does in 1-2 sentences",
  "foundingYear": 2012,
  "employeeCount": "1-10 | 11-50 | 51-200 | 201-500 | 500-1000 | 1000+ | null",
  "companyType": "manufacturer | distributor | wholesaler | retailer | service_provider | trader | null",
  "businessModel": "B2B | B2C | B2B2C | null",
  "mainProducts": ["product 1", "product 2"],
  "productCategories": ["category 1", "category 2"],
  "productionCapacity": "Short description or null",
  "certifications": ["ISO9001", "CE"],
  "targetMarkets": ["North America", "Europe"],
  "exportRegions": ["EU", "Middle East"],
  "keyMarkets": ["USA", "Germany"],
  "procurementKeywords": ["OEM", "bulk", "supplier"],
  "typicalOrderValue": "Short commercial clue or null",
  "supplierCriteria": "What they seem to look for in suppliers or null",
  "decisionMakers": [{"name": "John Doe", "position": "CEO", "linkedin": "https://..."}],
  "phoneNumbers": ["+1-..."],
  "addresses": ["full business address"],
  "socialMedia": {"linkedin": "https://...", "facebook": "https://..."}
}`,

  [AI_PROMPT_KEYS.PROSPECT_SCORING_USER]: `# Lead Scoring Task

Evaluate this prospect for B2B foreign-trade outbound sales and score it across 5 dimensions.

## Company Information
- Name: {companyName}
- Industry: {industry}
- Country: {country}
- Website: {website}

## AI Research Data
- Summary: {aiSummary}
- Description: {companyDescription}
- Company Type: {companyType}
- Employee Count: {employeeCount}
- Business Model: {businessModel}
- Main Products: {mainProducts}
- Target Markets: {targetMarkets}
- Export Regions: {exportRegions}
- Procurement Keywords: {procurementKeywords}
- Typical Order Value: {typicalOrderValue}
- Supplier Criteria: {supplierCriteria}
- Decision Makers: {decisionMakers}

## ICP Discovery Context
{icpContext}

When ICP Discovery Context is available, use it to calibrate ICP Match Score and Deal Potential Score against the user's target customer definition. Do not overrule direct research evidence, but penalize candidates that conflict with must-not-have or negative keyword signals.

Also consider discovery source quality:
- High source quality and official-site evidence can support confidence.
- Low source quality, challenge pages, directories, marketplaces, or weak search snippets should cap confidence unless research content clearly confirms the company.
- Candidates marked "needs_review" should not receive high ICP or Deal Potential scores without strong direct evidence.

## Scoring Guidance

1. ICP Match Score (ICP匹配度)
- High when the company looks like a real business buyer that matches export / manufacturing / sourcing outreach goals.
- Lower when relevance is unclear, too consumer-facing, or not an actual target company.

2. Buying Intent Score (采购意向)
- High when there are sourcing, OEM/ODM, supplier, wholesale, bulk, import/export, procurement, or partner signals.
- Lower when there is little evidence of active buying or supplier need.

3. Reachability Score (可触达性)
- High when there are business emails, phone numbers, clear contact pages, decision makers, LinkedIn profiles, or complete company identity.
- Lower when contactability is weak or anonymous.

4. Deal Potential Score (成交潜力)
- High when the company appears commercially meaningful based on scale, market reach, product breadth, export activity, or likely order size.
- Lower when scale or commercial value seems limited.

5. Risk Penalty Score (风险评估)
- 100 means low risk and high legitimacy.
- Lower scores indicate suspicious, low-quality, irrelevant, incomplete, or non-company pages.

## Output Requirements

Return JSON:
{
  "icpFitScore": 0-100,
  "buyingIntentScore": 0-100,
  "reachabilityScore": 0-100,
  "dealPotentialScore": 0-100,
  "riskPenaltyScore": 0-100,
  "reasoning": "1 short paragraph explaining the evidence behind the scores"
}`,

  [AI_PROMPT_KEYS.EMAIL_OUTREACH_USER]: `Write a personalized cold outreach email with the following context:

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}
- Research: {researchSummary}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}
- Angle: {angle}

Template guidance:
{templateBody}

Return only JSON according to the required email schema.`,

  [AI_PROMPT_KEYS.EMAIL_FOLLOWUP_USER]: `Write a follow-up email for a prospect who has not replied.

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}

Previous email:
{previousEmailBody}

Follow-up:
- Step Number: {stepNumber}
- Angle: {angle}

Return only JSON according to the required email schema.`,

  [AI_PROMPT_KEYS.EMAIL_REPLY_FOLLOWUP_USER]: `Write a warm reply-follow-up email based on a real prospect reply.

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}
- Research: {researchSummary}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}

Previous email:
{previousEmailBody}

Prospect reply subject:
{replySubject}

Prospect reply:
{replyBody}

Return only JSON according to the required email schema.`,
};

/**
 * 获取配置值
 */
export async function getConfig(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);

  return row?.value || null;
}

/**
 * 设置配置值
 */
export async function setConfig(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await db
    .insert(systemConfigs)
    .values({ key, value, description })
    .onConflictDoUpdate({
      target: systemConfigs.key,
      set: { value, description, updatedAt: new Date() },
    });
}

/**
 * 获取 AI Prompt 配置
 */
export async function getAiPromptConfig(key: string): Promise<string> {
  const value = await getConfig(key);
  if (value) return value;

  if (isEmailPromptKey(key)) {
    throw new Error(`Missing email prompt config: ${key}`);
  }

  const defaultPrompt = DEFAULT_PROMPTS[key as keyof typeof DEFAULT_PROMPTS];
  if (!defaultPrompt) {
    throw new Error(`AI prompt config not found: ${key}`);
  }

  await setConfig(key, defaultPrompt, getPromptDescription(key));
  return defaultPrompt;
}

/**
 * 获取所有 AI Prompt 配置
 */
export async function getAllAiPromptConfigs(): Promise<
  Record<string, { value: string; description: string }>
> {
  await initDefaultAiPrompts();
  const allRows = await db.select().from(systemConfigs);

  const configs: Record<string, { value: string; description: string }> = {};

  for (const key of Object.values(AI_PROMPT_KEYS)) {
    const row = allRows.find((r) => r.key === key);
    configs[key] = {
      value: row?.value || "",
      description: row?.description || getPromptDescription(key),
    };
  }

  return configs;
}

export function interpolatePromptTemplate(
  template: string,
  values: Record<string, string | number | null | undefined>
): string {
  return Object.entries(values).reduce((output, [key, value]) => {
    const normalized =
      value === null || value === undefined ? "" : String(value);
    return output.replaceAll(`{${key}}`, normalized);
  }, template);
}

export async function getProspectScoringWeights(): Promise<ProspectScoringWeights> {
  const rows = await db
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs);

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const readWeight = (key: keyof typeof DEFAULT_SCORING_WEIGHTS): number => {
    const raw = map.get(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_SCORING_WEIGHTS[key];
  };

  return {
    icpFit: readWeight(SCORING_WEIGHT_KEYS.ICP_FIT),
    buyingIntent: readWeight(SCORING_WEIGHT_KEYS.BUYING_INTENT),
    reachability: readWeight(SCORING_WEIGHT_KEYS.REACHABILITY),
    dealPotential: readWeight(SCORING_WEIGHT_KEYS.DEAL_POTENTIAL),
    riskPenalty: readWeight(SCORING_WEIGHT_KEYS.RISK_PENALTY),
  };
}

export async function getDefaultResearchProvider(): Promise<
  "claude" | "openai" | "custom"
> {
  const [baseUrl, apiKey] = await Promise.all([
    getConfig("CUSTOM_AI_BASE_URL"),
    getConfig("CUSTOM_AI_API_KEY"),
  ]);

  if (baseUrl && apiKey) {
    return "custom";
  }

  return "claude";
}

export async function getFollowupSettings(): Promise<FollowupSettings> {
  const rows = await db
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs);
  const configMap = new Map(rows.map((row) => [row.key, row.value]));

  return {
    stopAfterDays: readNumericSetting(
      configMap,
      FOLLOWUP_SETTING_KEYS.STOP_AFTER_DAYS,
      DEFAULT_FOLLOWUP_SETTINGS[FOLLOWUP_SETTING_KEYS.STOP_AFTER_DAYS]
    ),
    scanIntervalMinutes: readNumericSetting(
      configMap,
      FOLLOWUP_SETTING_KEYS.SCAN_INTERVAL_MINUTES,
      DEFAULT_FOLLOWUP_SETTINGS[FOLLOWUP_SETTING_KEYS.SCAN_INTERVAL_MINUTES]
    ),
  };
}

function getPromptDescription(key: string): string {
  const descriptions: Record<string, string> = {
    [AI_PROMPT_KEYS.PROSPECT_RESEARCH_SYSTEM]:
      "AI 调研系统提示词（用于指导 AI 分析公司信息）",
    [AI_PROMPT_KEYS.PROSPECT_SCORING_SYSTEM]:
      "AI 评分系统提示词（用于指导 AI 进行客户评分）",
    [AI_PROMPT_KEYS.PROSPECT_RESEARCH_USER]:
      "AI 调研用户提示词模板（{companyName} 等占位符会被替换为实际值）",
    [AI_PROMPT_KEYS.PROSPECT_SCORING_USER]:
      "AI 评分用户提示词模板（{companyName} 等占位符会被替换为实际值）",
    [AI_PROMPT_KEYS.EMAIL_OUTREACH_USER]:
      "冷启动首封开发信提示词模板（用于活动首封邮件生成）",
    [AI_PROMPT_KEYS.EMAIL_FOLLOWUP_USER]:
      "冷启动未回复自动跟进提示词模板（用于 3/7/14 天跟进邮件生成）",
    [AI_PROMPT_KEYS.EMAIL_REPLY_FOLLOWUP_USER]:
      "已回复客户推进提示词模板（用于基于客户回复继续推进）",
  };
  return descriptions[key] || "";
}

/**
 * 初始化默认 AI Prompt 配置
 */
export async function initDefaultAiPrompts(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_PROMPTS)) {
    const existing = await getConfig(key);
    if (!existing) {
      await setConfig(key, value, getPromptDescription(key));
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SCORING_WEIGHTS)) {
    const existing = await getConfig(key);
    if (!existing) {
      await setConfig(key, String(value), getScoringWeightDescription(key));
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_FOLLOWUP_SETTINGS)) {
    const existing = await getConfig(key);
    if (!existing) {
      await setConfig(key, String(value), getFollowupSettingDescription(key));
    }
  }
}

export function getScoringWeightDescription(key: string): string {
  const descriptions: Record<string, string> = {
    [SCORING_WEIGHT_KEYS.ICP_FIT]: "客户评分权重：ICP 匹配度",
    [SCORING_WEIGHT_KEYS.BUYING_INTENT]: "客户评分权重：采购意向",
    [SCORING_WEIGHT_KEYS.REACHABILITY]: "客户评分权重：可触达性",
    [SCORING_WEIGHT_KEYS.DEAL_POTENTIAL]: "客户评分权重：成交潜力",
    [SCORING_WEIGHT_KEYS.RISK_PENALTY]: "客户评分权重：风险评估",
  };

  return descriptions[key] || "";
}

export function getFollowupSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    [FOLLOWUP_SETTING_KEYS.STOP_AFTER_DAYS]:
      "自动跟进：最后一轮邮件发出后，超过多少天仍未回复则停止继续跟进",
    [FOLLOWUP_SETTING_KEYS.SCAN_INTERVAL_MINUTES]:
      "自动跟进：系统定时扫描频率（分钟，仅展示）",
  };

  return descriptions[key] || "";
}

function readNumericSetting(
  configMap: Map<string, string>,
  key: string,
  fallback: number
) {
  const rawValue = configMap.get(key);
  const parsedValue = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function isEmailPromptKey(key: string): key is (typeof EMAIL_PROMPT_KEYS)[number] {
  return EMAIL_PROMPT_KEYS.includes(key as (typeof EMAIL_PROMPT_KEYS)[number]);
}
