"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    const res = await fetch("/api/v1/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });

    if (res.ok) {
      toast({ title: "邀请已发送" });
      setInviteOpen(false);
      setInviteEmail("");
      window.location.reload();
    } else {
      toast({ title: "邀请失败", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">团队管理</h1>
          <p className="text-muted-foreground">管理团队成员和权限</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>团队成员</CardTitle>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                邀请成员
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleInvite}>发送邀请</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-muted-foreground">加载中...</p>
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
                        {member.role === "team_admin" ? "管理员" : member.role === "member" ? "成员" : member.role === "viewer" ? "只读" : member.role}
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
