import type { z } from "zod";

export type AgentChannel = "web" | "feishu" | "wecom" | "api";
export type AgentPlan = "free" | "pro" | "business" | "enterprise";
export type AgentRole = "viewer" | "member" | "team_admin" | "super_admin";
export type AgentRiskLevel = "low" | "medium" | "high";
export type AgentRunStatus = "completed" | "failed" | "requires_approval";
export type AgentPlannerType = "model" | "rules" | "workflow";
export type AgentWorkflowGoal =
  | "setup_product_profile"
  | "setup_icp_profile"
  | "setup_email_template"
  | "create_campaign"
  | "start_discovery"
  | "create_prospect";

export interface AgentResponseCard {
  kind: "tool" | "status" | "workflow";
  title: string;
  status: string;
  detail?: string;
}

export interface AgentWorkflowState {
  goal: AgentWorkflowGoal;
  slots: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentContext {
  tenantId: string;
  userId: string;
  userRole: AgentRole;
  tenantPlan: AgentPlan;
  channel: AgentChannel;
  agentId: string;
  conversationId?: string;
  runId?: string;
}

export interface AgentTool<Input extends Record<string, unknown> = Record<string, unknown>, Output = unknown> {
  name: string;
  toolkit: string;
  description: string;
  riskLevel: AgentRiskLevel;
  requiredRole: AgentRole;
  requiredPlan: AgentPlan;
  creditCost: number;
  allowedChannels: AgentChannel[];
  inputHint?: string;
  schema: z.ZodType<Input>;
  execute: (context: AgentContext, input: Input) => Promise<Output>;
}

export interface PlannedToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface AgentPlanResult {
  intent: string;
  reply: string;
  toolCall?: PlannedToolCall;
  slots?: Record<string, unknown>;
  confidence?: number;
  plannerType?: AgentPlannerType;
}

export interface AgentToolCallResult {
  toolName: string;
  status: "completed" | "failed" | "blocked" | "requires_approval";
  output?: unknown;
  errorMessage?: string;
  approvalId?: string;
}

export interface AgentRunResult {
  conversationId: string;
  runId: string;
  status: AgentRunStatus;
  intent: string;
  reply: string;
  toolCalls: AgentToolCallResult[];
  cards?: AgentResponseCard[];
}

export interface RunAgentInput {
  tenantId: string;
  userId: string;
  userRole: AgentRole;
  tenantPlan: AgentPlan;
  channel: AgentChannel;
  message: string;
  conversationId?: string;
}
