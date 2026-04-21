import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

export async function listTemplates(tenantId: string, page = 1, limit = 12) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId));

  const items = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId))
    .orderBy(desc(emailTemplates.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    items,
    total: Number(total),
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
  };
}

export async function getTemplate(id: string, tenantId: string) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId))
    )
    .limit(1);

  return template || null;
}

export async function createTemplate(
  tenantId: string,
  data: {
    name: string;
    subject: string;
    body: string;
    angle?: string;
    productName?: string;
    senderName?: string;
    attachments?: { filename: string; url: string; size?: number }[];
    isDefault?: boolean;
  }
) {
  const [template] = await db
    .insert(emailTemplates)
    .values({ ...data, tenantId })
    .returning();

  return template;
}

export async function updateTemplate(
  id: string,
  tenantId: string,
  data: Partial<typeof emailTemplates.$inferInsert>
) {
  const [template] = await db
    .update(emailTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId))
    )
    .returning();

  return template || null;
}

export async function deleteTemplate(id: string, tenantId: string) {
  await db
    .delete(emailTemplates)
    .where(
      and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId))
    );
}
