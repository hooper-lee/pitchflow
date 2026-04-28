import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { createChannelBindingCode } from "@/lib/agent/channel-bindings";
import { canManageAgent } from "@/lib/agent/policies/role-policy";
import { normalizeAgentRole } from "@/lib/agent/permissions";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const bindingCodeSchema = z.object({
  channel: z.enum(["feishu", "wecom"]),
});

export async function POST(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const userRole = normalizeAgentRole(user.role);
    if (!canManageAgent(userRole)) return apiError("Only team admins can create binding codes", 403);

    const body = bindingCodeSchema.parse(await request.json());
    const bindingCode = createChannelBindingCode({
      tenantId,
      userId: user.id,
      channel: body.channel,
    });

    return apiResponse({ bindingCode, expiresInSeconds: 900 });
  } catch (error) {
    return handleApiError(error);
  }
}
