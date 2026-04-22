"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Mail,
  Building2,
  Globe,
  MapPin,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
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
  const color =
    score >= 75
      ? "bg-green-500"
      : score >= 50
        ? "bg-yellow-500"
        : score >= 25
          ? "bg-orange-500"
          : "bg-gray-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-900">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  icon,
  compact,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white/90 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {label}
          </p>
          <div className="mt-2 break-words text-sm font-medium leading-6 text-slate-900">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  const displayValue = typeof value === "number" ? `${value} 分` : value;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-3 text-3xl font-semibold tracking-tight ${
          accent ? "text-blue-600" : "text-slate-900"
        }`}
      >
        {displayValue}
      </p>
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

const researchStageMessages = [
  "正在搜索公开信息",
  "正在提取公司画像",
  "正在评估采购与触达信号",
  "正在生成调研摘要与评分",
];

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
  const [researchStage, setResearchStage] = useState(researchStageMessages[0]);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/v1/prospects/${params.id}`)
      .then((res) => res.json())
      .then((data) => setProspect(data.data))
      .catch(() => {});

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

  useEffect(() => {
    const inProgress = researching || isResearchInProgress(research?.status);
    if (!inProgress) {
      setResearchStage(researchStageMessages[0]);
      return;
    }

    let currentIndex = 0;
    const timer = setInterval(() => {
      currentIndex = Math.min(currentIndex + 1, researchStageMessages.length - 1);
      setResearchStage(researchStageMessages[currentIndex]);
    }, 1800);

    return () => clearInterval(timer);
  }, [researching, research?.status]);

  const handleResearch = async () => {
    if (isResearchInProgress(research?.status) || researching) {
      return;
    }

    setResearching(true);
    setResearchStage(researchStageMessages[0]);
    try {
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
            toast({
              title: "调研失败",
              description: data.data.research.errorMessage,
              variant: "destructive",
            });
          }
        })
        .catch(() => {});
    }, 3000);

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

  const hasResearch = research !== null && research.status === "completed";
  const researchInProgress = researching || isResearchInProgress(research?.status);
  const searchScore = scores?.websiteScore ?? prospect.companyScore ?? null;
  const decisionMakerCount = research?.decisionMakers?.length || 0;
  const targetMarketCount = research?.targetMarkets?.length || 0;
  const productCount = research?.mainProducts?.length || 0;

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                {prospect.companyName || prospect.contactName || "未知客户"}
              </h1>
              {scores?.leadGrade && (
                <Badge className={`${leadGradeColors[scores.leadGrade]} text-white shadow-sm`}>
                  {leadGradeLabels[scores.leadGrade]}
                </Badge>
              )}
              <Badge variant="outline" className="border-slate-300 bg-white/80">
                {statusLabels[prospect.status] || prospect.status}
              </Badge>
              <Badge variant="outline" className="border-slate-300 bg-white/80">
                {research
                  ? researchStatusLabels[research.status] || research.status
                  : "待调研"}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              聚合基础资料、AI 调研洞察与评分结果，帮助你更快判断这个客户是否值得优先跟进。
            </p>
            {researchInProgress && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-sm text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {researchStage}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleResearch}
            disabled={researchInProgress}
            className="shrink-0 border-slate-300 bg-white/90"
          >
            {researchInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Sparkles className="mr-2 h-4 w-4" />
            {researchInProgress ? "调研中..." : hasResearch ? "重新调研" : "开始调研"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[28px] border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white/95 pb-5">
              <CardTitle className="text-xl text-slate-950">基础信息</CardTitle>
            </CardHeader>
            <CardContent className="bg-gradient-to-br from-white via-slate-50/40 to-white p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="公司名称"
                  icon={<Building2 className="h-4 w-4" />}
                  value={prospect.companyName || "—"}
                />
                <DetailField
                  label="主要联系人"
                  icon={<Users className="h-4 w-4" />}
                  value={prospect.contactName || "—"}
                />
                <DetailField
                  label="企业邮箱"
                  icon={<Mail className="h-4 w-4" />}
                  value={prospect.email || "—"}
                />
                <DetailField
                  label="官网链接"
                  icon={<Globe className="h-4 w-4" />}
                  value={
                    prospect.website ? (
                      <Link
                        href={prospect.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {prospect.website}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailField
                  label="所在国家"
                  icon={<MapPin className="h-4 w-4" />}
                  value={prospect.country || "—"}
                />
                <DetailField label="所属行业" value={prospect.industry || "—"} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-slate-50 to-white pb-5">
              <CardTitle className="text-xl text-slate-950">AI 调研摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {hasResearch && research ? (
                <>
                  <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
                    <p className="text-sm leading-7 text-slate-700">
                      {research.aiSummary || research.companyDescription || "当前暂无调研摘要"}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <DetailField label="公司规模" compact value={research.employeeCount || "未知"} />
                    <DetailField label="公司类型" compact value={research.companyType || "未知"} />
                    <DetailField
                      label="调研状态"
                      compact
                      value={researchStatusLabels[research.status] || research.status}
                    />
                  </div>

                  {research.companyDescription && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        公司描述
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        {research.companyDescription}
                      </p>
                    </div>
                  )}

                  {research.mainProducts && research.mainProducts.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        主要产品
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {research.mainProducts.map((product, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                          >
                            {product}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {research.targetMarkets && research.targetMarkets.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        目标市场
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {research.targetMarkets.map((market, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="rounded-full border-slate-300 px-3 py-1"
                          >
                            {market}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {research.decisionMakers && research.decisionMakers.length > 0 && (
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        关键决策人
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {research.decisionMakers.map((decisionMaker, index) => (
                          <div
                            key={index}
                            className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                          >
                            <p className="text-sm font-semibold text-slate-900">
                              {decisionMaker.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {decisionMaker.position}
                            </p>
                            {decisionMaker.linkedin && (
                              <Link
                                href={decisionMaker.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline"
                              >
                                查看 LinkedIn
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    {researchInProgress ? researchStage : "当前还没有调研结果"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleResearch}
                    disabled={researchInProgress}
                  >
                    {researchInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {researchInProgress ? "调研中..." : "开始调研"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {prospect.contacts && prospect.contacts.length > 0 && (
            <Card className="overflow-hidden rounded-[28px] border-slate-200/80 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-white/95 pb-5">
                <CardTitle className="text-xl text-slate-950">已识别联系人</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {prospect.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50 p-5"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {contact.contactName || "未命名联系人"}
                      </p>
                      <p className="mt-2 break-all text-sm text-slate-500">
                        {contact.email || "暂无邮箱"}
                      </p>
                      {contact.linkedinUrl && (
                        <Link
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block break-all text-xs font-medium text-blue-600 hover:underline"
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
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <Card className="overflow-hidden rounded-[28px] border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white/95 pb-5">
              <CardTitle className="text-xl text-slate-950">AI 评分洞察</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <InsightMetric label="调研评分" value={scores?.overallScore ?? "—"} accent />
                <InsightMetric label="搜索评分" value={searchScore ?? "—"} />
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5">
                <ScoreBar label="ICP 匹配（是否符合目标客户画像）" score={scores?.icpFitScore ?? null} />
                <ScoreBar label="采购意向（是否有明确采购/合作信号）" score={scores?.buyingIntentScore ?? null} />
                <ScoreBar label="可触达性（是否容易联系到关键人）" score={scores?.reachabilityScore ?? null} />
                <ScoreBar label="成交潜力（订单规模和合作空间）" score={scores?.dealPotentialScore ?? null} />
                <ScoreBar label="风险评估（资质、真实性、成交风险）" score={scores?.riskPenaltyScore ?? null} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <DetailField label="产品数" compact value={productCount || "—"} />
                <DetailField label="市场数" compact value={targetMarketCount || "—"} />
                <DetailField label="联系人" compact value={decisionMakerCount || "—"} />
              </div>

              {scores?.recommendedAction && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                    推荐动作
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {scores.recommendedAction}
                  </p>
                  {scores.actionReason && (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {scores.actionReason}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
