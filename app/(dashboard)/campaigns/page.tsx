"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { Plus, Mail } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  totalProspects: number | null;
  sentCount: number | null;
  openedCount: number | null;
  repliedCount: number | null;
  createdAt: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/campaigns")
      .then((res) => res.json())
      .then((data) => setCampaigns(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">活动管理</h1>
          <p className="text-muted-foreground">
            创建和管理你的邮件营销活动
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建活动
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-12 w-12" />}
          title="还没有营销活动"
          description="创建你的第一个邮件营销活动，开始触达目标客户"
          action={
            <Link href="/campaigns/new">
              <Button>创建活动</Button>
            </Link>
          }
        />
      ) : (
        <CampaignTable campaigns={campaigns} />
      )}
    </div>
  );
}
