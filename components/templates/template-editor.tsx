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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const GENERATION_REQUIREMENT_PRESETS = [
  "语气更像外贸销售，专业但不要太硬。",
  "正文控制在 120 词以内，尽量短一些。",
  "突出 MOQ 小、交付快、支持 OEM/ODM。",
  "结尾 CTA 更直接，鼓励对方回复。",
  "减少空话，先写和客户业务更相关的切入点。",
  "主题行更自然，避免太像营销邮件。",
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
    attachments: Attachment[] | null;
    isDefault: boolean | null;
  };
}

interface StreamEvent {
  type: "status" | "subject" | "body" | "done" | "error";
  message?: string;
  value?: string;
}

async function readStreamingEmail(
  response: Response,
  onEvent: (event: StreamEvent) => void
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("流式响应不可用");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as StreamEvent);
    }
  }
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
  const [attachments, setAttachments] = useState<Attachment[]>(
    template?.attachments || []
  );
  const [newAttachUrl, setNewAttachUrl] = useState("");
  const [newAttachName, setNewAttachName] = useState("");
  const [insertTarget, setInsertTarget] = useState<"subject" | "body">("body");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generationRequirements, setGenerationRequirements] = useState("");
  const [generationStatus, setGenerationStatus] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
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
    setIsStreaming(true);
    setGenerationStatus("正在连接 AI...");
    setSubject("");
    setBody("");

    try {
      const res = await fetch("/api/v1/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: true,
          type: "outreach",
          prospectName: "{{contactName}}",
          companyName: "{{companyName}}",
          industry: "{{industry}}",
          country: "your target market",
          productName: productName || "{{productName}}",
          senderName: senderName || "{{senderName}}",
          angle: angle || undefined,
          templateBody: body || undefined,
          userRequirements: generationRequirements || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("AI 生成失败");
      }

      await readStreamingEmail(res, (event) => {
        if (event.type === "status" && event.message) {
          setGenerationStatus(event.message);
          return;
        }

        if (event.type === "subject" && event.value) {
          setSubject((current) => current + event.value!);
          return;
        }

        if (event.type === "body" && event.value) {
          setBody((current) => current + event.value!);
          return;
        }

        if (event.type === "error") {
          throw new Error(event.message || "AI 生成失败");
        }

        if (event.type === "done") {
          setGenerationStatus("生成完成");
        }
      });

      setGeneratorOpen(false);
      toast({ title: "AI 生成成功" });
    } catch {
      toast({
        title: "AI 生成失败",
        description: "请检查 API Key 配置",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
      setIsStreaming(false);
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

  const appendRequirementPreset = (preset: string) => {
    setGenerationRequirements((current) =>
      current ? `${current}\n${preset}` : preset
    );
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl">模板信息</CardTitle>
          <CardDescription>设置模板名称和投递角度</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
          <div className="grid gap-4 md:grid-cols-2">
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
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">发件邮箱规则</p>
            <p className="mt-1 text-xs text-muted-foreground">
              模板不再单独配置发件邮箱。活动发送时会直接使用当前登录账号注册邮箱对应的已连接邮箱账号。
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
            onClick={() => setGeneratorOpen(true)}
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

      <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 生成邮件</DialogTitle>
            <DialogDescription>
              输入这次生成的额外要求。模型仍然走后台当前配置，只会返回邮件主题和正文。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="generationRequirements">生成要求</Label>
            <Textarea
              id="generationRequirements"
              value={generationRequirements}
              onChange={(e) => setGenerationRequirements(e.target.value)}
              placeholder="例如：语气更像外贸销售，正文控制在 120 词内，突出 MOQ 小、交付快，结尾 CTA 更直接。"
              rows={6}
            />
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm text-slate-500">
              {generationStatus || "输入要求后开始生成，系统会边生成边回填主题和正文。"}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">常用要求示例</p>
              <div className="flex flex-wrap gap-2">
                {GENERATION_REQUIREMENT_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal px-3 py-1 text-left text-xs"
                    onClick={() => appendRequirementPreset(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGeneratorOpen(false)}
              disabled={aiLoading}
            >
              取消
            </Button>
            <Button type="button" onClick={handleAIGenerate} disabled={aiLoading}>
              {aiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isStreaming ? "流式生成中..." : "生成中..."}
                </>
              ) : (
                "开始生成"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
