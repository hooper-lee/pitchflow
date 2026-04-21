"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Plan = "free" | "pro" | "enterprise";

interface Tenant {
  id: string;
  name: string;
  plan: Plan;
  apiQuota: number | null;
  stripeCustomerId: string | null;
  createdAt: string;
}

const PLAN_OPTIONS: Plan[] = ["free", "pro", "enterprise"];

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tenants?limit=100")
      .then((response) => response.json())
      .then((data) => setTenants(data.data?.tenants || []))
      .catch(() => setTenants([]));
  }, []);

  const updateTenantPlan = async (tenantId: string, plan: Plan) => {
    setSavingTenantId(tenantId);

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        return;
      }

      setTenants((currentTenants) =>
        currentTenants.map((tenant) =>
          tenant.id === tenantId ? { ...tenant, plan } : tenant
        )
      );
    } finally {
      setSavingTenantId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">租户管理</h1>
        <p className="text-muted-foreground">管理平台租户和套餐</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>当前套餐</TableHead>
              <TableHead>修改套餐</TableHead>
              <TableHead>API 配额</TableHead>
              <TableHead>Stripe ID</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell>
                  <Badge variant={getPlanBadgeVariant(tenant.plan)}>{tenant.plan}</Badge>
                </TableCell>
                <TableCell className="min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <Select
                      value={tenant.plan}
                      onValueChange={(value) =>
                        setTenants((currentTenants) =>
                          currentTenants.map((currentTenant) =>
                            currentTenant.id === tenant.id
                              ? { ...currentTenant, plan: value as Plan }
                              : currentTenant
                          )
                        )
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="选择套餐" />
                      </SelectTrigger>
                      <SelectContent>
                        {PLAN_OPTIONS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {plan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={savingTenantId === tenant.id}
                      onClick={() => updateTenantPlan(tenant.id, tenant.plan)}
                    >
                      {savingTenantId === tenant.id ? "保存中..." : "保存"}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{tenant.apiQuota || "—"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {tenant.stripeCustomerId?.slice(0, 8) || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(tenant.createdAt).toLocaleDateString("zh-CN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function getPlanBadgeVariant(plan: Plan) {
  if (plan === "enterprise") return "default";
  if (plan === "pro") return "secondary";
  return "outline";
}
