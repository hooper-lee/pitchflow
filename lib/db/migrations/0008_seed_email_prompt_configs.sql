INSERT INTO "system_configs" ("key", "value", "description")
VALUES
  (
    'AI_PROMPT_EMAIL_OUTREACH_USER',
    $prompt$Write a personalized cold outreach email with the following context:

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}
- Research: {researchSummary}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}
- Angle: {angle}

Template guidance:
{templateBody}

Return only JSON according to the required email schema.$prompt$,
    '冷启动首封开发信提示词模板（用于活动首封邮件生成）'
  ),
  (
    'AI_PROMPT_EMAIL_FOLLOWUP_USER',
    $prompt$Write a follow-up email for a prospect who has not replied.

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}

Previous email:
{previousEmailBody}

Follow-up:
- Step Number: {stepNumber}
- Angle: {angle}

Return only JSON according to the required email schema.$prompt$,
    '冷启动未回复自动跟进提示词模板（用于 3/7/14 天跟进邮件生成）'
  ),
  (
    'AI_PROMPT_EMAIL_REPLY_FOLLOWUP_USER',
    $prompt$Write a warm reply-follow-up email based on a real prospect reply.

Prospect:
- Name: {prospectName}
- Company: {companyName}
- Industry: {industry}
- Country: {country}
- Research: {researchSummary}

Sender:
- Name: {senderName}
- Title: {senderTitle}
- Product/Service: {productName}
- Product Description: {productDescription}
- Value Proposition: {valueProposition}

Previous email:
{previousEmailBody}

Prospect reply subject:
{replySubject}

Prospect reply:
{replyBody}

Return only JSON according to the required email schema.$prompt$,
    '已回复客户推进提示词模板（用于基于客户回复继续推进）'
  )
ON CONFLICT ("key") DO NOTHING;
