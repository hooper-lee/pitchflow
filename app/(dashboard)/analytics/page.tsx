"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Users,
  Send,
  TrendingUp,
  Mail,
  Reply,
} from "lucide-react";

interface Stats {
  totalProspects: number;
  emailsSent: number;
  openRate: number;
  activeCampaigns: number;
}

interface ActivityItem {
  type: "sent" | "opened" | "clicked" | "replied" | "bounced" | "followup";
  prospectName: string | null;
  prospectCompany: string | null;
  campaignName: string;
  stepNumber: number | null;
  timestamp: string;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/analytics").then((res) => res.json()),
      fetch("/api/v1/analytics?type=activity").then((res) => res.json()),
    ])
      .then(([statsResponse, activityResponse]) => {
        setStats(statsResponse.data);
        setActivity(activityResponse.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-shell">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = [
    {
      title: "总客户线索",
      value: stats?.totalProspects || 0,
      icon: Users,
      description: "所有已挖掘的潜在客户",
    },
    {
      title: "邮件发送总量",
      value: stats?.emailsSent || 0,
      icon: Send,
      description: "已发送的所有邮件",
    },
    {
      title: "平均打开率",
      value: `${stats?.openRate || 0}%`,
      icon: TrendingUp,
      description: "所有活动的邮件打开率",
    },
    {
      title: "活动总数",
      value: stats?.activeCampaigns || 0,
      icon: Mail,
      description: "当前账号下已创建的全部营销活动",
    },
  ];

  const activityLabels: Record<ActivityItem["type"], string> = {
    sent: "首封已发送",
    followup: "跟进已发送",
    opened: "客户已打开",
    clicked: "客户已点击",
    replied: "客户已回复",
    bounced: "邮件退回",
  };

  const activityTone: Record<ActivityItem["type"], string> = {
    sent: "bg-slate-100 text-slate-700",
    followup: "bg-blue-100 text-blue-700",
    opened: "bg-amber-100 text-amber-700",
    clicked: "bg-orange-100 text-orange-700",
    replied: "bg-emerald-100 text-emerald-700",
    bounced: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">数据分析</h1>
          <p className="page-subtitle">
          查看你的获客效果和邮件营销数据
          </p>
        </div>
      </div>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <Card key={metric.title} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 pb-3">
              <CardTitle className="text-[13px] font-medium text-slate-500">
                {metric.title}
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <metric.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[1.8rem] font-semibold tracking-tight text-slate-950">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length > 0 ? (
            <div className="space-y-3">
              {activity.slice(0, 8).map((item, index) => (
                <div
                  key={`${item.type}-${item.timestamp}-${index}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${activityTone[item.type]}`}>
                        {activityLabels[item.type]}
                      </span>
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.prospectName || "未命名联系人"} · {item.prospectCompany || "未知公司"}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      活动：{item.campaignName}
                      {item.stepNumber ? ` · 第 ${item.stepNumber} 轮` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-slate-400">
                    {new Date(item.timestamp).toLocaleString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>当前还没有最近活动数据</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>数据说明</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
            <p className="text-sm font-medium text-slate-900">活动总数</p>
            <p className="mt-2 text-sm text-slate-500">统计当前账号下已创建的全部活动，不要求活动必须进行中。</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
            <p className="text-sm font-medium text-slate-900">邮件发送总量</p>
            <p className="mt-2 text-sm text-slate-500">统计实际已经发送成功的邮件，不包含排队中和失败记录。</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <Reply className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-medium text-slate-900">最近活动</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">优先展示发送、跟进、回复等关键动作，方便快速回看最近进展。</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
