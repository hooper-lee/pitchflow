"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
  alerts: {
    today: { highIntent: number; clicked: number; replied: number };
    thisWeek: { highIntent: number; clicked: number; replied: number };
  };
  emailQueue: { queued: number; failed: number };
}

export default function AdminTasksPage() {
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/tasks")
      .then((res) => res.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">定时任务</h1>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">定时任务</h1>
        <p className="text-muted-foreground">监控自动跟进和高意向告警状态</p>
      </div>

      {/* Follow-up Status */}
      <Card>
        <CardHeader>
          <CardTitle>自动跟进</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">定时频率</p>
              <p className="text-lg font-semibold font-mono">
                {data?.followup.cronSchedule || "*/15 * * * *"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">待跟进邮件数</p>
              <p className="text-2xl font-bold">{data?.followup.pendingCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">上次执行</p>
              {data?.followup.lastRun ? (
                <div>
                  <p className="text-sm font-medium">
                    {new Date(data.followup.lastRun.time).toLocaleString("zh-CN")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.followup.lastRun.campaignName} — 第 {data.followup.lastRun.stepNumber} 轮
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无执行记录</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>今日告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {data?.alerts.today.highIntent || 0}
                </p>
                <p className="text-xs text-muted-foreground">高意向</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">
                  {data?.alerts.today.clicked || 0}
                </p>
                <p className="text-xs text-muted-foreground">点击</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">
                  {data?.alerts.today.replied || 0}
                </p>
                <p className="text-xs text-muted-foreground">回复</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>本周告警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {data?.alerts.thisWeek.highIntent || 0}
                </p>
                <p className="text-xs text-muted-foreground">高意向</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">
                  {data?.alerts.thisWeek.clicked || 0}
                </p>
                <p className="text-xs text-muted-foreground">点击</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">
                  {data?.alerts.thisWeek.replied || 0}
                </p>
                <p className="text-xs text-muted-foreground">回复</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Queue */}
      <Card>
        <CardHeader>
          <CardTitle>邮件队列</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline">排队中</Badge>
              <span className="text-2xl font-bold">{data?.emailQueue.queued || 0}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="destructive">发送失败</Badge>
              <span className="text-2xl font-bold">{data?.emailQueue.failed || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
