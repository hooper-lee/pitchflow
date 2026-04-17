import { requireTenant } from "@/lib/auth";
import { getDashboardStats } from "@/lib/services/analytics.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const stats = await getDashboardStats(tenantId);
    return apiResponse(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
