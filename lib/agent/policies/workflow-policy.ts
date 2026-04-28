import type { AgentWorkflowGoal } from "@/lib/agent/types";
import type { AgentPlanPolicy } from "@/lib/agent/policies/plan-policy";

export function authorizeAgentWorkflow(policy: AgentPlanPolicy, goal: string) {
  if (policy.allowedWorkflows.includes(goal as AgentWorkflowGoal)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "当前 Free 套餐只支持对话、配置检查和只读查询。创建资料、画像、挖掘任务或活动草稿需要 Pro 套餐。",
  };
}
