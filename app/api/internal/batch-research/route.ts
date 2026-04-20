import { NextRequest } from "next/server";
import { processBatchResearch } from "@/lib/services/research.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

// POST /api/internal/batch-research - 批量处理调研任务
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json().catch(() => ({}));
    const { limit = 10, status = "new" } = body;

    const result = await processBatchResearch({ limit, status });
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET for Vercel Cron / manual trigger
export async function GET(request: NextRequest) {
  return POST(request);
}