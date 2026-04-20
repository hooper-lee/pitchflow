# PitchFlow

AI 驱动的 B2B 外贸智能获客平台。通过搜索引擎自动发现潜在客户官网，智能提取联系方式，一键生成个性化开发信。

## 核心功能

- **智能客户挖掘** — 基于行业/关键词/国家，自动搜索并识别企业官网，提取邮箱、电话、公司名
- **官网识别引擎** — Cheerio 页面抓取 + 5 维度 100 分制评分（域名质量、内容信号、负面过滤、导航结构、联系方式）
- **多源邮箱发现** — 官网直接提取 → Hunter.io / Snov.io 补充 → 邮箱模式推断（三级降级）
- **AI 背景调研** — 自动搜集公司新闻、行业信息，AI 生成客户画像
- **AI 邮件生成** — 基于客户画像和邮件模板，AI 自动生成个性化开发信
- **批量邮件发送** — 通过 Resend 批量发送，支持模板变量替换
- **营销活动管理** — 创建活动、选择客户、批量发送、跟踪回复

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
| AI | OpenAI 兼容接口（DeepSeek / Claude / 自定义） |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入数据库和认证配置：

```
DATABASE_URL=postgresql://user:pass@localhost:5432/pitchflow
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

### 3. 启动搜索引擎（SearXNG）

```bash
docker run -d --name searxng -p 8888:8080 \
  -v $(pwd)/searxng/settings.yml:/etc/searxng/settings.yml \
  searxng/searxng
```

验证：`curl http://localhost:8888/search?q=test&format=json`

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

访问 http://localhost:3000

### 7. 创建管理员账号

访问 http://localhost:3000/register 注册第一个账号，自动成为超级管理员。

## 后台配置

访问 `/admin` 进入管理后台：

- **系统配置** (`/admin/configs`) — AI 模型、邮箱服务、Hunter/Snov、搜索引擎地址
- **网站检测器** (`/admin/detector`) — 域名黑名单、TLD 黑名单、评分权重、Playwright 开关

## 客户挖掘流程

```
关键词搜索 → SearXNG（多页聚合）
    ↓
URL 黑名单过滤（70+ 域名 + 16 个 TLD 后缀）
    ↓
Cheerio 批量抓取页面（Playwright 可选兜底）
    ↓
5 维度信号提取 + 100 分制评分
    ↓
按评分排序，筛选 ≥ 25 分的官网
    ↓
提取联系方式（邮箱/电话/公司名）
    ↓
三级降级：直接提取 → Hunter/Snov → 邮箱模式推断
    ↓
入库，按用户选择数量展示
```

## 项目结构

```
├── app/
│   ├── (dashboard)/          # 工作台页面
│   │   ├── prospects/        # 客户管理 + 挖掘
│   │   ├── campaigns/        # 营销活动
│   │   └── templates/        # 邮件模板
│   ├── admin/                # 管理后台
│   │   ├── configs/          # 系统配置
│   │   └── detector/         # 网站检测器配置
│   └── api/v1/               # REST API
├── lib/
│   ├── detector/             # 官网识别引擎（过滤/抓取/评分/提取）
│   ├── integrations/         # 外部服务（SearXNG/Hunter/Snov）
│   ├── services/             # 业务逻辑层
│   ├── db/                   # 数据库 Schema + 连接
│   └── utils/                # 工具函数
├── components/               # UI 组件
└── scripts/                  # 种子数据脚本
```
