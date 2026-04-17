"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
}

export function CampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [adminModelConfigured, setAdminModelConfigured] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetPersona, setTargetPersona] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [aiProvider, setAiProvider] = useState("");
  const [customBaseURL, setCustomBaseURL] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customModel, setCustomModel] = useState("");

  useEffect(() => {
    fetch("/api/v1/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.data || []))
      .catch(() => {});

    // Check if admin has configured the custom model
    fetch("/api/v1/status")
      .then((res) => res.json())
      .then((data) => {
        const configured = data.data?.aiModel || false;
        setAdminModelConfigured(configured);
        if (configured) setAiProvider("custom");
      })
      .catch(() => {});

    // Fetch current plan
    fetch("/api/v1/plan")
      .then((res) => res.json())
      .then((data) => setPlan(data.data?.plan || "free"))
      .catch(() => {});
  }, []);

  const isUserCustom = aiProvider === "_user_custom";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, any> = {
        name,
        industry: industry || undefined,
        targetPersona: targetPersona || undefined,
        templateId: templateId || undefined,
        aiProvider: "custom",
      };

      if (isUserCustom) {
        body.aiConfig = {
          baseURL: customBaseURL || undefined,
          apiKey: customApiKey || undefined,
          model: customModel || undefined,
        };
      }

      const res = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "创建失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: "活动已创建" });
      router.push("/campaigns");
      router.refresh();
    } catch {
      toast({ title: "创建失败", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建营销活动</CardTitle>
        <CardDescription>
          配置活动参数，AI 将为每个客户生成个性化邮件
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">活动名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：2024 Q2 北美客户开发"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">目标行业</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="选择行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="electronics">电子产品</SelectItem>
                  <SelectItem value="machinery">机械设备</SelectItem>
                  <SelectItem value="textile">纺织服装</SelectItem>
                  <SelectItem value="chemical">化工原料</SelectItem>
                  <SelectItem value="auto">汽车配件</SelectItem>
                  <SelectItem value="furniture">家居家具</SelectItem>
                  <SelectItem value="food">食品饮料</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona">目标联系人角色</Label>
              <Input
                id="persona"
                value={targetPersona}
                onChange={(e) => setTargetPersona(e.target.value)}
                placeholder="如：采购总监、CEO"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template">邮件模板</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模板（可选）" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">AI 模型</Label>
              <Select value={aiProvider} onValueChange={setAiProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 AI 模型" />
                </SelectTrigger>
                <SelectContent>
                  {adminModelConfigured && (
                    <SelectItem value="custom">
                      后台配置模型
                    </SelectItem>
                  )}
                  {plan !== "free" && (
                  <SelectItem value="_user_custom">
                    自定义（使用自己的 API Key）
                  </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isUserCustom && (
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">自定义模型配置</CardTitle>
                <CardDescription className="text-xs">
                  填写你自己的 API 配置，仅对当前活动生效
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="customBaseURL">API Base URL *</Label>
                  <Input
                    id="customBaseURL"
                    value={customBaseURL}
                    onChange={(e) => setCustomBaseURL(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customApiKey">API Key *</Label>
                  <Input
                    id="customApiKey"
                    type="password"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="sk-..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customModel">模型名称 *</Label>
                  <Input
                    id="customModel"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="gpt-4o"
                    required
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Button type="submit" disabled={loading || !aiProvider}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "创建中..." : "创建活动"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
