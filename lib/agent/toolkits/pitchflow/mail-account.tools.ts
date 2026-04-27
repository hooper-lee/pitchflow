import { z } from "zod";
import { listMailAccounts } from "@/lib/services/mail-account.service";
import type { AgentTool } from "@/lib/agent/types";

async function listMailAccountsTool(context: Parameters<AgentTool["execute"]>[0]) {
  const accounts = await listMailAccounts(context.tenantId, context.userId);
  const connectedAccounts = accounts.filter((account) => account.state === "connected");
  const defaultAccount = accounts.find((account) => account.isDefault);

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      state: account.state,
      isDefault: account.isDefault,
      lastError: account.lastError,
    })),
    summary:
      connectedAccounts.length > 0
        ? `当前有 ${connectedAccounts.length} 个已连接邮箱，默认发件邮箱为 ${defaultAccount?.email || connectedAccounts[0]?.email}。`
        : "当前没有已连接邮箱，活动邮件发送和消息追踪会受影响。",
  };
}

export const mailAccountTools: AgentTool[] = [
  {
    name: "pitchflow.mail_account.list",
    toolkit: "pitchflow.mail_account",
    description: "查看当前用户已连接的邮箱状态。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: z.object({}),
    execute: listMailAccountsTool,
  },
];
