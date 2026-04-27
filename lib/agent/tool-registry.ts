import type { AgentTool } from "@/lib/agent/types";
import { campaignTools } from "@/lib/agent/toolkits/pitchflow/campaign.tools";
import { discoveryTools } from "@/lib/agent/toolkits/pitchflow/discovery.tools";
import { emailReplyTools } from "@/lib/agent/toolkits/pitchflow/email-reply.tools";
import { icpTools } from "@/lib/agent/toolkits/pitchflow/icp.tools";
import { mailAccountTools } from "@/lib/agent/toolkits/pitchflow/mail-account.tools";
import { productProfileTools } from "@/lib/agent/toolkits/pitchflow/product-profile.tools";
import { prospectTools } from "@/lib/agent/toolkits/pitchflow/prospect.tools";
import { pitchflowSetupTools } from "@/lib/agent/toolkits/pitchflow/setup.tools";
import { templateTools } from "@/lib/agent/toolkits/pitchflow/template.tools";
import { pitchflowWriteTools } from "@/lib/agent/toolkits/pitchflow/write.tools";

const registeredTools: AgentTool[] = [
  ...pitchflowSetupTools,
  ...productProfileTools,
  ...mailAccountTools,
  ...icpTools,
  ...templateTools,
  ...prospectTools,
  ...discoveryTools,
  ...campaignTools,
  ...emailReplyTools,
  ...pitchflowWriteTools,
];

export function listAgentTools() {
  return registeredTools;
}

export function getAgentTool(toolName: string): AgentTool | null {
  return registeredTools.find((tool) => tool.name === toolName) || null;
}
