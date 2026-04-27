import type {
  EmailEvalSample,
  EmailQaResult,
  GeneratedEvalEmail,
} from "./email-eval-types";

const UNSAFE_CLAIMS = [
  "fda approved",
  "certified",
  "guaranteed",
  "cures",
  "prevents",
  "medical grade",
  "military grade",
  "zero defect",
  "zero failure",
  "as we discussed on the phone",
  "founded in 1998",
];

const SPAM_SIGNALS = [
  "guaranteed lowest price",
  "limited time",
  "act now",
  "free!!!",
  "risk-free",
  "best quality",
];

export function runEmailQa(
  sample: EmailEvalSample,
  email: GeneratedEvalEmail
): EmailQaResult {
  const combinedText = `${email.subject}\n${email.body}`;
  const normalizedText = combinedText.toLowerCase();
  const wordCount = countWords(email.body);
  const forbiddenClaims = findHits(sample.mustNotInclude, normalizedText);
  const unsafeClaims = findHits(UNSAFE_CLAIMS, normalizedText);
  const missingRequiredElements = findMissing(sample.expectedMustInclude, normalizedText);
  const spamHits = findHits(SPAM_SIGNALS, normalizedText);
  const hallucinationRisks = buildHallucinationRisks(forbiddenClaims, unsafeClaims);
  const factualityScore = clampScore(100 - forbiddenClaims.length * 35 - unsafeClaims.length * 30);
  const personalizationScore = calculatePersonalizationScore(sample, normalizedText);
  const deliverabilityScore = calculateDeliverabilityScore(wordCount, sample.maxWords, spamHits.length);
  const spamRiskScore = clampScore(spamHits.length * 25 + Math.max(0, wordCount - sample.maxWords));
  const toneScore = calculateToneScore(normalizedText);
  const ctaClarityScore = calculateCtaClarityScore(normalizedText);
  const replyUnderstandingScore = calculateReplyUnderstandingScore(sample, normalizedText);
  const finalDecision = resolveFinalDecision({
    factualityScore,
    personalizationScore,
    deliverabilityScore,
    spamRiskScore,
    ctaClarityScore,
    replyUnderstandingScore,
    forbiddenClaims,
    unsafeClaims,
    missingRequiredElements,
    requiresHumanReview: sample.requiresHumanReview,
  });

  return {
    factualityScore,
    personalizationScore,
    deliverabilityScore,
    spamRiskScore,
    toneScore,
    ctaClarityScore,
    replyUnderstandingScore,
    wordCount,
    hallucinationRisks,
    missingRequiredElements,
    forbiddenClaims,
    unsafeClaims,
    finalDecision,
  };
}

function findHits(terms: string[], normalizedText: string) {
  return terms.filter((term) => normalizedText.includes(term.toLowerCase()));
}

function findMissing(terms: string[], normalizedText: string) {
  return terms.filter((term) => !normalizedText.includes(term.toLowerCase()));
}

function buildHallucinationRisks(forbiddenClaims: string[], unsafeClaims: string[]) {
  return [...forbiddenClaims, ...unsafeClaims].map((claim) => `Unsupported claim: ${claim}`);
}

function calculatePersonalizationScore(sample: EmailEvalSample, normalizedText: string) {
  const requiredPersonalSignals = [
    sample.prospect.companyName,
    sample.prospect.contactName,
    sample.prospect.industry,
    sample.productProfile.productName,
  ];
  const hitCount = findHits(requiredPersonalSignals, normalizedText).length;
  return Math.round((hitCount / requiredPersonalSignals.length) * 100);
}

function calculateDeliverabilityScore(
  wordCount: number,
  maxWords: number,
  spamSignalCount: number
) {
  const lengthPenalty = Math.max(0, wordCount - maxWords);
  return clampScore(100 - lengthPenalty * 2 - spamSignalCount * 20);
}

function calculateToneScore(normalizedText: string) {
  const pressureSignals = ["must", "urgent", "last chance", "do not miss"];
  return clampScore(100 - findHits(pressureSignals, normalizedText).length * 25);
}

function calculateCtaClarityScore(normalizedText: string) {
  const ctaSignals = ["would", "could", "should", "reply", "send", "share"];
  return findHits(ctaSignals, normalizedText).length > 0 ? 90 : 40;
}

function calculateReplyUnderstandingScore(sample: EmailEvalSample, normalizedText: string) {
  if (!sample.reply) return null;
  const replyTerms = sample.reply.body
    .split(/[^a-zA-Z]+/)
    .filter((word) => word.length > 3)
    .slice(0, 5);
  const hitCount = findHits(replyTerms, normalizedText).length;
  return clampScore(60 + hitCount * 10);
}

function resolveFinalDecision(input: {
  factualityScore: number;
  personalizationScore: number;
  deliverabilityScore: number;
  spamRiskScore: number;
  ctaClarityScore: number;
  replyUnderstandingScore: number | null;
  forbiddenClaims: string[];
  unsafeClaims: string[];
  missingRequiredElements: string[];
  requiresHumanReview: boolean;
}) {
  if (input.forbiddenClaims.length > 0 || input.unsafeClaims.length > 0) return "block";
  if (input.factualityScore < 90 || input.spamRiskScore > 25) return "block";
  if (input.requiresHumanReview) return "needs_review";
  if (input.personalizationScore < 70) return "needs_review";
  if (input.deliverabilityScore < 75 || input.ctaClarityScore < 75) return "needs_review";
  if (input.missingRequiredElements.length > 1) return "needs_review";
  if (input.replyUnderstandingScore !== null && input.replyUnderstandingScore < 90) return "needs_review";
  return "pass";
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
