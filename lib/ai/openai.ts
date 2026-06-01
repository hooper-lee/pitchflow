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
          "你是一名专业的 B2B 销售文案。输出一个包含 'subject' 和 'body' 键的 JSON 对象。不要用 markdown 包裹，纯 JSON。",
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
          "你是一名商业情报分析师。提供详细、结构化的分析。",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0]?.message?.content || "";
}
