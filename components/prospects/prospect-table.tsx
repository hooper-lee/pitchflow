"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Trash2, Sparkles } from "lucide-react";

interface Prospect {
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
  // 新增：调研信息
  researchStatus?: string | null;
  aiSummary?: string | null;
  employeeCount?: string | null;
  companyType?: string | null;
  // 新增：评分信息
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
}

function isResearchInProgress(status?: string | null) {
  return status === "pending" || status === "processing";
}

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  contacted: "outline",
  replied: "default",
  converted: "default",
  bounced: "destructive",
  unsubscribed: "destructive",
};

const statusLabels: Record<string, string> = {
  new: "新线索",
  contacted: "已联系",
  replied: "已回复",
  converted: "已转化",
  bounced: "退回",
  unsubscribed: "退订",
};

// Lead Grade 颜色
const leadGradeColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  A: "default", // 绿色
  B: "secondary", // 黄色
  C: "outline", // 橙色
  D: "destructive", // 灰色
};

const leadGradeLabels: Record<string, string> = {
  A: "A 级",
  B: "B 级",
  C: "C 级",
  D: "D 级",
};

export function ProspectTable({
  prospects,
  onRefresh,
}: {
  prospects: Prospect[];
  onRefresh: () => void;
}) {
  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此客户线索？")) return;
    await fetch(`/api/v1/prospects/${id}`, { method: "DELETE" });
    onRefresh();
  };

  // 处理调研
  const handleResearch = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/prospects/${id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error("Research failed:", err);
    }
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[320px]">客户</TableHead>
            <TableHead>国家</TableHead>
            <TableHead className="text-center">搜索评分</TableHead>
            <TableHead className="text-center">等级</TableHead>
            <TableHead className="text-center">调研评分</TableHead>
            <TableHead className="text-center">调研状态</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="min-w-[180px]">推荐动作</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((prospect) => (
            <TableRow key={prospect.id}>
              <TableCell className="align-top">
                <div className="min-w-0 space-y-1">
                  <div className="font-medium truncate">
                    {prospect.companyName || "—"}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {prospect.contactName || "未填写联系人"}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {prospect.email || "未填写邮箱"}
                  </div>
                </div>
              </TableCell>
              <TableCell>{prospect.country || "—"}</TableCell>
              <TableCell className="text-center">
                {prospect.companyScore !== null && prospect.companyScore !== undefined ? (
                  <span
                    className={
                      prospect.companyScore >= 75
                        ? "text-green-600 font-medium"
                        : prospect.companyScore >= 50
                        ? "text-yellow-600 font-medium"
                        : prospect.companyScore >= 25
                        ? "text-orange-500 font-medium"
                        : "text-gray-400"
                    }
                  >
                    {prospect.companyScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {prospect.leadGrade ? (
                  <Badge variant={leadGradeColors[prospect.leadGrade] || "secondary"}>
                    {leadGradeLabels[prospect.leadGrade] || prospect.leadGrade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {prospect.overallScore !== null && prospect.overallScore !== undefined ? (
                  <span
                    className={
                      prospect.overallScore >= 75
                        ? "text-green-600 font-medium"
                        : prospect.overallScore >= 50
                        ? "text-yellow-600 font-medium"
                        : prospect.overallScore >= 25
                        ? "text-orange-500 font-medium"
                        : "text-gray-400"
                    }
                  >
                    {prospect.overallScore}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {prospect.researchStatus === "completed" ? (
                  <Badge variant="secondary" className="bg-green-50 text-green-700">
                    <Sparkles className="h-3 w-3 mr-1" />
                    已完成
                  </Badge>
                ) : isResearchInProgress(prospect.researchStatus) ? (
                  <Badge variant="outline">调研中</Badge>
                ) : prospect.researchStatus === "failed" ? (
                  <Badge variant="destructive">失败</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResearch(prospect.id)}
                    className="h-6 text-xs"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    发起调研
                  </Button>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusColors[prospect.status] || "secondary"}>
                  {statusLabels[prospect.status] || prospect.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <div className="max-w-[180px] truncate">
                {prospect.recommendedAction || "—"}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/prospects/${prospect.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        查看详情
                      </Link>
                    </DropdownMenuItem>
                    {prospect.researchStatus !== "completed" && !isResearchInProgress(prospect.researchStatus) && (
                      <DropdownMenuItem onClick={() => handleResearch(prospect.id)}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        发起调研
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDelete(prospect.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
