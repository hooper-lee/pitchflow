import { NextRequest } from "next/server";
import { getAllAiPromptConfigs, setConfig, AI_PROMPT_KEYS, DEFAULT_PROMPTS } from "@/lib/services/config.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

// GET /api/admin/ai-prompts - 获取所有 AI Prompt 配置
export async function GET() {
  try {
    const configs = await getAllAiPromptConfigs();
    return apiResponse(configs);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT /api/admin/ai-prompts - 更新 AI Prompt 配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return apiError("key and value are required", 400);
    }

    // 验证 key 是否有效
    const validKeys = Object.values(AI_PROMPT_KEYS);
    if (!validKeys.includes(key)) {
      return apiError(`Invalid key. Valid keys: ${validKeys.join(", ")}`, 400);
    }

    await setConfig(key, value);
    return apiResponse({ success: true, key });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/admin/ai-prompts/reset - 重置为默认值
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "reset") {
      for (const [key, value] of Object.entries(DEFAULT_PROMPTS)) {
        await setConfig(key, value);
      }
      return apiResponse({ success: true, message: "All prompts reset to defaults" });
    }

    return apiError("Invalid action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}