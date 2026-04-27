import type { AgentContext, AgentPlan, AgentRole, AgentTool } from "@/lib/agent/types";

const roleRanks: Record<AgentRole, number> = {
  viewer: 0,
  member: 1,
  team_admin: 2,
  super_admin: 3,
};

const planRanks: Record<AgentPlan, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

export function normalizeAgentRole(role: string | undefined): AgentRole {
  if (role === "viewer" || role === "team_admin" || role === "super_admin") return role;
  return "member";
}

export function normalizeAgentPlan(plan: string | undefined): AgentPlan {
  if (plan === "pro" || plan === "business" || plan === "enterprise") return plan;
  return "free";
}

export function authorizeAgentTool(context: AgentContext, tool: AgentTool) {
  if (!tool.allowedChannels.includes(context.channel)) {
    return { allowed: false, status: "blocked" as const, reason: "当前渠道不允许调用该工具" };
  }

  if (roleRanks[context.userRole] < roleRanks[tool.requiredRole]) {
    return { allowed: false, status: "blocked" as const, reason: "当前账号角色权限不足" };
  }

  if (planRanks[context.tenantPlan] < planRanks[tool.requiredPlan]) {
    return { allowed: false, status: "blocked" as const, reason: "当前套餐不支持该工具" };
  }

  if (tool.riskLevel === "high") {
    return {
      allowed: false,
      status: "requires_approval" as const,
      reason: "高风险操作需要人工确认后执行",
    };
  }

  return { allowed: true, status: "completed" as const };
}
