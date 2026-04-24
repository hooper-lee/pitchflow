"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IcpProfileForm } from "@/components/discovery/icp-profile-form";
import type { UpsertIcpProfileInput } from "@/lib/utils/validators";

interface IcpProfile {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  targetCustomerText: string | null;
  mustHave: string[];
  mustNotHave: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  productCategories: string[];
  salesModel: string | null;
  scoreWeights: {
    detectorScore?: number;
    ruleScore?: number;
    aiScore?: number;
    feedbackScore?: number;
  } | null;
  minScoreToSave: number;
  minScoreToReview: number;
  promptTemplate: string | null;
  isDefault: boolean;
}

function toFormValue(profile: IcpProfile | null) {
  if (!profile) return undefined;
  return {
    name: profile.name,
    description: profile.description || undefined,
    industry: profile.industry || undefined,
    targetCustomerText: profile.targetCustomerText || undefined,
    mustHave: profile.mustHave,
    mustNotHave: profile.mustNotHave,
    positiveKeywords: profile.positiveKeywords,
    negativeKeywords: profile.negativeKeywords,
    productCategories: profile.productCategories,
    salesModel: profile.salesModel || undefined,
    scoreWeights: {
      detectorScore: profile.scoreWeights?.detectorScore ?? 20,
      ruleScore: profile.scoreWeights?.ruleScore ?? 25,
      aiScore: profile.scoreWeights?.aiScore ?? 40,
      feedbackScore: profile.scoreWeights?.feedbackScore ?? 15,
    },
    minScoreToSave: profile.minScoreToSave,
    minScoreToReview: profile.minScoreToReview,
    promptTemplate: profile.promptTemplate || undefined,
    isDefault: profile.isDefault,
  };
}

export default function IcpProfilesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<IcpProfile[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IcpProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProfiles() {
    const response = await fetch("/api/v1/icp-profiles");
    const payload = await response.json();
    setProfiles(payload.data || []);
  }

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function submitProfile(formValue: UpsertIcpProfileInput) {
    setSubmitting(true);
    try {
      const url = editing ? `/api/v1/icp-profiles/${editing.id}` : "/api/v1/icp-profiles";
      const method = editing ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValue),
      });

      if (!response.ok) {
        throw new Error("保存 ICP 画像失败");
      }

      await loadProfiles();
      setOpen(false);
      setEditing(null);
      toast({ title: "保存成功" });
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function removeProfile(id: string) {
    const response = await fetch(`/api/v1/icp-profiles/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast({ title: "删除失败", variant: "destructive" });
      return;
    }
    await loadProfiles();
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-start gap-3">
          <Link href="/prospects">
            <Button variant="outline" size="icon" aria-label="返回客户管理">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">ICP 画像</h1>
            <p className="page-subtitle">
              用自然语言描述目标客户，AI 解析后生成可复用的挖掘规则
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          新建画像
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((profile) => (
          <Card key={profile.id} className="rounded-[24px] border-slate-200/80">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                    <Target className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{profile.industry || "未设置行业"}</p>
                  </div>
                </div>
                {profile.isDefault && <Badge>默认</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {profile.description || profile.targetCustomerText || "未填写描述"}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.positiveKeywords.slice(0, 4).map((keyword) => (
                  <Badge key={keyword} variant="outline">{keyword}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">自动入库</div>
                  <div className="mt-1 font-medium">{profile.minScoreToSave}</div>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">人工审核</div>
                  <div className="mt-1 font-medium">{profile.minScoreToReview}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(profile);
                    setOpen(true);
                  }}
                >
                  编辑
                </Button>
                <Button variant="outline" onClick={() => void removeProfile(profile.id)}>
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200/80 px-6 py-5">
            <DialogTitle>{editing ? "编辑 ICP 画像" : "新建 ICP 画像"}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <IcpProfileForm
              initialValue={toFormValue(editing)}
              submitting={submitting}
              onCancel={() => {
                setOpen(false);
                setEditing(null);
              }}
              onSubmit={(value) => void submitProfile(value)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
