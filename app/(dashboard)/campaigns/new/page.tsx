import { CampaignForm } from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">新建活动</h1>
        <p className="text-muted-foreground">
          创建邮件营销活动
        </p>
      </div>
      <CampaignForm />
    </div>
  );
}
