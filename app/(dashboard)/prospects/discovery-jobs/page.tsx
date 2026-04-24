"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DiscoveryJob {
  id: string;
  name: string;
  status: string;
  progress: number;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  savedCount: number;
  createdAt: string;
}

const statusLabelMap: Record<string, string> = {
  pending: "等待中",
  searching: "搜索中",
  crawling: "抓取中",
  filtering: "过滤中",
  scoring: "评分中",
  reviewing: "待审核",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export default function DiscoveryJobsPage() {
  const [jobs, setJobs] = useState<DiscoveryJob[]>([]);

  async function loadJobs() {
    const response = await fetch("/api/v1/discovery-jobs?page=1&limit=50");
    const payload = await response.json();
    setJobs(payload.data?.items || []);
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-start gap-3">
          <Link href="/prospects">
            <Button variant="outline" size="icon" aria-label="返回客户管理">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">精准挖掘任务</h1>
            <p className="page-subtitle">
              基于 ICP 画像创建异步 Discovery Job，在候选池中审核后再入库客户
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => (
          <Link key={job.id} href={`/prospects/discovery-jobs/${job.id}`}>
            <Card className="rounded-[24px] border-slate-200/80 transition hover:border-slate-300 hover:shadow-md">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                    <SearchCheck className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{job.name}</h2>
                      <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>
                        {statusLabelMap[job.status] || job.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      进度 {job.progress}% · 候选 {job.candidateCount} · 已入库 {job.savedCount}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm md:min-w-[320px]">
                  <div className="rounded-xl border border-slate-200/80 p-3">
                    <div className="text-xs text-muted-foreground">接受</div>
                    <div className="mt-1 font-medium">{job.acceptedCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3">
                    <div className="text-xs text-muted-foreground">拒绝</div>
                    <div className="mt-1 font-medium">{job.rejectedCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3">
                    <div className="text-xs text-muted-foreground">入库</div>
                    <div className="mt-1 font-medium">{job.savedCount}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
