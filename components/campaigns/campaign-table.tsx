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
import { Eye, Pause, Play, Sparkles, Users, Send, Reply } from "lucide-react";

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

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  active: { label: "进行中", variant: "default" },
  paused: { label: "已暂停", variant: "outline" },
  completed: { label: "已完成", variant: "secondary" },
  archived: { label: "已归档", variant: "outline" },
};

const campaignTypeMap: Record<string, string> = {
  cold_outreach: "冷启动开发",
  reply_followup: "已回复推进",
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
    <div className="overflow-x-auto rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
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
              <TableRow key={campaign.id} className="border-slate-100">
                <TableCell>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="block rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-slate-100/70"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{campaign.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {campaign.industry || "未填写行业"}
                        </div>
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>{campaign.industry || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Badge variant="outline">
                      {campaignTypeMap[campaign.campaignType || "cold_outreach"]}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-600">
                    <Users className="h-3.5 w-3.5" />
                    {campaign.totalProspects || 0}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-600">
                    <Send className="h-3.5 w-3.5" />
                    {campaign.sentCount || 0}
                  </div>
                </TableCell>
                <TableCell>{campaign.openedCount || 0}</TableCell>
                <TableCell>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                    <Reply className="h-3.5 w-3.5" />
                    {campaign.repliedCount || 0}
                  </div>
                </TableCell>
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
