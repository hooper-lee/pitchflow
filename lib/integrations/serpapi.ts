import { searchSearxng } from "@/lib/discovery/search/providers/searxng.provider";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export async function searchCompany(
  query: string,
  options?: {
    gl?: string;
    hl?: string;
    num?: number;
  }
): Promise<SearchResult[]> {
  const totalResults = options?.num || 10;
  const results = await searchSearxng({
    query,
    intent: "broad",
    maxResults: totalResults,
    country: options?.gl,
    language: options?.hl,
  });
  return results.map(({ title, link, snippet }) => ({ title, link, snippet }));
}

export async function searchNews(companyName: string): Promise<SearchResult[]> {
  return searchCompany(`${companyName} news`, { num: 5 });
}
