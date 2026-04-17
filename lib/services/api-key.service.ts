import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { generateApiKey, hashApiKey } from "@/lib/utils/crypto";

export async function createApiKey(
  tenantId: string,
  name: string,
  permissions: string[] = ["read"]
) {
  const key = generateApiKey();
  const keyHash = hashApiKey(key);

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      tenantId,
      name,
      keyHash,
      keyPrefix: key.slice(0, 12),
      permissions,
    })
    .returning();

  // Return the full key only on creation
  return { ...apiKey, key };
}

export async function listApiKeys(tenantId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      permissions: apiKeys.permissions,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, tenantId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: string, tenantId: string) {
  const [apiKey] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
    .returning();

  return apiKey;
}

export async function verifyApiKey(key: string) {
  const keyHash = hashApiKey(key);

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      )
    )
    .limit(1);

  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return null;
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return apiKey;
}
