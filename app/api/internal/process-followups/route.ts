import { NextRequest } from "next/server";
import { processPendingFollowups } from "@/lib/services/followup.service";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (
      cronSecret &&
      authHeader !== `Bearer ${cronSecret}`
    ) {
      return apiError("Unauthorized", 401);
    }

    const result = await processPendingFollowups();
    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// Also support GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request);
}
