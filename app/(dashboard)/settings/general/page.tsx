"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GeneralSettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(session?.user?.name || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        await update({ name });
        toast({ title: "个人信息已更新" });
      } else {
        toast({ title: "保存失败", variant: "destructive" });
      }
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl font-bold tracking-tight">通用设置</h1>
          <p className="text-muted-foreground">管理你的个人信息</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>更新你的姓名和其他基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" value={session?.user?.email || ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Input value={session?.user?.role || "member"} readOnly disabled />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存修改"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
