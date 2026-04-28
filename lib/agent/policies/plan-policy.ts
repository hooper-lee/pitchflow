import type { AgentChannel, AgentPlan, AgentWorkflowGoal } from "@/lib/agent/types";

export const AGENT_RUN_CREDIT_COST = 1;
export const AGENT_PLANNER_CREDIT_COST = 1;

export interface AgentPlanPolicy {
  plan: AgentPlan;
  monthlyCredits: number;
  contextMessageLimit: number;
  allowedChannels: AgentChannel[];
  allowedIntents: string[];
  allowedWorkflows: AgentWorkflowGoal[];
  allowWriteTools: boolean;
  allowAutoTasks: boolean;
  allowMcp: boolean;
}

const freeIntents = [
  "agent_identity",
  "general_greeting",
  "general_guidance",
  "check_readiness",
  "setup_readiness_check",
  "view_product_profile",
  "product_profile_get",
  "mail_account_list",
  "list_icp_profiles",
  "icp_list",
  "list_email_templates",
  "template_list",
  "list_campaigns",
  "campaign_list",
  "list_prospects",
  "prospect_list",
  "list_discovery_jobs",
  "discovery_list_jobs",
  "list_replies",
  "email_reply_list",
  "summarize_campaign",
  "campaign_summarize",
  "summarize_discovery_candidates",
  "discovery_summarize_candidates",
];

const pitchflowWriteWorkflows: AgentWorkflowGoal[] = [
  "setup_product_profile",
  "setup_icp_profile",
  "setup_email_template",
  "create_campaign",
  "start_discovery",
  "create_prospect",
];

export const agentPlanPolicies: Record<AgentPlan, AgentPlanPolicy> = {
  free: {
    plan: "free",
    monthlyCredits: 100,
    contextMessageLimit: 10,
    allowedChannels: ["web"],
    allowedIntents: freeIntents,
    allowedWorkflows: [],
    allowWriteTools: false,
    allowAutoTasks: false,
    allowMcp: false,
  },
  pro: {
    plan: "pro",
    monthlyCredits: 2000,
    contextMessageLimit: 30,
    allowedChannels: ["web", "api"],
    allowedIntents: ["*"],
    allowedWorkflows: pitchflowWriteWorkflows,
    allowWriteTools: true,
    allowAutoTasks: false,
    allowMcp: false,
  },
  business: {
    plan: "business",
    monthlyCredits: 10000,
    contextMessageLimit: 50,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    allowedIntents: ["*"],
    allowedWorkflows: pitchflowWriteWorkflows,
    allowWriteTools: true,
    allowAutoTasks: true,
    allowMcp: false,
  },
  enterprise: {
    plan: "enterprise",
    monthlyCredits: Number.MAX_SAFE_INTEGER,
    contextMessageLimit: 100,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    allowedIntents: ["*"],
    allowedWorkflows: pitchflowWriteWorkflows,
    allowWriteTools: true,
    allowAutoTasks: true,
    allowMcp: true,
  },
};

export function getAgentPlanPolicy(plan: AgentPlan) {
  return agentPlanPolicies[plan];
}

export function isAgentIntentAllowed(policy: AgentPlanPolicy, intent: string) {
  return policy.allowedIntents.includes("*") || policy.allowedIntents.includes(intent);
}

export function trimAgentContextMessages<T>(messages: T[], limit: number) {
  if (limit <= 0) return [];
  return messages.slice(-limit);
}
