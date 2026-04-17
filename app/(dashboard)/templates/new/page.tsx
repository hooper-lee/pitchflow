import { TemplateEditor } from "@/components/templates/template-editor";

export default function NewTemplatePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">新建邮件模板</h1>
        <p className="text-muted-foreground">
          创建邮件模板，支持 AI 生成个性化内容
        </p>
      </div>
      <TemplateEditor />
    </div>
  );
}
