import { NextRequest, NextResponse } from "next/server";
import {
  handleChannelAgentMessage,
  readFeishuChannelMessage,
  sendChannelReply,
  verifyChannelWebhookSignature,
} from "@/lib/agent/channel-webhook";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  if (body?.type === "url_verification" && body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }
  if (!(await verifyChannelWebhookSignature("feishu", rawBody, request.headers))) {
    return NextResponse.json({ error: "Invalid Feishu signature" }, { status: 403 });
  }

  const channelMessage = readFeishuChannelMessage(body);
  if (!channelMessage.externalUserId || !channelMessage.text) {
    return NextResponse.json({ error: "Invalid Feishu message" }, { status: 400 });
  }

  const reply = await handleChannelAgentMessage("feishu", channelMessage);
  await sendChannelReply("feishu", channelMessage, reply).catch((error) => {
    console.error("Feishu reply failed:", error);
  });

  return NextResponse.json({ reply });
}
