# Hemera Agent Platform 改造执行书

> 本文档是后续 Codex / 人工开发的强约束执行说明。当前目标不是继续给 PitchFlow 增加一个表单式聊天助手，而是基于现有代码状态，纠偏并落地 Hemera Cloud Agent Platform。PitchFlow 是第一阶段深度业务 Toolkit，但 Agent Core 必须保持平台化、团队化、可计费、可审计、可扩展到 Channel / MCP / Tasks / Skills。

---

## 0. Codex 执行总约束

后续所有 Codex 任务必须先阅读并遵守本节。

### 0.1 本项目最终方向

```text
Hemera = 云端 Agent 平台 / 团队数字员工平台
PitchFlow = Hemera 第一阶段接入的外贸获客 Toolkit
Agent = 团队级数字员工
Workflow = 业务目标执行器
Tool = 被权限、套餐、审批、Channel policy 控制的底层动作
Channel = Web / 飞书 / 企微 / API 等入口
Credits = Agent 平台计费单位
```

### 0.2 禁止继续偏成 PitchFlow 表单助手

禁止把 Agent 继续实现成：

```text
PitchFlow 菜单问答机器人
PitchFlow 表单字段收集器
PitchFlow service 包装器集合
只会按 requiredSlots 追问的 slot-filling bot
不计费、不限权、不审计的工具调用器
```

### 0.3 当前阶段禁止事项

在完成平台纠偏前，Codex 禁止做以下事情：

```text
禁止新增 PitchFlow 业务工具
禁止新增 MCP 功能
禁止新增飞书/企微完整实现
禁止新增复杂业务页面
禁止扩展 Workflow requiredSlots
禁止让 Free 套餐执行任何写操作 workflow
禁止在聊天中收集邮箱密码、API Key、Token、Secret
禁止把高风险操作做成直接执行
禁止把 Agent 默认命名为 PitchFlow Agent
禁止让工具层策略替代产品层策略
```

### 0.4 当前阶段必须优先完成

当前阶段只做平台层纠偏：

```text
1. Agent Plan Policy
2. Channel Policy
3. Workflow Policy
4. Run 前 credits 检查
5. Run-level usage 记录
6. 上下文裁剪
7. Free / Pro / Business / Enterprise 能力矩阵落地
8. 默认 Agent 心智从 PitchFlow Agent 改为 Hemera Agent
9. Workflow 去表单化
10. Admin / Logs 能看到 Agent usage / runs / tool calls / approvals
```

---

## 1. 产品定位

Hemera 不是 PitchFlow 里的一个聊天框，而是面向团队的云端数字员工平台。

PitchFlow 在第一阶段只是 Hemera 的一个内置业务工具包，负责外贸获客链路：

```text
产品资料
-> ICP 画像
-> 精准挖掘
-> 候选审核
-> 客户入库
-> AI 调研评分
-> 邮件活动
-> 自动跟进
-> 回复追踪
```

Hemera Agent 负责：

```text
自然对话
目标识别
上下文承接
业务工作流编排
权限检查
套餐与 credits 检查
工具调用
审批确认
结果总结
审计留痕
Channel 分发
```

核心边界：

```text
用户看到的是数字员工和业务任务。
系统内部才是 PitchFlow Toolkit、Tool Registry、Workflow、MCP、Channel。
```

---

## 2. 当前代码状态与纠偏判断

当前代码已经具备 Agent 雏形，但存在偏移风险。

### 2.1 已有能力

```text
lib/agent/runtime.ts
lib/agent/planner.ts
lib/agent/tool-registry.ts
lib/agent/permissions.ts
lib/agent/billing.ts
lib/agent/approvals.ts
lib/agent/workflows/*
lib/agent/toolkits/pitchflow/*
app/api/agent/chat/route.ts
agent_* 数据表雏形
Agent Panel / Admin Agent 页面雏形
```

### 2.2 当前主要问题

```text
1. 默认 Agent 仍偏 PitchFlow 心智。
2. 很多写操作 requiredPlan 仍是 free。
3. 权限检查主要停留在 tool-level，没有产品层 plan policy。
4. billing 只记录 tool usage，没有 run-level / planner / 普通对话 usage。
5. Workflow 当前容易变成 requiredSlots 表单收集器。
6. runAgent 入口还没有在 Planner 前做 tenant plan / credits / context limit 检查。
7. Channel policy 还未形成。
8. Agent 启用流程还不够产品化，默认自动创建会弱化团队数字员工心智。
```

### 2.3 纠偏目标

现有 runtime / tool registry / approval / workflow 雏形可以保留，但必须调整执行顺序和职责边界：

```text
先平台策略
再工具权限
先 credits / context / plan
再 planner / workflow
先目标驱动 workflow
再工具调用
先草稿和确认
再真实执行
```

---

## 3. 团队与数字员工模型

PitchFlow 是多租户 SaaS，所以 Agent 必须按 tenant 维度管理。

第一版建议：

```text
每个 tenant 默认 1 个主 Agent
Agent 属于 tenant
成员只是 Agent 的使用者
Credits 按 tenant 扣
Usage 按 tenant + user 记录
```

后续再支持：

```text
一个 tenant 多个 Agent
不同 Agent 绑定不同 Toolkit
不同 Agent 拥有不同角色和工作流
```

每次 Agent 请求必须带：

```ts
{
  tenantId: string;
  userId: string;
  userRole: "viewer" | "member" | "team_admin" | "super_admin";
  tenantPlan: "free" | "pro" | "business" | "enterprise";
  channel: "web" | "feishu" | "wecom" | "api";
  agentId: string;
  conversationId?: string;
}
```

角色边界：

```text
viewer
- 只读查询
- 流程问答
- 不能创建任务
- 不能改配置
- 不能审批

member
- 普通对话
- 配置体检
- 创建低/中风险草稿
- 创建 ICP 草稿
- 创建挖掘任务
- 查看自己权限内客户和活动

team_admin
- 配置 Agent
- 管理 Channel
- 审批高风险操作
- 查看团队 Agent 用量
- 管理成员权限

super_admin
- 平台后台管理员
- 管理全局 Prompt
- 管理套餐
- 管理系统级开关
- 不应混作普通租户成员权限
```

---

## 4. 套餐与能力矩阵

Agent 权限不能只靠单个 tool 的 `requiredPlan` 兜底，需要先做产品层策略，再做工具层策略。

### 4.1 Free

```text
允许：
- 普通对话
- 流程解释
- 配置体检
- 只读状态查询
- 少量上下文

禁止：
- 创建产品资料
- 创建挖掘任务
- 创建 ICP
- 创建客户
- 创建活动草稿
- 创建邮件模板草稿
- 生成邮件草稿
- 启动活动
- 发送邮件
- 飞书/企微 Agent
- 自动任务
- MCP

额度：
- 每月 100 Agent Credits
- 上下文最多最近 10 条消息
```

### 4.2 Pro

```text
允许：
- 站内 Agent 完整基础能力
- 创建 / 更新产品资料
- 创建 ICP
- 创建精准挖掘任务
- 总结候选池
- 创建活动草稿
- 创建邮件模板草稿
- 生成邮件草稿
- 总结客户和活动

限制：
- 高风险操作必须确认
- 飞书/企微只支持基础通知或查询

额度：
- 每月 2,000 Agent Credits
- 上下文最多最近 30 条消息
```

### 4.3 Business

```text
允许：
- Pro 全部能力
- 飞书/企微私聊 Agent
- 客户回复摘要
- Discovery 完成通知
- 活动日报
- 基础自动任务
- 审批卡片
- 团队 Agent 用量统计

额度：
- 每月 10,000 Agent Credits
- 上下文最多最近 50 条消息
```

### 4.4 Enterprise

```text
允许：
- Business 全部能力
- 自定义 Agent Credits
- 自定义 Toolkit 权限
- MCP Gateway
- 自定义 Skill
- 自定义审批策略
- SSO
- 审计导出
- 私有化部署
- 专属模型配置
- 可选 Browser Extension / Local Runner

额度：
- 自定义
- 上下文限制可配置
```

---

## 5. Agent 权限检查链路

每次 Agent 请求不能直接进入 Planner。

统一链路必须是：

```text
收到用户消息
-> 识别 tenant / user / channel
-> 检查 tenant 是否启用 Agent
-> 检查 user 是否可用 Agent
-> 检查 tenant plan
-> 检查本月 credits 是否足够
-> 按套餐裁剪上下文
-> 记录 run-level usage 基础额度
-> 调 Planner 做目标识别
-> 检查 intent / workflow 是否允许
-> 进入 Workflow
-> 检查 Tool 权限
-> 检查 Tool 级 credits 是否足够
-> 检查是否需要审批
-> 执行 Tool
-> 记录 usage / audit / tool call
-> 总结结果返回用户
```

需要两层策略。

### 5.1 产品层策略

控制：

```text
是否启用 Agent
允许哪些 intent
允许哪些 workflow
允许哪些 channel
每月 credits
上下文窗口大小
每月对话次数
每分钟请求频率
是否允许写操作
是否允许自动任务
是否允许 MCP
```

建议新增：

```text
lib/agent/policies/plan-policy.ts
lib/agent/policies/channel-policy.ts
lib/agent/policies/workflow-policy.ts
```

建议类型：

```ts
type AgentPlanPolicy = {
  monthlyCredits: number;
  contextMessageLimit: number;
  allowedIntents: string[];
  allowedWorkflows: string[];
  allowedChannels: Array<"web" | "feishu" | "wecom" | "api">;
  allowWriteTools: boolean;
  allowAutoTasks: boolean;
  allowMcp: boolean;
};
```

### 5.2 工具层策略

控制：

```text
requiredPlan
requiredRole
creditCost
riskLevel
requiresApproval
allowedChannels
rateLimit
idempotencyKey
```

工具层不能替代产品层，因为普通对话、Planner、上下文读取、结果总结也会消耗 Agent 能力。

---

## 6. Credits 与上下文限制

Agent credits 应按 tenant 月度统计。

### 6.1 初始扣费建议

```text
普通对话：1 credit
Planner 调用：1 credit
低风险查询工具：2 credits
AI 总结：3 credits
邮件草稿生成：3 credits
创建挖掘任务：10 credits
生成候选总结：5 credits
飞书/企微消息：1 credit
MCP 工具调用：Enterprise 自定义
```

### 6.2 必须支持

```text
run 前检查剩余额度
tool 前检查剩余额度
普通对话也记录 usage
Planner 调用也记录 usage
工具调用记录 tool usage
成功和失败都记录 usage
失败可标记 failed，不一定全额扣费，第一版可先统一扣基础 run credit
月度 usage 聚合或查询函数
超额提示升级
```

### 6.3 上下文限制

```text
Free：最近 10 条消息
Pro：最近 30 条消息
Business：最近 50 条消息
Enterprise：默认 100 条或自定义
```

注意：

```text
上下文限制不是 conversation 数量限制。
一个 conversation 可以很长，但每次送给模型的上下文要按套餐裁剪。
```

### 6.4 推荐函数

```ts
ensureAgentCreditsAvailable(ctx, estimatedCredits)
recordAgentRunUsage(ctx, credits, metadata)
recordAgentPlannerUsage(ctx, credits, metadata)
recordAgentToolUsage(ctx, toolName, credits, metadata)
getMonthlyAgentCreditsUsed(tenantId)
trimConversationContext(messages, planPolicy.contextMessageLimit)
```

---

## 7. Workflow 设计：必须去表单化

Agent 不应该是工具选择器，也不应该是字段表单收集器，而应该是目标驱动工作流。

当前第一阶段需要的 Workflow：

```text
setup_product_profile
setup_icp_profile
setup_email_template
start_discovery
create_campaign
create_prospect
summarize_campaign
summarize_discovery_candidates
summarize_replies
```

Workflow 负责：

```text
保存当前任务状态
抽取用户自然语言中的业务事实
判断缺失信息
自然追问
构造工具输入
决定是否需要审批
解释结果
```

### 7.1 Workflow 禁止项

```text
禁止向用户暴露 toolName
禁止向用户暴露 JSON
禁止向用户暴露字段名
禁止用“请补充 companyName / productName / targetCustomerText”这类字段式话术
禁止把所有 Workflow 做成 requiredSlots 表单
禁止让模型直接绕过权限执行工具
```

### 7.2 Workflow 必须遵守

```text
以用户目标为中心，不以表单字段为中心
能从自然语言推断的信息必须自动推断
缺失信息时最多追问 1-2 个关键业务问题
每次追问必须解释为什么需要这个信息
执行前给用户业务化摘要，而不是字段清单
高风险动作只创建 approval，不直接执行
```

### 7.3 示例

用户：

```text
帮我找 50 个美国宠物用品 DTC 品牌。
```

不应该追问：

```text
请补充 keywords。
```

应该自动推断：

```ts
{
  country: "United States",
  targetLimit: 50,
  keywords: ["pet supplies", "DTC pet brand", "dog products", "cat products"]
}
```

然后回复：

```text
我会按“美国宠物用品 DTC 品牌”创建精准挖掘任务，目标数量 50，并排除 marketplace、目录站和纯媒体文章。现在开始创建。
```

---

## 8. Tool 策略修正

当前 `pitchflowWriteTools` 里部分写操作仍为 `requiredPlan: "free"`，必须修正。

### 8.1 Free 允许的 Tool 类型

```text
read-only 查询
配置体检
流程解释
低成本总结
```

示例：

```text
pitchflow.setup.check_readiness
pitchflow.product_profile.get
pitchflow.mail_account.list
pitchflow.icp.list
pitchflow.template.list
pitchflow.prospect.list
pitchflow.discovery.list_jobs
pitchflow.campaign.list
pitchflow.email_reply.list
```

### 8.2 Pro 起允许的写操作

```text
pitchflow.product_profile.upsert
pitchflow.icp.create
pitchflow.icp.update
pitchflow.discovery.create_job
pitchflow.campaign.create_draft
pitchflow.template.create_draft
pitchflow.template.update
pitchflow.prospect.create
pitchflow.prospect.update
```

### 8.3 Business 起允许的 Channel 能力

```text
飞书 / 企微私聊 Agent
飞书 / 企微通知
审批卡片
基础自动任务
```

### 8.4 Enterprise 起允许的高级能力

```text
MCP Gateway
Custom Skill
Custom Toolkit
SSO
审计导出
Local Runner / Browser Extension 可选能力
```

---

## 9. Default Agent 心智修正

当前默认 Agent 不能继续叫 `PitchFlow Agent`。

必须改为：

```text
Name: Hemera Agent
Description: 云端数字员工，当前已接入 PitchFlow Toolkit
```

默认系统提示词建议：

```text
你是 Hemera 云端数字员工。你不是 PitchFlow 表单助手，而是目标驱动的业务 Agent。当前已接入 PitchFlow Toolkit，可以帮助外贸团队完成配置检查、客户挖掘、客户总结、邮件回复总结、活动草稿和审批确认。你必须遵守租户隔离、角色权限、套餐限制、credits 限制和高风险操作审批。敏感密钥不得在聊天中收集。
```

默认启用策略：

```text
默认启用基础对话和只读/配置体检能力
写操作是否可用由 plan policy 和 tool policy 决定
```

---

## 10. 飞书 / 企微 Channel 设计

飞书/企微配置应是 tenant 级 Channel Binding，不是用户随便填 webhook。

### 10.1 配置流程

```text
team_admin 在 PitchFlow 设置页启用飞书/企微
-> 系统生成绑定码或安装链接
-> 管理员把机器人安装到对应组织
-> 飞书/企微 webhook 回调到 PitchFlow
-> 用户私聊机器人发送绑定码
-> 系统建立外部用户与 PitchFlow 用户的绑定关系
```

绑定字段：

```ts
{
  tenantId: string;
  userId: string;
  channel: "feishu" | "wecom";
  externalWorkspaceId: string;
  externalUserId: string;
  externalOpenId?: string;
  externalChatId?: string;
  role: string;
  isActive: boolean;
  boundAt: Date;
}
```

### 10.2 消息进入链路

```text
收到飞书/企微 webhook
-> 校验 webhook 签名
-> 解析 externalUserId / externalChatId
-> 查 agent_channel_bindings
-> 找到 tenantId + userId
-> 检查 tenant plan 是否允许 channel
-> 检查 user role
-> 进入 Agent Runtime
```

### 10.3 第一版范围

第一版只做：

```text
私聊绑定
私聊查询
私聊任务状态
客户回复摘要通知
Discovery 完成通知
审批卡片占位
```

第一版不做：

```text
群聊执行写操作
群聊高风险审批
复杂表单配置
输入邮箱密码/API Key
完整 MCP 操作
```

群聊第一版只做通知，不允许执行写操作。

审批卡片点击时必须二次校验：

```text
点击人是否绑定 PitchFlow 用户
点击人是否属于当前 tenant
点击人是否有审批权限
approval 是否未过期
approval 是否还未被处理
```

---

## 11. Admin 后台能力

第一阶段 admin 至少需要：

```text
Agent 全局开关
Tenant Agent 开关
套餐 Agent 权限查看
Agent Credits 查看
Agent Runs 列表
Tool Calls 列表
Approvals 列表
Channel Bindings 列表
失败 Tool Calls 查看
Prompt 配置
```

第二阶段再做：

```text
套餐策略编辑
租户级 Agent 策略编辑
Tool 风险等级编辑
Credits 手动调整
Channel 绑定管理
MCP Server 管理
Skill 管理
```

---

## 12. 数据模型建议

已有表可以继续用：

```text
agents
agent_conversations
agent_messages
agent_runs
agent_tool_calls
agent_action_approvals
agent_usage_records
agent_channels
agent_channel_bindings
```

需要补充或强化：

```text
agent_plan_policies
agent_context_policies
agent_tool_policies
agent_monthly_usage_snapshots
agent_workflow_states
agent_memories
agent_memory_embeddings
agent_context_snapshots
agent_task_states
```

第一版可以先不新增复杂策略表，把策略写成代码常量，但必须保证执行链路按策略检查。

---

## 13. 记忆与持久化设计

Agent 记忆分 5 层。

### 13.1 短期上下文

```text
agent_conversations
agent_messages
```

用于保存当前对话历史。

### 13.2 工作记忆 / 任务状态

```text
agent_runs
agent_tool_calls
agent_action_approvals
agent_workflow_states
agent_task_states
```

用于保存当前任务执行到哪一步、等待什么审批、上一次工具返回什么。

### 13.3 长期用户偏好

```text
agent_memories
```

只保存明确偏好或经过用户确认的推断，例如：

```text
邮件写短一点
默认目标市场是美国
默认语气专业简洁
常用 ICP 是宠物用品 DTC 品牌
```

不要把普通聊天都写入长期记忆。

### 13.4 业务事实

PitchFlow 业务数据仍以主业务库为准，不复制到 Agent memory。

```text
prospects
campaigns
emails
icp_profiles
lead_discovery_jobs
lead_discovery_candidates
tenants.settings.productProfile
```

Agent 需要时通过 Toolkit 查询。

### 13.5 语义记忆

后续引入：

```text
agent_memory_embeddings
pgvector
```

用于检索历史对话、客户摘要、邮件摘要、任务记录。

---

## 14. 安全边界

Agent 第一版默认角色：

```text
建议
总结
起草
检查
创建低风险任务
发起审批
```

Agent 第一版不能：

```text
自动启动活动
自动批量入库
自动发送邮件
替用户承诺价格
替用户承诺交期
替用户承诺认证
绕过审批
读取或保存敏感密钥
控制用户电脑
读取用户本地文件
执行本地命令
自动 LinkedIn 加好友
自动 LinkedIn 私信
```

敏感信息禁止进入聊天：

```text
邮箱密码
SMTP 密码
AI API Key
EmailEngine Token
Webhook Secret
Stripe Secret
私钥
```

这些必须走站内安全配置表单。

---

## 15. 改造执行阶段

### Phase A：平台纠偏，当前必须优先完成

本阶段不新增业务工具。

必须完成：

```text
1. 新增 Agent plan policy 常量。
2. 新增 Channel policy 常量。
3. 新增 Workflow policy 常量。
4. 在 runAgent 入口最前面执行产品层检查。
5. run 前检查 credits。
6. 普通对话记录 run-level usage。
7. Planner 记录 usage。
8. Tool 调用记录 usage。
9. 新增 monthly usage 查询函数。
10. 新增上下文裁剪。
11. Free 禁止所有写操作 workflow。
12. 修正 write tools requiredPlan。
13. 默认 Agent 改为 Hemera Agent。
14. Workflow 去表单化，最多追问 1-2 个业务问题。
```

验收标准：

```text
Free 用户无法创建 ICP / 挖掘任务 / 活动草稿 / 模板草稿 / 客户。
Free 用户可以普通对话、配置体检、只读查询。
Pro 用户可以创建 PitchFlow 基础草稿和任务。
Business 才能使用飞书/企微 Channel。
每次 Agent run 都会写 usage。
普通对话也会扣基础 credit。
runAgent 不会在 plan policy 检查前进入 Planner。
默认 Agent 名称是 Hemera Agent。
Workflow 不再向用户展示字段名。
npm run build 通过。
```

### Phase B：团队成员权限与 Agent 启用产品化

```text
按 tenant + userRole 控制 Agent 能力
viewer/member/team_admin 权限矩阵落地
team_admin 才能管理 Agent / Channel / 审批
不要永远自动创建默认 Agent
首次使用引导启用数字员工
team_admin 可管理 Agent 名称和开关
普通成员看到已启用 Agent
```

### Phase C：审批与高风险恢复执行

```text
审批卡片
确认/拒绝 API
审批人权限二次校验
approval 未过期校验
approval 未处理校验
高风险动作确认后恢复执行
所有审批写 audit 和 usage
```

### Phase D：飞书/企微私聊绑定

```text
站内生成绑定码
飞书/企微私聊绑定
webhook 签名校验
externalUserId -> PitchFlow user 映射
私聊查询和通知
群聊仅通知，不允许写操作
```

### Phase E：Admin 可视化

```text
Agent usage
Agent runs
Tool calls
Approvals
Channel bindings
Plan policy 查看
失败 Tool Calls 查看
```

### Phase F：Agent Tasks

```text
每日客户回复摘要
Discovery 完成自动通知
高意向客户自动提醒
活动日报
基础 schedule trigger / event trigger
```

### Phase G：MCP / Custom Skill

仅 Enterprise。

```text
mcp_servers
mcp_tools
mcp_tool_permissions
mcp-client
mcp-tool-adapter
MCP Tool 白名单
高风险 MCP 写操作审批
Custom Skill
Workflow Builder
```

---

## 16. 当前给 Codex 的推荐任务 Prompt

可以直接使用：

```text
请严格按照 docs/HEMERA_AGENT_PLATFORM_EXECUTION_PLAN.md 执行，但本轮只允许做 Phase A：平台纠偏。

本轮禁止：
- 禁止新增 PitchFlow 业务工具
- 禁止新增 MCP / 飞书 / 企微完整实现
- 禁止新增复杂业务页面
- 禁止扩展 Workflow requiredSlots
- 禁止让 Free 执行任何写操作
- 禁止把 Agent 实现成字段表单收集器

本轮必须完成：
1. 新增 Agent plan policy / channel policy / workflow policy。
2. 在 runAgent 入口最前面做产品层检查：agent enabled、tenant plan、channel、credits、context limit。
3. 新增 intent/workflow 权限检查。
4. 新增上下文裁剪逻辑。
5. Free 禁止所有写操作 workflow。
6. 修正 write tools requiredPlan：Free 只能查询/总结/配置体检；Pro 起才能创建 ICP、创建挖掘任务、创建活动草稿、创建模板草稿、创建客户。
7. 默认 Agent 改为 Hemera Agent，system prompt 强调平台心智。
8. Workflow 去表单化：不得暴露字段名，缺信息最多追问 1-2 个业务问题，能推断的自动推断。
9. 新增 run-level usage：普通对话、Planner、Tool 调用都要记录 credits。
10. 新增 monthly usage 查询函数，run 前检查剩余额度。
11. npm run build 必须通过。

完成后请说明修改文件、权限策略、usage 记录逻辑和测试方式。
```

---

## 17. 最终判断

如果继续按“PitchFlow 页面助手”做，Agent 会越来越像一个笨表单。

正确方向是：

```text
Hemera = 云端数字员工平台
PitchFlow = 第一个外贸获客 Toolkit
Agent = 团队级数字员工
Workflow = 业务目标执行器
Tool = 被权限和审批控制的底层动作
Channel = Web / 飞书 / 企微 / API 入口
Credits = Agent 平台计费单位
```

后续所有开发必须遵守这个分层。任何 PR 如果只是在增加 PitchFlow Tool，而没有完善平台策略层，都应视为偏离方向。
