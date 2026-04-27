export type McpGatewayStatus = {
  enabled: boolean;
  reason: string;
};

export function getMcpGatewayStatus(): McpGatewayStatus {
  return {
    enabled: false,
    reason: "MCP Gateway 仅预留接口，第一版不开放完整外部工具调用。",
  };
}
