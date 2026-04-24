import { normalizeCompanyName, normalizeKeyword } from "./normalize";
import type {
  DiscoveryEvidence,
  DiscoveryRuleFilterInput,
  DiscoveryRuleFilterResult,
} from "./types";

export function runRuleFilter({
  candidate,
  icpProfile,
}: DiscoveryRuleFilterInput): DiscoveryRuleFilterResult {
  const searchableText = buildSearchableText(candidate);
  const matchedRules: string[] = [];
  const rejectReasons: string[] = [];
  const evidence: DiscoveryEvidence[] = [];
  let ruleScore = 50;
  let hardReject = false;

  ruleScore += scoreKeywordHits(icpProfile.positiveKeywords, searchableText, matchedRules, evidence, 8);
  ruleScore -= scoreKeywordHits(icpProfile.negativeKeywords, searchableText, rejectReasons, evidence, 10);
  ruleScore += scoreMustHave(icpProfile.mustHave, searchableText, matchedRules, evidence);
  hardReject = scoreMustNotHave(icpProfile.mustNotHave, searchableText, rejectReasons, evidence);
  ruleScore += scoreProductCategories(icpProfile.productCategories, searchableText, matchedRules, evidence);

  return {
    ruleScore: clampScore(ruleScore),
    matchedRules: dedupe(matchedRules),
    rejectReasons: dedupe(rejectReasons),
    evidence,
    hardReject,
  };
}

function buildSearchableText(input: DiscoveryRuleFilterInput["candidate"]) {
  return [
    input.companyName || "",
    input.domain,
    input.title,
    input.snippet,
    input.rawText,
    input.pagesFetched.map((page) => `${page.type} ${page.text}`).join("\n"),
  ]
    .join("\n")
    .toLowerCase();
}

function scoreKeywordHits(
  keywords: string[],
  searchableText: string,
  bucket: string[],
  evidence: DiscoveryEvidence[],
  delta: number
) {
  return keywords.reduce((score, keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || !containsKeyword(searchableText, normalized)) return score;
    bucket.push(normalized);
    pushEvidence(evidence, "rule", searchableText, normalized, `matched keyword: ${normalized}`);
    return score + delta;
  }, 0);
}

function scoreMustHave(
  keywords: string[],
  searchableText: string,
  matchedRules: string[],
  evidence: DiscoveryEvidence[]
) {
  return keywords.reduce((score, keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || !containsKeyword(searchableText, normalized)) return score;
    matchedRules.push(`must_have:${normalized}`);
    pushEvidence(evidence, "rule", searchableText, normalized, "matches must-have signal");
    return score + 12;
  }, 0);
}

function scoreMustNotHave(
  keywords: string[],
  searchableText: string,
  rejectReasons: string[],
  evidence: DiscoveryEvidence[]
) {
  return keywords.some((keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || !containsKeyword(searchableText, normalized)) return false;
    if (isNegated(searchableText, normalized)) return false;
    rejectReasons.push(`must_not_have:${normalized}`);
    pushEvidence(evidence, "rule", searchableText, normalized, "matches must-not-have signal");
    return true;
  });
}

function scoreProductCategories(
  categories: string[],
  searchableText: string,
  matchedRules: string[],
  evidence: DiscoveryEvidence[]
) {
  return categories.reduce((score, category) => {
    const normalized = normalizeKeyword(category);
    if (!normalized || !containsKeyword(searchableText, normalized)) return score;
    matchedRules.push(`product:${normalized}`);
    pushEvidence(evidence, "product", searchableText, normalized, "matches preferred category");
    return score + 6;
  }, 0);
}

function containsKeyword(searchableText: string, keyword: string) {
  return searchableText.includes(keyword.toLowerCase());
}

function isNegated(searchableText: string, keyword: string) {
  const pattern = new RegExp(`(?:not|no|non|without)\\s+[^\\n]{0,32}${escapeRegex(keyword)}`, "i");
  return pattern.test(searchableText);
}

function pushEvidence(
  evidence: DiscoveryEvidence[],
  source: string,
  searchableText: string,
  keyword: string,
  reason: string
) {
  const quote = extractQuote(searchableText, keyword);
  if (!quote) return;
  evidence.push({ source, quote, reason });
}

function extractQuote(searchableText: string, keyword: string) {
  const index = searchableText.indexOf(keyword.toLowerCase());
  if (index === -1) return "";
  const start = Math.max(0, index - 60);
  const end = Math.min(searchableText.length, index + keyword.length + 80);
  return searchableText.slice(start, end).replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupe(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeCompanyName(value) || value)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
