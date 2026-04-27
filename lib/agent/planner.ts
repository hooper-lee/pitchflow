import { getAIProvider } from "@/lib/ai";
import { parseIntentPlannerJson } from "@/lib/agent/plan-json";
import type { AgentPlanResult } from "@/lib/agent/types";
import {
  AI_PROMPT_KEYS,
  getAiPromptConfig,
  getDefaultResearchProvider,
  interpolatePromptTemplate,
} from "@/lib/services/config.service";

const readinessKeywords = [
  "检查",
  "配置",
  "准备",
  "能不能开始",
  "是否能开始",
  "邮箱",
  "画像",
  "模版",
  "模板",
  "readiness",
  "ready",
];
const modelPlanningTimeoutMs = 15000;
const smallTalkMessages = new Set(["你好", "hello", "hi", "hey", "在吗"]);
const identityMessages = new Set(["你是谁", "你是誰", "你是什么", "你能干嘛", "你可以做什么", "介绍一下你自己"]);
const highLevelIntents = [
  "general_greeting",
  "check_readiness",
  "setup_product_profile",
  "setup_icp_profile",
  "setup_email_template",
  "create_campaign",
  "start_discovery",
  "create_prospect",
  "view_product_profile",
  "list_icp_profiles",
  "list_email_templates",
  "list_campaigns",
  "list_prospects",
  "list_discovery_jobs",
  "list_replies",
  "summarize_campaign",
  "summarize_discovery_candidates",
  "start_campaign",
  "general_guidance",
] as const;

function extractUuid(message: string) {
  return message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
}

function planTool(intent: string, reply: string, toolName: string, input: Record<string, unknown> = {}) {
  return { intent, reply, plannerType: "rules" as const, toolCall: { toolName, input } };
}

function planReply(
  intent: string,
  reply: string,
  slots: Record<string, unknown> = {}
): AgentPlanResult {
  return { intent, reply, slots, plannerType: "rules" };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function parseInlineJson(message: string) {
  const jsonText = message.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return {};
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function shouldUpdateProductProfile(message: string) {
  return (
    (message.includes("设置") ||
      message.includes("补充") ||
      message.includes("更新") ||
      message.includes("修改") ||
      message.includes("填写")) &&
    message.includes("产品")
  );
}

function buildIntentCatalog() {
  return highLevelIntents.join(", ");
}

function normalizeIntent(intent: string) {
  return highLevelIntents.includes(intent as (typeof highLevelIntents)[number])
    ? intent
    : "general_guidance";
}

function mapIntentToPlan(
  intent: string,
  slots: Record<string, unknown>,
  reply: string,
  message: string
): AgentPlanResult {
  const uuid = extractUuid(message);
  const normalizedIntent = normalizeIntent(intent);

  if (normalizedIntent === "check_readiness") {
    return planTool(normalizedIntent, reply, "pitchflow.setup.check_readiness");
  }
  if (normalizedIntent === "view_product_profile") {
    return planTool(normalizedIntent, reply, "pitchflow.product_profile.get");
  }
  if (normalizedIntent === "list_icp_profiles") return planTool(normalizedIntent, reply, "pitchflow.icp.list");
  if (normalizedIntent === "list_email_templates") return planTool(normalizedIntent, reply, "pitchflow.template.list");
  if (normalizedIntent === "list_campaigns") return planTool(normalizedIntent, reply, "pitchflow.campaign.list");
  if (normalizedIntent === "list_prospects") return planTool(normalizedIntent, reply, "pitchflow.prospect.list");
  if (normalizedIntent === "list_discovery_jobs") return planTool(normalizedIntent, reply, "pitchflow.discovery.list_jobs");
  if (normalizedIntent === "list_replies") return planTool(normalizedIntent, reply, "pitchflow.email_reply.list");
  if (normalizedIntent === "summarize_campaign" && uuid) {
    return planTool(normalizedIntent, reply, "pitchflow.campaign.summarize", { campaignId: uuid });
  }
  if (normalizedIntent === "summarize_discovery_candidates" && uuid) {
    return planTool(normalizedIntent, reply, "pitchflow.discovery.summarize_candidates", { jobId: uuid });
  }
  if (normalizedIntent === "start_campaign" && uuid) {
    return planTool(normalizedIntent, reply, "pitchflow.campaign.start", { campaignId: uuid });
  }
  if (normalizedIntent === "general_greeting") return planSmallTalk(message) || planReply(normalizedIntent, reply);
  if (["setup_product_profile", "setup_icp_profile", "setup_email_template", "create_campaign", "start_discovery", "create_prospect"].includes(normalizedIntent)) {
    return {
      intent: normalizedIntent,
      reply: reply || "可以，我先理解你的目标，再决定下一步怎么做。",
      slots,
      plannerType: "model",
    };
  }

  return planReply(
    normalizedIntent,
    reply || "我可以帮你检查准备状态、创建挖掘任务、维护客户资料或查看活动进展。",
    slots
  );
}

function planSmallTalk(message: string): AgentPlanResult | null {
  const normalizedMessage = message.trim().toLowerCase().replace(/[?？。！!，,\s]/g, "");
  if (identityMessages.has(normalizedMessage)) {
    return {
      intent: "agent_identity",
      plannerType: "rules",
      reply:
        "我是 Hemera 云端数字员工，PitchFlow 是我当前接入的外贸获客工具包。我可以帮你梳理产品资料、创建 ICP、发起客户挖掘、查看客户/活动状态，并在高风险操作前让你确认。",
    };
  }
  if (!smallTalkMessages.has(normalizedMessage)) return null;

  return {
    intent: "general_greeting",
    plannerType: "rules",
    reply: "你好，我可以帮你检查获客准备、创建 ICP、发起客户挖掘、查看客户/活动，或者把下一步动作整理清楚。",
  };
}

export async function planAgentResponseWithModel(message: string): Promise<AgentPlanResult> {
  const smallTalkPlan = planSmallTalk(message);
  if (smallTalkPlan) return smallTalkPlan;

  try {
    const [providerType, systemPrompt, promptTemplate] = await Promise.all([
      getDefaultResearchProvider(),
      getAiPromptConfig(AI_PROMPT_KEYS.AGENT_PLANNER_SYSTEM),
      getAiPromptConfig(AI_PROMPT_KEYS.AGENT_PLANNER_USER),
    ]);
    const provider = getAIProvider(providerType);
    const prompt = interpolatePromptTemplate(promptTemplate, {
      message,
      intentCatalog: buildIntentCatalog(),
    });
    const responseText = await withTimeout(
      provider.researchProspect({ prompt, systemPrompt, maxTokens: 1200 }),
      modelPlanningTimeoutMs,
      "Agent planner"
    );
    const plan = parseIntentPlannerJson(responseText);
    return {
      ...mapIntentToPlan(plan.intent, plan.slots, plan.reply, message),
      confidence: plan.confidence,
      plannerType: "model",
    };
  } catch {
    return planAgentResponse(message);
  }
}

export function planAgentResponse(message: string): AgentPlanResult {
  const normalizedMessage = message.toLowerCase();
  const uuid = extractUuid(message);
  const inlineInput = parseInlineJson(message);
  const shouldCheckReadiness = readinessKeywords.some((keyword) =>
    normalizedMessage.includes(keyword.toLowerCase())
  );

  if (shouldCheckReadiness) {
    return planTool(
      "setup_readiness_check",
      "我先检查当前账号的获客准备状态，包括产品资料、邮箱连接、ICP 画像和邮件模板。",
      "pitchflow.setup.check_readiness"
    );
  }

  if (shouldUpdateProductProfile(message)) {
    return planReply(
      "setup_product_profile",
      "可以，我先把你说的内容整理成产品资料，再看还缺哪些关键信息。",
      inlineInput
    );
  }

  if (normalizedMessage.includes("产品")) {
    return planTool("product_profile_get", "我先查看当前产品资料配置。", "pitchflow.product_profile.get");
  }

  if (normalizedMessage.includes("邮箱") || normalizedMessage.includes("发件")) {
    return planTool("mail_account_list", "我先查看当前已连接邮箱状态。", "pitchflow.mail_account.list");
  }

  if (normalizedMessage.includes("画像") || normalizedMessage.includes("icp")) {
    return planTool("icp_list", "我先查看当前 ICP 画像。", "pitchflow.icp.list");
  }

  if (normalizedMessage.includes("模板") || normalizedMessage.includes("模版")) {
    if (normalizedMessage.includes("创建") || normalizedMessage.includes("新增")) {
      return planReply(
        "setup_email_template",
        "可以，我会先帮你整理邮件策略，不会发送任何邮件。",
        inlineInput
      );
    }
    return planTool("template_list", "我先查看当前邮件模板。", "pitchflow.template.list");
  }

  if (normalizedMessage.includes("回复")) {
    return planTool("email_reply_list", "我先查看最近客户回复。", "pitchflow.email_reply.list");
  }

  if (normalizedMessage.includes("活动")) {
    if ((normalizedMessage.includes("启动") || normalizedMessage.includes("发送")) && uuid) {
      return planTool(
        "campaign_start_requires_approval",
        "启动活动会真实发送邮件，我会先提交审批请求。",
        "pitchflow.campaign.start",
        { campaignId: uuid }
      );
    }
    if (normalizedMessage.includes("创建") || normalizedMessage.includes("新增")) {
      return planReply("create_campaign", "可以，我会创建活动草稿，不会发送邮件。", inlineInput);
    }
    if (uuid && (normalizedMessage.includes("总结") || normalizedMessage.includes("表现"))) {
      return planTool("campaign_summarize", "我先总结这个活动的表现。", "pitchflow.campaign.summarize", {
        campaignId: uuid,
      });
    }
    return planTool("campaign_list", "我先查看最近活动。", "pitchflow.campaign.list");
  }

  if (
    normalizedMessage.includes("挖掘") ||
    normalizedMessage.includes("候选") ||
    normalizedMessage.includes("获客") ||
    /找.*(客户|品牌|公司)/.test(message)
  ) {
    const shouldStartDiscovery =
      normalizedMessage.includes("创建") ||
      normalizedMessage.includes("新增") ||
      normalizedMessage.includes("开始") ||
      /^(挖掘客户|找客户|开发客户|开始获客|精准挖掘)$/.test(message.trim());
    if (shouldStartDiscovery) {
      return planReply(
        "start_discovery",
        "可以，我会先理解你要找的客户，再创建精准挖掘任务。",
        inlineInput
      );
    }
    if (uuid && normalizedMessage.includes("候选")) {
      return planTool(
        "discovery_summarize_candidates",
        "我先总结这个挖掘任务的候选池。",
        "pitchflow.discovery.summarize_candidates",
        { jobId: uuid }
      );
    }
    return planTool("discovery_list_jobs", "我先查看最近精准挖掘任务。", "pitchflow.discovery.list_jobs");
  }

  if (normalizedMessage.includes("客户") || normalizedMessage.includes("线索")) {
    if (normalizedMessage.includes("创建") || normalizedMessage.includes("新增")) {
      return planReply("create_prospect", "可以，我会帮你整理客户线索信息。", inlineInput);
    }
    return planTool("prospect_list", "我先查看最近客户列表。", "pitchflow.prospect.list");
  }

  if ((normalizedMessage.includes("创建") || normalizedMessage.includes("新增")) && normalizedMessage.includes("icp")) {
    return planReply(
      "setup_icp_profile",
      "可以，请直接描述你想找的目标客户，我会整理成 ICP 画像。",
      inlineInput
    );
  }

  return {
    intent: "general_guidance",
    plannerType: "rules",
    reply:
      "我可以帮你检查获客准备状态、解释当前流程、梳理下一步操作。你可以直接问：现在能不能开始挖掘客户？",
  };
}
