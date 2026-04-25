import { readFile } from "node:fs/promises";
import { buildDiscoveryQueries } from "@/lib/discovery/query-expander";
import { getRootDomain } from "@/lib/discovery/normalize";
import { searchDiscoverySources } from "@/lib/discovery/search/search-orchestrator";
import { classifySourcePollution } from "@/lib/discovery/search/source-scoring";
import type { DiscoveryIcpProfile, DiscoveryJobRecord } from "@/lib/discovery/types";
import type { DiscoverySearchResult } from "@/lib/discovery/search/types";

interface GoldenSet {
  icpName: string;
  icpProfile: Partial<DiscoveryIcpProfile>;
  queries?: string[];
  samples?: GoldenSample[];
}

interface GoldenSample {
  url: string;
  label: "target" | "non_target" | "uncertain";
  reason?: string;
  text?: string;
}

const DEFAULT_GOLDEN_SET_PATH = "data/eval/icp-golden-set.example.json";

async function main() {
  const goldenSets = await loadGoldenSets(process.argv[2] || DEFAULT_GOLDEN_SET_PATH);
  for (const goldenSet of goldenSets) {
    const report = await evaluateGoldenSet(goldenSet);
    printReport(report);
  }
}

async function loadGoldenSets(filePath: string): Promise<GoldenSet[]> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as GoldenSet[];
}

async function evaluateGoldenSet(goldenSet: GoldenSet) {
  const icpProfile = normalizeIcpProfile(goldenSet);
  const job = buildEvalJob(goldenSet);
  const queries = buildDiscoveryQueries(job, icpProfile);
  const results = await searchDiscoverySources({
    queries,
    targetLimit: 20,
    country: job.country,
    icpProfile,
  });

  return {
    name: goldenSet.icpName,
    queries,
    metrics: calculateSearchMetrics(results, goldenSet.samples || []),
    results: results.slice(0, 20),
  };
}

function normalizeIcpProfile(goldenSet: GoldenSet): DiscoveryIcpProfile {
  const profile = goldenSet.icpProfile;
  return {
    id: "eval",
    tenantId: "eval",
    name: goldenSet.icpName,
    industry: profile.industry || null,
    targetCustomerText: profile.targetCustomerText || null,
    mustHave: profile.mustHave || [],
    mustNotHave: profile.mustNotHave || [],
    positiveKeywords: profile.positiveKeywords || [],
    negativeKeywords: profile.negativeKeywords || [],
    productCategories: profile.productCategories || [],
    salesModel: profile.salesModel || null,
    scoreWeights: profile.scoreWeights || {},
    minScoreToSave: profile.minScoreToSave || 80,
    minScoreToReview: profile.minScoreToReview || 60,
  };
}

function buildEvalJob(goldenSet: GoldenSet): DiscoveryJobRecord {
  return {
    id: "eval",
    tenantId: "eval",
    name: goldenSet.icpName,
    status: "pending",
    industry: goldenSet.icpProfile.industry || null,
    country: "United States",
    keywords: goldenSet.queries || [],
    inputQuery: goldenSet.icpProfile.targetCustomerText || goldenSet.icpName,
    filters: {},
    targetLimit: 20,
    searchedCount: 0,
    crawledCount: 0,
    candidateCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    savedCount: 0,
    progress: 0,
  };
}

function calculateSearchMetrics(results: DiscoverySearchResult[], samples: GoldenSample[]) {
  const top20 = results.slice(0, 20);
  const uniqueDomains = new Set(results.map((result) => getRootDomain(result.link)).filter(Boolean));
  const pollution = top20.map(classifySourcePollution);
  const labels = matchLabels(top20, samples);
  return {
    totalResults: results.length,
    uniqueRootDomains: uniqueDomains.size,
    duplicateRate: ratio(results.length - uniqueDomains.size, Math.max(results.length, 1)),
    officialSiteRate: ratio(top20.filter((result) => (result.metadata?.sourceQualityScore || 0) >= 60).length, top20.length),
    marketplacePollutionRate: ratio(pollution.filter((item) => item.isMarketplace).length, top20.length),
    directoryPollutionRate: ratio(pollution.filter((item) => item.isDirectory).length, top20.length),
    socialOnlyRate: ratio(pollution.filter((item) => item.isSocialOnly).length, top20.length),
    precisionAt20: ratio(labels.truePositive, labels.truePositive + labels.falsePositive),
    recallAt50: ratio(labels.truePositive, labels.totalTargets),
    falsePositiveExamples: labels.falsePositiveExamples,
    falseNegativeExamples: labels.falseNegativeExamples,
    topErrorCategories: labels.topErrorCategories,
    queryIntentContribution: countIntentContribution(top20),
  };
}

function matchLabels(results: DiscoverySearchResult[], samples: GoldenSample[]) {
  const targetDomains = domainsByLabel(samples, "target");
  const nonTargetDomains = domainsByLabel(samples, "non_target");
  const falsePositiveExamples: Array<{ url: string; category: string }> = [];
  const matchedTargetDomains = new Set<string>();
  const errorCategories: string[] = [];
  let truePositive = 0;
  let falsePositive = 0;

  for (const result of results) {
    const rootDomain = resolveDomainKey(result.link);
    if (!rootDomain) continue;
    if (targetDomains.has(rootDomain)) {
      truePositive += 1;
      matchedTargetDomains.add(rootDomain);
    }
    if (nonTargetDomains.has(rootDomain)) {
      falsePositive += 1;
      const category = classifyErrorCategory(result);
      errorCategories.push(category);
      falsePositiveExamples.push({ url: result.link, category });
    }
  }

  const falseNegativeExamples = Array.from(targetDomains).filter((domain) => !matchedTargetDomains.has(domain));
  errorCategories.push(...falseNegativeExamples.map(() => "missed_target"));

  return {
    truePositive,
    falsePositive,
    totalTargets: targetDomains.size,
    falsePositiveExamples,
    falseNegativeExamples,
    topErrorCategories: countCategories(errorCategories),
  };
}

function domainsByLabel(samples: GoldenSample[], label: GoldenSample["label"]) {
  return new Set(
    samples
      .filter((sample) => sample.label === label)
      .map((sample) => resolveDomainKey(sample.url))
      .filter((domain): domain is string => Boolean(domain))
  );
}

function countIntentContribution(results: DiscoverySearchResult[]) {
  return results.reduce<Record<string, number>>((bucket, result) => {
    bucket[result.queryIntent] = (bucket[result.queryIntent] || 0) + 1;
    return bucket;
  }, {});
}

function classifyErrorCategory(result: DiscoverySearchResult) {
  const pollution = classifySourcePollution(result);
  if (pollution.isMarketplace) return "marketplace_pollution";
  if (pollution.isDirectory) return "directory_pollution";
  if (pollution.isSocialOnly) return "social_only";
  if (pollution.isMediaArticle) return "media_or_article";
  return "non_target_ranked_high";
}

function countCategories(categories: string[]) {
  return categories.reduce<Record<string, number>>((bucket, category) => {
    bucket[category] = (bucket[category] || 0) + 1;
    return bucket;
  }, {});
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(3));
}

function resolveDomainKey(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname.endsWith(".example.com")) return hostname;
  } catch {
    return getRootDomain(url);
  }
  return getRootDomain(url);
}

function printReport(report: Awaited<ReturnType<typeof evaluateGoldenSet>>) {
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
