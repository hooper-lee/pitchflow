import type { AgentChannel } from "@/lib/agent/types";
import type { AgentPlanPolicy } from "@/lib/agent/policies/plan-policy";

export function authorizeAgentChannel(policy: AgentPlanPolicy, channel: AgentChannel) {
  if (policy.allowedChannels.includes(channel)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "当前套餐不支持这个 Agent 渠道。飞书/企微入口需要 Business 或更高套餐。",
  };
}
