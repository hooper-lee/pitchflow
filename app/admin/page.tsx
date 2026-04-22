import { db } from "@/lib/db";
import { users, tenants, emails, prospects } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Send, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [totalTenants] = await db.select({ count: count() }).from(tenants);
  const [totalEmails] = await db.select({ count: count() }).from(emails);
  const [totalProspects] = await db.select({ count: count() }).from(prospects);

  const stats = [
    {
      title: "总用户数",
      value: Number(totalUsers?.count || 0),
      icon: Users,
    },
    {
      title: "总租户数",
      value: Number(totalTenants?.count || 0),
      icon: Building2,
    },
    {
      title: "总邮件数",
      value: Number(totalEmails?.count || 0),
      icon: Send,
    },
    {
      title: "总线索数",
      value: Number(totalProspects?.count || 0),
      icon: Target,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">管理后台</h1>
        <p className="text-muted-foreground">平台概览数据</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
