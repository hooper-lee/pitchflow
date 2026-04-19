"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

interface CampaignStats {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export default function CampaignAnalyticsPage() {
  const params = useParams();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/campaigns/${params.id}`).then((r) => r.json()),
      fetch(`/api/v1/campaigns/${params.id}/analytics`).then((r) => r.json()),
    ])
      .then(([campaignData, statsData]) => {
        setCampaignName(campaignData.data?.name || "");
        setStats(statsData.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/campaigns/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {campaignName} — 数据分析
          </h1>
          <p className="text-muted-foreground">活动效果数据一览</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "总邮件数", value: stats?.total || 0 },
          { label: "已发送", value: stats?.sent || 0 },
          { label: "已打开", value: stats?.opened || 0 },
          { label: "打开率", value: `${stats?.openRate || 0}%` },
          { label: "点击率", value: `${stats?.clickRate || 0}%` },
          { label: "回复率", value: `${stats?.replyRate || 0}%` },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>邮件状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "已发送", value: stats?.sent || 0, color: "bg-blue-500" },
                { label: "已打开", value: stats?.opened || 0, color: "bg-green-500" },
                { label: "已点击", value: stats?.clicked || 0, color: "bg-yellow-500" },
                { label: "已回复", value: stats?.replied || 0, color: "bg-purple-500" },
                { label: "退回", value: stats?.bounced || 0, color: "bg-red-500" },
              ].map((item) => {
                const max = stats?.sent || 1;
                const pct = Math.round((item.value / max) * 100);
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.value} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>漏斗分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "目标客户", value: stats?.total || 0 },
                { label: "邮件已发送", value: stats?.sent || 0 },
                { label: "邮件已打开", value: stats?.opened || 0 },
                { label: "已点击", value: stats?.clicked || 0 },
                { label: "已回复", value: stats?.replied || 0 },
              ].map((item, i, arr) => {
                const base = arr[0].value || 1;
                const pct = Math.round((item.value / base) * 100);
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div
                      className="h-10 rounded-md bg-primary/10 flex items-center px-3 text-sm font-medium"
                      style={{ width: `${Math.max(pct, 20)}%` }}
                    >
                      {item.label}
                    </div>
                    <span className="text-sm font-bold">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
