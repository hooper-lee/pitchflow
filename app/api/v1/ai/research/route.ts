import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { researchProspect } from "@/lib/services/research.service";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireTenant();
    const { prospectId, aiProvider } = await request.json();

    if (!prospectId) {
      return Response.json({ error: "prospectId is required" }, { status: 400 });
    }

    const summary = await researchProspect(
      prospectId,
      tenantId,
      aiProvider || "claude"
    );

    return apiResponse({ summary });
  } catch (error) {
    return handleApiError(error);
  }
}
