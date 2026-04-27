import type {
  AgentResponseCard,
  AgentWorkflowGoal,
  AgentWorkflowState,
  PlannedToolCall,
} from "@/lib/agent/types";

export type WorkflowStatus = "collecting" | "ready" | "completed";

export interface WorkflowDefinition {
  goal: AgentWorkflowGoal;
  title: string;
  toolName: string;
  requiredSlots: string[];
  optionalSlots: string[];
  startIntents: string[];
  buildInput: (slots: Record<string, unknown>) => Record<string, unknown>;
  buildQuestion: (missingLabels: string[], slots: Record<string, unknown>) => string;
  normalizeSlots?: (slots: Record<string, unknown>) => Record<string, unknown>;
}

export interface WorkflowTurnInput {
  message: string;
  metadata: Record<string, unknown>;
  planIntent: string;
  planReply: string;
  planSlots: Record<string, unknown>;
}

export interface WorkflowTurnResult {
  handled: boolean;
  intent?: string;
  reply?: string;
  metadata?: Record<string, unknown>;
  toolCall?: PlannedToolCall;
  cards?: AgentResponseCard[];
}

export interface ActiveWorkflow {
  definition: WorkflowDefinition;
  state: AgentWorkflowState;
}
