import type { AgentRunResult } from "@/lib/agent/types";

export function buildAgentDisabledResult(): AgentRunResult {
  return {
    conversationId: "",
    runId: "",
    status: "failed",
    intent: "agent_disabled",
    reply:
      "这个团队还没有启用 Hemera Agent。请团队管理员先启用数字员工，启用后成员就可以在这里继续对话和查询任务。",
    toolCalls: [],
    cards: [
      {
        kind: "status",
        title: "Hemera Agent",
        status: "未启用",
        detail: "team_admin 可以在设置里的「数字员工」页面启用团队 Agent。",
      },
    ],
  };
}
