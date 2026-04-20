"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "免费",
    description: "适合个人体验",
    features: [
      "每月 50 个客户挖掘",
      "每月 100 封邮件",
      "1 个营销活动",
      "1 名团队成员",
      "基础 AI 背调",
      "邮件告警",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "¥299/月",
    description: "适合外贸团队",
    features: [
      "每月 2,000 个客户挖掘",
      "每月 10,000 封邮件",
      "20 个营销活动",
      "5 名团队成员",
      "深度 AI 背调",
      "邮件 + 飞书 + 企微告警",
      "API 访问",
    ],
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "定制",
    description: "适合大型团队",
    features: [
      "无限客户挖掘",
      "无限邮件发送",
      "无限营销活动",
      "无限团队成员",
      "深度 + 定制 AI 背调",
      "全渠道告警 + Webhook",
      "API 访问",
      "专属客服",
    ],
  },
];

export default function BillingPage() {
  useSession();

  useEffect(() => {
    fetch("/api/v1/alerts")
      .then((res) => res.json())
      .catch(() => {});
    // We'd need a tenant API endpoint for this
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">套餐与计费</h1>
          <p className="text-muted-foreground">选择适合你的套餐</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.key}
            className={plan.popular ? "border-primary" : ""}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.popular && <Badge>推荐</Badge>}
              </div>
              <CardDescription>{plan.description}</CardDescription>
              <div className="pt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                disabled={plan.key === "free"}
              >
                {plan.key === "free" ? "当前方案" : "升级"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
