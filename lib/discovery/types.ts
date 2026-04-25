export interface DiscoveryEvidence {
  source: string;
  quote: string;
  reason?: string;
}

export interface DiscoveryFetchedPage {
  type: "homepage" | "about" | "brand" | "product" | "faq" | "assembly";
  url: string;
  title?: string;
  text: string;
}

export interface DiscoveryScoreWeights {
  detectorScore: number;
  ruleScore: number;
  aiScore: number;
  feedbackScore: number;
}

export interface DiscoveryIcpProfile {
  id: string;
  tenantId: string;
  userId?: string | null;
  name: string;
  description?: string | null;
  industry?: string | null;
  targetCustomerText?: string | null;
  mustHave: string[];
  mustNotHave: string[];
  positiveKeywords: string[];
  negativeKeywords: string[];
  productCategories: string[];
  salesModel?: string | null;
  scoreWeights: Partial<Record<string, number>>;
  minScoreToSave: number;
  minScoreToReview: number;
  promptTemplate?: string | null;
}

export interface DiscoveryJobRecord {
  id: string;
  tenantId: string;
  userId?: string | null;
  icpProfileId?: string | null;
  name: string;
  status:
    | "pending"
    | "searching"
    | "crawling"
    | "filtering"
    | "scoring"
    | "reviewing"
    | "completed"
    | "failed"
    | "cancelled";
  industry?: string | null;
  country?: string | null;
  keywords: string[];
  inputQuery?: string | null;
  filters: Record<string, unknown>;
  targetLimit: number;
  searchedCount: number;
  crawledCount: number;
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  savedCount: number;
  progress: number;
}

export interface DiscoverySearchCandidate {
  title: string;
  link: string;
  snippet: string;
  searchQuery: string;
}

export interface DiscoveryNormalizedCandidate {
  title: string;
  url: string;
  finalUrl: string;
  snippet: string;
  searchQuery: string;
  domain: string;
  rootDomain: string;
  source: string;
  companyName: string | null;
  detectorScore: number;
  detectorDimensions: Record<string, number>;
  matchedRules: string[];
  rejectReasons: string[];
  evidence: DiscoveryEvidence[];
  pagesFetched: DiscoveryFetchedPage[];
  rawText: string;
  contacts: Record<string, unknown>;
  ruleScore: number;
  aiScore: number | null;
  feedbackScore: number;
  finalScore: number;
  decision:
    | "pending"
    | "accepted"
    | "rejected"
    | "needs_review"
    | "blacklisted"
    | "saved";
  metadata: Record<string, unknown>;
}

export interface DiscoveryRuleFilterInput {
  candidate: Pick<
    DiscoveryNormalizedCandidate,
    "title" | "snippet" | "companyName" | "domain" | "rootDomain"
  > & { rawText: string; pagesFetched: DiscoveryFetchedPage[] };
  icpProfile: DiscoveryIcpProfile;
  ruleVariant?: "A" | "B";
}

export interface DiscoveryRuleFilterResult {
  ruleScore: number;
  matchedRules: string[];
  rejectReasons: string[];
  evidence: DiscoveryEvidence[];
  hardReject: boolean;
}

export interface DiscoveryAiClassifyInput {
  companyName: string | null;
  domain: string;
  homepageText: string;
  aboutText: string;
  productText: string;
  faqText: string;
  searchSnippet: string;
  detectorScore: number;
  detectorDimensions: Record<string, number>;
  icpProfile: DiscoveryIcpProfile;
}

export interface DiscoveryAiClassifyOutput {
  isTargetCustomer: boolean;
  confidence: number;
  scores: {
    businessModelFit: number;
    productFit: number;
    salesModelFit: number;
    exclusionRisk: number;
  };
  matchedRequirements: string[];
  rejectionReasons: string[];
  evidence: DiscoveryEvidence[];
  recommendedDecision: "accepted" | "rejected" | "needs_review";
  reasoning: string;
}

export interface DiscoveryHistorySignals {
  blocked: boolean;
  blockReason?: string;
  previousRejected: boolean;
  previousAccepted: boolean;
  previousSaved: boolean;
  existingProspectId?: string | null;
}

export interface DiscoveryDecisionResult {
  finalScore: number;
  decision:
    | "accepted"
    | "rejected"
    | "needs_review"
    | "blacklisted";
  feedbackScore: number;
}
