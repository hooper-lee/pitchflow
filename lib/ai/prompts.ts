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
  senderName: string;
  senderTitle?: string;
  angle?: string;
  templateBody?: string;
}

export function buildOutreachPrompt(params: EmailGenerationParams): string {
  const angleInstruction = params.angle
    ? `\nAngle: ${ANGLE_PROMPTS[params.angle] || ANGLE_PROMPTS.value_prop}`
    : "";

  return `Write a personalized cold outreach email with the following context:

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
${angleInstruction}
${params.templateBody ? `\nUse this template as a guide but personalize heavily:\n${params.templateBody}` : ""}

Output the email with subject line and body.`;
}

export function buildFollowupPrompt(
  params: EmailGenerationParams & { previousEmailBody: string; stepNumber: number }
): string {
  return `Write a follow-up email (step ${params.stepNumber}) based on this context:

Prospect:
- Name: ${params.prospectName}
- Company: ${params.companyName}
- Industry: ${params.industry}
- Country: ${params.country}

Sender:
- Name: ${params.senderName}
- Product/Service: ${params.productName}

Previous email sent (prospect did not reply):
---
${params.previousEmailBody}
---

${params.angle ? `Angle: ${ANGLE_PROMPTS[params.angle] || ANGLE_PROMPTS.value_prop}` : "Angle: value_prop"}

Write a follow-up that adds new value. Output subject and body.`;
}
