"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Building2, Globe, MapPin, Loader2, Star, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Prospect {
  id: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  linkedinUrl: string | null;
  whatsapp: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  researchSummary: string | null;
  companyScore: number | null;
  matchScore: number | null;
  status: string;
  source: string | null;
  createdAt: string;
}

function ScoreBadge({ score, max = 10 }: { score: number | null; max?: number }) {
  if (score === null) return <span className="text-sm text-muted-foreground">—</span>;
  const color = score >= 7 ? "text-green-600" : score >= 4 ? "text-yellow-600" : "text-red-600";
  const bg = score >= 7 ? "bg-green-50 border-green-200" : score >= 4 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${color} ${bg}`}>
      {score}/{max}
    </span>
  );
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/v1/prospects/${params.id}`)
      .then((res) => res.json())
      .then((data) => setProspect(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await fetch("/api/v1/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: params.id }),
      });
      const data = await res.json();
      if (data.data?.summary) {
        setProspect((prev: Prospect | null) =>
          prev
            ? {
                ...prev,
                researchSummary: data.data.summary,
                companyScore: data.data.companyScore ?? prev.companyScore,
                matchScore: data.data.matchScore ?? prev.matchScore,
              }
            : prev
        );
        toast({ title: "AI 背调完成" });
      } else if (data.error) {
        toast({ title: "背调失败", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "背调失败", description: "请检查 API Key 配置", variant: "destructive" });
    } finally {
      setResearching(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!prospect) {
    return <div>客户未找到</div>;
  }

  const hasScores = prospect.companyScore !== null || prospect.matchScore !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {prospect.companyName || prospect.contactName || "未知客户"}
          </h1>
          <p className="text-muted-foreground">客户详情</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">公司名称</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.companyName || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">联系人邮箱</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.email || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">网站</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.website || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">国家</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.country || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium">行业</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.industry || "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">状态</p>
              <Badge>{prospect.status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Scores card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">背调评分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">公司真实性</span>
              </div>
              <ScoreBadge score={prospect.companyScore} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">业务匹配度</span>
              </div>
              <ScoreBadge score={prospect.matchScore} />
            </div>
            {!hasScores && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                点击「开始背调」生成评分
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleResearch}
              disabled={researching}
            >
              {researching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {researching ? "背调中..." : hasScores ? "重新背调" : "开始背调"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Research report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI 背调报告</CardTitle>
        </CardHeader>
        <CardContent>
          {prospect.researchSummary ? (
            <div className="text-sm whitespace-pre-wrap">
              {prospect.researchSummary}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">尚未进行 AI 背调</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleResearch} disabled={researching}>
                {researching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {researching ? "背调中..." : "开始背调"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
