import { db } from "@/lib/db";
import { tenants, prospects, emails, campaigns, emailTemplates } from "@/lib/db/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { PLAN_LIMITS, type Plan } from "@/lib/constants/plans";

export async function getTenantPlan(tenantId: string): Promise<Plan> {
  const [tenant] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return (tenant?.plan as Plan) || "free";
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getMonthlyProspectCount(tenantId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(prospects)
    .where(
      and(
        eq(prospects.tenantId, tenantId),
        gte(prospects.createdAt, monthStart())
      )
    );
  return Number(total);
}

export async function getMonthlyEmailCount(tenantId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(emails)
    .innerJoin(campaigns, eq(emails.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.tenantId, tenantId),
        gte(emails.createdAt, monthStart())
      )
    );
  return Number(total);
}

export async function getCampaignCount(tenantId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(campaigns)
    .where(eq(campaigns.tenantId, tenantId));
  return Number(total);
}

export async function getTemplateCount(tenantId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId));
  return Number(total);
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  plan: Plan;
  message?: string;
}

export async function checkProspectQuota(tenantId: string, addCount: number = 1): Promise<QuotaCheck> {
  const plan = await getTenantPlan(tenantId);
  const limit = PLAN_LIMITS[plan].prospectsPerMonth;
  const used = await getMonthlyProspectCount(tenantId);
  return {
    allowed: used + addCount <= limit,
    used,
    limit,
    plan,
    message: used + addCount > limit
      ? `本月客户挖掘额度已用完（${used}/${limit}），请升级套餐`
      : undefined,
  };
}

export async function checkEmailQuota(tenantId: string, addCount: number = 1): Promise<QuotaCheck> {
  const plan = await getTenantPlan(tenantId);
  const limit = PLAN_LIMITS[plan].emailsPerMonth;
  const used = await getMonthlyEmailCount(tenantId);
  return {
    allowed: used + addCount <= limit,
    used,
    limit,
    plan,
    message: used + addCount > limit
      ? `本月邮件发送额度已用完（${used}/${limit}），请升级套餐`
      : undefined,
  };
}

export async function checkCampaignQuota(tenantId: string): Promise<QuotaCheck> {
  const plan = await getTenantPlan(tenantId);
  const limit = PLAN_LIMITS[plan].campaigns;
  const used = await getCampaignCount(tenantId);
  return {
    allowed: used < limit,
    used,
    limit,
    plan,
    message: used >= limit
      ? `活动数量已达上限（${used}/${limit}），请升级套餐`
      : undefined,
  };
}

export async function checkTemplateQuota(tenantId: string): Promise<QuotaCheck> {
  const plan = await getTenantPlan(tenantId);
  const limit = PLAN_LIMITS[plan].templates;
  const used = await getTemplateCount(tenantId);
  return {
    allowed: used < limit,
    used,
    limit,
    plan,
    message: used >= limit
      ? `模板数量已达上限（${used}/${limit}），请升级套餐`
      : undefined,
  };
}
