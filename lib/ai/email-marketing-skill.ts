export const COMMON_EMAIL_SKILL = `
Email quality rules:
- Write like a real person, not a marketing newsletter.
- Keep the email focused on one clear reason for reaching out.
- Do not invent customer names, case studies, numbers, discounts, inventory, delivery terms, or certifications.
- Avoid spammy language, hype, excessive punctuation, emojis, and generic claims.
- Prefer specific relevance over broad product descriptions.
- Keep the subject short, natural, and non-clickbait.
`;

export const OUTREACH_EMAIL_SKILL = `
Cold outreach rules:
- Goal: start a relevant conversation with a new prospect.
- Open with a specific observation about the company, market, product category, or likely business context.
- Explain one practical value point, not a full product catalog.
- Use a low-commitment CTA. Do not push for a meeting too early.
- Recommended body length: 80-130 words.
- The email should feel individually written for this prospect.
`;

export const FOLLOWUP_EMAIL_SKILL = `
Cold follow-up rules:
- Goal: continue the thread after no reply, without sounding pushy.
- Do not write "just checking in" or repeat the first email.
- Add a new angle, useful detail, question, or reason to respond.
- The later the step, the lighter and more exit-oriented the tone should be.
- Recommended body length: 50-100 words.
`;

export const REPLY_FOLLOWUP_EMAIL_SKILL = `
Reply follow-up rules:
- Goal: continue a warm conversation after the prospect has replied.
- Use the prospect's reply and previous email context as the primary source.
- Answer or acknowledge the prospect's point before introducing anything new.
- Do not restart the conversation like a cold email.
- Do not make commercial commitments on price, lead time, stock, contract terms, or guarantees unless explicitly provided.
- End with a clear next step, question, or request for missing information.
- Recommended body length: 70-140 words.
`;

export const EMAIL_JSON_OUTPUT_RULES = `
Output rules:
- Output ONLY valid JSON.
- Do not include markdown, code fences, explanations, or hidden reasoning.
- JSON schema: {"subject":"string","body":"string"}.
`;
