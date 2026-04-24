"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface IcpProfileFormValue {
  name: string;
  description?: string;
  industry?: string;
  targetCustomerText?: string;
  mustHave: string[];
  mustNotHave: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  productCategories: string[];
  salesModel?: string;
  scoreWeights: {
    detectorScore: number;
    ruleScore: number;
    aiScore: number;
    feedbackScore: number;
  };
  minScoreToSave: number;
  minScoreToReview: number;
  promptTemplate?: string;
  isDefault: boolean;
}

interface IcpProfileFormProps {
  initialValue?: Partial<IcpProfileFormValue>;
  submitting?: boolean;
  onCancel?: () => void;
  onSubmit: (value: IcpProfileFormValue) => void;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

type ListField =
  | "mustHave"
  | "mustNotHave"
  | "positiveKeywords"
  | "negativeKeywords"
  | "productCategories";

const quickPrompts = [
  "更严格一点",
  "放宽条件",
  "排除工厂/制造商",
  "优先 DTC 独立站",
  "提高入库阈值",
];

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function createProfileValue(initialValue?: Partial<IcpProfileFormValue>): IcpProfileFormValue {
  return {
    name: initialValue?.name || "",
    description: initialValue?.description || "",
    industry: initialValue?.industry || "",
    targetCustomerText: initialValue?.targetCustomerText || "",
    mustHave: initialValue?.mustHave || [],
    mustNotHave: initialValue?.mustNotHave || [],
    positiveKeywords: initialValue?.positiveKeywords || [],
    negativeKeywords: initialValue?.negativeKeywords || [],
    productCategories: initialValue?.productCategories || [],
    salesModel: initialValue?.salesModel || "",
    scoreWeights: {
      detectorScore: initialValue?.scoreWeights?.detectorScore ?? 20,
      ruleScore: initialValue?.scoreWeights?.ruleScore ?? 25,
      aiScore: initialValue?.scoreWeights?.aiScore ?? 40,
      feedbackScore: initialValue?.scoreWeights?.feedbackScore ?? 15,
    },
    minScoreToSave: initialValue?.minScoreToSave ?? 80,
    minScoreToReview: initialValue?.minScoreToReview ?? 60,
    promptTemplate: initialValue?.promptTemplate || "",
    isDefault: initialValue?.isDefault || false,
  };
}

function getInitialMessages(initialValue?: Partial<IcpProfileFormValue>): ChatMessage[] {
  if (initialValue?.name) {
    return [
      {
        role: "assistant",
        content: "我已加载当前画像。你可以直接说修改意见，我会更新右侧草稿。",
      },
    ];
  }

  return [
    {
      role: "assistant",
      content:
        "告诉我你想找什么客户。比如行业、地区、必须满足条件、要排除的人群，我会先生成右侧画像草稿。",
    },
  ];
}

function mergeProfileValue(
  currentValue: IcpProfileFormValue,
  parsedValue: Partial<IcpProfileFormValue>
): IcpProfileFormValue {
  return {
    ...currentValue,
    ...parsedValue,
    scoreWeights: {
      ...currentValue.scoreWeights,
      ...parsedValue.scoreWeights,
    },
    isDefault: currentValue.isDefault,
  };
}

function normalizeForSubmit(value: IcpProfileFormValue): IcpProfileFormValue {
  return {
    ...value,
    description: value.description?.trim() || undefined,
    industry: value.industry?.trim() || undefined,
    targetCustomerText: value.targetCustomerText?.trim() || undefined,
    salesModel: value.salesModel?.trim() || undefined,
    promptTemplate: value.promptTemplate?.trim() || undefined,
  };
}

function summarizeDraft(value: IcpProfileFormValue) {
  const name = value.name || "客户画像草稿";
  const mustHaveCount = value.mustHave.length;
  const mustNotHaveCount = value.mustNotHave.length;
  return `已更新「${name}」：${mustHaveCount} 条必须满足，${mustNotHaveCount} 条排除条件。你可以继续补充，或确认保存。`;
}

export function IcpProfileForm({
  initialValue,
  submitting,
  onCancel,
  onSubmit,
}: IcpProfileFormProps) {
  const [formValue, setFormValue] = useState(() => createProfileValue(initialValue));
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(initialValue));
  const [draftMessage, setDraftMessage] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    setFormValue(createProfileValue(initialValue));
    setMessages(getInitialMessages(initialValue));
    setDraftMessage("");
    setParseError("");
  }, [initialValue]);

  async function sendMessage(message: string) {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      setParseError("先输入你的目标客户要求或修改意见");
      return;
    }

    setParsing(true);
    setParseError("");
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: normalizedMessage },
    ]);

    try {
      const response = await fetch("/api/v1/icp-profiles/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: normalizedMessage, currentDraft: formValue }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "画像更新失败");

      const nextValue = mergeProfileValue(formValue, payload.data);
      setFormValue(nextValue);
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: summarizeDraft(nextValue) },
      ]);
      setDraftMessage("");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "画像更新失败");
    } finally {
      setParsing(false);
    }
  }

  function updateField<Field extends keyof IcpProfileFormValue>(
    field: Field,
    value: IcpProfileFormValue[Field]
  ) {
    setFormValue((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function updateListField(field: ListField, value: string) {
    setFormValue((currentValue) => ({ ...currentValue, [field]: splitLines(value) }));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(normalizeForSubmit(formValue));
      }}
    >
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <ConversationPanel
          messages={messages}
          draftMessage={draftMessage}
          parsing={parsing}
          parseError={parseError}
          onDraftChange={setDraftMessage}
          onSend={() => void sendMessage(draftMessage)}
          onQuickSend={(message) => void sendMessage(message)}
        />
        <DraftPanel
          formValue={formValue}
          onFieldChange={updateField}
          onListFieldChange={updateListField}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={submitting || !formValue.name.trim()}>
          {submitting ? "保存中..." : "保存画像"}
        </Button>
      </div>
    </form>
  );
}

function ConversationPanel({
  messages,
  draftMessage,
  parsing,
  parseError,
  onDraftChange,
  onSend,
  onQuickSend,
}: {
  messages: ChatMessage[];
  draftMessage: string;
  parsing: boolean;
  parseError: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickSend: (message: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-slate-200/80 bg-slate-50/80">
      <div className="border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-slate-600" />
          <h3 className="font-semibold">对话创建画像</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          先说目标客户，再继续补充修改意见，右侧草稿会同步更新。
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <ChatBubble key={`${message.role}-${index}`} message={message} />
        ))}
        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在更新右侧画像草稿...
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-white/80 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              size="sm"
              variant="outline"
              disabled={parsing}
              onClick={() => onQuickSend(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea
            value={draftMessage}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={4}
            placeholder="例如：我要找北美家具品牌方，不要工厂，官网要有 DTC 独立站和品牌故事。"
          />
          <div className="flex items-center justify-between gap-3">
            {parseError ? (
              <p className="text-sm text-red-500">{parseError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">支持继续说“再排除批发商”“放宽产品限制”。</p>
            )}
            <Button type="button" disabled={parsing} onClick={onSend}>
              {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              发送
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "justify-end")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          <Bot className="h-4 w-4 text-slate-600" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser ? "bg-slate-950 text-white" : "border border-slate-200/80 bg-white"
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

function DraftPanel({
  formValue,
  onFieldChange,
  onListFieldChange,
}: {
  formValue: IcpProfileFormValue;
  onFieldChange: <Field extends keyof IcpProfileFormValue>(
    field: Field,
    value: IcpProfileFormValue[Field]
  ) => void;
  onListFieldChange: (field: ListField, value: string) => void;
}) {
  return (
    <section className="min-h-0 overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">画像草稿</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            AI 解析结果会显示在这里，保存前仍可手动微调。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 px-3 py-1">
          <span className="text-xs text-muted-foreground">默认画像</span>
          <Switch
            checked={formValue.isDefault}
            onCheckedChange={(checked) => onFieldChange("isDefault", checked)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <DraftSection title="基础信息">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="画像名称" value={formValue.name} onChange={(value) => onFieldChange("name", value)} required />
            <TextField label="目标行业" value={formValue.industry || ""} onChange={(value) => onFieldChange("industry", value)} />
          </div>
          <TextAreaField label="描述" value={formValue.description || ""} onChange={(value) => onFieldChange("description", value)} />
          <TextAreaField
            label="目标客户描述"
            value={formValue.targetCustomerText || ""}
            rows={4}
            onChange={(value) => onFieldChange("targetCustomerText", value)}
          />
        </DraftSection>

        <DraftSection title="筛选规则">
          <div className="grid gap-3 md:grid-cols-2">
            <ListArea label="必须满足" value={formValue.mustHave} onChange={(value) => onListFieldChange("mustHave", value)} />
            <ListArea label="必须排除" value={formValue.mustNotHave} onChange={(value) => onListFieldChange("mustNotHave", value)} />
          </div>
        </DraftSection>

        <DraftSection title="关键词与产品">
          <div className="grid gap-3 md:grid-cols-2">
            <ListArea label="正向关键词" value={formValue.positiveKeywords} onChange={(value) => onListFieldChange("positiveKeywords", value)} />
            <ListArea label="负向关键词" value={formValue.negativeKeywords} onChange={(value) => onListFieldChange("negativeKeywords", value)} />
            <ListArea label="产品分类" value={formValue.productCategories} rows={4} onChange={(value) => onListFieldChange("productCategories", value)} />
            <TextField label="销售模式" value={formValue.salesModel || ""} onChange={(value) => onFieldChange("salesModel", value)} />
          </div>
        </DraftSection>

        <DraftSection title="入库判断">
          <div className="grid gap-3 md:grid-cols-2">
            <NumberField label="自动入库阈值" value={formValue.minScoreToSave} onChange={(value) => onFieldChange("minScoreToSave", value)} />
            <NumberField label="人工审核阈值" value={formValue.minScoreToReview} onChange={(value) => onFieldChange("minScoreToReview", value)} />
          </div>
          <TextAreaField
            label="AI 分类补充提示词"
            value={formValue.promptTemplate || ""}
            rows={4}
            onChange={(value) => onFieldChange("promptTemplate", value)}
          />
        </DraftSection>
      </div>
    </section>
  );
}

function DraftSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  required,
  onChange,
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  rows = 3,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ListArea({
  label,
  value,
  rows = 5,
  onChange,
}: {
  label: string;
  value: string[];
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextAreaField
      label={label}
      value={value.join("\n")}
      rows={rows}
      onChange={onChange}
    />
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
