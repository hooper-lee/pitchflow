"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ArrowLeft, Play, Pause, Eye, RefreshCcw, Loader2 } from "lucide-react";
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
  latestReply?: {
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
    fromEmail: string | null;
    fromName: string | null;
    receivedAt: string | null;
  } | null;
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
  followupSteps: Array<{ stepNumber: number; delayDays: number; enabled: boolean }>;
  followupStopAfterDays: number;
  followupScanIntervalMinutes: number;
  emails: Email[];
}

interface CampaignStartEvent {
  type: "status" | "progress" | "done" | "error";
  message?: string;
  processed?: number;
  total?: number;
  successCount?: number;
  failedCount?: number;
  emailCount?: number;
}

interface RetryStreamEvent {
  type: "status" | "done" | "error";
  message?: string;
}

async function readCampaignStartStream(
  response: Response,
  onEvent: (event: CampaignStartEvent) => void
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("流式响应不可用");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as CampaignStartEvent);
    }
  }
}

async function readRetryStream(
  response: Response,
  onEvent: (event: RetryStreamEvent) => void
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("流式响应不可用");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as RetryStreamEvent);
    }
  }
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
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [retryProgressMessage, setRetryProgressMessage] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [startProgress, setStartProgress] = useState<{
    message: string;
    processed: number;
    total: number;
    successCount: number;
    failedCount: number;
  } | null>(null);

  const loadCampaign = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/v1/campaigns/${params.id}`, {
        cache: "no-store",
      });
      const data = await response.json();
      setCampaign(data.data || null);
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  const handleStart = async () => {
    setActionLoading(true);
    setStartProgress({
      message: "正在启动活动",
      processed: 0,
      total: campaign?.totalProspects || 0,
      successCount: 0,
      failedCount: 0,
    });

    try {
      const res = await fetch(`/api/v1/campaigns/${params.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "启动失败", description: data.error, variant: "destructive" });
        setStartProgress(null);
        return;
      }

      await readCampaignStartStream(res, (event) => {
        if (event.type === "error") {
          throw new Error(event.message || "启动失败");
        }

        if (event.type === "done") {
          toast({ title: `活动已启动，已发送 ${event.emailCount || 0} 封邮件` });
          return;
        }

        setStartProgress({
          message: event.message || "正在处理",
          processed: event.processed || 0,
          total: event.total || 0,
          successCount: event.successCount || 0,
          failedCount: event.failedCount || 0,
        });
      });

      await loadCampaign();
    } catch {
      toast({ title: "启动失败", variant: "destructive" });
    } finally {
      setStartProgress(null);
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/v1/campaigns/${params.id}/pause`, { method: "POST" });
      toast({ title: "活动已暂停" });
      await loadCampaign();
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async (emailId: string) => {
    setRetryingEmailId(emailId);
    setRetryProgressMessage("正在准备重新同步");
    try {
      const response = await fetch(
        `/api/v1/campaigns/${params.id}/emails/${emailId}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream: true }),
        }
      );

      if (!response.ok) {
        const payload = await response.json();
        toast({
          title: "重新同步失败",
          description: payload.error || "请稍后重试",
          variant: "destructive",
        });
        return;
      }

      await readRetryStream(response, (event) => {
        if (event.type === "error") {
          throw new Error(event.message || "重新同步失败");
        }

        if (event.type === "status") {
          setRetryProgressMessage(event.message || "正在重新同步");
          return;
        }

        if (event.type === "done") {
          toast({ title: "已重新加入发送队列" });
        }
      });

      await loadCampaign();
    } catch {
      toast({ title: "重新同步失败", variant: "destructive" });
    } finally {
      setRetryingEmailId(null);
      setRetryProgressMessage("");
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
  const sentStatuses = new Set(["sent", "delivered", "opened", "clicked", "replied"]);
  const sentCount = campaign.emails.filter((email) => sentStatuses.has(email.status)).length;
  const openedCount = campaign.emails.filter(
    (email) => (email.openCount || 0) > 0 || !!email.openedAt || ["opened", "clicked", "replied"].includes(email.status)
  ).length;
  const clickedCount = campaign.emails.filter(
    (email) => (email.clickCount || 0) > 0 || !!email.repliedAt || ["clicked", "replied"].includes(email.status)
  ).length;
  const repliedCount = campaign.emails.filter(
    (email) => !!email.repliedAt || email.status === "replied"
  ).length;
  const enabledFollowupDays = campaign.followupSteps
    .filter((step) => step.enabled)
    .map((step) => step.delayDays)
    .join(" / ");

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自动跟进说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            系统每 {campaign.followupScanIntervalMinutes} 分钟自动扫描一次；达到延迟时间且客户未回复时，会发送下一轮邮件。
          </p>
          <p>
            当前启用延迟：{enabledFollowupDays || "未配置"} 天；最后一轮发出后超过 {campaign.followupStopAfterDays} 天仍未回复，则停止继续跟进。
          </p>
          <p>当活动内客户都已回复，或都已到达停止跟进条件后，活动会自动标记为已完成。</p>
        </CardContent>
      </Card>

      {actionLoading && startProgress && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">AI 邮件生成进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{startProgress.message}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: `${startProgress.total > 0 ? (startProgress.processed / startProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-slate-500">
              <span>已处理 {startProgress.processed}/{startProgress.total}</span>
              <span>成功 {startProgress.successCount}</span>
              <span>失败 {startProgress.failedCount}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {retryingEmailId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">邮件重新同步进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{retryProgressMessage || "正在重新同步邮件"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
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
            <div className="text-2xl font-bold">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已打开
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已点击
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              已回复
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repliedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-950">邮件列表</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.emails.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {campaign.status === "draft"
                ? "启动活动后将在此显示邮件列表"
                : "暂无邮件记录"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[24px] border border-slate-200/80 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>联系人</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>主题</TableHead>
                    <TableHead>轮次</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>打开</TableHead>
                    <TableHead>点击</TableHead>
                    <TableHead>发送时间</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.emails.map((email) => (
                    <TableRow key={email.id} className="border-slate-100">
                      <TableCell>
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                          <div className="font-medium text-slate-900">{email.prospectName || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800">{email.prospectCompany || "—"}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {email.prospectEmail || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[260px] rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 truncate">
                          {email.subject || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        第 {email.stepNumber || 1} 轮
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {emailStatusLabels[email.status] || email.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{email.openCount || 0}</TableCell>
                      <TableCell>{email.clickCount || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleString("zh-CN")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {["failed", "bounced"].includes(email.status) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={retryingEmailId === email.id}
                              onClick={() => void handleRetry(email.id)}
                            >
                              <RefreshCcw className={`h-4 w-4 ${retryingEmailId === email.id ? "animate-spin" : ""}`} />
                              <span className="ml-1">
                                {retryingEmailId === email.id ? "同步中..." : "重新同步"}
                              </span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmail(email)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
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
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto rounded-[28px] border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-blue-50/40">
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-950">
              {selectedEmail?.subject || "无主题"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              收件人: {selectedEmail?.prospectName || "—"} ({selectedEmail?.prospectEmail || "—"})
              {selectedEmail?.prospectCompany ? ` — ${selectedEmail.prospectCompany}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Outbound Email
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {selectedEmail?.body || "暂无内容"}
            </div>
          </div>
          {selectedEmail?.latestReply && (
            <div className="mt-6 rounded-[24px] border border-blue-200 bg-blue-50/60 p-6 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                Latest Reply
              </div>
              <div className="text-xs text-slate-500">
                {selectedEmail.latestReply.fromName || "未知联系人"}
                {selectedEmail.latestReply.fromEmail
                  ? ` <${selectedEmail.latestReply.fromEmail}>`
                  : ""}
                {selectedEmail.latestReply.receivedAt
                  ? ` · ${new Date(selectedEmail.latestReply.receivedAt).toLocaleString("zh-CN")}`
                  : ""}
              </div>
              {selectedEmail.latestReply.subject && (
                <div className="text-sm font-semibold text-slate-900">
                  {selectedEmail.latestReply.subject}
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {selectedEmail.latestReply.textBody ||
                  selectedEmail.latestReply.htmlBody ||
                  "暂无回复正文"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
