import { NextRequest, NextResponse } from "next/server";
import { getAgentChannelConfigById, isFeishuChannelReady } from "@/lib/agent/channel-configs";
import { handleFeishuChannelWebhook } from "@/lib/agent/feishu-webhook-handler";

type RouteContext = {
  params: { configId: string };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const config = await getAgentChannelConfigById(context.params.configId, "feishu");
  if (!config?.isEnabled || !isFeishuChannelReady(config)) {
    return NextResponse.json({ error: "Feishu channel is not configured" }, { status: 404 });
  }

  return handleFeishuChannelWebhook(request, config);
}
