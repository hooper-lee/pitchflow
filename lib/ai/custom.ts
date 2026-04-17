import OpenAI from "openai";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getConfig(key: string, envFallback: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available, fall back to env
  }
  return process.env[envFallback] || null;
}

export interface CustomAIOverrides {
  baseURL?: string;
  apiKey?: string;
  model?: string;
}

async function getClient(overrides?: CustomAIOverrides): Promise<{ client: OpenAI; model: string }> {
  const baseURL = overrides?.baseURL || await getConfig("CUSTOM_AI_BASE_URL", "CUSTOM_AI_BASE_URL");
  const apiKey = overrides?.apiKey || await getConfig("CUSTOM_AI_API_KEY", "CUSTOM_AI_API_KEY");
  const model = overrides?.model || await getConfig("CUSTOM_AI_MODEL", "CUSTOM_AI_MODEL");

  if (!baseURL) throw new Error("Custom AI base URL not configured (CUSTOM_AI_BASE_URL)");
  if (!apiKey) throw new Error("Custom AI API key not configured (CUSTOM_AI_API_KEY)");

  const client = new OpenAI({ baseURL, apiKey });
  return { client, model: model || "gpt-4o" };
}

export interface GenerateEmailParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
  overrides?: CustomAIOverrides;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

const DEFAULT_SYSTEM_PROMPT =
  "You are an expert B2B sales copywriter. You MUST respond with ONLY a raw JSON object with two keys: 'subject' (string, email subject line) and 'body' (string, email body text). Do NOT include any explanation, reasoning, or thinking. Do NOT wrap in markdown code blocks. Just output the JSON directly.";

export async function generateEmail({
  prompt,
  maxTokens = 1024,
  overrides,
}: GenerateEmailParams): Promise<GeneratedEmail> {
  const { client, model } = await getClient(overrides);

  const systemPrompt = (await getConfig("AI_SYSTEM_PROMPT", "AI_SYSTEM_PROMPT")) || DEFAULT_SYSTEM_PROMPT;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  const text = completion.choices[0]?.message?.content || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
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
  overrides,
}: {
  prompt: string;
  model?: string;
  overrides?: CustomAIOverrides;
}): Promise<string> {
  const { client, model } = await getClient(overrides);

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: "system",
        content:
          "You are a business intelligence analyst. Provide detailed, structured analysis.",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0]?.message?.content || "";
}
