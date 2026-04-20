import type { PageSignals, ScoredCandidate, ScoreWeights, SearchCandidate } from "./types";

interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
}

function scaleScore(raw: number, maxRaw: number, weight: number): number {
  if (maxRaw === 0) return 0;
  return Math.round((raw / maxRaw) * weight);
}

function scoreDomainQuality(s: PageSignals, weight: number): DimensionScore {
  let raw = 0;
  const maxRaw = 30;

  if (s.isDotCom) raw += 10;
  else if (s.domain.match(/\.(co|io|net|com\.cn|cn|de|co\.uk|fr|jp|kr)$/)) raw += 7;
  else raw += 3;

  if (s.pathDepth === 0) raw += 10;
  else if (s.pathDepth === 1) raw += 5;

  if (s.hasCleanPath) raw += 5;
  if (s.domain.length <= 15) raw += 5;

  return { dimension: "domainQuality", score: scaleScore(raw, maxRaw, weight), maxScore: weight };
}

function scoreContentSignals(s: PageSignals, weight: number): DimensionScore {
  let raw = 0;
  const maxRaw = 29;

  if (s.titleExactMatch) raw += 8;
  else if (s.titleHasCompanyName) raw += 5;

  if (s.metaDescriptionHasCompanyName) raw += 3;
  if (s.hasCompanyKeywords) raw += 4;
  if (s.hasProductKeywords) raw += 3;
  if (s.hasB2BKeywords) raw += 2;
  if (s.hasContactPage) raw += 2;
  if (s.hasAboutPage) raw += 2;

  return { dimension: "contentSignals", score: scaleScore(raw, maxRaw, weight), maxScore: weight };
}

function scoreNegativeSignals(s: PageSignals, weight: number): DimensionScore {
  let raw = weight;

  if (s.isBlog) raw -= 15;
  if (s.isNews) raw -= 15;
  if (s.isForum) raw -= 12;
  if (s.isMarketplace) raw -= 10;
  if (s.isSocialProfile) raw -= 20;
  if (s.isDirectory) raw -= 10;
  if (s.isJobSite) raw -= 8;
  if (s.isAcademic) raw -= 10;
  if (s.isEcommerce) raw -= 5;

  return { dimension: "negativeSignals", score: Math.max(0, Math.round(raw)), maxScore: weight };
}

function scoreNavigationSignals(s: PageSignals, weight: number): DimensionScore {
  let raw = 0;
  const maxRaw = 15;

  if (s.hasBusinessNavLinks) raw += 10;
  if (s.hasCompanySubdomain) raw += 5;

  return { dimension: "navigationSignals", score: scaleScore(raw, maxRaw, weight), maxScore: weight };
}

function scoreContactSignals(s: PageSignals, weight: number): DimensionScore {
  let raw = 0;
  const maxRaw = 10;

  if (s.emailsFound.length > 0) raw += 4;
  if (s.phonesFound.length > 0) raw += 3;
  if (s.addressesFound.length > 0) raw += 3;

  return { dimension: "contactSignals", score: scaleScore(raw, maxRaw, weight), maxScore: weight };
}

export function scoreCandidate(
  signals: PageSignals,
  weights: ScoreWeights
): { total: number; dimensionScores: Record<string, number>; breakdown: DimensionScore[] } {
  const breakdown: DimensionScore[] = [
    scoreDomainQuality(signals, weights.domainQuality),
    scoreContentSignals(signals, weights.contentSignals),
    scoreNegativeSignals(signals, weights.negativeSignals),
    scoreNavigationSignals(signals, weights.navigationSignals),
    scoreContactSignals(signals, weights.contactSignals),
  ];

  const dimensionScores: Record<string, number> = {};
  let total = 0;
  for (const d of breakdown) {
    dimensionScores[d.dimension] = d.score;
    total += d.score;
  }

  total = Math.max(0, Math.min(100, total));

  return { total, dimensionScores, breakdown };
}

export function rankCandidates(
  candidates: { signals: PageSignals; candidate: SearchCandidate }[],
  weights: ScoreWeights
): ScoredCandidate[] {
  const scored = candidates.map(({ signals, candidate }) => {
    const { total, dimensionScores } = scoreCandidate(signals, weights);
    return {
      candidate,
      signals,
      score: total,
      dimensionScores,
      rank: 0,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  scored.forEach((c, i) => {
    c.rank = i + 1;
  });

  return scored;
}
