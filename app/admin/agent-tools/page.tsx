"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentToolRow {
  name: string;
  toolkit: string;
  description: string;
  riskLevel: string;
  requiredRole: string;
  requiredPlan: string;
  creditCost: number;
  allowedChannels: string[];
}

export default function AdminAgentToolsPage() {
  const [tools, setTools] = useState<AgentToolRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/agent-tools")
      .then((response) => response.json())
      .then((body) => setTools(body.data?.tools || []))
      .catch(() => setTools([]));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent 工具权限</h1>
        <p className="text-muted-foreground">查看内置 Toolkit、风险等级、套餐和渠道限制。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>工具列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tools.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tool.name}</span>
                <Badge variant={tool.riskLevel === "high" ? "destructive" : "secondary"}>
                  {tool.riskLevel}
                </Badge>
                <Badge variant="outline">{tool.requiredPlan}</Badge>
                <Badge variant="outline">{tool.requiredRole}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tool.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Channels: {tool.allowedChannels.join(", ")} · Credits: {tool.creditCost}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
