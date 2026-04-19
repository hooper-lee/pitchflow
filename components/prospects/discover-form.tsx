"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function DiscoverForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"domain" | "industry">("domain");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [keywords, setKeywords] = useState("");
  const [limit, setLimit] = useState("10");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: Record<string, any> = {
        limit: parseInt(limit),
      };

      if (mode === "domain") {
        if (domain) body.domain = domain;
      } else {
        if (industry) body.industry = industry;
        if (keywords) body.keywords = keywords;
      }
      if (country) body.country = country;

      const res = await fetch("/api/v1/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "挖掘失败",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "挖掘成功",
        description: `已找到 ${data.data.length} 个潜在客户`,
      });

      router.push("/prospects");
      router.refresh();
    } catch {
      toast({
        title: "挖掘失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>智能客户挖掘</CardTitle>
        <CardDescription>
          通过域名、行业或关键词搜索潜在客户，AI 自动提取联系方式
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "domain" | "industry")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="domain">按域名挖掘</TabsTrigger>
              <TabsTrigger value="industry">按行业/关键词</TabsTrigger>
            </TabsList>

            <TabsContent value="domain" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="domain">公司域名</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="industry" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="industry">行业 / 产品</Label>
                <Input
                  id="industry"
                  placeholder="输入细分行业或产品，如: LED照明、太阳能板、汽车零部件"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[
                    "电子产品", "机械设备", "纺织服装", "化工原料",
                    "汽车配件", "家居家具", "食品饮料", "医疗器械",
                    "LED照明", "太阳能", "包装材料", "五金工具",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setIndustry(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        industry === tag
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/80 border-transparent"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keywords">关键词</Label>
                <Input
                  id="keywords"
                  placeholder="如: solar panel distributor"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">目标国家</Label>
              <Input
                id="country"
                placeholder="如: USA, Germany"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">挖掘数量</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 个</SelectItem>
                  <SelectItem value="10">10 个</SelectItem>
                  <SelectItem value="20">20 个</SelectItem>
                  <SelectItem value="50">50 个</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "挖掘中..." : "开始挖掘"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
