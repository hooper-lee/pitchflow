import {
  COMMON_EMAIL_SKILL,
  EMAIL_JSON_OUTPUT_RULES,
  FOLLOWUP_EMAIL_SKILL,
  OUTREACH_EMAIL_SKILL,
  REPLY_FOLLOWUP_EMAIL_SKILL,
} from "./email-marketing-skill";

export const OUTREACH_SYSTEM_PROMPT = `你是一名专注于外贸/国际业务开发的 B2B 销售文案专家。你的任务是写个性化的冷启动开发信。

规则：
- 用目的人的语言写作（从他们的国家/公司推断）
- 保持简洁：最多 100-150 词
- 包含对客户公司或行业的具体引用
- 清晰突出价值主张
- 以明确的行动号召结尾（安排通话、回复等）
- 专业但热情
- 不要使用垃圾语言或过多感叹号
- 在问候语中使用客户的名字
- 主题行应引人注目，尽可能在 50 个字符以内`;

export const FOLLOWUP_SYSTEM_PROMPT = `你在为 B2B 销售序列写跟进邮件。客户尚未回复首次联系。

规则：
- 巧妙提及之前的邮件（"我之前联系过您关于..."）
- 从首封邮件转换角度/视角
- 提供新的价值或见解（不要只是"跟进一下"）
- 保持简短：80-120 词
- 以低承诺的行动号召结尾`;

export const RESEARCH_SYSTEM_PROMPT = `你是一名商业情报分析师。分析提供的公司信息，生成结构化的客户档案。

输出格式：
## 公司概况
[1-2 句关于公司]

## 关键事实
- 行业：...
- 规模：...
- 地点：...
- 产品/服务：...

## Recent Developments
[Any recent news or changes]

## Talking Points
[2-3 personalized talking points for outreach]

## Recommended Approach
[Best angle for cold outreach: value prop, social proof, pain point, etc.]`;

export const ANGLE_PROMPTS: Record<string, string> = {
  value_prop:
    "Focus on the unique value proposition. Highlight what makes the sender's offering superior and how it directly benefits the prospect's business.",
  social_proof:
    "Focus on social proof. Reference similar companies in the industry that have achieved success, case studies, or testimonials.",
  pain_point:
    "Focus on the pain point. Identify a common industry challenge and position the sender's solution as the answer.",
  urgency:
    "Create urgency. Mention limited-time offers, upcoming price changes, or seasonal opportunities.",
};

export interface EmailGenerationParams {
  prospectName: string;
  companyName: string;
  industry: string;
  country: string;
  researchSummary?: string;
  productName: string;
  productDescription?: string;
  valueProposition?: string;
  senderName: string;
  senderTitle?: string;
  angle?: string;
  templateBody?: string;
}

export function buildOutreachPrompt(params: EmailGenerationParams): string {
  const angleInstruction = params.angle
    ? `\nAngle: ${ANGLE_PROMPTS[params.angle] || ANGLE_PROMPTS.value_prop}`
    : "";

  return `${COMMON_EMAIL_SKILL}
${OUTREACH_EMAIL_SKILL}

Write a personalized cold outreach email with the following context:

Prospect:
- Name: ${params.prospectName}
- Company: ${params.companyName}
- Industry: ${params.industry}
- Country: ${params.country}
${params.researchSummary ? `- Research: ${params.researchSummary}` : ""}

Sender:
- Name: ${params.senderName}
${params.senderTitle ? `- Title: ${params.senderTitle}` : ""}
- Product/Service: ${params.productName}
${params.productDescription ? `- Product Description: ${params.productDescription}` : ""}
${params.valueProposition ? `- Value Proposition: ${params.valueProposition}` : ""}
${angleInstruction}
${params.templateBody ? `\nUse this template as a guide but personalize heavily:\n${params.templateBody}` : ""}

${EMAIL_JSON_OUTPUT_RULES}`;
}

export function buildOutreachPromptFromTemplate(userPromptTemplate: string): string {
  return `${COMMON_EMAIL_SKILL}
${OUTREACH_EMAIL_SKILL}

${userPromptTemplate}

${EMAIL_JSON_OUTPUT_RULES}`;
}

export function buildFollowupPrompt(
  params: EmailGenerationParams & { previousEmailBody: string; stepNumber: number }
): string {
  return `${COMMON_EMAIL_SKILL}
${FOLLOWUP_EMAIL_SKILL}

Write a follow-up email (step ${params.stepNumber}) based on this context:

Prospect:
- Name: ${params.prospectName}
- Company: ${params.companyName}
- Industry: ${params.industry}
- Country: ${params.country}

Sender:
- Name: ${params.senderName}
- Product/Service: ${params.productName}
${params.productDescription ? `- Product Description: ${params.productDescription}` : ""}
${params.valueProposition ? `- Value Proposition: ${params.valueProposition}` : ""}

Previous email sent (prospect did not reply):
---
${params.previousEmailBody}
---

${params.angle ? `Angle: ${ANGLE_PROMPTS[params.angle] || ANGLE_PROMPTS.value_prop}` : "Angle: value_prop"}

${EMAIL_JSON_OUTPUT_RULES}`;
}

export function buildFollowupPromptFromTemplate(userPromptTemplate: string): string {
  return `${COMMON_EMAIL_SKILL}
${FOLLOWUP_EMAIL_SKILL}

${userPromptTemplate}

${EMAIL_JSON_OUTPUT_RULES}`;
}

export function buildReplyFollowupPrompt(
  params: EmailGenerationParams & {
    previousEmailBody?: string;
    replyBody: string;
    replySubject?: string;
  }
): string {
  return `${COMMON_EMAIL_SKILL}
${REPLY_FOLLOWUP_EMAIL_SKILL}

Write a warm reply-follow-up email based on this context:

Prospect:
- Name: ${params.prospectName}
- Company: ${params.companyName}
- Industry: ${params.industry}
- Country: ${params.country}
${params.researchSummary ? `- Research: ${params.researchSummary}` : ""}

Sender:
- Name: ${params.senderName}
${params.senderTitle ? `- Title: ${params.senderTitle}` : ""}
- Product/Service: ${params.productName}
${params.productDescription ? `- Product Description: ${params.productDescription}` : ""}
${params.valueProposition ? `- Value Proposition: ${params.valueProposition}` : ""}

Previous email:
---
${params.previousEmailBody || "N/A"}
---

Prospect reply${params.replySubject ? ` (${params.replySubject})` : ""}:
---
${params.replyBody}
---

${EMAIL_JSON_OUTPUT_RULES}`;
}

export function buildReplyFollowupPromptFromTemplate(userPromptTemplate: string): string {
  return `${COMMON_EMAIL_SKILL}
${REPLY_FOLLOWUP_EMAIL_SKILL}

${userPromptTemplate}

${EMAIL_JSON_OUTPUT_RULES}`;
}

// ── Prospect Research Prompts ─────────────────────────────────

export const PROSPECT_RESEARCH_SYSTEM_PROMPT = `你是专注于销售开发公司调研的 B2B 商业情报分析师。

你的任务是分析来自网站的公司信息，提取结构化数据，用于客户评分和个性化沟通。

只输出有效的 JSON，不要 markdown，不要解释。`;

export interface ProspectResearchInput {
  companyName: string;
  website?: string;
  industry?: string;
  country?: string;
  existingResearch?: string; // 现有的 research_summary
  websiteContent?: string; // 网站抓取的内容
  searchResults?: string; // SerpAPI 搜索结果
}

export function buildProspectResearchPrompt(input: ProspectResearchInput): string {
  const sections: string[] = [];

  sections.push(`# Company Research Task

Analyze the following company and extract structured information for B2B sales outreach.`);

  sections.push(`
## Company Basics
- Company Name: ${input.companyName}
- Website: ${input.website || "N/A"}
- Industry: ${input.industry || "N/A"}
- Country: ${input.country || "N/A"}
`);

  if (input.existingResearch) {
    sections.push(`
## Existing Research Summary
${input.existingResearch}
`);
  }

  if (input.websiteContent) {
    sections.push(`
## Website Content
${input.websiteContent.slice(0, 8000)}
`);
  }

  if (input.searchResults) {
    sections.push(`
## Search Results
${input.searchResults.slice(0, 4000)}
`);
  }

  sections.push(`
## Output Requirements

Extract the following structured fields. If information is not available, use null:

{
  "aiSummary": "2-3 sentence summary of the company for sales context",
  "companyDescription": "What the company does (1-2 sentences)",
  "foundingYear": year or null,
  "employeeCount": "1-10, 11-50, 51-200, 201-500, 500-1000, 1000+ or null",
  "companyType": "manufacturer, distributor, wholesaler, retailer, service_provider, trader, or null",
  "businessModel": "B2B, B2C, B2B2C, or null",
  "mainProducts": ["product1", "product2"] or [],
  "productCategories": ["category1", "category2"] or [],
  "productionCapacity": "Description of production capacity or null",
  "certifications": ["ISO9001", "CE"] or [],
  "targetMarkets": ["North America", "Europe"] or [],
  "exportRegions": ["EU", "Asia"] or [],
  "keyMarkets": ["USA", "Germany"] or [],
  "procurementKeywords": ["OEM", "wholesale", "bulk"] or [],
  "typicalOrderValue": "$1000-5000" or null,
  "supplierCriteria": "What they look for in suppliers or null",
  "decisionMakers": [{"name": "John", "position": "CEO", "linkedin": "url"}] or [],
  "phoneNumbers": ["+1-xxx"] or [],
  "addresses": ["123 Main St, City, Country"] or [],
  "socialMedia": {"linkedin": "url", "facebook": "url"} or {}
}

Be accurate and conservative - only include information you can reasonably infer from the content.`);

  return sections.join("\n");
}

// ── Prospect Scoring Prompts ─────────────────────────────────

export const PROSPECT_SCORING_SYSTEM_PROMPT = `你是 B2B 销售客户评分专家。你的任务是基于调研数据评估客户，并按 5 个维度打分。

只输出有效的 JSON，不要 markdown，不要解释。`;

/**
 * 构建评分 Prompt
 */
export function buildProspectScoringPrompt(input: {
  companyName: string;
  industry?: string | null;
  country?: string | null;
  website?: string | null;
  research: {
    aiSummary?: string | null;
    companyDescription?: string | null;
    employeeCount?: string | null;
    companyType?: string | null;
    businessModel?: string | null;
    mainProducts?: string[] | null;
    targetMarkets?: string[] | null;
    exportRegions?: string[] | null;
    procurementKeywords?: string[] | null;
    typicalOrderValue?: string | null;
    supplierCriteria?: string | null;
    decisionMakers?: { name: string; position: string; linkedin?: string }[] | null;
  };
}): string {
  const sections: string[] = [];

  sections.push(`# Lead Scoring Task

Evaluate this prospect and score them across 5 dimensions.`);

  sections.push(`
## Company Information
- Name: ${input.companyName}
- Industry: ${input.industry || "N/A"}
- Country: ${input.country || "N/A"}
- Website: ${input.website || "N/A"}
`);

  sections.push(`
## AI Research Data
- Summary: ${input.research.aiSummary || "N/A"}
- Description: ${input.research.companyDescription || "N/A"}
- Company Type: ${input.research.companyType || "N/A"}
- Employee Count: ${input.research.employeeCount || "N/A"}
- Business Model: ${input.research.businessModel || "N/A"}
- Main Products: ${(input.research.mainProducts || []).join(", ") || "N/A"}
- Target Markets: ${(input.research.targetMarkets || []).join(", ") || "N/A"}
- Export Regions: ${(input.research.exportRegions || []).join(", ") || "N/A"}
- Procurement Keywords: ${(input.research.procurementKeywords || []).join(", ") || "N/A"}
- Typical Order Value: ${input.research.typicalOrderValue || "N/A"}
- Supplier Criteria: ${input.research.supplierCriteria || "N/A"}
- Decision Makers: ${
  (input.research.decisionMakers || [])
    .map((d) => `${d.name} (${d.position})`)
    .join(", ") || "N/A"
}
`);

  sections.push(`
## Scoring Dimensions (0-100 scale)

1. **ICP Match Score (ICP匹配度)**: How well does this prospect match your ideal customer profile?
   - Consider: industry fit, company size, target market alignment, business model

2. **Buying Intent Score (采购意向)**: How likely is this prospect to have purchasing needs?
   - Consider: procurement keywords, typical order value, target markets, recent activity

3. **Reachability Score (可触达性)**: How easy is it to reach this prospect?
   - Consider: has decision maker info, has valid contact, company type, geography

4. **Deal Potential Score (成交潜力)**: What is the potential deal size and conversion probability?
   - Consider: company size, order value, export regions, business model

5. **Risk Penalty Score (风险评估)**: What is the risk level? (100 = no risk, 0 = high risk)
   - Consider: company legitimacy, payment ability, regulatory compliance

## Output Requirements

Return JSON:
{
  "icpFitScore": 0-100,
  "buyingIntentScore": 0-100,
  "reachabilityScore": 0-100,
  "dealPotentialScore": 0-100,
  "riskPenaltyScore": 0-100,
  "reasoning": "Brief explanation for each score (1-2 sentences per dimension)"
}

Be objective and evidence-based.`);

  return sections.join("\n");
}
