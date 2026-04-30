import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAgentPlanPolicy } from "@/lib/agent/policies/plan-policy";
import { normalizeAgentPlan } from "@/lib/agent/permissions";
import { getMonthlyAgentCreditsByUser } from "@/lib/agent/usage-summary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tenantId: users.tenantId,
      tenantPlan: tenants.plan,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .orderBy(desc(users.createdAt))
    .limit(100);
  const userCredits = await getMonthlyAgentCreditsByUser(allUsers.map((user) => user.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
        <p className="text-muted-foreground">管理平台注册用户</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>邮箱</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>租户 ID</TableHead>
              <TableHead>本月 Agent Credits</TableHead>
              <TableHead>注册时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.name || "—"}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "super_admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {user.tenantId?.slice(0, 8) || "—"}...
                </TableCell>
                <TableCell>
                  {userCredits.get(user.id) || 0} /{" "}
                  {getAgentPlanPolicy(normalizeAgentPlan(user.tenantPlan || undefined)).monthlyCredits}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
