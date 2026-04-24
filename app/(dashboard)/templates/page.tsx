"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/templates?page=${page}&limit=9`)
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.data?.items || []);
        setTotal(data.data?.total || 0);
        setTotalPages(data.data?.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此邮件素材？")) return;
    await fetch(`/api/v1/templates/${id}`, { method: "DELETE" });
    setTemplates(templates.filter((t) => t.id !== id));
    setTotal((current) => Math.max(0, current - 1));
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">邮件素材</h1>
          <p className="page-subtitle">
            管理 AI 生成邮件时参考的产品卖点、语气和正文素材
          </p>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            新建素材
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="还没有邮件素材"
          description="创建邮件素材，让 AI 为每个客户生成个性化邮件"
          action={
            <Link href="/templates/new">
              <Button>创建素材</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.isDefault && <Badge>默认</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-muted-foreground">
                    主题: {template.subject}
                  </p>
                  <p className="line-clamp-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm text-muted-foreground">
                    {template.body}
                  </p>
                  {template.angle && (
                    <Badge variant="outline" className="mt-2">
                      {template.angle}
                    </Badge>
                  )}
                  <div className="mt-4 flex gap-2">
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
          <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            itemLabel="个素材"
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
