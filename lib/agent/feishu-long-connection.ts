import * as Lark from "@larksuiteoapi/node-sdk";
import {
  listEnabledFeishuChannelConfigs,
  type AgentChannelRuntimeConfig,
} from "@/lib/agent/channel-configs";
import { handleFeishuEventData } from "@/lib/agent/feishu-webhook-handler";

type FeishuLongConnection = {
  client: Lark.WSClient;
  fingerprint: string;
};

const connections = new Map<string, FeishuLongConnection>();
let syncTimer: NodeJS.Timeout | null = null;

export async function startFeishuLongConnectionSync() {
  await syncFeishuLongConnections();
  syncTimer = setInterval(() => {
    syncFeishuLongConnections().catch((error) => {
      console.error("[feishu-ws] sync failed", error);
    });
  }, 60 * 1000);
}

export function stopFeishuLongConnectionSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
  for (const connection of Array.from(connections.values())) {
    connection.client.close({ force: true });
  }
  connections.clear();
}

async function syncFeishuLongConnections() {
  const configs = await listEnabledFeishuChannelConfigs();
  const activeConfigIds = new Set(configs.map((config) => config.id));

  closeStaleConnections(activeConfigIds);
  for (const config of configs) {
    startOrRefreshConnection(config.id, {
      appId: config.appId,
      appSecret: config.appSecret,
      webhookSecret: config.webhookSecret,
    });
  }
}

function closeStaleConnections(activeConfigIds: Set<string>) {
  for (const [configId, connection] of Array.from(connections.entries())) {
    if (!activeConfigIds.has(configId)) {
      connection.client.close({ force: true });
      connections.delete(configId);
    }
  }
}

function startOrRefreshConnection(configId: string, config: AgentChannelRuntimeConfig) {
  const fingerprint = buildConfigFingerprint(config);
  const existingConnection = connections.get(configId);
  if (existingConnection?.fingerprint === fingerprint) return;
  if (existingConnection) existingConnection.client.close({ force: true });

  const client = createFeishuWsClient(configId, config);
  const dispatcher = createFeishuEventDispatcher(config);
  connections.set(configId, { client, fingerprint });
  void client.start({ eventDispatcher: dispatcher }).catch((error) => {
    console.error("[feishu-ws] start failed", { configId, error });
  });
}

function createFeishuWsClient(configId: string, config: AgentChannelRuntimeConfig) {
  return new Lark.WSClient({
    appId: config.appId || "",
    appSecret: config.appSecret || "",
    loggerLevel: Lark.LoggerLevel.info,
    onReady: () => console.log("[feishu-ws] connected", { configId }),
    onReconnecting: () => console.warn("[feishu-ws] reconnecting", { configId }),
    onReconnected: () => console.log("[feishu-ws] reconnected", { configId }),
    onError: (error) => console.error("[feishu-ws] connection error", { configId, error }),
  });
}

function createFeishuEventDispatcher(config: AgentChannelRuntimeConfig) {
  return new Lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (eventData: Record<string, unknown>) => {
      await handleFeishuEventData(eventData, config);
    },
  });
}

function buildConfigFingerprint(config: AgentChannelRuntimeConfig) {
  return [config.appId || "", config.appSecret || ""].join(":");
}
