"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { Plus, Mail } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  campaignType?: string | null;
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/campaigns?page=${page}&limit=12`)
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data.data?.items || []);
        setTotal(data.data?.total || 0);
        setTotalPages(data.data?.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">活动管理</h1>
          <p className="page-subtitle">
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
        <>
          <CampaignTable campaigns={campaigns} />
          <div className="pt-2">
            <ListPagination
              page={page}
              totalPages={totalPages}
              total={total}
              itemLabel="个活动"
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
