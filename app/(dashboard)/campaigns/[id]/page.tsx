"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Play, Pause, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Email {
  id: string;
  subject: string | null;
  body: string | null;
  status: string;
  stepNumber: number | null;
  sentAt: string | null;
  openedAt: string | null;
  repliedAt: string | null;
  openCount: number | null;
  clickCount: number | null;
  prospectName: string | null;
  prospectEmail: string | null;
  prospectCompany: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  industry: string | null;
  targetPersona: string | null;
  totalProspects: number | null;
  sentCount: number | null;
  openedCount: number | null;
  repliedCount: number | null;
  emails: Email[];
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  active: { label: "进行中", variant: "default" },
  paused: { label: "已暂停", variant: "outline" },
  completed: { label: "已完成", variant: "secondary" },
};

const emailStatusLabels: Record<string, string> = {
  queued: "排队中",
  sent: "已发送",
  delivered: "已送达",
  opened: "已打开",
  clicked: "已点击",
  replied: "已回复",
  bounced: "退回",
  failed: "发送失败",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    fetch(`/api/v1/campaigns/${params.id}`)
      .then((res) => res.json())
      .then((data) => setCampaign(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${params.id}/send`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `活动已启动，已发送 ${data.data?.emailCount || 0} 封邮件` });
        window.location.reload();
      } else {
        toast({ title: "启动失败", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "启动失败", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/campaigns/${params.id}/pause`, { method: "POST" });
      toast({ title: "活动已暂停" });
      window.location.reload();
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return <div>活动未找到</div>;
  }

  const status = statusMap[campaign.status] || statusMap.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={status.variant}>{status.label}</Badge>
              {campaign.industry && (
                <Badge variant="outline">{campaign.industry}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button onClick={handleStart} disabled={actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              启动活动
            </Button>
          )}
          {campaign.status === "active" && (
            <Button variant="outline" onClick={handlePause} disabled={actionLoading}>
              <Pause className="mr-2 h-4 w-4" />
              暂停
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              目标客户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.totalProspects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已发送
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.sentCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已打开
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.openedCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已回复
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.repliedCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>邮件列表</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.emails.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {campaign.status === "draft"
                ? "启动活动后将在此显示邮件列表"
                : "暂无邮件记录"}
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>联系人</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>主题</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>打开次数</TableHead>
                    <TableHead>发送时间</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>{email.prospectName || "—"}</TableCell>
                      <TableCell>{email.prospectCompany || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {email.prospectEmail || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {email.subject || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {emailStatusLabels[email.status] || email.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{email.openCount || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleString("zh-CN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject || "无主题"}</DialogTitle>
            <DialogDescription>
              收件人: {selectedEmail?.prospectName || "—"} ({selectedEmail?.prospectEmail || "—"})
              {selectedEmail?.prospectCompany ? ` — ${selectedEmail.prospectCompany}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm mt-4">
            {selectedEmail?.body || "暂无内容"}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
