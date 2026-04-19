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
import { MoreHorizontal, Eye, Trash2 } from "lucide-react";

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
}

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  researched: "secondary",
  contacted: "outline",
  replied: "default",
  converted: "default",
  bounced: "destructive",
  unsubscribed: "destructive",
};

const statusLabels: Record<string, string> = {
  new: "新线索",
  researched: "已调研",
  contacted: "已联系",
  replied: "已回复",
  converted: "已转化",
  bounced: "退回",
  unsubscribed: "退订",
};

function MiniScore({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const color = score >= 7 ? "text-green-600" : score >= 4 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-sm font-medium ${color}`}>{score}</span>;
}

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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>公司名</TableHead>
            <TableHead>联系人</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>行业</TableHead>
            <TableHead>国家</TableHead>
            <TableHead className="text-center">评分</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>来源</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((prospect) => (
            <TableRow key={prospect.id}>
              <TableCell className="font-medium">
                {prospect.companyName || "—"}
              </TableCell>
              <TableCell>{prospect.contactName || "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {prospect.email || "—"}
              </TableCell>
              <TableCell>{prospect.industry || "—"}</TableCell>
              <TableCell>{prospect.country || "—"}</TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <MiniScore score={prospect.companyScore} />
                  <span className="text-muted-foreground text-xs">/</span>
                  <MiniScore score={prospect.matchScore} />
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={statusColors[prospect.status] || "secondary"}>
                  {statusLabels[prospect.status] || prospect.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {prospect.source || "—"}
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
