import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentChannelConfigs } from "@/lib/db/schema";

export type AgentChannelRuntimeConfig = {
  appId?: string | null;
  appSecret?: string | null;
  webhookSecret?: string | null;
};

export type UpsertAgentChannelConfigInput = AgentChannelRuntimeConfig & {
  name?: string | null;
  isEnabled?: boolean;
};

function normalizeOptionalText(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function maskSecret(value?: string | null) {
  if (!value) return "";
  return value.length <= 6 ? "******" : `${value.slice(0, 3)}******${value.slice(-3)}`;
}

export function buildFeishuWebhookUrl(baseUrl: string, configId: string) {
  return `${baseUrl.replace(/\/$/, "")}/api/channels/feishu/${configId}`;
}

export function toSafeChannelConfig(
  config: typeof agentChannelConfigs.$inferSelect | null,
  baseUrl: string
) {
  if (!config) return null;
  return {
    id: config.id,
    channel: config.channel,
    name: config.name || "",
    appId: config.appId || "",
    appSecretMasked: maskSecret(config.appSecret),
    webhookSecretMasked: maskSecret(config.webhookSecret),
    isEnabled: config.isEnabled,
    webhookUrl: config.channel === "feishu" ? buildFeishuWebhookUrl(baseUrl, config.id) : "",
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function getAgentChannelConfig(tenantId: string, channel: "feishu" | "wecom") {
  const [config] = await db
    .select()
    .from(agentChannelConfigs)
    .where(and(eq(agentChannelConfigs.tenantId, tenantId), eq(agentChannelConfigs.channel, channel)))
    .limit(1);

  return config || null;
}

export async function getAgentChannelConfigById(configId: string, channel: "feishu" | "wecom") {
  const [config] = await db
    .select()
    .from(agentChannelConfigs)
    .where(and(eq(agentChannelConfigs.id, configId), eq(agentChannelConfigs.channel, channel)))
    .limit(1);

  return config || null;
}

export async function listEnabledFeishuChannelConfigs() {
  const configs = await db
    .select()
    .from(agentChannelConfigs)
    .where(and(eq(agentChannelConfigs.channel, "feishu"), eq(agentChannelConfigs.isEnabled, true)));

  return configs.filter(isFeishuChannelReady);
}

export async function upsertAgentChannelConfig(
  tenantId: string,
  channel: "feishu" | "wecom",
  input: UpsertAgentChannelConfigInput
) {
  const existingConfig = await getAgentChannelConfig(tenantId, channel);
  const nextValues = {
    name: normalizeOptionalText(input.name) || existingConfig?.name || null,
    appId: normalizeOptionalText(input.appId) || existingConfig?.appId || null,
    appSecret: normalizeOptionalText(input.appSecret) || existingConfig?.appSecret || null,
    webhookSecret: normalizeOptionalText(input.webhookSecret) || existingConfig?.webhookSecret || null,
    isEnabled: Boolean(input.isEnabled),
    updatedAt: new Date(),
  };

  if (existingConfig) {
    const [updatedConfig] = await db
      .update(agentChannelConfigs)
      .set(nextValues)
      .where(eq(agentChannelConfigs.id, existingConfig.id))
      .returning();
    return updatedConfig;
  }

  const [createdConfig] = await db
    .insert(agentChannelConfigs)
    .values({ tenantId, channel, ...nextValues })
    .returning();
  return createdConfig;
}

export function isFeishuChannelReady(config: AgentChannelRuntimeConfig | null) {
  return Boolean(config?.appId && config.appSecret);
}
