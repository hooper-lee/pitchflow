import { normalizeKeyword } from "./normalize";
import type { DiscoveryIcpProfile, DiscoveryJobRecord } from "./types";

const ENGLISH_HINTS = ["official site", "brand", "store"];
const CHINESE_HINTS = ["品牌", "官网", "独立站"];

export function buildDiscoveryQueries(
  job: Pick<DiscoveryJobRecord, "industry" | "country" | "keywords" | "inputQuery">,
  icpProfile: Pick<DiscoveryIcpProfile, "industry" | "positiveKeywords">
): string[] {
  const baseTerms = collectBaseTerms(job, icpProfile);
  const geoTerms = collectGeoTerms(job);
  const hintTerms = hasChinese(baseTerms.join(" ")) ? CHINESE_HINTS : ENGLISH_HINTS;
  return dedupeQueries(expandQueries(baseTerms, geoTerms, hintTerms)).slice(0, 8);
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

function expandQueries(baseTerms: string[], geoTerms: string[], hintTerms: string[]) {
  const baseQuery = mergeParts(baseTerms.slice(0, 3));
  const broadQuery = mergeParts([...baseTerms.slice(0, 2), ...geoTerms, hintTerms[0]]);
  const intentQuery = mergeParts([...baseTerms.slice(0, 2), ...geoTerms, ...hintTerms.slice(0, 2)]);
  const keywordVariants = baseTerms.slice(0, 3).map((term) =>
    mergeParts([term, ...geoTerms, hintTerms[0]])
  );
  return [baseQuery, broadQuery, intentQuery, ...keywordVariants].filter(Boolean);
}

function dedupeQueries(queries: string[]) {
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

function mergeParts(parts: string[]) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}
