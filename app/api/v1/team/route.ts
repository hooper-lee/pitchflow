import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { getTeamMembers, inviteTeamMember } from "@/lib/services/tenant.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const { tenantId } = await requireTenant();
    const members = await getTeamMembers(tenantId);
    return apiResponse(members);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { email, role } = await request.json();
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }
    const member = await inviteTeamMember(tenantId, email, role);
    return apiResponse(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
