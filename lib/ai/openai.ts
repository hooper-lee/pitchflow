import OpenAI from "openai";

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
  model = "gpt-4o",
  maxTokens = 1024,
}: GenerateEmailParams): Promise<GeneratedEmail> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content:
          "You are an expert B2B sales copywriter. Output a JSON object with 'subject' and 'body' keys. No markdown wrapping, just raw JSON.",
      },
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
  model = "gpt-4o",
}: {
  prompt: string;
  model?: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const client = new OpenAI({ apiKey });

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
