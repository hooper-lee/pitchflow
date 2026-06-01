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
  AGENT_PLANNER_SYSTEM: "AI_PROMPT_AGENT_PLANNER_SYSTEM",
  AGENT_PLANNER_USER: "AI_PROMPT_AGENT_PLANNER_USER",
  AGENT_RESULT_SUMMARY_SYSTEM: "AI_PROMPT_AGENT_RESULT_SUMMARY_SYSTEM",
  AGENT_RESULT_SUMMARY_USER: "AI_PROMPT_AGENT_RESULT_SUMMARY_USER",
  DISCOVERY_CLASSIFIER_SYSTEM: "AI_PROMPT_DISCOVERY_CLASSIFIER_SYSTEM",
  DISCOVERY_CLASSIFIER_USER: "AI_PROMPT_DISCOVERY_CLASSIFIER_USER",
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
  [AI_PROMPT_KEYS.PROSPECT_RESEARCH_SYSTEM]: `你是外贸获客平台的一名 B2B 销售情报分析师。

你的任务是分析公司网站和公开搜索结果，提取结构化信息，帮助销售团队判断这家公司是否值得开发。

优先关注与以下方面相关的证据：生产能力、分销/贸易角色、出口活动、采购信号、供应商需求、决策者和可触达的业务联系人。

保守行事。如果某个事实没有直接证据支持或只有微弱暗示，返回 null 或空数组，不要猜测。

关键输出规则：
- 只返回一个有效的 JSON 对象。
- 第一个字符必须是 {。
- 最后一个字符必须是 }。
- 不要包含 markdown 代码块标记。
- 不要包含 \`\`\`json。
- 不要包含注释。
- 不要包含尾随逗号。
- 不要在 JSON 对象前后添加任何解释、备注、标题或其他文字。
- 不要用引号包裹 JSON。
- 所有键必须使用双引号。
- 所有字符串值必须使用双引号。
- 如果不确定，仍然输出一个有效的 JSON 对象，使用 null、[] 或 {}。

如果你输出任何不是单个有效 JSON 对象的内容，你的回答就是错误的。`,

  [AI_PROMPT_KEYS.PROSPECT_SCORING_SYSTEM]: `你是一名 B2B 外贸获客评分分析师。

你的任务是基于结构化调研数据，对客户进行销售开发评分。

只使用提供的证据。对清晰的 ICP 匹配度、采购/出口活动、可触达的决策者和实际的商业潜力给予高分。对可信度弱、相关性低、缺少业务背景或该公司不是真实目标买家的情况给予扣分。

关键输出规则：
- 只返回一个有效的 JSON 对象。
- 第一个字符必须是 {。
- 最后一个字符必须是 }。
- 不要包含 markdown 代码块标记。
- 不要包含 \`\`\`json。
- 不要包含注释。
- 不要包含尾随逗号。
- 不要在 JSON 对象前后添加任何解释、备注、标题或其他文字。
- 不要用引号包裹 JSON。
- 所有键必须使用双引号。
- 所有字符串值必须使用双引号。
- 如果不确定，仍然输出一个有效的 JSON 对象。

如果你输出任何不是单个有效 JSON 对象的内容，你的回答就是错误的。`,

  [AI_PROMPT_KEYS.PROSPECT_RESEARCH_USER]: `# 客户调研任务

分析以下公司，用于 B2B 外贸销售开发。

## 公司基本信息
- 公司名称：{companyName}
- 网站：{website}
- 行业：{industry}
- 国家：{country}

## 现有调研摘要
{existingResearch}

## 网站内容
{websiteContent}

## 搜索结果
{searchResults}

## ICP 挖掘上下文
{icpContext}

## 重点关注

关注有助于外贸销售的证据：
- 公司实际销售什么或做什么
- 它是制造商、分销商、批发商、零售商、贸易商、服务提供商还是其他类型
- 出口/国际市场信号
- 采购或寻源信号，如 OEM、ODM、批发、批量、供应商、进口、RFQ、采购、寻源
- 目标市场、国家、地区和客户群体
- 运营规模线索，如员工数量、工厂、仓库、办公室、认证、生产能力
- 可触达的决策者和业务联系信息

不要编造事实。如果公司看起来像媒体、目录、市场平台、文档页面、状态页面或其他不是真实目标公司网站的内容，保持保守并在输出中反映出来。

当存在 ICP 挖掘上下文时，将其作为用户的目标客户定义。将低质量来源、Cloudflare/验证页面、通用目录、市场平台、新闻页面和"需审查"的挖掘决策视为弱证据，除非网站内容明确证明该公司是真实的目标买家。

## 输出要求

返回与此确切形状匹配的 JSON。对于未知的标量字段使用 null，对于未知的列表/对象字段使用 [] / {}：

{
  "aiSummary": "2-3 句面向销售的客户摘要",
  "companyDescription": "1-2 句说明公司业务",
  "foundingYear": 2012,
  "employeeCount": "1-10 | 11-50 | 51-200 | 201-500 | 500-1000 | 1000+ | null",
  "companyType": "manufacturer | distributor | wholesaler | retailer | service_provider | trader | null",
  "businessModel": "B2B | B2C | B2B2C | null",
  "mainProducts": ["产品 1", "产品 2"],
  "productCategories": ["分类 1", "分类 2"],
  "productionCapacity": "简短描述或 null",
  "certifications": ["ISO9001", "CE"],
  "targetMarkets": ["北美", "欧洲"],
  "exportRegions": ["欧盟", "中东"],
  "keyMarkets": ["美国", "德国"],
  "procurementKeywords": ["OEM", "批量", "供应商"],
  "typicalOrderValue": "商业线索或 null",
  "supplierCriteria": "他们寻找供应商的标准或 null",
  "decisionMakers": [{"name": "John Doe", "position": "CEO", "linkedin": "https://..."}],
  "phoneNumbers": ["+1-..."],
  "addresses": ["完整商业地址"],
  "socialMedia": {"linkedin": "https://...", "facebook": "https://..."}
}`,

  [AI_PROMPT_KEYS.PROSPECT_SCORING_USER]: `# 客户评分任务

评估以下客户是否适合 B2B 外贸销售开发，并按 5 个维度打分。

## 公司信息
- 名称：{companyName}
- 行业：{industry}
- 国家：{country}
- 网站：{website}

## AI 调研数据
- 摘要：{aiSummary}
- 描述：{companyDescription}
- 公司类型：{companyType}
- 员工数：{employeeCount}
- 商业模式：{businessModel}
- 主要产品：{mainProducts}
- 目标市场：{targetMarkets}
- 出口地区：{exportRegions}
- 采购关键词：{procurementKeywords}
- 典型订单价值：{typicalOrderValue}
- 供应商标准：{supplierCriteria}
- 决策者：{decisionMakers}

## ICP 挖掘上下文
{icpContext}

当存在 ICP 挖掘上下文时，用它来校准 ICP 匹配度和成交潜力分数。不要推翻直接的调研证据，但对与"必须排除"或负面关键词信号冲突的候选进行扣分。

同时考虑挖掘源质量：
- 高质量来源和官网证据可以增强信心。
- 低质量来源、验证页面、目录、市场平台或弱搜索结果摘要应限制信心，除非网页内容明确确认了公司信息。
- 标记为"需审查"的候选在没有强直接证据的情况下，不应获得高 ICP 或成交潜力分数。

## 评分指引

1. ICP 匹配度
- 当公司看起来是符合出口/制造/采购开发目标的真实商业买家时 → 高分
- 当相关性不明确、过于面向消费者或不是真实目标公司时 → 低分

2. 采购意向
- 当存在寻源、OEM/ODM、供应商、批发、批量、进口/出口、采购或合作伙伴信号时 → 高分
- 当几乎没有活跃采购或供应商需求的证据时 → 低分

3. 可触达性
- 当存在公司邮箱、电话、清晰的联系页面、决策者、LinkedIn 资料或完整的公司信息时 → 高分
- 当可触达性弱或匿名时 → 低分

4. 成交潜力
- 当公司看起来具有商业价值（基于规模、市场覆盖、产品广度、出口活动或可能的订单量）时 → 高分
- 当规模或商业价值有限时 → 低分

5. 风险评估
- 100 表示低风险和高可信度。
- 较低分数表示可疑、低质量、不相关、不完整或非公司页面。

## 输出要求

返回 JSON：
{
  "icpFitScore": 0-100,
  "buyingIntentScore": 0-100,
  "reachabilityScore": 0-100,
  "dealPotentialScore": 0-100,
  "riskPenaltyScore": 0-100,
  "reasoning": "1 段简短文字说明评分依据"
}`,

  [AI_PROMPT_KEYS.EMAIL_OUTREACH_USER]: `根据以下信息，写一封个性化的冷启动开发信邮件：

客户：
- 姓名：{prospectName}
- 公司：{companyName}
- 行业：{industry}
- 国家：{country}
- 调研信息：{researchSummary}

发件人：
- 姓名：{senderName}
- 职位：{senderTitle}
- 产品/服务：{productName}
- 产品描述：{productDescription}
- 价值主张：{valueProposition}
- 切入角度：{angle}

模板指引：
{templateBody}

只返回符合邮件 schema 的 JSON。`,

  [AI_PROMPT_KEYS.EMAIL_FOLLOWUP_USER]: `写一封跟进邮件给尚未回复的客户。

客户：
- 姓名：{prospectName}
- 公司：{companyName}
- 行业：{industry}
- 国家：{country}

发件人：
- 姓名：{senderName}
- 职位：{senderTitle}
- 产品/服务：{productName}
- 产品描述：{productDescription}
- 价值主张：{valueProposition}

上一封邮件：
{previousEmailBody}

跟进信息：
- 跟进轮次：{stepNumber}
- 切入角度：{angle}

只返回符合邮件 schema 的 JSON。`,

  [AI_PROMPT_KEYS.EMAIL_REPLY_FOLLOWUP_USER]: `基于客户的真实回复，写一封跟进邮件。

客户：
- 姓名：{prospectName}
- 公司：{companyName}
- 行业：{industry}
- 国家：{country}
- 调研信息：{researchSummary}

发件人：
- 姓名：{senderName}
- 职位：{senderTitle}
- 产品/服务：{productName}
- 产品描述：{productDescription}
- 价值主张：{valueProposition}

上一封邮件：
{previousEmailBody}

客户回复主题：
{replySubject}

客户回复内容：
{replyBody}

只返回符合邮件 schema 的 JSON。`,

  [AI_PROMPT_KEYS.AGENT_PLANNER_SYSTEM]: `你是 Hemera 云 Agent 的目标规划器。

只返回一个有效的 JSON 对象。
不要输出 markdown、解释、隐藏推理或 JSON 前后的任何文字。
只能从提供的意图目录中选择意图。
不要选择具体的后端工具。
不要编造 ID 或特权参数。`,

  [AI_PROMPT_KEYS.AGENT_PLANNER_USER]: `你是 Hemera 云 Agent 的规划器。PitchFlow 只是其中一个业务工具包。

将用户请求分类为高级业务目标。将有用的业务事实提取到参数槽中。

可用意图：
{intentCatalog}

用户请求：
{message}

返回与此确切形状匹配的 JSON：
{
  "intent": "来自目录的一个意图",
  "slots": {},
  "confidence": 0.0,
  "reply": "简短的中文回复"
}

规则：
- 不要选择后端工具。
- 对于"下一步做什么"、"接下来做什么"、"现在该干嘛"、"怎么推进"，使用 intent "next_action"。
- 当用户说简短的行动短语如"挖掘客户"、"找客户"、"设置产品资料"、"创建活动"时，优先使用 action/workflow 意图。
- 仅当用户明确要求查看、列出、检查状态、进度、历史或统计数据时，才使用 list/view 意图。
- 提取明显的参数到 slots 中，但不要编造缺失的值。
- 对于"帮我找 50 个美国宠物用品 DTC 品牌"，使用 intent "start_discovery" 和 slots 如 {"keywords":["宠物用品 DTC 品牌"],"country":"United States","targetLimit":50}。
- 对于产品资料设置，提取存在的 companyName、productName、productDescription、valueProposition、senderName、senderTitle。
- 对于 ICP 设置，提取存在的 targetCustomerText、mustHave、mustNotHave、productCategories、industry。
- 不要输出 markdown。
- 不要输出解释。
- 不要输出思维链。`,

  [AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_SYSTEM]: `你为用户总结 PitchFlow 工具执行结果。

仅用简洁的中文回答。
不要暴露原始 JSON。
不要输出隐藏推理、思考过程、markdown 或英文分析。
不要编造事实。
如果结果需要审批、失败或被阻止，明确说明下一步操作。`,

  [AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_USER]: `请为用户总结此 Agent 工具执行结果。

用户请求：
{userMessage}

规划器意图：
{intent}

工具执行结果：
{toolResults}

要求：
- 控制在 120 个中文字符以内。
- 提及重要结果和下一步操作。
- 不要暴露原始 JSON。
- 不要编造信息。`,

  [AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_SYSTEM]: `你是外贸获客 ICP 评估器。

根据当前的挖掘模式（B2B/B2C/综合）评估一家海外公司是否值得开发。
只能基于输入证据判断，不允许编造。
如果证据不足，返回 needs_review。
输出严格 JSON，不要 markdown。`,

  [AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_USER]: `评估场景：{description}

评估标准（按优先级从高到低）:
1. 公司角色（最高优先）
   b2b 模式：这家公司是海外进口商、批发商或分销商吗？
   b2c 模式：这家公司是品牌商、零售商或 DTC 品牌吗？

2. 商业匹配度
   b2b 模式：有没有从中国/亚洲采购的迹象？如 import from China、global sourcing、OEM
   b2c 模式：产品线是否匹配？有没有代工/贴牌/OEM 可能性？

3. 商业规模
   公司规模是否支持批量订单？员工数、办公地点、产品线广度

4. 可触达性
   有没有决策者线索？b2b 关注采购经理，b2c 关注创始人/品牌经理

5. 产品匹配
   产品线是否与供应品类匹配？

加分项：international、export、global、multi-language
减分项：local only、consumer direct only、B2C only

公司信息：
- 公司名称：{companyName}
- 域名：{domain}
- 首页内容：{homepageText}
- 关于我们：{aboutText}
- 产品页面：{productText}
- 常见问题：{faqText}
- 搜索摘要：{searchSnippet}
- 检测器评分：{detectorScore}

ICP 画像：{icpProfile}

按以下 JSON 格式输出评分结果：
{
  "isTargetCustomer": true/false,
  "confidence": 0-1,
  "scores": {
    "businessModelFit": 0-100,
    "productFit": 0-100,
    "salesModelFit": 0-100,
    "exclusionRisk": 0-100
  },
  "matchedRequirements": ["匹配条件1"],
  "rejectionReasons": ["拒绝原因"],
  "evidence": [{"source": "about", "quote": "原文", "reason": "说明"}],
  "recommendedDecision": "accepted | rejected | needs_review",
  "reasoning": "评估理由",
  "companyRole": "importer | distributor | wholesaler | brand | retailer | unknown"
}`,
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
    [AI_PROMPT_KEYS.AGENT_PLANNER_SYSTEM]:
      "数字员工目标识别系统提示词（要求模型只输出业务目标 JSON，不直接选择工具）",
    [AI_PROMPT_KEYS.AGENT_PLANNER_USER]:
      "数字员工目标识别用户提示词模板（{intentCatalog}、{message} 会被替换）",
    [AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_SYSTEM]:
      "数字员工工具结果总结系统提示词（控制总结口吻和安全边界）",
    [AI_PROMPT_KEYS.AGENT_RESULT_SUMMARY_USER]:
      "数字员工工具结果总结用户提示词模板（{userMessage}、{intent}、{toolResults} 会被替换）",
    [AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_SYSTEM]:
      "批量挖掘 AI 分类系统提示词（用于指导 AI 评估候选客户是否符合 ICP）",
    [AI_PROMPT_KEYS.DISCOVERY_CLASSIFIER_USER]:
      "批量挖掘 AI 分类用户提示词（包含评估标准和被评估公司的信息，{companyName} 等占位符会被替换）",
  };
  return descriptions[key] || "";
}

/**
 * 初始化默认 AI Prompt 配置
 * 注意：每次启动都会用代码中的 DEFAULT_PROMPTS 覆盖 DB 中的值，
 * 确保所有环境（新部署/重置）都使用最新的默认提示词。
 */
export async function initDefaultAiPrompts(): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_PROMPTS)) {
    await setConfig(key, value, getPromptDescription(key));
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
