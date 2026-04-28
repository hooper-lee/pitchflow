import type { AgentRole } from "@/lib/agent/types";

const roleRanks: Record<AgentRole, number> = {
  viewer: 0,
  member: 1,
  team_admin: 2,
  super_admin: 3,
};

export function canManageAgent(role: AgentRole) {
  return roleRanks[role] >= roleRanks.team_admin;
}

export function canApproveAgentAction(role: AgentRole) {
  return roleRanks[role] >= roleRanks.team_admin;
}

export function canUseAgent(role: AgentRole) {
  return roleRanks[role] >= roleRanks.viewer;
}
