"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskData {
  followup: {
    lastRun: {
      time: string;
      campaignName: string;
      stepNumber: number;
    } | null;
    pendingCount: number;
    cronSchedule: string;
  };
  tracking: {
    today: { replied: number };
    thisWeek: { replied: number };
  };
  emailQueue: { queued: number; failed: number };
}

export default function AdminTasksPage() {
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tasks")
      .then((res) => res.json())
      .then((payload) => setData(payload.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="page-header">
          <div>
            <h1 className="page-title">定时任务</h1>
            <p className="page-subtitle">加载中...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-40 w-full rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">定时任务</h1>
          <p className="page-subtitle">监控自动跟进扫描、消息追踪触发和邮件发送队列状态。</p>
        </div>
      </div>

      <div className="metric-grid md:grid-cols-4">
        <MetricCard
          title="扫描频率"
          value="15 分钟"
          description="系统每 15 分钟自动扫描一次；达到延迟时间且客户未回复时，会发送下一轮邮件。"
        />
        <MetricCard
          title="待跟进"
          value={String(data?.followup.pendingCount || 0)}
          description="符合自动跟进条件但尚未被处理的客户邮件。"
        />
        <MetricCard
          title="排队中"
          value={String(data?.emailQueue.queued || 0)}
          description="等待发送 worker 消费的邮件数。"
        />
        <MetricCard
          title="发送失败"
          value={String(data?.emailQueue.failed || 0)}
          description="已进入失败状态，需手动处理或重新同步。"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="section-card">
          <CardHeader>
            <CardTitle>自动跟进扫描</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailBlock label="Cron 表达式" value={data?.followup.cronSchedule || "*/15 * * * *"} />
            <DetailBlock label="待跟进邮件数" value={String(data?.followup.pendingCount || 0)} />
            <DetailBlock
              label="上次执行"
              value={
                data?.followup.lastRun
                  ? new Date(data.followup.lastRun.time).toLocaleString("zh-CN")
                  : "暂无执行记录"
              }
              helper={
                data?.followup.lastRun
                  ? `${data.followup.lastRun.campaignName} · 第 ${data.followup.lastRun.stepNumber} 轮`
                  : "还未出现跟进动作"
              }
            />
          </CardContent>
        </Card>

        <Card className="section-card">
          <CardHeader>
            <CardTitle>队列状态说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            <p>首封邮件进入发送队列后会尽快消费，不受 15 分钟扫描限制。</p>
            <p>自动跟进只负责检查是否达到延迟时间、客户是否未回复以及下一轮是否尚未创建。</p>
            <p>若最后一轮后仍未回复，系统会按照后台“停止跟进天数”配置终止继续轮询。</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <StatsCard
          title="今日消息追踪"
          items={[
            { label: "回复", value: data?.tracking.today.replied || 0, color: "text-sky-600" },
          ]}
        />
        <StatsCard
          title="本周消息追踪"
          items={[
            { label: "回复", value: data?.tracking.thisWeek.replied || 0, color: "text-sky-600" },
          ]}
        />
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>邮件队列</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-2">
            排队中 {data?.emailQueue.queued || 0}
          </Badge>
          <Badge variant="destructive" className="rounded-full px-3 py-2">
            发送失败 {data?.emailQueue.failed || 0}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="section-card">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
        <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

function DetailBlock({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-base font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function StatsCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; color: string }[];
}) {
  return (
    <Card className="section-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent
        className="grid gap-4 text-center"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-5">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
