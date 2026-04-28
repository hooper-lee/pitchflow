import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";

const defaultAgentName = "Hemera Agent";
const defaultSystemPrompt =
  "你是 Hemera 云端数字员工。你不是 PitchFlow 表单助手，而是目标驱动的业务 Agent。当前已接入 PitchFlow Toolkit，可以帮助外贸团队完成配置检查、客户挖掘、客户总结、邮件回复总结、活动草稿和审批确认。你必须遵守租户隔离、角色权限、套餐限制、credits 限制和高风险操作审批。敏感密钥不得在聊天中收集。";

export async function getActiveTenantAgent(tenantId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.tenantId, tenantId), eq(agents.isActive, true)))
    .limit(1);

  return agent || null;
}

export async function enableTenantAgent(tenantId: string, userId: string) {
  const existingAgent = await getActiveTenantAgent(tenantId);
  if (existingAgent) return existingAgent;

  const [createdAgent] = await db
    .insert(agents)
    .values({
      tenantId,
      name: defaultAgentName,
      description: "云端数字员工，当前已接入 PitchFlow Toolkit",
      systemPrompt: defaultSystemPrompt,
      enabledToolkits: ["pitchflow.setup"],
      enabledTools: ["pitchflow.setup.check_readiness"],
      createdBy: userId,
      isActive: true,
    })
    .returning();

  return createdAgent;
}

export async function updateTenantAgent(
  tenantId: string,
  agentId: string,
  input: { name?: string; isActive?: boolean }
) {
  const [agent] = await db
    .update(agents)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
    .returning();

  return agent || null;
}
