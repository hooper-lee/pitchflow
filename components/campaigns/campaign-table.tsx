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
import { Eye, Pause, Play, Trash2 } from "lucide-react";

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

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  active: { label: "进行中", variant: "default" },
  paused: { label: "已暂停", variant: "outline" },
  completed: { label: "已完成", variant: "secondary" },
  archived: { label: "已归档", variant: "outline" },
};

export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  const handlePause = async (id: string) => {
    await fetch(`/api/v1/campaigns/${id}/pause`, { method: "POST" });
    window.location.reload();
  };

  const handleStart = async (id: string) => {
    await fetch(`/api/v1/campaigns/${id}/send`, { method: "POST" });
    window.location.reload();
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>活动名称</TableHead>
            <TableHead>行业</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>客户数</TableHead>
            <TableHead>已发送</TableHead>
            <TableHead>已打开</TableHead>
            <TableHead>已回复</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const status = statusMap[campaign.status] || statusMap.draft;
            return (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="hover:underline"
                  >
                    {campaign.name}
                  </Link>
                </TableCell>
                <TableCell>{campaign.industry || "—"}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>{campaign.totalProspects || 0}</TableCell>
                <TableCell>{campaign.sentCount || 0}</TableCell>
                <TableCell>{campaign.openedCount || 0}</TableCell>
                <TableCell>{campaign.repliedCount || 0}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(campaign.createdAt).toLocaleDateString("zh-CN")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {campaign.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePause(campaign.id)}
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {campaign.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleStart(campaign.id)}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
