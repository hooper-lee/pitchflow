"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-3xl page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">管理你的账号和系统配置</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>你的账号基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" value={session?.user?.name || ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" value={session?.user?.email || ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Input value={session?.user?.role || "member"} readOnly />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/settings/team">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">团队管理</CardTitle>
              <CardDescription>邀请成员、管理权限</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/api-keys">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">API Key 管理</CardTitle>
              <CardDescription>创建和管理 API 密钥</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/mailboxes">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">邮箱账号</CardTitle>
              <CardDescription>连接自己的邮箱用于发信和读取回复</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/product-profile">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">产品资料</CardTitle>
              <CardDescription>配置无模板生成邮件时的默认产品和卖点</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/agent">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">数字员工</CardTitle>
              <CardDescription>启用、停用和管理 Hemera Agent</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/alerts">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">告警配置</CardTitle>
              <CardDescription>飞书、企微等通知渠道</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/billing">
          <Card className="cursor-pointer transition-colors hover:bg-slate-50">
            <CardHeader>
              <CardTitle className="text-base">套餐与计费</CardTitle>
              <CardDescription>查看和升级你的套餐</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
