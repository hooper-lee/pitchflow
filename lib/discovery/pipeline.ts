import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  icpProfiles,
  leadDiscoveryCandidates,
  leadDiscoveryFeedback,
  leadDiscoveryJobs,
  prospects,
} from "@/lib/db/schema";
import { detectOfficialWebsite, extractContacts } from "@/lib/detector";
import { getDetectorConfig } from "@/lib/detector/config";
import { fetchPage } from "@/lib/detector/fetcher";
import { searchCompany } from "@/lib/integrations/serpapi";
import { classifyCandidateWithAI } from "./ai-classifier";
import { getDiscoveryHistorySignals, getFeedbackScore } from "./blocklist";
import { normalizeDomain, normalizeUrl, getRootDomain } from "./normalize";
import { buildDiscoveryQueries } from "./query-expander";
import { runRuleFilter } from "./rule-filter";
import { calculateDiscoveryDecision } from "./scoring";
import type {
  DiscoveryAiClassifyOutput,
  DiscoveryEvidence,
  DiscoveryFetchedPage,
  DiscoveryIcpProfile,
  DiscoveryJobRecord,
  DiscoveryNormalizedCandidate,
} from "./types";

type DetectorCandidate = Awaited<ReturnType<typeof detectOfficialWebsite>>["allCandidates"][number];

interface PipelineContext {
  job: DiscoveryJobRecord;
  icpProfile: DiscoveryIcpProfile | null;
}

interface WorkingCandidate {
  candidate: DiscoveryNormalizedCandidate;
  aiResult: DiscoveryAiClassifyOutput | null;
}

export async function runDiscoveryPipeline(jobId: string) {
  const context = await loadContext(jobId);
  await markJobStarted(context.job.id);
  await ensureJobActive(context.job.id);

  const queries = buildDiscoveryQueries(context.job, context.icpProfile || emptyProfile(context.job));
  const detectedCandidates = await collectDetectedCandidates(context, queries);
  await updateSearchProgress(context.job.id, detectedCandidates.length);
  await ensureJobActive(context.job.id);

  const enrichedCandidates = await enrichCandidates(context, detectedCandidates);
  await updateCrawlProgress(context.job.id, enrichedCandidates.length);
  await ensureJobActive(context.job.id);

  const scoredCandidates = await scoreCandidates(context, enrichedCandidates);
  const persistedCandidates = await persistCandidates(context, scoredCandidates);
  const savedCount = await autoSaveCandidates(context, persistedCandidates);

  return finalizeJob(context, persistedCandidates, savedCount);
}

async function loadContext(jobId: string): Promise<PipelineContext> {
  const [jobRow] = await db
    .select()
    .from(leadDiscoveryJobs)
    .where(eq(leadDiscoveryJobs.id, jobId))
    .limit(1);
  if (!jobRow) throw new Error(`Discovery job not found: ${jobId}`);

  const icpProfile = jobRow.icpProfileId
    ? await loadIcpProfile(jobRow.icpProfileId)
    : null;

  return {
    job: mapJob(jobRow),
    icpProfile,
  };
}

async function loadIcpProfile(icpProfileId: string) {
  const [profileRow] = await db
    .select()
    .from(icpProfiles)
    .where(eq(icpProfiles.id, icpProfileId))
    .limit(1);
  if (!profileRow) return null;
  return mapIcpProfile(profileRow);
}

async function markJobStarted(jobId: string) {
  await db
    .update(leadDiscoveryJobs)
    .set({ status: "searching", progress: 5, startedAt: new Date(), updatedAt: new Date() })
    .where(eq(leadDiscoveryJobs.id, jobId));
}

async function collectDetectedCandidates(context: PipelineContext, queries: string[]) {
  const mergedCandidates = new Map<string, DiscoveryNormalizedCandidate>();
  for (const query of queries) {
    const detectorResults = await detectQuery(query, context.job.targetLimit);
    for (const detectorCandidate of detectorResults) {
      const normalizedCandidate = toNormalizedCandidate(detectorCandidate, query);
      if (!normalizedCandidate) continue;
      mergeCandidate(mergedCandidates, normalizedCandidate);
    }
  }
  return Array.from(mergedCandidates.values()).slice(0, context.job.targetLimit * 3);
}

async function detectQuery(query: string, targetLimit: number) {
  const searchResults = await searchCompany(query, { num: Math.min(Math.max(targetLimit, 10), 20) });
  if (searchResults.length === 0) return [];
  const detectorResult = await detectOfficialWebsite(query, searchResults, await getDetectorConfig());
  return detectorResult.allCandidates;
}

function toNormalizedCandidate(detectorCandidate: DetectorCandidate, searchQuery: string) {
  const normalizedUrl = normalizeUrl(detectorCandidate.signals.finalUrl || detectorCandidate.candidate.link);
  const domain = normalizeDomain(normalizedUrl || detectorCandidate.candidate.link);
  const rootDomain = getRootDomain(domain || "");
  if (!normalizedUrl || !domain || !rootDomain) return null;

  const contacts = extractContacts(detectorCandidate.signals);
  return {
    title: detectorCandidate.candidate.title,
    url: detectorCandidate.candidate.link,
    finalUrl: normalizedUrl,
    snippet: detectorCandidate.candidate.snippet,
    searchQuery,
    domain,
    rootDomain,
    source: "search+detector",
    companyName: contacts.companyName,
    detectorScore: detectorCandidate.score,
    detectorDimensions: detectorCandidate.dimensionScores,
    matchedRules: [],
    rejectReasons: [],
    evidence: [],
    pagesFetched: [],
    rawText: "",
    contacts: contacts as unknown as Record<string, unknown>,
    ruleScore: 0,
    aiScore: null,
    feedbackScore: 0,
    finalScore: 0,
    decision: "pending" as const,
    metadata: { detectorRank: detectorCandidate.rank },
  };
}

function mergeCandidate(
  mergedCandidates: Map<string, DiscoveryNormalizedCandidate>,
  incomingCandidate: DiscoveryNormalizedCandidate
) {
  const existingCandidate = mergedCandidates.get(incomingCandidate.rootDomain);
  if (!existingCandidate || incomingCandidate.detectorScore > existingCandidate.detectorScore) {
    mergedCandidates.set(incomingCandidate.rootDomain, incomingCandidate);
  }
}

async function updateSearchProgress(jobId: string, searchedCount: number) {
  await db
    .update(leadDiscoveryJobs)
    .set({
      status: "crawling",
      searchedCount,
      progress: 25,
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));
}

async function enrichCandidates(context: PipelineContext, candidates: DiscoveryNormalizedCandidate[]) {
  const detectorConfig = await getDetectorConfig();
  const enrichedCandidates: DiscoveryNormalizedCandidate[] = [];

  for (const candidate of candidates) {
    await ensureJobActive(context.job.id);
    const pagesFetched = await fetchCandidatePages(candidate.finalUrl, detectorConfig);
    const history = await getDiscoveryHistorySignals({
      tenantId: context.job.tenantId,
      userId: context.job.userId,
      icpProfileId: context.job.icpProfileId,
      rootDomain: candidate.rootDomain,
      companyName: candidate.companyName,
      searchableText: pagesFetched.map((page) => page.text).join("\n"),
    });
    enrichedCandidates.push(applyPageEnrichment(candidate, pagesFetched, history));
  }

  return enrichedCandidates;
}

async function fetchCandidatePages(finalUrl: string, detectorConfig: Awaited<ReturnType<typeof getDetectorConfig>>) {
  const homepage = await fetchPageWithRetry(finalUrl, detectorConfig);
  if (homepage.error) return [];
  const pageUrls = homepage.$ ? collectRelatedPages(homepage.$, homepage.finalUrl) : [];
  const relatedPages = await fetchRelatedPages(pageUrls, detectorConfig);
  return buildFetchedPages(homepage, relatedPages);
}

async function fetchPageWithRetry(url: string, detectorConfig: Awaited<ReturnType<typeof getDetectorConfig>>) {
  const firstAttempt = await fetchPage(url, detectorConfig);
  if (!firstAttempt.error) return firstAttempt;
  return fetchPage(url, detectorConfig);
}

function collectRelatedPages($: Awaited<ReturnType<typeof fetchPage>>["$"], finalUrl: string) {
  const keywords = ["about", "brand", "story", "product", "collection", "faq", "assembly"];
  const discoveredUrls = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || discoveredUrls.size >= 5) return;
    const absoluteUrl = toAbsoluteUrl(href, finalUrl);
    if (!absoluteUrl || !keywords.some((keyword) => absoluteUrl.toLowerCase().includes(keyword))) return;
    discoveredUrls.add(absoluteUrl);
  });
  return Array.from(discoveredUrls);
}

async function fetchRelatedPages(
  urls: string[],
  detectorConfig: Awaited<ReturnType<typeof getDetectorConfig>>
) {
  const pages: Awaited<ReturnType<typeof fetchPage>>[] = [];
  for (const url of urls) pages.push(await fetchPageWithRetry(url, detectorConfig));
  return pages;
}

function buildFetchedPages(
  homepage: Awaited<ReturnType<typeof fetchPage>>,
  relatedPages: Awaited<ReturnType<typeof fetchPage>>[]
) {
  const pages: DiscoveryFetchedPage[] = [];
  if (!homepage.error) pages.push(toFetchedPage("homepage", homepage));
  for (const page of relatedPages) {
    if (page.error) continue;
    pages.push(toFetchedPage(resolvePageType(page.finalUrl), page));
  }
  return pages;
}

function toFetchedPage(type: DiscoveryFetchedPage["type"], page: Awaited<ReturnType<typeof fetchPage>>) {
  return {
    type,
    url: page.finalUrl,
    title: page.$("title").text().trim() || undefined,
    text: extractMeaningfulText(page.$("body").text()),
  };
}

function resolvePageType(url: string): DiscoveryFetchedPage["type"] {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes("assembly")) return "assembly";
  if (normalizedUrl.includes("faq")) return "faq";
  if (normalizedUrl.includes("product") || normalizedUrl.includes("collection")) return "product";
  if (normalizedUrl.includes("brand") || normalizedUrl.includes("story")) return "brand";
  if (normalizedUrl.includes("about")) return "about";
  return "homepage";
}

function applyPageEnrichment(
  candidate: DiscoveryNormalizedCandidate,
  pagesFetched: DiscoveryFetchedPage[],
  history: Awaited<ReturnType<typeof getDiscoveryHistorySignals>>
) {
  const rawText = pagesFetched.map((page) => `[${page.type}] ${page.text}`).join("\n");
  return {
    ...candidate,
    pagesFetched,
    rawText,
    feedbackScore: getFeedbackScore(history),
    metadata: {
      ...candidate.metadata,
      history,
      duplicateExistingProspect: Boolean(history.existingProspectId),
    },
  };
}

async function updateCrawlProgress(jobId: string, crawledCount: number) {
  await db
    .update(leadDiscoveryJobs)
    .set({
      status: "filtering",
      crawledCount,
      progress: 55,
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, jobId));
}

async function scoreCandidates(context: PipelineContext, candidates: DiscoveryNormalizedCandidate[]) {
  const aiBudget = Math.min(context.job.targetLimit * 3, 100);
  const scoredCandidates: WorkingCandidate[] = [];
  let aiCalls = 0;

  for (const candidate of candidates) {
    await ensureJobActive(context.job.id);
    const scoredCandidate = await scoreCandidate(context, candidate, aiCalls < aiBudget);
    if (scoredCandidate.aiResult) aiCalls += 1;
    scoredCandidates.push(scoredCandidate);
  }

  await db
    .update(leadDiscoveryJobs)
    .set({ status: "scoring", progress: 78, updatedAt: new Date() })
    .where(eq(leadDiscoveryJobs.id, context.job.id));

  return scoredCandidates;
}

async function scoreCandidate(
  context: PipelineContext,
  candidate: DiscoveryNormalizedCandidate,
  allowAi: boolean
): Promise<WorkingCandidate> {
  const icpProfile = context.icpProfile || emptyProfile(context.job);
  const ruleResult = runRuleFilter({ candidate: buildRuleCandidate(candidate), icpProfile });
  const aiResult = allowAi && shouldRunAi(candidate, ruleResult)
    ? await classifyCandidate(candidate, icpProfile)
    : null;

  const history = candidate.metadata.history as { blocked?: boolean } | undefined;
  const decision = calculateDiscoveryDecision({
    detectorScore: candidate.detectorScore,
    ruleResult,
    aiResult,
    feedbackScore: candidate.feedbackScore,
    icpProfile,
    blocked: Boolean(history?.blocked),
  });

  return {
    aiResult,
    candidate: mergeScoredCandidate(candidate, ruleResult, aiResult, decision),
  };
}

function buildRuleCandidate(candidate: DiscoveryNormalizedCandidate) {
  return {
    title: candidate.title,
    snippet: candidate.snippet,
    companyName: candidate.companyName,
    domain: candidate.domain,
    rootDomain: candidate.rootDomain,
    rawText: candidate.rawText,
    pagesFetched: candidate.pagesFetched,
  };
}

function shouldRunAi(candidate: DiscoveryNormalizedCandidate, ruleResult: ReturnType<typeof runRuleFilter>) {
  const history = candidate.metadata.history as { blocked?: boolean } | undefined;
  if (history?.blocked) return false;
  if (ruleResult.hardReject) return false;
  return candidate.detectorScore >= 20;
}

async function classifyCandidate(
  candidate: DiscoveryNormalizedCandidate,
  icpProfile: DiscoveryIcpProfile
) {
  const pageTexts = splitPageTexts(candidate.pagesFetched);
  return classifyCandidateWithAI({
    companyName: candidate.companyName,
    domain: candidate.rootDomain,
    homepageText: pageTexts.homepage,
    aboutText: pageTexts.about,
    productText: pageTexts.product,
    faqText: pageTexts.faq,
    searchSnippet: candidate.snippet,
    detectorScore: candidate.detectorScore,
    detectorDimensions: candidate.detectorDimensions,
    icpProfile,
  });
}

function splitPageTexts(pagesFetched: DiscoveryFetchedPage[]) {
  return {
    homepage: joinPageText(pagesFetched, ["homepage"]),
    about: joinPageText(pagesFetched, ["about", "brand"]),
    product: joinPageText(pagesFetched, ["product", "assembly"]),
    faq: joinPageText(pagesFetched, ["faq"]),
  };
}

function joinPageText(pagesFetched: DiscoveryFetchedPage[], pageTypes: DiscoveryFetchedPage["type"][]) {
  return pagesFetched
    .filter((page) => pageTypes.includes(page.type))
    .map((page) => page.text)
    .join("\n")
    .slice(0, 4000);
}

function mergeScoredCandidate(
  candidate: DiscoveryNormalizedCandidate,
  ruleResult: ReturnType<typeof runRuleFilter>,
  aiResult: DiscoveryAiClassifyOutput | null,
  decision: ReturnType<typeof calculateDiscoveryDecision>
) {
  const aiEvidence = aiResult?.evidence || [];
  return {
    ...candidate,
    matchedRules: ruleResult.matchedRules,
    rejectReasons: mergeStrings(ruleResult.rejectReasons, aiResult?.rejectionReasons || []),
    evidence: mergeEvidence(ruleResult.evidence, aiEvidence),
    ruleScore: ruleResult.ruleScore,
    aiScore: aiResult ? computeAiScoreSafe(aiResult) : null,
    finalScore: decision.finalScore,
    decision: decision.decision,
    metadata: {
      ...candidate.metadata,
      aiReasoning: aiResult?.reasoning || null,
      aiConfidence: aiResult?.confidence || null,
    },
  };
}

function computeAiScoreSafe(aiResult: DiscoveryAiClassifyOutput) {
  return Math.round(
    aiResult.scores.businessModelFit * 0.35 +
      aiResult.scores.productFit * 0.35 +
      aiResult.scores.salesModelFit * 0.2 +
      (100 - aiResult.scores.exclusionRisk) * 0.1
  );
}

function mergeStrings(left: string[], right: string[]) {
  return Array.from(new Set([...left, ...right]));
}

function mergeEvidence(left: DiscoveryEvidence[], right: DiscoveryEvidence[]) {
  const merged = [...left, ...right];
  return merged.filter((entry, index) => {
    return merged.findIndex((candidate) => candidate.quote === entry.quote && candidate.reason === entry.reason) === index;
  });
}

async function persistCandidates(context: PipelineContext, scoredCandidates: WorkingCandidate[]) {
  const persistedCandidates: DiscoveryNormalizedCandidate[] = [];

  for (const scoredCandidate of scoredCandidates) {
    const persistedCandidate = await persistCandidate(context, scoredCandidate.candidate);
    persistedCandidates.push(persistedCandidate);
  }

  return persistedCandidates;
}

async function persistCandidate(context: PipelineContext, candidate: DiscoveryNormalizedCandidate) {
  await db
    .insert(leadDiscoveryCandidates)
    .values({
      jobId: context.job.id,
      tenantId: context.job.tenantId,
      icpProfileId: context.job.icpProfileId || null,
      url: candidate.url,
      finalUrl: candidate.finalUrl,
      domain: candidate.domain,
      rootDomain: candidate.rootDomain,
      companyName: candidate.companyName,
      title: candidate.title,
      snippet: candidate.snippet,
      source: candidate.source,
      searchQuery: candidate.searchQuery,
      pagesFetched: candidate.pagesFetched as unknown as Record<string, unknown>[],
      rawText: candidate.rawText,
      detectorScore: candidate.detectorScore,
      detectorDimensions: candidate.detectorDimensions,
      ruleScore: candidate.ruleScore,
      aiScore: candidate.aiScore,
      feedbackScore: candidate.feedbackScore,
      finalScore: candidate.finalScore,
      decision: candidate.decision,
      rejectReasons: candidate.rejectReasons,
      matchedRules: candidate.matchedRules,
      evidence: candidate.evidence,
      contacts: candidate.contacts,
      metadata: candidate.metadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [leadDiscoveryCandidates.jobId, leadDiscoveryCandidates.rootDomain],
      set: buildCandidateUpdateSet(candidate),
    });

  const [persistedCandidate] = await db
    .select()
    .from(leadDiscoveryCandidates)
    .where(
      and(
        eq(leadDiscoveryCandidates.jobId, context.job.id),
        eq(leadDiscoveryCandidates.rootDomain, candidate.rootDomain)
      )
    )
    .limit(1);

  return {
    ...candidate,
    decision: persistedCandidate?.decision || candidate.decision,
    finalScore: persistedCandidate?.finalScore || candidate.finalScore,
  };
}

function buildCandidateUpdateSet(candidate: DiscoveryNormalizedCandidate) {
  return {
    finalUrl: candidate.finalUrl,
    companyName: candidate.companyName,
    title: candidate.title,
    snippet: candidate.snippet,
    source: candidate.source,
    searchQuery: candidate.searchQuery,
    pagesFetched: candidate.pagesFetched as unknown as Record<string, unknown>[],
    rawText: candidate.rawText,
    detectorScore: candidate.detectorScore,
    detectorDimensions: candidate.detectorDimensions,
    ruleScore: candidate.ruleScore,
    aiScore: candidate.aiScore,
    feedbackScore: candidate.feedbackScore,
    finalScore: candidate.finalScore,
    decision: candidate.decision,
    rejectReasons: candidate.rejectReasons,
    matchedRules: candidate.matchedRules,
    evidence: candidate.evidence,
    contacts: candidate.contacts,
    metadata: candidate.metadata,
    updatedAt: new Date(),
  };
}

async function autoSaveCandidates(context: PipelineContext, candidates: DiscoveryNormalizedCandidate[]) {
  let savedCount = 0;
  if (context.job.filters.autoSaveHighScoreCandidates === false) return 0;

  for (const candidate of candidates) {
    const icpProfile = context.icpProfile || emptyProfile(context.job);
    if (candidate.decision !== "accepted" || candidate.finalScore < icpProfile.minScoreToSave) continue;
    const savedProspect = await saveCandidateToProspect(context, candidate.rootDomain);
    if (!savedProspect) continue;
    savedCount += 1;
  }

  return savedCount;
}

async function saveCandidateToProspect(context: PipelineContext, rootDomain: string) {
  const [candidate] = await db
    .select()
    .from(leadDiscoveryCandidates)
    .where(
      and(
        eq(leadDiscoveryCandidates.jobId, context.job.id),
        eq(leadDiscoveryCandidates.rootDomain, rootDomain)
      )
    )
    .limit(1);
  if (!candidate) return null;
  if (candidate.createdProspectId) return candidate.createdProspectId;

  const existingProspect = await findExistingProspect(context.job.tenantId, candidate);
  if (existingProspect) {
    await markCandidateSaved(candidate.id, existingProspect.id, context);
    return existingProspect.id;
  }

  const [prospect] = await db
    .insert(prospects)
    .values(buildProspectInsertValues(context, candidate))
    .returning({ id: prospects.id });

  if (!prospect) return null;
  await markCandidateSaved(candidate.id, prospect.id, context);
  return prospect.id;
}

async function findExistingProspect(
  tenantId: string,
  candidate: typeof leadDiscoveryCandidates.$inferSelect
) {
  const conditions = [
    eq(prospects.tenantId, tenantId),
    or(
      eq(prospects.website, candidate.finalUrl || ""),
      eq(prospects.companyName, candidate.companyName || "")
    )!,
  ];
  const [prospect] = await db
    .select({ id: prospects.id })
    .from(prospects)
    .where(and(...conditions))
    .limit(1);
  return prospect || null;
}

function buildProspectInsertValues(
  context: PipelineContext,
  candidate: typeof leadDiscoveryCandidates.$inferSelect
) {
  const contacts = (candidate.contacts || {}) as { emails?: string[] };
  const firstEmail = contacts.emails?.[0] || null;
  return {
    tenantId: context.job.tenantId,
    companyName: candidate.companyName || candidate.rootDomain,
    email: firstEmail,
    website: candidate.finalUrl || candidate.url,
    industry: context.job.industry,
    country: context.job.country,
    source: "discovery_candidate",
    status: "new" as const,
    researchSummary: candidate.snippet,
    companyScore: candidate.detectorScore,
    matchScore: candidate.finalScore,
    metadata: {
      discoveryJobId: context.job.id,
      discoveryCandidateId: candidate.id,
      icpProfileId: context.job.icpProfileId,
      rootDomain: candidate.rootDomain,
      detectorScore: candidate.detectorScore,
      ruleScore: candidate.ruleScore,
      aiScore: candidate.aiScore,
      feedbackScore: candidate.feedbackScore,
      finalScore: candidate.finalScore,
      evidence: candidate.evidence,
      rejectReasons: candidate.rejectReasons,
      matchedRules: candidate.matchedRules,
    },
  };
}

async function markCandidateSaved(candidateId: string, prospectId: string, context: PipelineContext) {
  await db
    .update(leadDiscoveryCandidates)
    .set({
      createdProspectId: prospectId,
      decision: "saved",
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryCandidates.id, candidateId));

  await db.insert(leadDiscoveryFeedback).values({
    tenantId: context.job.tenantId,
    userId: context.job.userId || null,
    jobId: context.job.id,
    candidateId,
    icpProfileId: context.job.icpProfileId || null,
    action: "save_to_prospect",
    reasonTags: [],
    metadata: {},
  });
}

async function finalizeJob(
  context: PipelineContext,
  candidates: DiscoveryNormalizedCandidate[],
  savedCount: number
) {
  const stats = countDecisions(candidates, savedCount);
  const status = stats.needsReviewCount > 0 ? "reviewing" : "completed";
  await db
    .update(leadDiscoveryJobs)
    .set({
      status,
      progress: 100,
      candidateCount: candidates.length,
      acceptedCount: stats.acceptedCount,
      rejectedCount: stats.rejectedCount,
      savedCount: stats.savedCount,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leadDiscoveryJobs.id, context.job.id));

  return { status, ...stats, candidateCount: candidates.length };
}

function countDecisions(candidates: DiscoveryNormalizedCandidate[], savedCount: number) {
  return candidates.reduce(
    (stats, candidate) => {
      if (candidate.decision === "accepted") stats.acceptedCount += 1;
      if (candidate.decision === "rejected" || candidate.decision === "blacklisted") stats.rejectedCount += 1;
      if (candidate.decision === "needs_review") stats.needsReviewCount += 1;
      return stats;
    },
    { acceptedCount: 0, rejectedCount: 0, needsReviewCount: 0, savedCount }
  );
}

async function ensureJobActive(jobId: string) {
  const [job] = await db
    .select({ status: leadDiscoveryJobs.status })
    .from(leadDiscoveryJobs)
    .where(eq(leadDiscoveryJobs.id, jobId))
    .limit(1);
  if (job?.status === "cancelled") throw new Error(`Discovery job ${jobId} was cancelled`);
}

function mapJob(jobRow: typeof leadDiscoveryJobs.$inferSelect): DiscoveryJobRecord {
  return {
    id: jobRow.id,
    tenantId: jobRow.tenantId,
    userId: jobRow.userId,
    icpProfileId: jobRow.icpProfileId,
    name: jobRow.name,
    status: jobRow.status,
    industry: jobRow.industry,
    country: jobRow.country,
    keywords: jobRow.keywords || [],
    inputQuery: jobRow.inputQuery,
    filters: jobRow.filters || {},
    targetLimit: jobRow.targetLimit,
    searchedCount: jobRow.searchedCount,
    crawledCount: jobRow.crawledCount,
    candidateCount: jobRow.candidateCount,
    acceptedCount: jobRow.acceptedCount,
    rejectedCount: jobRow.rejectedCount,
    savedCount: jobRow.savedCount,
    progress: jobRow.progress,
  };
}

function mapIcpProfile(profileRow: typeof icpProfiles.$inferSelect): DiscoveryIcpProfile {
  return {
    id: profileRow.id,
    tenantId: profileRow.tenantId,
    userId: profileRow.userId,
    name: profileRow.name,
    description: profileRow.description,
    industry: profileRow.industry,
    targetCustomerText: profileRow.targetCustomerText,
    mustHave: profileRow.mustHave || [],
    mustNotHave: profileRow.mustNotHave || [],
    positiveKeywords: profileRow.positiveKeywords || [],
    negativeKeywords: profileRow.negativeKeywords || [],
    productCategories: profileRow.productCategories || [],
    salesModel: profileRow.salesModel,
    scoreWeights: profileRow.scoreWeights || {},
    minScoreToSave: profileRow.minScoreToSave,
    minScoreToReview: profileRow.minScoreToReview,
    promptTemplate: profileRow.promptTemplate,
  };
}

function emptyProfile(job: DiscoveryJobRecord): DiscoveryIcpProfile {
  return {
    id: "ad-hoc",
    tenantId: job.tenantId,
    name: job.name,
    industry: job.industry,
    mustHave: [],
    mustNotHave: [],
    positiveKeywords: [],
    negativeKeywords: [],
    productCategories: [],
    scoreWeights: {},
    minScoreToSave: 80,
    minScoreToReview: 60,
  };
}

function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function extractMeaningfulText(rawText: string) {
  return rawText.replace(/\s+/g, " ").trim().slice(0, 8000);
}
