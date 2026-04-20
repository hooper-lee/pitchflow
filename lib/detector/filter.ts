import type { FilteredCandidate, SearchCandidate, DetectorConfig } from "./types";

const BLOCKED_PATH_KEYWORDS = [
  "/blog/", "/post/", "/article/", "/articles/", "/news/",
  "/press/", "/media/", "/forum/", "/thread/", "/topic/",
  "/wiki/", "/question/", "/review/", "/tag/", "/category/",
  "/author/", "/search", "/jobs/", "/careers/", "/hiring/",
];

export function normalizeDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isBlockedDomain(
  domain: string,
  config: DetectorConfig
): { blocked: boolean; reason?: string } {
  if (!domain) return { blocked: true, reason: "empty domain" };

  const lower = domain.toLowerCase();

  // Exact or parent domain match
  for (const blocked of config.blockedDomains) {
    if (lower === blocked || lower.endsWith(`.${blocked}`)) {
      return { blocked: true, reason: `blocked domain: ${blocked}` };
    }
  }

  // TLD match
  for (const tld of config.blockedTlds) {
    if (lower.endsWith(tld)) {
      return { blocked: true, reason: `blocked TLD: ${tld}` };
    }
  }

  return { blocked: false };
}

export function isBlockedUrl(url: string): { blocked: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    // Path-based blocking
    for (const keyword of BLOCKED_PATH_KEYWORDS) {
      if (path.includes(keyword)) {
        return { blocked: true, reason: `blocked path: ${keyword}` };
      }
    }

    // Very deep paths are likely subpages, not homepages
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 4) {
      return { blocked: true, reason: `path too deep: ${segments.length} segments` };
    }

    return { blocked: false };
  } catch {
    return { blocked: true, reason: "invalid URL" };
  }
}

export function filterCandidates(
  candidates: SearchCandidate[],
  config: DetectorConfig
): FilteredCandidate[] {
  return candidates.map((c) => {
    const domain = normalizeDomain(c.link);
    const domainCheck = isBlockedDomain(domain, config);

    if (domainCheck.blocked) {
      return { ...c, domain, blocked: true, blockReason: domainCheck.reason };
    }

    const urlCheck = isBlockedUrl(c.link);
    if (urlCheck.blocked) {
      return { ...c, domain, blocked: true, blockReason: urlCheck.reason };
    }

    return { ...c, domain, blocked: false };
  });
}
