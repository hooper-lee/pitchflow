"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

interface FollowUpStep {
  stepNumber: number;
  delayDays: number;
  angle: string;
  enabled: boolean;
}

interface FollowUpConfigProps {
  campaignId: string;
  initialSteps?: FollowUpStep[];
}

const DEFAULT_STEPS: FollowUpStep[] = [
  { stepNumber: 1, delayDays: 3, angle: "value_prop", enabled: true },
  { stepNumber: 2, delayDays: 7, angle: "social_proof", enabled: true },
  { stepNumber: 3, delayDays: 14, angle: "urgency", enabled: true },
];

const ANGLE_LABELS: Record<string, string> = {
  value_prop: "价值主张 — 重新强调产品优势",
  social_proof: "社会证明 — 引用成功案例",
  pain_point: "痛点切入 — 针对行业挑战",
  urgency: "紧迫感 — 限时优惠或截止日期",
};

export function FollowUpConfig({
  campaignId,
  initialSteps,
}: FollowUpConfigProps) {
  const { toast } = useToast();
  const [steps, setSteps] = useState<FollowUpStep[]>(
    initialSteps || DEFAULT_STEPS
  );
  const [saving, setSaving] = useState(false);

  const updateStep = (index: number, updates: Partial<FollowUpStep>) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps((prev) => [
      ...prev,
      {
        stepNumber: (lastStep?.stepNumber || 0) + 1,
        delayDays: (lastStep?.delayDays || 0) + 7,
        angle: "pain_point",
        enabled: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/followups`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      if (!res.ok) {
        toast({ title: "保存失败", variant: "destructive" });
        return;
      }

      toast({ title: "跟进序列已更新" });
    } catch {
      toast({ title: "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>跟进序列</CardTitle>
        <CardDescription>
          配置自动跟进延迟。系统每 15 分钟扫描一次；达到延迟时间且客户未回复时，会自动发送下一轮邮件。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex items-center gap-4 p-4 rounded-lg border"
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={step.enabled}
                onCheckedChange={(checked) =>
                  updateStep(index, { enabled: checked })
                }
              />
              <span className="text-sm font-medium">第 {step.stepNumber} 轮跟进</span>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">延迟</Label>
              <Input
                type="number"
                value={step.delayDays}
                onChange={(e) =>
                  updateStep(index, { delayDays: parseInt(e.target.value) || 0 })
                }
                className="w-16"
                min={1}
              />
              <span className="text-sm text-muted-foreground">天</span>
            </div>

            <div className="flex-1">
              <Select
                value={step.angle}
                onValueChange={(value) => updateStep(index, { angle: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANGLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeStep(index)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-2 h-4 w-4" />
            添加步骤
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
