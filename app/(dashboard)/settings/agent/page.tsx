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

type SafeChannelConfig = {
  id: string;
  channel: "feishu" | "wecom";
  name: string;
  appId: string;
  appSecretMasked: string;
  isEnabled: boolean;
};

const defaultAgentName = "Hemera Agent";
const feishuSetupSteps = [
  {
    title: "1. 团队管理员配置飞书机器人",
    description: "填写 App ID 和 App Secret，PitchFlow worker 会用长连接接收飞书事件。",
  },
  {
    title: "2. 飞书后台选择长连接订阅事件",
    description: "在飞书开放平台的事件与回调里选择长连接模式，不需要填写公网回调 URL。",
  },
  {
    title: "3. 成员绑定个人飞书账号",
    description: "成员生成绑定码，在机器人私聊里发送 bind + 绑定码，用于匹配 PitchFlow 用户权限和审计记录。",
  },
];

export default function AgentSettingsPage() {
  const { toast } = useToast();
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentName, setAgentName] = useState(defaultAgentName);
  const [bindingCode, setBindingCode] = useState("");
  const [feishuConfig, setFeishuConfig] = useState<SafeChannelConfig | null>(null);
  const [feishuForm, setFeishuForm] = useState({
    name: "飞书机器人",
    appId: "",
    appSecret: "",
    isEnabled: false,
  });
  const [saving, setSaving] = useState(false);

  async function loadAgentStatus() {
    const response = await fetch("/api/agent/status");
    const body = await response.json();
    const status = body.data as AgentStatus;
    setAgentStatus(status);
    setAgentName(status.agent?.name || defaultAgentName);
  }

  async function loadChannelConfigs() {
    const response = await fetch("/api/agent/channels");
    const body = await response.json();
    const config = body.data?.feishu as SafeChannelConfig | null;
    setFeishuConfig(config);
    setFeishuForm((currentForm) => ({
      ...currentForm,
      name: config?.name || currentForm.name,
      appId: config?.appId || "",
      appSecret: "",
      isEnabled: Boolean(config?.isEnabled),
    }));
  }

  useEffect(() => {
    Promise.all([loadAgentStatus(), loadChannelConfigs()]).catch(() => {
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

  async function createFeishuBindingCode() {
    setSaving(true);
    try {
      const response = await fetch("/api/agent/channel-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "feishu" }),
      });
      if (!response.ok) throw new Error("生成绑定码失败");
      const body = await response.json();
      setBindingCode(body.data?.bindingCode || "");
      toast({ title: "绑定码已生成，15 分钟内有效" });
    } catch {
      toast({ title: "生成绑定码失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveFeishuConfig() {
    setSaving(true);
    try {
      const response = await fetch("/api/agent/channels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "feishu", ...feishuForm }),
      });
      if (!response.ok) throw new Error("保存飞书配置失败");
      await loadChannelConfigs();
      toast({ title: "飞书机器人配置已保存" });
    } catch {
      toast({ title: "保存飞书配置失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const canManage = Boolean(agentStatus?.canManage);
  const enabled = Boolean(agentStatus?.enabled);
  const feishuReady = Boolean(feishuConfig?.isEnabled && feishuConfig.appId && feishuConfig.appSecretMasked);

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
          <CardTitle>飞书接入</CardTitle>
          <CardDescription>
            一个团队只需要配置一次飞书机器人；PitchFlow 通过飞书长连接接收消息，成员再绑定自己的飞书账号。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            {feishuSetupSteps.map((step) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="font-medium">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">团队飞书机器人配置</p>
                <p className="text-sm text-muted-foreground">
                  需要团队管理员配置。当前使用飞书长连接，不需要配置事件订阅 URL 或 Signing Secret。
                </p>
              </div>
              <Badge variant={feishuReady ? "secondary" : "outline"}>
                {feishuReady ? "已就绪" : "待配置"}
              </Badge>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feishuName">机器人名称</Label>
              <Input
                id="feishuName"
                value={feishuForm.name}
                disabled={!canManage || saving}
                onChange={(event) => setFeishuForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feishuAppId">App ID</Label>
              <Input
                id="feishuAppId"
                value={feishuForm.appId}
                disabled={!canManage || saving}
                onChange={(event) => setFeishuForm((form) => ({ ...form, appId: event.target.value }))}
                placeholder="cli_xxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feishuAppSecret">App Secret</Label>
              <Input
                id="feishuAppSecret"
                type="password"
                value={feishuForm.appSecret}
                disabled={!canManage || saving}
                onChange={(event) => setFeishuForm((form) => ({ ...form, appSecret: event.target.value }))}
                placeholder={feishuConfig?.appSecretMasked || "保存后不再明文展示"}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="font-medium">启用飞书私聊入口</p>
              <p className="text-sm text-muted-foreground">
                启用后，worker 会通过飞书长连接接收消息并进入当前团队的 Hemera Agent。
              </p>
            </div>
            <Switch
              checked={feishuForm.isEnabled}
              disabled={!canManage || saving}
              onCheckedChange={(checked) => setFeishuForm((form) => ({ ...form, isEnabled: checked }))}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-6 text-muted-foreground">
            飞书后台操作指引：进入应用的「事件与回调」，订阅方式选择「使用长连接接收事件」，
            然后添加「接收消息」事件。PitchFlow 不再要求用户填写公网回调 URL。
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={!canManage || saving} onClick={() => void saveFeishuConfig()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存飞书配置
            </Button>
          </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4">
              <p className="font-medium">个人飞书账号绑定</p>
              <p className="text-sm text-muted-foreground">
                私聊 Agent 入口需要 Business 或更高套餐。成员绑定后，系统才能识别操作人、权限和审计归属。
              </p>
            </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={saving || !enabled || !feishuReady}
              onClick={() => void createFeishuBindingCode()}
            >
              生成飞书绑定码
            </Button>
          </div>
          {!feishuReady ? (
            <p className="text-sm text-muted-foreground">
              需要先保存并启用飞书机器人配置，再生成飞书绑定码。
            </p>
          ) : null}
          {bindingCode ? (
            <div className="space-y-2">
              <Label>私聊机器人发送以下内容</Label>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm break-all">
                bind {bindingCode}
              </div>
              <p className="text-xs text-muted-foreground">
                当前绑定渠道：飞书，有效期 15 分钟。
              </p>
            </div>
          ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
