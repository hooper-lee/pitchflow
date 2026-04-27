import type {
  EmailEvalSample,
  EmailEvalSampleResult,
  EmailVariant,
} from "./email-eval-types";
import { generateEvalEmail } from "./email-generator";
import { runEmailQa } from "./email-qa";

export interface EmailEvalReport {
  variant: EmailVariant;
  totalSamples: number;
  passCount: number;
  needsReviewCount: number;
  blockCount: number;
  passRate: number;
  avgFactualityScore: number;
  avgPersonalizationScore: number;
  avgDeliverabilityScore: number;
  avgSpamRiskScore: number;
  avgCtaClarityScore: number;
  byScenario: Record<string, EmailScenarioSummary>;
  byIndustry: Record<string, EmailIndustrySummary>;
  highRiskExamples: EmailEvalSampleResult[];
}

export interface EmailScenarioSummary {
  totalSamples: number;
  passCount: number;
  needsReviewCount: number;
  blockCount: number;
}

export interface EmailIndustrySummary {
  totalSamples: number;
  passCount: number;
  needsReviewCount: number;
  blockCount: number;
}

export function evaluateEmailVariant(
  samples: EmailEvalSample[],
  variant: EmailVariant
): EmailEvalReport {
  const results = samples.map((sample) => evaluateSample(sample, variant));
  return summarizeResults(variant, results);
}

export function evaluateEmailAB(samples: EmailEvalSample[]) {
  const variantA = evaluateEmailVariant(samples, "A");
  const variantB = evaluateEmailVariant(samples, "B");
  return {
    variants: {
      A: variantA,
      B: variantB,
    },
    delta: {
      passRate: diff(variantA.passRate, variantB.passRate),
      factualityScore: diff(variantA.avgFactualityScore, variantB.avgFactualityScore),
      personalizationScore: diff(
        variantA.avgPersonalizationScore,
        variantB.avgPersonalizationScore
      ),
      deliverabilityScore: diff(
        variantA.avgDeliverabilityScore,
        variantB.avgDeliverabilityScore
      ),
      spamRiskScore: diff(variantA.avgSpamRiskScore, variantB.avgSpamRiskScore),
      ctaClarityScore: diff(variantA.avgCtaClarityScore, variantB.avgCtaClarityScore),
    },
  };
}

function evaluateSample(
  sample: EmailEvalSample,
  variant: EmailVariant
): EmailEvalSampleResult {
  const email = generateEvalEmail(sample, variant);
  const qa = runEmailQa(sample, email);
  return {
    id: sample.id,
    scenario: sample.scenario,
    industry: sample.industry,
    variant,
    subject: email.subject,
    body: email.body,
    qa,
  };
}

function summarizeResults(
  variant: EmailVariant,
  results: EmailEvalSampleResult[]
): EmailEvalReport {
  return {
    variant,
    totalSamples: results.length,
    passCount: countByDecision(results, "pass"),
    needsReviewCount: countByDecision(results, "needs_review"),
    blockCount: countByDecision(results, "block"),
    passRate: ratio(countByDecision(results, "pass"), results.length),
    avgFactualityScore: average(results.map((result) => result.qa.factualityScore)),
    avgPersonalizationScore: average(results.map((result) => result.qa.personalizationScore)),
    avgDeliverabilityScore: average(results.map((result) => result.qa.deliverabilityScore)),
    avgSpamRiskScore: average(results.map((result) => result.qa.spamRiskScore)),
    avgCtaClarityScore: average(results.map((result) => result.qa.ctaClarityScore)),
    byScenario: summarizeBy(results, (result) => result.scenario),
    byIndustry: summarizeBy(results, (result) => result.industry),
    highRiskExamples: results
      .filter((result) => result.qa.finalDecision === "block")
      .slice(0, 20),
  };
}

function summarizeBy(
  results: EmailEvalSampleResult[],
  keySelector: (result: EmailEvalSampleResult) => string
) {
  return results.reduce<Record<string, EmailScenarioSummary>>((bucket, result) => {
    const key = keySelector(result);
    const current = bucket[key] || {
      totalSamples: 0,
      passCount: 0,
      needsReviewCount: 0,
      blockCount: 0,
    };
    current.totalSamples += 1;
    if (result.qa.finalDecision === "pass") current.passCount += 1;
    if (result.qa.finalDecision === "needs_review") current.needsReviewCount += 1;
    if (result.qa.finalDecision === "block") current.blockCount += 1;
    bucket[key] = current;
    return bucket;
  }, {});
}

function countByDecision(
  results: EmailEvalSampleResult[],
  decision: EmailEvalSampleResult["qa"]["finalDecision"]
) {
  return results.filter((result) => result.qa.finalDecision === decision).length;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(3));
}

function diff(left: number, right: number) {
  return Number((right - left).toFixed(3));
}
