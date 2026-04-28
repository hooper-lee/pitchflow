"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentRunRow {
  id: string;
  status: string;
  intent: string | null;
  channel: string;
  createdAt: string;
}

interface AgentToolCallRow {
  id: string;
  toolName: string;
  status: string;
  riskLevel: string;
  createdAt: string;
}
interface AgentUsageRow {
  id: string;
  usageType: string;
  credits: number;
  toolCalls: number;
  createdAt: string;
}

export default function AdminAgentRunsPage() {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [toolCalls, setToolCalls] = useState<AgentToolCallRow[]>([]);
  const [usage, setUsage] = useState<AgentUsageRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/agent-runs")
      .then((response) => response.json())
      .then((body) => {
        setRuns(body.data?.runs || []);
        setToolCalls(body.data?.toolCalls || []);
        setUsage(body.data?.usage || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent 运行监控</h1>
        <p className="text-muted-foreground">查看最近 Agent Runs 和 Tool Calls。</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>最近 Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{run.intent || "unknown"}</span>
                  <Badge variant="outline">{run.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.channel} · {new Date(run.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>最近 Tool Calls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {toolCalls.map((toolCall) => (
              <div key={toolCall.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{toolCall.toolName}</span>
                  <Badge variant={toolCall.riskLevel === "high" ? "destructive" : "secondary"}>
                    {toolCall.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {toolCall.riskLevel} · {new Date(toolCall.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>最近 Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {usage.map((usageRecord) => (
              <div key={usageRecord.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{usageRecord.usageType}</span>
                  <Badge variant="outline">{usageRecord.credits} credits</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tool calls {usageRecord.toolCalls} · {new Date(usageRecord.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
