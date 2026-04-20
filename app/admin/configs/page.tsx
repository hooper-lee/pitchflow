"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, RotateCcw, Sparkles } from "lucide-react";

interface ConfigField {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
  textarea?: boolean;
  rows?: number;
  readonly?: boolean;
}

interface RoutingField {
  key: string;
  label: string;
  dependsOn: string;
}

interface ConfigSection {
  title: string;
  description: string;
  fields: ConfigField[];
  routing?: RoutingField[];
}

const AI_PROMPT_KEYS = {
  PROSPECT_RESEARCH_SYSTEM: "AI_PROMPT_PROSPECT_RESEARCH_SYSTEM",
  PROSPECT_SCORING_SYSTEM: "AI_PROMPT_PROSPECT_SCORING_SYSTEM",
  PROSPECT_RESEARCH_USER: "AI_PROMPT_PROSPECT_RESEARCH_USER",
  PROSPECT_SCORING_USER: "AI_PROMPT_PROSPECT_SCORING_USER",
};

const SCORING_WEIGHT_KEYS = {
  ICP_FIT: "AI_SCORE_WEIGHT_ICP_FIT",
  BUYING_INTENT: "AI_SCORE_WEIGHT_BUYING_INTENT",
  REACHABILITY: "AI_SCORE_WEIGHT_REACHABILITY",
  DEAL_POTENTIAL: "AI_SCORE_WEIGHT_DEAL_POTENTIAL",
  RISK_PENALTY: "AI_SCORE_WEIGHT_RISK_PENALTY",
};

const DEFAULT_SCORING_WEIGHTS = {
  [SCORING_WEIGHT_KEYS.ICP_FIT]: "25",
  [SCORING_WEIGHT_KEYS.BUYING_INTENT]: "25",
  [SCORING_WEIGHT_KEYS.REACHABILITY]: "20",
  [SCORING_WEIGHT_KEYS.DEAL_POTENTIAL]: "20",
  [SCORING_WEIGHT_KEYS.RISK_PENALTY]: "10",
};

const CONFIG_SECTIONS: ConfigSection[] = [
  {
    title: "AI 模型",
    description: "配置 AI 模型的 API Key、Base URL 和模型名称（支持 OpenAI 兼容接口）",
    fields: [
      { key: "CUSTOM_AI_BASE_URL", label: "API Base URL", secret: false, placeholder: "https://api.deepseek.com/v1" },
      { key: "CUSTOM_AI_API_KEY", label: "API Key", secret: true, placeholder: "sk-..." },
      { key: "CUSTOM_AI_MODEL", label: "模型名称", secret: false, placeholder: "deepseek-chat" },
      { key: "AI_SYSTEM_PROMPT", label: "AI System Prompt", secret: false, placeholder: "You are an expert B2B sales copywriter...", textarea: true },
    ],
  },
  {
    title: "邮件服务",
    description: "Resend 邮件发送配置",
    fields: [
      { key: "RESEND_API_KEY", label: "Resend API Key", secret: true, placeholder: "re_..." },
      { key: "RESEND_FROM_EMAIL", label: "发件人邮箱", secret: false, placeholder: "noreply@yourdomain.com" },
    ],
  },
  {
    title: "客户发现",
    description: "邮箱查找和搜索引擎配置",
    fields: [
      { key: "HUNTER_IO_API_KEY", label: "Hunter.io API Key", secret: true, placeholder: "..." },
      { key: "SNOV_CLIENT_ID", label: "Snov.io Client ID", secret: false, placeholder: "..." },
      { key: "SNOV_CLIENT_SECRET", label: "Snov.io Client Secret", secret: true, placeholder: "..." },
      { key: "SEARXNG_URL", label: "搜索引擎地址", secret: false, placeholder: "http://localhost:8888" },
    ],
    routing: [
      { key: "DISCOVERY_PROVIDER_HUNTER", label: "Hunter.io", dependsOn: "HUNTER_IO_API_KEY" },
      { key: "DISCOVERY_PROVIDER_SNOVIO", label: "Snov.io", dependsOn: "SNOV_CLIENT_ID" },
    ],
  },
  {
    title: "告警通知",
    description: "飞书和企业微信 Webhook",
    fields: [
      { key: "FEISHU_WEBHOOK_URL", label: "飞书 Webhook URL", secret: false, placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/..." },
      { key: "WECOM_WEBHOOK_URL", label: "企业微信 Webhook URL", secret: false, placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." },
    ],
  },
  {
    title: "支付",
    description: "Stripe 支付配置",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key", secret: true, placeholder: "sk_..." },
      { key: "STRIPE_PUBLISHABLE_KEY", label: "Stripe Publishable Key", secret: false, placeholder: "pk_..." },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe Webhook Secret", secret: true, placeholder: "whsec_..." },
      { key: "STRIPE_PRO_PRICE_ID", label: "Pro 套餐 Price ID", secret: false, placeholder: "price_..." },
    ],
  },
  {
    title: "其他",
    description: "Redis、Cron 等基础设施配置（仅查看，不可修改）",
    fields: [
      { key: "REDIS_URL", label: "Redis URL", secret: false, placeholder: "redis://localhost:6379", readonly: true },
      { key: "CRON_SECRET", label: "Cron Secret", secret: true, placeholder: "...", readonly: true },
    ],
  },
];

const AI_PROMPT_SECTION: ConfigSection = {
  title: "AI 调研 & 评分提示词",
  description: "配置 AI 进行客户调研和评分时使用的提示词，修改后实时生效",
  fields: [
    {
      key: AI_PROMPT_KEYS.PROSPECT_RESEARCH_SYSTEM,
      label: "调研系统提示词",
      secret: false,
      placeholder: "You are a B2B business intelligence analyst...",
      textarea: true,
      rows: 6,
    },
    {
      key: AI_PROMPT_KEYS.PROSPECT_RESEARCH_USER,
      label: "调研用户提示词模板",
      secret: false,
      placeholder: "Analyze the following company...",
      textarea: true,
      rows: 10,
    },
    {
      key: AI_PROMPT_KEYS.PROSPECT_SCORING_SYSTEM,
      label: "评分系统提示词",
      secret: false,
      placeholder: "You are a B2B sales lead scoring expert...",
      textarea: true,
      rows: 6,
    },
    {
      key: AI_PROMPT_KEYS.PROSPECT_SCORING_USER,
      label: "评分用户提示词模板",
      secret: false,
      placeholder: "Evaluate this prospect and score them...",
      textarea: true,
      rows: 10,
    },
  ],
};

const SCORING_WEIGHT_SECTION: ConfigSection = {
  title: "客户评分权重",
  description: "配置综合评分中 5 个维度的权重，建议总和为 100",
  fields: [
    { key: SCORING_WEIGHT_KEYS.ICP_FIT, label: "ICP 匹配度", secret: false, placeholder: "25" },
    { key: SCORING_WEIGHT_KEYS.BUYING_INTENT, label: "采购意向", secret: false, placeholder: "25" },
    { key: SCORING_WEIGHT_KEYS.REACHABILITY, label: "可触达性", secret: false, placeholder: "20" },
    { key: SCORING_WEIGHT_KEYS.DEAL_POTENTIAL, label: "成交潜力", secret: false, placeholder: "20" },
    { key: SCORING_WEIGHT_KEYS.RISK_PENALTY, label: "风险评估", secret: false, placeholder: "10" },
  ],
};

export default function AdminConfigsPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/configs").then((r) => r.json()),
      fetch("/api/admin/ai-prompts").then((r) => r.json()),
    ])
      .then(([configsData, promptsData]) => {
        const map: Record<string, string> = { ...DEFAULT_SCORING_WEIGHTS };
        for (const c of configsData.data || []) {
          map[c.key] = c.value;
        }
        for (const [key, value] of Object.entries(promptsData.data || {})) {
          if (value && typeof value === "object" && "value" in value) {
            map[key] = String(value.value);
          }
        }
        setConfigs(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getValue = (key: string) => configs[key] || DEFAULT_SCORING_WEIGHTS[key as keyof typeof DEFAULT_SCORING_WEIGHTS] || "";

  const handleSave = async () => {
    setSaving(true);
    try {
      const sectionsToSave = [
        ...CONFIG_SECTIONS,
        AI_PROMPT_SECTION,
        SCORING_WEIGHT_SECTION,
      ];

      const promises = sectionsToSave.flatMap((section) =>
        section.fields
          .filter((f) => !f.readonly && configs[f.key] !== undefined && configs[f.key] !== "")
          .map((f) =>
            fetch("/api/admin/configs", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: f.key, value: configs[f.key], description: f.label }),
            })
          )
      );

      // Save routing checkboxes
      for (const section of CONFIG_SECTIONS) {
        if (!section.routing) continue;
        for (const r of section.routing) {
          promises.push(
            fetch("/api/admin/configs", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: r.key, value: configs[r.key] || "false", description: `${r.label} 路由开关` }),
            })
          );
        }
      }

      await Promise.all(promises);
      toast({ title: "配置已保存，部分配置需要重启服务生效" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const scoringWeightTotal = SCORING_WEIGHT_SECTION.fields.reduce(
    (sum, field) => sum + Number(getValue(field.key) || 0),
    0
  );

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统配置</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // 重置 AI Prompt 为默认值
  const handleResetPrompts = async () => {
    if (!confirm("确定要将所有 AI Prompt 重置为默认值吗？")) return;
    try {
      const res = await fetch("/api/admin/ai-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        toast({ title: "已重置为默认值" });
        // 重新加载
        window.location.reload();
      }
    } catch {
      toast({ title: "重置失败", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">系统配置</h1>
        <p className="text-muted-foreground">管理平台 .env 配置项，保存后部分配置需要重启服务生效</p>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList>
          <TabsTrigger value="basic">基础配置</TabsTrigger>
          <TabsTrigger value="prompts">
            <Sparkles className="h-4 w-4 mr-2" />
            AI 提示词
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          {CONFIG_SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <div className="flex gap-2">
                  {"textarea" in field && field.textarea ? (
                    <Textarea
                      id={field.key}
                      placeholder={field.placeholder}
                      value={getValue(field.key)}
                      rows={4}
                      onChange={(e) =>
                        setConfigs((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                      placeholder={field.placeholder}
                      value={getValue(field.key)}
                      readOnly={field.readonly}
                      disabled={field.readonly}
                      onChange={(e) =>
                        setConfigs((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                  {field.secret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSecret(field.key)}
                    >
                      {showSecrets[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {section.routing && (
              <div className="border-t pt-4 space-y-3">
                <Label className="text-sm font-medium">启用邮箱查找服务</Label>
                <div className="flex gap-6">
                  {section.routing.map((r) => {
                    const isConfigured = !!getValue(r.dependsOn);
                    return (
                      <div key={r.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={r.key}
                          checked={configs[r.key] === "true"}
                          disabled={!isConfigured}
                          onCheckedChange={(v) =>
                            setConfigs((prev) => ({ ...prev, [r.key]: v ? "true" : "false" }))
                          }
                        />
                        <Label htmlFor={r.key} className="font-normal cursor-pointer">
                          {r.label} {isConfigured ? "" : "(未配置 API Key)"}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  都勾选时按顺序尝试：先 Hunter，再 Snov.io 补充。只勾选一个则只走该服务。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "保存中..." : "保存所有配置"}
          </Button>
        </TabsContent>

        {/* AI Prompt 配置 Tab */}
        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{AI_PROMPT_SECTION.title}</CardTitle>
              <CardDescription>{AI_PROMPT_SECTION.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {AI_PROMPT_SECTION.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Textarea
                    id={field.key}
                    placeholder={field.placeholder}
                    value={getValue(field.key)}
                    rows={field.rows || 4}
                    onChange={(e) =>
                      setConfigs((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{SCORING_WEIGHT_SECTION.title}</CardTitle>
              <CardDescription>{SCORING_WEIGHT_SECTION.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {SCORING_WEIGHT_SECTION.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    min="0"
                    step="1"
                    value={getValue(field.key)}
                    onChange={(e) =>
                      setConfigs((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <p className={`text-sm ${scoringWeightTotal === 100 ? "text-muted-foreground" : "text-destructive"}`}>
                当前总和：{scoringWeightTotal}（建议 100）
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? "保存中..." : "保存提示词"}
            </Button>
            <Button variant="outline" onClick={handleResetPrompts}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置为默认值
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
