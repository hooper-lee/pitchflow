import Anthropic from "@anthropic-ai/sdk";
import { PROSPECT_RESEARCH_SYSTEM_PROMPT, PROSPECT_SCORING_SYSTEM_PROMPT } from "./prompts";
import { parseJsonWithRepair } from "./json-utils";

export interface GenerateEmailParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface ProspectResearchOutput {
  aiSummary: string;
  companyDescription: string | null;
  foundingYear: number | null;
  employeeCount: string | null;
  companyType: string | null;
  businessModel: string | null;
  mainProducts: string[];
  productCategories: string[];
  productionCapacity: string | null;
  certifications: string[];
  targetMarkets: string[];
  exportRegions: string[];
  keyMarkets: string[];
  procurementKeywords: string[];
  typicalOrderValue: string | null;
  supplierCriteria: string | null;
  decisionMakers: { name: string; position: string; linkedin?: string }[];
  phoneNumbers: string[];
  addresses: string[];
  socialMedia: Record<string, string>;
}

export async function generateEmail({
  prompt,
  model = "claude-sonnet-4-20250514",
  maxTokens = 1024,
}: GenerateEmailParams): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    system:
      "You are an expert B2B sales copywriter. Output a JSON object with 'subject' and 'body' keys. No markdown wrapping, just raw JSON.",
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    return parseJsonWithRepair<GeneratedEmail>(text);
  } catch {
    // Fallback: extract subject and body from text
    const lines = text.split("\n");
    const subjectLine = lines.find((l) =>
      l.toLowerCase().startsWith("subject:")
    );
    const subject = subjectLine?.replace(/^subject:\s*/i, "") || "Quick question";
    const body = lines
      .filter((l) => !l.toLowerCase().startsWith("subject:"))
      .join("\n")
      .trim();

    return { subject, body };
  }
}

export async function researchProspect({
  prompt,
  model = "claude-sonnet-4-20250514",
}: {
  prompt: string;
  model?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    system:
      "You are a business intelligence analyst. Provide detailed, structured analysis.",
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function extractProspectResearch({
  prompt,
  systemPrompt = PROSPECT_RESEARCH_SYSTEM_PROMPT,
  model = "claude-sonnet-4-20250514",
}: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
}): Promise<ProspectResearchOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    system: systemPrompt,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = parseJsonWithRepair<Partial<ProspectResearchOutput>>(text);
    // Return with defaults for missing fields
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
  } catch {
    console.error("Failed to parse AI research output:", text);
    throw new Error("Failed to parse AI research output");
  }
}

export interface ProspectScoringOutput {
  icpFitScore: number;
  buyingIntentScore: number;
  reachabilityScore: number;
  dealPotentialScore: number;
  riskPenaltyScore: number;
  reasoning: string;
}

export async function scoreProspectWithAI({
  prompt,
  systemPrompt = PROSPECT_SCORING_SYSTEM_PROMPT,
  model = "claude-sonnet-4-20250514",
}: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
}): Promise<ProspectScoringOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
    system: systemPrompt,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = parseJsonWithRepair<Partial<ProspectScoringOutput>>(text);
    return {
      icpFitScore: Math.min(100, Math.max(0, parsed.icpFitScore || 50)),
      buyingIntentScore: Math.min(100, Math.max(0, parsed.buyingIntentScore || 50)),
      reachabilityScore: Math.min(100, Math.max(0, parsed.reachabilityScore || 50)),
      dealPotentialScore: Math.min(100, Math.max(0, parsed.dealPotentialScore || 50)),
      riskPenaltyScore: Math.min(100, Math.max(0, parsed.riskPenaltyScore || 50)),
      reasoning: parsed.reasoning || "",
    };
  } catch {
    console.error("Failed to parse AI scoring output:", text);
    throw new Error("Failed to parse AI scoring output");
  }
}
