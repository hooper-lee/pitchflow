import type { AgentWorkflowGoal } from "@/lib/agent/types";
import type { WorkflowDefinition } from "@/lib/agent/workflows/types";
import {
  readNumberSlot,
  readStringArraySlot,
  readStringSlot,
} from "@/lib/agent/workflows/slot-utils";

const slotPrompts: Record<string, string> = {
  companyName: "你们公司怎么称呼",
  productName: "具体卖什么产品或服务",
  productDescription: "这件产品主要解决什么问题",
  valueProposition: "客户为什么应该选择你们",
  name: "你希望这件事叫什么名字",
  targetCustomerText: "你想找哪类客户",
  keywords: "可以用哪些关键词去找这类客户",
  subject: "你希望邮件先用什么角度开场",
  body: "你希望邮件正文表达哪些重点",
};
const defaultDiscoveryJobName = "Agent 创建的精准挖掘任务";

function describeMissingNeeds(missingSlots: string[]) {
  return missingSlots.slice(0, 2).map((slotName) => slotPrompts[slotName] || "还需要一点关键信息");
}

function buildDefaultQuestion(title: string, missingSlots: string[]) {
  return `我在帮你处理「${title}」。先补充这两点就行：${describeMissingNeeds(missingSlots).join("、")}。可以直接用一句话说，不用按表单格式写。`;
}

function normalizeDiscoverySlots(slots: Record<string, unknown>) {
  const keywords = readStringArraySlot(slots, "keywords");
  const currentName = readStringSlot(slots, "name");
  const inferredName = keywords.slice(0, 3).join(" ");
  const name = !currentName || currentName === defaultDiscoveryJobName
    ? inferredName || defaultDiscoveryJobName
    : currentName;
  return {
    ...slots,
    name,
    keywords,
    targetLimit: readNumberSlot(slots, "targetLimit") || 20,
  };
}

function normalizeIcpSlots(slots: Record<string, unknown>) {
  const targetCustomerText = readStringSlot(slots, "targetCustomerText");
  return {
    ...slots,
    name: readStringSlot(slots, "name") || targetCustomerText.slice(0, 24) || "Agent 创建的 ICP 画像",
  };
}

function normalizeCampaignSlots(slots: Record<string, unknown>) {
  return {
    ...slots,
    name: readStringSlot(slots, "name") || "Agent 创建的活动草稿",
    campaignType: readStringSlot(slots, "campaignType") === "reply_followup" ? "reply_followup" : "cold_outreach",
  };
}

function normalizeTemplateSlots(slots: Record<string, unknown>) {
  return {
    ...slots,
    name: readStringSlot(slots, "name") || "Agent 创建的邮件策略",
  };
}

export const workflowDefinitions: WorkflowDefinition[] = [
  {
    goal: "setup_product_profile",
    title: "产品资料设置",
    toolName: "pitchflow.product_profile.upsert",
    requiredSlots: ["companyName", "productName", "productDescription", "valueProposition"],
    optionalSlots: ["senderName", "senderTitle"],
    startIntents: ["setup_product_profile"],
    buildInput: (slots) => slots,
    buildQuestion: (missingSlots) =>
      `我先帮你整理产品资料。先告诉我：${describeMissingNeeds(missingSlots).join("、")}。例如：我们做 AI 自动化获客，卖给外贸团队，核心价值是自动找客户和生成开发信。`,
  },
  {
    goal: "setup_icp_profile",
    title: "ICP 画像创建",
    toolName: "pitchflow.icp.create",
    requiredSlots: ["targetCustomerText"],
    optionalSlots: ["name", "industry", "mustHave", "mustNotHave", "productCategories", "salesModel"],
    startIntents: ["setup_icp_profile"],
    normalizeSlots: normalizeIcpSlots,
    buildInput: (slots) => ({
      name: readStringSlot(slots, "name"),
      targetCustomerText: readStringSlot(slots, "targetCustomerText"),
      industry: readStringSlot(slots, "industry") || undefined,
      mustHave: readStringArraySlot(slots, "mustHave"),
      mustNotHave: readStringArraySlot(slots, "mustNotHave"),
      productCategories: readStringArraySlot(slots, "productCategories"),
    }),
    buildQuestion: (missingSlots) =>
      `你想找什么样的客户？先补充：${describeMissingNeeds(missingSlots).join("、")}。比如“北美 DTC 家具品牌，官网独立站，排除工厂和 marketplace”。`,
  },
  {
    goal: "start_discovery",
    title: "精准挖掘任务",
    toolName: "pitchflow.discovery.create_job",
    requiredSlots: ["keywords"],
    optionalSlots: ["name", "industry", "country", "targetLimit"],
    startIntents: ["start_discovery"],
    normalizeSlots: normalizeDiscoverySlots,
    buildInput: (slots) => ({
      name: readStringSlot(slots, "name"),
      keywords: readStringArraySlot(slots, "keywords"),
      industry: readStringSlot(slots, "industry") || undefined,
      country: readStringSlot(slots, "country") || undefined,
      targetLimit: readNumberSlot(slots, "targetLimit") || 20,
    }),
    buildQuestion: (missingSlots) =>
      `可以，我来帮你创建精准挖掘任务。先告诉我：${describeMissingNeeds(missingSlots).join("、")}。例如“美国宠物用品 DTC 品牌，找 50 个”。`,
  },
  {
    goal: "setup_email_template",
    title: "邮件策略创建",
    toolName: "pitchflow.template.create_draft",
    requiredSlots: ["subject", "body"],
    optionalSlots: ["name", "angle"],
    startIntents: ["setup_email_template"],
    normalizeSlots: normalizeTemplateSlots,
    buildInput: (slots) => ({
      name: readStringSlot(slots, "name"),
      subject: readStringSlot(slots, "subject"),
      body: readStringSlot(slots, "body"),
      angle: readStringSlot(slots, "angle") || undefined,
    }),
    buildQuestion: (missingSlots) => buildDefaultQuestion("邮件策略创建", missingSlots),
  },
  {
    goal: "create_campaign",
    title: "活动草稿创建",
    toolName: "pitchflow.campaign.create_draft",
    requiredSlots: ["name"],
    optionalSlots: ["industry", "campaignType"],
    startIntents: ["create_campaign"],
    normalizeSlots: normalizeCampaignSlots,
    buildInput: (slots) => ({
      name: readStringSlot(slots, "name"),
      industry: readStringSlot(slots, "industry") || undefined,
      campaignType: readStringSlot(slots, "campaignType") || "cold_outreach",
    }),
    buildQuestion: (missingSlots) => buildDefaultQuestion("活动草稿创建", missingSlots),
  },
  {
    goal: "create_prospect",
    title: "客户线索创建",
    toolName: "pitchflow.prospect.create",
    requiredSlots: ["companyName"],
    optionalSlots: ["email", "contactName", "website", "industry", "country"],
    startIntents: ["create_prospect"],
    buildInput: (slots) => slots,
    buildQuestion: (missingSlots) => buildDefaultQuestion("客户线索创建", missingSlots),
  },
];

export function findWorkflowByGoal(goal: AgentWorkflowGoal) {
  return workflowDefinitions.find((definition) => definition.goal === goal);
}

export function findWorkflowByIntent(intent: string) {
  return workflowDefinitions.find((definition) => definition.startIntents.includes(intent));
}
