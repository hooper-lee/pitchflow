import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getAIProviderWithConfig, buildOutreachPrompt, buildFollowupPrompt } from "@/lib/ai";
import { parseJsonWithRepair } from "@/lib/ai/json-utils";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { getDefaultResearchProvider } from "@/lib/services/config.service";

type AIProvider = "claude" | "openai" | "custom";
type GeneratedEmail = { subject: string; body: string };
type StreamEvent =
  | { type: "status"; message: string }
  | { type: "subject"; value: string }
  | { type: "body"; value: string }
  | { type: "done" }
  | { type: "error"; message: string };

function createJsonLine(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stripThinkBlocks(text: string) {
  return text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "").trim();
}

function stripCodeFences(text: string) {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function sanitizeEmailText(text: string) {
  return stripCodeFences(stripThinkBlocks(text));
}

function extractPlainEmail(text: string): GeneratedEmail {
  const cleanedText = sanitizeEmailText(text);
  const lines = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectLine = lines.find((line) =>
    line.toLowerCase().startsWith("subject:")
  );
  const subject = subjectLine?.replace(/^subject:\s*/i, "").trim() || "Quick question";
  const body = lines
    .filter((line) => !line.toLowerCase().startsWith("subject:"))
    .join("\n")
    .trim();

  return { subject, body };
}

function normalizeGeneratedEmail(value: unknown): GeneratedEmail {
  if (typeof value === "string") {
    try {
      return normalizeGeneratedEmail(parseJsonWithRepair<GeneratedEmail>(sanitizeEmailText(value)));
    } catch {
      return extractPlainEmail(value);
    }
  }

  if (value && typeof value === "object") {
    const subject = sanitizeEmailText(asString((value as GeneratedEmail).subject)).trim();
    const body = sanitizeEmailText(asString((value as GeneratedEmail).body)).trim();

    return {
      subject: subject || "Quick question",
      body,
    };
  }

  return { subject: "Quick question", body: "" };
}

function buildPrompt(body: Record<string, unknown>) {
  const {
    type = "outreach",
    prospectName,
    companyName,
    industry,
    country,
    researchSummary,
    productName,
    senderName,
    senderTitle,
    angle,
    templateBody,
    previousEmailBody,
    stepNumber,
    userRequirements,
  } = body;

  let prompt =
    type === "followup"
      ? buildFollowupPrompt({
          prospectName: asString(prospectName),
          companyName: asString(companyName),
          industry: asString(industry),
          country: asString(country),
          researchSummary: asOptionalString(researchSummary),
          productName: asString(productName, "our products"),
          senderName: asString(senderName, "Our Team"),
          senderTitle: asOptionalString(senderTitle),
          angle: asOptionalString(angle),
          previousEmailBody: asString(previousEmailBody),
          stepNumber: Number(stepNumber || 2),
        })
      : buildOutreachPrompt({
          prospectName: asString(prospectName),
          companyName: asString(companyName),
          industry: asString(industry),
          country: asString(country),
          researchSummary: asOptionalString(researchSummary),
          productName: asString(productName, "our products"),
          senderName: asString(senderName, "Our Team"),
          senderTitle: asOptionalString(senderTitle),
          angle: asOptionalString(angle),
          templateBody: asOptionalString(templateBody),
        });

  if (userRequirements) {
    prompt = `${prompt}\n\nAdditional requirements from the user:\n${String(userRequirements)}`;
  }

  return prompt;
}

async function resolveAI(body: Record<string, unknown>) {
  const resolvedProvider =
    (body.provider as AIProvider | undefined) || (await getDefaultResearchProvider());
  return getAIProviderWithConfig(resolvedProvider);
}

async function generateEmailResult(body: Record<string, unknown>) {
  const ai = await resolveAI(body);
  const prompt = buildPrompt(body);
  const result = await ai.generateEmail({ prompt });
  return normalizeGeneratedEmail(result);
}

function streamTextValue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  type: "subject" | "body",
  value: string
) {
  const chunkSize = type === "subject" ? 12 : 28;
  let cursor = 0;

  return new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const nextValue = value.slice(cursor, cursor + chunkSize);
      if (!nextValue) {
        clearInterval(timer);
        resolve();
        return;
      }

      controller.enqueue(encoder.encode(createJsonLine({ type, value: nextValue })));
      cursor += chunkSize;
    }, 35);
  });
}

function createStreamResponse(emailPromise: Promise<GeneratedEmail>) {
  const encoder = new TextEncoder();
  const statusMessages = ["正在理解要求", "正在组织主题", "正在打磨正文"];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let statusIndex = 0;
      controller.enqueue(encoder.encode(createJsonLine({ type: "status", message: "已连接 AI，开始生成" })));

      const heartbeat = setInterval(() => {
        controller.enqueue(
          encoder.encode(
            createJsonLine({
              type: "status",
              message: statusMessages[statusIndex % statusMessages.length],
            })
          )
        );
        statusIndex += 1;
      }, 900);

      try {
        const result = await emailPromise;
        clearInterval(heartbeat);
        controller.enqueue(encoder.encode(createJsonLine({ type: "status", message: "正在输出结果" })));
        await streamTextValue(controller, encoder, "subject", result.subject || "");
        await streamTextValue(controller, encoder, "body", result.body || "");
        controller.enqueue(encoder.encode(createJsonLine({ type: "done" })));
        controller.close();
      } catch (error) {
        clearInterval(heartbeat);
        controller.enqueue(
          encoder.encode(
            createJsonLine({
              type: "error",
              message: error instanceof Error ? error.message : "AI 生成失败",
            })
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireTenant();
    const body = await request.json();
    if (body.stream) {
      return createStreamResponse(generateEmailResult(body));
    }

    const result = await generateEmailResult(body);
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
