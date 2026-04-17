import { requireTenant } from "@/lib/auth";
import { revokeApiKey } from "@/lib/services/api-key.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireTenant();
    const key = await revokeApiKey(params.id, tenantId);
    return apiResponse(key);
  } catch (error) {
    return handleApiError(error);
  }
}
