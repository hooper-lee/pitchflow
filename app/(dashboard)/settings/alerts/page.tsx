"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function AlertsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [wecomUrl, setWecomUrl] = useState("");
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [wecomEnabled, setWecomEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/v1/alerts")
      .then((res) => res.json())
      .then((data) => {
        const tracking = data.data?.tracking || data.data?.alerts || {};
        if (tracking.feishu) {
          setFeishuEnabled(tracking.feishu.enabled || false);
          setFeishuUrl(tracking.feishu.url || "");
        }
        if (tracking.wecom) {
          setWecomEnabled(tracking.wecom.enabled || false);
          setWecomUrl(tracking.wecom.url || "");
        }
        if (tracking.email) setEmailEnabled(tracking.email.enabled !== false);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking: {
            email: { enabled: emailEnabled },
            feishu: { enabled: feishuEnabled, url: feishuUrl },
            wecom: { enabled: wecomEnabled, url: wecomUrl },
          },
        }),
      });

      toast({
        title: response.ok ? "消息追踪配置已保存" : "保存失败",
        variant: response.ok ? "default" : "destructive",
      });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">消息追踪配置</h1>
            <p className="page-subtitle">配置客户回复后的邮件、飞书和企业微信消息追踪通知。</p>
          </div>
        </div>
      </div>

      <div className="metric-grid md:grid-cols-3">
        <Card className="section-card">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">邮件追踪</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{emailEnabled ? "开启" : "关闭"}</p>
            <p className="mt-2 text-sm text-slate-500">默认发送到当前登录账号注册邮箱对应的已连接邮箱账号。</p>
          </CardContent>
        </Card>
        <Card className="section-card">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">触发条件</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">客户回复</p>
            <p className="mt-2 text-sm text-slate-500">仅在客户直接回复邮件时推送一条追踪消息。</p>
          </CardContent>
        </Card>
        <Card className="section-card">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">当前账号</p>
            <p className="mt-3 truncate text-lg font-semibold text-slate-900">
              {session?.user?.email || "未获取"}
            </p>
            <p className="mt-2 text-sm text-slate-500">请确保注册邮箱真实可用，否则会影响告警送达。</p>
          </CardContent>
        </Card>
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>追踪规则</CardTitle>
          <CardDescription>消息追踪现在只在客户直接回复邮件时触发，不再依赖点击和打开行为。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-500">
            追踪消息会带上客户、活动、回复主题和回复摘要。邮件通知依赖“设置 &gt; 邮箱账号”里已连接的邮箱；未连接时只能使用飞书或企业微信通知。
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="section-card">
          <CardHeader>
            <CardTitle>邮件追踪</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">邮件通知</p>
              <p className="mt-1 text-sm text-slate-500">通过当前登录账号注册邮箱对应的已连接邮箱账号发送回复追踪消息。</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </CardContent>
        </Card>

        <Card className="section-card">
          <CardHeader>
            <CardTitle>飞书 Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="feishu-enabled">启用飞书通知</Label>
              <Switch
                id="feishu-enabled"
                checked={feishuEnabled}
                onCheckedChange={setFeishuEnabled}
              />
            </div>
            {feishuEnabled && (
              <div className="space-y-2">
                <Label htmlFor="feishu-url">Webhook URL</Label>
                <Input
                  id="feishu-url"
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  value={feishuUrl}
                  onChange={(event) => setFeishuUrl(event.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="section-card">
          <CardHeader>
            <CardTitle>企业微信 Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="wecom-enabled">启用企业微信通知</Label>
              <Switch
                id="wecom-enabled"
                checked={wecomEnabled}
                onCheckedChange={setWecomEnabled}
              />
            </div>
            {wecomEnabled && (
              <div className="space-y-2">
                <Label htmlFor="wecom-url">Webhook URL</Label>
                <Input
                  id="wecom-url"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  value={wecomUrl}
                  onChange={(event) => setWecomUrl(event.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存追踪配置"}
        </Button>
      </div>
    </div>
  );
}
