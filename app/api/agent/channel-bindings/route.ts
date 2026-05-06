import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { getAgentChannelConfig, isFeishuChannelReady } from "@/lib/agent/channel-configs";
import { createChannelBindingCode } from "@/lib/agent/channel-bindings";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const bindingCodeSchema = z.object({
  channel: z.enum(["feishu", "wecom"]),
});

export async function POST(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    const body = bindingCodeSchema.parse(await request.json());
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
