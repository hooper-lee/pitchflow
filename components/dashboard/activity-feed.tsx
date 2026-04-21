"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ActivityItem {
  type: "sent" | "opened" | "clicked" | "replied" | "bounced" | "followup";
  prospectName: string | null;
  prospectCompany: string | null;
  campaignName: string;
  stepNumber: number | null;
  timestamp: string;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  sent: { label: "已发送", color: "bg-blue-500" },
  opened: { label: "已打开", color: "bg-green-500" },
  clicked: { label: "已点击", color: "bg-yellow-500" },
  replied: { label: "已回复", color: "bg-purple-500" },
  bounced: { label: "退回", color: "bg-red-500" },
  followup: { label: "跟进已发送", color: "bg-cyan-500" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/analytics?type=activity")
      .then((res) => res.json())
      .then((data) => setActivities(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">最近动态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-2 w-2 mt-2 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded w-48" />
              </div>
            ))
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              创建营销活动后，将在此显示动态
            </p>
          ) : (
            activities.slice(0, 15).map((item, i) => {
              const config = typeConfig[item.type] || typeConfig.sent;
              const name = item.prospectName || item.prospectCompany || "未知客户";
              return (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <div className={`h-2 w-2 mt-2 rounded-full ${config.color}`} />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {config.label}
                      </Badge>
                      <span className="text-sm">
                        {name}
                        {item.stepNumber && item.stepNumber > 1
                          ? `（第 ${item.stepNumber} 轮）`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.campaignName}</span>
                      <span>·</span>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
