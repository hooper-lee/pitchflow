"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
interface TenantAgentStatus {
  enabled: boolean;
  canManage: boolean;
  agent: { id: string; name: string } | null;
}

export default function AdminAgentToolsPage() {
  const [tools, setTools] = useState<AgentToolRow[]>([]);
  const [planPolicies, setPlanPolicies] = useState<AgentPlanPolicyRow[]>([]);
  const [agentStatus, setAgentStatus] = useState<TenantAgentStatus | null>(null);
  const [agentStatusError, setAgentStatusError] = useState("");
  const [savingAgentStatus, setSavingAgentStatus] = useState(false);

  async function loadAgentTools() {
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
  }

  async function loadTenantAgentStatus() {
    const response = await fetch("/api/agent/status");
    if (!response.ok) {
      setAgentStatusError("当前后台会话没有租户上下文，不能直接管理团队 Agent。");
      return;
    }
    const body = await response.json();
    setAgentStatus(body.data || null);
    setAgentStatusError("");
  }

  async function toggleTenantAgent(enabled: boolean) {
    setSavingAgentStatus(true);
    try {
      const response = await fetch("/api/agent/status", {
        method: enabled ? "POST" : "DELETE",
      });
      if (!response.ok) throw new Error("切换 Agent 状态失败");
      await loadTenantAgentStatus();
    } finally {
      setSavingAgentStatus(false);
    }
  }

  useEffect(() => {
    void loadAgentTools();
    void loadTenantAgentStatus();
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent 工具权限</h1>
        <p className="text-muted-foreground">查看内置 Toolkit、风险等级、套餐和渠道限制。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>当前团队 Agent 启用闭环</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              {agentStatus?.agent?.name || "Hemera Agent"}
              <Badge className="ml-2" variant={agentStatus?.enabled ? "secondary" : "outline"}>
                {agentStatus?.enabled ? "已启用" : "未启用"}
              </Badge>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {agentStatusError || "team_admin 可以在这里快速启用或停用当前团队的 Agent。普通成员只读。"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!agentStatus?.canManage || agentStatus?.enabled || savingAgentStatus}
              onClick={() => void toggleTenantAgent(true)}
            >
              启用
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!agentStatus?.canManage || !agentStatus?.enabled || savingAgentStatus}
              onClick={() => void toggleTenantAgent(false)}
            >
              停用
            </Button>
          </div>
        </CardContent>
      </Card>
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
