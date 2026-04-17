"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TenantUsageRow {
  tenantId: string;
  tenantName: string | null;
  tenantPlan: string | null;
  resource: string;
  total: number;
}

interface UsageOverTime {
  date: string;
  resource: string;
  total: number;
}

interface UsageData {
  tenantUsage: TenantUsageRow[];
  usageOverTime: UsageOverTime[];
  days: number;
}

const resourceLabels: Record<string, string> = {
  prospect: "客户挖掘",
  email: "邮件发送",
  campaign: "活动创建",
  research: "客户背调",
};

export default function AdminUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/usage?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  // Group by tenant
  const tenantMap = new Map<string, { name: string; plan: string; resources: Map<string, number> }>();
  if (data) {
    for (const row of data.tenantUsage) {
      if (!tenantMap.has(row.tenantId)) {
        tenantMap.set(row.tenantId, {
          name: row.tenantName || "Unknown",
          plan: row.tenantPlan || "free",
          resources: new Map(),
        });
      }
      tenantMap.get(row.tenantId)!.resources.set(row.resource, Number(row.total));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">使用量监控</h1>
          <p className="text-muted-foreground">监控各租户的资源使用情况</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {["prospect", "email", "campaign"].map((resource) => {
              const total = (data?.tenantUsage || [])
                .filter((r) => r.resource === resource)
                .reduce((sum, r) => sum + Number(r.total), 0);
              return (
                <Card key={resource}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {resourceLabels[resource] || resource}（近 {days} 天）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{total.toLocaleString()}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Per-tenant table */}
          {tenantMap.size === 0 ? (
            <Card>
              <CardContent>
                <p className="text-center py-12 text-muted-foreground">
                  近 {days} 天暂无使用量数据
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>按租户统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>租户</TableHead>
                        <TableHead>套餐</TableHead>
                        <TableHead>客户挖掘</TableHead>
                        <TableHead>邮件发送</TableHead>
                        <TableHead>活动创建</TableHead>
                        <TableHead>客户背调</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(tenantMap.entries()).map(([id, tenant]) => (
                        <TableRow key={id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>
                            <Badge variant={tenant.plan === "pro" ? "secondary" : "outline"}>
                              {tenant.plan}
                            </Badge>
                          </TableCell>
                          <TableCell>{tenant.resources.get("prospect") || 0}</TableCell>
                          <TableCell>{tenant.resources.get("email") || 0}</TableCell>
                          <TableCell>{tenant.resources.get("campaign") || 0}</TableCell>
                          <TableCell>{tenant.resources.get("research") || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage over time */}
          {data?.usageOverTime && data.usageOverTime.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>每日使用趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>数量</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.usageOverTime.slice(-20).map((row, i) => (
                        <TableRow key={`${row.date}-${row.resource}-${i}`}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{resourceLabels[row.resource] || row.resource}</TableCell>
                          <TableCell>{Number(row.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
