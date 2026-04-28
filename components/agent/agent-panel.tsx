"use client";

import {
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const AGENT_CHAT_ENDPOINT = "/api/agent/chat";
const AGENT_STATUS_ENDPOINT = "/api/agent/status";

type AgentMessageRole = "user" | "assistant" | "system";
type AgentCardKind = "tool" | "status" | "workflow";

type AgentCard = {
  id: string;
  kind: AgentCardKind;
  title: string;
  detail?: string;
  status?: string;
};

type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  cards?: AgentCard[];
};

type AgentChatPayload = {
  message: string;
  conversationId?: string;
  messages: Array<Pick<AgentMessage, "role" | "content">>;
};

type UnknownRecord = Record<string, unknown>;
type AgentPanelController = {
  isOpen: boolean;
  isSending: boolean;
  agentEnabled: boolean;
  canManageAgent: boolean;
  draftMessage: string;
  messages: AgentMessage[];
  messageListRef: RefObject<HTMLDivElement>;
  setDraftMessage: (message: string) => void;
  enableAgent: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
};
type SubmitDraftMessageOptions = {
  draftMessage: string;
  isSending: boolean;
  conversationId?: string;
  messages: AgentMessage[];
  setDraftMessage: (message: string) => void;
  setIsSending: (isSending: boolean) => void;
  setConversationId: (conversationId: string) => void;
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>;
};

const welcomeMessage: AgentMessage = {
  id: "welcome",
  role: "assistant",
  content: "我是 Hemera Agent，可以帮你梳理线索、活动和下一步动作。",
};
const toolTitleMap: Record<string, string> = {
  "pitchflow.setup.check_readiness": "获客准备检查",
  "pitchflow.product_profile.get": "产品资料",
  "pitchflow.product_profile.upsert": "更新产品资料",
  "pitchflow.mail_account.list": "发件邮箱",
  "pitchflow.icp.list": "ICP 画像",
  "pitchflow.icp.create": "创建 ICP 画像",
  "pitchflow.icp.update": "更新 ICP 画像",
  "pitchflow.template.list": "邮件策略",
  "pitchflow.template.create_draft": "创建邮件策略",
  "pitchflow.template.update": "更新邮件策略",
  "pitchflow.prospect.list": "客户列表",
  "pitchflow.prospect.create": "创建客户",
  "pitchflow.prospect.update": "更新客户",
  "pitchflow.discovery.list_jobs": "精准挖掘任务",
  "pitchflow.discovery.create_job": "创建挖掘任务",
  "pitchflow.discovery.summarize_candidates": "候选客户总结",
  "pitchflow.campaign.list": "活动列表",
  "pitchflow.campaign.create_draft": "创建活动草稿",
  "pitchflow.campaign.start": "启动活动",
  "pitchflow.campaign.summarize": "活动表现",
  "pitchflow.email_reply.list": "客户回复",
};
const statusTextMap: Record<string, string> = {
  completed: "已完成",
  failed: "失败",
  blocked: "已阻止",
  requires_approval: "待审批",
  running: "处理中",
};

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(source: UnknownRecord, keys: string[]) {
  const foundValue = keys.map((key) => source[key]).find((value) => typeof value === "string");
  return typeof foundValue === "string" ? foundValue : undefined;
}

function formatCardTitle(title: string) {
  return toolTitleMap[title] || title;
}

function formatCardStatus(status?: string) {
  return status ? statusTextMap[status] || status : undefined;
}

function normalizeCard(
  cardSource: unknown,
  index: number,
  fallbackKind: AgentCardKind
): AgentCard | null {
  if (!isRecord(cardSource)) return null;

  const kindValue =
    cardSource.kind === "status" || cardSource.kind === "workflow" ? cardSource.kind : fallbackKind;
  const title = readString(cardSource, ["title", "name", "tool", "label"]) || "Agent 更新";
  const detail = readString(cardSource, ["detail", "description", "message", "content"]);
  const status = readString(cardSource, ["status", "state"]);

  return {
    id: readString(cardSource, ["id"]) || createMessageId(`card-${index}`),
    kind: kindValue,
    title: formatCardTitle(title),
    ...(detail ? { detail } : {}),
    ...(status ? { status: formatCardStatus(status) } : {}),
  };
}

function normalizeCards(responseBody: unknown) {
  if (!isRecord(responseBody)) return [];

  const statusCards = Array.isArray(responseBody.statuses)
    ? responseBody.statuses.map((statusCard, index) => normalizeCard(statusCard, index, "status"))
    : [];
  const genericCards = Array.isArray(responseBody.cards)
    ? responseBody.cards.map((card, index) => normalizeCard(card, index, "tool"))
    : [];

  return [...statusCards, ...genericCards].filter(
    (card): card is AgentCard => Boolean(card)
  );
}

function normalizeAssistantMessage(responseBody: unknown): AgentMessage {
  if (typeof responseBody === "string") {
    return { id: createMessageId("assistant"), role: "assistant", content: responseBody };
  }

  const content = isRecord(responseBody)
    ? readString(responseBody, ["content", "message", "text", "reply"]) || "Agent 已完成处理。"
    : "Agent 已完成处理。";

  return {
    id: createMessageId("assistant"),
    role: "assistant",
    content,
    cards: normalizeCards(responseBody),
  };
}

function buildChatPayload(
  message: string,
  messages: AgentMessage[],
  conversationId?: string
): AgentChatPayload {
  return {
    message,
    ...(conversationId ? { conversationId } : {}),
    messages: messages
      .filter((agentMessage) => agentMessage.id !== welcomeMessage.id)
      .map(({ role, content }) => ({ role, content })),
  };
}

function createUnavailableMessage(): AgentMessage {
  return {
    id: createMessageId("system"),
    role: "system",
    content: "Agent 暂时不可用，请稍后重试。",
  };
}

function createErrorMessage(message: string): AgentMessage {
  return {
    id: createMessageId("system"),
    role: "system",
    content: message || "Agent 暂时不可用，请稍后重试。",
  };
}

async function requestAssistantMessage(
  message: string,
  messages: AgentMessage[],
  conversationId?: string
) {
  const agentResponse = await fetch(AGENT_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildChatPayload(message, messages, conversationId)),
  });

  if (!agentResponse.ok) {
    const responseText = await agentResponse.text();
    let errorMessage = "Agent 暂时不可用，请稍后重试。";
    try {
      const errorBody = JSON.parse(responseText) as { error?: string; details?: unknown };
      errorMessage = errorBody.error || errorMessage;
    } catch {
      errorMessage = responseText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const responseBody = (await agentResponse.json()) as unknown;
  const nextConversationId = isRecord(responseBody)
    ? readString(responseBody, ["conversationId"])
    : undefined;

  return {
    assistantMessage: normalizeAssistantMessage(responseBody),
    conversationId: nextConversationId,
  };
}

async function requestAgentStatus() {
  const response = await fetch(AGENT_STATUS_ENDPOINT);
  if (!response.ok) return { enabled: false, canManage: false };
  const body = (await response.json()) as { data?: { enabled?: boolean; canManage?: boolean } };
  return {
    enabled: Boolean(body.data?.enabled),
    canManage: Boolean(body.data?.canManage),
  };
}

async function requestEnableAgent() {
  const response = await fetch(AGENT_STATUS_ENDPOINT, { method: "POST" });
  if (!response.ok) throw new Error("启用 Agent 失败");
  return requestAgentStatus();
}

function useAgentPanelScroll(
  messageListRef: RefObject<HTMLDivElement>,
  messages: AgentMessage[],
  isSending: boolean
) {
  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messageListRef, messages, isSending]);
}

async function submitDraftMessage({
  draftMessage,
  isSending,
  conversationId,
  messages,
  setDraftMessage,
  setConversationId,
  setIsSending,
  setMessages,
}: SubmitDraftMessageOptions) {
  const trimmedMessage = draftMessage.trim();
  if (!trimmedMessage || isSending) return;

  const userMessage: AgentMessage = {
    id: createMessageId("user"),
    role: "user",
    content: trimmedMessage,
  };
  const nextMessages = [...messages, userMessage];

  setMessages(nextMessages);
  setDraftMessage("");
  setIsSending(true);

  try {
    const { assistantMessage, conversationId: nextConversationId } = await requestAssistantMessage(
      trimmedMessage,
      nextMessages,
      conversationId
    );
    if (nextConversationId) setConversationId(nextConversationId);
    setMessages((currentMessages) => [...currentMessages, assistantMessage]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : createUnavailableMessage().content;
    setMessages((currentMessages) => [...currentMessages, createErrorMessage(errorMessage)]);
  } finally {
    setIsSending(false);
  }
}

function AgentStatusCard({ card }: { card: AgentCard }) {
  const Icon = card.kind === "tool" ? Wrench : Sparkles;

  return (
    <div className="mt-2 max-w-full rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-700">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{card.title}</span>
        {card.status ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
            {card.status}
          </span>
        ) : null}
      </div>
      {card.detail ? (
        <p className="mt-2 break-words text-xs leading-5 text-slate-500">{card.detail}</p>
      ) : null}
    </div>
  );
}

function AgentMessageBubble({ message }: { message: AgentMessage }) {
  const isUserMessage = message.role === "user";

  return (
    <div className={cn("flex", isUserMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
          isUserMessage
            ? "bg-primary text-primary-foreground"
            : "border border-slate-200/80 bg-slate-50 text-slate-700"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.cards?.map((card) => <AgentStatusCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}

function AgentMessageList({
  messages,
  isSending,
  messageListRef,
}: {
  messages: AgentMessage[];
  isSending: boolean;
  messageListRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={messageListRef} className="max-h-[420px] space-y-3 overflow-y-auto p-4">
      {messages.map((message) => (
        <AgentMessageBubble key={message.id} message={message} />
      ))}
      {isSending ? (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在思考
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AgentComposer({
  draftMessage,
  isSending,
  onDraftChange,
  onDraftKeyDown,
  onSubmit,
}: {
  draftMessage: string;
  isSending: boolean;
  onDraftChange: (message: string) => void;
  onDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border-t border-slate-200/80 bg-white p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={draftMessage}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onDraftKeyDown}
          placeholder="输入问题，Shift + Enter 换行"
          className="max-h-32 min-h-[44px] resize-none text-[13px]"
          disabled={isSending}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="发送消息"
          disabled={!draftMessage.trim() || isSending}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}

function AgentPanelWindow({
  messages,
  isSending,
  agentEnabled,
  canManageAgent,
  draftMessage,
  messageListRef,
  onEnableAgent,
  onClose,
  onDraftChange,
  onDraftKeyDown,
  onSubmit,
}: {
  messages: AgentMessage[];
  isSending: boolean;
  agentEnabled: boolean;
  canManageAgent: boolean;
  draftMessage: string;
  messageListRef: RefObject<HTMLDivElement>;
  onEnableAgent: () => void;
  onClose: () => void;
  onDraftChange: (message: string) => void;
  onDraftKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 sm:w-[390px]">
      <header className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Hemera Agent</h2>
          <p className="text-xs text-slate-500">云端数字员工 · PitchFlow Toolkit</p>
        </div>
        {!agentEnabled && canManageAgent ? (
          <Button type="button" size="sm" variant="secondary" onClick={onEnableAgent}>
            启用
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon" aria-label="关闭 Agent" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>
      <AgentMessageList
        messages={messages}
        isSending={isSending}
        messageListRef={messageListRef}
      />
      <AgentComposer
        draftMessage={draftMessage}
        isSending={isSending}
        onDraftChange={onDraftChange}
        onDraftKeyDown={onDraftKeyDown}
        onSubmit={onSubmit}
      />
    </section>
  );
}

function AgentToggleButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      className="h-12 rounded-2xl px-4 shadow-xl shadow-slate-900/15"
      aria-expanded={isOpen}
      aria-label={isOpen ? "关闭 Agent" : "打开 Agent"}
      onClick={onToggle}
    >
      {isOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      <span className="hidden sm:inline">Agent</span>
    </Button>
  );
}

function useAgentPanelController(): AgentPanelController {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([welcomeMessage]);
  const [draftMessage, setDraftMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [canManageAgent, setCanManageAgent] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messageListRef = useRef<HTMLDivElement>(null);

  useAgentPanelScroll(messageListRef, messages, isSending);

  useEffect(() => {
    requestAgentStatus()
      .then((status) => {
        setAgentEnabled(status.enabled);
        setCanManageAgent(status.canManage);
      })
      .catch(() => {});
  }, []);

  function enableAgent() {
    requestEnableAgent()
      .then((status) => {
        setAgentEnabled(status.enabled);
        setCanManageAgent(status.canManage);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: createMessageId("system"),
            role: "system",
            content: "Hemera Agent 已启用，团队成员现在可以使用站内数字员工。",
          },
        ]);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "启用 Agent 失败";
        setMessages((currentMessages) => [...currentMessages, createErrorMessage(message)]);
      });
  }

  function sendMessage() {
    void submitDraftMessage({
      draftMessage,
      isSending,
      conversationId,
      messages,
      setDraftMessage,
      setIsSending,
      setConversationId,
      setMessages,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return {
    isOpen,
    isSending,
    agentEnabled,
    canManageAgent,
    draftMessage,
    messages,
    messageListRef,
    setDraftMessage,
    enableAgent,
    closePanel: () => setIsOpen(false),
    togglePanel: () => setIsOpen((currentOpenState) => !currentOpenState),
    handleSubmit,
    handleDraftKeyDown,
  };
}

export function AgentPanel() {
  const agentPanel = useAgentPanelController();

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {agentPanel.isOpen ? (
        <AgentPanelWindow
          messages={agentPanel.messages}
          isSending={agentPanel.isSending}
          agentEnabled={agentPanel.agentEnabled}
          canManageAgent={agentPanel.canManageAgent}
          draftMessage={agentPanel.draftMessage}
          messageListRef={agentPanel.messageListRef}
          onEnableAgent={agentPanel.enableAgent}
          onClose={agentPanel.closePanel}
          onDraftChange={agentPanel.setDraftMessage}
          onDraftKeyDown={agentPanel.handleDraftKeyDown}
          onSubmit={agentPanel.handleSubmit}
        />
      ) : null}
      <AgentToggleButton
        isOpen={agentPanel.isOpen}
        onToggle={agentPanel.togglePanel}
      />
    </div>
  );
}
