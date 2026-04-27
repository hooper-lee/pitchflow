import type {
  EmailEvalSample,
  EmailScenario,
  EmailVariant,
  GeneratedEvalEmail,
} from "./email-eval-types";

export function generateEvalEmail(
  sample: EmailEvalSample,
  variant: EmailVariant
): GeneratedEvalEmail {
  return variant === "A" ? generateVariantA(sample) : generateVariantB(sample);
}

function generateVariantA(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: `Quick question for ${sample.prospect.companyName}`,
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      `I noticed ${sample.prospect.companyName} and wanted to introduce our products and services.`,
      "We help companies improve sourcing with good quality, competitive pricing, and fast delivery.",
      "Would you be open to a quick call this week?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function generateVariantB(sample: EmailEvalSample): GeneratedEvalEmail {
  const scenarioBuilder = SCENARIO_BUILDERS[sample.scenario];
  return scenarioBuilder(sample);
}

const SCENARIO_BUILDERS: Record<EmailScenario, (sample: EmailEvalSample) => GeneratedEvalEmail> = {
  cold_outreach: buildColdOutreach,
  no_reply_followup: buildNoReplyFollowup,
  reply_followup: buildReplyFollowup,
  high_intent_reply: buildHighIntentReply,
  low_intent_reply: buildLowIntentReply,
  pricing_reply: buildPricingReply,
  rejection_reply: buildRejectionReply,
  out_of_office_reply: buildOutOfOfficeReply,
};

function buildColdOutreach(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: `${sample.productProfile.productName} for ${sample.prospect.companyName}`,
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      `I saw ${sample.prospect.companyName} focuses on ${sample.prospect.industry}, so I thought this may be relevant.`,
      `We support brands with ${sample.productProfile.productName}, especially around ${sample.productProfile.valueProposition}.`,
      "Would it be useful if I sent a few options for your team to review?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildNoReplyFollowup(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: `Re: ${sample.productProfile.productName}`,
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      `Quick follow-up on ${sample.productProfile.productName} for your ${sample.prospect.industry} line.`,
      "If this is relevant, I can reply with two practical options and sample timing.",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildReplyFollowup(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: `Re: ${sample.productProfile.productName}`,
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      `Thanks for your reply. I can share details on ${sample.productProfile.productName} for ${sample.prospect.companyName}.`,
      "The most useful next step is usually a short product brief with options, MOQ, and sample timing.",
      "Would you like me to send that over?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildHighIntentReply(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: "Re: MOQ and samples",
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      "Thanks, that sounds relevant. I can prepare MOQ, sample lead time, and a short catalog for review.",
      `I will keep it focused on ${sample.productProfile.productName} and your ${sample.prospect.industry} use case.`,
      "Should I send it here, or is there another teammate to include?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildLowIntentReply(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: "Re: timing",
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      "Understood. Timing matters, so I will not push.",
      `I can send one helpful reference on ${sample.productProfile.productName} for later review.`,
      "Would it be better to follow up next quarter?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildPricingReply(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: "Re: pricing and MOQ",
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      "Thanks. I can share pricing, MOQ, and sample cost after confirming the preferred spec and quantity range.",
      `For ${sample.productProfile.productName}, those two details keep the quote accurate.`,
      "Could you share your target quantity or reference item?",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildRejectionReply(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: "Re: understood",
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      "Understood, thanks for letting me know.",
      "I will not follow up further on this.",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}

function buildOutOfOfficeReply(sample: EmailEvalSample): GeneratedEvalEmail {
  return {
    subject: "Re: thanks",
    body: [
      `Hi ${sample.prospect.contactName},`,
      "",
      "Thanks for the note. I will follow up after you return.",
      "Hope the week goes smoothly.",
      "",
      "Best,",
      sample.productProfile.senderName,
    ].join("\n"),
  };
}
