import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { handleApiError, apiResponse } from "@/lib/utils/api-handler";
import { upsertIcpProfileSchema } from "@/lib/utils/validators";
import { createIcpProfile, listIcpProfiles } from "@/lib/services/icp-profile.service";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const profiles = await listIcpProfiles(tenantId);
    return apiResponse(profiles);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireTenant();
    const input = upsertIcpProfileSchema.parse(await request.json());
    const profile = await createIcpProfile(tenantId, user.id, input);
    return apiResponse(profile, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
