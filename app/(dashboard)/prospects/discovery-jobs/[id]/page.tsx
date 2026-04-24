"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DiscoveryCandidateTable } from "@/components/discovery/discovery-candidate-table";

interface JobPageProps {
  params: { id: string };
}

interface DiscoveryJobSummary {
  pending: number;
  accepted: number;
  rejected: number;
  review: number;
  blacklisted: number;
  saved: number;
}

interface DiscoveryJob {
  id: string;
  name: string;
  status: string;
  progress: number;
  candidateCount: number;
  searchedCount: number;
  crawledCount: number;
  savedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  summary: DiscoveryJobSummary;
}

interface DiscoveryCandidate {
  id: string;
  companyName: string | null;
  domain: string | null;
  rootDomain: string | null;
  finalScore: number | null;
  detectorScore: number | null;
  ruleScore: number | null;
  aiScore: number | null;
  decision: string;
  matchedRules: string[];
  rejectReasons: string[];
  evidence: { source: string; quote: string; reason?: string }[];
  contacts: Record<string, unknown>;
  title: string | null;
  snippet: string | null;
}

const terminalStatuses = new Set(["completed", "failed", "cancelled"]);

export default function DiscoveryJobDetailPage({ params }: JobPageProps) {
  const { toast } = useToast();
  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);

  const load = useCallback(async () => {
    const [jobResponse, candidateResponse] = await Promise.all([
      fetch(`/api/v1/discovery-jobs/${params.id}`),
      fetch(`/api/v1/discovery-jobs/${params.id}/candidates?page=1&limit=100`),
    ]);
    const jobPayload = await jobResponse.json();
    const candidatePayload = await candidateResponse.json();
    setJob(jobPayload.data || null);
    setCandidates(candidatePayload.data?.items || []);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!job || terminalStatuses.has(job.status)) {
      return;
    }

    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [job, load]);

  const statCards = useMemo(
    () => [
      { label: "搜索结果", value: job?.searchedCount ?? 0 },
      { label: "已抓取", value: job?.crawledCount ?? 0 },
      { label: "候选数", value: job?.candidateCount ?? 0 },
      { label: "已入库", value: job?.savedCount ?? 0 },
    ],
    [job]
  );

  async function runAction(
    candidateId: string,
    action: "accept" | "reject" | "blacklist" | "restore" | "save_to_prospect"
  ) {
    const endpoint =
      action === "save_to_prospect"
        ? `/api/v1/discovery-candidates/${candidateId}/save`
        : `/api/v1/discovery-candidates/${candidateId}/action`;
    const body = action === "save_to_prospect" ? undefined : JSON.stringify({ action });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    });

    if (!response.ok) {
      throw new Error("候选操作失败");
    }

    toast({ title: "已更新候选状态" });
    await load();
  }

  async function cancelJob() {
    const response = await fetch(`/api/v1/discovery-jobs/${params.id}/cancel`, {
      method: "POST",
    });
    if (!response.ok) {
      toast({ title: "取消失败", variant: "destructive" });
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/prospects/discovery-jobs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{job?.name || "Discovery Job"}</h1>
              <Badge variant="secondary">{job?.status || "loading"}</Badge>
            </div>
            <p className="page-subtitle">
              当前进度 {job?.progress ?? 0}% ，候选在本页审核后再决定是否入库 prospects
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          {job && !terminalStatuses.has(job.status) && (
            <Button variant="outline" onClick={() => void cancelJob()}>
              <Ban className="mr-2 h-4 w-4" />
              取消任务
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((item) => (
          <Card key={item.label} className="rounded-[24px] border-slate-200/80">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[24px] border-slate-200/80">
        <CardHeader>
          <CardTitle>审核摘要</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">待处理</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.pending ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">已接受</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.accepted ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">已拒绝</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.rejected ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">待审核</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.review ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">已拉黑</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.blacklisted ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3">
            <div className="text-xs text-muted-foreground">已入库</div>
            <div className="mt-1 text-xl font-semibold">{job?.summary?.saved ?? 0}</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">候选审核</h2>
        </div>
        <DiscoveryCandidateTable candidates={candidates} onAction={runAction} />
      </div>

      <Card className="rounded-[24px] border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            入库规则
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>accepted 代表候选通过画像判断，但不一定已经入库 prospects。</p>
          <p>save_to_prospect 或达到自动入库阈值后，候选才会真正写入客户主表。</p>
          <p>blacklist 会进入后续任务的过滤名单，影响同 tenant / ICP 下的新任务。</p>
        </CardContent>
      </Card>
    </div>
  );
}
