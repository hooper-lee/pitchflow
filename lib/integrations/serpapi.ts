import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_SEARXNG_URL = "http://localhost:8888";

async function getBaseUrl(): Promise<string> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "SEARXNG_URL"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  return process.env.SEARXNG_URL || DEFAULT_SEARXNG_URL;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

// -site: 排除列表（SearXNG 不支持太长的 -site: 列表，改为代码层过滤）
const EXCLUDE_DOMAINS = new Set([
  "facebook.com", "linkedin.com", "twitter.com", "x.com",
  "instagram.com", "youtube.com", "tiktok.com", "pinterest.com",
  "reddit.com", "wikipedia.org", "medium.com",
  "zhihu.com", "xiaohongshu.com", "douyin.com", "bilibili.com",
  "toutiao.com", "weibo.com", "douban.com", "csdn.net",
  "baidu.com", "jianshu.com", "juejin.cn",
  "amazon.com", "alibaba.com", "1688.com", "made-in-china.com",
  "tianyancha.com", "qcc.com", "aiqicha.baidu.com",
  "crunchbase.com", "glassdoor.com", "indeed.com",
  "bloomberg.com", "forbes.com", "reuters.com",
  "bbc.com", "cnn.com", "apnews.com", "nytimes.com",
  "github.com", "stackoverflow.com",
]);

function isExcludedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return EXCLUDE_DOMAINS.has(host);
  } catch {
    return false;
  }
}

export async function searchCompany(
  query: string,
  options?: {
    gl?: string;
    hl?: string;
    num?: number;
  }
): Promise<SearchResult[]> {
  const baseUrl = await getBaseUrl();
  const totalResults = options?.num || 10;
  const perPage = 10;
  const pages = Math.ceil(totalResults / perPage);

  // 合并 gl + hl 为 SearXNG 的 language 参数
  let language = "en";
  if (options?.hl) {
    language = options.hl;
  } else if (options?.gl) {
    language = options.gl;
  }

  try {
    const allResults: SearchResult[] = [];
    let fetchedPages = 0;

    for (let pageno = 1; pageno <= pages; pageno++) {
      fetchedPages = pageno;
      const params = new URLSearchParams({
        q: query,
        format: "json",
        categories: "general",
        pageno: String(pageno),
        language,
      });

      const res = await fetch(`${baseUrl}/search?${params}`);
      if (!res.ok) {
        console.warn(`[SearXNG] page ${pageno} returned ${res.status}`);
        break;
      }

      const data = await res.json();
      const pageCount = (data.results || []).length;
      console.log(`[SearXNG] page ${pageno}: ${pageCount} results`);
      const results = (data.results || [])
        .filter((r: any) => !isExcludedDomain(r.url || ""))
        .map((r: any) => ({
        title: r.title || "",
        link: r.url || "",
        snippet: r.content || "",
      }));

      allResults.push(...results);

      // 够了就停
      if (allResults.length >= totalResults) break;

      // 没有更多结果了
      if (results.length < perPage) break;

      // 页面间延迟，避免 SearXNG 限流
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`[SearXNG] returned ${allResults.length} results (requested ${totalResults}), pages fetched: ${fetchedPages}`);
    return allResults.slice(0, totalResults);
  } catch {
    return [];
  }
}

export async function searchNews(companyName: string): Promise<SearchResult[]> {
  const baseUrl = await getBaseUrl();

  try {
    const params = new URLSearchParams({
      q: `${companyName} news`,
      format: "json",
      categories: "news",
      pageno: "1",
    });

    const res = await fetch(`${baseUrl}/search?${params}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results || []).slice(0, 5).map((r: any) => ({
      title: r.title || "",
      link: r.url || "",
      snippet: r.content || "",
    }));
  } catch {
    return [];
  }
}
