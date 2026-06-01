"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface IcpProfile {
  id: string;
  name: string;
}

export default function NewDiscoveryJobPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<IcpProfile[]>([]);
  const [icpProfileId, setIcpProfileId] = useState<string>("none");
  const [discoveryMode, setDiscoveryMode] = useState<string>("mixed");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/v1/icp-profiles")
      .then((response) => response.json())
      .then((payload) => setProfiles(payload.data || []))
      .catch(() => setProfiles([]));
  }, []);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/discovery-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") || ""),
          icpProfileId: icpProfileId === "none" ? undefined : icpProfileId,
          industry: String(formData.get("industry") || "") || undefined,
          country: String(formData.get("country") || "") || undefined,
          keywords: String(formData.get("keywords") || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          targetLimit: Number(formData.get("targetLimit") || 50),
          discoveryMode: discoveryMode === "mixed" ? undefined : discoveryMode,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "创建任务失败");
      }

      toast({ title: "任务已创建" });
      router.push(`/prospects/discovery-jobs/${payload.data.id}`);
    } catch (error) {
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/prospects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="page-title">新建精准挖掘任务</h1>
          <p className="page-subtitle">选择 ICP 画像后，系统会异步执行搜索、抓取、过滤和候选评分</p>
        </div>
      </div>

      <Card className="rounded-[24px] border-slate-200/80">
        <CardHeader>
          <CardTitle>任务参数</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit(new FormData(event.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">任务名称</Label>
              <Input id="name" name="name" placeholder="如：美国 RTA 家具品牌挖掘" required />
            </div>

            <div className="space-y-2">
              <Label>ICP 画像</Label>
              <Select value={icpProfileId} onValueChange={setIcpProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择画像" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用画像</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="industry">行业</Label>
                <Input id="industry" name="industry" placeholder="如：家具" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">国家</Label>
                <Input id="country" name="country" placeholder="如：United States" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">关键词</Label>
              <Textarea
                id="keywords"
                name="keywords"
                rows={6}
                placeholder={"每行一个关键词\nRTA furniture\nflat-pack furniture\nmodular furniture"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetLimit">目标数量</Label>
              <Input id="targetLimit" name="targetLimit" type="number" min={1} max={200} defaultValue={50} />
            </div>

            <div className="space-y-2">
              <Label>挖掘模式</Label>
              <Select value={discoveryMode} onValueChange={setDiscoveryMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">
                    <span className="font-medium">B2B 外贸</span>
                    <span className="ml-2 text-xs text-muted-foreground">找海外进口商、批发商、分销商</span>
                  </SelectItem>
                  <SelectItem value="b2c">
                    <span className="font-medium">B2C/DTC 品牌</span>
                    <span className="ml-2 text-xs text-muted-foreground">找海外品牌商、零售商</span>
                  </SelectItem>
                  <SelectItem value="mixed">
                    <span className="font-medium">综合模式</span>
                    <span className="ml-2 text-xs text-muted-foreground">两者兼顾，推荐</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {discoveryMode === "b2b" && "搜索进口商/批发商/分销商相关关键词，AI 优先评估采购潜力"}
                {discoveryMode === "b2c" && "搜索品牌商/零售商相关关键词，AI 优先评估合作潜力"}
                {discoveryMode === "mixed" && "同时使用两种策略搜索和评分，覆盖面最广"}
              </p>
            </div>

            <Button type="submit" disabled={submitting}>
              <Rocket className="mr-2 h-4 w-4" />
              {submitting ? "创建中..." : "创建任务"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
