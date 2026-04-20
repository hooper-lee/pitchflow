"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { ProspectTable } from "@/components/prospects/prospect-table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, ChevronLeft, ChevronRight } from "lucide-react";

type ProspectItem = Awaited<ReturnType<typeof fetch>> extends never ? never : {
  id: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  industry: string | null;
  country: string | null;
  companyScore: number | null;
  matchScore: number | null;
  status: string;
  source: string | null;
  createdAt: string;
  researchStatus?: string | null;
  aiSummary?: string | null;
  employeeCount?: string | null;
  companyType?: string | null;
  websiteScore?: number | null;
  icpFitScore?: number | null;
  buyingIntentScore?: number | null;
  reachabilityScore?: number | null;
  dealPotentialScore?: number | null;
  riskPenaltyScore?: number | null;
  overallScore?: number | null;
  leadGrade?: string | null;
  priorityLevel?: number | null;
  recommendedAction?: string | null;
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leadGradeFilter, setLeadGradeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (leadGradeFilter !== "all") params.set("leadGrade", leadGradeFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/v1/prospects?${params}`);
      const data = await res.json();
      setProspects(data.data?.items || []);
      setTotal(data.data?.total || 0);
      setTotalPages(data.data?.totalPages || 1);
    } catch {
      setProspects([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, leadGradeFilter, page]);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // Reset to page 1 when filter changes
  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

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
            onChange={handleSearchChange}
            placeholder="搜索公司名、联系人、邮箱..."
          />
        </div>
        <div className="w-40">
          <Select
            value={leadGradeFilter}
            onValueChange={(value) => {
              setLeadGradeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="等级筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部等级</SelectItem>
              <SelectItem value="A">A 级</SelectItem>
              <SelectItem value="B">B 级</SelectItem>
              <SelectItem value="C">C 级</SelectItem>
              <SelectItem value="D">D 级</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            共 {total} 条客户
          </span>
        )}
      </div>

      <Tabs value={statusFilter} onValueChange={handleStatusChange}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="new">新线索</TabsTrigger>
          <TabsTrigger value="research">调研</TabsTrigger>
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
            <>
              <ProspectTable prospects={prospects} onRefresh={fetchProspects} />
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    第 {page} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
