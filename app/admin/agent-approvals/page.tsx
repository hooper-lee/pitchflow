"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApprovalRow {
  id: string;
  toolName: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export default function AdminAgentApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/agent-approvals")
      .then((response) => response.json())
      .then((body) => setApprovals(body.data?.approvals || []))
      .catch(() => setApprovals([]));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent 审批</h1>
        <p className="text-muted-foreground">高风险操作会进入审批队列，确认后才允许执行。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>审批记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{approval.toolName}</span>
                <Badge variant={approval.status === "pending" ? "secondary" : "outline"}>
                  {approval.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{approval.reason || "无原因"}</p>
              <p className="mt-2 text-xs text-slate-500">
                {new Date(approval.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
