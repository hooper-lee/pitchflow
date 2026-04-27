import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, emailReplies } from "@/lib/db/schema";
import { truncateText } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

const emailReplyListSchema = z.object({
  campaignId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

function summarizeReplyBody(body: string | null) {
  return truncateText(body?.replace(/\s+/g, " ").trim(), 160);
}

async function listEmailRepliesTool(
  context: Parameters<AgentTool["execute"]>[0],
  rawInput: Record<string, unknown>
) {
  const input = emailReplyListSchema.parse(rawInput);
  const conditions = [eq(campaigns.tenantId, context.tenantId)];
  if (input.campaignId) conditions.push(eq(emailReplies.campaignId, input.campaignId));

  const replies = await db
    .select({
      id: emailReplies.id,
      campaignName: campaigns.name,
      fromEmail: emailReplies.fromEmail,
      fromName: emailReplies.fromName,
      subject: emailReplies.subject,
      textBody: emailReplies.textBody,
      receivedAt: emailReplies.receivedAt,
    })
    .from(emailReplies)
    .innerJoin(campaigns, eq(emailReplies.campaignId, campaigns.id))
    .where(and(...conditions))
    .orderBy(desc(emailReplies.receivedAt))
    .limit(input.limit);

  return {
    replies: replies.map((reply) => ({
      id: reply.id,
      campaignName: reply.campaignName,
      from: reply.fromName || reply.fromEmail,
      subject: reply.subject,
      summary: summarizeReplyBody(reply.textBody),
      receivedAt: reply.receivedAt,
    })),
    summary:
      replies.length > 0
        ? `最近有 ${replies.length} 条客户回复，建议优先处理最新和高意向回复。`
        : "当前没有找到客户回复。",
  };
}

export const emailReplyTools: AgentTool[] = [
  {
    name: "pitchflow.email_reply.list",
    toolkit: "pitchflow.email_reply",
    description: "查看并总结最近客户邮件回复。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: emailReplyListSchema,
    execute: listEmailRepliesTool,
  },
];
