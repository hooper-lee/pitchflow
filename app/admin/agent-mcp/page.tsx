"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface McpStatus {
  enabled: boolean;
  reason: string;
}

export default function AdminAgentMcpPage() {
  const [status, setStatus] = useState<McpStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/agent-mcp")
      .then((response) => response.json())
      .then((body) => setStatus(body.data))
      .catch(() => setStatus(null));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MCP Gateway</h1>
        <p className="text-muted-foreground">外部 MCP 工具网关状态和安全边界。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>当前状态</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={status?.enabled ? "default" : "secondary"}>
            {status?.enabled ? "已启用" : "未开放"}
          </Badge>
          <p className="mt-3 text-sm text-muted-foreground">
            {status?.reason || "正在加载 MCP Gateway 状态。"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
