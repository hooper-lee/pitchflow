import type { SearchCandidate, DetectorResult, DetectorConfig } from "./types";
import { getDetectorConfig } from "./config";
import { filterCandidates } from "./filter";
import { fetchPage } from "./fetcher";
import { extractSignals } from "./signals";
import { rankCandidates } from "./scorer";
import { extractContacts } from "./extractor";
import {
  MINIMUM_SCORE_THRESHOLD,
  MAX_CONCURRENT_FETCHES,
  MAX_CANDIDATES_TO_FETCH,
} from "./constants";

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function detectOfficialWebsite(
  searchQuery: string,
  candidates: SearchCandidate[],
  config?: DetectorConfig,
  maxFetch?: number
): Promise<DetectorResult> {
  const detectorConfig = config || (await getDetectorConfig());

  // Step 1: Filter
  const filtered = filterCandidates(candidates, detectorConfig);
  const unblocked = filtered.filter((c) => !c.blocked);
  const passedFilter = unblocked.length;

  if (unblocked.length === 0) {
    return {
      winner: null,
      allCandidates: [],
      searchQuery,
      totalCandidates: candidates.length,
      passedFilter: 0,
      fetchedSuccessfully: 0,
    };
  }

  // Step 2: Fetch all filtered pages (no truncation)
  const toFetch = unblocked;
  console.log(`[detector] Total: ${candidates.length}, Filtered: ${unblocked.length}/${filtered.length} (blocked ${filtered.length - unblocked.length})`);

  const fetchResults = await processInBatches(
    toFetch,
    MAX_CONCURRENT_FETCHES,
    async (candidate) => {
      const fetchResult = await fetchPage(candidate.link, detectorConfig);
      return { candidate, fetchResult };
    }
  );

  // Step 3: Extract signals and build scored candidates
  const scoredInputs: { signals: ReturnType<typeof extractSignals>; candidate: SearchCandidate }[] = [];

  for (const { candidate, fetchResult } of fetchResults) {
    if (fetchResult.error && fetchResult.httpStatus === 0) continue;

    const signals = extractSignals(fetchResult, searchQuery, detectorConfig);
    scoredInputs.push({
      signals,
      candidate: { title: candidate.title, link: candidate.link, snippet: candidate.snippet },
    });
  }

  // Step 4: Score and rank
  const allCandidates = rankCandidates(scoredInputs, detectorConfig.scoreWeights);

  // Step 5: Pick winner
  const winner = allCandidates.length > 0 && allCandidates[0].score >= MINIMUM_SCORE_THRESHOLD
    ? allCandidates[0]
    : null;

  return {
    winner,
    allCandidates,
    searchQuery,
    totalCandidates: candidates.length,
    passedFilter,
    fetchedSuccessfully: scoredInputs.length,
  };
}

export { extractContacts };
