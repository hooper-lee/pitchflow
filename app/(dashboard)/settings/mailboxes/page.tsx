"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface MailAccount {
  id: string;
  email: string;
  name: string | null;
  state: string;
  isDefault: boolean;
  lastError: string | null;
}

const GMAIL_PRESET = {
  imapHost: "imap.gmail.com",
  imapPort: "993",
  imapSecure: true,
  smtpHost: "smtp.gmail.com",
  smtpPort: "465",
  smtpSecure: true,
};

const OUTLOOK_PRESET = {
  imapHost: "outlook.office365.com",
  imapPort: "993",
  imapSecure: true,
  smtpHost: "smtp.office365.com",
  smtpPort: "587",
  smtpSecure: false,
};

function formatMailboxError(message: string) {
  if (message.includes("BasicAuthBlocked")) {
    return "Outlook / Hotmail 已禁用账号密码直连，请改用 Gmail App Password 测试。";
  }
  if (message.includes("App Password")) return message;
  return message;
}

export default function MailboxesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
    imapUsername: "",
    imapPassword: "",
    smtpHost: "",
    smtpPort: "465",
    smtpSecure: true,
    smtpUsername: "",
    smtpPassword: "",
    isDefault: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const response = await fetch("/api/v1/mail-accounts");
    const data = await response.json();
    setAccounts(data.data || []);
  };

  const updateField = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: typeof GMAIL_PRESET) => {
    setForm((prev) => ({ ...prev, ...preset }));
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/mail-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          imap: {
            host: form.imapHost,
            port: Number(form.imapPort),
            secure: form.imapSecure,
            username: form.imapUsername,
            password: form.imapPassword,
          },
          smtp: {
            host: form.smtpHost,
            port: Number(form.smtpPort),
            secure: form.smtpSecure,
            username: form.smtpUsername,
            password: form.smtpPassword,
          },
          isDefault: form.isDefault,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({
          title: "连接失败",
          description: formatMailboxError(data.error || "请检查邮箱配置"),
          variant: "destructive",
        });
        return;
      }

      toast({ title: "邮箱已连接" });
      setForm({
        name: "",
        email: "",
        imapHost: "",
        imapPort: "993",
        imapSecure: true,
        imapUsername: "",
        imapPassword: "",
        smtpHost: "",
        smtpPort: "465",
        smtpSecure: true,
        smtpUsername: "",
        smtpPassword: "",
        isDefault: true,
      });
      await loadAccounts();
    } catch {
      toast({ title: "连接失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "sync" | "reconnect" | "set_default") => {
    const response = await fetch(`/api/v1/mail-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await response.json();

    if (!response.ok) {
      toast({
        title: "操作失败",
        description: formatMailboxError(data.error || "请稍后重试"),
        variant: "destructive",
      });
      return;
    }

    toast({ title: "操作已执行" });
    await loadAccounts();
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/v1/mail-accounts/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      toast({
        title: "删除失败",
        description: formatMailboxError(data.error || "请稍后重试"),
        variant: "destructive",
      });
      return;
    }

    toast({ title: "邮箱已删除" });
    await loadAccounts();
  };

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">邮箱账号</h1>
            <p className="page-subtitle">连接你自己的 IMAP / SMTP 邮箱，活动发送、回复读取和告警邮件都基于这里的账号。</p>
          </div>
        </div>
      </div>

      <div className="metric-grid md:grid-cols-3">
        <InfoCard title="已连接邮箱" value={String(accounts.length)} description="当前账号可用的发件与收件通道数量。" />
        <InfoCard title="默认发件账号" value={accounts.find((item) => item.isDefault)?.email || "未设置"} description="活动默认优先使用这里的账号发信。" compact />
        <InfoCard title="推荐方式" value="Gmail App Password" description="本地测试更稳定，Outlook 账号密码直连通常会被拦截。" compact />
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>快速预设</CardTitle>
          <CardDescription>先填入常见服务商参数，再补账号和密码。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => applyPreset(GMAIL_PRESET)}>
            Gmail
          </Button>
          <Button type="button" variant="outline" onClick={() => applyPreset(OUTLOOK_PRESET)}>
            Outlook / Office 365
          </Button>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>连接邮箱</CardTitle>
          <CardDescription>建议优先连接与你注册账号同名的邮箱地址，这样活动默认就能直接使用你的注册邮箱发送。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="显示名称">
              <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="如：Sales Team" />
            </Field>
            <Field label="邮箱地址">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="sales@yourdomain.com"
              />
            </Field>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ProtocolCard
              title="IMAP"
              host={form.imapHost}
              port={form.imapPort}
              secure={form.imapSecure}
              username={form.imapUsername}
              password={form.imapPassword}
              onHostChange={(value) => updateField("imapHost", value)}
              onPortChange={(value) => updateField("imapPort", value)}
              onSecureChange={(value) => updateField("imapSecure", value)}
              onUsernameChange={(value) => updateField("imapUsername", value)}
              onPasswordChange={(value) => updateField("imapPassword", value)}
            />
            <ProtocolCard
              title="SMTP"
              host={form.smtpHost}
              port={form.smtpPort}
              secure={form.smtpSecure}
              username={form.smtpUsername}
              password={form.smtpPassword}
              onHostChange={(value) => updateField("smtpHost", value)}
              onPortChange={(value) => updateField("smtpPort", value)}
              onSecureChange={(value) => updateField("smtpSecure", value)}
              onUsernameChange={(value) => updateField("smtpUsername", value)}
              onPasswordChange={(value) => updateField("smtpPassword", value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-slate-900">设为默认邮箱</p>
              <p className="mt-1 text-sm text-slate-500">默认邮箱会优先用于当前账号发起的活动发送。</p>
            </div>
            <Switch checked={form.isDefault} onCheckedChange={(value) => updateField("isDefault", value)} />
          </div>

          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "连接中..." : "连接邮箱"}
          </Button>
        </CardContent>
      </Card>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>已连接邮箱</CardTitle>
          <CardDescription>同步、重连、设为默认都在这里完成。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂未连接邮箱账号</p>
          ) : (
            accounts.map((account) => (
              <div key={account.id} className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{account.name || account.email}</p>
                      {account.isDefault ? (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">默认</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{account.email}</p>
                    <p className="mt-2 text-xs text-slate-400">状态：{account.state}</p>
                    {account.lastError ? (
                      <p className="mt-2 text-xs text-destructive">{formatMailboxError(account.lastError)}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleAction(account.id, "sync")}>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      同步
                    </Button>
                    {!account.isDefault ? (
                      <Button variant="outline" size="sm" onClick={() => handleAction(account.id, "set_default")}>
                        设为默认
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => handleAction(account.id, "reconnect")}>
                      重连
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(account.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: JSX.Element;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ProtocolCard({
  title,
  host,
  port,
  secure,
  username,
  password,
  onHostChange,
  onPortChange,
  onSecureChange,
  onUsernameChange,
  onPasswordChange,
}: {
  title: string;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  onHostChange: (value: string) => void;
  onPortChange: (value: string) => void;
  onSecureChange: (value: boolean) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <Card className="border-slate-200/80 bg-white">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={host} onChange={(event) => onHostChange(event.target.value)} placeholder={`${title.toLowerCase()}.yourdomain.com`} />
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Input value={port} onChange={(event) => onPortChange(event.target.value)} placeholder="993" />
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-3">
            <Switch checked={secure} onCheckedChange={onSecureChange} />
            <span className="text-sm text-muted-foreground">SSL</span>
          </div>
        </div>
        <Input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder={`${title} 用户名`} />
        <Input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={`${title} 密码 / App Password`}
        />
      </CardContent>
    </Card>
  );
}

function InfoCard({
  title,
  value,
  description,
  compact,
}: {
  title: string;
  value: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <Card className="section-card">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <p className={`mt-3 font-semibold text-slate-900 ${compact ? "truncate text-lg" : "text-3xl"}`}>{value}</p>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}
