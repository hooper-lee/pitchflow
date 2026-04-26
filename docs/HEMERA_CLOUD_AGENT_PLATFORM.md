# Hemera Cloud Agent Platform 方案说明

> 本文档用于指导后续 Codex / 人工开发。当前目标不是只给 PitchFlow 增加一个站内 Assistant，而是在现有 PitchFlow SaaS 之上搭建一层云端 Agent 平台。PitchFlow 是第一阶段的核心业务 Toolkit，后续可扩展飞书、企微、邮件、CRM、MCP、自定义任务和技能。

## 1. 背景

PitchFlow 当前已经具备外贸获客 SaaS 的核心链路：

```text
客户挖掘
-> ICP 精准筛选
-> 候选池审核
-> 客户入库
-> AI 调研评分
-> 创建营销活动
-> 个性化开发信生成
-> 自动跟进
-> 邮件回复追踪
```

但当前产品操作链路偏长，用户需要理解多个页面和配置项：

```text
系统配置
产品资料配置
邮箱账号配置
ICP 配置
客户挖掘
候选池审核
客户调研
邮件模板
活动创建
活动启动
自动跟进
回复追踪
```

因此下一阶段需要把产品从“功能型 SaaS 后台”升级为“云端 Agent 工作流平台”。

## 2. 产品定位

### 2.1 不是 PitchFlow Assistant，而是 Hemera Cloud Agent Platform

原先的简单方案：

```text
PitchFlow
  -> 增加一个站内 Assistant
  -> 帮用户更方便地操作 PitchFlow
```

新的平台方案：

```text
Hemera Cloud Agent Platform
  -> PitchFlow 是第一个内置 Toolkit
  -> 站内 Chat / 飞书 / 企微 / API 是不同 Channel
  -> 后续可接 Email / CRM / MCP / LinkedIn 辅助 / 自定义任务和技能
```

也就是说，PitchFlow 不再是 Agent 的全部，而是 Agent 平台里的第一个深度业务工具包。

### 2.2 第一阶段产品主张

第一阶段不要宣传成泛泛的通用 Agent 平台，而应以具体业务场景推广：

```text
一个能帮外贸团队完成配置检查、客户挖掘、候选总结、邮件回复总结、活动草稿和飞书/企微协作的云端销售 Agent。
```

内部架构平台化，对外卖点场景化。

## 3. 核心原则

### 3.1 云端 Agent 优先

第一阶段只做云端 Agent，不做用户本地电脑控制。

云端 Agent 支持：

```text
正常沟通对话
业务咨询
配置检查
数据查询
客户总结
邮件回复总结
调用 PitchFlow 工具
调用飞书 / 企微 Channel
创建任务
生成草稿
高风险操作确认
后续调用 MCP 工具
```

第一阶段不做：

```text
控制用户本地电脑
读取用户本地文件
操作用户本地浏览器
执行用户电脑命令
自动 LinkedIn 加好友
自动 LinkedIn 私信
```

后续可独立规划：

```text
Browser Extension Agent
Local Runner / Desktop Agent
```

### 3.2 Agent 不只是工具调用器

云端 Agent 必须同时具备三种模式：

```text
1. 普通对话
2. 知识问答 / 总结
3. 工具调用 / 自动化
```

示例：

```text
用户：我现在应该怎么开始获客？
Agent：你可以先完成产品资料、ICP、邮箱账号和默认模板配置。我可以帮你检查当前是否已经准备好。
```

当用户继续说：

```text
那你帮我检查一下。
```

Agent 再调用：

```text
pitchflow.setup.check_readiness
```

Agent Runtime 必须能判断用户消息属于：

```text
普通对话
数据查询
总结分析
工具执行
任务创建
高风险操作
需要追问
```

### 3.3 SaaS 多租户优先

Hemera 是 SaaS 平台，因此所有 Agent 执行必须包含：

```ts
{
  tenantId: string;
  userId: string;
  userRole: string;
  tenantPlan: string;
  channel: "web" | "feishu" | "wecom" | "api";
  agentId: string;
  conversationId?: string;
}
```

必须支持：

```text
tenant 数据隔离
用户角色权限
套餐限制
Agent 权限
Toolkit 权限
Tool 权限
Channel 权限
审批确认
调用日志
用量计费
敏感配置保护
```

### 3.4 PitchFlow 是第一阶段 Toolkit

第一阶段重点不是做一个空泛 Agent 平台，而是：

```text
先搭 Agent Core
再接 PitchFlow Toolkit
先跑通外贸获客核心业务场景
```

PitchFlow Toolkit 包含：

```text
配置体检
产品资料
邮箱状态
ICP
客户挖掘
候选池
客户入库
客户总结
活动草稿
邮件回复总结
发信确认
跟进提醒
```

## 4. 总体架构

```text
用户入口
  ├── Web Chat
  ├── 飞书
  ├── 企业微信
  ├── API
  └── 后续浏览器插件 / MCP

统一进入：

Agent Runtime
  ├── Conversation Engine
  ├── Planner
  ├── Tool Router
  ├── Tool Registry
  ├── Permission Engine
  ├── Approval Engine
  ├── Memory
  ├── Task Runner
  ├── Billing Meter
  └── Audit Logger

调用：

Toolkits
  ├── PitchFlow Toolkit
  ├── Email Toolkit
  ├── Feishu Toolkit
  ├── WeCom Toolkit
  ├── MCP Toolkit
  ├── CRM Toolkit
  └── Custom Toolkit
```

## 5. 推荐目录结构

```text
lib/
  agent/
    runtime.ts
    planner.ts
    tool-router.ts
    tool-registry.ts
    permissions.ts
    approvals.ts
    audit.ts
    billing.ts
    memory.ts
    task-runner.ts
    types.ts

    channels/
      web.channel.ts
      feishu.channel.ts
      wecom.channel.ts
      api.channel.ts

    toolkits/
      pitchflow/
        setup.tools.ts
        product-profile.tools.ts
        mail-account.tools.ts
        icp.tools.ts
        discovery.tools.ts
        prospect.tools.ts
        campaign.tools.ts
        email-reply.tools.ts

      email/
        email-summary.tools.ts
        email-draft.tools.ts

      mcp/
        mcp-client.ts
        mcp-tool-adapter.ts
        mcp-registry.ts

app/
  api/
    agent/
      chat/route.ts
      approvals/[id]/confirm/route.ts
      approvals/[id]/reject/route.ts

    channels/
      feishu/route.ts
      wecom/route.ts

  admin/
    agents/
    agent-tools/
    agent-usage/

components/
  agent/
    agent-panel.tsx
    agent-message.tsx
    approval-card.tsx
    readiness-card.tsx
```

## 6. Agent Core 模块

### 6.1 Conversation Engine

负责正常对话。

能力：

```text
普通聊天
业务咨询
流程解释
配置引导
操作建议
上下文承接
```

### 6.2 Planner

负责判断用户意图。

意图类型：

```text
conversation
query
summarize
tool_call
task_create
approval_required
clarification_required
```

示例：

```text
用户：帮我找 50 个美国宠物用品 DTC 品牌
Planner：
- 检查 readiness
- 选择或创建 ICP
- 调用 pitchflow.discovery.create_job
```

### 6.3 Tool Registry

统一注册所有工具。

```ts
export interface AgentTool {
  name: string;
  description: string;
  toolkit: string;
  category: "conversation" | "setup" | "pitchflow" | "email" | "mcp" | "crm";
  riskLevel: "low" | "medium" | "high";
  requiredRoles: string[];
  requiredPlan?: string;
  schema: z.ZodSchema;
  execute: (ctx: AgentContext, input: unknown) => Promise<unknown>;
}
```

### 6.4 Permission Engine

每次 Tool Call 前检查：

```text
用户角色是否允许
租户套餐是否允许
Agent 是否启用该 Toolkit / Tool
当前 Channel 是否允许
是否需要审批
是否达到用量限制
```

### 6.5 Approval Engine

高风险操作必须确认。

高风险操作包括：

```text
批量入库
批量拉黑
启动活动
真实发送邮件
删除客户
删除活动
修改系统配置
调用外部 MCP 写操作
同步 CRM
```

确认卡片必须包含：

```text
操作类型
影响对象
影响数量
使用账号
是否对外发送消息
是否可撤销
风险说明
确认按钮
取消按钮
```

### 6.6 Task Runner

后续支持自动任务。

示例：

```text
每天早上 9 点总结昨天客户回复
Discovery Job 完成后自动通知飞书
客户回复后自动生成摘要
每周一生成活动表现周报
```

第一阶段可以预留结构，不做复杂 Workflow Builder。

### 6.7 Billing Meter

记录用量：

```text
消息次数
Agent Run 次数
Tool Call 次数
LLM Token
外部工具调用
MCP 调用
任务运行次数
飞书/企微消息次数
```

## 7. PitchFlow Toolkit 第一阶段工具

### 7.1 配置体检

工具：

```text
pitchflow.setup.check_readiness
pitchflow.setup.summarize_missing_items
```

检查：

```text
产品资料是否完整
邮箱账号是否连接
是否有默认模板
是否有 ICP
AI 配置是否可用
搜索配置是否可用
EmailEngine 是否可用
```

### 7.2 产品资料

工具：

```text
pitchflow.product_profile.get
pitchflow.product_profile.update
pitchflow.product_profile.check
pitchflow.product_profile.summarize
```

支持用户说：

```text
我的产品是宠物胸背带，支持 OEM，低 MOQ，7 天打样，主要卖给欧美宠物用品品牌，帮我配置一下。
```

Agent 应解析并写入产品资料。

### 7.3 邮箱状态

工具：

```text
pitchflow.mail_account.list
pitchflow.mail_account.check_status
pitchflow.mail_account.sync
pitchflow.mail_account.reconnect
pitchflow.mail_account.set_default
```

注意：

```text
不要在聊天里收集邮箱密码
不要在飞书/企微里输入 SMTP 密码
只做检查和引导
敏感信息走站内安全表单
```

### 7.4 ICP

工具：

```text
pitchflow.icp.list
pitchflow.icp.create
pitchflow.icp.update
pitchflow.icp.summarize
pitchflow.icp.check_quality
```

Agent 生成 ICP 时应包括：

```text
mustHave
mustNotHave
positiveKeywords
negativeKeywords
productCategories
salesModel
minScoreToSave
minScoreToReview
```

### 7.5 Discovery

工具：

```text
pitchflow.discovery.create_job
pitchflow.discovery.list_jobs
pitchflow.discovery.get_job
pitchflow.discovery.list_candidates
pitchflow.discovery.summarize_candidates
pitchflow.discovery.save_candidate_to_prospect
pitchflow.discovery.batch_save_candidates
```

规则：

```text
创建挖掘任务：可直接执行
查看候选：可直接执行
保存单个候选：中风险，可直接执行或轻确认
批量保存候选：必须确认
批量拉黑：必须确认
```

### 7.6 Prospect

工具：

```text
pitchflow.prospect.list
pitchflow.prospect.get
pitchflow.prospect.summarize
pitchflow.prospect.update
pitchflow.prospect.delete
```

规则：

```text
查询 / 总结：可直接执行
修改：按权限执行
删除：必须确认
```

### 7.7 Campaign

工具：

```text
pitchflow.campaign.list
pitchflow.campaign.get
pitchflow.campaign.summarize
pitchflow.campaign.create_draft
pitchflow.campaign.prepare_emails
pitchflow.campaign.start
```

建议将活动启动链路拆分为：

```text
prepareCampaignEmails()
  只生成邮件草稿和 QA 分数，不发送

sendPreparedCampaignEmails()
  用户确认后真实发送
```

Agent 第一版可以创建活动草稿、准备邮件草稿、总结活动表现，但不能无确认启动活动。

### 7.8 Email Reply

工具：

```text
pitchflow.email_reply.list
pitchflow.email_reply.summarize
pitchflow.email_reply.detect_intent
pitchflow.email_reply.generate_reply_draft
```

第一版重点：

```text
总结客户回复
判断是否有采购意向
生成回复草稿
提醒销售跟进
```

真实发送回复必须确认。

## 8. Channel 设计

### 8.1 Web Channel

入口：

```text
站内右下角 Agent Panel
页面上下文 Agent
配置页 Agent
```

适合：

```text
配置体检
产品资料补全
客户挖掘
候选池总结
活动草稿
邮件总结
复杂表单跳转
```

### 8.2 Feishu Channel

入口：

```text
飞书机器人私聊
飞书群聊
飞书卡片
飞书审批按钮
```

适合：

```text
查询
总结
创建任务
查看状态
审批确认
客户回复通知
Discovery 完成通知
活动日报
```

不适合：

```text
输入密码
输入 API Key
复杂长模板编辑
复杂系统配置
```

### 8.3 WeCom Channel

与飞书类似，适合企微提醒、销售团队协同、审批确认、客户回复摘要、任务状态通知。

### 8.4 Channel Policy

不同 Channel 可开放不同 Tool。

```ts
const feishuPolicy = {
  allowedTools: [
    "pitchflow.setup.check_readiness",
    "pitchflow.prospect.list",
    "pitchflow.prospect.summarize",
    "pitchflow.discovery.create_job",
    "pitchflow.discovery.summarize_candidates",
    "pitchflow.campaign.create_draft",
    "pitchflow.email_reply.summarize"
  ],
  requireApprovalTools: [
    "pitchflow.discovery.batch_save_candidates",
    "pitchflow.campaign.start",
    "pitchflow.email.send"
  ],
  redirectToWebTools: [
    "pitchflow.mail_account.create",
    "system_config.update_secret",
    "template.long_edit"
  ]
};
```

## 9. 数据库设计建议

新增平台化表，不使用 `assistant_*` 命名。

```text
agents
agent_conversations
agent_messages
agent_runs
agent_tool_calls
agent_action_approvals
agent_channels
agent_channel_bindings
toolkits
tool_definitions
agent_usage_records
```

后续预留：

```text
agent_tasks
agent_task_runs
agent_skills
agent_skill_versions
mcp_servers
mcp_tools
mcp_tool_permissions
tool_connections
```

### 9.1 agents

```ts
{
  id,
  tenantId,
  name,
  description,
  systemPrompt,
  modelProvider,
  modelConfig,
  enabledToolkits,
  enabledTools,
  approvalPolicy,
  isActive,
  createdBy,
  createdAt,
  updatedAt
}
```

### 9.2 agent_conversations

```ts
{
  id,
  tenantId,
  userId,
  agentId,
  channel,
  channelConversationId,
  title,
  contextType,
  contextId,
  createdAt,
  updatedAt
}
```

### 9.3 agent_messages

```ts
{
  id,
  tenantId,
  conversationId,
  role,
  content,
  metadata,
  createdAt
}
```

### 9.4 agent_runs

```ts
{
  id,
  tenantId,
  userId,
  agentId,
  conversationId,
  channel,
  status,
  intent,
  input,
  output,
  errorMessage,
  startedAt,
  completedAt
}
```

### 9.5 agent_tool_calls

```ts
{
  id,
  tenantId,
  userId,
  agentId,
  conversationId,
  runId,
  toolName,
  toolkit,
  input,
  output,
  status,
  riskLevel,
  approvalId,
  errorMessage,
  createdAt
}
```

### 9.6 agent_action_approvals

```ts
{
  id,
  tenantId,
  userId,
  agentId,
  conversationId,
  runId,
  toolName,
  input,
  summary,
  status,
  approvedBy,
  approvedAt,
  createdAt
}
```

### 9.7 agent_usage_records

```ts
{
  id,
  tenantId,
  userId,
  agentId,
  runId,
  usageType,
  inputTokens,
  outputTokens,
  toolCalls,
  credits,
  createdAt
}
```

## 10. 收费模式建议

采用：

```text
SaaS 套餐
+ Agent Credits
+ Toolkit 权限
+ Channel 权限
```

### Free / Trial

```text
PitchFlow 基础功能
站内 Agent
每月少量 Agent 消息
只支持查询和总结
不支持飞书/企微
不支持 MCP
```

### Pro

```text
PitchFlow Toolkit
站内 Agent
基础飞书/企微入口
每月 2,000 Agent Credits
支持创建挖掘任务
支持活动草稿
支持邮件回复总结
高风险操作需确认
```

### Business

```text
10,000 Agent Credits / 月
飞书/企微完整入口
自动通知
基础自动任务
邮件 Toolkit
审批流
团队用量统计
```

### Enterprise

```text
自定义 Credits
MCP Toolkit
自定义工具
自定义 Skill
SSO
审计导出
私有化部署
专属模型配置
企业级权限策略
Local Runner 可选
```

## 11. 自定义任务与技能规划

### 11.1 第一阶段不开放自定义 Skill

第一阶段只支持官方内置 Toolkit。

原因：

```text
权限复杂
工具安全复杂
变量映射复杂
审批复杂
计费复杂
错误回滚复杂
```

### 11.2 第二阶段开放自定义 Task

用户可以配置：

```text
每天 9 点总结昨日客户回复并发飞书
Discovery Job 完成后通知销售
有高意向客户回复时提醒负责人
每周生成活动表现报告
```

结构：

```text
Trigger
+ Condition
+ Action
+ Approval
```

### 11.3 第三阶段 Workflow Builder

可视化搭建：

```text
触发器
-> 查询数据
-> AI 总结
-> 条件判断
-> 调用工具
-> 发通知
-> 等待审批
```

### 11.4 第四阶段 Custom Skill

用户可创建可复用技能。

Skill 包含：

```text
名称
描述
输入参数
系统提示词
可用工具
步骤
风险等级
审批策略
```

### 11.5 第五阶段 MCP Skill

Enterprise 用户接自己的 MCP Server。

示例：

```text
内部 CRM MCP
Google Sheet MCP
Notion MCP
ERP MCP
LinkedIn 数据供应商 MCP
```

## 12. 安全边界

### 12.1 不在聊天中处理敏感密钥

禁止在聊天中收集或回显：

```text
邮箱密码
SMTP 密码
AI API Key
EmailEngine Token
Webhook Secret
Stripe Secret
```

处理方式：

```text
Agent 检查是否缺失
解释原因
生成站内安全配置链接
用户在安全表单配置
```

### 12.2 高风险动作必须确认

```text
发送邮件
启动活动
批量入库
批量删除
调用外部写操作
同步 CRM
修改系统配置
```

### 12.3 所有工具调用必须留痕

记录：

```text
用户原始指令
Agent 判断意图
调用工具
工具参数
执行结果
审批状态
渠道来源
执行用户
所属 tenant
时间
```

## 13. 阶段拆分

### Phase 0：架构与边界确认

目标：明确云端 Agent 平台边界、第一阶段不做本地控制、Toolkit / Channel / Approval / Billing 模型。

产出：

```text
Agent 架构文档
Tool Registry 设计
DB Schema 草案
权限策略
收费策略
```

### Phase 1：Agent Core + Web Channel

目标：跑通云端 Agent 正常对话 + mock tool call。

Codex 任务：

```text
1. 新增 lib/agent/types.ts
2. 新增 lib/agent/runtime.ts
3. 新增 lib/agent/tool-registry.ts
4. 新增 lib/agent/permissions.ts
5. 新增 agent_* 基础表
6. 新增 /api/agent/chat
7. 新增 Web Agent Panel
```

验收：

```text
用户可以正常聊天
Agent 可以判断是否调用 mock tool
tool call 可以写日志
普通对话不强制调用工具
```

### Phase 2：PitchFlow Toolkit - 配置体检

目标：Agent 能检查用户是否具备开始获客的基础配置。

Codex 任务：

```text
setup.check_readiness
product_profile.get/update/check
mail_account.list/check_status
template.list/check_default
icp.list/check
system_config.check_ai/search/emailengine
```

验收：

```text
Agent 能输出配置缺失清单
Agent 能补产品资料
Agent 能引导邮箱安全配置
Agent 能判断是否缺 ICP / 模板 / 邮箱
```

### Phase 3：PitchFlow Toolkit - 总结与查询

目标：Agent 能帮助用户看懂数据。

Codex 任务：

```text
prospect.list/get/summarize
discovery.list_jobs/summarize_job/list_candidates/summarize_candidates
campaign.list/get/summarize
email_reply.list/summarize
```

验收：

```text
用户可以让 Agent 总结客户
总结候选池
总结活动表现
总结邮件回复
```

### Phase 4：PitchFlow Toolkit - 轻操作

目标：Agent 能完成低风险和中风险操作。

Codex 任务：

```text
discovery.create_job
discovery.save_candidate_to_prospect
campaign.create_draft
template.create_draft
icp.create
```

验收：

```text
Agent 能创建挖掘任务
保存单个候选
创建活动草稿
创建 ICP 草稿
生成模板草稿
```

### Phase 5：Approval Engine

目标：高风险操作不能直接执行。

Codex 任务：

```text
agent_action_approvals 表
createApprovalRequest
confirmApproval
rejectApproval
ApprovalCard UI
将 campaign.start / batch operations 标记为 high risk
```

验收：

```text
启动活动必须确认
批量入库必须确认
拒绝后不执行
确认后才执行
所有审批写日志
```

### Phase 6：Feishu / WeCom Channel

目标：飞书和企微成为完整 Agent 入口。

Codex 任务：

```text
feishu.channel.ts
wecom.channel.ts
/api/channels/feishu
/api/channels/wecom
channel binding
channel policy
card approval
消息通知
```

验收：

```text
用户可在飞书/企微里问 Agent
可查询 PitchFlow 数据
可创建挖掘任务
可接收 Discovery 完成通知
可通过卡片确认高风险操作
```

### Phase 7：Email Toolkit

目标：Agent 可以跨 PitchFlow 和邮箱处理销售回复。

Codex 任务：

```text
email_reply.summarize
email_reply.detect_intent
email_reply.generate_reply_draft
daily_reply_digest
high_intent_alert
```

验收：

```text
Agent 能总结客户邮件
识别采购意向
生成回复草稿
飞书/企微推送客户回复摘要
```

### Phase 8：Agent Tasks

目标：用户可以配置基础自动任务。

Codex 任务：

```text
agent_tasks
agent_task_runs
schedule trigger
event trigger
notification action
approval action
```

验收：

```text
用户可以设置每日客户回复摘要
Discovery 完成自动通知
高意向客户自动提醒
```

### Phase 9：MCP Gateway

目标：Enterprise 用户可以接外部 MCP 工具。

Codex 任务：

```text
mcp_servers
mcp_tools
mcp_tool_permissions
mcp-client
mcp-tool-adapter
mcp tool whitelist
mcp call logs
```

验收：

```text
管理员可配置 MCP Server
系统可同步 MCP Tools
Agent 可在权限范围内调用 MCP Tool
高风险 MCP 写操作需确认
```

## 14. 第一版明确不做

```text
不控制用户电脑
不执行本地命令
不读取本地文件
不自动 LinkedIn 加好友
不自动 LinkedIn 私信
不自动批量发信
不开放用户自定义 Skill
不开放完整 MCP Gateway
不在聊天中收集敏感密钥
不绕过权限操作 PitchFlow 数据
```

## 15. 第一阶段用户体验

### 15.1 配置体检

```text
用户：帮我检查一下现在能不能开始获客。

Agent：
我检查到当前还缺 3 项：
1. 产品资料不完整
2. 当前账号未连接邮箱
3. 没有默认 ICP

我可以先帮你完善产品资料，并根据你的目标客户创建 ICP。
```

### 15.2 飞书回复摘要

```text
用户：帮我看看今天有哪些客户回复。

Agent：
今天共有 5 个客户回复：
- 2 个疑似有采购意向
- 1 个询价
- 1 个退订
- 1 个自动回复

是否查看高意向客户详情？
```

### 15.3 创建挖掘任务

```text
用户：帮我找 50 个美国宠物用品 DTC 品牌。

Agent：
我会使用 ICP「美国宠物用品 DTC 品牌」创建挖掘任务，目标数量 50。
任务创建后会进入搜索和筛选流程。

已创建任务：美国宠物用品 DTC 品牌
状态：searching
```

### 15.4 高风险确认

```text
用户：把 80 分以上的候选都入库。

Agent：
我找到 18 个 80 分以上候选。

即将执行：批量保存候选为客户
影响数量：18
是否确认？
```

## 16. Codex 实施建议

不要一次性让 Codex 做完整平台。

建议 PR 拆分：

```text
PR 1: Agent Core + mock tool
PR 2: agent_* DB tables + logging
PR 3: Web Agent Panel
PR 4: PitchFlow setup tools
PR 5: PitchFlow summary/query tools
PR 6: PitchFlow light action tools
PR 7: Approval Engine
PR 8: Feishu/WeCom Channel skeleton
PR 9: Email summary tools
PR 10: Agent Tasks skeleton
```

每个 PR 要求：

```text
npm run build 通过
类型检查通过
不破坏现有 PitchFlow API
新增功能默认低风险
高风险动作必须确认
```

## 17. 最终目标

这一版完成后，产品会从：

```text
PitchFlow：一个外贸获客 SaaS 后台
```

升级为：

```text
Hemera：一个云端 Agent 平台
PitchFlow：Hemera 的第一个深度业务 Toolkit
```

后续逐步扩展：

```text
Email Toolkit
Agent Tasks
Workflow Builder
MCP Toolkit
CRM Toolkit
LinkedIn 辅助
Browser Extension
Local Runner
Custom Skills
```
