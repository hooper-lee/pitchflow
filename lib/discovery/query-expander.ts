import { normalizeKeyword } from "./normalize";
import type { DiscoveryIcpProfile, DiscoveryJobRecord } from "./types";
import type { DiscoveryExpandedQuery, DiscoveryQueryIntent } from "./search/types";

const ENGLISH_HINTS = ["official site", "brand", "store"];
const CHINESE_HINTS = ["品牌", "官网", "独立站"];
const MAX_EXPANDED_QUERIES = 12;

export function buildDiscoveryQueries(
  job: Pick<DiscoveryJobRecord, "industry" | "country" | "keywords" | "inputQuery">,
  icpProfile: Pick<
    DiscoveryIcpProfile,
    "industry" | "positiveKeywords" | "productCategories" | "salesModel" | "mustHave"
  >
): DiscoveryExpandedQuery[] {
  const baseTerms = collectBaseTerms(job, icpProfile);
  const geoTerms = collectGeoTerms(job);
  const hintTerms = hasChinese(baseTerms.join(" ")) ? CHINESE_HINTS : ENGLISH_HINTS;
  const productTerms = collectProductTerms(icpProfile, baseTerms);
  const intentQueries = buildIntentQueries(baseTerms, geoTerms, hintTerms, productTerms, icpProfile);
  return dedupeQueries(intentQueries).slice(0, MAX_EXPANDED_QUERIES);
}

export function buildDiscoveryQueryStrings(
  job: Pick<DiscoveryJobRecord, "industry" | "country" | "keywords" | "inputQuery">,
  icpProfile: Pick<
    DiscoveryIcpProfile,
    "industry" | "positiveKeywords" | "productCategories" | "salesModel" | "mustHave"
  >
) {
  return buildDiscoveryQueries(job, icpProfile).map((item) => item.query);
}

function collectBaseTerms(
  job: Pick<DiscoveryJobRecord, "industry" | "keywords" | "inputQuery">,
  icpProfile: Pick<DiscoveryIcpProfile, "industry" | "positiveKeywords">
) {
  return [
    ...(job.keywords || []),
    job.industry || "",
    icpProfile.industry || "",
    ...(icpProfile.positiveKeywords || []).slice(0, 4),
    job.inputQuery || "",
  ]
    .map(normalizeKeyword)
    .filter(Boolean);
}

function collectGeoTerms(job: Pick<DiscoveryJobRecord, "country">) {
  return [normalizeKeyword(job.country || "")].filter(Boolean);
}

function collectProductTerms(
  icpProfile: Pick<DiscoveryIcpProfile, "productCategories" | "positiveKeywords">,
  baseTerms: string[]
) {
  return [
    ...(icpProfile.productCategories || []),
    ...(icpProfile.positiveKeywords || []),
    ...baseTerms,
  ]
    .map(normalizeKeyword)
    .filter(Boolean)
    .slice(0, 5);
}

function buildIntentQueries(
  baseTerms: string[],
  geoTerms: string[],
  hintTerms: string[],
  productTerms: string[],
  icpProfile: Pick<DiscoveryIcpProfile, "industry" | "salesModel" | "mustHave" | "positiveKeywords">
) {
  const queries: DiscoveryExpandedQuery[] = [];
  addProductQueries(queries, productTerms, geoTerms, icpProfile.industry);
  addBrandQueries(queries, productTerms, geoTerms, icpProfile.industry);
  addDtcQueries(queries, productTerms, geoTerms, icpProfile);
  addOfficialSiteQueries(queries, productTerms, geoTerms, hintTerms);
  addPlatformQueries(queries, productTerms);
  addProblemSceneQueries(queries, icpProfile.mustHave || [], icpProfile.positiveKeywords || []);
  addQuery(queries, "broad", mergeParts([...baseTerms.slice(0, 2), ...geoTerms, hintTerms[0]]), 70);
  return queries;
}

function addProductQueries(
  queries: DiscoveryExpandedQuery[],
  productTerms: string[],
  geoTerms: string[],
  industry?: string | null
) {
  const industryTerm = normalizeKeyword(industry || "");
  for (const term of productTerms.slice(0, 2)) {
    addQuery(queries, "product", mergeParts([term, appendIndustry(term, industryTerm), ...geoTerms, "brand"]), 100);
    addQuery(queries, "product", mergeParts([term, ...geoTerms, "store"]), 95);
  }
}

function addBrandQueries(
  queries: DiscoveryExpandedQuery[],
  productTerms: string[],
  geoTerms: string[],
  industry?: string | null
) {
  const industryTerm = normalizeKeyword(industry || "");
  addQuery(queries, "brand", mergeParts([productTerms[0], "brand official site"]), 90);
  addQuery(queries, "brand", mergeParts([industryTerm, "home brand", ...geoTerms]), 82);
}

function addDtcQueries(
  queries: DiscoveryExpandedQuery[],
  productTerms: string[],
  geoTerms: string[],
  icpProfile: Pick<DiscoveryIcpProfile, "salesModel" | "positiveKeywords">
) {
  if (!hasDtcSignal(icpProfile)) return;
  addQuery(queries, "dtc", mergeParts(["DTC", productTerms[0], "brand", ...geoTerms]), 88);
  addQuery(queries, "dtc", mergeParts(["direct to consumer", productTerms[1] || productTerms[0], "brand"]), 84);
}

function addOfficialSiteQueries(
  queries: DiscoveryExpandedQuery[],
  productTerms: string[],
  geoTerms: string[],
  hintTerms: string[]
) {
  addQuery(queries, "official_site", mergeParts([productTerms[0], ...geoTerms, hintTerms[0]]), 86);
  addQuery(queries, "official_site", mergeParts([productTerms[1] || productTerms[0], "brand website"]), 80);
}

function addPlatformQueries(queries: DiscoveryExpandedQuery[], productTerms: string[]) {
  addQuery(queries, "platform", mergeParts(["Shopify", productTerms[0], "brand"]), 76);
  addQuery(queries, "platform", mergeParts(["WooCommerce", productTerms[1] || productTerms[0], "store"]), 72);
}

function addProblemSceneQueries(
  queries: DiscoveryExpandedQuery[],
  mustHave: string[],
  positiveKeywords: string[]
) {
  const sceneTerms = [...mustHave, ...positiveKeywords]
    .map(normalizeKeyword)
    .filter((term) => term.split(" ").length <= 4)
    .slice(0, 2);
  for (const sceneTerm of sceneTerms) {
    addQuery(queries, "problem_scene", mergeParts([sceneTerm, "brand"]), 68);
  }
}

function addQuery(
  queries: DiscoveryExpandedQuery[],
  intent: DiscoveryQueryIntent,
  query: string,
  priority: number
) {
  if (!query) return;
  queries.push({ query, intent, priority });
}

function hasDtcSignal(icpProfile: Pick<DiscoveryIcpProfile, "salesModel" | "positiveKeywords">) {
  const text = normalizeKeyword(`${icpProfile.salesModel || ""} ${(icpProfile.positiveKeywords || []).join(" ")}`);
  return ["dtc", "b2c", "direct to consumer", "direct-to-consumer"].some((signal) => text.includes(signal));
}

function appendIndustry(term: string, industryTerm: string) {
  if (!industryTerm || term.includes(industryTerm)) return "";
  return industryTerm;
}

function dedupeQueries(queries: DiscoveryExpandedQuery[]) {
  const seenQueries = new Set<string>();
  return queries
    .sort((left, right) => right.priority - left.priority)
    .filter((item) => {
      const normalizedQuery = item.query.toLowerCase().replace(/\s+/g, " ").trim();
      if (!normalizedQuery || seenQueries.has(normalizedQuery)) return false;
      seenQueries.add(normalizedQuery);
      return true;
    });
}

function mergeParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}
