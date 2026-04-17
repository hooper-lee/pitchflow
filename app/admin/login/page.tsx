"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("邮箱或密码错误");
        return;
      }

      // Verify the user is a super_admin
      const res = await fetch("/api/auth/session");
      const session = await res.json();

      if (session?.user?.role !== "super_admin") {
        setError("此入口仅限超级管理员登录");
        // Sign them out since they're not admin
        await signIn("credentials", {
          email: "",
          password: "",
          redirect: false,
        });
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-destructive flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive-foreground" />
            </div>
            <CardTitle className="text-2xl">平台管理后台</CardTitle>
            <CardDescription>
              仅限超级管理员登录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">管理员邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@aquaclaw.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "验证中..." : "登录管理后台"}
              </Button>
            </form>
          </CardContent>
          <div className="pb-6 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              返回用户登录 →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
