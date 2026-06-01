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
  discoveryMode?: "b2b" | "b2c" | "mixed";
}): DiscoveryDecisionResult {
  if (input.blocked) return toDecisionResult(-100, "blacklisted", input.feedbackScore);
  if (input.ruleResult.hardReject) return toDecisionResult(0, "rejected", input.feedbackScore);

  const finalScore = calculateFinalScore(input);
  const mode = input.discoveryMode || "mixed";

  // 按场景使用不同的阈值：B2B 场景更宽松，避免错过潜在客户
  const [minScoreToSave, minScoreToReview] = getThresholds(input.icpProfile, mode);

  if (hasUncertainSource(input.ruleResult) && finalScore >= minScoreToReview) {
    return toDecisionResult(finalScore, "needs_review", input.feedbackScore);
  }
  if (finalScore >= minScoreToSave) {
    return toDecisionResult(finalScore, "accepted", input.feedbackScore);
  }
  if (finalScore >= minScoreToReview) {
    return toDecisionResult(finalScore, "needs_review", input.feedbackScore);
  }
  return toDecisionResult(finalScore, "rejected", input.feedbackScore);
}

/**
 * 按场景获取评分阈值
 * B2B: 更宽松（外贸客户宁愿多审也不愿错过）
 * B2C: 标准阈值
 * mixed: 使用 ICP 默认值
 */
function getThresholds(
  icpProfile: DiscoveryIcpProfile,
  discoveryMode: "b2b" | "b2c" | "mixed"
): [number, number] {
  const defaultSave = icpProfile.minScoreToSave;
  const defaultReview = icpProfile.minScoreToReview;

  // 如果 ICP 已经自定义了阈值，优先使用
  if (defaultSave !== 80 || defaultReview !== 60) {
    return [defaultSave, defaultReview];
  }

  if (discoveryMode === "b2b") {
    return [Math.min(defaultSave, 70), Math.min(defaultReview, 50)];
  }

  return [defaultSave, defaultReview];
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

function hasUncertainSource(ruleResult: DiscoveryRuleFilterResult) {
  return ruleResult.rejectReasons.some(isUncertainSourceReason);
}

function isUncertainSourceReason(reason: string) {
  return reason.startsWith("uncertain_source") || reason.startsWith("uncertain source");
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
