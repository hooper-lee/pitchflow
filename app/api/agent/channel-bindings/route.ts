import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { getAgentChannelConfig, isFeishuChannelReady } from "@/lib/agent/channel-configs";
import { createChannelBindingCode } from "@/lib/agent/channel-bindings";
import { authorizeAgentChannel } from "@/lib/agent/policies/channel-policy";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { normalizeAgentPlan } from "@/lib/agent/permissions";
import { getTenant } from "@/lib/services/tenant.service";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const bindingCodeSchema = z.object({
  channel: z.enum(["feishu", "wecom"]),
});

export async function POST(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = bindingCodeSchema.parse(await request.json());
    const tenant = await getTenant(tenantId);
    const policy = getAgentPlanPolicy(normalizeAgentPlan(tenant?.plan));
    const channelAuthorization = authorizeAgentChannel(policy, body.channel);
    if (!channelAuthorization.allowed) {
      return apiError(channelAuthorization.reason || "当前套餐不支持这个 Agent 渠道。", 403);
    }

    if (body.channel === "wecom") {
      return apiError("WeCom channel is not supported yet. Please use Feishu.", 400);
    }
    if (body.channel === "feishu") {
      const feishuConfig = await getAgentChannelConfig(tenantId, "feishu");
      if (!feishuConfig?.isEnabled || !isFeishuChannelReady(feishuConfig)) {
        return apiError("Feishu channel is not configured", 400);
      }
    }
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
