import { NextRequest, NextResponse } from "next/server";
import {
  handleChannelAgentMessage,
  readWeComChannelMessage,
  sendChannelReply,
  verifyChannelWebhookSignature,
} from "@/lib/agent/channel-webhook";

export async function GET(request: NextRequest) {
  const echo = request.nextUrl.searchParams.get("echostr");
  const isValid = await verifyChannelWebhookSignature("wecom", echo || "", request.headers, request.nextUrl);
  if (!isValid) return NextResponse.json({ error: "Invalid WeCom signature" }, { status: 403 });
  return new NextResponse(echo || "ok");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await verifyChannelWebhookSignature("wecom", rawBody, request.headers, request.nextUrl))) {
    return NextResponse.json({ error: "Invalid WeCom signature" }, { status: 403 });
  }

  const channelMessage = readWeComChannelMessage(rawBody);
  if (!channelMessage.externalUserId || !channelMessage.text) {
    return NextResponse.json({ error: "Invalid WeCom message" }, { status: 400 });
  }

  const reply = await handleChannelAgentMessage("wecom", channelMessage);
  await sendChannelReply("wecom", channelMessage, reply).catch((error) => {
    console.error("WeCom reply failed:", error);
  });

  return NextResponse.json({ reply });
}
