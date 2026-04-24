const STRIPPED_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ref",
  "source",
]);

const COMMON_MULTI_PART_TLDS = ["co.uk", "com.au", "com.cn", "co.jp", "com.br"];

export function normalizeUrl(input: string): string | null {
  const parsedUrl = safeUrl(input);
  if (!parsedUrl) return null;
  const params = new URLSearchParams(parsedUrl.search);
  for (const key of Array.from(params.keys())) {
    if (STRIPPED_QUERY_KEYS.has(key.toLowerCase())) params.delete(key);
  }
  parsedUrl.hash = "";
  parsedUrl.search = params.toString();
  parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
  parsedUrl.pathname = cleanPathname(parsedUrl.pathname);
  return parsedUrl.toString().replace(/\/$/, "");
}

export function getHostname(input: string): string | null {
  const parsedUrl = safeUrl(input);
  return parsedUrl ? parsedUrl.hostname.replace(/^www\./i, "").toLowerCase() : null;
}

export function getRootDomain(input: string): string | null {
  const hostname = normalizeDomain(input);
  if (!hostname) return null;
  const segments = hostname.split(".").filter(Boolean);
  if (segments.length <= 2) return hostname;
  const suffix = segments.slice(-2).join(".");
  if (COMMON_MULTI_PART_TLDS.includes(suffix)) return segments.slice(-3).join(".");
  return segments.slice(-2).join(".");
}

export function normalizeDomain(input: string): string | null {
  const hostname = getHostname(input);
  if (!hostname) return null;
  return hostname.replace(/\.+$/, "");
}

export function normalizeCompanyName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, " ")
    .replace(/\b(inc|llc|ltd|limited|co|corp|corporation|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeUrl(input: string): URL | null {
  try {
    return new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    return null;
  }
}

function cleanPathname(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  return pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
}
