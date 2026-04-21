import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mailAccounts } from "@/lib/db/schema";
import {
  deleteEmailEngineAccount,
  getEmailEngineAccount,
  reconnectEmailEngineAccount,
  registerEmailEngineAccount,
} from "@/lib/integrations/emailengine";
import type { CreateMailAccountInput } from "@/lib/utils/validators";

export async function listMailAccounts(tenantId: string, userId: string) {
  return db
    .select()
    .from(mailAccounts)
    .where(and(eq(mailAccounts.tenantId, tenantId), eq(mailAccounts.userId, userId)))
    .orderBy(desc(mailAccounts.isDefault), desc(mailAccounts.createdAt));
}

export async function createMailAccount(
  tenantId: string,
  userId: string,
  userEmail: string,
  input: CreateMailAccountInput
) {
  const accountKey = randomUUID();
  const shouldSetDefault = input.isDefault ?? input.email === userEmail;

  await registerEmailEngineAccount({
    account: accountKey,
    name: input.name,
    email: input.email,
    imap: {
      host: input.imap.host,
      port: input.imap.port,
      secure: input.imap.secure,
      auth: {
        user: input.imap.username,
        pass: input.imap.password,
      },
    },
    smtp: {
      host: input.smtp.host,
      port: input.smtp.port,
      secure: input.smtp.secure,
      auth: {
        user: input.smtp.username,
        pass: input.smtp.password,
      },
    },
  });

  if (shouldSetDefault) {
    await clearDefaultMailAccounts(tenantId, userId);
  }

  const remoteAccount = await getEmailEngineAccount(accountKey);
  const [mailAccount] = await db
    .insert(mailAccounts)
    .values({
      tenantId,
      userId,
      accountKey,
      email: input.email,
      name: input.name,
      authType: "imap_smtp",
      state: normalizeAccountState(remoteAccount?.state),
      isDefault: shouldSetDefault,
      lastError: remoteAccount?.lastError || null,
      syncTime: parseSyncTime(remoteAccount?.syncTime),
    })
    .returning();

  return mailAccount;
}

export async function syncMailAccount(tenantId: string, userId: string, id: string) {
  const mailAccount = await getMailAccount(tenantId, userId, id);
  if (!mailAccount) return null;

  const remoteAccount = await getEmailEngineAccount(mailAccount.accountKey);
  const [updated] = await db
    .update(mailAccounts)
    .set({
      state: normalizeAccountState(remoteAccount?.state),
      lastError: remoteAccount?.lastError || null,
      syncTime: parseSyncTime(remoteAccount?.syncTime),
      updatedAt: new Date(),
    })
    .where(eq(mailAccounts.id, id))
    .returning();

  return updated;
}

export async function reconnectMailAccount(tenantId: string, userId: string, id: string) {
  const mailAccount = await getMailAccount(tenantId, userId, id);
  if (!mailAccount) return null;

  await reconnectEmailEngineAccount(mailAccount.accountKey);

  const [updated] = await db
    .update(mailAccounts)
    .set({
      state: "connecting",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(mailAccounts.id, id))
    .returning();

  return updated;
}

export async function setDefaultMailAccount(tenantId: string, userId: string, id: string) {
  const mailAccount = await getMailAccount(tenantId, userId, id);
  if (!mailAccount) return null;

  await clearDefaultMailAccounts(tenantId, userId);

  const [updated] = await db
    .update(mailAccounts)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(mailAccounts.id, id))
    .returning();

  return updated;
}

export async function deleteMailAccount(tenantId: string, userId: string, id: string) {
  const mailAccount = await getMailAccount(tenantId, userId, id);
  if (!mailAccount) return false;

  await deleteEmailEngineAccount(mailAccount.accountKey);
  await db.delete(mailAccounts).where(eq(mailAccounts.id, id));
  return true;
}

export async function getMailAccountByEmail(tenantId: string, email: string) {
  const [mailAccount] = await db
    .select()
    .from(mailAccounts)
    .where(and(eq(mailAccounts.tenantId, tenantId), eq(mailAccounts.email, email)))
    .limit(1);

  return mailAccount || null;
}

export async function getUserMailAccountByRegisteredEmail(
  tenantId: string,
  userId: string,
  userEmail: string
) {
  const [mailAccount] = await db
    .select()
    .from(mailAccounts)
    .where(
      and(
        eq(mailAccounts.tenantId, tenantId),
        eq(mailAccounts.userId, userId),
        eq(mailAccounts.email, userEmail)
      )
    )
    .orderBy(desc(mailAccounts.isDefault), desc(mailAccounts.createdAt))
    .limit(1);

  return mailAccount || null;
}

export async function getMailAccountById(id: string) {
  const [mailAccount] = await db
    .select()
    .from(mailAccounts)
    .where(eq(mailAccounts.id, id))
    .limit(1);

  return mailAccount || null;
}

export async function getDefaultTenantMailAccount(tenantId: string) {
  const [mailAccount] = await db
    .select()
    .from(mailAccounts)
    .where(eq(mailAccounts.tenantId, tenantId))
    .orderBy(desc(mailAccounts.isDefault), desc(mailAccounts.createdAt))
    .limit(1);

  return mailAccount || null;
}

function normalizeAccountState(state?: string | null) {
  const allowedStates = new Set(mailAccounts.state.enumValues);
  if (state && allowedStates.has(state as (typeof mailAccounts.state.enumValues)[number])) {
    return state as (typeof mailAccounts.state.enumValues)[number];
  }
  return "connected";
}

function parseSyncTime(syncTime?: number) {
  if (!syncTime) return null;
  return new Date(syncTime);
}

async function getMailAccount(tenantId: string, userId: string, id: string) {
  const [mailAccount] = await db
    .select()
    .from(mailAccounts)
    .where(
      and(
        eq(mailAccounts.id, id),
        eq(mailAccounts.tenantId, tenantId),
        eq(mailAccounts.userId, userId)
      )
    )
    .limit(1);

  return mailAccount || null;
}

async function clearDefaultMailAccounts(tenantId: string, userId: string) {
  await db
    .update(mailAccounts)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(eq(mailAccounts.tenantId, tenantId), eq(mailAccounts.userId, userId)));
}
