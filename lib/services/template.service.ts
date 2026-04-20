import { db } from "@/lib/db";
import { emailTemplates } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function listTemplates(tenantId: string) {
  return db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId))
    .orderBy(desc(emailTemplates.createdAt));
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
    senderEmail?: string;
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
