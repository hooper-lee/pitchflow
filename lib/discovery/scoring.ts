import type {
  DiscoveryAiClassifyOutput,
  DiscoveryDecisionResult,
  DiscoveryIcpProfile,
  DiscoveryRuleFilterResult,
} from "./types";

const DEFAULT_WEIGHTS = {
  detectorScore: 0.2,
  ruleScore: 0.25,
  aiScore: 0.4,
  feedbackScore: 0.15,
};

export function calculateDiscoveryDecision(input: {
  detectorScore: number;
  ruleResult: DiscoveryRuleFilterResult;
  aiResult?: DiscoveryAiClassifyOutput | null;
  feedbackScore: number;
  icpProfile: DiscoveryIcpProfile;
  blocked: boolean;
}): DiscoveryDecisionResult {
  if (input.blocked) return toDecisionResult(-100, "blacklisted", input.feedbackScore);
  if (input.ruleResult.hardReject) return toDecisionResult(0, "rejected", input.feedbackScore);

  const finalScore = calculateFinalScore(input);
  if (finalScore >= input.icpProfile.minScoreToSave) {
    return toDecisionResult(finalScore, "accepted", input.feedbackScore);
  }
  if (finalScore >= input.icpProfile.minScoreToReview) {
    return toDecisionResult(finalScore, "needs_review", input.feedbackScore);
  }
  return toDecisionResult(finalScore, "rejected", input.feedbackScore);
}

export function calculateFinalScore(input: {
  detectorScore: number;
  ruleResult: DiscoveryRuleFilterResult;
  aiResult?: DiscoveryAiClassifyOutput | null;
  feedbackScore: number;
  icpProfile?: DiscoveryIcpProfile;
}) {
  if (!input.aiResult) {
    return clampScore(
      input.detectorScore * 0.35 +
        input.ruleResult.ruleScore * 0.5 +
        input.feedbackScore * 0.15
    );
  }

  const aiScore = computeAiScore(input.aiResult);
  const weights = normalizeWeights(input.icpProfile?.scoreWeights);
  return clampScore(
    input.detectorScore * weights.detectorScore +
      input.ruleResult.ruleScore * weights.ruleScore +
      aiScore * weights.aiScore +
      input.feedbackScore * weights.feedbackScore
  );
}

export function computeAiScore(aiResult: DiscoveryAiClassifyOutput) {
  const positiveScore =
    aiResult.scores.businessModelFit * 0.35 +
    aiResult.scores.productFit * 0.35 +
    aiResult.scores.salesModelFit * 0.2 +
    (100 - aiResult.scores.exclusionRisk) * 0.1;

  if (aiResult.recommendedDecision === "rejected") return clampScore(positiveScore * 0.6);
  if (aiResult.recommendedDecision === "needs_review") return clampScore(positiveScore * 0.8);
  return clampScore(positiveScore);
}

function toDecisionResult(
  finalScore: number,
  decision: DiscoveryDecisionResult["decision"],
  feedbackScore: number
): DiscoveryDecisionResult {
  return { finalScore, decision, feedbackScore };
}

function normalizeWeights(rawWeights?: Partial<Record<string, number>>) {
  const mergedWeights = {
    detectorScore: rawWeights?.detectorScore ?? DEFAULT_WEIGHTS.detectorScore * 100,
    ruleScore: rawWeights?.ruleScore ?? DEFAULT_WEIGHTS.ruleScore * 100,
    aiScore: rawWeights?.aiScore ?? DEFAULT_WEIGHTS.aiScore * 100,
    feedbackScore: rawWeights?.feedbackScore ?? DEFAULT_WEIGHTS.feedbackScore * 100,
  };
  const totalWeight = Object.values(mergedWeights).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return DEFAULT_WEIGHTS;
  return {
    detectorScore: mergedWeights.detectorScore / totalWeight,
    ruleScore: mergedWeights.ruleScore / totalWeight,
    aiScore: mergedWeights.aiScore / totalWeight,
    feedbackScore: mergedWeights.feedbackScore / totalWeight,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
