import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { icpProfiles } from "@/lib/db/schema";
import type { UpsertIcpProfileInput } from "@/lib/utils/validators";

export async function listIcpProfiles(tenantId: string) {
  return db
    .select()
    .from(icpProfiles)
    .where(eq(icpProfiles.tenantId, tenantId))
    .orderBy(desc(icpProfiles.isDefault), desc(icpProfiles.updatedAt));
}

export async function getIcpProfile(id: string, tenantId: string) {
  const [profile] = await db
    .select()
    .from(icpProfiles)
    .where(and(eq(icpProfiles.id, id), eq(icpProfiles.tenantId, tenantId)))
    .limit(1);

  return profile || null;
}

async function clearDefaultProfile(tenantId: string) {
  await db
    .update(icpProfiles)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(icpProfiles.tenantId, tenantId));
}

export async function createIcpProfile(
  tenantId: string,
  userId: string,
  input: UpsertIcpProfileInput
) {
  if (input.isDefault) {
    await clearDefaultProfile(tenantId);
  }

  const [profile] = await db
    .insert(icpProfiles)
    .values({ ...input, tenantId, userId })
    .returning();

  return profile;
}

export async function updateIcpProfile(
  id: string,
  tenantId: string,
  input: UpsertIcpProfileInput
) {
  if (input.isDefault) {
    await clearDefaultProfile(tenantId);
  }

  const [profile] = await db
    .update(icpProfiles)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(icpProfiles.id, id), eq(icpProfiles.tenantId, tenantId)))
    .returning();

  return profile || null;
}

export async function deleteIcpProfile(id: string, tenantId: string) {
  const [profile] = await db
    .delete(icpProfiles)
    .where(and(eq(icpProfiles.id, id), eq(icpProfiles.tenantId, tenantId)))
    .returning({ id: icpProfiles.id });

  return Boolean(profile);
}

export async function countIcpProfiles(tenantId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(icpProfiles)
    .where(eq(icpProfiles.tenantId, tenantId));

  return Number(total);
}
