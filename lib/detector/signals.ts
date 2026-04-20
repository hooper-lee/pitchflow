import type { CheerioAPI } from "cheerio";
import type { FetchResult } from "./fetcher";
import type { PageSignals, DetectorConfig } from "./types";
import { normalizeDomain } from "./filter";

const PRODUCT_KEYWORDS = [
  "product", "service", "solution", "factory", "manufacturer",
  "manufacturing", "supplier", "wholesale", "bulk", "oem", "odm",
  "export", "import", "distributor", "dealer", "agent",
  "产品", "服务", "解决方案", "工厂", "制造商", "厂家",
  "供应商", "批发", "出口", "进口", "经销商", "代理商",
];

const B2B_KEYWORDS = [
  "wholesale", "bulk", "oem", "odm", "distributor", "dealer",
  "b2b", "trade", "supply chain", "procurement",
  "批发", "大宗", "代工", "贴牌", "经销商", "供应链", "采购",
];

const BLOG_INDICATORS = [
  "/blog/", "/post/", "/article/", "wordpress", "blogger",
  "medium.com", "substack", "ghost",
];

const NEWS_INDICATORS = [
  "/news/", "/press/", "/media/", "breaking", "headline",
  "article:section", "article:published_time",
];

const FORUM_INDICATORS = [
  "/forum/", "/thread/", "/topic/", "/discussion/",
  "vbulletin", "phpbb", "discourse", "xenforo",
];

const MARKETPLACE_INDICATORS = [
  "add to cart", "buy now", "add to basket", "shopping cart",
  "seller rating", "seller profile", "buyer protection",
  "加入购物车", "立即购买", "卖家评分",
];

const DIRECTORY_INDICATORS = [
  "/listing/", "/directory/", "/company/", "/business/",
  "黄页", "企业目录", "工商信息",
];

const JOB_INDICATORS = [
  "/jobs/", "/careers/", "/hiring/", "/vacancy/",
  "招聘", "职位", "求职",
];

const ACADEMIC_INDICATORS = [
  "/research/", "/publication/", "/journal/", "/thesis/",
  ".edu", "university", "academic",
  "学术", "论文", "研究",
];

const ECOMMERCE_INDICATORS = [
  "add to cart", "buy now", "add to wishlist",
  "product-detail", "/p/", "/dp/",
  "加入购物车", "立即购买",
];

const SOCIAL_SUBDOMAINS = ["blog", "news", "shop", "store", "mail", "app", "dev", "docs", "help", "support", "status", "cdn", "img", "static"];

function textContainsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

function extractEmails(html: string, $: CheerioAPI): string[] {
  const emails = new Set<string>();

  // From mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const email = href.replace("mailto:", "").split("?")[0].trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emails.add(email.toLowerCase());
      }
    }
  });

  // From text content (regex)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const bodyText = $("body").text();
  const matches = bodyText.match(emailRegex);
  if (matches) {
    for (const m of matches) {
      const lower = m.toLowerCase();
      // Filter out common false positives
      if (
        !lower.endsWith(".png") &&
        !lower.endsWith(".jpg") &&
        !lower.endsWith(".gif") &&
        !lower.endsWith(".svg") &&
        !lower.endsWith(".css") &&
        !lower.endsWith(".js") &&
        !lower.includes("example.com") &&
        !lower.includes("sentry.io") &&
        !lower.includes("w3.org")
      ) {
        emails.add(lower);
      }
    }
  }

  return Array.from(emails);
}

function extractPhones(html: string, $: CheerioAPI): string[] {
  const phones = new Set<string>();

  // From tel: links
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      phones.add(href.replace("tel:", "").trim());
    }
  });

  // From text (international phone patterns)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  const bodyText = $("body").text();
  const matches = bodyText.match(phoneRegex);
  if (matches) {
    for (const m of matches) {
      const digits = m.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15) {
        phones.add(m.trim());
      }
    }
  }

  return Array.from(phones).slice(0, 5);
}

function extractAddresses($: CheerioAPI): string[] {
  const addresses: string[] = [];

  // From <address> tags
  $("address").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) {
      addresses.push(text);
    }
  });

  // From schema.org PostalAddress
  $('[itemtype*="PostalAddress"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 10) {
      addresses.push(text);
    }
  });

  return addresses.slice(0, 3);
}

function extractCompanyNames($: CheerioAPI): string[] {
  const names = new Set<string>();

  // Schema.org Organization
  $('[itemtype*="Organization"] [itemprop="name"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text) names.add(text);
  });

  // og:site_name
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) names.add(ogSiteName.trim());

  // Footer copyright
  const footerText = $("footer").text();
  const copyrightMatch = footerText.match(/(?:©|\(c\)|copyright)\s*(?:\d{4}\s*)?(.+?)(?:\.|$)/i);
  if (copyrightMatch && copyrightMatch[1]) {
    const name = copyrightMatch[1].trim();
    if (name.length > 2 && name.length < 100) {
      names.add(name);
    }
  }

  return Array.from(names);
}

function extractSocialLinks($: CheerioAPI): { platform: string; url: string }[] {
  const links: { platform: string; url: string }[] = [];
  const seen = new Set<string>();

  const socialPatterns: [string, RegExp][] = [
    ["linkedin", /linkedin\.com\/(company|in)\//],
    ["twitter", /(?:twitter|x)\.com\/[a-zA-Z0-9_]+$/],
    ["facebook", /facebook\.com\/[a-zA-Z0-9.]+$/],
    ["instagram", /instagram\.com\/[a-zA-Z0-9_.]+$/],
    ["youtube", /youtube\.com\/(channel|c|@)/],
  ];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    for (const [platform, pattern] of socialPatterns) {
      if (pattern.test(href) && !seen.has(href)) {
        seen.add(href);
        links.push({ platform, url: href });
      }
    }
  });

  return links;
}

function hasNavKeyword($: CheerioAPI, keywords: string[]): boolean {
  const navTexts: string[] = [];

  // Collect text from nav, header, and footer links
  $("nav a, header a, footer a").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text) navTexts.push(text);
  });

  // Also check link href patterns
  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href") || "";
    navTexts.push(href.toLowerCase());
  });

  const allText = navTexts.join(" ");
  return keywords.some((k) => allText.includes(k.toLowerCase()));
}

export function extractSignals(
  fetchResult: FetchResult,
  companyName: string,
  config: DetectorConfig
): PageSignals {
  const { $, finalUrl, httpStatus, durationMs, method, error } = fetchResult;
  const domain = normalizeDomain(finalUrl);

  if (error || httpStatus === 0 || !fetchResult.html) {
    return {
      url: fetchResult.finalUrl,
      domain,
      titleHasCompanyName: false,
      titleExactMatch: false,
      metaDescriptionHasCompanyName: false,
      hasCompanyKeywords: false,
      hasProductKeywords: false,
      hasB2BKeywords: false,
      hasContactPage: false,
      hasAboutPage: false,
      isBlog: false,
      isNews: false,
      isForum: false,
      isMarketplace: false,
      isSocialProfile: false,
      isDirectory: false,
      isJobSite: false,
      isAcademic: false,
      isEcommerce: false,
      isDotCom: domain.endsWith(".com"),
      hasCleanPath: true,
      pathDepth: 0,
      hasCompanySubdomain: true,
      hasBusinessNavLinks: false,
      emailsFound: [],
      phonesFound: [],
      addressesFound: [],
      companyNamesFound: [],
      socialLinks: [],
      fetchMethod: method,
      fetchDurationMs: durationMs,
      httpStatus,
      finalUrl,
      error,
    };
  }

  const title = ($("title").text() || "").trim();
  const metaDesc = ($('meta[name="description"]').attr("content") || "").trim();
  const bodyText = $("body").text().toLowerCase();
  const companyLower = companyName.toLowerCase();

  // Check company name in title (fuzzy: strip common suffixes)
  const strippedTitle = title
    .replace(/\s*[-|–—]\s*(inc|llc|ltd|co\.|corp|gmbh|s\.a\.|s\.p\.a|ag|co\.ltd|group|holdings?).*$/i, "")
    .toLowerCase();
  const titleHasCompanyName = companyLower.length > 2 && title.toLowerCase().includes(companyLower);
  const titleExactMatch = companyLower.length > 2 && (strippedTitle.startsWith(companyLower) || strippedTitle === companyLower);

  // Collect all nav keywords from all languages
  const allNavKeywords = Object.values(config.navKeywords).flat();

  // URL analysis
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(finalUrl);
  } catch {
    parsedUrl = new URL(fetchResult.finalUrl || "https://unknown");
  }
  const path = parsedUrl.pathname;
  const pathSegments = path.split("/").filter(Boolean);
  const subdomain = domain.split(".")[0];

  // Extract data
  const emailsFound = extractEmails(fetchResult.html, $);
  const phonesFound = extractPhones(fetchResult.html, $);
  const addressesFound = extractAddresses($);
  const companyNamesFound = extractCompanyNames($);
  const socialLinks = extractSocialLinks($);

  // Check for about/contact pages in nav links
  let hasAboutPage = false;
  let hasContactPage = false;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").toLowerCase();
    if (href.includes("/about") || href.includes("/company") || href.includes("/profile")) {
      hasAboutPage = true;
    }
    if (href.includes("/contact") || href.includes("/inquiry") || href.includes("/enquiry")) {
      hasContactPage = true;
    }
  });

  return {
    url: fetchResult.finalUrl || finalUrl,
    domain,
    titleHasCompanyName,
    titleExactMatch,
    metaDescriptionHasCompanyName: companyLower.length > 2 && metaDesc.toLowerCase().includes(companyLower),
    hasCompanyKeywords: textContainsAny(bodyText, ["about us", "our company", "company profile", "关于我们", "公司简介"]),
    hasProductKeywords: textContainsAny(bodyText, PRODUCT_KEYWORDS),
    hasB2BKeywords: textContainsAny(bodyText, B2B_KEYWORDS),
    hasContactPage,
    hasAboutPage,
    isBlog: textContainsAny(path + " " + bodyText, BLOG_INDICATORS) || !!$("meta[name='generator'][content*='WordPress']").length,
    isNews: textContainsAny(path + " " + bodyText, NEWS_INDICATORS) || !!$('meta[property="article:section"]').length,
    isForum: textContainsAny(path + " " + bodyText, FORUM_INDICATORS),
    isMarketplace: textContainsAny(bodyText, MARKETPLACE_INDICATORS),
    isSocialProfile: /\/(in|company|profile|user)\//.test(path) && !!domain.match(/(linkedin|facebook|twitter)/),
    isDirectory: textContainsAny(path + " " + bodyText, DIRECTORY_INDICATORS),
    isJobSite: textContainsAny(path, JOB_INDICATORS),
    isAcademic: textContainsAny(path + " " + bodyText, ACADEMIC_INDICATORS),
    isEcommerce: textContainsAny(bodyText, ECOMMERCE_INDICATORS) && !!$("script[src*='shopify'], script[src*='woocommerce']").length,
    isDotCom: domain.endsWith(".com"),
    hasCleanPath: path === "/" || pathSegments.length <= 1,
    pathDepth: pathSegments.length,
    hasCompanySubdomain: !SOCIAL_SUBDOMAINS.includes(subdomain),
    hasBusinessNavLinks: hasNavKeyword($, allNavKeywords),
    emailsFound,
    phonesFound,
    addressesFound,
    companyNamesFound,
    socialLinks,
    fetchMethod: method,
    fetchDurationMs: durationMs,
    httpStatus,
    finalUrl,
  };
}
