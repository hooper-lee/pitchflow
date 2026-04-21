import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentCampaigns } from "@/components/dashboard/recent-campaigns";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export default function DashboardPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">仪表盘</h1>
          <p className="page-subtitle">
          你的外贸获客数据一览
          </p>
        </div>
      </div>

      <StatsCards />

      <div className="grid gap-5 md:grid-cols-2">
        <RecentCampaigns />
        <ActivityFeed />
      </div>
    </div>
  );
}
