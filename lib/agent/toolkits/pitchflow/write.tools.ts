import { z } from "zod";
import { createCampaign } from "@/lib/services/campaign.service";
import { createDiscoveryJob } from "@/lib/services/discovery.service";
import {
  createIcpProfile,
  getIcpProfile,
  updateIcpProfile,
} from "@/lib/services/icp-profile.service";
import { createProspect, updateProspect } from "@/lib/services/prospect.service";
import { createTemplate, updateTemplate } from "@/lib/services/template.service";
import type { AgentTool } from "@/lib/agent/types";

const discoveryCreateSchema = z.object({
  name: z.string().min(1).max(255),
  keywords: z.array(z.string().min(1)).min(1).max(20),
  industry: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  targetLimit: z.number().int().min(1).max(50).default(20),
});

const draftCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(255).optional(),
  campaignType: z.enum(["cold_outreach", "reply_followup"]).default("cold_outreach"),
});

const templateDraftSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  angle: z.string().max(100).optional(),
  productName: z.string().max(255).optional(),
  senderName: z.string().max(255).optional(),
  isDefault: z.boolean().default(false),
});

const templateUpdateSchema = templateDraftSchema.partial().extend({
  templateId: z.string().uuid(),
});

const icpDraftSchema = z.object({
  name: z.string().min(1).max(255),
  targetCustomerText: z.string().min(1).max(10000),
  description: z.string().max(2000).optional(),
  industry: z.string().max(255).optional(),
  mustHave: z.array(z.string()).default([]),
  mustNotHave: z.array(z.string()).default([]),
  positiveKeywords: z.array(z.string()).default([]),
  negativeKeywords: z.array(z.string()).default([]),
  productCategories: z.array(z.string()).default([]),
  salesModel: z.string().max(100).optional(),
  minScoreToSave: z.number().int().min(0).max(100).default(80),
  minScoreToReview: z.number().int().min(0).max(100).default(60),
  promptTemplate: z.string().max(10000).optional(),
  isDefault: z.boolean().default(false),
});

const icpUpdateSchema = icpDraftSchema.partial().extend({
  icpProfileId: z.string().uuid(),
});

const prospectBaseSchema = z.object({
  companyName: z.string().min(1).max(500).optional(),
  contactName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  linkedinUrl: z.string().url().optional(),
  whatsapp: z.string().max(50).optional(),
  industry: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional(),
  source: z.string().max(100).default("agent"),
});

const prospectCreateSchema = prospectBaseSchema.refine((input) => Boolean(input.companyName || input.email || input.website), {
  message: "至少需要公司名称、邮箱或官网之一",
});

const prospectUpdateSchema = prospectBaseSchema.partial().extend({
  prospectId: z.string().uuid(),
});

const campaignStartSchema = z.object({
  campaignId: z.string().uuid(),
});

async function createDiscoveryJobTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = discoveryCreateSchema.parse(rawInput);
  const job = await createDiscoveryJob(context.tenantId, context.userId, {
    ...input,
    filters: {},
  });
  return { job, summary: `已创建精准挖掘任务：${job.name}。` };
}

async function createCampaignDraftTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const campaign = await createCampaign(context.tenantId, draftCampaignSchema.parse(rawInput));
  return { campaign, summary: `已创建活动草稿：${campaign.name}。` };
}

async function createTemplateDraftTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const template = await createTemplate(context.tenantId, templateDraftSchema.parse(rawInput));
  return { template, summary: `已创建邮件模板草稿：${template.name}。` };
}

async function updateTemplateTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const { templateId, ...input } = templateUpdateSchema.parse(rawInput);
  const template = await updateTemplate(templateId, context.tenantId, input);
  return { template, summary: template ? `已更新邮件策略：${template.name}。` : "没有找到该邮件策略。" };
}

async function createIcpTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = icpDraftSchema.parse(rawInput);
  const profile = await createIcpProfile(context.tenantId, context.userId, {
    ...input,
    scoreWeights: {},
  });
  return { profile, summary: `已创建 ICP 画像：${profile.name}。` };
}

async function updateIcpTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const { icpProfileId, ...input } = icpUpdateSchema.parse(rawInput);
  const currentProfile = await getIcpProfile(icpProfileId, context.tenantId);
  if (!currentProfile) {
    return { profile: null, summary: "没有找到该 ICP 画像。" };
  }

  const profile = await updateIcpProfile(icpProfileId, context.tenantId, {
    name: input.name || currentProfile.name,
    targetCustomerText: input.targetCustomerText || currentProfile.targetCustomerText || "",
    mustHave: input.mustHave || currentProfile.mustHave || [],
    mustNotHave: input.mustNotHave || currentProfile.mustNotHave || [],
    positiveKeywords: input.positiveKeywords || currentProfile.positiveKeywords || [],
    negativeKeywords: input.negativeKeywords || currentProfile.negativeKeywords || [],
    productCategories: input.productCategories || currentProfile.productCategories || [],
    scoreWeights: currentProfile.scoreWeights || {},
    minScoreToSave: input.minScoreToSave ?? currentProfile.minScoreToSave ?? 80,
    minScoreToReview: input.minScoreToReview ?? currentProfile.minScoreToReview ?? 60,
    description: input.description ?? currentProfile.description ?? undefined,
    industry: input.industry ?? currentProfile.industry ?? undefined,
    salesModel: input.salesModel ?? currentProfile.salesModel ?? undefined,
    promptTemplate: input.promptTemplate ?? currentProfile.promptTemplate ?? undefined,
    isDefault: input.isDefault ?? currentProfile.isDefault ?? false,
  });
  return { profile, summary: `已更新 ICP 画像：${profile?.name}。` };
}

async function createProspectTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const prospect = await createProspect(context.tenantId, prospectCreateSchema.parse(rawInput));
  return { prospect, summary: `已创建客户：${prospect.companyName || prospect.email || prospect.id}。` };
}

async function updateProspectTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const { prospectId, ...input } = prospectUpdateSchema.parse(rawInput);
  const prospect = await updateProspect(prospectId, context.tenantId, input);
  return { prospect, summary: prospect ? `已更新客户：${prospect.companyName || prospect.email}。` : "没有找到该客户。" };
}

async function startCampaignTool(_: Parameters<AgentTool["execute"]>[0], rawInput: Record<string, unknown>) {
  campaignStartSchema.parse(rawInput);
  return { summary: "活动启动属于高风险操作，需要审批后执行。" };
}

export const pitchflowWriteTools: AgentTool[] = [
  {
    name: "pitchflow.discovery.create_job",
    toolkit: "pitchflow.discovery",
    description: "创建精准挖掘任务。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 2,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：name 任务名、keywords 关键词数组；可填：industry 行业、country 国家、targetLimit 候选数量 1-50。",
    schema: discoveryCreateSchema,
    execute: createDiscoveryJobTool,
  },
  {
    name: "pitchflow.campaign.create_draft",
    toolkit: "pitchflow.campaign",
    description: "创建活动草稿，不发送邮件。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：name 活动名称；可填：industry 行业、campaignType cold_outreach/reply_followup。只创建草稿，不发送。",
    schema: draftCampaignSchema,
    execute: createCampaignDraftTool,
  },
  {
    name: "pitchflow.template.create_draft",
    toolkit: "pitchflow.template",
    description: "创建邮件模板草稿。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：name 模板名、subject 邮件主题、body 邮件正文；可填：angle 角度、productName 产品名、senderName 发件人、isDefault 是否默认。",
    schema: templateDraftSchema,
    execute: createTemplateDraftTool,
  },
  {
    name: "pitchflow.template.update",
    toolkit: "pitchflow.template",
    description: "更新已有邮件策略模板。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：templateId；可填：name、subject、body、angle、productName、senderName、isDefault。",
    schema: templateUpdateSchema,
    execute: updateTemplateTool,
  },
  {
    name: "pitchflow.icp.create",
    toolkit: "pitchflow.icp",
    description: "创建 ICP 画像草稿。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：name、targetCustomerText；可填：industry、description、mustHave、mustNotHave、positiveKeywords、negativeKeywords、productCategories、salesModel、minScoreToSave、minScoreToReview、promptTemplate、isDefault。",
    schema: icpDraftSchema,
    execute: createIcpTool,
  },
  {
    name: "pitchflow.icp.update",
    toolkit: "pitchflow.icp",
    description: "更新已有 ICP 画像。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：icpProfileId；可填：name、targetCustomerText、industry、description、mustHave、mustNotHave、positiveKeywords、negativeKeywords、productCategories、salesModel、minScoreToSave、minScoreToReview、promptTemplate、isDefault。",
    schema: icpUpdateSchema,
    execute: updateIcpTool,
  },
  {
    name: "pitchflow.prospect.create",
    toolkit: "pitchflow.prospect",
    description: "手动创建客户线索。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "可填：companyName、contactName、email、linkedinUrl、whatsapp、industry、country、website、source。至少尽量提供公司名或邮箱。",
    schema: prospectCreateSchema,
    execute: createProspectTool,
  },
  {
    name: "pitchflow.prospect.update",
    toolkit: "pitchflow.prospect",
    description: "更新已有客户线索资料。",
    riskLevel: "medium",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "必填：prospectId；可填：companyName、contactName、email、linkedinUrl、whatsapp、industry、country、website、source。",
    schema: prospectUpdateSchema,
    execute: updateProspectTool,
  },
  {
    name: "pitchflow.campaign.start",
    toolkit: "pitchflow.campaign",
    description: "启动活动并发送邮件，高风险，必须审批。",
    riskLevel: "high",
    requiredRole: "team_admin",
    requiredPlan: "pro",
    creditCost: 0,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint: "必填：campaignId。启动活动会真实发送邮件，必须审批。",
    schema: campaignStartSchema,
    execute: startCampaignTool,
  },
];
