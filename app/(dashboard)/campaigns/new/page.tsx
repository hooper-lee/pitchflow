import { CampaignForm } from "@/components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="max-w-3xl page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">新建活动</h1>
          <p className="page-subtitle">
          创建邮件营销活动
          </p>
        </div>
      </div>
      <CampaignForm />
    </div>
  );
}
