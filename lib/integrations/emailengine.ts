import { getConfig } from "@/lib/services/config.service";

interface EmailEngineConfig {
  baseUrl: string;
  accessToken: string;
  webhookUrl: string;
}

interface EmailEngineMailboxAuth {
  user: string;
  pass: string;
}

interface EmailEngineImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: EmailEngineMailboxAuth;
}

interface EmailEngineSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: EmailEngineMailboxAuth;
}

export interface EmailEngineAccountInput {
  account: string;
  name: string;
  email: string;
  imap: EmailEngineImapConfig;
  smtp: EmailEngineSmtpConfig;
}

export interface EmailEngineSubmitInput {
  from?: { address: string; name?: string | null };
  to: Array<{ address: string; name?: string | null }>;
  subject: string;
  text: string;
  html: string;
  messageId: string;
  headers?: Record<string, string>;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

interface EmailEngineSubmitResponse {
  response?: string;
  messageId?: string;
  queueId?: string;
}

interface EmailEngineAccountResponse {
  account: string;
  email?: string;
  name?: string;
  state?: string;
  lastError?: string | null;
  syncTime?: number;
}

export async function registerEmailEngineAccount(input: EmailEngineAccountInput) {
  await ensureEmailEngineWebhookSettings();
  return emailEngineRequest<EmailEngineAccountResponse>("/v1/account", {
    method: "POST",
    body: input,
  });
}

export async function deleteEmailEngineAccount(accountKey: string) {
  return emailEngineRequest(`/v1/account/${encodeURIComponent(accountKey)}`, {
    method: "DELETE",
  });
}

export async function getEmailEngineAccount(accountKey: string) {
  return emailEngineRequest<EmailEngineAccountResponse>(
    `/v1/account/${encodeURIComponent(accountKey)}`
  );
}

export async function reconnectEmailEngineAccount(accountKey: string) {
  return emailEngineRequest(`/v1/account/${encodeURIComponent(accountKey)}/reconnect`, {
    method: "PUT",
    body: {},
  });
}

export async function submitEmailEngineMessage(
  accountKey: string,
  input: EmailEngineSubmitInput
) {
  await ensureEmailEngineWebhookSettings();
  return emailEngineRequest<EmailEngineSubmitResponse>(
    `/v1/account/${encodeURIComponent(accountKey)}/submit`,
    {
      method: "POST",
      body: input,
    }
  );
}

export async function getEmailEngineMessage(accountKey: string, messageId: string) {
  return emailEngineRequest<{
    id: string;
    messageId?: string;
    threadId?: string;
    subject?: string;
    from?: { name?: string; address?: string };
    text?: { plain?: string; html?: string };
    inReplyTo?: string;
    references?: string[];
  }>(
    `/v1/account/${encodeURIComponent(accountKey)}/message/${encodeURIComponent(messageId)}?textType=*`
  );
}

async function ensureEmailEngineWebhookSettings() {
  const config = await getEmailEngineConfig();
  await emailEngineRequest("/v1/settings", {
    method: "POST",
    body: {
      webhooks: config.webhookUrl,
      webhooksEnabled: true,
      webhookEvents: [
        "messageNew",
        "messageSent",
        "messageFailed",
        "messageBounce",
        "trackOpen",
        "trackClick",
      ],
      notifyHeaders: ["In-Reply-To", "References", "Message-ID", "Auto-Submitted"],
      notifyText: true,
      trackOpens: true,
      trackClicks: true,
    },
  });
}

async function emailEngineRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
) {
  const config = await getEmailEngineConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailEngine error: ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

async function getEmailEngineConfig(): Promise<EmailEngineConfig> {
  const baseUrl =
    (await getConfig("EMAILENGINE_URL")) ||
    process.env.EMAILENGINE_URL ||
    "";
  const accessToken =
    (await getConfig("EMAILENGINE_ACCESS_TOKEN")) ||
    process.env.EMAILENGINE_ACCESS_TOKEN ||
    "";
  const webhookBaseUrl =
    process.env.EMAILENGINE_WEBHOOK_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_BASE_URL ||
    "";

  if (!baseUrl || !accessToken || !webhookBaseUrl) {
    throw new Error("EmailEngine not configured");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    accessToken,
    webhookUrl: `${webhookBaseUrl.replace(/\/$/, "")}/api/webhooks/emailengine`,
  };
}
