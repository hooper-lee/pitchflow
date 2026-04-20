"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const DETECTOR_CONFIG_KEYS = [
  "DETECTOR_BLOCKED_DOMAINS",
  "DETECTOR_BLOCKED_TLDS",
  "DETECTOR_SCORE_WEIGHTS",
  "DETECTOR_NAV_KEYWORDS",
  "DETECTOR_ENABLE_PLAYWRIGHT",
];

const DEFAULT_WEIGHTS = {
  domainQuality: 30,
  contentSignals: 25,
  negativeSignals: 20,
  navigationSignals: 15,
  contactSignals: 10,
};

const WEIGHT_LABELS: Record<string, string> = {
  domainQuality: "域名质量",
  contentSignals: "内容信号",
  negativeSignals: "负面信号",
  navigationSignals: "导航信号",
  contactSignals: "联系方式",
};

export default function AdminDetectorPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [blockedDomains, setBlockedDomains] = useState("");
  const [blockedTlds, setBlockedTlds] = useState("");
  const [scoreWeights, setScoreWeights] = useState<Record<string, number>>({ ...DEFAULT_WEIGHTS });
  const [enablePlaywright, setEnablePlaywright] = useState(false);

  useEffect(() => {
    fetch("/api/admin/configs")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const c of data.data || []) {
          map[c.key] = c.value;
        }

        if (map.DETECTOR_BLOCKED_DOMAINS) {
          try {
            const arr = JSON.parse(map.DETECTOR_BLOCKED_DOMAINS);
            setBlockedDomains(Array.isArray(arr) ? arr.join("\n") : "");
          } catch {}
        }

        if (map.DETECTOR_BLOCKED_TLDS) {
          try {
            const arr = JSON.parse(map.DETECTOR_BLOCKED_TLDS);
            setBlockedTlds(Array.isArray(arr) ? arr.join("\n") : "");
          } catch {}
        }

        if (map.DETECTOR_SCORE_WEIGHTS) {
          try {
            const w = JSON.parse(map.DETECTOR_SCORE_WEIGHTS);
            setScoreWeights({ ...DEFAULT_WEIGHTS, ...w });
          } catch {}
        }

        setEnablePlaywright(map.DETECTOR_ENABLE_PLAYWRIGHT === "true");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const weightTotal = Object.values(scoreWeights).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const domains = blockedDomains
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#"));

      const tlds = blockedTlds
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#"));

      const entries = [
        {
          key: "DETECTOR_BLOCKED_DOMAINS",
          value: JSON.stringify(domains),
          description: "网站检测器 - 域名黑名单",
        },
        {
          key: "DETECTOR_BLOCKED_TLDS",
          value: JSON.stringify(tlds),
          description: "网站检测器 - TLD黑名单",
        },
        {
          key: "DETECTOR_SCORE_WEIGHTS",
          value: JSON.stringify(scoreWeights),
          description: "网站检测器 - 评分权重",
        },
        {
          key: "DETECTOR_ENABLE_PLAYWRIGHT",
          value: enablePlaywright ? "true" : "false",
          description: "网站检测器 - Playwright开关",
        },
      ];

      await Promise.all(
        entries.map((e) =>
          fetch("/api/admin/configs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e),
          })
        )
      );

      toast({ title: "检测器配置已保存" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">网站检测器</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">网站检测器</h1>
        <p className="text-muted-foreground">
          配置客户挖掘时的官网识别规则，修改后立即生效（无需重启）
        </p>
      </div>

      {/* 域名黑名单 */}
      <Card>
        <CardHeader>
          <CardTitle>域名黑名单</CardTitle>
          <CardDescription>
            每行一个域名，匹配时会跳过该搜索结果（支持子域名匹配，如写 zhihu.com 会同时匹配 www.zhihu.com）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={"# 社交平台\nfacebook.com\nlinkedin.com\ntwitter.com\n...\n# 国内社交/内容平台\nzhihu.com\nxiaohongshu.com\n...\n# 电商/B2B平台\namazon.com\nalibaba.com\n..."}
            value={blockedDomains}
            onChange={(e) => setBlockedDomains(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            当前 {blockedDomains.split("\n").filter((s) => s.trim() && !s.trim().startsWith("#")).length} 个域名（以 # 开头的行视为注释，不会被过滤）
          </p>
        </CardContent>
      </Card>

      {/* TLD 黑名单 */}
      <Card>
        <CardHeader>
          <CardTitle>TLD 黑名单</CardTitle>
          <CardDescription>
            每行一个顶级域名后缀，匹配时会跳过（如 .gov、.edu 等政府教育类网站）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={"# 政府\n.gov\n.gov.cn\n.gov.uk\n...\n# 教育\n.edu\n.edu.cn\n.edu.au\n...\n# 军事\n.mil\n.mil.cn"}
            value={blockedTlds}
            onChange={(e) => setBlockedTlds(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">
            当前 {blockedTlds.split("\n").filter((s) => s.trim() && !s.trim().startsWith("#")).length} 个后缀
          </p>
        </CardContent>
      </Card>

      {/* 评分权重 */}
      <Card>
        <CardHeader>
          <CardTitle>评分权重</CardTitle>
          <CardDescription>
            5 个维度的权重设置，系统会按比例缩放至 100 分（如设置 30/25/20/15/10 即按此比例计算）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(DEFAULT_WEIGHTS).map(([key, defaultVal]) => (
            <div key={key} className="flex items-center gap-4">
              <Label htmlFor={`weight-${key}`} className="w-24 text-sm">
                {WEIGHT_LABELS[key] || key}
              </Label>
              <Input
                id={`weight-${key}`}
                type="number"
                min={0}
                max={100}
                className="w-24"
                value={scoreWeights[key] ?? defaultVal}
                onChange={(e) =>
                  setScoreWeights((prev) => ({
                    ...prev,
                    [key]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">
                实际占比 {weightTotal > 0 ? Math.round(((scoreWeights[key] ?? defaultVal) / weightTotal) * 100) : 0}%
              </span>
            </div>
          ))}
          <div className="pt-2 border-t flex items-center gap-2">
            <span className="text-sm font-medium">权重合计:</span>
            <span className={`text-sm font-bold ${weightTotal === 0 ? "text-destructive" : ""}`}>
              {weightTotal}
            </span>
            {weightTotal === 0 && (
              <span className="text-xs text-destructive">（权重合计为 0 将导致所有网站得分为 0）</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Playwright 开关 */}
      <Card>
        <CardHeader>
          <CardTitle>Playwright 渲染</CardTitle>
          <CardDescription>
            启用后，当 Cheerio 抓取的页面内容不足时（&lt;200 字），会自动使用 Playwright 浏览器渲染页面。
            需要先安装: <code className="text-xs bg-muted px-1 py-0.5 rounded">npm install playwright && npx playwright install chromium</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="playwright-toggle"
              checked={enablePlaywright}
              onCheckedChange={setEnablePlaywright}
            />
            <Label htmlFor="playwright-toggle" className="cursor-pointer">
              {enablePlaywright ? "已启用" : "已禁用"}
            </Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? "保存中..." : "保存检测器配置"}
      </Button>
    </div>
  );
}
