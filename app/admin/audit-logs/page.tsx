import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDetailSummary(detail: Record<string, unknown> | null) {
  if (!detail) return "—";

  if (typeof detail.companyName === "string") {
    return `公司：${detail.companyName}`;
  }

  if (typeof detail.name === "string") {
    return `名称：${detail.name}`;
  }

  if (typeof detail.count === "number") {
    return `数量：${detail.count}`;
  }

  if (Array.isArray(detail.steps)) {
    return `跟进步骤：${detail.steps.length} 条`;
  }

  const entries = Object.entries(detail)
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return entries.length > 0 ? entries.join(" · ") : "—";
}

export default async function AdminAuditLogsPage() {
  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">审计日志</h1>
        <p className="text-muted-foreground">平台操作审计记录</p>
      </div>

      {logs.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">
          暂无审计日志
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>操作</TableHead>
                <TableHead>资源</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>用户 ID</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.resource}</TableCell>
                  <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                    <div className="truncate">
                      {formatDetailSummary(log.detail as Record<string, unknown> | null)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.userId?.slice(0, 8) || "—"}
                  </TableCell>
                  <TableCell>{log.ip || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
