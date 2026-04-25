import { runRuleFilter } from "@/lib/discovery/rule-filter";
import type {
  DiscoveryIcpProfile,
  DiscoveryNormalizedCandidate,
  DiscoveryRuleFilterResult,
} from "@/lib/discovery/types";

export interface GoldenSet {
  icpName: string;
  icpProfile: Partial<DiscoveryIcpProfile>;
  samples?: GoldenSample[];
}

export interface GoldenSample {
  url: string;
  label: "target" | "non_target" | "uncertain";
  reason?: string;
  text?: string;
}

export type RuleVariant = "A" | "B";

export interface IcpEvalSampleResult {
  url: string;
  expected: GoldenSample["label"];
  predicted: GoldenSample["label"];
  ruleScore: number;
  rejectReasons: string[];
  matchedRules: string[];
  errorCategory: string;
  correct: boolean;
}

export interface IcpEvalMetrics {
  acceptedPrecision: number;
  recall: number;
  rejectedAccuracy: number;
  uncertainRate: number;
  uncertainAccuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  falsePositiveExamples: IcpEvalSampleResult[];
  falseNegativeExamples: IcpEvalSampleResult[];
  uncertainMismatchExamples: IcpEvalSampleResult[];
  topErrorCategories: Record<string, number>;
}

export function evaluateGoldenSetAB(goldenSet: GoldenSet) {
  const variantA = evaluateGoldenSet(goldenSet, "A");
  const variantB = evaluateGoldenSet(goldenSet, "B");
  return {
    name: goldenSet.icpName,
    variants: {
      A: variantA.metrics,
      B: variantB.metrics,
    },
    delta: calculateMetricDelta(variantA.metrics, variantB.metrics),
  };
}

export function evaluateGoldenSet(goldenSet: GoldenSet, ruleVariant: RuleVariant) {
  const icpProfile = normalizeIcpProfile(goldenSet);
  const sampleResults = (goldenSet.samples || []).map((sample) =>
    evaluateSample(sample, icpProfile, ruleVariant)
  );
  return {
    name: goldenSet.icpName,
    ruleVariant,
    metrics: calculateClassifierMetrics(sampleResults),
    samples: sampleResults,
  };
}

export function resolveVariantFromEnv(): RuleVariant {
  return process.env.DISCOVERY_RULE_VARIANT === "A" ? "A" : "B";
}

function evaluateSample(
  sample: GoldenSample,
  icpProfile: DiscoveryIcpProfile,
  ruleVariant: RuleVariant
): IcpEvalSampleResult {
  const candidate = buildCandidate(sample);
  const ruleResult = runRuleFilter({ candidate, icpProfile, ruleVariant });
  const predictedLabel = resolvePredictedLabel(ruleResult);
  return {
    url: sample.url,
    expected: sample.label,
    predicted: predictedLabel,
    ruleScore: ruleResult.ruleScore,
    rejectReasons: ruleResult.rejectReasons,
    matchedRules: ruleResult.matchedRules,
    errorCategory: resolveErrorCategory(sample.label, predictedLabel, ruleResult),
    correct: predictedLabel === sample.label,
  };
}

function buildCandidate(sample: GoldenSample): DiscoveryNormalizedCandidate {
  return {
    title: sample.url,
    url: sample.url,
    finalUrl: sample.url,
    snippet: sample.reason || "",
    searchQuery: "",
    domain: sample.url,
    rootDomain: sample.url,
    source: "eval",
    companyName: null,
    detectorScore: 50,
    detectorDimensions: {},
    matchedRules: [],
    rejectReasons: [],
    evidence: [],
    pagesFetched: [{ type: "homepage", url: sample.url, text: sample.text || sample.reason || "" }],
    rawText: sample.text || sample.reason || "",
    contacts: {},
    ruleScore: 0,
    aiScore: null,
    feedbackScore: 0,
    finalScore: 0,
    decision: "pending",
    metadata: {},
  };
}

function resolvePredictedLabel(ruleResult: DiscoveryRuleFilterResult): GoldenSample["label"] {
  if (ruleResult.hardReject) return "non_target";
  if (ruleResult.rejectReasons.some(isUncertainSourceReason)) return "uncertain";
  if (ruleResult.ruleScore < 45) return "non_target";
  if (ruleResult.ruleScore < 65) return "uncertain";
  return "target";
}

function isUncertainSourceReason(reason: string) {
  return reason.startsWith("uncertain_source") || reason.startsWith("uncertain source");
}

function calculateClassifierMetrics(results: IcpEvalSampleResult[]): IcpEvalMetrics {
  const scoredResults = results.filter((item) => item.expected !== "uncertain");
  const stats = calculateConfusionStats(scoredResults);
  const uncertainExpected = results.filter((item) => item.expected === "uncertain");
  const uncertainCorrect = uncertainExpected.filter((item) => item.predicted === "uncertain").length;
  return {
    acceptedPrecision: ratio(stats.truePositive, stats.truePositive + stats.falsePositive),
    recall: ratio(stats.truePositive, stats.truePositive + stats.falseNegative),
    rejectedAccuracy: ratio(stats.trueNegative, stats.trueNegative + stats.falseNegative),
    uncertainRate: ratio(results.filter((item) => item.predicted === "uncertain").length, results.length),
    uncertainAccuracy: ratio(uncertainCorrect, uncertainExpected.length),
    falsePositiveRate: ratio(stats.falsePositive, stats.falsePositive + stats.trueNegative),
    falseNegativeRate: ratio(stats.falseNegative, stats.falseNegative + stats.truePositive),
    falsePositiveExamples: scoredResults.filter(isFalsePositive),
    falseNegativeExamples: scoredResults.filter(isFalseNegative),
    uncertainMismatchExamples: uncertainExpected.filter((item) => item.predicted !== "uncertain"),
    topErrorCategories: countCategories(results.filter((item) => !item.correct).map((item) => item.errorCategory)),
  };
}

function calculateConfusionStats(results: IcpEvalSampleResult[]) {
  return {
    truePositive: results.filter((item) => item.expected === "target" && item.predicted === "target").length,
    falsePositive: results.filter(isFalsePositive).length,
    trueNegative: results.filter((item) => item.expected === "non_target" && item.predicted === "non_target").length,
    falseNegative: results.filter(isFalseNegative).length,
  };
}

function isFalsePositive(item: IcpEvalSampleResult) {
  return item.expected === "non_target" && item.predicted === "target";
}

function isFalseNegative(item: IcpEvalSampleResult) {
  return item.expected === "target" && item.predicted === "non_target";
}

function resolveErrorCategory(
  expected: GoldenSample["label"],
  predicted: GoldenSample["label"],
  ruleResult: DiscoveryRuleFilterResult
) {
  if (expected === predicted) return "none";
  if (predicted === "uncertain") return "needs_more_evidence";
  if (ruleResult.rejectReasons.some((reason) => reason.includes("must not have"))) return "exclusion_keyword";
  if (ruleResult.matchedRules.length === 0) return "missing_positive_signal";
  if (expected === "non_target" && predicted === "target") return "weak_negative_filter";
  return "score_threshold";
}

function countCategories(categories: string[]) {
  return categories.reduce<Record<string, number>>((bucket, category) => {
    bucket[category] = (bucket[category] || 0) + 1;
    return bucket;
  }, {});
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

function calculateMetricDelta(metricsA: IcpEvalMetrics, metricsB: IcpEvalMetrics) {
  return {
    acceptedPrecision: diff(metricsA.acceptedPrecision, metricsB.acceptedPrecision),
    recall: diff(metricsA.recall, metricsB.recall),
    rejectedAccuracy: diff(metricsA.rejectedAccuracy, metricsB.rejectedAccuracy),
    uncertainAccuracy: diff(metricsA.uncertainAccuracy, metricsB.uncertainAccuracy),
    falsePositiveRate: diff(metricsA.falsePositiveRate, metricsB.falsePositiveRate),
    falseNegativeRate: diff(metricsA.falseNegativeRate, metricsB.falseNegativeRate),
  };
}

function diff(left: number, right: number) {
  return Number((right - left).toFixed(3));
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(3));
}
