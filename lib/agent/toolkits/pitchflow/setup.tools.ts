import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailTemplates,
  icpProfiles,
  leadDiscoveryJobs,
  mailAccounts,
} from "@/lib/db/schema";
import { getConfig } from "@/lib/services/config.service";
import { getProductProfile } from "@/lib/services/product-profile.service";
import type { AgentContext, AgentTool } from "@/lib/agent/types";

const defaultSearxngUrl = "http://localhost:8888";

type ReadinessCheck = {
  key: string;
  title: string;
  ready: boolean;
  detail: string;
  action: string;
};

function hasMeaningfulText(value: string | undefined) {
  return Boolean(value && value.trim().length >= 2);
}

async function countRows(tableCountQuery: Promise<Array<{ total: number }>>) {
  const [result] = await tableCountQuery;
  return Number(result?.total || 0);
}

async function getReadinessCounts(context: AgentContext) {
  const [mailAccountCount, connectedMailboxCount, icpCount, templateCount, discoveryJobCount] =
    await Promise.all([
      countRows(
        db.select({ total: count() }).from(mailAccounts).where(eq(mailAccounts.tenantId, context.tenantId))
      ),
      countRows(
        db
          .select({ total: count() })
          .from(mailAccounts)
          .where(
            and(eq(mailAccounts.tenantId, context.tenantId), eq(mailAccounts.state, "connected"))
          )
      ),
      countRows(
        db.select({ total: count() }).from(icpProfiles).where(eq(icpProfiles.tenantId, context.tenantId))
      ),
      countRows(
        db
          .select({ total: count() })
          .from(emailTemplates)
          .where(eq(emailTemplates.tenantId, context.tenantId))
      ),
      countRows(
        db
          .select({ total: count() })
          .from(leadDiscoveryJobs)
          .where(eq(leadDiscoveryJobs.tenantId, context.tenantId))
      ),
    ]);

  return { mailAccountCount, connectedMailboxCount, icpCount, templateCount, discoveryJobCount };
}

async function getSystemReadiness() {
  const [aiBaseUrl, aiApiKey, searxngUrl, emailengineUrl, emailengineToken] = await Promise.all([
    getConfig("CUSTOM_AI_BASE_URL"),
    getConfig("CUSTOM_AI_API_KEY"),
    getConfig("SEARXNG_URL"),
    getConfig("EMAILENGINE_URL"),
    getConfig("EMAILENGINE_ACCESS_TOKEN"),
  ]);
  const resolvedSearchUrl = searxngUrl || process.env.SEARXNG_URL || defaultSearxngUrl;
  const resolvedEmailEngineUrl = emailengineUrl || process.env.EMAILENGINE_URL;
  const resolvedEmailEngineToken = emailengineToken || process.env.EMAILENGINE_ACCESS_TOKEN;

  return {
    aiReady: Boolean(aiBaseUrl && aiApiKey),
    searchReady: Boolean(resolvedSearchUrl),
    emailengineReady: Boolean(resolvedEmailEngineUrl && resolvedEmailEngineToken),
  };
}

function buildBusinessChecks(
  productReady: boolean,
  counts: Awaited<ReturnType<typeof getReadinessCounts>>
): ReadinessCheck[] {
  return [
    {
      key: "product_profile",
      title: "产品资料",
      ready: productReady,
      detail: productReady ? "已填写基础产品信息。" : "还缺少产品名称或目标客户描述。",
      action: "到设置里补齐产品资料，AI 才能生成更贴近业务的邮件和调研判断。",
    },
    {
      key: "mailbox",
      title: "发件邮箱",
      ready: counts.connectedMailboxCount > 0,
      detail:
        counts.connectedMailboxCount > 0
          ? `已连接 ${counts.connectedMailboxCount} 个邮箱。`
          : `已有 ${counts.mailAccountCount} 个邮箱记录，但暂无可用连接。`,
      action: "到邮箱设置连接当前注册邮箱对应的邮箱账号。",
    },
    {
      key: "icp_profile",
      title: "ICP 画像",
      ready: counts.icpCount > 0,
      detail: counts.icpCount > 0 ? `已有 ${counts.icpCount} 个 ICP 画像。` : "还没有 ICP 画像。",
      action: "先用自然语言创建一个目标客户画像，再启动精准挖掘。",
    },
    {
      key: "email_template",
      title: "邮件模板",
      ready: counts.templateCount > 0,
      detail:
        counts.templateCount > 0 ? `已有 ${counts.templateCount} 个邮件策略模板。` : "还没有邮件模板。",
      action: "如果暂时没有模板，活动也可以走后台 Prompt 自动生成邮件。",
    },
  ];
}

function buildSystemChecks(
  systemReadiness: Awaited<ReturnType<typeof getSystemReadiness>>
): ReadinessCheck[] {
  return [
    {
      key: "ai_config",
      title: "AI 模型配置",
      ready: systemReadiness.aiReady,
      detail: systemReadiness.aiReady ? "后台 AI 模型配置可用。" : "后台 AI 模型配置不完整。",
      action: "到 admin 系统配置里补齐模型 Base URL 和 API Key。",
    },
    {
      key: "search_config",
      title: "客户挖掘搜索服务",
      ready: systemReadiness.searchReady,
      detail: systemReadiness.searchReady ? "客户挖掘搜索服务可用。" : "客户挖掘搜索服务暂不可用。",
      action: "请联系系统管理员检查客户挖掘搜索服务，普通用户无需自行配置。",
    },
    {
      key: "emailengine_config",
      title: "邮件发送与回复服务",
      ready: systemReadiness.emailengineReady,
      detail: systemReadiness.emailengineReady ? "邮件发送与回复服务可用。" : "邮件发送与回复服务暂不可用。",
      action: "请联系系统管理员检查邮件服务，普通用户只需要连接自己的邮箱账号。",
    },
  ];
}

function buildReadinessChecks(
  productReady: boolean,
  counts: Awaited<ReturnType<typeof getReadinessCounts>>,
  systemReadiness: Awaited<ReturnType<typeof getSystemReadiness>>
): ReadinessCheck[] {
  return [
    ...buildBusinessChecks(productReady, counts),
    ...buildSystemChecks(systemReadiness),
  ];
}

async function checkReadiness(context: AgentContext) {
  const productProfile = await getProductProfile(context.tenantId);
  const [counts, systemReadiness] = await Promise.all([
    getReadinessCounts(context),
    getSystemReadiness(),
  ]);
  const productReady =
    hasMeaningfulText(productProfile.productName) &&
    (hasMeaningfulText(productProfile.productDescription) ||
      hasMeaningfulText(productProfile.valueProposition));
  const checks = buildReadinessChecks(productReady, counts, systemReadiness);
  const missingItems = checks.filter((check) => !check.ready);

  return {
    ready: missingItems.length === 0,
    checks,
    missingItems: missingItems.map((item) => ({
      title: item.title,
      action: item.action,
    })),
    summary:
      missingItems.length === 0
        ? "当前账号已具备启动获客流程的基础条件。"
        : `还有 ${missingItems.length} 项需要补齐，建议先处理后再启动正式活动。`,
  };
}

export const pitchflowSetupTools: AgentTool[] = [
  {
    name: "pitchflow.setup.check_readiness",
    toolkit: "pitchflow.setup",
    description: "检查租户是否具备启动获客流程的基础条件。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: z.object({}),
    execute: checkReadiness,
  },
];
