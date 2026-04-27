import type { AgentWorkflowGoal, AgentWorkflowState } from "@/lib/agent/types";
import { findWorkflowByGoal, findWorkflowByIntent } from "@/lib/agent/workflows/definitions";
import { extractLocalWorkflowSlots } from "@/lib/agent/workflows/local-extractors";
import { findMissingSlots, mergeSlots } from "@/lib/agent/workflows/slot-utils";
import type {
  ActiveWorkflow,
  WorkflowDefinition,
  WorkflowTurnInput,
  WorkflowTurnResult,
} from "@/lib/agent/workflows/types";

function nowIsoString() {
  return new Date().toISOString();
}

function isWorkflowGoal(value: unknown): value is AgentWorkflowGoal {
  return (
    value === "setup_product_profile" ||
    value === "setup_icp_profile" ||
    value === "setup_email_template" ||
    value === "create_campaign" ||
    value === "start_discovery" ||
    value === "create_prospect"
  );
}

function readActiveWorkflow(metadata: Record<string, unknown>): ActiveWorkflow | null {
  const rawWorkflow = metadata.agentWorkflow;
  if (!rawWorkflow || typeof rawWorkflow !== "object") return null;

  const workflowState = rawWorkflow as Partial<AgentWorkflowState>;
  if (!isWorkflowGoal(workflowState.goal)) return null;

  const definition = findWorkflowByGoal(workflowState.goal);
  if (!definition) return null;

  return {
    definition,
    state: {
      goal: workflowState.goal,
      slots: workflowState.slots || {},
      createdAt: workflowState.createdAt || nowIsoString(),
      updatedAt: workflowState.updatedAt || nowIsoString(),
    },
  };
}

function buildWorkflowCard(definition: WorkflowDefinition, status: string, detail?: string) {
  return [{ kind: "workflow" as const, title: definition.title, status, detail }];
}

function normalizeWorkflowSlots(
  definition: WorkflowDefinition,
  slots: Record<string, unknown>
) {
  return definition.normalizeSlots ? definition.normalizeSlots(slots) : slots;
}

function buildNextWorkflowState(
  definition: WorkflowDefinition,
  existingWorkflow: ActiveWorkflow | null,
  incomingSlots: Record<string, unknown>,
  message: string
) {
  const currentSlots = existingWorkflow?.state.slots || {};
  const localSlots = extractLocalWorkflowSlots(definition.goal, message);
  const mergedSlots = mergeSlots(currentSlots, mergeSlots(localSlots, incomingSlots));
  const normalizedSlots = normalizeWorkflowSlots(definition, mergedSlots);
  return {
    goal: definition.goal,
    slots: normalizedSlots,
    createdAt: existingWorkflow?.state.createdAt || nowIsoString(),
    updatedAt: nowIsoString(),
  };
}

function buildCollectingResult(
  metadata: Record<string, unknown>,
  definition: WorkflowDefinition,
  state: AgentWorkflowState,
  missingSlots: string[]
): WorkflowTurnResult {
  const reply = definition.buildQuestion(missingSlots, state.slots);
  return {
    handled: true,
    intent: definition.goal,
    reply,
    metadata: { ...metadata, agentWorkflow: state },
    cards: buildWorkflowCard(definition, "收集中", "我会持续记住你前面已经补充的信息。"),
  };
}

function buildReadyResult(
  metadata: Record<string, unknown>,
  definition: WorkflowDefinition,
  state: AgentWorkflowState
): WorkflowTurnResult {
  return {
    handled: true,
    intent: definition.goal,
    reply: `信息已经够了，我现在执行「${definition.title}」。`,
    metadata: { ...metadata, agentWorkflow: null },
    toolCall: { toolName: definition.toolName, input: definition.buildInput(state.slots) },
    cards: buildWorkflowCard(definition, "执行中"),
  };
}

export function handleWorkflowTurn(input: WorkflowTurnInput): WorkflowTurnResult {
  const activeWorkflow = readActiveWorkflow(input.metadata);
  const definition = activeWorkflow?.definition || findWorkflowByIntent(input.planIntent);

  if (!definition) return { handled: false };

  const state = buildNextWorkflowState(
    definition,
    activeWorkflow,
    input.planSlots,
    input.message
  );
  const missingSlots = findMissingSlots(definition.requiredSlots, state.slots);

  if (missingSlots.length > 0) {
    return buildCollectingResult(input.metadata, definition, state, missingSlots);
  }

  return buildReadyResult(input.metadata, definition, state);
}
