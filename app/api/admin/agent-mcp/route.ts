import { getMcpGatewayStatus } from "@/lib/agent/mcp-gateway";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET() {
  try {
    return apiResponse(getMcpGatewayStatus());
  } catch (error) {
    return handleApiError(error);
  }
}
