import { NextRequest } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { decideApproval } from "@/lib/agent/approvals";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const approvalDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireTenant();
    const body = approvalDecisionSchema.parse(await request.json());
    const approval = await decideApproval(params.id, user.id, body.status);
    if (!approval) return apiError("Approval not found", 404);
    return apiResponse(approval);
  } catch (error) {
    return handleApiError(error);
  }
}
