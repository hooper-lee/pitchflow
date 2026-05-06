import { z } from "zod";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  agentActionApprovals,
  campaignProspects,
  campaigns,
  emailReplies,
  emailTemplates,
  icpProfiles,
  leadDiscoveryCandidates,
  leadDiscoveryJobs,
  mailAccounts,
  prospectResearch,
  prospects,
} from "@/lib/db/schema";
import { getProductProfile } from "@/lib/services/product-profile.service";
import type { AgentContext, AgentTool } from "@/lib/agent/types";

type ActionPriority = "urgent" | "high" | "medium" | "low";

type NextAction = {
  title: string;
  priority: ActionPriority;
  reason: string;
  action: string;
  route?: string;
};

type BusinessSnapshot = {
  product: Awaited<ReturnType<typeof getProductReadiness>>;
  connectedMailboxCount: number;
  icpCount: number;
  templateCount: number;
  prospectCount: number;
  unresearchedProspectCount: number;
  replyCount: number;
  pendingApprovalCount: number;
  discovery: Awaited<ReturnType<typeof getDiscoverySnapshot>>;
  campaign: Awaited<ReturnType<typeof getCampaignSnapshot>>;
};

const nextActionSchema = z.object({});

function hasMeaningfulText(value: string | undefined) {
  return Boolean(value && value.trim().length >= 2);
}

async function countRows(rowCountQuery: Promise<Array<{ total: number }>>) {
  const [rowCount] = await rowCountQuery;
  return Number(rowCount?.total || 0);
}

async function getProductReadiness(tenantId: string) {
  const profile = await getProductProfile(tenantId);
  const ready =
    hasMeaningfulText(profile.productName) &&
    (hasMeaningfulText(profile.productDescription) || hasMeaningfulText(profile.valueProposition));

  return { ready };
}

async function getDiscoverySnapshot(tenantId: string) {
  const [latestJob] = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(eq(leadDiscoveryJobs.tenantId, tenantId))
    .orderBy(desc(leadDiscoveryJobs.createdAt))
    .limit(1);
  const pendingCandidateCount = await countRows(
    db
      .select({ total: count() })
      .from(leadDiscoveryCandidates)
      .where(
        and(
          eq(leadDiscoveryCandidates.tenantId, tenantId),
          inArray(leadDiscoveryCandidates.decision, ["pending", "needs_review"])
        )
      )
  );

  return { latestJob, pendingCandidateCount };
}

async function getCampaignSnapshot(tenantId: string) {
  const [draftCampaign] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      prospectCount: sql<number>`count(${campaignProspects.id})`,
    })
    .from(campaigns)
    .leftJoin(campaignProspects, eq(campaignProspects.campaignId, campaigns.id))
    .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.status, "draft")))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt))
    .limit(1);
  const activeCampaignCount = await countRows(
    db.select({ total: count() }).from(campaigns).where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.status, "active")))
  );

  return { draftCampaign, activeCampaignCount };
}

async function getBusinessCounts(context: AgentContext) {
  const [
    connectedMailboxCount,
    icpCount,
    templateCount,
    prospectCount,
    unresearchedProspectCount,
    replyCount,
    pendingApprovalCount,
  ] = await Promise.all([
    countRows(
      db
        .select({ total: count() })
        .from(mailAccounts)
        .where(and(eq(mailAccounts.tenantId, context.tenantId), eq(mailAccounts.state, "connected")))
    ),
    countRows(
      db.select({ total: count() }).from(icpProfiles).where(eq(icpProfiles.tenantId, context.tenantId))
    ),
    countRows(
      db.select({ total: count() }).from(emailTemplates).where(eq(emailTemplates.tenantId, context.tenantId))
    ),
    countRows(
      db.select({ total: count() }).from(prospects).where(eq(prospects.tenantId, context.tenantId))
    ),
    countRows(
      db
        .select({ total: count() })
        .from(prospects)
        .leftJoin(prospectResearch, eq(prospectResearch.prospectId, prospects.id))
        .where(
          and(
            eq(prospects.tenantId, context.tenantId),
            or(
              isNull(prospectResearch.status),
              eq(prospectResearch.status, "pending"),
              eq(prospectResearch.status, "failed")
            )!
          )
        )
    ),
    countRows(
      db
        .select({ total: count() })
        .from(emailReplies)
        .innerJoin(campaigns, eq(campaigns.id, emailReplies.campaignId))
        .where(eq(campaigns.tenantId, context.tenantId))
    ),
    countRows(
      db
        .select({ total: count() })
        .from(agentActionApprovals)
        .where(
          and(
            eq(agentActionApprovals.tenantId, context.tenantId),
            eq(agentActionApprovals.status, "pending")
          )
        )
    ),
  ]);

  return {
    connectedMailboxCount,
    icpCount,
    templateCount,
    prospectCount,
    unresearchedProspectCount,
    replyCount,
    pendingApprovalCount,
  };
}

async function getBusinessSnapshot(context: AgentContext): Promise<BusinessSnapshot> {
  const [product, counts, discovery, campaign] = await Promise.all([
    getProductReadiness(context.tenantId),
    getBusinessCounts(context),
    getDiscoverySnapshot(context.tenantId),
    getCampaignSnapshot(context.tenantId),
  ]);

  return { product, ...counts, discovery, campaign };
}

function decideUrgentAction(snapshot: BusinessSnapshot): NextAction | null {
  if (snapshot.replyCount > 0) {
    return {
      title: "优先处理客户回复",
      priority: "urgent",
      reason: `当前已有 ${snapshot.replyCount} 条客户回复，这是转化链路里最优先处理的信号。`,
      action: "先查看最近回复，判断是否进入已回复客户推进活动，避免继续发冷启动跟进。",
      route: "/campaigns",
    };
  }
  if (snapshot.pendingApprovalCount > 0) {
    return {
      title: "处理待审批 Agent 操作",
      priority: "urgent",
      reason: `当前有 ${snapshot.pendingApprovalCount} 个操作等待审批，未审批会阻断后续执行。`,
      action: "先到 Agent 审批里确认或拒绝待执行动作。",
      route: "/admin/agent-approvals",
    };
  }
  return null;
}

function decideSetupAction(snapshot: BusinessSnapshot): NextAction | null {
  if (!snapshot.product.ready) {
    return {
      title: "补齐产品资料",
      priority: "high",
      reason: "产品名称、产品描述或价值主张不完整，后续调研、邮件生成和活动推荐都会变泛。",
      action: "先填写公司名称、产品/服务名称、产品介绍和核心卖点。",
      route: "/settings/product-profile",
    };
  }
  if (snapshot.connectedMailboxCount === 0) {
    return {
      title: "连接发件邮箱",
      priority: "high",
      reason: "还没有可用发件邮箱，活动创建后也无法稳定发送和追踪回复。",
      action: "连接当前登录账号注册邮箱对应的邮箱账号。",
      route: "/settings/mailboxes",
    };
  }
  if (snapshot.icpCount === 0) {
    return {
      title: "创建 ICP 画像",
      priority: "high",
      reason: "还没有目标客户画像，精准挖掘无法判断哪些候选客户应该优先入库。",
      action: "用自然语言描述你要找的客户群体，先生成一个可复用 ICP。",
      route: "/prospects/icp-profiles",
    };
  }
  return null;
}

function decideDiscoveryAction(snapshot: BusinessSnapshot): NextAction | null {
  if (!snapshot.discovery.latestJob) {
    return {
      title: "发起精准挖掘任务",
      priority: "high",
      reason: "基础配置已具备，但还没有挖掘任务，客户池还没开始建立。",
      action: "基于 ICP 创建一次精准挖掘，先拿一批候选客户做筛选。",
      route: "/prospects/discovery-jobs/new",
    };
  }
  if (
    ["pending", "searching", "crawling", "filtering", "scoring"].includes(
      snapshot.discovery.latestJob.status
    )
  ) {
    return {
      title: "等待挖掘任务完成",
      priority: "medium",
      reason: `最近任务「${snapshot.discovery.latestJob.name}」仍在 ${snapshot.discovery.latestJob.status}，进度 ${snapshot.discovery.latestJob.progress}%。`,
      action: "先查看任务进度，完成后再审核候选客户。",
      route: `/prospects/discovery-jobs/${snapshot.discovery.latestJob.id}`,
    };
  }
  if (snapshot.discovery.pendingCandidateCount > 0) {
    return {
      title: "审核精准挖掘候选客户",
      priority: "high",
      reason: `当前有 ${snapshot.discovery.pendingCandidateCount} 个候选客户还没处理，入库前需要接受、拒绝或加入黑名单。`,
      action: "优先接受高分候选，再把明显不匹配的网站加入黑名单，提升后续挖掘质量。",
      route: `/prospects/discovery-jobs/${snapshot.discovery.latestJob.id}`,
    };
  }
  return null;
}

function decideProspectAction(snapshot: BusinessSnapshot): NextAction | null {
  if (snapshot.prospectCount === 0) {
    return {
      title: "扩大客户池",
      priority: "medium",
      reason: "当前还没有正式客户入库，无法创建有效开发活动。",
      action: "重新发起挖掘或放宽 ICP 条件，先保证有可触达客户。",
      route: "/prospects/discovery-jobs/new",
    };
  }
  if (snapshot.unresearchedProspectCount > 0) {
    return {
      title: "补齐客户调研评分",
      priority: "medium",
      reason: `当前有 ${snapshot.unresearchedProspectCount} 个客户还没有完成调研评分，活动筛选会缺少依据。`,
      action: "先批量调研客户，再按调研等级筛选进入活动。",
      route: "/prospects",
    };
  }
  if (snapshot.templateCount === 0) {
    return {
      title: "创建邮件策略",
      priority: "medium",
      reason: "还没有邮件策略模板，虽然系统可自动生成，但模板能让冷启动和跟进更稳定。",
      action: "先创建一版冷启动首封邮件策略，再用于活动。",
      route: "/templates/new",
    };
  }
  return null;
}

function decideCampaignAction(snapshot: BusinessSnapshot): NextAction {
  if (snapshot.campaign.draftCampaign) {
    return {
      title: "完善并启动草稿活动",
      priority: "high",
      reason: `草稿活动「${snapshot.campaign.draftCampaign.name}」已有 ${Number(snapshot.campaign.draftCampaign.prospectCount)} 个目标客户。`,
      action: "检查发件邮箱、邮件策略和目标客户后，确认启动活动。",
      route: `/campaigns/${snapshot.campaign.draftCampaign.id}`,
    };
  }
  if (snapshot.campaign.activeCampaignCount > 0) {
    return {
      title: "观察活动表现并处理回复",
      priority: "low",
      reason: `当前有 ${snapshot.campaign.activeCampaignCount} 个进行中的活动。`,
      action: "重点看回复和失败邮件，未回复客户交给系统跟进节奏继续推进。",
      route: "/campaigns",
    };
  }

  return {
    title: "创建开发活动",
    priority: "high",
    reason: "客户池和基础配置已具备，但还没有可执行活动。",
    action: "选择已调研客户创建冷启动活动，先从高等级客户开始发送。",
    route: "/campaigns/new",
  };
}

function decideNextAction(snapshot: BusinessSnapshot): NextAction {
  return (
    decideUrgentAction(snapshot) ||
    decideSetupAction(snapshot) ||
    decideDiscoveryAction(snapshot) ||
    decideProspectAction(snapshot) ||
    decideCampaignAction(snapshot)
  );
}

function buildChecks(snapshot: BusinessSnapshot, nextAction: NextAction) {
  return [
    {
      title: "下一步动作",
      ready: false,
      detail: `${nextAction.title}：${nextAction.reason}`,
      action: nextAction.action,
    },
    {
      title: "当前链路状态",
      ready: true,
      detail: `产品资料 ${snapshot.product.ready ? "已完成" : "待补齐"}，邮箱 ${snapshot.connectedMailboxCount} 个，ICP ${snapshot.icpCount} 个，客户 ${snapshot.prospectCount} 个。`,
      action: "根据下一步动作继续推进。",
    },
  ];
}

async function getNextActionTool(context: AgentContext) {
  const snapshot = await getBusinessSnapshot(context);
  const nextAction = decideNextAction(snapshot);

  return {
    title: nextAction.title,
    priority: nextAction.priority,
    reason: nextAction.reason,
    action: nextAction.action,
    route: nextAction.route,
    checks: buildChecks(snapshot, nextAction),
    snapshot: {
      productReady: snapshot.product.ready,
      connectedMailboxCount: snapshot.connectedMailboxCount,
      icpCount: snapshot.icpCount,
      templateCount: snapshot.templateCount,
      prospectCount: snapshot.prospectCount,
      unresearchedProspectCount: snapshot.unresearchedProspectCount,
      replyCount: snapshot.replyCount,
      pendingCandidateCount: snapshot.discovery.pendingCandidateCount,
      latestDiscoveryStatus: snapshot.discovery.latestJob?.status || null,
      activeCampaignCount: snapshot.campaign.activeCampaignCount,
    },
    summary: `${nextAction.title}。${nextAction.reason} ${nextAction.action}`,
  };
}

export const nextActionTools: AgentTool[] = [
  {
    name: "pitchflow.strategy.next_action",
    toolkit: "pitchflow.strategy",
    description: "读取 PitchFlow 当前业务状态，判断用户此刻最应该推进的下一步动作。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: nextActionSchema,
    execute: getNextActionTool,
  },
];
