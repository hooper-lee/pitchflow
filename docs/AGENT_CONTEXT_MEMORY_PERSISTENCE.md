# Agent Context & Memory Persistence 设计说明

> 本文档是 `HEMERA_CLOUD_AGENT_PLATFORM.md` 的上下文、记忆和持久化补充章节。用于指导后续 Codex / 人工开发云端 Agent 的对话连续性、任务状态恢复、长期偏好记忆、语义检索和审计回溯设计。

## 1. 设计目标

Hemera Cloud Agent 不能只依赖模型上下文窗口。只依赖上下文窗口会导致：

```text
页面刷新后任务断掉
飞书 / 企微回调后找不到上一轮状态
用户确认审批后无法恢复执行
服务重启后长任务丢失
历史偏好无法复用
模型误把旧信息当作最新事实
Agent 行为无法审计和回溯
```

因此需要建立分层记忆和持久化体系。

目标：

```text
1. 保证当前对话连续
2. 保证工具调用和审批状态可恢复
3. 保存明确的用户偏好和团队偏好
4. 不复制业务事实，业务事实通过 Toolkit 查询主业务库
5. 支持后续 pgvector / embedding 语义检索
6. 支持审计、回溯、删除和治理
```

## 2. 记忆分层

Agent 记忆分为 5 层：

```text
1. 短期上下文：当前对话记忆
2. 工作记忆：当前任务和执行状态
3. 长期用户记忆：偏好、习惯、默认设置
4. 业务记忆：PitchFlow / 外部系统主业务数据
5. 语义记忆：embedding / pgvector 检索
```

## 3. 短期上下文：当前对话记忆

短期上下文用于记录当前用户和 Agent 的连续对话。

对应表：

```text
agent_conversations
agent_messages
```

解决的问题：

```text
用户刚才说了什么
Agent 刚才回复了什么
当前对话在讨论哪个对象
当前上下文来自哪个 Channel
用户的下一句话指代什么
```

示例：

```text
用户：帮我找 50 个美国宠物用品品牌。
Agent：已创建挖掘任务 A。
用户：把 80 分以上的保存。
```

Agent 必须知道“80 分以上”指的是挖掘任务 A 的候选池，而不是全局所有候选。

### 3.1 agent_conversations

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  channel: "web" | "feishu" | "wecom" | "api";
  channelConversationId?: string;
  title?: string;
  contextType?: "global" | "prospect" | "campaign" | "discovery_job" | "settings";
  contextId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 agent_messages

建议字段：

```ts
{
  id: string;
  tenantId: string;
  conversationId: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
```

### 3.3 读取策略

每次构建模型上下文时，不应加载全部历史消息。

建议：

```text
默认加载最近 10-20 条消息
如果 conversation 很长，先生成 conversation summary
飞书/企微场景优先加载当前线程或私聊最近消息
页面上下文优先加载当前 contextType / contextId 相关消息
```

## 4. 工作记忆：当前任务状态

工作记忆用于保存 Agent 当前正在执行什么、执行到哪一步、工具调用结果是什么、是否等待审批。

对应表：

```text
agent_runs
agent_tool_calls
agent_action_approvals
agent_task_states
```

解决的问题：

```text
长任务执行中断后可恢复
用户确认审批后继续执行
工具失败后可重试
飞书卡片按钮点击后能找到原始操作
服务重启后不丢任务状态
```

### 4.1 agent_runs

一次用户消息触发一次 Agent Run。

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  channel: "web" | "feishu" | "wecom" | "api";
  status: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
  intent?: "conversation" | "query" | "summarize" | "tool_call" | "task_create" | "approval_required" | "clarification_required";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}
```

### 4.2 agent_tool_calls

记录每次工具调用。

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  runId: string;
  toolkit: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  riskLevel: "low" | "medium" | "high";
  approvalId?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

### 4.3 agent_action_approvals

用于保存高风险动作确认状态。

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  runId: string;
  toolName: string;
  input: Record<string, unknown>;
  summary: string;
  status: "pending" | "approved" | "rejected" | "expired";
  approvedBy?: string;
  approvedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}
```

### 4.4 agent_task_states

用于自动任务和长任务状态。

建议字段：

```ts
{
  id: string;
  tenantId: string;
  taskId?: string;
  runId?: string;
  status: "pending" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
  currentStep?: string;
  state: Record<string, unknown>;
  nextRunAt?: Date;
  lockedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 5. 长期用户记忆：偏好和习惯

长期用户记忆用于保存用户明确表达的偏好、团队默认习惯和高置信度行为偏好。

对应表：

```text
agent_memories
```

适合保存：

```text
常用目标市场
常用行业
常用 ICP
默认邮件语气
邮件长度偏好
默认发件语言
默认产品卖点
默认审批方式
常用飞书群
常用报告时间
```

不适合保存：

```text
临时聊天内容
一次性任务结果
业务事实副本
敏感凭证或密钥
低置信度推断
```

### 5.1 agent_memories

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  memoryType: "preference" | "profile" | "workflow" | "fact";
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  source: "explicit" | "inferred" | "system";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

示例：

```json
{
  "memoryType": "preference",
  "key": "email_tone",
  "value": {
    "style": "concise",
    "avoid": ["too salesy", "too long"],
    "language": "English"
  },
  "confidence": 0.9,
  "source": "explicit"
}
```

### 5.2 写入规则

长期记忆分三类写入。

#### 直接写入

用户明确表达：

```text
以后邮件都写短一点。
```

可以直接写入：

```text
memoryType: preference
key: email_length
value: short
source: explicit
```

#### 候选记忆

Agent 从行为推断出的偏好不要直接写入，应先询问。

示例：

```text
我注意到你最近经常找美国 DTC 宠物用品品牌，要不要设为默认 ICP 方向？
```

用户确认后再写入。

#### 只写日志，不写长期记忆

普通聊天、临时任务、一次性结果只进入：

```text
agent_messages
agent_runs
agent_tool_calls
```

不进入 `agent_memories`。

## 6. 业务记忆：业务数据不复制

Agent 不应该把 PitchFlow 业务数据复制进长期记忆。

业务事实应以主业务库为准：

```text
tenants.settings.productProfile
icp_profiles
prospects
lead_discovery_jobs
lead_discovery_candidates
campaigns
emails
email_replies
mail_accounts
email_templates
```

正确方式：

```text
Agent 需要业务事实时，通过 PitchFlow Toolkit 查询主业务库。
```

示例：

```text
用户：这个客户适合跟进吗？
```

Agent 应调用：

```text
pitchflow.prospect.get
pitchflow.email_reply.list
pitchflow.campaign.get
```

然后基于最新业务数据总结。

原则：

```text
业务数据不复制
偏好记忆可持久化
任务状态必须持久化
长期记忆必须可控可删除
```

## 7. 语义记忆：Embedding / pgvector 检索

当历史对话、客户邮件、任务结果变多后，仅加载最近消息不够，需要语义检索。

后续建议使用：

```text
PostgreSQL + pgvector
```

第一阶段可以先不实现 embedding，但需要预留表结构。

### 7.1 agent_memory_embeddings

建议字段：

```ts
{
  id: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  sourceType: "message" | "summary" | "prospect" | "email_reply" | "task" | "tool_call";
  sourceId: string;
  content: string;
  embedding: vector;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

### 7.2 检索场景

语义记忆用于：

```text
找出用户之前说过的偏好
检索某个客户历史邮件摘要
检索相似行业的历史成功模板
检索历史挖掘任务经验
检索历史错误和人工修正
```

### 7.3 读取策略

每次上下文最多取 Top 5-10 条语义记忆。

原则：

```text
只取和当前任务强相关的记忆
不要把全部历史塞进 prompt
低置信度或过期记忆不参与上下文
敏感内容不进入 embedding
```

## 8. Context Builder

建议新增模块：

```text
lib/agent/context-builder.ts
```

作用：每次调用模型前构建干净、可控、可审计的上下文。

输入：

```ts
{
  tenantId: string;
  userId: string;
  agentId: string;
  conversationId: string;
  channel: "web" | "feishu" | "wecom" | "api";
  message: string;
  contextType?: string;
  contextId?: string;
}
```

输出：

```ts
{
  recentMessages: AgentMessage[];
  currentRunState?: AgentRun;
  pendingApprovals: AgentApproval[];
  explicitMemories: AgentMemory[];
  semanticMemories: AgentSemanticMemory[];
  businessContext: Record<string, unknown>;
  channelPolicy: ChannelPolicy;
  permissionContext: PermissionContext;
}
```

### 8.1 上下文构建顺序

```text
1. 当前用户消息
2. 最近 10-20 条对话
3. 当前页面 / Channel context
4. 当前任务状态
5. pending approval 状态
6. 明确用户偏好 agent_memories
7. 必要业务对象摘要
8. Top 5-10 条语义检索结果
9. 系统规则 / 权限 / Channel Policy
```

## 9. Context Snapshot 审计

为了后续调试和安全审计，需要保存每次 Agent Run 实际用了哪些上下文。

对应表：

```text
agent_context_snapshots
```

建议字段：

```ts
{
  id: string;
  tenantId: string;
  runId: string;
  conversationId: string;
  messagesUsed: string[];
  memoriesUsed: string[];
  semanticMemoriesUsed: string[];
  toolResultsUsed: string[];
  businessObjectsUsed: Record<string, string[]>;
  contextTokens?: number;
  createdAt: Date;
}
```

用途：

```text
解释 Agent 为什么这么回答
排查错误上下文
排查越权访问
审计高风险操作前 Agent 使用了哪些信息
复现某次 Agent Run
```

## 10. 记忆治理和删除

长期记忆必须可控。

### 10.1 保留策略

建议：

```text
用户偏好：长期保留，允许用户删除
任务状态：任务完成后归档
上下文快照：保留 30-90 天
工具调用日志：保留 180-365 天，企业版可更久
语义记忆：定期压缩和清理低价值内容
```

### 10.2 用户控制

后续需要支持：

```text
用户查看自己的记忆
用户删除某条记忆
用户关闭长期记忆
管理员关闭团队长期记忆
企业版导出审计日志
```

### 10.3 敏感信息策略

禁止把敏感凭证、私钥、访问令牌、支付密钥等内容写入长期记忆或 embedding。

## 11. 最小实现阶段

### P0：第一版必须做

```text
agent_conversations
agent_messages
agent_runs
agent_tool_calls
agent_action_approvals
```

能力：

```text
当前对话不断
工具调用可追踪
审批状态可恢复
页面刷新后能继续
飞书/企微审批回调能找到原始 run
```

### P1：显式长期偏好

```text
agent_memories
```

能力：

```text
保存用户明确偏好
保存团队默认偏好
支持 Context Builder 读取偏好
```

### P2：上下文快照

```text
agent_context_snapshots
```

能力：

```text
记录每次 Agent Run 实际使用了哪些上下文
支持审计和问题复现
```

### P3：语义检索

```text
agent_memory_embeddings
pgvector
```

能力：

```text
历史对话检索
邮件摘要检索
相似客户 / 相似行业经验检索
历史成功模板检索
```

### P4：记忆管理 UI

能力：

```text
用户查看记忆
用户删除记忆
管理员关闭长期记忆
企业审计导出
```

## 12. Codex 实施建议

建议分 PR 实现：

```text
PR 1: agent_conversations / agent_messages / agent_runs / agent_tool_calls / approvals schema
PR 2: Context Builder 基础实现，加载最近消息和 run 状态
PR 3: agent_memories schema 和显式偏好读写
PR 4: agent_context_snapshots 审计表和写入逻辑
PR 5: agent_task_states 长任务状态表
PR 6: pgvector / agent_memory_embeddings 预研和可选实现
PR 7: 记忆管理 UI
```

每个 PR 要求：

```text
不复制 PitchFlow 主业务数据
不把敏感凭证写入 memory
所有 memory 查询必须带 tenantId
所有 context 构建必须做权限过滤
高风险工具调用必须可审计回溯
```

## 13. 总结

Hemera Cloud Agent 的上下文和持久化应采用分层策略：

```text
短期上下文：agent_messages
任务状态：agent_runs / agent_tool_calls / agent_task_states
审批状态：agent_action_approvals
长期偏好：agent_memories
业务事实：通过 PitchFlow Toolkit 查询主业务库
语义检索：agent_memory_embeddings / pgvector
审计回溯：agent_context_snapshots
```

核心原则：

```text
业务数据不复制。
偏好记忆可持久化。
任务状态必须持久化。
长期记忆必须可控可删除。
每次 Agent Run 使用的上下文必须可审计。
```
