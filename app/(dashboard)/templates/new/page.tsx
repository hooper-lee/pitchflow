import { TemplateEditor } from "@/components/templates/template-editor";

export default function NewTemplatePage() {
  return (
    <div className="max-w-4xl page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">新建邮件模板</h1>
          <p className="page-subtitle">
          创建邮件模板，可为该模板单独指定发件邮箱
          </p>
        </div>
      </div>
      <TemplateEditor />
    </div>
  );
}
