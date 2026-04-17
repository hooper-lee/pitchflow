import { requireTenant } from "@/lib/auth";
import { getTenantPlan } from "@/lib/services/quota.service";
import { PLAN_LIMITS } from "@/lib/constants/plans";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const plan = await getTenantPlan(tenantId);
    return apiResponse({ plan, limits: PLAN_LIMITS[plan] });
  } catch (error) {
    return handleApiError(error);
  }
}
