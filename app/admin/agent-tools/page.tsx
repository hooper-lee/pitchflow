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
interface AgentPlanPolicyRow {
  plan: string;
  monthlyCredits: number;
  contextMessageLimit: number;
  allowedChannels: string[];
  allowWriteTools: boolean;
  allowAutoTasks: boolean;
  allowMcp: boolean;
}

export default function AdminAgentToolsPage() {
  const [tools, setTools] = useState<AgentToolRow[]>([]);
  const [planPolicies, setPlanPolicies] = useState<AgentPlanPolicyRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/agent-tools")
      .then((response) => response.json())
      .then((body) => {
        setTools(body.data?.tools || []);
        setPlanPolicies(Object.values(body.data?.planPolicies || {}));
      })
      .catch(() => {
        setTools([]);
        setPlanPolicies([]);
      });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent 工具权限</h1>
        <p className="text-muted-foreground">查看内置 Toolkit、风险等级、套餐和渠道限制。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>套餐策略</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {planPolicies.map((policy) => (
            <div key={policy.plan} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium capitalize">{policy.plan}</span>
                <Badge variant={policy.allowWriteTools ? "secondary" : "outline"}>
                  {policy.allowWriteTools ? "write" : "read-only"}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Credits {policy.monthlyCredits} · Context {policy.contextMessageLimit}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Channels: {policy.allowedChannels.join(", ")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                AutoTasks: {String(policy.allowAutoTasks)} · MCP: {String(policy.allowMcp)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
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
