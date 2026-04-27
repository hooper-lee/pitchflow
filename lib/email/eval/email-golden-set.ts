import type {
  EmailEvalSample,
  EmailGoldenSetSeed,
  EmailIndustrySeed,
  EmailScenario,
} from "./email-eval-types";

const SCENARIO_MAX_WORDS: Record<EmailScenario, number> = {
  cold_outreach: 160,
  no_reply_followup: 100,
  reply_followup: 140,
  high_intent_reply: 140,
  low_intent_reply: 140,
  pricing_reply: 140,
  rejection_reply: 90,
  out_of_office_reply: 90,
};

const HUMAN_REVIEW_SCENARIOS = new Set<EmailScenario>([
  "reply_followup",
  "high_intent_reply",
  "low_intent_reply",
  "pricing_reply",
]);

export function expandEmailGoldenSet(seed: EmailGoldenSetSeed): EmailEvalSample[] {
  return seed.industries.flatMap((industrySeed) =>
    expandIndustryScenarios(industrySeed, seed.scenarioCounts)
  );
}

function expandIndustryScenarios(
  industrySeed: EmailIndustrySeed,
  scenarioCounts: Record<EmailScenario, number>
) {
  return Object.entries(scenarioCounts).flatMap(([scenario, count]) =>
    Array.from({ length: count }, (_, index) =>
      buildSample(industrySeed, scenario as EmailScenario, index + 1)
    )
  );
}

function buildSample(
  industrySeed: EmailIndustrySeed,
  scenario: EmailScenario,
  sampleNumber: number
): EmailEvalSample {
  return {
    id: buildSampleId(industrySeed, scenario, sampleNumber),
    scenario,
    industry: industrySeed.industry,
    prospect: {
      companyName: industrySeed.prospectCompany,
      contactName: industrySeed.contactName,
      industry: industrySeed.industry,
      country: "United States",
      researchSummary: `${industrySeed.prospectCompany} is a ${industrySeed.targetCustomer} with an official website and category-specific product line.`,
    },
    productProfile: {
      companyName: "PitchFlow Test Supplier",
      productName: industrySeed.productName,
      valueProposition: industrySeed.valueProposition,
      senderName: "Alex",
      senderTitle: "Sales Manager",
    },
    previousEmail: buildPreviousEmail(industrySeed),
    reply: buildReply(industrySeed, scenario),
    expectedMustInclude: buildRequiredTerms(industrySeed, scenario),
    mustNotInclude: industrySeed.forbiddenClaims,
    maxWords: SCENARIO_MAX_WORDS[scenario],
    requiresHumanReview: HUMAN_REVIEW_SCENARIOS.has(scenario),
  };
}

function buildSampleId(
  industrySeed: EmailIndustrySeed,
  scenario: EmailScenario,
  sampleNumber: number
) {
  const industrySlug = industrySeed.industry.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${industrySlug}-${scenario}-${String(sampleNumber).padStart(2, "0")}`;
}

function buildPreviousEmail(industrySeed: EmailIndustrySeed) {
  return {
    subject: `${industrySeed.productName} for ${industrySeed.prospectCompany}`,
    body: `I reached out about ${industrySeed.productName} and ${industrySeed.valueProposition}.`,
  };
}

function buildReply(industrySeed: EmailIndustrySeed, scenario: EmailScenario) {
  const replyBodyByScenario: Record<EmailScenario, string> = {
    cold_outreach: "",
    no_reply_followup: "",
    reply_followup: `Thanks. Can you share more details about ${industrySeed.productName}?`,
    high_intent_reply: "This looks relevant. Can you send MOQ, sample lead time, and catalog details?",
    low_intent_reply: "We might look at this later, but it is not a priority right now.",
    pricing_reply: "Please share pricing, MOQ, and sample cost for a first order.",
    rejection_reply: "Thanks, but we are not interested. Please do not follow up further.",
    out_of_office_reply: "I am out of office this week and will reply after I return.",
  };

  if (!replyBodyByScenario[scenario]) return undefined;
  return {
    subject: `Re: ${industrySeed.productName}`,
    body: replyBodyByScenario[scenario],
  };
}

function buildRequiredTerms(industrySeed: EmailIndustrySeed, scenario: EmailScenario) {
  if (scenario === "pricing_reply") return ["pricing", "MOQ", "sample"];
  if (scenario === "high_intent_reply") return ["MOQ", "sample", "catalog"];
  if (scenario === "low_intent_reply") return ["later", "helpful", "timing"];
  if (scenario === "rejection_reply") return ["understand", "not follow up"];
  if (scenario === "out_of_office_reply") return ["return", "follow up"];
  if (scenario === "no_reply_followup") return [industrySeed.requiredTerms[0], "quick", "reply"];
  if (scenario === "reply_followup") return [industrySeed.requiredTerms[0], "details", "reply"];
  return industrySeed.requiredTerms;
}
