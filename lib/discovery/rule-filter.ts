import { normalizeCompanyName, normalizeKeyword } from "./normalize";
import type {
  DiscoveryEvidence,
  DiscoveryRuleFilterInput,
  DiscoveryRuleFilterResult,
} from "./types";

const UNCERTAIN_SOURCE_SIGNALS = [
  "blog article",
  "article about",
  "directory",
  "directory page",
  "marketplace",
  "marketplace category",
  "review article",
  "research article",
  "social profile",
  "news about",
  "news page",
  "affiliate guide",
  "retailer carries",
  "retailer sells",
  "retail store carries",
  "distributor",
  "distributor sells",
  "ownership is unclear",
  "brand ownership is unclear",
  "consulting firm",
  "interior design studio",
  "industry association",
  "association page",
  "veterinary clinic",
  "influencer page",
];

/** B2B 场景加权信号：进口商/批发商/分销商特征 */
const B2B_WEIGHTED_WORDS: Array<{ word: string; weight: number }> = [
  { word: "import", weight: 15 },
  { word: "importer", weight: 15 },
  { word: "importing", weight: 15 },
  { word: "wholesale", weight: 15 },
  { word: "wholesaler", weight: 15 },
  { word: "distributor", weight: 14 },
  { word: "distribution", weight: 12 },
  { word: "OEM", weight: 14 },
  { word: "ODM", weight: 14 },
  { word: "procurement", weight: 12 },
  { word: "purchasing", weight: 10 },
  { word: "sourcing", weight: 12 },
  { word: "supplier", weight: 10 },
  { word: "vendor", weight: 10 },
  { word: "export", weight: 8 },
  { word: "international", weight: 6 },
  { word: "global sourcing", weight: 14 },
  { word: "trade", weight: 6 },
  { word: "bulk", weight: 8 },
  { word: "volume", weight: 6 },
  { word: "manufacturer", weight: 6 },
  { word: "factory", weight: 4 },
  { word: "multi language", weight: 8 },
];

/** B2C/DTC 场景加权信号：品牌/零售商特征 */
const B2C_WEIGHTED_WORDS: Array<{ word: string; weight: number }> = [
  { word: "brand", weight: 12 },
  { word: "brands", weight: 12 },
  { word: "shop", weight: 10 },
  { word: "store", weight: 10 },
  { word: "online shop", weight: 10 },
  { word: "DTC", weight: 12 },
  { word: "direct to consumer", weight: 12 },
  { word: "boutique", weight: 6 },
  { word: "retail", weight: 8 },
  { word: "retailer", weight: 8 },
  { word: "ecommerce", weight: 8 },
  { word: "e-commerce", weight: 8 },
  { word: "subscribe", weight: 4 },
  { word: "lifestyle", weight: 4 },
];

export function runRuleFilter({
  candidate,
  icpProfile,
  ruleVariant,
  discoveryMode,
}: DiscoveryRuleFilterInput): DiscoveryRuleFilterResult {
  const activeVariant = resolveRuleVariant(ruleVariant);
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
  if (activeVariant === "B") {
    ruleScore -= scoreUncertainSourceSignals(searchableText, rejectReasons, evidence);
  }

  // B2B/B2C 场景加权信号
  const mode = discoveryMode || "mixed";
  if (mode === "b2b" || mode === "mixed") {
    ruleScore += scoreScenarioSignals(searchableText, B2B_WEIGHTED_WORDS, matchedRules, evidence, "b2b");
  }
  if (mode === "b2c" || mode === "mixed") {
    ruleScore += scoreScenarioSignals(searchableText, B2C_WEIGHTED_WORDS, matchedRules, evidence, "b2c");
  }

  return {
    ruleScore: clampScore(ruleScore),
    matchedRules: dedupe(matchedRules),
    rejectReasons: dedupe(rejectReasons),
    evidence,
    hardReject,
  };
}

function resolveRuleVariant(ruleVariant?: DiscoveryRuleFilterInput["ruleVariant"]) {
  if (ruleVariant) return ruleVariant;
  return process.env.DISCOVERY_RULE_VARIANT === "A" ? "A" : "B";
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

function scoreUncertainSourceSignals(
  searchableText: string,
  rejectReasons: string[],
  evidence: DiscoveryEvidence[]
) {
  return UNCERTAIN_SOURCE_SIGNALS.reduce((score, signal) => {
    if (!containsKeyword(searchableText, signal)) return score;
    const reason = `uncertain_source:${normalizeKeyword(signal)}`;
    rejectReasons.push(reason);
    pushEvidence(evidence, "source_quality", searchableText, signal, "source is not clearly an official target company site");
    return score + 40;
  }, 0);
}

/**
 * B2B/B2C 场景加权评分
 */
function scoreScenarioSignals(
  searchableText: string,
  weightedWords: Array<{ word: string; weight: number }>,
  matchedRules: string[],
  evidence: DiscoveryEvidence[],
  scenario: string
) {
  let score = 0;
  for (const { word, weight } of weightedWords) {
    if (!containsKeyword(searchableText, word)) continue;
    matchedRules.push(`${scenario}:${normalizeKeyword(word)}`);
    pushEvidence(evidence, scenario, searchableText, word, `matches ${scenario} scenario signal`);
    score += weight;
  }
  return score;
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
