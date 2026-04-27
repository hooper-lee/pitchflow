"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Search,
  Brain,
  Mail,
  Send,
  RefreshCw,
  Bot,
  ArrowRight,
  Check,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "精准客户挖掘",
    desc: "用行业、关键词或 ICP 画像发起异步挖掘，自动扩展搜索意图、过滤重复网站并沉淀搜索评分。",
  },
  {
    icon: Brain,
    title: "AI 调研评分",
    desc: "结合官网内容、ICP 画像和搜索来源质量，提取公司类型、规模、主要产品和目标市场。",
  },
  {
    icon: Mail,
    title: "个性化开发信",
    desc: "冷启动首封、未回复跟进和已回复推进使用独立 Prompt，在后台统一配置和优化。",
  },
  {
    icon: Send,
    title: "活动批量发送",
    desc: "按搜索评分和调研评分筛选客户进入活动，使用当前账号注册邮箱对应的已连接邮箱发送。",
  },
  {
    icon: RefreshCw,
    title: "自动跟进节奏",
    desc: "围绕首封邮件自动安排 3 / 7 / 14 天跟进，客户回复后停止后续自动触达。",
  },
  {
    icon: Bot,
    title: "云端数字员工",
    desc: "用自然语言完成配置体检、产品资料整理、ICP 创建、客户挖掘和活动状态查询。",
  },
];

const plans = [
  {
    name: "Free",
    price: "免费",
    features: ["50 个客户/月", "100 封邮件/月", "1 个活动", "3 个模板", "1 名成员", "Agent 基础对话", "配置体检"],
  },
  {
    name: "Pro",
    price: "¥299/月",
    popular: true,
    features: ["2,000 个客户/月", "10,000 封邮件/月", "20 个活动", "无限模板", "5 名成员", "Agent 工作流", "ICP 与挖掘任务", "邮件草稿", "飞书+企微通知", "API 访问"],
  },
  {
    name: "Enterprise",
    price: "定制",
    features: ["无限客户", "无限邮件", "无限活动", "无限模板", "无限成员", "专属 Agent Credits", "MCP Gateway", "自定义 Toolkit", "全渠道协作", "审计导出", "专属支持"],
  },
];

function DemoCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card p-6 rounded-lg border">
      <div className="mb-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DiscoveryDemo() {
  return (
    <DemoCard
      title="精准挖掘结果演示"
      description="展示 ICP 查询意图、官网候选、搜索评分和来源质量，帮助判断哪些网站值得进入客户池。"
    >
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-4 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground">
          ICP：北美 RTA 家具 DTC 品牌 · Intent：product / brand / official_site
        </div>
        <div className="space-y-3">
          {[
            ["Burrow", "burrow.com", "搜索评分 92 · 来源质量 95"],
            ["Floyd Home", "floydhome.com", "搜索评分 86 · 来源质量 91"],
            ["Walker Edison", "walkeredison.com", "搜索评分 78 · 来源质量 88"],
          ].map(([name, domain, score]) => (
            <div key={domain} className="rounded-md bg-background p-4 border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">{domain}</p>
                </div>
                <span className="text-xs rounded-full bg-primary/10 text-primary px-3 py-1">
                  {score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoCard>
  );
}

function ResearchDemo() {
  return (
    <DemoCard
      title="AI 调研结果演示"
      description="展示结构化公司画像、五维评分、综合评分和推荐动作，方便快速决定优先联系谁。"
    >
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-4 rounded-md bg-background p-4 border">
          <div>
            <p className="font-medium">Burrow</p>
            <p className="text-sm text-muted-foreground">Modular Furniture · USA</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["员工规模 50-200", "公司类型 DTC 品牌", "主要产品 模块化家具", "目标市场 北美"].map((tag) => (
                <span key={tag} className="text-xs rounded-full border px-3 py-1 bg-background">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">综合评分</p>
            <p className="text-3xl font-bold">82</p>
            <p className="text-xs text-muted-foreground mt-1">推荐动作：优先联系</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          {[
            ["ICP 匹配", "88"],
            ["采购意向", "74"],
            ["可触达性", "79"],
            ["成交潜力", "86"],
          ].map(([label, score]) => (
            <div key={label} className="rounded-md bg-background p-4 border">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{label}</span>
                <span className="font-medium">{score}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DemoCard>
  );
}

export function MarketingHome() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">PF</span>
            </div>
            <span className="font-semibold text-lg">PitchFlow</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              功能
            </Link>
            <Link href="#demo" className="text-sm text-muted-foreground hover:text-foreground">
              演示
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              套餐
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">用户登录</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">免费开始</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-6">
            Don’t Just Find Prospects.
            <br />
            <span className="text-primary">Find the Ones Who Reply.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            PitchFlow 帮外贸团队自动挖掘潜在客户、提取联系方式、生成个性化开发信，并把每一次触达做得更有转化。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                免费开始
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" size="lg" className="text-lg px-8">
                查看演示
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">六大核心能力</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              从 ICP 精准挖掘、AI 调研、邮件生成到云端数字员工，把外贸开发流程收敛到一套系统里。
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="bg-card p-6 rounded-lg border">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">精准挖掘与调研结果演示</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              不只说“能挖客户、能做调研”，而是直接展示系统产出的查询意图、搜索评分、调研评分和推荐动作。
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <DiscoveryDemo />
            <ResearchDemo />
          </div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl rounded-lg border bg-card p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <div className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-sm text-muted-foreground">
                  Hemera Agent Platform
                </div>
                <h2 className="text-3xl font-bold tracking-tight">
                  让 PitchFlow 成为数字员工的外贸获客工具包
                </h2>
                <p className="mt-4 text-muted-foreground">
                  用户不需要记住每个页面在哪里。Agent 会理解目标、追问缺失信息，并在权限范围内调用 PitchFlow 完成配置、挖掘、总结和草稿创建。
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="space-y-3 text-sm">
                  <div className="w-fit rounded-lg bg-background px-4 py-3 shadow-sm">
                    帮我找 50 个美国宠物用品 DTC 品牌
                  </div>
                  <div className="ml-auto w-fit max-w-[90%] rounded-lg bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                    我会创建精准挖掘任务，并使用 ICP / 搜索意图 / 官网评分筛选候选客户。
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="font-medium">任务已创建：美国宠物用品 DTC 品牌</p>
                    <p className="mt-1 text-muted-foreground">状态：搜索中 · 目标数量：50 · 后续可继续让我总结候选池</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">选择适合你的套餐</h2>
            <p className="text-muted-foreground">从免费开始，随时升级</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-6 rounded-lg border ${
                  plan.popular ? "border-primary shadow-lg" : ""
                }`}
              >
                {plan.popular && (
                  <span className="inline-block bg-primary text-primary-foreground text-xs px-2 py-1 rounded mb-4">
                    推荐
                  </span>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-3xl font-bold mt-2 mb-6">{plan.price}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    开始使用
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">准备好让客户开发流程更清晰了吗？</h2>
          <p className="text-lg opacity-80 mb-8 max-w-2xl mx-auto">
            用一套系统统一客户筛选、AI 开发信、跟进节奏和数字员工协作，而不是继续靠零散工具拼流程。
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              立即免费注册
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>PitchFlow — Hemera 数字员工的外贸智能获客 Toolkit</p>
        </div>
      </footer>
    </div>
  );
}
