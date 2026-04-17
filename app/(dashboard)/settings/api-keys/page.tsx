"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, Copy, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[] | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/api-keys")
      .then((res) => res.json())
      .then((data) => setKeys(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });

    if (res.ok) {
      const data = await res.json();
      setNewKey(data.data.key);
      setCreateOpen(false);
      setNewKeyName("");
      window.location.reload();
    } else {
      toast({ title: "创建失败", variant: "destructive" });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("确定撤销此 API Key？")) return;
    await fetch(`/api/v1/api-keys/${id}/revoke`, { method: "POST" });
    toast({ title: "API Key 已撤销" });
    window.location.reload();
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast({ title: "已复制到剪贴板" });
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
          <h1 className="text-3xl font-bold tracking-tight">API Key 管理</h1>
          <p className="text-muted-foreground">创建和管理 API 密钥</p>
        </div>
      </div>

      {newKey && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">
              请立即复制你的 API Key（仅显示一次）:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-background rounded text-sm break-all">
                {newKey}
              </code>
              <Button variant="outline" size="sm" onClick={copyKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>API Keys</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                创建 Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建 API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">名称</Label>
                  <Input
                    id="name"
                    placeholder="如：生产环境 Key"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate}>创建</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4 text-muted-foreground">加载中...</p>
          ) : keys.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              还没有 API Key
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>前缀</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {key.keyPrefix}...
                    </TableCell>
                    <TableCell>
                      {key.revokedAt ? (
                        <span className="text-destructive">已撤销</span>
                      ) : (
                        <span className="text-green-600">有效</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString("zh-CN")
                        : "从未"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell>
                      {!key.revokedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(key.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
