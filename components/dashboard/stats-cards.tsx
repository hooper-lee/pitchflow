"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, BarChart3, Send } from "lucide-react";

interface DashboardStats {
  totalProspects: number;
  emailsSent: number;
  openRate: number;
  activeCampaigns: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProspects: 0,
    emailsSent: 0,
    openRate: 0,
    activeCampaigns: 0,
  });

  useEffect(() => {
    fetch("/api/v1/analytics")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setStats(data.data);
        }
      })
      .catch(() => {
        // Keep default zeros
      });
  }, []);

  const cards = [
    {
      title: "客户线索",
      value: stats.totalProspects,
      icon: Users,
      description: "已挖掘的潜在客户",
    },
    {
      title: "邮件发送",
      value: stats.emailsSent,
      icon: Send,
      description: "本月已发送邮件",
    },
    {
      title: "打开率",
      value: `${stats.openRate}%`,
      icon: BarChart3,
      description: "邮件打开率",
    },
    {
      title: "活跃活动",
      value: stats.activeCampaigns,
      icon: Mail,
      description: "进行中的营销活动",
    },
  ];

  return (
    <div className="metric-grid">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 pb-3">
            <CardTitle className="text-[13px] font-medium text-slate-500">{card.title}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[1.8rem] font-semibold tracking-tight text-slate-950">{card.value}</div>
            <p className="text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
