"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, FileText, Edit, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  angle: string | null;
  isDefault: boolean | null;
  createdAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await fetch(`/api/v1/templates/${id}`, { method: "DELETE" });
    setTemplates(templates.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">邮件模板</h1>
          <p className="text-muted-foreground">
            管理你的邮件模板，使用 AI 生成个性化内容
          </p>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建模板
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="还没有邮件模板"
          description="创建邮件模板，用于批量发送个性化开发信"
          action={
            <Link href="/templates/new">
              <Button>创建模板</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.isDefault && <Badge>默认</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  主题: {template.subject}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body}
                </p>
                {template.angle && (
                  <Badge variant="outline" className="mt-2">
                    {template.angle}
                  </Badge>
                )}
                <div className="flex gap-2 mt-4">
                  <Link href={`/templates/${template.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
