import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Search,
  Brain,
  Mail,
  Send,
  RefreshCw,
  Bell,
  ArrowRight,
  Check,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
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

      {/* Hero */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight mb-6">
            一个人顶一个
            <br />
            <span className="text-primary">外贸开发团队</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            AI 驱动的全自动客户开发平台。精准客户挖掘 → 深度背调 → 个性化开发信 → 自动跟进 → 高意向客户实时告警。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                免费开始
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="text-lg px-8">
                了解更多
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">六大核心能力</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              从客户挖掘到成交跟进，全链路 AI 自动化
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Search,
                title: "智能客户挖掘",
                desc: "根据行业和客户画像，自动从互联网批量挖掘决策人邮箱和联系方式",
              },
              {
                icon: Brain,
                title: "客户深度背调",
                desc: "自动抓取官网、新闻、社媒动态，AI 生成结构化客户画像",
              },
              {
                icon: Mail,
                title: "个性化开发信",
                desc: "千人千面的定制化开发信，AI 根据客户画像自动选择最优角度",
              },
              {
                icon: Send,
                title: "自动化邮件发送",
                desc: "批量发送开发信，控制发送节奏避免触发垃圾邮件过滤",
              },
              {
                icon: RefreshCw,
                title: "销冠记忆 & 跟进",
                desc: "自动换角度多轮跟进，拥有销售冠军的记忆和韧性",
              },
              {
                icon: Bell,
                title: "高意向客户告警",
                desc: "客户多次打开邮件、点击链接时，实时推送到飞书/企微/钉钉",
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-card p-6 rounded-lg border">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">选择适合你的套餐</h2>
            <p className="text-muted-foreground">从免费开始，随时升级</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                name: "Free",
                price: "免费",
                features: ["50 个客户/月", "100 封邮件/月", "1 个活动", "3 个模板", "1 名成员", "1 轮跟进", "邮件告警"],
              },
              {
                name: "Pro",
                price: "¥299/月",
                popular: true,
                features: ["2,000 个客户/月", "10,000 封邮件/月", "20 个活动", "无限模板", "5 名成员", "3 轮跟进", "邮件附件", "自定义 AI 模型", "飞书+企微告警", "API 访问"],
              },
              {
                name: "Enterprise",
                price: "定制",
                features: ["无限客户", "无限邮件", "无限活动", "无限模板", "无限成员", "无限轮跟进", "邮件附件", "自定义 AI 模型", "全渠道告警", "API 访问", "专属客服"],
              },
            ].map((plan) => (
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
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {f}
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

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">准备好用 AI 武装你的外贸团队了吗？</h2>
          <p className="text-lg opacity-80 mb-8 max-w-lg mx-auto">
            替代过去熬夜在 Google 翻页找客户的低效工作方式
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              立即免费注册
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>PitchFlow — AI 驱动的外贸智能获客平台</p>
        </div>
      </footer>
    </div>
  );
}
