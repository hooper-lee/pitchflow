"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { Loader2, Check } from "lucide-react";

interface Template {
  id: string;
  name: string;
}

interface MailAccount {
  id: string;
  email: string;
}

interface Prospect {
  id: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  industry: string | null;
  status: string;
  researchStatus?: string | null;
  leadGrade?: string | null;
  overallScore?: number | null;
  companyScore?: number | null;
}

export function CampaignForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prospectSearch, setProspectSearch] = useState("");
  const [leadGradeFilter, setLeadGradeFilter] = useState("all");
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
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);

  useEffect(() => {
    fetch("/api/v1/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.data?.items || data.data || []))
      .catch(() => {});

    fetch("/api/v1/mail-accounts")
      .then((res) => res.json())
      .then((data) => setMailAccounts(data.data || []))
      .catch(() => {});

    fetch("/api/v1/prospects?limit=100")
      .then((res) => res.json())
      .then((data) => {
        const list = data.data?.items || data.data || [];
        setProspects(list.filter((p: Prospect) => p.email));
      })
      .catch(() => {});

    fetch("/api/v1/status")
      .then((res) => res.json())
      .then((data) => {
        const configured = data.data?.aiModel || false;
        setAdminModelConfigured(configured);
        if (configured) setAiProvider("custom");
      })
      .catch(() => {});

    fetch("/api/v1/plan")
      .then((res) => res.json())
      .then((data) => setPlan(data.data?.plan || "free"))
      .catch(() => {});
  }, []);

  const isUserCustom = aiProvider === "_user_custom";
  const mailboxReady = mailAccounts.some((account) => account.email === session?.user?.email);
  const displayedFromAddress = session?.user?.email || "未配置";

  const filteredProspects = prospects.filter((p) => {
    if (leadGradeFilter !== "all" && p.leadGrade !== leadGradeFilter) {
      return false;
    }

    if (!prospectSearch) return true;
    const q = prospectSearch.toLowerCase();
    return (
      (p.companyName || "").toLowerCase().includes(q) ||
      (p.contactName || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.industry || "").toLowerCase().includes(q)
    );
  });

  const toggleProspect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredProspects.map((p) => p.id)));
  };

  const clearAll = () => setSelectedIds(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        name,
        industry: industry || undefined,
        targetPersona: targetPersona || undefined,
        templateId: templateId || undefined,
        aiProvider: "custom",
      };

      if (selectedIds.size > 0) {
        body.prospectIds = Array.from(selectedIds);
      }

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
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-xl">创建营销活动</CardTitle>
        <CardDescription>
          活动发送统一使用当前登录账号注册邮箱对应的已连接邮箱账号，请先在“设置 &gt; 邮箱账号”完成连接
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
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

          <div className="space-y-2">
            <Label htmlFor="industry">目标行业 / 产品</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="输入细分行业或产品，如: LED照明、太阳能板"
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                "电子产品", "机械设备", "纺织服装", "化工原料",
                "汽车配件", "家居家具", "食品饮料", "医疗器械",
                "LED照明", "太阳能", "包装材料", "五金工具",
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setIndustry(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    industry === tag
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-transparent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
            <Label className="text-sm">当前发件邮箱</Label>
            <p className="text-sm font-medium text-foreground">
              {displayedFromAddress}
            </p>
            <p className="text-xs text-muted-foreground">
              当前活动发送将直接使用当前登录账号注册邮箱对应的已连接邮箱账号。
            </p>
            {!mailboxReady && (
              <p className="text-xs text-destructive">
                当前登录账号注册邮箱对应的已连接邮箱账号不存在，请先到设置里的“邮箱账号”完成连接。
              </p>
            )}
          </div>

          {isUserCustom && (
            <Card className="border-dashed border-slate-200/80 bg-slate-50/40">
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

          {/* Prospect Selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">选择目标客户</CardTitle>
                  <CardDescription>
                    已选 {selectedIds.size} 个客户（共 {prospects.length} 个有邮箱的客户）
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                    全选
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                    清空
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {prospects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无客户，请先去<a href="/prospects/new" className="text-primary underline">挖掘客户</a>
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={leadGradeFilter} onValueChange={setLeadGradeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="调研评分等级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部评分等级</SelectItem>
                        <SelectItem value="A">A 级</SelectItem>
                        <SelectItem value="B">B 级</SelectItem>
                        <SelectItem value="C">C 级</SelectItem>
                        <SelectItem value="D">D 级</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="搜索客户（公司名、联系人、邮箱、行业）"
                      value={prospectSearch}
                      onChange={(e) => setProspectSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-1 border rounded-md p-2">
                    {filteredProspects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">无匹配客户</p>
                    ) : (
                      filteredProspects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => toggleProspect(p.id)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            selectedIds.has(p.id)
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted border border-transparent"
                          }`}
                        >
                          <div className={`h-4 w-4 rounded border flex items-center justify-center ${
                            selectedIds.has(p.id) ? "bg-primary border-primary" : "border-muted-foreground/30"
                          }`}>
                            {selectedIds.has(p.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{p.companyName || "—"}</span>
                              {p.contactName && (
                                <span className="text-muted-foreground">· {p.contactName}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.email} {p.industry ? `· ${p.industry}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[
                                p.leadGrade ? `调研等级 ${p.leadGrade}` : "未评分",
                                p.overallScore !== null && p.overallScore !== undefined
                                  ? `调研分 ${p.overallScore}`
                                  : null,
                                p.companyScore !== null && p.companyScore !== undefined
                                  ? `搜索分 ${p.companyScore}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={loading || !aiProvider}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "创建中..." : "创建活动"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
