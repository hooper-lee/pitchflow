import { z } from "zod";
import {
  getProductProfile,
  updateProductProfile,
} from "@/lib/services/product-profile.service";
import type { AgentTool } from "@/lib/agent/types";

const productProfileInputSchema = z.object({
  companyName: z.string().max(255).optional(),
  productName: z.string().max(255).optional(),
  productDescription: z.string().max(3000).optional(),
  valueProposition: z.string().max(3000).optional(),
  senderName: z.string().max(255).optional(),
  senderTitle: z.string().max(255).optional(),
});
const productProfileInputKeys = [
  "companyName",
  "productName",
  "productDescription",
  "valueProposition",
  "senderName",
  "senderTitle",
] as const;

async function getProductProfileTool(context: Parameters<AgentTool["execute"]>[0]) {
  const profile = await getProductProfile(context.tenantId);
  const missingFields = [
    ["companyName", "公司名称"],
    ["productName", "产品名称"],
    ["productDescription", "产品描述"],
    ["valueProposition", "核心卖点"],
  ].filter(([key]) => !profile[key as keyof typeof profile]);

  return {
    profile,
    missingFields: missingFields.map(([, label]) => label),
    summary:
      missingFields.length === 0
        ? "产品资料已完整，适合用于邮件生成和客户筛选。"
        : `产品资料还缺：${missingFields.map(([, label]) => label).join("、")}。`,
  };
}

async function upsertProductProfileTool(
  context: Parameters<AgentTool["execute"]>[0],
  input: z.infer<typeof productProfileInputSchema>
) {
  const hasExplicitValue = productProfileInputKeys.some((key) => Boolean(input[key]?.trim()));
  if (!hasExplicitValue) {
    return {
      updated: false,
      summary:
        "还没有更新产品资料。请补充公司名称、产品/服务名称、产品介绍、核心卖点等信息后再让我保存。",
    };
  }

  const currentProfile = await getProductProfile(context.tenantId);
  const nextProfile = { ...currentProfile, ...input };
  await updateProductProfile(context.tenantId, nextProfile);

  const updatedProfile = await getProductProfile(context.tenantId);
  return {
    profile: updatedProfile,
    summary: "产品资料已更新，后续邮件生成、客户调研和活动推荐会使用这份资料。",
  };
}

export const productProfileTools: AgentTool[] = [
  {
    name: "pitchflow.product_profile.get",
    toolkit: "pitchflow.product_profile",
    description: "读取当前租户的产品资料并指出缺失项。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint: "无参数",
    schema: z.object({}),
    execute: getProductProfileTool,
  },
  {
    name: "pitchflow.product_profile.upsert",
    toolkit: "pitchflow.product_profile",
    description: "创建或更新当前租户的产品资料，支持公司名称、产品名称、产品描述、核心卖点、发件人姓名和职位。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "pro",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    inputHint:
      "可填字段：companyName 公司名称、productName 产品名称、productDescription 产品描述、valueProposition 核心卖点、senderName 发件人姓名、senderTitle 发件人职位。",
    schema: productProfileInputSchema,
    execute: upsertProductProfileTool,
  },
];
