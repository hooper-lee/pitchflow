import { listAgentTools } from "@/lib/agent/tool-registry";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    const tools = listAgentTools().map((tool) => ({
      name: tool.name,
      toolkit: tool.toolkit,
      description: tool.description,
      riskLevel: tool.riskLevel,
      requiredRole: tool.requiredRole,
      requiredPlan: tool.requiredPlan,
      creditCost: tool.creditCost,
      allowedChannels: tool.allowedChannels,
    }));

    return apiResponse({ tools });
  } catch (error) {
    return handleApiError(error);
  }
}
