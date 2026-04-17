"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { ProspectTable } from "@/components/prospects/prospect-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Users } from "lucide-react";

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/v1/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data || []);
    } catch {
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">
            管理你的潜在客户线索
          </p>
        </div>
        <Link href="/prospects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            挖掘客户
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-72">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="搜索公司名、联系人、邮箱..."
          />
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="new">新线索</TabsTrigger>
          <TabsTrigger value="contacted">已联系</TabsTrigger>
          <TabsTrigger value="replied">已回复</TabsTrigger>
          <TabsTrigger value="converted">已转化</TabsTrigger>
        </TabsList>
        <TabsContent value={statusFilter} className="mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : prospects.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="还没有客户线索"
              description="使用智能客户挖掘功能，快速找到目标客户"
              action={
                <Link href="/prospects/new">
                  <Button>开始挖掘</Button>
                </Link>
              }
            />
          ) : (
            <ProspectTable prospects={prospects} onRefresh={fetchProspects} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
