import assert from "node:assert/strict";
import { getInitialAgentUsageCredits } from "@/lib/agent/billing";
import { authorizeAgentChannel } from "@/lib/agent/policies/channel-policy";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { authorizeAgentWorkflow } from "@/lib/agent/policies/workflow-policy";
import { buildAgentDisabledResult } from "@/lib/agent/runtime-results";
import { createChannelBindingCode, parseChannelBindingCode } from "@/lib/agent/channel-bindings";
import { extractChannelBindingCode } from "@/lib/agent/channel-webhook";
import { handleWorkflowTurn } from "@/lib/agent/workflows/engine";

function testPlanAndChannelPolicy() {
  assert.equal(authorizeAgentWorkflow(getAgentPlanPolicy("free"), "start_discovery").allowed, false);
  assert.equal(authorizeAgentWorkflow(getAgentPlanPolicy("pro"), "start_discovery").allowed, true);
  assert.equal(authorizeAgentChannel(getAgentPlanPolicy("pro"), "feishu").allowed, false);
  assert.equal(authorizeAgentChannel(getAgentPlanPolicy("business"), "feishu").allowed, true);
  assert.equal(authorizeAgentChannel(getAgentPlanPolicy("business"), "wecom").allowed, true);
}

function testDisabledAgentResult() {
  const result = buildAgentDisabledResult();
  assert.equal(result.intent, "agent_disabled");
  assert.match(result.reply, /还没有启用 Hemera Agent/);
  assert.equal(result.cards?.[0]?.status, "未启用");
}

function testInitialUsageCredits() {
  const credits = getInitialAgentUsageCredits();
  assert.equal(credits.conversationCredits > 0, true);
  assert.equal(credits.plannerCredits > 0, true);
  assert.equal(credits.totalCredits, credits.conversationCredits + credits.plannerCredits);
}

function testDiscoveryWorkflowExtraction() {
  const result = handleWorkflowTurn({
    message: "帮我挖掘美国宠物用品 DTC 品牌，找 50 个",
    metadata: {},
    planIntent: "start_discovery",
    planReply: "",
    planSlots: {},
  });
  assert.equal(result.handled, true);
  assert.equal(result.toolCall?.toolName, "pitchflow.discovery.create_job");
  assert.deepEqual(result.toolCall?.input.targetLimit, 50);
  assert.equal(Array.isArray(result.toolCall?.input.keywords), true);
}

function testGoalDrivenDraftWorkflows() {
  const templateResult = handleWorkflowTurn({
    message: "创建一个偏自然语气的首封开发信模板",
    metadata: {},
    planIntent: "setup_email_template",
    planReply: "",
    planSlots: {},
  });
  const campaignResult = handleWorkflowTurn({
    message: "创建一个冷启动活动草稿",
    metadata: {},
    planIntent: "create_campaign",
    planReply: "",
    planSlots: {},
  });
  assert.equal(templateResult.toolCall?.toolName, "pitchflow.template.create_draft");
  assert.equal(typeof templateResult.toolCall?.input.subject, "string");
  assert.equal(campaignResult.toolCall?.toolName, "pitchflow.campaign.create_draft");
  assert.match(String(campaignResult.reply), /业务摘要|草稿/);
}

function testBindingCodeWhitespaceTolerance() {
  process.env.AGENT_BINDING_SECRET = process.env.AGENT_BINDING_SECRET || "local-agent-test-secret";
  const code = createChannelBindingCode({
    tenantId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    channel: "feishu",
  });
  const wrappedCode = `${code.slice(0, 40)}\n${code.slice(40, 90)} ${code.slice(90)}`;
  const extractedCode = extractChannelBindingCode(`bind\n${wrappedCode}`);

  assert.equal(extractedCode, code);
  assert.equal(parseChannelBindingCode(extractedCode || "").channel, "feishu");
}

function runAgentPlatformTests() {
  testPlanAndChannelPolicy();
  testDisabledAgentResult();
  testInitialUsageCredits();
  testDiscoveryWorkflowExtraction();
  testGoalDrivenDraftWorkflows();
  testBindingCodeWhitespaceTolerance();
  console.log("Agent platform tests passed");
}

runAgentPlatformTests();
process.exit(0);
