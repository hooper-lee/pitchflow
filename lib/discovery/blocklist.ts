import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  leadBlocklist,
  leadDiscoveryCandidates,
  prospects,
} from "@/lib/db/schema";
import { normalizeCompanyName } from "./normalize";
import type { DiscoveryHistorySignals } from "./types";

export async function getDiscoveryHistorySignals(input: {
  tenantId: string;
  userId?: string | null;
  icpProfileId?: string | null;
  rootDomain: string;
  companyName?: string | null;
  searchableText?: string;
}): Promise<DiscoveryHistorySignals> {
  const blockEntry = await findBlockEntry(input);
  const previousCandidate = await findPreviousCandidate(input);
  const existingProspectId = await findExistingProspectId(input);

  return {
    blocked: Boolean(blockEntry),
    blockReason: blockEntry?.reason || undefined,
    previousRejected: previousCandidate?.decision === "rejected",
    previousAccepted: previousCandidate?.decision === "accepted",
    previousSaved: previousCandidate?.decision === "saved",
    existingProspectId,
  };
}

export function getFeedbackScore(history: DiscoveryHistorySignals) {
  if (history.blocked) return -100;
  if (history.previousRejected) return -30;
  if (history.previousAccepted || history.previousSaved) return 20;
  return 0;
}

async function findBlockEntry(input: {
  tenantId: string;
  userId?: string | null;
  icpProfileId?: string | null;
  rootDomain: string;
  companyName?: string | null;
  searchableText?: string;
}) {
  const entries = await db
    .select()
    .from(leadBlocklist)
    .where(buildBlocklistWhere(input))
    .orderBy(desc(leadBlocklist.createdAt));

  return entries.find((entry) => matchesEntry(entry, input)) || null;
}

function buildBlocklistWhere(input: {
  tenantId: string;
  userId?: string | null;
  icpProfileId?: string | null;
}) {
  const scopeConditions = [
    and(eq(leadBlocklist.scope, "tenant"), eq(leadBlocklist.tenantId, input.tenantId)),
  ];
  if (input.userId) {
    scopeConditions.push(
      and(eq(leadBlocklist.scope, "user"), eq(leadBlocklist.userId, input.userId))
    );
  }
  if (input.icpProfileId) {
    scopeConditions.push(
      and(
        eq(leadBlocklist.scope, "icp_profile"),
        eq(leadBlocklist.icpProfileId, input.icpProfileId)
      )
    );
  }
  return or(...scopeConditions)!;
}

function matchesEntry(
  entry: typeof leadBlocklist.$inferSelect,
  input: { rootDomain: string; companyName?: string | null; searchableText?: string }
) {
  const normalizedCompany = normalizeCompanyName(input.companyName || "");
  const searchableText = (input.searchableText || "").toLowerCase();
  if (entry.type === "domain") return entry.normalizedValue === input.rootDomain;
  if (entry.type === "company") return entry.normalizedValue === normalizedCompany;
  return searchableText.includes(entry.normalizedValue);
}

async function findPreviousCandidate(input: {
  tenantId: string;
  icpProfileId?: string | null;
  rootDomain: string;
}) {
  const conditions = [eq(leadDiscoveryCandidates.tenantId, input.tenantId)];
  conditions.push(eq(leadDiscoveryCandidates.rootDomain, input.rootDomain));
  if (input.icpProfileId) conditions.push(eq(leadDiscoveryCandidates.icpProfileId, input.icpProfileId));
  const [candidate] = await db
    .select({ decision: leadDiscoveryCandidates.decision })
    .from(leadDiscoveryCandidates)
    .where(and(...conditions))
    .orderBy(desc(leadDiscoveryCandidates.createdAt))
    .limit(1);
  return candidate || null;
}

async function findExistingProspectId(input: {
  tenantId: string;
  rootDomain: string;
  companyName?: string | null;
}) {
  const [prospect] = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(
        eq(prospects.tenantId, input.tenantId),
        or(
          ilike(prospects.website, `%${input.rootDomain}%`),
          eq(prospects.companyName, input.companyName || "")
        )!
      )
    )
    .limit(1);

  if (prospect?.id) return prospect.id;
  const companyName = normalizeCompanyName(input.companyName || "");
  if (!companyName) return null;
  const [companyMatch] = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(and(eq(prospects.tenantId, input.tenantId), eq(prospects.companyName, input.companyName || "")))
    .limit(1);
  return companyMatch?.id || null;
}
