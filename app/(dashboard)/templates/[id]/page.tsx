"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TemplateEditor } from "@/components/templates/template-editor";
import { Skeleton } from "@/components/ui/skeleton";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  angle: string | null;
  isDefault: boolean | null;
}

export default function EditTemplatePage() {
  const params = useParams();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/templates/${params.id}`)
      .then((res) => res.json())
      .then((data) => setTemplate(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!template) {
    return <div>模板未找到</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">编辑模板</h1>
        <p className="text-muted-foreground">{template.name}</p>
      </div>
      <TemplateEditor template={template} />
    </div>
  );
}
