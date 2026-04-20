# PitchFlow

PitchFlow 是一套面向外贸开发场景的 AI 客户开发系统，把「客户挖掘 -> AI 调研评分 -> 个性化发信 -> 自动跟进 -> 高意向告警」压到同一条工作流里。

## 当前产品能力

- **客户挖掘**：按行业 / 关键词 / 国家偏置搜索官网候选，过滤重复网站并记录搜索评分
- **官网识别引擎**：Cheerio 抓取 + 5 维度评分，筛出更像真实客户官网的站点
- **AI 调研评分**：抽取公司规模、类型、主要产品、目标市场、联系人，并生成五维评分、等级和推荐动作
- **客户分层管理**：同时保留搜索评分与调研评分，区分“值得入库”和“值得优先联系”
- **模板化邮件发送**：模板支持独立发件邮箱；未选模板时，活动默认使用当前账号邮箱
- **活动与自动跟进**：按评分筛选客户进入活动，后续跟进沿用同一活动发件邮箱
- **高意向告警**：打开、点击、回复可触发账号邮箱、飞书、企微告警

## 典型工作流

```text
行业 / 关键词搜索
  -> 官网识别与去重
  -> 客户入库
  -> AI 调研与五维评分
  -> 按 A/B/C/D 分层筛选
  -> 创建营销活动
  -> 按模板或账号邮箱发信
  -> 自动跟进与高意向告警
```

## Landing 页说明

当前官网首页重点新增了两块演示内容：

- **客户挖掘结果演示**：展示搜索结果如何带搜索评分进入列表，以及为什么某些官网更值得入库
- **AI 调研结果演示**：展示结构化画像、五维评分、综合评分和推荐动作，而不是一段难复用的摘要文本

这两块说明的目标是让首次访问者直接理解系统产出，不再只看到“能挖客户、能写邮件”这种抽象描述。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14 (App Router) + React + Tailwind CSS + shadcn/ui |
| 后端 | Next.js API Routes + Drizzle ORM |
| 数据库 | PostgreSQL |
| 认证 | NextAuth.js |
| 搜索引擎 | SearXNG（自部署，无配额限制） |
| 页面抓取 | Cheerio（Playwright 可选兜底） |
| 邮件发送 | Resend |
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
NEXTAUTH_SECRET=your-secret-here
```

如果要启用完整能力，还需要在后台配置：

- `CUSTOM_AI_BASE_URL`
- `CUSTOM_AI_API_KEY`
- `CUSTOM_AI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SEARXNG_BASE_URL`

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

### 7. 创建管理员账号

访问 [http://localhost:3000/register](http://localhost:3000/register) 注册第一个账号，自动成为超级管理员。

## 后台配置

访问 `/admin` 进入管理后台：

- **系统配置** `(/admin/configs)`：AI 模型、邮件服务、搜索引擎地址、Prompt、评分权重
- **网站检测器** `(/admin/detector)`：域名黑名单、TLD 黑名单、评分权重、Playwright 开关

## 客户挖掘流程

```text
关键词搜索 -> SearXNG（多页聚合）
    ↓
URL 黑名单过滤（域名 + TLD 后缀）
    ↓
Cheerio 批量抓取页面（Playwright 可选兜底）
    ↓
5 维度信号提取 + 100 分制评分
    ↓
按评分排序，筛选 >= 25 分的官网
    ↓
提取联系方式（邮箱 / 电话 / 公司名）
    ↓
三级降级：直接提取 -> Hunter/Snov -> 邮箱模式推断
    ↓
入库并保留搜索评分
```

## 调研与发信规则

- 客户列表同时显示两套分数：
  - `搜索评分`：判断官网候选是否值得入库
  - `调研评分`：判断客户是否值得优先联系
- 调研完成后会生成：
  - 公司画像
  - 五维评分
  - A/B/C/D 等级
  - 推荐动作
- 邮件发送规则：
  - 选择模板且模板配置了发件邮箱：优先使用模板发件邮箱
  - 未选择模板或模板未配置发件邮箱：使用当前账号邮箱
  - 活动启动后会把实际发件邮箱固化到活动上，后续跟进保持一致

## 项目结构

```bash
├── app/
│   ├── (dashboard)/          # 工作台页面
│   │   ├── prospects/        # 客户管理 + 挖掘 + 调研
│   │   ├── campaigns/        # 营销活动
│   │   ├── templates/        # 邮件模板
│   │   └── settings/         # 用户设置与告警
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
│   ├── integrations/         # 外部服务（SearXNG / Resend / Hunter / Snov）
│   ├── services/             # 业务逻辑层
│   ├── db/                   # 数据库 Schema + 连接 + migration
│   └── utils/                # 工具函数
└── scripts/                  # 种子数据脚本
```
