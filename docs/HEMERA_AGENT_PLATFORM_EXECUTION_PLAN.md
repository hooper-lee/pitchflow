# Hemera Agent Platform 完整落地方案

> 本文档用于固化当前讨论后的最终方向：Hemera 是云端 Agent 平台，PitchFlow 是第一阶段深度业务 Toolkit。后续开发不能再把 Agent 做成 PitchFlow 表单助手，而应按平台层、团队权限、套餐计费、Channel、Workflow 和 Tool Router 分层落地。

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

## 2. 团队与数字员工模型

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

## 3. 套餐与能力矩阵

Agent 权限不能只靠单个 tool 的 `requiredPlan` 兜底，需要先做产品层策略，再做工具层策略。

### 3.1 Free

```text
允许：
- 普通对话
- 流程解释
- 配置体检
- 只读状态查询
- 少量上下文

禁止：
- 创建挖掘任务
- 创建 ICP
- 创建活动草稿
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

### 3.2 Pro

```text
允许：
- 站内 Agent 完整基础能力
- 创建产品资料
- 创建 ICP
- 创建精准挖掘任务
- 总结候选池
- 创建活动草稿
- 生成邮件草稿
- 总结客户和活动

限制：
- 高风险操作必须确认
- 飞书/企微只支持基础通知或查询

额度：
- 每月 2,000 Agent Credits
- 上下文最多最近 30 条消息
```

### 3.3 Business

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

### 3.4 Enterprise

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

## 4. Agent 权限检查链路

每次 Agent 请求不能直接进入 Planner。

统一链路：

```text
收到用户消息
-> 识别 tenant / user / channel
-> 检查 tenant 是否启用 Agent
-> 检查 user 是否可用 Agent
-> 检查 tenant plan
-> 检查本月 credits 是否足够
-> 按套餐裁剪上下文
-> 调 Planner 做目标识别
-> 检查 intent / workflow 是否允许
-> 进入 Workflow
-> 检查 Tool 权限
-> 检查是否需要审批
-> 执行 Tool
-> 记录 usage / audit / tool call
-> 总结结果返回用户
```

需要两层策略。

### 4.1 产品层策略

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
```

建议常量：

```ts
type AgentPlanPolicy = {
  monthlyCredits: number;
  contextMessageLimit: number;
  allowedIntents: string[];
  allowedWorkflows: string[];
  allowedChannels: Array<"web" | "feishu" | "wecom" | "api">;
  allowAutoTasks: boolean;
  allowMcp: boolean;
};
```

### 4.2 工具层策略

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

## 5. Credits 与上下文限制

Agent credits 应按 tenant 月度统计。

建议初始扣费：

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

必须支持：

```text
run 前检查剩余额度
tool 前检查剩余额度
成功和失败都记录 usage
失败可标记 failed，不一定全额扣费，第一版可先统一扣基础 run credit
```

上下文限制：

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

## 6. Workflow 设计

Agent 不应该是工具选择器，而应该是目标驱动工作流。

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

不应该：

```text
向用户暴露 toolName
向用户暴露 JSON
向用户暴露字段清单式表单
让模型直接绕过权限执行工具
```

## 7. 飞书 / 企微 Channel 设计

飞书/企微配置应是 tenant 级 Channel Binding，不是用户随便填 webhook。

### 7.1 配置流程

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

### 7.2 消息进入链路

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

### 7.3 第一版范围

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

## 8. Admin 后台能力

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

## 9. 数据模型建议

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
```

第一版可以先不新增复杂策略表，把策略写成代码常量，但必须保证执行链路按策略检查。

## 10. 安全边界

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

## 11. 推荐实施顺序

### Step 1：Agent 产品层策略

```text
新增 Agent plan policy 常量
新增 run 前 credits 检查
新增 intent/workflow 权限检查
新增上下文裁剪
Free 禁止写操作 workflow
```

### Step 2：Usage 与 Credits

```text
普通对话记录 1 credit
Planner 记录 usage
Tool 调用记录 tool credit
月度 usage 聚合
超额提示升级
```

### Step 3：团队成员权限

```text
按 tenant + userRole 控制 Agent 能力
viewer/member/team_admin 权限矩阵
高风险审批限制 team_admin
usage 记录 userId
```

### Step 4：Agent 创建/启用产品化

```text
不要永远自动创建默认 Agent
首次使用引导启用数字员工
team_admin 可管理 Agent 名称和开关
普通成员看到已启用 Agent
```

### Step 5：飞书/企微私聊绑定

```text
站内生成绑定码
飞书/企微私聊绑定
webhook 身份映射
私聊查询和通知
```

### Step 6：审批与 Channel 卡片

```text
审批卡片
确认/拒绝 API
点击人权限二次校验
高风险动作恢复执行
```

### Step 7：Admin 可视化

```text
Agent usage
Agent runs
Tool calls
Approvals
Channel bindings
Plan policy 查看
```

## 12. 当前代码状态判断

现在已经有：

```text
Agent runtime 雏形
Tool Registry
Permission 检查雏形
Usage records
Approval 表和 API 雏形
Agent Panel
Workflow Runtime 初版
Admin Agent 页面雏形
```

现在还缺：

```text
产品层 Agent plan policy
run 前 credits 检查
普通对话 credits
上下文裁剪
Free / Pro / Business / Enterprise 能力矩阵落地
tenant 级 Agent 启用流程
成员级权限矩阵
飞书/企微真实绑定流程
Channel policy
审批卡片二次校验
Agent usage 展示闭环
```

## 13. 最终判断

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

后续所有开发必须遵守这个分层。
