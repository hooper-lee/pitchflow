import { NextRequest } from "next/server";
import { handleFeishuChannelWebhook } from "@/lib/agent/feishu-webhook-handler";

export async function POST(request: NextRequest) {
  return handleFeishuChannelWebhook(request);
}
