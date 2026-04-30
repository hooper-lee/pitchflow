"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type AgentStatus = {
  agent: { id: string; name: string; isActive: boolean } | null;
  enabled: boolean;
  canManage: boolean;
};

const defaultAgentName = "Hemera Agent";

export default function AgentSettingsPage() {
  const { toast } = useToast();
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentName, setAgentName] = useState(defaultAgentName);
  const [bindingCode, setBindingCode] = useState("");
  const [bindingChannel, setBindingChannel] = useState<"feishu" | "wecom">("feishu");
  const [saving, setSaving] = useState(false);

  async function loadAgentStatus() {
    const response = await fetch("/api/agent/status");
    const body = await response.json();
    const status = body.data as AgentStatus;
    setAgentStatus(status);
    setAgentName(status.agent?.name || defaultAgentName);
  }

  useEffect(() => {
    loadAgentStatus().catch(() => {
      toast({ title: "读取数字员工状态失败", variant: "destructive" });
    });
  }, [toast]);

  async function enableAgent() {
    setSaving(true);
    try {
      const response = await fetch("/api/agent/status", { method: "POST" });
      if (!response.ok) throw new Error("启用失败");
      await loadAgentStatus();
      toast({ title: "Hemera Agent 已启用" });
    } catch {
      toast({ title: "启用失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function updateAgent(nextValues: { name?: string; isActive?: boolean }) {
    if (!agentStatus?.agent) return;

    setSaving(true);
    try {
      const response = await fetch("/api/agent/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentStatus.agent.id, ...nextValues }),
      });
      if (!response.ok) throw new Error("保存失败");
      await loadAgentStatus();
      toast({ title: "数字员工设置已更新" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function disableAgent() {
    setSaving(true);
    try {
      const response = await fetch("/api/agent/status", { method: "DELETE" });
      if (!response.ok) throw new Error("停用失败");
      await loadAgentStatus();
      toast({ title: "Hemera Agent 已停用" });
    } catch {
      toast({ title: "停用失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function createBindingCode(channel: "feishu" | "wecom") {
    setSaving(true);
    try {
      const response = await fetch("/api/agent/channel-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!response.ok) throw new Error("生成绑定码失败");
      const body = await response.json();
      setBindingChannel(channel);
      setBindingCode(body.data?.bindingCode || "");
      toast({ title: "绑定码已生成，15 分钟内有效" });
    } catch {
      toast({ title: "生成绑定码失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const canManage = Boolean(agentStatus?.canManage);
  const enabled = Boolean(agentStatus?.enabled);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">数字员工设置</h1>
          <p className="text-muted-foreground">启用或停用团队的 Hemera Agent。</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Hemera Agent</CardTitle>
                <CardDescription>团队级云端数字员工，当前接入 PitchFlow Toolkit。</CardDescription>
              </div>
            </div>
            <Badge variant={enabled ? "secondary" : "outline"}>
              {enabled ? "已启用" : "未启用"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-muted-foreground">
            普通成员可以使用已启用的 Agent。启用、停用和改名需要团队管理员权限。
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentName">数字员工名称</Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              disabled={!canManage || !enabled || saving}
              placeholder={defaultAgentName}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="font-medium">启用数字员工</p>
              <p className="text-sm text-muted-foreground">
                停用后，成员聊天会提示团队尚未启用 Hemera Agent。
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={!canManage || saving}
              onCheckedChange={(checked) => {
                if (checked) void enableAgent();
                else void disableAgent();
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadAgentStatus()}
              disabled={saving}
            >
              重新加载
            </Button>
            <Button
              type="button"
              disabled={!canManage || !enabled || saving || !agentName.trim()}
              onClick={() => void updateAgent({ name: agentName.trim() })}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存名称
            </Button>
          </div>

          {!canManage ? (
            <p className="text-sm text-muted-foreground">
              当前账号不是团队管理员，只能查看数字员工状态。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>飞书 / 企业微信私聊绑定</CardTitle>
          <CardDescription>
            生成绑定码后，在对应机器人私聊里发送 bind + 绑定码，即可把外部账号绑定到当前 PitchFlow 用户。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-muted-foreground">
            私聊 Agent 入口需要 Business 或更高套餐。群聊当前只做通知，不允许执行写操作。
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={bindingChannel === "feishu" ? "default" : "outline"}
              disabled={!canManage || saving}
              onClick={() => void createBindingCode("feishu")}
            >
              生成飞书绑定码
            </Button>
            <Button
              type="button"
              variant={bindingChannel === "wecom" ? "default" : "outline"}
              disabled={!canManage || saving}
              onClick={() => void createBindingCode("wecom")}
            >
              生成企微绑定码
            </Button>
          </div>
          {bindingCode ? (
            <div className="space-y-2">
              <Label>私聊机器人发送以下内容</Label>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm break-all">
                bind {bindingCode}
              </div>
              <p className="text-xs text-muted-foreground">
                当前绑定渠道：{bindingChannel === "feishu" ? "飞书" : "企业微信"}，有效期 15 分钟。
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
