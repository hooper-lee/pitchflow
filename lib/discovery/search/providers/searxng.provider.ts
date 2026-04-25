import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import type {
  DiscoverySearchProvider,
  DiscoverySearchQuery,
  DiscoverySearchResult,
} from "../types";

const DEFAULT_SEARXNG_URL = "http://localhost:8888";
const DEFAULT_TIMEOUT_MS = 10000;
const PER_PAGE = 10;
const EXCLUDED_DOMAINS = new Set([
  "baidu.com",
  "github.com",
  "stackoverflow.com",
  "wikipedia.org",
]);

interface SearxngResultItem {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxngResponse {
  results?: SearxngResultItem[];
}

export const searxngProvider: DiscoverySearchProvider = {
  name: "searxng",
  async enabled() {
    return Boolean(await getSearxngBaseUrl());
  },
  async search(query) {
    return searchSearxng(query);
  },
};

export async function searchSearxng(query: DiscoverySearchQuery): Promise<DiscoverySearchResult[]> {
  const baseUrl = await getSearxngBaseUrl();
  if (!baseUrl) return [];

  const pageCount = Math.ceil(query.maxResults / PER_PAGE);
  const results: DiscoverySearchResult[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const pageResults = await fetchSearxngPage(baseUrl, query, pageNumber);
    results.push(...pageResults);
    if (results.length >= query.maxResults || pageResults.length < PER_PAGE) break;
  }

  return results.slice(0, query.maxResults);
}

async function getSearxngBaseUrl() {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "SEARXNG_URL"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // Eval scripts may run without a database connection.
  }
  return process.env.SEARXNG_URL || DEFAULT_SEARXNG_URL;
}

async function fetchSearxngPage(
  baseUrl: string,
  query: DiscoverySearchQuery,
  pageNumber: number
) {
  const requestUrl = buildRequestUrl(baseUrl, query, pageNumber);
  const response = await fetchWithTimeout(requestUrl);
  if (!response.ok) return [];

  const payload = (await response.json()) as SearxngResponse;
  return (payload.results || [])
    .map((item, index) => toSearchResult(item, query, (pageNumber - 1) * PER_PAGE + index + 1))
    .filter((result): result is DiscoverySearchResult => Boolean(result));
}

function buildRequestUrl(baseUrl: string, query: DiscoverySearchQuery, pageNumber: number) {
  const params = new URLSearchParams({
    q: query.query,
    format: "json",
    categories: "general",
    pageno: String(pageNumber),
    language: resolveSearchLanguage(query),
  });
  return `${baseUrl.replace(/\/$/, "")}/search?${params}`;
}

function resolveSearchLanguage(query: DiscoverySearchQuery) {
  if (query.language) return query.language;
  if (!query.country) return "en";

  const normalizedCountry = query.country.toLowerCase();
  if (normalizedCountry.includes("china") || normalizedCountry.includes("中国")) {
    return "zh-CN";
  }
  return "en";
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function toSearchResult(
  item: SearxngResultItem,
  query: DiscoverySearchQuery,
  rawRank: number
) {
  if (!item.url || isExcludedDomain(item.url)) return null;
  return {
    title: item.title || "",
    link: item.url,
    snippet: item.content || "",
    sourceProvider: "searxng",
    query: query.query,
    queryIntent: query.intent,
    rawRank,
    sourceConfidence: Math.max(0.2, 1 - (rawRank - 1) * 0.03),
  };
}

function isExcludedDomain(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return EXCLUDED_DOMAINS.has(hostname);
  } catch {
    return true;
  }
}
