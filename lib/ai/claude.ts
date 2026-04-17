import Anthropic from "@anthropic-ai/sdk";

export interface GenerateEmailParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
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
    // Try to parse JSON from the response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
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
