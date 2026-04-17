import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentCampaigns } from "@/components/dashboard/recent-campaigns";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground">
          你的外贸获客数据一览
        </p>
      </div>

      <StatsCards />

      <div className="grid gap-6 md:grid-cols-2">
        <RecentCampaigns />
        <ActivityFeed />
      </div>
    </div>
  );
}
