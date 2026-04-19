import { db } from "@/lib/db";
import { prospects, systemConfigs } from "@/lib/db/schema";
import { eq, and, ilike, desc, count, or, sql } from "drizzle-orm";
import { discoverEmails as hunterDiscover } from "@/lib/integrations/hunter";
import { discoverEmails as snovDiscover } from "@/lib/integrations/snovio";
import { inferEmailPattern } from "@/lib/utils/email-patterns";
import { searchCompany } from "@/lib/integrations/serpapi";

// Domains to filter out from SerpAPI results
const BLOCKED_DOMAINS = [
  "facebook.com", "linkedin.com", "twitter.com", "instagram.com",
  "youtube.com", "wikipedia.org", "medium.com", "reddit.com",
  "quora.com", "glassdoor.com", "indeed.com", "crunchbase.com",
  "bloomberg.com", "amazon.com", "alibaba.com", "globalsources.com",
  "zhihu.com", "csdn.net", "jianshu.com", "baidu.com",
  "weibo.com", "douban.com", "tianyancha.com", "qcc.com",
  "1688.com", "made-in-china.com",
];

function isBlockedDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  // Block social/news/education/government sites
  if (BLOCKED_DOMAINS.some((blocked) => lower.includes(blocked))) return true;
  if (lower.endsWith(".gov") || lower.endsWith(".gov.cn") || lower.endsWith(".edu") || lower.endsWith(".mil")) return true;
  if (lower.includes(".gov.") || lower.includes(".edu.")) return true;
  return false;
}

async function getEnabledProviders(): Promise<("hunter" | "snovio")[]> {
  try {
    const rows = await db
      .select({ key: systemConfigs.key, value: systemConfigs.value })
      .from(systemConfigs)
      .where(
        or(
          eq(systemConfigs.key, "DISCOVERY_PROVIDER_HUNTER"),
          eq(systemConfigs.key, "DISCOVERY_PROVIDER_SNOVIO"),
          eq(systemConfigs.key, "HUNTER_IO_API_KEY"),
          eq(systemConfigs.key, "SNOV_CLIENT_ID")
        )
      );

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    // If routing config exists, use it
    const hasRoutingConfig = "DISCOVERY_PROVIDER_HUNTER" in map || "DISCOVERY_PROVIDER_SNOVIO" in map;
    if (hasRoutingConfig) {
      const providers: ("hunter" | "snovio")[] = [];
      if (map["DISCOVERY_PROVIDER_HUNTER"] === "true") providers.push("hunter");
      if (map["DISCOVERY_PROVIDER_SNOVIO"] === "true") providers.push("snovio");
      return providers;
    }

    // No routing config — auto-detect which providers are configured
    const providers: ("hunter" | "snovio")[] = [];
    if (map["HUNTER_IO_API_KEY"]) providers.push("hunter");
    if (map["SNOV_CLIENT_ID"]) providers.push("snovio");
    return providers;
  } catch {
    return ["hunter", "snovio"]; // fallback: try both
  }
}

interface ListProspectsParams {
  tenantId: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export async function listProspects({
  tenantId,
  page = 1,
  limit = 20,
  search,
  status,
}: ListProspectsParams) {
  const conditions = [eq(prospects.tenantId, tenantId)];

  if (search) {
    conditions.push(
      or(
        ilike(prospects.companyName, `%${search}%`),
        ilike(prospects.contactName, `%${search}%`),
        ilike(prospects.email, `%${search}%`)
      )!
    );
  }

  if (status) {
    conditions.push(eq(prospects.status, status as any));
  }

  const where = and(...conditions);

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(prospects)
      .where(where)
      .orderBy(desc(prospects.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(prospects).where(where),
  ]);

  return {
    items,
    total: Number(total),
    page,
    limit,
    totalPages: Math.ceil(Number(total) / limit),
  };
}

export async function getProspect(id: string, tenantId: string) {
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)))
    .limit(1);

  return prospect || null;
}

export async function createProspect(
  tenantId: string,
  data: {
    companyName?: string;
    contactName?: string;
    email?: string;
    linkedinUrl?: string;
    whatsapp?: string;
    industry?: string;
    country?: string;
    website?: string;
    source?: string;
  }
) {
  const [prospect] = await db
    .insert(prospects)
    .values({ ...data, tenantId })
    .returning();

  return prospect;
}

export async function updateProspect(
  id: string,
  tenantId: string,
  data: Partial<typeof prospects.$inferInsert>
) {
  const [prospect] = await db
    .update(prospects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)))
    .returning();

  return prospect || null;
}

export async function deleteProspect(id: string, tenantId: string) {
  await db
    .delete(prospects)
    .where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)));
}

export async function discoverProspects(
  tenantId: string,
  params: {
    domain?: string;
    industry?: string;
    country?: string;
    keywords?: string;
    limit?: number;
  }
) {
  const created = [];
  const providers = await getEnabledProviders();
  const limit = params.limit || 10;

  if (params.domain) {
    // Domain-based discovery — try providers in order
    const discoveredEmails: Map<string, any> = new Map();

    for (const provider of providers) {
      if (discoveredEmails.size >= limit) break;

      try {
        if (provider === "hunter") {
          const results = await hunterDiscover(params.domain, {
            limit: limit - discoveredEmails.size,
          });
          for (const email of results) {
            if (email.value && !discoveredEmails.has(email.value)) {
              discoveredEmails.set(email.value, {
                contactName: email.first_name && email.last_name
                  ? `${email.first_name} ${email.last_name}`
                  : undefined,
                email: email.value,
                linkedinUrl: email.linkedin || undefined,
                source: "hunter",
                metadata: {
                  confidence: email.confidence,
                  position: email.position,
                  seniority: email.seniority,
                  department: email.department,
                },
              });
            }
          }
        } else if (provider === "snovio") {
          const results = await snovDiscover(params.domain, {
            limit: limit - discoveredEmails.size,
          });
          for (const item of results) {
            if (item.email && !discoveredEmails.has(item.email)) {
              discoveredEmails.set(item.email, {
                contactName: item.firstName && item.lastName
                  ? `${item.firstName} ${item.lastName}`
                  : undefined,
                email: item.email,
                linkedinUrl: item.linkedinUrl,
                source: "snovio",
                metadata: {
                  position: item.position,
                },
              });
            }
          }
        }
      } catch (err) {
        console.error(`${provider} discovery failed:`, err);
      }
    }

    // Insert all discovered prospects
    for (const data of Array.from(discoveredEmails.values())) {
      const [prospect] = await db
        .insert(prospects)
        .values({
          tenantId,
          companyName: params.domain,
          contactName: data.contactName,
          email: data.email,
          linkedinUrl: data.linkedinUrl,
          industry: params.industry,
          country: params.country,
          website: `https://${params.domain}`,
          source: data.source,
          status: "new",
          metadata: data.metadata,
        })
        .returning();

      created.push(prospect);
    }

    // If nothing found, create placeholder with inferred email
    if (created.length === 0) {
      const inferred = inferEmailPattern("contact", "", params.domain);
      const [prospect] = await db
        .insert(prospects)
        .values({
          tenantId,
          companyName: params.domain,
          email: inferred,
          industry: params.industry,
          country: params.country,
          website: `https://${params.domain}`,
          source: "pattern_inference",
          status: "new",
        })
        .returning();

      created.push(prospect);
    }
  } else {
    // Industry/keyword-based discovery via SerpAPI
    // Normalize Chinese punctuation to ASCII
    const normalize = (s: string) => s.replace(/，/g, ",").replace(/、/g, " ").replace(/。/g, ".");
    const hasChinese = /[\u4e00-\u9fff]/.test(params.keywords || params.industry || "");
    const searchParts = [
      params.keywords ? normalize(params.keywords) : undefined,
      params.industry ? normalize(params.industry) : undefined,
      params.country,
    ].filter(Boolean);

    // Only add "buyer importer" for English queries
    const searchQuery = hasChinese
      ? searchParts.join(" ")
      : [...searchParts, "buyer OR importer OR distributor"].join(" ");

    const searchResults = await searchCompany(searchQuery);

    for (const result of searchResults.slice(0, limit)) {
      // Extract domain from URL
      let domain = "";
      try {
        domain = new URL(result.link).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }

      // Filter out non-prospect domains
      if (isBlockedDomain(domain)) continue;

      // Skip if we already have a prospect from this domain
      const [existing] = await db
        .select()
        .from(prospects)
        .where(
          and(
            eq(prospects.tenantId, tenantId),
            // Match by domain: check website URL contains this domain
            or(
              eq(prospects.companyName, domain),
              sql`${prospects.website} LIKE ${`%${domain}%`}`
            )!
          )
        )
        .limit(1);

      if (existing) continue;

      // Try to extract a company name from the search result title
      const companyName = result.title.split(/[-|–—]/)[0].trim() || domain;
      const inferred = inferEmailPattern("contact", "", domain);
      const [prospect] = await db
        .insert(prospects)
        .values({
          tenantId,
          companyName,
          email: inferred,
          industry: params.industry,
          country: params.country,
          website: result.link,
          researchSummary: result.snippet,
          source: "serpapi",
          status: "new",
        })
        .returning();

      created.push(prospect);
    }
  }

  return created;
}
