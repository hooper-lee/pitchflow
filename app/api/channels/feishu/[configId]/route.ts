import { NextRequest, NextResponse } from "next/server";
import { getAgentChannelConfigById, isFeishuChannelReady } from "@/lib/agent/channel-configs";
import { handleFeishuChannelWebhook } from "@/lib/agent/feishu-webhook-handler";

type RouteContext = {
  params: { configId: string };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const config = await getAgentChannelConfigById(context.params.configId, "feishu");
  if (!config) {
    return NextResponse.json({ error: "Feishu channel is not configured" }, { status: 404 });
  }

  if (await isFeishuUrlVerificationRequest(request)) {
    return handleFeishuChannelWebhook(request, config);
  }

  if (!config.isEnabled || !isFeishuChannelReady(config)) {
    return NextResponse.json({ error: "Feishu channel is not enabled" }, { status: 403 });
  }

  return handleFeishuChannelWebhook(request, config);
}

async function isFeishuUrlVerificationRequest(request: NextRequest) {
  const rawBody = await request.clone().text();
  try {
    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    return body.type === "url_verification" && typeof body.challenge === "string";
  } catch {
    return false;
  }
}
