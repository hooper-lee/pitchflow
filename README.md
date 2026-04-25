# PitchFlow

PitchFlow 是一个帮助外贸团队筛选潜在客户、生成个性化开发信并管理跟进节奏的 AI 获客助手，把「客户挖掘 -> AI 调研评分 -> 个性化发信 -> 自动跟进 -> 消息追踪」压到同一条工作流里。

## 当前产品能力

- **客户挖掘**：统一通过异步 Discovery Job 执行；不选择 ICP 画像时就是快速挖掘，选择画像后进入精准筛选
- **搜索编排与来源评分**：基于 ICP 自动扩展 product / brand / DTC / official_site / platform 等意图查询，并记录来源质量分
- **官网识别引擎**：Cheerio 抓取 + 5 维度评分，筛出更像真实客户官网的站点
- **ICP 精准发现**：用户可用自然语言创建客户画像，系统解析 must-have / must-not-have / 正负关键词 / 产品分类 / 销售模式，并异步产出候选池
- **候选池审核**：先进入 discovery candidates，再做接受、拒绝、拉黑、入库，避免搜索结果直接污染 prospects
- **AI 调研评分**：抽取公司规模、类型、主要产品、目标市场、决策人，并结合 ICP 与搜索来源质量生成五维评分、等级和推荐动作
- **双评分客户分层**：同时保留搜索评分与调研评分，区分“值得入库”和“值得优先联系”
- **Golden Set 挖掘评测**：后台支持人工标注样本 A/B 规则评测、真实搜索源 metadata 抽样和真实搜索 Top 结果规则判定
- **流式 AI 体验**：模板 AI 生成支持流式回填，客户调研支持阶段式进度反馈，活动启动支持批量邮件生成进度
- **活动与自动跟进**：按评分筛选客户进入活动，支持默认 3 / 7 / 14 天自动跟进与停止跟进天数控制
- **用户自有邮箱接入**：通过 EmailEngine 连接用户自己的 IMAP / SMTP 邮箱，实现发信与回复读取
- **消息追踪**：客户回复后可触发邮件、飞书、企微消息追踪，并携带回复摘要
- **活动状态闭环**：客户回复后停止后续跟进；活动内客户都回复或达到停止条件后，活动自动完成

## 典型工作流

```text
行业 / 关键词搜索
  -> 官网识别与去重
  -> 客户入库
  -> 或创建 ICP Discovery Job
  -> 候选池审核 / 拉黑 / 入库
  -> AI 调研与五维评分
  -> 按 A/B/C/D 分层筛选
  -> 创建营销活动
  -> 使用当前登录账号注册邮箱对应的已连接邮箱账号发信
  -> 自动跟进与消息追踪
```

## Landing 页说明

- **客户挖掘结果演示**：展示搜索结果如何带搜索评分进入列表，以及为什么某些官网更值得入库
- **AI 调研结果演示**：展示结构化画像、五维评分、综合评分和推荐动作，而不是一段难复用的摘要文本
- **当前重点表达**：PitchFlow 不只是搜公司名，而是围绕 ICP 画像筛选更像目标客户、且更可能回复的潜在线索

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + React + Tailwind CSS + shadcn/ui |
| 后端 | Next.js API Routes + Drizzle ORM |
| 数据库 | PostgreSQL |
| 认证 | NextAuth.js |
| 搜索引擎 | SearXNG（自部署，无配额限制） |
| 页面抓取 | Cheerio（Playwright 可选兜底） |
| 邮件发送 / 收信 | EmailEngine |
| AI | OpenAI 兼容接口（Claude / 自定义） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，至少填入数据库和认证配置：

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/pitchflow
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
NEXTAUTH_SECRET=your-secret-here
```

如果要启用完整能力，还需要配置：

- `CUSTOM_AI_BASE_URL`
- `CUSTOM_AI_API_KEY`
- `CUSTOM_AI_MODEL`
- `EMAILENGINE_URL`
- `EMAILENGINE_ACCESS_TOKEN`
- `EMAILENGINE_WEBHOOK_BASE_URL`
- `SEARXNG_URL`
- `SEARCH_PROVIDERS=searxng`
- `DISCOVERY_RULE_VARIANT=B`

### 3. 启动搜索引擎（SearXNG）

```bash
docker run -d --name searxng -p 8888:8080 \
  -v $(pwd)/searxng/settings.yml:/etc/searxng/settings.yml \
  searxng/searxng
```

验证：

```bash
curl http://localhost:8888/search?q=test&format=json
```

### 4. 初始化数据库

```bash
npm run db:push
```

### 5. 初始化探测器黑名单

```bash
npx tsx scripts/seed-detector.ts
```

### 6. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## AWS Docker 部署

适用于没有域名、直接通过服务器 IP 首次部署：

### 1. 服务器准备

- Ubuntu 22.04
- 已开放端口：`22 / 3000 / 3001 / 8888`
- 安装 Docker 与 Docker Compose Plugin

### 2. 克隆代码并准备生产环境变量

```bash
git clone https://github.com/hooper-lee/pitchflow.git
cd pitchflow
cp .env.production.example .env.production
```

至少需要确认这些值：

- `NEXTAUTH_URL`
- `AUTH_TRUST_HOST=true`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`
- `EMAILENGINE_WEBHOOK_BASE_URL`
- `EMAILENGINE_INTERNAL_SECRET`
- `EMAILENGINE_ACCESS_TOKEN`
- `EMAILENGINE_PREPARED_TOKEN`
- `CUSTOM_AI_BASE_URL`
- `CUSTOM_AI_API_KEY`
- `CUSTOM_AI_MODEL`

### 3. 启动整套服务

首次生成 EmailEngine token：

```bash
docker run -d --name pitchflow-redis-bootstrap redis:7
docker run --rm --network host \
  -e EENGINE_REDIS=redis://127.0.0.1:6379/2 \
  postalsys/emailengine:v2 \
  emailengine tokens issue --scope api
```

把输出的明文 token 填进 `EMAILENGINE_ACCESS_TOKEN`，再执行：

```bash
docker run --rm --network host \
  -e EENGINE_REDIS=redis://127.0.0.1:6379/2 \
  postalsys/emailengine:v2 \
  emailengine tokens export --scope api
```

把输出内容填进 `EMAILENGINE_PREPARED_TOKEN`。

然后正常启动：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

默认会启动：

- Next.js 应用：`3000`
- EmailEngine：`3001`
- SearXNG：`8888`
- PostgreSQL
- Redis
- Queue workers

### 4. 首次部署后检查

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f workers
```

访问：

- 主应用：`http://YOUR_SERVER_IP:3000`
- EmailEngine：`http://YOUR_SERVER_IP:3001`

### 7. 创建管理员账号

访问 [http://localhost:3000/register](http://localhost:3000/register) 注册第一个账号，自动成为超级管理员。

## 后台配置

访问 `/admin` 进入管理后台：

- **系统配置** `(/admin/configs)`：AI 模型、EmailEngine、搜索引擎地址、调研 Prompt、评分 Prompt、邮件生成 Prompt、评分权重
- **网站检测器** `(/admin/detector)`：域名黑名单、TLD 黑名单、评分权重、Playwright 开关
- **挖掘评测** `(/admin/discovery-evals)`：Golden Set 人工标注 A/B 评测、真实搜索源 metadata 抽样、真实搜索 Top 结果 A/B 判定
- **定时任务** `(/admin/tasks)`：队列、自动跟进扫描和消息追踪任务状态

用户侧还需要先到 `设置 -> 邮箱账号` 连接自己的邮箱，活动发送、回复读取和消息追踪都依赖这里的账号。

## 客户挖掘流程

```text
行业 / 关键词 / ICP 画像输入
    ↓
Query Expander 生成多意图查询
    ↓
SearXNG 搜索编排与去重
    ↓
记录 sourceProvider / queryIntent / sourceQualityScore / searchSources
    ↓
URL 黑名单过滤（域名 + TLD 后缀）
    ↓
Cheerio 批量抓取页面（Playwright 可选兜底）
    ↓
官网识别与 5 维度信号提取
    ↓
规则过滤 + AI 分类 + 历史反馈
    ↓
候选池审核或自动入库
    ↓
入库并保留搜索评分、来源质量和 ICP 上下文
```

## ICP 精准挖掘流程

```text
自然语言定义 ICP 画像
  -> AI 解析为可复用规则
  -> 创建 Discovery Job
  -> BullMQ Worker 异步执行搜索编排 / 抓取 / 规则过滤 / AI 分类
  -> 进入候选池（lead_discovery_candidates）
  -> 接受 / 拒绝 / 拉黑 / 入库
  -> 反馈沉淀到 blocklist 与 feedback history
```

- ICP 画像支持：
  - `mustHave / mustNotHave`
  - `positiveKeywords / negativeKeywords`
  - `productCategories`
  - `salesModel`
  - 系统默认评分权重
  - `promptTemplate`
- Discovery Job 执行中会记录：
  - 搜索进度
  - 抓取进度
  - 候选数
  - 接受 / 拒绝 / 入库统计
- 候选不会直接进入 prospects，只有显式 `save_to_prospect` 或达到自动入库阈值才会落主表
- 自动入库后会把 `sourceProvider / queryIntent / sourceQualityScore / searchSources / discoveryDecision` 写入 prospect metadata，后续 AI 调研和评分会继续使用这些上下文

## 挖掘评测与 A/B 验证

后台路径：`/admin/discovery-evals`

- **Golden Set 人工标注 A/B 评测**：读取 `data/eval/icp-golden-set.example.json`，比较 A/B 规则与人工标签的匹配情况
- **真实搜索源 Metadata 抽样**：直接请求 SearXNG，检查真实结果是否产出来源、意图、质量分和命中查询数
- **真实搜索 Top 结果规则 A/B 判定**：对同一批真实搜索结果分别套用 A/B 规则，观察判定差异
- **查询扩展与 Intent 编排**：展示系统根据 ICP 生成的查询词、意图和优先级

命令行验证：

```bash
npm run eval:icp-ab
npm run eval:discovery-search
```

说明：Golden Set 才能计算准确率 / 召回率；真实搜索抽样没有人工标签，只能用于检查搜索源和规则差异。

## 调研与发信规则

- 客户列表同时显示两套分数：
  - `搜索评分`：判断官网候选是否值得入库
  - `调研评分`：判断客户是否值得优先联系
- 客户列表筛选规则：
  - 主状态只保留 `新线索 / 已联系 / 已回复 / 已转化`
  - 调研状态独立筛选 `待调研 / 调研中 / 已完成 / 调研失败`
  - `待调研` 包含没有调研记录和 `pending` 两种情况
- 调研完成后会生成：
  - 公司画像
  - 五维评分
  - A/B/C/D 等级
  - 推荐动作
- 调研评分会参考：
  - ICP 画像
  - 搜索评分
  - 搜索来源质量
  - 真实官网内容
  - 规则命中和拒绝信号
- 邮件发送规则：
  - 模板不再单独配置发件邮箱
  - 活动发送统一使用当前登录账号注册邮箱对应的已连接邮箱账号
  - 活动启动后会把实际发件邮箱固化到活动上，后续跟进保持一致
- 邮件生成 Prompt：
  - 冷启动首封开发信
  - 冷启动未回复自动跟进
  - 已回复客户推进
  - 三类 Prompt 都在后台系统配置中维护，运行时缺失会报错，不再静默走代码兜底
- 消息追踪规则：
  - 只在客户直接回复邮件时触发
  - 支持邮件、飞书、企业微信三种通知方式
  - 通知内容包含联系人、公司、活动、回复主题、回复时间、回复摘要
- AI 交互规则：
  - 模板 AI 生成走流式输出
  - 客户调研显示阶段式进度
  - 活动启动显示批量邮件生成进度
  - 单封失败邮件重新同步支持局部流式进度

## 项目结构

```bash
├── app/
│   ├── (dashboard)/          # 工作台页面
│   │   ├── prospects/        # 客户管理 + 挖掘 + 调研
│   │   │   ├── icp-profiles/ # ICP 画像配置
│   │   │   └── discovery-jobs/ # 精准挖掘任务与候选审核
│   │   ├── campaigns/        # 营销活动
│   │   ├── templates/        # 邮件模板
│   │   └── settings/         # 用户设置与消息追踪
│   ├── admin/                # 管理后台
│   │   ├── configs/          # 系统配置
│   │   └── detector/         # 网站检测器配置
│   └── api/v1/               # REST API
├── components/
│   ├── landing/              # Landing 页面展示组件
│   ├── prospects/            # 客户与挖掘相关组件
│   ├── campaigns/            # 活动与跟进组件
│   └── templates/            # 模板编辑组件
├── lib/
│   ├── detector/             # 官网识别引擎（过滤 / 抓取 / 评分 / 提取）
│   ├── discovery/            # ICP 精准发现流水线（搜索编排 / 规则 / AI / 评分 / pipeline / eval）
│   ├── integrations/         # 外部服务（SearXNG / EmailEngine / Hunter / Snov）
│   ├── services/             # 业务逻辑层
│   ├── db/                   # 数据库 Schema + 连接 + migration
│   └── utils/                # 工具函数
└── scripts/                  # 种子数据脚本
```
