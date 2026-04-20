"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Building2, Globe, MapPin, Loader2, Sparkles, Users } from "lucide-react";
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
  contacts?: {
    id: string;
    contactName: string | null;
    email: string | null;
    linkedinUrl: string | null;
    createdAt: string;
  }[];
}

// 调研信息
interface ResearchInfo {
  id: string;
  status: string;
  aiSummary: string | null;
  companyDescription: string | null;
  employeeCount: string | null;
  companyType: string | null;
  mainProducts: string[] | null;
  targetMarkets: string[] | null;
  decisionMakers: { name: string; position: string; linkedin?: string }[] | null;
  errorMessage: string | null;
}

// 评分信息
interface ScoresInfo {
  id: string;
  websiteScore: number | null;
  icpFitScore: number | null;
  buyingIntentScore: number | null;
  reachabilityScore: number | null;
  dealPotentialScore: number | null;
  riskPenaltyScore: number | null;
  overallScore: number | null;
  leadGrade: string | null;
  priorityLevel: number | null;
  recommendedAction: string | null;
  actionReason: string | null;
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score === null) return null;
  const percent = Math.min(100, Math.max(0, score));
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : score >= 25 ? "bg-orange-500" : "bg-gray-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

const leadGradeColors: Record<string, string> = {
  A: "bg-green-500",
  B: "bg-yellow-500",
  C: "bg-orange-500",
  D: "bg-gray-400",
};

const leadGradeLabels: Record<string, string> = {
  A: "A 级 - 优先联系",
  B: "B 级 - 培育跟进",
  C: "C 级 - 观察等待",
  D: "D 级 - 暂不跟进",
};

const statusLabels: Record<string, string> = {
  new: "新线索",
  contacted: "已联系",
  replied: "已回复",
  converted: "已转化",
  bounced: "退回",
  unsubscribed: "退订",
};

const researchStatusLabels: Record<string, string> = {
  pending: "待调研",
  processing: "调研中",
  completed: "调研完成",
  failed: "调研失败",
};

function isResearchInProgress(status?: string | null) {
  return status === "pending" || status === "processing";
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [research, setResearch] = useState<ResearchInfo | null>(null);
  const [scores, setScores] = useState<ScoresInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // 获取基本信息
    fetch(`/api/v1/prospects/${params.id}`)
      .then((res) => res.json())
      .then((data) => setProspect(data.data))
      .catch(() => {});

    // 获取调研和评分信息
    fetch(`/api/v1/prospects/${params.id}/research`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setResearch(data.data.research);
          setScores(data.data.scores);
          setResearching(isResearchInProgress(data.data.research?.status));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleResearch = async () => {
    if (isResearchInProgress(research?.status) || researching) {
      return;
    }

    setResearching(true);
    try {
      // 使用新的调研 API
      const res = await fetch(`/api/v1/prospects/${params.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.data?.started === false) {
        toast({ title: "调研已在进行中", description: "请稍后刷新查看结果" });
        pollResearchStatus();
      } else if (data.data?.researchId) {
        // 轮询获取结果
        toast({ title: "AI 调研已启动", description: "正在处理中..." });
        pollResearchStatus();
      } else if (data.error) {
        toast({ title: "调研失败", description: data.error, variant: "destructive" });
        setResearching(false);
      }
    } catch {
      toast({ title: "调研失败", description: "请检查 API Key 配置", variant: "destructive" });
      setResearching(false);
    }
  };

  const pollResearchStatus = () => {
    const interval = setInterval(() => {
      fetch(`/api/v1/prospects/${params.id}/research`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data?.research?.status === "completed") {
            setResearch(data.data.research);
            setScores(data.data.scores);
            clearInterval(interval);
            setResearching(false);
            toast({ title: "AI 调研完成" });
          } else if (data.data?.research?.status === "failed") {
            clearInterval(interval);
            setResearching(false);
            toast({ title: "调研失败", description: data.data.research.errorMessage, variant: "destructive" });
          }
        })
        .catch(() => {});
    }, 3000);

    // 30秒超时
    setTimeout(() => {
      clearInterval(interval);
      if (researching) {
        setResearching(false);
      }
    }, 30000);
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

  const hasScores = scores !== null;
  const hasResearch = research !== null && research.status === "completed";
  const researchInProgress = researching || isResearchInProgress(research?.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {prospect.companyName || prospect.contactName || "未知客户"}
            </h1>
            {scores?.leadGrade && (
              <Badge className={`${leadGradeColors[scores.leadGrade]} text-white`}>
                {leadGradeLabels[scores.leadGrade]}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">客户详情</p>
        </div>
        <Button
          variant="outline"
          onClick={handleResearch}
          disabled={researchInProgress}
        >
          {researchInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Sparkles className="mr-2 h-4 w-4" />
          {researchInProgress ? "调研中..." : hasResearch ? "重新调研" : "开始调研"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
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
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">联系人</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.contactName || "—"}
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
                {prospect.website ? (
                  <Link
                    href={prospect.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 break-all hover:underline"
                  >
                    {prospect.website}
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
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
              <p className="text-sm font-medium mb-1">主状态</p>
              <Badge>{statusLabels[prospect.status] || prospect.status}</Badge>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">调研状态</p>
              <Badge variant="outline">
                {research
                  ? researchStatusLabels[research.status] || research.status
                  : "待调研"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 评分卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI 评分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasScores && scores ? (
              <>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">调研评分</span>
                  <span className={`text-2xl font-bold ${
                    (scores.overallScore ?? 0) >= 75 ? "text-green-600" :
                    (scores.overallScore ?? 0) >= 50 ? "text-yellow-600" :
                    (scores.overallScore ?? 0) >= 25 ? "text-orange-500" : "text-gray-400"
                  }`}>
                    {scores.overallScore ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">搜索评分</span>
                  <span className={`text-2xl font-bold ${
                    (scores.websiteScore ?? prospect.companyScore ?? 0) >= 75 ? "text-green-600" :
                    (scores.websiteScore ?? prospect.companyScore ?? 0) >= 50 ? "text-yellow-600" :
                    (scores.websiteScore ?? prospect.companyScore ?? 0) >= 25 ? "text-orange-500" : "text-gray-400"
                  }`}>
                    {scores.websiteScore ?? prospect.companyScore ?? "—"}
                  </span>
                </div>

                <ScoreBar label="ICP 匹配（是否符合目标客户画像）" score={scores.icpFitScore} />
                <ScoreBar label="采购意向（是否有明确采购/合作信号）" score={scores.buyingIntentScore} />
                <ScoreBar label="可触达性（是否容易联系到关键人）" score={scores.reachabilityScore} />
                <ScoreBar label="成交潜力（订单规模和合作空间）" score={scores.dealPotentialScore} />
                <ScoreBar label="风险评估（资质、真实性、成交风险）" score={scores.riskPenaltyScore} />

                {scores.recommendedAction && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-800">推荐动作</p>
                    <p className="text-sm text-blue-700 mt-1">{scores.recommendedAction}</p>
                    {scores.actionReason && (
                      <p className="text-xs text-blue-600 mt-2">{scores.actionReason}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">点击「开始调研」生成评分</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {prospect.contacts && prospect.contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">已识别联系人</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {prospect.contacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-sm font-medium">{contact.contactName || "未命名联系人"}</p>
                  <p className="mt-1 text-sm text-muted-foreground break-all">
                    {contact.email || "暂无邮箱"}
                  </p>
                  {contact.linkedinUrl && (
                    <Link
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-600 hover:underline break-all"
                    >
                      {contact.linkedinUrl}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 调研信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI 调研信息</CardTitle>
        </CardHeader>
        <CardContent>
          {hasResearch && research ? (
            <div className="space-y-6">
              {research.aiSummary && (
                <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-blue-50 p-5 shadow-sm">
                  <p className="text-sm font-medium mb-2">调研摘要</p>
                  <p className="text-sm leading-6 text-slate-700">{research.aiSummary}</p>
                </div>
              )}

              {research.companyDescription && (
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">公司描述</p>
                  <p className="text-sm leading-6">{research.companyDescription}</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {research.employeeCount && (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">员工规模</p>
                    <p className="text-sm font-medium">{research.employeeCount}</p>
                  </div>
                )}

                {research.companyType && (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">公司类型</p>
                    <p className="text-sm font-medium">{research.companyType}</p>
                  </div>
                )}
              </div>

              {research.mainProducts && research.mainProducts.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">主要产品</p>
                  <div className="flex flex-wrap gap-2">
                    {research.mainProducts.map((product, i) => (
                      <Badge key={i} variant="secondary" className="rounded-full px-3 py-1">
                        {product}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {research.targetMarkets && research.targetMarkets.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">目标市场</p>
                  <div className="flex flex-wrap gap-2">
                    {research.targetMarkets.map((market, i) => (
                      <Badge key={i} variant="outline" className="rounded-full px-3 py-1">
                        {market}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {research.decisionMakers && research.decisionMakers.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">决策人</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {research.decisionMakers.map((dm, i) => (
                      <div key={i} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{dm.name}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{dm.position}</p>
                        {dm.linkedin && (
                          <Link
                            href={dm.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                          >
                            LinkedIn
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">当前还没有调研结果</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleResearch} disabled={researchInProgress}>
                {researchInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {researchInProgress ? "调研中..." : "开始调研"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
