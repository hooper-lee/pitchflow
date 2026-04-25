import { getRootDomain, normalizeKeyword } from "@/lib/discovery/normalize";
import type { DiscoveryIcpProfile } from "@/lib/discovery/types";
import type { DiscoverySearchResult } from "./types";

const MARKETPLACE_DOMAINS = ["amazon.", "alibaba.", "ebay.", "made-in-china.", "1688."];
const SOCIAL_DOMAINS = ["linkedin.", "instagram.", "facebook.", "tiktok.", "pinterest.", "twitter.", "x.com"];
const DIRECTORY_DOMAINS = ["yellowpages.", "crunchbase.", "glassdoor.", "indeed.", "yelp."];
const MEDIA_HINTS = ["news", "blog", "article", "review", "press"];
const OFFICIAL_HINTS = ["official", "brand", "store", "shop", "website"];
const HIGH_INTENTS = new Set(["product", "brand", "dtc", "official_site"]);

export interface SourceQualityInput {
  result: DiscoverySearchResult;
  icpProfile?: Pick<
    DiscoveryIcpProfile,
    "positiveKeywords" | "negativeKeywords" | "productCategories" | "mustNotHave"
  > | null;
  intentHits?: number;
}

export function scoreDiscoverySource(input: SourceQualityInput) {
  const searchableText = buildSearchableText(input.result);
  const rootDomain = getRootDomain(input.result.link) || "";
  let score = 50;

  score += scorePositiveSignals(input.result, searchableText, input.icpProfile, input.intentHits || 1);
  score -= scoreNegativeSignals(rootDomain, input.result.link, searchableText, input.icpProfile);

  return clampScore(score);
}

export function classifySourcePollution(result: DiscoverySearchResult) {
  const rootDomain = getRootDomain(result.link) || "";
  const text = buildSearchableText(result);
  return {
    isMarketplace: includesAny(rootDomain, MARKETPLACE_DOMAINS),
    isSocialOnly: includesAny(rootDomain, SOCIAL_DOMAINS),
    isDirectory: includesAny(rootDomain, DIRECTORY_DOMAINS),
    isMediaArticle: includesAny(text, MEDIA_HINTS) || pathDepth(result.link) >= 4,
  };
}

function scorePositiveSignals(
  result: DiscoverySearchResult,
  searchableText: string,
  icpProfile: SourceQualityInput["icpProfile"],
  intentHits: number
) {
  let score = 0;
  if (includesAny(searchableText, OFFICIAL_HINTS)) score += 10;
  if (HIGH_INTENTS.has(result.queryIntent)) score += 10;
  if (pathDepth(result.link) <= 1) score += 8;
  if (intentHits > 1) score += Math.min(intentHits * 4, 12);
  score += scoreKeywordHits(searchableText, icpProfile?.positiveKeywords || [], 2);
  score += scoreKeywordHits(searchableText, icpProfile?.productCategories || [], 3);
  return score;
}

function scoreNegativeSignals(
  rootDomain: string,
  link: string,
  searchableText: string,
  icpProfile: SourceQualityInput["icpProfile"]
) {
  let score = 0;
  if (includesAny(rootDomain, MARKETPLACE_DOMAINS)) score += 35;
  if (includesAny(rootDomain, SOCIAL_DOMAINS)) score += 25;
  if (includesAny(rootDomain, DIRECTORY_DOMAINS)) score += 20;
  if (includesAny(searchableText, MEDIA_HINTS)) score += 10;
  if (pathDepth(link) >= 4) score += 8;
  score += scoreKeywordHits(searchableText, icpProfile?.negativeKeywords || [], 4);
  score += scoreKeywordHits(searchableText, icpProfile?.mustNotHave || [], 4);
  return score;
}

function buildSearchableText(result: DiscoverySearchResult) {
  return normalizeKeyword(`${result.title} ${result.snippet} ${result.link}`);
}

function scoreKeywordHits(text: string, keywords: string[], weight: number) {
  return keywords.reduce((sum, keyword) => {
    const normalizedKeyword = normalizeKeyword(keyword);
    return normalizedKeyword && text.includes(normalizedKeyword) ? sum + weight : sum;
  }, 0);
}

function includesAny(value: string, hints: string[]) {
  return hints.some((hint) => value.includes(hint));
}

function pathDepth(link: string) {
  try {
    return new URL(link).pathname.split("/").filter(Boolean).length;
  } catch {
    return 5;
  }
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
