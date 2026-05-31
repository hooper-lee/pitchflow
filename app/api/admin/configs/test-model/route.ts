import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

interface TestModelRequest {
  /** 如果传入了这些配置则优先使用，否则从 DB 读取 */
  baseURL?: string;
  apiKey?: string;
  model?: string;
  /** 显式指定 provider: "custom" | "claude" | "openai" */
  provider?: string;
}

async function getConfig(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .limit(1);
  return row?.value || null;
}

/**
 * 测试模型连接：发送一个简单的 chat completion 请求，验证配置是否可用
 */
export async function POST(request: NextRequest) {
  try {
    const body: TestModelRequest = await request.json().catch(() => ({}));
    const { baseURL, apiKey, model, provider } = body;

    // 确定使用的 provider
    const resolvedProvider = provider || await resolveProvider(baseURL, apiKey);

    if (resolvedProvider === "claude") {
      return await testClaude(apiKey, model);
    }

    if (resolvedProvider === "openai") {
      return await testOpenAI(apiKey, model);
    }

    // custom (OpenAI-compatible)
    return await testCustom(baseURL, apiKey, model);
  } catch (error) {
    return handleApiError(error);
  }
}

async function resolveProvider(
  baseURL?: string | null,
  apiKey?: string | null
): Promise<string> {
  const url = baseURL || (await getConfig("CUSTOM_AI_BASE_URL"));
  const key = apiKey || (await getConfig("CUSTOM_AI_API_KEY"));
  if (url && key) {
    return "custom";
  }

  // Check for env-based providers
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";

  // If custom has partial config, return custom to surface the missing field error
  if (url || key) return "custom";

  return "claude";
}

async function testCustom(
  baseURL?: string | null,
  apiKey?: string | null,
  model?: string | null
) {
  const url = baseURL || (await getConfig("CUSTOM_AI_BASE_URL"));
  const key = apiKey || (await getConfig("CUSTOM_AI_API_KEY"));
  const modelName = model || (await getConfig("CUSTOM_AI_MODEL")) || "gpt-4o";

  if (!url) {
    return apiError("API Base URL 未配置", 400);
  }
  if (!key) {
    return apiError("API Key 未配置", 400);
  }

  const client = new OpenAI({ baseURL: url, apiKey: key });
  const startTime = Date.now();

  const completion = await client.chat.completions.create({
    model: modelName,
    max_tokens: 50,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, respond with just 'ok'." },
    ],
  });

  const latency = Date.now() - startTime;
  const content = completion.choices[0]?.message?.content || "";

  return apiResponse({
    success: true,
    provider: "custom",
    model: modelName,
    latency,
    response: content.slice(0, 100),
  });
}

async function testClaude(apiKey?: string | null, model?: string | null) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return apiError("ANTHROPIC_API_KEY 未配置（Claude 依赖环境变量）", 400);
  }

  const modelName = model || "claude-sonnet-4-20250514";
  const client = new Anthropic({ apiKey: key });
  const startTime = Date.now();

  const message = await client.messages.create({
    model: modelName,
    max_tokens: 50,
    messages: [{ role: "user", content: "Hello, respond with just 'ok'." }],
  });

  const latency = Date.now() - startTime;
  const content = message.content[0].type === "text" ? message.content[0].text : "";

  return apiResponse({
    success: true,
    provider: "claude",
    model: modelName,
    latency,
    response: content.slice(0, 100),
  });
}

async function testOpenAI(apiKey?: string | null, model?: string | null) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    return apiError("OPENAI_API_KEY 未配置（OpenAI 依赖环境变量）", 400);
  }

  const modelName = model || "gpt-4o";
  const client = new OpenAI({ apiKey: key });
  const startTime = Date.now();

  const completion = await client.chat.completions.create({
    model: modelName,
    max_tokens: 50,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, respond with just 'ok'." },
    ],
  });

  const latency = Date.now() - startTime;
  const content = completion.choices[0]?.message?.content || "";

  return apiResponse({
    success: true,
    provider: "openai",
    model: modelName,
    latency,
    response: content.slice(0, 100),
  });
}
