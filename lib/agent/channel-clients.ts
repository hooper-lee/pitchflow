type FeishuTokenResponse = {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
};

type WeComTokenResponse = {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
};

let feishuTokenCache: { token: string; expiresAt: number } | null = null;
let wecomTokenCache: { token: string; expiresAt: number } | null = null;

function isTokenValid(cache: { token: string; expiresAt: number } | null) {
  return Boolean(cache && cache.expiresAt > Date.now() + 60_000);
}

async function fetchJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Channel request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function getFeishuTenantAccessToken() {
  if (isTokenValid(feishuTokenCache)) return feishuTokenCache!.token;
  const appId = await getRuntimeConfig("FEISHU_APP_ID");
  const appSecret = await getRuntimeConfig("FEISHU_APP_SECRET");
  if (!appId || !appSecret) throw new Error("FEISHU_APP_ID/FEISHU_APP_SECRET is not configured");

  const tokenResponse = await fetchJson<FeishuTokenResponse>(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );
  if (!tokenResponse.tenant_access_token) throw new Error(tokenResponse.msg || "Feishu token failed");
  feishuTokenCache = {
    token: tokenResponse.tenant_access_token,
    expiresAt: Date.now() + (tokenResponse.expire || 3600) * 1000,
  };
  return feishuTokenCache.token;
}

async function getWeComAccessToken() {
  if (isTokenValid(wecomTokenCache)) return wecomTokenCache!.token;
  const corpId = await getRuntimeConfig("WECOM_CORP_ID");
  const corpSecret = await getRuntimeConfig("WECOM_APP_SECRET");
  if (!corpId || !corpSecret) throw new Error("WECOM_CORP_ID/WECOM_APP_SECRET is not configured");

  const tokenResponse = await fetchJson<WeComTokenResponse>(
    `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpId}&corpsecret=${corpSecret}`,
    { method: "GET" }
  );
  if (!tokenResponse.access_token) throw new Error(tokenResponse.errmsg || "WeCom token failed");
  wecomTokenCache = {
    token: tokenResponse.access_token,
    expiresAt: Date.now() + (tokenResponse.expires_in || 7200) * 1000,
  };
  return wecomTokenCache.token;
}

export async function sendFeishuPrivateReply(openId: string, text: string) {
  const token = await getFeishuTenantAccessToken();
  await fetchJson("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  });
}

export async function sendWeComPrivateReply(userId: string, text: string) {
  const token = await getWeComAccessToken();
  const agentId = await getRuntimeConfig("WECOM_AGENT_ID");
  if (!agentId) throw new Error("WECOM_AGENT_ID is not configured");

  await fetchJson(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      touser: userId,
      msgtype: "text",
      agentid: Number(agentId),
      text: { content: text },
      safe: 0,
    }),
  });
}

async function getRuntimeConfig(key: string) {
  return process.env[key] || await getConfig(key);
}
import { getConfig } from "@/lib/services/config.service";
