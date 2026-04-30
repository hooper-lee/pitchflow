import type { AgentWorkflowGoal } from "@/lib/agent/types";

const countryAliases: Array<[string, string]> = [
  ["美国", "United States"],
  ["北美", "United States"],
  ["英国", "United Kingdom"],
  ["加拿大", "Canada"],
  ["澳洲", "Australia"],
  ["澳大利亚", "Australia"],
  ["德国", "Germany"],
  ["法国", "France"],
  ["日本", "Japan"],
];

function extractNumber(message: string) {
  const matchedNumber = message.match(/(\d+)\s*(个|家|条|封)?/)?.[1];
  return matchedNumber ? Number(matchedNumber) : undefined;
}

function extractCountry(message: string) {
  const matchedAlias = countryAliases.find(([label]) => message.includes(label));
  return matchedAlias?.[1];
}

function removeDiscoveryFiller(message: string) {
  return message
    .replace(/\d+\s*(个|家|条|封)?/g, "")
    .replace(/(帮我|我要|我想|开始|创建|新增|挖掘|找|开发|客户|公司|品牌|精准挖掘|获客)/g, " ")
    .replace(/[。！？!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitDiscoveryKeywords(message: string) {
  const explicitKeywords = extractListValue(message, ["关键词", "搜索词"]);
  if (explicitKeywords?.length) return explicitKeywords;

  const country = extractCountry(message);
  const cleanedMessage = removeDiscoveryFiller(message);
  const phrases = cleanedMessage
    .split(/[，,、；;\n]/)
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= 2);

  const keywordCandidates = phrases.length > 0 ? phrases : [cleanedMessage].filter(Boolean);
  if (country && keywordCandidates.length > 0) {
    return keywordCandidates.map((keyword) =>
      keyword.toLowerCase().includes(country.toLowerCase()) ? keyword : `${country} ${keyword}`
    );
  }
  return keywordCandidates;
}

function extractColonValue(message: string, labels: string[]) {
  const escapedLabels = labels.join("|");
  return message.match(new RegExp(`(?:${escapedLabels})[:：]\\s*([^\\n，,。]+)`, "i"))?.[1]?.trim();
}

function extractLongColonValue(message: string, labels: string[]) {
  const escapedLabels = labels.join("|");
  return message.match(new RegExp(`(?:${escapedLabels})[:：]\\s*([^\\n]+)`, "i"))?.[1]?.trim();
}

function extractListValue(message: string, labels: string[]) {
  const value = extractLongColonValue(message, labels);
  return value ? value.split(/[，,\n、]/).map((item) => item.trim()).filter(Boolean) : undefined;
}

function extractProductSlots(message: string) {
  return {
    companyName: extractColonValue(message, ["公司名称", "公司名"]),
    productName: extractColonValue(message, ["产品/服务名称", "产品服务名称", "产品名称", "产品"]),
    senderName: extractColonValue(message, ["发件人姓名", "发件人"]),
    senderTitle: extractColonValue(message, ["发件人职位", "职位"]),
    productDescription: extractLongColonValue(message, ["产品介绍", "产品描述", "服务介绍", "介绍"]),
    valueProposition: extractLongColonValue(message, ["核心卖点/价值主张", "核心卖点", "价值主张", "卖点"]),
  };
}

function extractIcpSlots(message: string) {
  return {
    name: extractColonValue(message, ["画像名称", "名称", "名字"]),
    industry: extractColonValue(message, ["行业"]),
    targetCustomerText:
      extractLongColonValue(message, ["目标客户描述", "目标客户", "客户描述", "描述"]) ||
      (message.length > 12 ? message : undefined),
    mustHave: extractListValue(message, ["必须满足", "必须有", "硬性条件"]),
    mustNotHave: extractListValue(message, ["排除条件", "不能有", "不要"]),
    productCategories: extractListValue(message, ["产品类别", "品类"]),
  };
}

function extractDiscoverySlots(message: string) {
  const targetLimit = extractNumber(message);
  const country = extractCountry(message);
  const inferredKeywords = splitDiscoveryKeywords(message);

  return {
    name: extractColonValue(message, ["任务名称", "名称", "名字"]),
    keywords: inferredKeywords,
    industry: extractColonValue(message, ["行业"]),
    country,
    targetLimit,
  };
}

function extractCampaignSlots(message: string) {
  return {
    name: extractColonValue(message, ["活动名称", "名称", "名字"]),
    industry: extractColonValue(message, ["行业"]),
    campaignType: message.includes("已回复") ? "reply_followup" : undefined,
  };
}

function extractTemplateSlots(message: string) {
  return {
    name: extractColonValue(message, ["模板名称", "策略名称", "名称", "名字"]),
    subject: extractLongColonValue(message, ["邮件主题", "主题", "标题"]),
    body: extractLongColonValue(message, ["邮件正文", "正文", "内容"]),
    angle: extractColonValue(message, ["角度", "话术角度"]),
  };
}

function extractProspectSlots(message: string) {
  return {
    companyName: extractColonValue(message, ["公司名称", "公司名", "客户名称", "客户"]),
    email: extractColonValue(message, ["邮箱", "邮件"]),
    contactName: extractColonValue(message, ["联系人", "联系人姓名"]),
    website: extractColonValue(message, ["官网", "网站"]),
    industry: extractColonValue(message, ["行业"]),
    country: extractCountry(message),
  };
}

export function extractLocalWorkflowSlots(goal: AgentWorkflowGoal, message: string) {
  if (goal === "setup_product_profile") return extractProductSlots(message);
  if (goal === "setup_icp_profile") return extractIcpSlots(message);
  if (goal === "start_discovery") return extractDiscoverySlots(message);
  if (goal === "create_campaign") return extractCampaignSlots(message);
  if (goal === "setup_email_template") return extractTemplateSlots(message);
  return extractProspectSlots(message);
}
