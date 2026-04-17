import { PLAN_LIMITS, type Plan } from "@/lib/constants/plans";

export function getQuotaLimit(plan: Plan, resource: "prospectsPerMonth" | "emailsPerMonth" | "campaigns" | "teamMembers") {
  return PLAN_LIMITS[plan][resource];
}

export function formatQuotaUsage(used: number, limit: number): string {
  if (limit === Infinity) return `${used} / 无限`;
  return `${used} / ${limit}`;
}

export function quotaPercentage(used: number, limit: number): number {
  if (limit === Infinity || limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

export function isQuotaWarning(used: number, limit: number): boolean {
  if (limit === Infinity) return false;
  return used / limit >= 0.8;
}

export function isQuotaExceeded(used: number, limit: number): boolean {
  if (limit === Infinity) return false;
  return used >= limit;
}
