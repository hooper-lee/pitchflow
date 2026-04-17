"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function AlertsPage() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [wecomUrl, setWecomUrl] = useState("");
  const [feishuEnabled, setFeishuEnabled] = useState(false);
  const [wecomEnabled, setWecomEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to tenant settings
      const settings = {
        alerts: {
          email: { enabled: emailEnabled },
          feishu: { enabled: feishuEnabled, url: feishuUrl },
          wecom: { enabled: wecomEnabled, url: wecomUrl },
        },
      };

      const res = await fetch("/api/v1/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({ title: "告警配置已保存" });
      } else {
        toast({ title: "保存失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">告警配置</h1>
          <p className="text-muted-foreground">配置高意向客户实时告警渠道</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>告警触发条件</CardTitle>
          <CardDescription>
            客户打开邮件 3 次以上、点击链接或直接回复时触发告警
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>邮件告警</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="email-alerts">邮件通知</Label>
            <Switch
              id="email-alerts"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
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
                onChange={(e) => setFeishuUrl(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
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
                onChange={(e) => setWecomUrl(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "保存中..." : "保存配置"}
      </Button>
    </div>
  );
}
