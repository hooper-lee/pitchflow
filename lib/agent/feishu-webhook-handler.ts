import { NextRequest, NextResponse } from "next/server";
import type { AgentChannelRuntimeConfig } from "@/lib/agent/channel-configs";
import {
  handleChannelAgentMessage,
  readFeishuChannelMessage,
  sendChannelReply,
  verifyChannelWebhookSignature,
} from "@/lib/agent/channel-webhook";
import { claimChannelEvent } from "@/lib/agent/channel-event-dedupe";

export async function handleFeishuEventData(
  eventData: Record<string, unknown>,
  channelConfig?: AgentChannelRuntimeConfig | null
) {
  const channelMessage = readFeishuChannelMessage({ event: eventData });
  if (!channelMessage.externalUserId || !channelMessage.text) {
    console.warn("Invalid Feishu event message", {
      hasExternalUserId: Boolean(channelMessage.externalUserId),
      hasText: Boolean(channelMessage.text),
    });
    return;
  }

  const eventId = getFeishuEventId(eventData);
  const claimed = await claimChannelEvent({
    channel: "feishu",
    externalEventId: eventId,
    externalUserId: channelMessage.externalUserId,
    externalChatId: channelMessage.externalChatId,
    metadata: { source: "feishu", eventId },
  });
  if (!claimed) {
    console.info("Duplicate Feishu message skipped", { eventId });
    return;
  }

  const reply = await buildFeishuAgentReply(channelMessage);
  await sendChannelReply("feishu", channelMessage, reply, channelConfig).catch((error) => {
    console.error("Feishu reply failed:", error);
  });
}

function getFeishuEventId(eventData: Record<string, unknown>) {
  const message = (eventData.message || {}) as Record<string, unknown>;
  return String(message.message_id || eventData.event_id || "");
}

async function buildFeishuAgentReply(channelMessage: ReturnType<typeof readFeishuChannelMessage>) {
  try {
    return await handleChannelAgentMessage("feishu", channelMessage);
  } catch (error) {
    console.error("Feishu agent handling failed:", error);
    return error instanceof Error ? error.message : "Agent 暂时不可用，请稍后重试。";
  }
}

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

  const eventData = body.event as Record<string, unknown> | undefined;
  if (!eventData) {
    return NextResponse.json({ error: "Invalid Feishu message" }, { status: 400 });
  }

  await handleFeishuEventData(eventData, channelConfig);

  return NextResponse.json({ ok: true });
}
