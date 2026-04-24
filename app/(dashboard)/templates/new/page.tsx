import { TemplateEditor } from "@/components/templates/template-editor";

export default function NewTemplatePage() {
  return (
    <div className="max-w-4xl page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">新建邮件素材</h1>
          <p className="page-subtitle">
            创建 AI 生成邮件时参考的产品卖点、语气和正文素材
          </p>
        </div>
      </div>
      <TemplateEditor />
    </div>
  );
}
