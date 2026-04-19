import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SERPAPI_BASE = "https://serpapi.com/search";

async function getApiKey(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "SERPAPI_KEY"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  return process.env.SERPAPI_KEY || null;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export async function searchCompany(query: string): Promise<SearchResult[]> {
  const apiKey = await getApiKey();
  if (!apiKey) return [];

  try {
    // Exclude social/gov sites from results
    const excludeSites = "-site:facebook.com -site:linkedin.com -site:twitter.com -site:instagram.com -site:youtube.com -site:wikipedia.org";
    const params = new URLSearchParams({
      q: `${query} ${excludeSites}`,
      api_key: apiKey,
      engine: "google",
      num: "10",
    });

    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.organic_results || []).map((r: any) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
    }));
  } catch {
    return [];
  }
}

export async function searchNews(companyName: string): Promise<SearchResult[]> {
  const apiKey = await getApiKey();
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: `${companyName} news`,
      api_key: apiKey,
      engine: "google_news",
      num: "5",
    });

    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.news_results || []).map((r: any) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet || r.source || "",
    }));
  } catch {
    return [];
  }
}
