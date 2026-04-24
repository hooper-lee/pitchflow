import { and, count, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  icpProfiles,
  leadBlocklist,
  leadDiscoveryCandidates,
  leadDiscoveryJobs,
  prospects,
} from "@/lib/db/schema";
import { recordDiscoveryFeedback, upsertLeadBlocklist } from "@/lib/services/discovery-feedback.service";
import { checkProspectQuota } from "@/lib/services/quota.service";
import { leadDiscoveryQueue } from "@/lib/queue";
import type {
  CreateDiscoveryJobInput,
  DiscoveryCandidateActionInput,
  DiscoveryCandidateListInput,
  DiscoveryJobListInput,
} from "@/lib/utils/validators";

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

function normalizeCompanyName(value?: string | null) {
  return normalizeValue(value).replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function firstCandidateEmail(candidate: typeof leadDiscoveryCandidates.$inferSelect) {
  const contacts = candidate.contacts as { emails?: string[] } | null;
  return contacts?.emails?.find(Boolean) || null;
}

async function getCandidateIcpSnapshot(candidate: typeof leadDiscoveryCandidates.$inferSelect) {
  if (!candidate.icpProfileId) return null;

  const [profile] = await db
    .select({
      id: icpProfiles.id,
      name: icpProfiles.name,
      industry: icpProfiles.industry,
      targetCustomerText: icpProfiles.targetCustomerText,
      mustHave: icpProfiles.mustHave,
      mustNotHave: icpProfiles.mustNotHave,
      positiveKeywords: icpProfiles.positiveKeywords,
      negativeKeywords: icpProfiles.negativeKeywords,
      productCategories: icpProfiles.productCategories,
      salesModel: icpProfiles.salesModel,
      promptTemplate: icpProfiles.promptTemplate,
    })
    .from(icpProfiles)
    .where(and(eq(icpProfiles.id, candidate.icpProfileId), eq(icpProfiles.tenantId, candidate.tenantId)))
    .limit(1);

  return profile || null;
}

async function syncDiscoveryJobStats(jobId: string) {
  const [stats] = await db
    .select({
      candidateCount: count(),
      acceptedCount:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'accepted')`,
      rejectedCount:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'rejected')`,
      savedCount:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'saved')`,
    })
    .from(leadDiscoveryCandidates)
    .where(eq(leadDiscoveryCandidates.jobId, jobId));

  await db
    .update(leadDiscoveryJobs)
    .set({
      candidateCount: Number(stats.candidateCount),
      acceptedCount: Number(stats.acceptedCount),
      rejectedCount: Number(stats.rejectedCount),
      savedCount: Number(stats.savedCount),
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));
}

export async function createDiscoveryJob(
  tenantId: string,
  userId: string,
  input: CreateDiscoveryJobInput
) {
  if (input.icpProfileId) {
    const [profile] = await db
      .select({ id: icpProfiles.id })
      .from(icpProfiles)
      .where(and(eq(icpProfiles.id, input.icpProfileId), eq(icpProfiles.tenantId, tenantId)))
      .limit(1);

    if (!profile) {
      throw new Error("ICP profile not found");
    }
  }

  const [job] = await db
    .insert(leadDiscoveryJobs)
    .values({
      tenantId,
      userId,
      icpProfileId: input.icpProfileId,
      name: input.name,
      industry: input.industry,
      country: input.country,
      keywords: input.keywords,
      targetLimit: input.targetLimit,
      filters: input.filters,
      inputQuery: input.keywords.join(", "),
    })
    .returning();

  await leadDiscoveryQueue.add("run-discovery-job", {
    jobId: job.id,
    tenantId,
    userId,
  });

  return job;
}

export async function listDiscoveryJobs(
  tenantId: string,
  params: DiscoveryJobListInput
) {
  const conditions = [eq(leadDiscoveryJobs.tenantId, tenantId)];
  if (params.status) {
    conditions.push(eq(leadDiscoveryJobs.status, params.status));
  }

  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(leadDiscoveryJobs)
    .where(where);

  const items = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(where)
    .orderBy(desc(leadDiscoveryJobs.createdAt))
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  return {
    items,
    total: Number(total),
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / params.limit)),
  };
}

export async function getDiscoveryJob(id: string, tenantId: string) {
  const [job] = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(and(eq(leadDiscoveryJobs.id, id), eq(leadDiscoveryJobs.tenantId, tenantId)))
    .limit(1);

  return job || null;
}

export async function cancelDiscoveryJob(id: string, tenantId: string) {
  const [job] = await db
    .update(leadDiscoveryJobs)
    .set({
      status: "cancelled",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(leadDiscoveryJobs.id, id), eq(leadDiscoveryJobs.tenantId, tenantId)))
    .returning();

  return job || null;
}

export async function listDiscoveryCandidates(
  tenantId: string,
  jobId: string,
  params: DiscoveryCandidateListInput
) {
  const conditions = [
    eq(leadDiscoveryCandidates.tenantId, tenantId),
    eq(leadDiscoveryCandidates.jobId, jobId),
  ];

  if (params.decision) {
    conditions.push(eq(leadDiscoveryCandidates.decision, params.decision));
  }
  if (typeof params.minScore === "number") {
    conditions.push(gte(leadDiscoveryCandidates.finalScore, params.minScore));
  }
  if (params.search) {
    conditions.push(
      or(
        ilike(leadDiscoveryCandidates.companyName, `%${params.search}%`),
        ilike(leadDiscoveryCandidates.domain, `%${params.search}%`),
        ilike(leadDiscoveryCandidates.title, `%${params.search}%`)
      )!
    );
  }

  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: count() })
    .from(leadDiscoveryCandidates)
    .where(where);

  const items = await db
    .select()
    .from(leadDiscoveryCandidates)
    .where(where)
    .orderBy(desc(leadDiscoveryCandidates.finalScore), desc(leadDiscoveryCandidates.createdAt))
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  return {
    items,
    total: Number(total),
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(Number(total) / params.limit)),
  };
}

async function getCandidate(candidateId: string, tenantId: string) {
  const [candidate] = await db
    .select()
    .from(leadDiscoveryCandidates)
    .where(
      and(
        eq(leadDiscoveryCandidates.id, candidateId),
        eq(leadDiscoveryCandidates.tenantId, tenantId)
      )
    )
    .limit(1);

  return candidate || null;
}

function mapDecision(action: DiscoveryCandidateActionInput["action"]) {
  if (action === "accept") return "accepted";
  if (action === "reject") return "rejected";
  if (action === "blacklist") return "blacklisted";
  if (action === "save_to_prospect") return "saved";
  return "pending";
}

export async function saveCandidateToProspect(
  candidateId: string,
  tenantId: string,
  userId: string
) {
  const candidate = await getCandidate(candidateId, tenantId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }
  if (candidate.createdProspectId) {
    return candidate.createdProspectId;
  }

  const candidateEmail = firstCandidateEmail(candidate);
  const normalizedName = normalizeCompanyName(candidate.companyName);
  const existingProspects = await db
    .select({
      id: prospects.id,
      companyName: prospects.companyName,
      email: prospects.email,
      website: prospects.website,
      metadata: prospects.metadata,
    })
    .from(prospects)
    .where(eq(prospects.tenantId, tenantId));

  const existing = existingProspects.find((prospect) => {
    const sameDomain =
      candidate.rootDomain &&
      normalizeValue(prospect.website).includes(normalizeValue(candidate.rootDomain));
    const sameEmail = candidateEmail && normalizeValue(prospect.email) === normalizeValue(candidateEmail);
    const sameName =
      normalizedName &&
      normalizeCompanyName(prospect.companyName) === normalizedName;
    return Boolean(sameDomain || sameEmail || sameName);
  });

  const quota = await checkProspectQuota(tenantId, existing ? 0 : 1);
  if (!quota.allowed) {
    throw new Error(quota.message || "Quota exceeded");
  }

  const icpSnapshot = await getCandidateIcpSnapshot(candidate);
  const prospectId = existing?.id || (
    await db
      .insert(prospects)
      .values({
        tenantId,
        companyName: candidate.companyName || candidate.domain || candidate.rootDomain,
        email: candidateEmail,
        website: candidate.finalUrl || candidate.url,
        industry: null,
        country: null,
        source: "discovery_candidate",
        status: "new",
        researchSummary: candidate.snippet,
        companyScore: candidate.detectorScore,
        matchScore: candidate.finalScore,
        metadata: {
          discoveryJobId: candidate.jobId,
          discoveryCandidateId: candidate.id,
          icpProfileId: candidate.icpProfileId,
          icpProfile: icpSnapshot,
          rootDomain: candidate.rootDomain,
          detectorScore: candidate.detectorScore,
          ruleScore: candidate.ruleScore,
          aiScore: candidate.aiScore,
          feedbackScore: candidate.feedbackScore,
          finalScore: candidate.finalScore,
          discoveryFinalScore: candidate.finalScore,
          evidence: candidate.evidence,
          rejectReasons: candidate.rejectReasons,
          matchedRules: candidate.matchedRules,
        },
      })
      .returning({ id: prospects.id })
  )[0].id;

  if (existing) {
    await db
      .update(prospects)
      .set({
        matchScore: candidate.finalScore,
        metadata: {
          ...(existing.metadata || {}),
          discoveryJobId: candidate.jobId,
          discoveryCandidateId: candidate.id,
          icpProfileId: candidate.icpProfileId,
          icpProfile: icpSnapshot,
          rootDomain: candidate.rootDomain,
          detectorScore: candidate.detectorScore,
          ruleScore: candidate.ruleScore,
          aiScore: candidate.aiScore,
          feedbackScore: candidate.feedbackScore,
          finalScore: candidate.finalScore,
          discoveryFinalScore: candidate.finalScore,
          evidence: candidate.evidence,
          rejectReasons: candidate.rejectReasons,
          matchedRules: candidate.matchedRules,
        },
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, existing.id));
  }

  await db
    .update(leadDiscoveryCandidates)
    .set({
      createdProspectId: prospectId,
      decision: "saved",
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryCandidates.id, candidate.id));

  await recordDiscoveryFeedback({
    tenantId,
    userId,
    candidateId: candidate.id,
    action: "save_to_prospect",
    metadata: { prospectId },
  });
  await syncDiscoveryJobStats(candidate.jobId);

  return prospectId;
}

export async function actOnDiscoveryCandidate(
  candidateId: string,
  tenantId: string,
  userId: string,
  input: DiscoveryCandidateActionInput
) {
  if (input.action === "save_to_prospect") {
    const prospectId = await saveCandidateToProspect(candidateId, tenantId, userId);
    return { candidateId, decision: "saved", prospectId };
  }

  const candidate = await getCandidate(candidateId, tenantId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  const decision = mapDecision(input.action);
  await db
    .update(leadDiscoveryCandidates)
    .set({ decision, updatedAt: new Date() })
    .where(eq(leadDiscoveryCandidates.id, candidateId));

  await recordDiscoveryFeedback({
    tenantId,
    userId,
    candidateId,
    action: input.action,
    reason: input.reason,
    reasonTags: input.reasonTags,
  });

  if (input.action === "blacklist" && candidate.rootDomain) {
    await upsertLeadBlocklist({
      tenantId,
      userId,
      candidateId,
      jobId: candidate.jobId,
      icpProfileId: candidate.icpProfileId,
      type: "domain",
      value: candidate.rootDomain,
      normalizedValue: normalizeValue(candidate.rootDomain),
      reason: input.reason,
    });
  }

  await syncDiscoveryJobStats(candidate.jobId);
  return { candidateId, decision };
}

export async function getDiscoveryJobWithSummary(id: string, tenantId: string) {
  const job = await getDiscoveryJob(id, tenantId);
  if (!job) {
    return null;
  }

  const [summary] = await db
    .select({
      pending:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'pending')`,
      accepted:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'accepted')`,
      rejected:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'rejected')`,
      review:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'needs_review')`,
      blacklisted:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'blacklisted')`,
      saved:
        sql<number>`count(*) filter (where ${leadDiscoveryCandidates.decision} = 'saved')`,
    })
    .from(leadDiscoveryCandidates)
    .where(eq(leadDiscoveryCandidates.jobId, id));

  return { ...job, summary };
}

export async function getDiscoveryCandidateActionHistory(
  tenantId: string,
  rootDomain: string | null,
  companyName: string | null
) {
  const conditions = [eq(leadDiscoveryCandidates.tenantId, tenantId)];
  if (rootDomain) {
    conditions.push(eq(leadDiscoveryCandidates.rootDomain, rootDomain));
  } else if (companyName) {
    conditions.push(eq(leadDiscoveryCandidates.companyName, companyName));
  } else {
    return [];
  }

  return db
    .select({
      id: leadDiscoveryCandidates.id,
      decision: leadDiscoveryCandidates.decision,
      jobId: leadDiscoveryCandidates.jobId,
      createdProspectId: leadDiscoveryCandidates.createdProspectId,
      finalScore: leadDiscoveryCandidates.finalScore,
    })
    .from(leadDiscoveryCandidates)
    .where(and(...conditions))
    .orderBy(desc(leadDiscoveryCandidates.createdAt))
    .limit(20);
}

export async function listLeadBlocklist(
  tenantId: string,
  icpProfileId?: string | null
) {
  const conditions = [eq(leadBlocklist.tenantId, tenantId)];
  if (icpProfileId) {
    conditions.push(or(eq(leadBlocklist.icpProfileId, icpProfileId), isNull(leadBlocklist.icpProfileId))!);
  }

  return db
    .select()
    .from(leadBlocklist)
    .where(and(...conditions))
    .orderBy(desc(leadBlocklist.createdAt));
}
