"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Paperclip, X } from "lucide-react";

const TEMPLATE_VARIABLES = [
  { name: "{{contactName}}", desc: "联系人姓名（从挖掘数据获取）" },
  { name: "{{companyName}}", desc: "公司名称（从挖掘数据获取）" },
  { name: "{{industry}}", desc: "行业（从挖掘数据或活动配置获取）" },
  { name: "{{productName}}", desc: "产品/服务名称（在下方配置）" },
  { name: "{{senderName}}", desc: "发件人姓名（在下方配置）" },
  { name: "{{researchSummary}}", desc: "客户调研摘要（AI 自动生成）" },
];

interface Attachment {
  filename: string;
  url: string;
  size?: number;
}

interface TemplateEditorProps {
  template?: {
    id: string;
    name: string;
    subject: string;
    body: string;
    angle: string | null;
    productName: string | null;
    senderName: string | null;
    senderEmail: string | null;
    attachments: Attachment[] | null;
    isDefault: boolean | null;
  };
}

export function TemplateEditor({ template }: TemplateEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    fetch("/api/v1/plan")
      .then((res) => res.json())
      .then((data) => setPlan(data.data?.plan || "free"))
      .catch(() => {});
  }, []);

  const canUseAttachments = plan !== "free";
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [angle, setAngle] = useState(template?.angle || "");
  const [productName, setProductName] = useState(template?.productName || "");
  const [senderName, setSenderName] = useState(template?.senderName || "");
  const [senderEmail, setSenderEmail] = useState(template?.senderEmail || "");
  const [attachments, setAttachments] = useState<Attachment[]>(
    template?.attachments || []
  );
  const [newAttachUrl, setNewAttachUrl] = useState("");
  const [newAttachName, setNewAttachName] = useState("");
  const [insertTarget, setInsertTarget] = useState<"subject" | "body">("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    if (insertTarget === "subject") {
      const el = subjectRef.current;
      if (el) {
        const start = el.selectionStart ?? subject.length;
        const end = el.selectionEnd ?? subject.length;
        const newValue = subject.slice(0, start) + variable + subject.slice(end);
        setSubject(newValue);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + variable.length, start + variable.length);
        });
      } else {
        setSubject((prev) => prev + variable);
      }
    } else {
      const el = bodyRef.current;
      if (el) {
        const start = el.selectionStart ?? body.length;
        const end = el.selectionEnd ?? body.length;
        const newValue = body.slice(0, start) + variable + body.slice(end);
        setBody(newValue);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + variable.length, start + variable.length);
        });
      } else {
        setBody((prev) => prev + variable);
      }
    }
  };

  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/v1/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "outreach",
          prospectName: "{{contactName}}",
          companyName: "{{companyName}}",
          industry: "{{industry}}",
          country: "your target market",
          productName: productName || "{{productName}}",
          senderName: senderName || "{{senderName}}",
          angle: angle || undefined,
        }),
      });

      const data = await res.json();
      if (data.data) {
        if (data.data.subject) setSubject(data.data.subject);
        if (data.data.body) setBody(data.data.body);
        toast({ title: "AI 生成成功" });
      } else {
        toast({
          title: "AI 生成失败",
          description: data.error || "请检查 API Key 配置",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "AI 生成失败",
        description: "请检查 API Key 配置",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const addAttachment = () => {
    if (!newAttachUrl || !newAttachName) {
      toast({ title: "请填写文件名和链接", variant: "destructive" });
      return;
    }
    setAttachments((prev) => [
      ...prev,
      { filename: newAttachName, url: newAttachUrl },
    ]);
    setNewAttachUrl("");
    setNewAttachName("");
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = template
        ? `/api/v1/templates/${template.id}`
        : "/api/v1/templates";
      const method = template ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          body,
          angle: angle || undefined,
          productName: productName || undefined,
          senderName: senderName || undefined,
          senderEmail: senderEmail || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "保存失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({ title: template ? "模板已更新" : "模板已创建" });
      router.push("/templates");
      router.refresh();
    } catch {
      toast({
        title: "保存失败",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>模板信息</CardTitle>
          <CardDescription>设置模板名称和投递角度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">模板名称 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：电子产品开发信"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="angle">投递角度</Label>
              <Select value={angle} onValueChange={setAngle}>
                <SelectTrigger>
                  <SelectValue placeholder="选择角度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="value_prop">价值主张</SelectItem>
                  <SelectItem value="social_proof">社会证明</SelectItem>
                  <SelectItem value="pain_point">痛点切入</SelectItem>
                  <SelectItem value="urgency">紧迫感</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productName">产品/服务名称</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="如：LED照明解决方案（默认: our products and services）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderName">发件人姓名</Label>
              <Input
                id="senderName"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="如：张三（默认: Our Team）"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="senderEmail">发件邮箱</Label>
            <Input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="如：sales@yourdomain.com（留空则活动发送时取当前账号邮箱）"
            />
            <p className="text-xs text-muted-foreground">
              选择该模板时，活动会优先使用这里配置的发件邮箱。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>邮件内容</CardTitle>
            <CardDescription>
              使用模板变量和 AI 生成个性化邮件
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleAIGenerate}
            disabled={aiLoading}
          >
            {aiLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI 生成
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">邮件主题 *</Label>
            <Input
              id="subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setInsertTarget("subject")}
              placeholder="如: {{companyName}} 合作机会"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">邮件正文 *</Label>
            <Textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setInsertTarget("body")}
              placeholder="Hi {{contactName}},&#10;&#10;I noticed that {{companyName}} is a leader in the {{industry}} space..."
              rows={12}
              required
            />
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">
              点击插入模板变量（当前插入到: {insertTarget === "subject" ? "主题" : "正文"}）:
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <div key={v.name} className="group relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.name)}
                    className="text-xs font-mono"
                  >
                    {v.name}
                  </Button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {v.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {canUseAttachments && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            邮件附件
          </CardTitle>
          <CardDescription>
            添加文件链接作为邮件附件（如产品目录、报价单等）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span>{att.filename}</span>
                    <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                      {att.url}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <Input
              placeholder="文件名"
              value={newAttachName}
              onChange={(e) => setNewAttachName(e.target.value)}
            />
            <Input
              placeholder="文件链接 URL"
              value={newAttachUrl}
              onChange={(e) => setNewAttachUrl(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={addAttachment}>
              添加
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : template ? "更新模板" : "创建模板"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          取消
        </Button>
      </div>
    </form>
  );
}
