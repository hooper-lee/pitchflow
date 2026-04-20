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
} from "lucide-react";

interface Stats {
  totalProspects: number;
  emailsSent: number;
  openRate: number;
  activeCampaigns: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics")
      .then((res) => res.json())
      .then((data) => setStats(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
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
      title: "活跃活动",
      value: stats?.activeCampaigns || 0,
      icon: Mail,
      description: "当前进行中的营销活动",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">数据分析</h1>
        <p className="text-muted-foreground">
          查看你的获客效果和邮件营销数据
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>数据概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>创建活动并发送邮件后，图表将在此显示</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
