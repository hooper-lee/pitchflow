import crypto from "crypto";
import { runAgent } from "@/lib/agent/runtime";
import { sendFeishuPrivateReply, sendWeComPrivateReply } from "@/lib/agent/channel-clients";
import { getConfig } from "@/lib/services/config.service";
import {
  bindExternalAgentUser,
  findAgentChannelBinding,
  getBindingUser,
} from "@/lib/agent/channel-bindings";
import { normalizeAgentPlan, normalizeAgentRole } from "@/lib/agent/permissions";
import { getTenant } from "@/lib/services/tenant.service";
import type { AgentChannel } from "@/lib/agent/types";

type ChannelName = "feishu" | "wecom";
type StandardChannelMessage = {
  externalUserId: string;
  externalOpenId?: string;
  externalChatId?: string;
  text: string;
  isGroupChat: boolean;
  rawEvent: Record<string, unknown>;
};

async function getWebhookSecret(channel: ChannelName) {
  const key = channel === "feishu" ? "FEISHU_WEBHOOK_SECRET" : "WECOM_WEBHOOK_SECRET";
  return process.env[key] || await getConfig(key);
}

export async function verifyChannelWebhookSignature(
  channel: ChannelName,
  rawBody: string,
  headers: Headers,
  requestUrl?: URL
) {
  if (channel === "feishu") return verifyFeishuSignature(rawBody, headers);
  return verifyWeComSignature(rawBody, headers, requestUrl);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

async function verifyFeishuSignature(rawBody: string, headers: Headers) {
  const secret = await getWebhookSecret("feishu");
  if (!secret) return false;
  const timestamp = headers.get("x-lark-request-timestamp") || "";
  const nonce = headers.get("x-lark-request-nonce") || "";
  const signature = headers.get("x-lark-signature") || headers.get("x-hemera-signature") || "";
  const base = `${timestamp}${nonce}${secret}${rawBody}`;
  const expectedHex = crypto.createHash("sha256").update(base).digest("hex");
  const expectedBase64 = crypto.createHash("sha256").update(base).digest("base64");
  return safeEqual(signature, expectedHex) || safeEqual(signature, expectedBase64);
}

async function verifyWeComSignature(rawBody: string, headers: Headers, requestUrl?: URL) {
  const token = await getWebhookSecret("wecom");
  if (!token) return false;
  const timestamp = requestUrl?.searchParams.get("timestamp") || headers.get("x-wecom-timestamp") || "";
  const nonce = requestUrl?.searchParams.get("nonce") || headers.get("x-wecom-nonce") || "";
  const signature = requestUrl?.searchParams.get("msg_signature") || headers.get("x-wecom-signature") || "";
  const expected = crypto.createHash("sha1").update([token, timestamp, nonce, rawBody].sort().join("")).digest("hex");
  return safeEqual(signature, expected);
}

export function readFeishuChannelMessage(body: Record<string, unknown>): StandardChannelMessage {
  const event = (body.event || {}) as Record<string, unknown>;
  const sender = (event.sender || {}) as Record<string, unknown>;
  const senderId = (sender.sender_id || {}) as Record<string, unknown>;
  const message = (event.message || {}) as Record<string, unknown>;
  const content = parseMessageContent(String(message.content || "{}"));
  const chatType = String(message.chat_type || "");

  return {
    externalUserId: String(senderId.user_id || senderId.open_id || ""),
    externalOpenId: String(senderId.open_id || ""),
    externalChatId: String(message.chat_id || ""),
    text: String(content.text || "").trim(),
    isGroupChat: chatType !== "p2p",
    rawEvent: event,
  };
}

export function readWeComChannelMessage(rawBody: string): StandardChannelMessage {
  const parsedBody: Record<string, unknown> = rawBody.trim().startsWith("{")
    ? JSON.parse(rawBody || "{}") as Record<string, unknown>
    : parseWeComXml(rawBody);

  return {
    externalUserId: String(parsedBody.FromUserName || parsedBody.externalUserId || ""),
    externalChatId: String(parsedBody.ChatId || parsedBody.chatid || ""),
    text: String(parsedBody.Content || parsedBody.text || "").trim(),
    isGroupChat: Boolean(parsedBody.ChatId || parsedBody.chatid),
    rawEvent: parsedBody,
  };
}

function parseMessageContent(content: string) {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { text: content };
  }
}

function parseWeComXml(xml: string) {
  const readTag = (tag: string) => xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))?.[1] ||
    xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];
  return {
    FromUserName: readTag("FromUserName"),
    Content: readTag("Content"),
    ChatId: readTag("ChatId"),
    MsgType: readTag("MsgType"),
  };
}

export async function handleChannelAgentMessage(
  channel: AgentChannel,
  channelMessage: StandardChannelMessage
) {
  const { externalUserId, externalOpenId, text, metadata } = {
    ...channelMessage,
    metadata: { externalChatId: channelMessage.externalChatId, rawEvent: channelMessage.rawEvent },
  };
  if (channelMessage.isGroupChat) return "群聊当前只支持通知，不允许执行 Agent 操作。请私聊 Hemera Agent。";

  const bindingCode = text.match(/bind\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/i)?.[1];
  if (bindingCode && (channel === "feishu" || channel === "wecom")) {
    await bindExternalAgentUser({ code: bindingCode, externalUserId, externalOpenId, channel, metadata });
    return "绑定成功。之后可以直接私聊 Hemera Agent 查询任务状态。";
  }

  const binding = await findAgentChannelBinding(channel, externalUserId);
  if (!binding?.userId) return "请先在站内生成绑定码，然后私聊发送：bind 绑定码";

  const user = await getBindingUser(binding.userId);
  if (!user?.tenantId) return "绑定账号不存在或缺少团队上下文。";

  const tenant = await getTenant(user.tenantId);
  const result = await runAgent({
    tenantId: user.tenantId,
    userId: user.id,
    userRole: normalizeAgentRole(user.role),
    tenantPlan: normalizeAgentPlan(tenant?.plan),
    channel,
    message: text,
  });

  return result.reply;
}

export async function sendChannelReply(channel: ChannelName, message: StandardChannelMessage, text: string) {
  if (channel === "feishu" && message.externalOpenId) {
    await sendFeishuPrivateReply(message.externalOpenId, text);
    return;
  }
  if (channel === "wecom" && message.externalUserId) {
    await sendWeComPrivateReply(message.externalUserId, text);
  }
}
