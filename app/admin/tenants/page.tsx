import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AdminTenantsPage() {
  const allTenants = await db
    .select()
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(100);

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
              <TableHead>套餐</TableHead>
              <TableHead>API 配额</TableHead>
              <TableHead>Stripe ID</TableHead>
              <TableHead>创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      tenant.plan === "enterprise"
                        ? "default"
                        : tenant.plan === "pro"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {tenant.plan}
                  </Badge>
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
