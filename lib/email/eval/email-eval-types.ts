export type EmailScenario =
  | "cold_outreach"
  | "no_reply_followup"
  | "reply_followup"
  | "high_intent_reply"
  | "low_intent_reply"
  | "pricing_reply"
  | "rejection_reply"
  | "out_of_office_reply";

export type EmailVariant = "A" | "B";

export interface EmailIndustrySeed {
  industry: string;
  targetCustomer: string;
  prospectCompany: string;
  contactName: string;
  productName: string;
  valueProposition: string;
  requiredTerms: string[];
  forbiddenClaims: string[];
}

export interface EmailGoldenSetSeed {
  name: string;
  industries: EmailIndustrySeed[];
  scenarioCounts: Record<EmailScenario, number>;
}

export interface EmailEvalSample {
  id: string;
  scenario: EmailScenario;
  industry: string;
  prospect: {
    companyName: string;
    contactName: string;
    industry: string;
    country: string;
    researchSummary: string;
  };
  productProfile: {
    companyName: string;
    productName: string;
    valueProposition: string;
    senderName: string;
    senderTitle: string;
  };
  previousEmail?: {
    subject: string;
    body: string;
  };
  reply?: {
    subject: string;
    body: string;
  };
  expectedMustInclude: string[];
  mustNotInclude: string[];
  maxWords: number;
  requiresHumanReview: boolean;
}

export interface GeneratedEvalEmail {
  subject: string;
  body: string;
}

export interface EmailQaResult {
  factualityScore: number;
  personalizationScore: number;
  deliverabilityScore: number;
  spamRiskScore: number;
  toneScore: number;
  ctaClarityScore: number;
  replyUnderstandingScore: number | null;
  wordCount: number;
  hallucinationRisks: string[];
  missingRequiredElements: string[];
  forbiddenClaims: string[];
  unsafeClaims: string[];
  finalDecision: "pass" | "needs_review" | "block";
}

export interface EmailEvalSampleResult {
  id: string;
  scenario: EmailScenario;
  industry: string;
  variant: EmailVariant;
  subject: string;
  body: string;
  qa: EmailQaResult;
}
