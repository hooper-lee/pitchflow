import { db } from "@/lib/db";
import { tenants, users, usageRecords } from "@/lib/db/schema";
import { eq, and, gte, sql, count } from "drizzle-orm";
import { PLAN_LIMITS, type Plan } from "@/lib/constants/plans";

export async function getTenant(id: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return tenant || null;
}

export async function updateTenantSettings(
  id: string,
  settings: Record<string, unknown>
) {
  const [tenant] = await db
    .update(tenants)
    .set({ settings, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  return tenant;
}

export async function checkQuota(
  tenantId: string,
  resource: "prospect" | "email" | "campaign"
): Promise<boolean> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return false;

  const plan = (tenant.plan || "free") as Plan;
  const limits = PLAN_LIMITS[plan];

  // Get current month usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [usage] = await db
    .select({ total: sql<number>`COALESCE(SUM(${usageRecords.quantity}), 0)` })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.tenantId, tenantId),
        eq(usageRecords.resource, resource),
        gte(usageRecords.createdAt, startOfMonth)
      )
    );

  const currentUsage = Number(usage?.total || 0);

  switch (resource) {
    case "prospect":
      return currentUsage < limits.prospectsPerMonth;
    case "email":
      return currentUsage < limits.emailsPerMonth;
    case "campaign":
      return currentUsage < limits.campaigns;
    default:
      return true;
  }
}

export async function recordUsage(
  tenantId: string,
  resource: string,
  quantity = 1,
  metadata?: Record<string, unknown>
) {
  await db.insert(usageRecords).values({
    tenantId,
    resource,
    quantity,
    metadata: metadata || {},
  });
}

export async function getTeamMembers(tenantId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, tenantId));
}

export async function inviteTeamMember(
  tenantId: string,
  email: string,
  role: string = "member"
) {
  // Check if user exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Update their tenant
    await db
      .update(users)
      .set({ tenantId, role: role as any, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing;
  }

  // Create placeholder user (they'll need to register)
  const [user] = await db
    .insert(users)
    .values({
      email,
      role: role as any,
      tenantId,
    })
    .returning();

  return user;
}

export async function updateMemberRole(
  userId: string,
  tenantId: string,
  role: string
) {
  const [user] = await db
    .update(users)
    .set({ role: role as any, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
    .returning();

  return user;
}

export async function removeMember(userId: string, tenantId: string) {
  await db
    .update(users)
    .set({ tenantId: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
}
