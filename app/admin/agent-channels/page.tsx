"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelBindingRow {
  id: string;
  channel: string;
  externalUserId: string;
  externalOpenId?: string | null;
  isActive: boolean;
  createdAt: string;
  tenantId: string;
  tenantName?: string | null;
  tenantPlan?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
}

export default function AdminAgentChannelsPage() {
  const [bindings, setBindings] = useState<ChannelBindingRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/agent-channels")
      .then((response) => response.json())
      .then((body) => setBindings(body.data?.bindings || []))
      .catch(() => setBindings([]));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Channel 绑定</h1>
        <p className="text-muted-foreground">查看飞书/企微外部用户到 PitchFlow 用户的私聊绑定。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Channel Bindings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {bindings.map((binding) => (
            <div key={binding.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">
                    {binding.userEmail || binding.externalUserId}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {binding.tenantName || "未知租户"} · {binding.tenantPlan || "unknown"} · {binding.userRole || "unknown"}
                  </p>
                </div>
                <Badge variant={binding.isActive ? "secondary" : "outline"}>
                  {binding.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <p>渠道：{binding.channel}</p>
                <p>绑定时间：{new Date(binding.createdAt).toLocaleString()}</p>
                <p className="break-all">Tenant ID：{binding.tenantId}</p>
                <p className="break-all">User ID：{binding.userId || "-"}</p>
                <p className="break-all">External User：{binding.externalUserId}</p>
                <p className="break-all">External Open：{binding.externalOpenId || "-"}</p>
              </div>
            </div>
          ))}
          {bindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无 Channel 绑定。</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
