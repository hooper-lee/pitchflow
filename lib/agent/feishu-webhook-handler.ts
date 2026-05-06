import { NextRequest, NextResponse } from "next/server";
import type { AgentChannelRuntimeConfig } from "@/lib/agent/channel-configs";
import {
  handleChannelAgentMessage,
  readFeishuChannelMessage,
  sendChannelReply,
  verifyChannelWebhookSignature,
} from "@/lib/agent/channel-webhook";

export async function handleFeishuChannelWebhook(
  request: NextRequest,
  channelConfig?: AgentChannelRuntimeConfig | null
) {
  const rawBody = await request.text();
  const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  console.info("Feishu webhook received", {
    type: body.type,
    hasEvent: Boolean(body.event),
  });
  if (body?.type === "url_verification" && body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }
  if (!(await verifyChannelWebhookSignature("feishu", rawBody, request.headers, undefined, channelConfig))) {
    return NextResponse.json({ error: "Invalid Feishu signature" }, { status: 403 });
  }

  const channelMessage = readFeishuChannelMessage(body);
  if (!channelMessage.externalUserId || !channelMessage.text) {
    return NextResponse.json({ error: "Invalid Feishu message" }, { status: 400 });
  }

  const reply = await handleChannelAgentMessage("feishu", channelMessage);
  await sendChannelReply("feishu", channelMessage, reply, channelConfig).catch((error) => {
    console.error("Feishu reply failed:", error);
  });

  return NextResponse.json({ reply });
}
