import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getDashboardStats, getRecentActivity } from "@/lib/services/analytics.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const type = request.nextUrl.searchParams.get("type");

    if (type === "activity") {
      const activity = await getRecentActivity(tenantId);
      return apiResponse(activity);
    }

    const stats = await getDashboardStats(tenantId);
    return apiResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
