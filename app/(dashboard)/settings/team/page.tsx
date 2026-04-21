"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default function TeamPage() {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/v1/team")
      .then((res) => res.json())
      .then((data) => setMembers(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = async () => {
    const response = await fetch("/api/v1/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });

    if (!response.ok) {
      toast({ title: "邀请失败", variant: "destructive" });
      return;
    }

    toast({ title: "邀请已发送" });
    setInviteOpen(false);
    setInviteEmail("");
    window.location.reload();
  };

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">团队管理</h1>
            <p className="page-subtitle">管理成员权限与协作范围，邀请邮箱加入当前工作区。</p>
          </div>
        </div>
      </div>

      <div className="metric-grid md:grid-cols-3">
        <Card className="section-card">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">团队成员</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{members.length}</p>
            <p className="mt-2 text-sm text-slate-500">统一查看管理员、成员和只读账号。</p>
          </CardContent>
        </Card>
        <Card className="section-card md:col-span-2">
          <CardContent className="flex h-full items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-900">快速邀请成员</p>
              <p className="mt-1 text-sm text-slate-500">通过邮箱发送邀请，成员加入后可共享客户、模板和活动。</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  邀请成员
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px] border-slate-200/80 bg-white">
                <DialogHeader>
                  <DialogTitle>邀请团队成员</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>
                  <Button onClick={handleInvite}>发送邀请</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card className="section-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>成员列表</CardTitle>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            共 {members.length} 人
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-muted-foreground">加载中...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>成员</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>加入时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name || "—"}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === "team_admin" ? "default" : "secondary"}>
                        {member.role === "team_admin"
                          ? "管理员"
                          : member.role === "member"
                            ? "成员"
                            : member.role === "viewer"
                              ? "只读"
                              : member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
