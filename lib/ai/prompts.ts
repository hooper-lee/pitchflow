import {
  COMMON_EMAIL_SKILL,
  EMAIL_JSON_OUTPUT_RULES,
  FOLLOWUP_EMAIL_SKILL,
  OUTREACH_EMAIL_SKILL,
  REPLY_FOLLOWUP_EMAIL_SKILL,
} from "./email-marketing-skill";

export const OUTREACH_SYSTEM_PROMPT = `You are an expert B2B sales copywriter specializing in foreign trade / international business development emails. Your task is to write personalized cold outreach emails.

Rules:
- Write in the target's language (infer from their country/company)
- Keep it concise: 100-150 words max
- Include a specific reference to the prospect's company or industry
- Highlight the value proposition clearly
- End with a clear call-to-action (schedule a call, reply, etc.)
- Be professional but warm
- Never use spammy language or excessive exclamation marks
- Use the prospect's first name in greeting
- Subject line should be compelling and under 50 characters when possible`;

export const FOLLOWUP_SYSTEM_PROMPT = `You are writing a follow-up email for a B2B sales sequence. The prospect has not replied to the initial outreach.

Rules:
- Reference the previous email subtly ("I reached out last week about...")
- Shift the angle/perspective from the initial email
- Provide new value or insight (don't just "check in")
- Keep it short: 80-120 words
- End with a low-commitment CTA`;

export const RESEARCH_SYSTEM_PROMPT = `You are a business intelligence analyst. Analyze the provided company information and generate a structured prospect profile.

Output format:
## Company Overview
[1-2 sentences about the company]

## Key Facts
- Industry: ...
- Size: ...
- Location: ...
- Products/Services: ...

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

// ── Prospect Research Prompts ─────────────────────────────────

export const PROSPECT_RESEARCH_SYSTEM_PROMPT = `You are a B2B business intelligence analyst specializing in company research for sales outreach.

Your task is to analyze company information from websites and extract structured data for lead scoring and personalization.

Output ONLY valid JSON, no markdown, no explanation.`;

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

export const PROSPECT_SCORING_SYSTEM_PROMPT = `You are a B2B sales lead scoring expert. Your task is to evaluate prospects based on research data and assign scores across 5 dimensions.

Output ONLY valid JSON, no markdown, no explanation.`;

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
