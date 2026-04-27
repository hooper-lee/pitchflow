import { z } from "zod";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { prospectResearch, prospects, prospectScores } from "@/lib/db/schema";
import { truncateText } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

const prospectListSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  researchStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  leadGrade: z.enum(["A", "B", "C", "D"]).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

async function listProspectsTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = prospectListSchema.parse(rawInput);
  const filters = [eq(prospects.tenantId, context.tenantId)];

  if (input.search) {
    filters.push(
      or(
        ilike(prospects.companyName, `%${input.search}%`),
        ilike(prospects.contactName, `%${input.search}%`),
        ilike(prospects.email, `%${input.search}%`)
      )!
    );
  }
  if (input.status) filters.push(eq(prospects.status, input.status as typeof prospects.status.enumValues[number]));
  if (input.researchStatus === "pending") {
    filters.push(or(isNull(prospectResearch.status), eq(prospectResearch.status, "pending"))!);
  } else if (input.researchStatus) {
    filters.push(eq(prospectResearch.status, input.researchStatus));
  }
  if (input.leadGrade) filters.push(eq(prospectScores.leadGrade, input.leadGrade));

  const items = await db
    .select({
      id: prospects.id,
      companyName: prospects.companyName,
      email: prospects.email,
      status: prospects.status,
      researchStatus: prospectResearch.status,
      leadGrade: prospectScores.leadGrade,
      overallScore: prospectScores.overallScore,
      aiSummary: prospectResearch.aiSummary,
    })
    .from(prospects)
    .leftJoin(prospectResearch, eq(prospects.id, prospectResearch.prospectId))
    .leftJoin(prospectScores, eq(prospects.id, prospectScores.prospectId))
    .where(and(...filters))
    .orderBy(desc(prospects.createdAt))
    .limit(input.limit);
  const topProspects = items.map((prospect) => ({
    id: prospect.id,
    companyName: prospect.companyName,
    email: prospect.email,
    status: prospect.status,
    researchStatus: prospect.researchStatus,
    leadGrade: prospect.leadGrade,
    overallScore: prospect.overallScore,
    aiSummary: truncateText(prospect.aiSummary, 120),
  }));

  return {
    prospects: topProspects,
    total: topProspects.length,
    summary:
      topProspects.length > 0
        ? `找到 ${topProspects.length} 个客户，已列出最近匹配结果。`
        : "没有找到匹配客户，可以放宽筛选条件或先启动精准挖掘。",
  };
}

export const prospectTools: AgentTool[] = [
  {
    name: "pitchflow.prospect.list",
    toolkit: "pitchflow.prospect",
    description: "查询客户列表并给出简短总结。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: prospectListSchema,
    execute: listProspectsTool,
  },
];
