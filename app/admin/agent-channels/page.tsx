"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelBindingRow {
  id: string;
  channel: string;
  externalUserId: string;
  isActive: boolean;
  createdAt: string;
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
                <span className="font-medium">{binding.externalUserId}</span>
                <Badge variant={binding.isActive ? "secondary" : "outline"}>
                  {binding.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {binding.channel} · {new Date(binding.createdAt).toLocaleString()}
              </p>
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
