import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

interface AuditEventInput {
  userId?: string | null;
  tenantId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

export async function logAuditEvent(input: AuditEventInput) {
  await db.insert(auditLogs).values({
    userId: input.userId || null,
    tenantId: input.tenantId || null,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId || null,
    detail: input.detail || null,
    ip: input.ip || null,
  });
}
