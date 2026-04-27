import { z } from "zod";
import { listTemplates } from "@/lib/services/template.service";
import { truncateText } from "@/lib/agent/toolkits/pitchflow/format";
import type { AgentTool } from "@/lib/agent/types";

async function listTemplatesTool(context: Parameters<AgentTool["execute"]>[0]) {
  const templates = await listTemplates(context.tenantId, 1, 10);
  const defaultTemplate = templates.items.find((template) => template.isDefault);

  return {
    templates: templates.items.map((template) => ({
      id: template.id,
      name: template.name,
      subject: truncateText(template.subject, 80),
      angle: template.angle,
      isDefault: template.isDefault,
    })),
    summary:
      templates.total > 0
        ? `当前有 ${templates.total} 个邮件策略模板，默认模板是 ${defaultTemplate?.name || "未设置"}。`
        : "当前还没有邮件模板；活动仍可使用后台邮件 Prompt 自动生成。",
  };
}

export const templateTools: AgentTool[] = [
  {
    name: "pitchflow.template.list",
    toolkit: "pitchflow.template",
    description: "查看邮件模板列表和默认模板状态。",
    riskLevel: "low",
    requiredRole: "member",
    requiredPlan: "free",
    creditCost: 1,
    allowedChannels: ["web", "feishu", "wecom", "api"],
    schema: z.object({}),
    execute: listTemplatesTool,
  },
];
