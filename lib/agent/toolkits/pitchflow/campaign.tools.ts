import { z } from "zod";
import { getCampaignStats } from "@/lib/services/analytics.service";
import {
  getCampaign,
  getCampaignProspectCount,
  listCampaigns,
} from "@/lib/services/campaign.service";
import { formatPercent } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

const campaignListSchema = z.object({
  limit: z.number().int().min(1).max(10).default(5),
});

const campaignSummarySchema = z.object({
  campaignId: z.string().uuid(),
});

async function listCampaignsTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = campaignListSchema.parse(rawInput);
  const result = await listCampaigns(context.tenantId, 1, input.limit);

  return {
    campaigns: result.items.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      campaignType: campaign.campaignType,
      totalProspects: campaign.totalProspects,
      sentCount: campaign.sentCount,
      repliedCount: campaign.repliedCount,
    })),
    summary:
      result.total > 0
        ? `当前有 ${result.total} 个活动，最近 ${result.items.length} 个已列出。`
        : "当前还没有活动。",
  };
}

async function summarizeCampaignTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = campaignSummarySchema.parse(rawInput);
  const campaign = await getCampaign(input.campaignId, context.tenantId);
  if (!campaign) return { summary: "没有找到该活动。" };

  const [stats, prospectCount] = await Promise.all([
    getCampaignStats(campaign.id),
    getCampaignProspectCount(campaign.id),
  ]);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      campaignType: campaign.campaignType,
      prospectCount,
      stats,
    },
    summary: `${campaign.name}：目标客户 ${prospectCount} 个，已发送 ${stats.sent} 封，回复 ${stats.replied} 封，回复率 ${formatPercent(stats.replied, stats.sent)}。`,
  };
}

export const campaignTools: AgentTool[] = [
  {
    name: "pitchflow.campaign.list",
    toolkit: "pitchflow.campaign",
    description: "查看活动列表。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: campaignListSchema,
    execute: listCampaignsTool,
  },
  {
    name: "pitchflow.campaign.summarize",
    toolkit: "pitchflow.campaign",
    description: "总结某个活动的表现。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: campaignSummarySchema,
    execute: summarizeCampaignTool,
  },
];
