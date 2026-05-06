import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import {
  getAgentChannelConfig,
  toSafeChannelConfig,
  upsertAgentChannelConfig,
} from "@/lib/agent/channel-configs";
import { canManageAgent } from "@/lib/agent/policies/role-policy";
import { normalizeAgentRole } from "@/lib/agent/permissions";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";

const channelConfigSchema = z.object({
  channel: z.enum(["feishu", "wecom"]),
  name: z.string().max(255).optional(),
  appId: z.string().max(255).optional(),
  appSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  isEnabled: z.boolean().default(false),
});

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(request.url).origin;
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenant();
    const feishuConfig = await getAgentChannelConfig(tenantId, "feishu");
    return apiResponse({
      feishu: toSafeChannelConfig(feishuConfig, getBaseUrl(request)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, tenantId } = await requireTenant();
    if (!canManageAgent(normalizeAgentRole(user.role))) {
      return apiError("Only team admins can manage Agent channels", 403);
    }

    const body = channelConfigSchema.parse(await request.json());
    const config = await upsertAgentChannelConfig(tenantId, body.channel, body);
    return apiResponse({ config: toSafeChannelConfig(config, getBaseUrl(request)) });
  } catch (error) {
    return handleApiError(error);
  }
}
