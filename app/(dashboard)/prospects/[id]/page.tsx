"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Building2, Globe, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Prospect {
  id: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  linkedinUrl: string | null;
  whatsapp: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  researchSummary: string | null;
  status: string;
  source: string | null;
  createdAt: string;
}

export default function ProspectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/v1/prospects/${params.id}`)
      .then((res) => res.json())
      .then((data) => setProspect(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleResearch = async () => {
    setResearching(true);
    try {
      const res = await fetch("/api/v1/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: params.id }),
      });
      const data = await res.json();
      if (data.data?.summary) {
        setProspect((prev: Prospect | null) =>
          prev ? { ...prev, researchSummary: data.data.summary } : prev
        );
        toast({ title: "AI 背调完成" });
      }
    } catch {
      toast({ title: "背调失败", description: "请检查 API Key 配置", variant: "destructive" });
    } finally {
      setResearching(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!prospect) {
    return <div>客户未找到</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {prospect.companyName || prospect.contactName || "未知客户"}
          </h1>
          <p className="text-muted-foreground">客户详情</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">公司名称</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.companyName || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">联系人邮箱</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.email || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">网站</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.website || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">国家</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.country || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium">行业</p>
                <p className="text-sm text-muted-foreground">
                  {prospect.industry || "—"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">状态</p>
              <Badge>{prospect.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AI 背调报告</CardTitle>
          </CardHeader>
          <CardContent>
            {prospect.researchSummary ? (
              <p className="text-sm whitespace-pre-wrap">
                {prospect.researchSummary}
              </p>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">尚未进行 AI 背调</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={handleResearch} disabled={researching}>
                  {researching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {researching ? "背调中..." : "开始背调"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
