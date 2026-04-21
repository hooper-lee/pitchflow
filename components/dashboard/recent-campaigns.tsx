"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalProspects: number;
  sentCount: number;
  openedCount: number;
  createdAt: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  active: { label: "进行中", variant: "default" },
  paused: { label: "已暂停", variant: "outline" },
  completed: { label: "已完成", variant: "secondary" },
  archived: { label: "已归档", variant: "outline" },
};

export function RecentCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/campaigns?limit=5")
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data.data?.items || data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">最近活动</CardTitle>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm">
            查看全部
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            还没有营销活动
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const status = statusMap[campaign.status] || statusMap.draft;
              return (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3"
                >
                  <div className="space-y-1">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {campaign.sentCount}/{campaign.totalProspects} 已发送
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
