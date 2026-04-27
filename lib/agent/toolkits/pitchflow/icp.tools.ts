import { z } from "zod";
import { listIcpProfiles } from "@/lib/services/icp-profile.service";
import { truncateText } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

async function listIcpProfilesTool(context: Parameters<AgentTool["execute"]>[0]) {
  const profiles = await listIcpProfiles(context.tenantId);
  const defaultProfile = profiles.find((profile) => profile.isDefault);

  return {
    profiles: profiles.slice(0, 10).map((profile) => ({
      id: profile.id,
      name: profile.name,
      industry: profile.industry,
      isDefault: profile.isDefault,
      targetCustomerText: truncateText(profile.targetCustomerText, 140),
      minScoreToSave: profile.minScoreToSave,
      minScoreToReview: profile.minScoreToReview,
    })),
    summary:
      profiles.length > 0
        ? `当前有 ${profiles.length} 个 ICP 画像，默认画像是 ${defaultProfile?.name || profiles[0]?.name}。`
        : "当前还没有 ICP 画像，建议先用自然语言创建目标客户画像。",
  };
}

export const icpTools: AgentTool[] = [
  {
    name: "pitchflow.icp.list",
    toolkit: "pitchflow.icp",
    description: "列出租户 ICP 画像并总结默认画像。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: z.object({}),
    execute: listIcpProfilesTool,
  },
];
