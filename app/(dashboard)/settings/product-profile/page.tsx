"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ProductProfile {
  companyName: string;
  productName: string;
  productDescription: string;
  valueProposition: string;
  senderName: string;
  senderTitle: string;
}

const EMPTY_PROFILE: ProductProfile = {
  companyName: "",
  productName: "",
  productDescription: "",
  valueProposition: "",
  senderName: "",
  senderTitle: "",
};

export default function ProductProfilePage() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProductProfile>(EMPTY_PROFILE);

  useEffect(() => {
    fetch("/api/v1/settings/product-profile")
      .then((response) => response.json())
      .then((payload) => setProfile({ ...EMPTY_PROFILE, ...(payload.data || {}) }))
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/v1/settings/product-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      toast({
        title: response.ok ? "产品资料已保存" : "保存失败",
        variant: response.ok ? "default" : "destructive",
      });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ProductProfile, value: string) {
    setProfile((currentProfile) => ({ ...currentProfile, [field]: value }));
  }

  return (
    <div className="page-shell max-w-4xl">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="page-title">产品资料</h1>
            <p className="page-subtitle">
              当活动没有选择邮件素材模板时，AI 会用这里的资料生成邮件。
            </p>
          </div>
        </div>
      </div>

      <Card className="section-card">
        <CardHeader>
          <CardTitle>默认邮件生成素材</CardTitle>
          <CardDescription>这不是固定邮件正文，而是 AI 个性化生成时参考的产品和卖点。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="公司名称" value={profile.companyName} onChange={(value) => updateField("companyName", value)} />
            <TextField label="产品/服务名称" value={profile.productName} onChange={(value) => updateField("productName", value)} />
            <TextField label="发件人姓名" value={profile.senderName} onChange={(value) => updateField("senderName", value)} />
            <TextField label="发件人职位" value={profile.senderTitle} onChange={(value) => updateField("senderTitle", value)} />
          </div>
          <TextAreaField label="产品介绍" value={profile.productDescription} onChange={(value) => updateField("productDescription", value)} />
          <TextAreaField label="核心卖点/价值主张" value={profile.valueProposition} onChange={(value) => updateField("valueProposition", value)} />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存产品资料"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
