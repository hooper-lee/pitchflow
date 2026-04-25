import { getRootDomain } from "@/lib/discovery/normalize";
import type { DiscoveryIcpProfile } from "@/lib/discovery/types";
import { getDiscoverySearchProviders } from "./providers";
import { scoreDiscoverySource } from "./source-scoring";
import type {
  DiscoveryExpandedQuery,
  DiscoverySearchProvider,
  DiscoverySearchResult,
  DiscoverySearchSourceEvidence,
} from "./types";

interface SearchDiscoverySourcesInput {
  queries: DiscoveryExpandedQuery[];
  targetLimit: number;
  country?: string | null;
  language?: string | null;
  icpProfile?: DiscoveryIcpProfile | null;
}

interface SearchBucket {
  result: DiscoverySearchResult;
  sources: DiscoverySearchSourceEvidence[];
}

export async function searchDiscoverySources(input: SearchDiscoverySourcesInput) {
  const providers = await getEnabledProviders();
  const maxResults = calculatePerQueryLimit(input);
  const providerResults = await collectProviderResults(input, providers, maxResults);
  return dedupeAndRankResults(providerResults, input).slice(0, input.targetLimit * 5);
}

function calculatePerQueryLimit(input: SearchDiscoverySourcesInput) {
  const maxTotalResults = input.targetLimit * 5;
  const perQueryLimit = Math.ceil(maxTotalResults / Math.max(input.queries.length, 1));
  return Math.max(5, Math.min(perQueryLimit, 20));
}

async function getEnabledProviders() {
  const providers = getDiscoverySearchProviders();
  const enabledProviders: DiscoverySearchProvider[] = [];
  for (const provider of providers) {
    if (await provider.enabled()) enabledProviders.push(provider);
  }
  return enabledProviders;
}

async function collectProviderResults(
  input: SearchDiscoverySourcesInput,
  providers: DiscoverySearchProvider[],
  maxResults: number
) {
  const results: DiscoverySearchResult[] = [];
  for (const query of input.queries) {
    const queryResults = await searchProvidersForQuery(providers, input, query, maxResults);
    results.push(...queryResults);
  }
  return results;
}

async function searchProvidersForQuery(
  providers: DiscoverySearchProvider[],
  input: SearchDiscoverySourcesInput,
  query: DiscoveryExpandedQuery,
  maxResults: number
) {
  const settledResults = await Promise.allSettled(
    providers.map((provider) =>
      provider.search({
        query: query.query,
        intent: query.intent,
        maxResults,
        country: input.country,
        language: input.language,
      })
    )
  );
  return settledResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

function dedupeAndRankResults(
  results: DiscoverySearchResult[],
  input: SearchDiscoverySourcesInput
) {
  const buckets = new Map<string, SearchBucket>();
  const intentHits = countIntentHits(results);

  for (const result of results) {
    const rootDomain = getRootDomain(result.link);
    if (!rootDomain) continue;
    const scoredResult = attachSourceMetadata(result, rootDomain, input, intentHits.get(rootDomain) || 1);
    const bucket = buckets.get(rootDomain);
    if (!bucket) {
      buckets.set(rootDomain, { result: scoredResult, sources: [toEvidence(scoredResult)] });
      continue;
    }
    bucket.sources.push(toEvidence(scoredResult));
    if (shouldReplaceResult(scoredResult, bucket.result)) bucket.result = scoredResult;
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket.result,
      metadata: {
        ...bucket.result.metadata,
        sources: bucket.sources,
      },
    }))
    .sort(compareSearchResults);
}

function countIntentHits(results: DiscoverySearchResult[]) {
  const intentMap = new Map<string, Set<string>>();
  for (const result of results) {
    const rootDomain = getRootDomain(result.link);
    if (!rootDomain) continue;
    const intents = intentMap.get(rootDomain) || new Set<string>();
    intents.add(result.queryIntent);
    intentMap.set(rootDomain, intents);
  }
  return new Map(Array.from(intentMap.entries()).map(([domain, intents]) => [domain, intents.size]));
}

function attachSourceMetadata(
  result: DiscoverySearchResult,
  rootDomain: string,
  input: SearchDiscoverySourcesInput,
  intentHits: number
) {
  const sourceQualityScore = scoreDiscoverySource({
    result,
    icpProfile: input.icpProfile,
    intentHits,
  });
  return {
    ...result,
    metadata: {
      ...result.metadata,
      rootDomain,
      sourceQualityScore,
    },
  };
}

function shouldReplaceResult(incoming: DiscoverySearchResult, existing: DiscoverySearchResult) {
  const incomingScore = incoming.metadata?.sourceQualityScore || 0;
  const existingScore = existing.metadata?.sourceQualityScore || 0;
  if (Math.abs(incomingScore - existingScore) > 5) return incomingScore > existingScore;
  return incoming.rawRank < existing.rawRank;
}

function compareSearchResults(left: DiscoverySearchResult, right: DiscoverySearchResult) {
  const scoreDiff = (right.metadata?.sourceQualityScore || 0) - (left.metadata?.sourceQualityScore || 0);
  if (scoreDiff !== 0) return scoreDiff;
  return left.rawRank - right.rawRank;
}

function toEvidence(result: DiscoverySearchResult): DiscoverySearchSourceEvidence {
  return {
    provider: result.sourceProvider,
    query: result.query,
    queryIntent: result.queryIntent,
    rawRank: result.rawRank,
    sourceConfidence: result.sourceConfidence,
  };
}
