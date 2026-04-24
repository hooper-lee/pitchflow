import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leadBlocklist,
  leadDiscoveryCandidates,
  leadDiscoveryFeedback,
} from "@/lib/db/schema";

interface RecordFeedbackInput {
  tenantId: string;
  userId: string;
  candidateId: string;
  action: "accept" | "reject" | "blacklist" | "restore" | "save_to_prospect";
  reason?: string;
  reasonTags?: string[];
  metadata?: Record<string, unknown>;
}

export async function recordDiscoveryFeedback(input: RecordFeedbackInput) {
  const [candidate] = await db
    .select({
      jobId: leadDiscoveryCandidates.jobId,
      icpProfileId: leadDiscoveryCandidates.icpProfileId,
    })
    .from(leadDiscoveryCandidates)
    .where(
      and(
        eq(leadDiscoveryCandidates.id, input.candidateId),
        eq(leadDiscoveryCandidates.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!candidate) {
    return null;
  }

  const [feedback] = await db
    .insert(leadDiscoveryFeedback)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      candidateId: input.candidateId,
      jobId: candidate.jobId,
      icpProfileId: candidate.icpProfileId,
      action: input.action,
      reason: input.reason,
      reasonTags: input.reasonTags || [],
      metadata: input.metadata || {},
    })
    .returning();

  return feedback;
}

interface CreateBlocklistInput {
  tenantId: string;
  userId: string;
  candidateId: string;
  icpProfileId?: string | null;
  scope?: "tenant" | "user" | "icp_profile";
  type: "domain" | "company" | "keyword" | "category" | "pattern";
  value: string;
  normalizedValue: string;
  reason?: string;
  jobId?: string | null;
}

export async function upsertLeadBlocklist(input: CreateBlocklistInput) {
  const [existing] = await db
    .select({ id: leadBlocklist.id })
    .from(leadBlocklist)
    .where(
      and(
        eq(leadBlocklist.tenantId, input.tenantId),
        eq(leadBlocklist.type, input.type),
        eq(leadBlocklist.normalizedValue, input.normalizedValue),
        eq(leadBlocklist.scope, input.scope || "tenant")
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [block] = await db
    .insert(leadBlocklist)
    .values({
      tenantId: input.tenantId,
      userId: input.userId,
      icpProfileId: input.icpProfileId || null,
      sourceCandidateId: input.candidateId,
      sourceJobId: input.jobId || null,
      scope: input.scope || "tenant",
      type: input.type,
      value: input.value,
      normalizedValue: input.normalizedValue,
      reason: input.reason,
    })
    .returning({ id: leadBlocklist.id });

  return block;
}
