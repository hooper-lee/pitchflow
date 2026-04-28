import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentChannelBindings, users } from "@/lib/db/schema";
import type { AgentChannel } from "@/lib/agent/types";

type BindingTokenPayload = {
  tenantId: string;
  userId: string;
  channel: "feishu" | "wecom";
  expiresAt: number;
};

function getBindingSecret() {
  const secret =
    process.env.AGENT_BINDING_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("AGENT_BINDING_SECRET is not configured");
  return secret;
}

function encodeBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payloadText: string) {
  return crypto.createHmac("sha256", getBindingSecret()).update(payloadText).digest("base64url");
}

export function createChannelBindingCode(payload: Omit<BindingTokenPayload, "expiresAt">) {
  const tokenPayload = { ...payload, expiresAt: Date.now() + 15 * 60 * 1000 };
  const payloadText = encodeBase64Url(JSON.stringify(tokenPayload));
  return `${payloadText}.${signPayload(payloadText)}`;
}

export function parseChannelBindingCode(code: string): BindingTokenPayload {
  const [payloadText, signature] = code.trim().split(".");
  if (!payloadText || !signature || signature !== signPayload(payloadText)) {
    throw new Error("绑定码无效。");
  }

  const payload = JSON.parse(Buffer.from(payloadText, "base64url").toString("utf8")) as BindingTokenPayload;
  if (payload.expiresAt < Date.now()) throw new Error("绑定码已过期。");
  return payload;
}

export async function bindExternalAgentUser(input: {
  code: string;
  externalUserId: string;
  externalOpenId?: string;
  channel: "feishu" | "wecom";
  metadata?: Record<string, unknown>;
}) {
  const payload = parseChannelBindingCode(input.code);
  if (payload.channel !== input.channel) throw new Error("绑定码渠道不匹配。");

  const [binding] = await db.insert(agentChannelBindings).values({
    tenantId: payload.tenantId,
    userId: payload.userId,
    channel: input.channel,
    externalUserId: input.externalUserId,
    externalOpenId: input.externalOpenId,
    metadata: input.metadata || {},
    isActive: true,
  }).onConflictDoUpdate({
    target: [agentChannelBindings.channel, agentChannelBindings.externalUserId],
    set: {
      tenantId: payload.tenantId,
      userId: payload.userId,
      externalOpenId: input.externalOpenId,
      metadata: input.metadata || {},
      isActive: true,
      updatedAt: new Date(),
    },
  }).returning();

  return binding;
}

export async function findAgentChannelBinding(channel: AgentChannel, externalUserId: string) {
  const [binding] = await db
    .select()
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, channel),
        eq(agentChannelBindings.externalUserId, externalUserId),
        eq(agentChannelBindings.isActive, true)
      )
    )
    .limit(1);

  return binding || null;
}

export async function getBindingUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user || null;
}
