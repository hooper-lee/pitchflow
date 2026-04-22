import { db } from "@/lib/db";
import { prospects, systemConfigs, prospectResearch, prospectScores } from "@/lib/db/schema";
import { eq, and, ilike, desc, count, or, isNull, sql } from "drizzle-orm";
import { discoverEmails as hunterDiscover, type HunterEmailResult } from "@/lib/integrations/hunter";
import { discoverEmails as snovDiscover, type SnovEmailResult } from "@/lib/integrations/snovio";
import { inferEmailPattern } from "@/lib/utils/email-patterns";
import { searchCompany } from "@/lib/integrations/serpapi";
import { detectOfficialWebsite, extractContacts, getDetectorConfig } from "@/lib/detector";
import { MINIMUM_SCORE_THRESHOLD } from "@/lib/detector/constants";
import { fetchPage } from "@/lib/detector/fetcher";
import { extractSignals } from "@/lib/detector/signals";

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
  researchStatus?: "pending" | "processing" | "completed" | "failed";
  leadGrade?: "A" | "B" | "C" | "D";
}

type ProspectStatus = typeof prospects.status.enumValues[number];
type LegacyProspectStatus = ProspectStatus | "researching" | "researched";
type NormalizedProspectStatus = ProspectStatus;

function normalizeProspectStatus(
  status: LegacyProspectStatus | null | undefined
): NormalizedProspectStatus {
  if (!status || status === "researching" || status === "researched") {
    return "new";
  }

  return status;
}

interface DiscoveredEmailCandidate {
  contactName?: string;
  email: string;
  linkedinUrl?: string;
  source: "hunter" | "snovio" | "detector";
  metadata?: Record<string, unknown>;
}

export async function listProspects({
  tenantId,
  page = 1,
  limit = 20,
  search,
  status,
  researchStatus,
  leadGrade,
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
    conditions.push(eq(prospects.status, status as NormalizedProspectStatus));
  }

  if (researchStatus) {
    if (researchStatus === "pending") {
      conditions.push(
        or(
          isNull(prospectResearch.status),
          eq(prospectResearch.status, "pending")
        )!
      );
    } else {
      conditions.push(eq(prospectResearch.status, researchStatus));
    }
  }

  if (leadGrade) {
    conditions.push(eq(prospectScores.leadGrade, leadGrade));
  }

  const where = and(...conditions);

  // 查询 prospects 并 left join research 和 scores
  const items = await db
    .select({
      // prospects 表字段
      id: prospects.id,
      companyName: prospects.companyName,
      contactName: prospects.contactName,
      email: prospects.email,
      industry: prospects.industry,
      country: prospects.country,
      companyScore: prospects.companyScore,
      matchScore: prospects.matchScore,
      status: prospects.status,
      source: prospects.source,
      createdAt: prospects.createdAt,
      website: prospects.website,
      // prospect_research 字段
      researchStatus: prospectResearch.status,
      aiSummary: prospectResearch.aiSummary,
      employeeCount: prospectResearch.employeeCount,
      companyType: prospectResearch.companyType,
      // prospect_scores 字段
      websiteScore: prospectScores.websiteScore,
      icpFitScore: prospectScores.icpFitScore,
      buyingIntentScore: prospectScores.buyingIntentScore,
      reachabilityScore: prospectScores.reachabilityScore,
      dealPotentialScore: prospectScores.dealPotentialScore,
      riskPenaltyScore: prospectScores.riskPenaltyScore,
      overallScore: prospectScores.overallScore,
      leadGrade: prospectScores.leadGrade,
      priorityLevel: prospectScores.priorityLevel,
      recommendedAction: prospectScores.recommendedAction,
    })
    .from(prospects)
    .leftJoin(prospectResearch, eq(prospects.id, prospectResearch.prospectId))
    .leftJoin(prospectScores, eq(prospects.id, prospectScores.prospectId))
    .where(where)
    .orderBy(desc(prospects.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [{ total }] = await db
    .select({ total: count() })
    .from(prospects)
    .leftJoin(prospectResearch, eq(prospects.id, prospectResearch.prospectId))
    .leftJoin(prospectScores, eq(prospects.id, prospectScores.prospectId))
    .where(where);

  return {
    items: items.map((item) => ({
      ...item,
      status: normalizeProspectStatus(item.status),
    })),
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

  if (!prospect) {
    return null;
  }

  return {
    ...prospect,
    status: normalizeProspectStatus(prospect.status),
  };
}

export async function getProspectContacts(prospectId: string, tenantId: string) {
  const currentProspect = await getProspect(prospectId, tenantId);
  if (!currentProspect) {
    return [];
  }

  const identifierConditions = [];
  if (currentProspect.website) {
    identifierConditions.push(eq(prospects.website, currentProspect.website));
  }
  if (currentProspect.companyName) {
    identifierConditions.push(eq(prospects.companyName, currentProspect.companyName));
  }

  if (identifierConditions.length === 0) {
    return [
      {
        id: currentProspect.id,
        contactName: currentProspect.contactName,
        email: currentProspect.email,
        linkedinUrl: currentProspect.linkedinUrl,
        createdAt: currentProspect.createdAt,
      },
    ];
  }

  const relatedProspects = await db
    .select({
      id: prospects.id,
      contactName: prospects.contactName,
      email: prospects.email,
      linkedinUrl: prospects.linkedinUrl,
      createdAt: prospects.createdAt,
    })
    .from(prospects)
    .where(
      and(eq(prospects.tenantId, tenantId), or(...identifierConditions)!)
    )
    .orderBy(desc(prospects.createdAt));

  const seen = new Set<string>();
  return relatedProspects.filter((contact) => {
    const key = [
      contact.email?.toLowerCase() || "",
      contact.contactName?.toLowerCase() || "",
      contact.linkedinUrl || "",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return Boolean(contact.contactName || contact.email || contact.linkedinUrl);
  });
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

// Map country names to Google gl/hl codes
const COUNTRY_GL_MAP: Record<string, string> = {
  "USA": "us", "United States": "us", "美国": "us",
  "Germany": "de", "德国": "de",
  "UK": "gb", "United Kingdom": "gb", "英国": "gb",
  "France": "fr", "法国": "fr",
  "Japan": "jp", "日本": "jp",
  "Korea": "kr", "韩国": "kr",
  "Brazil": "br", "巴西": "br",
  "India": "in", "印度": "in",
  "Canada": "ca", "加拿大": "ca",
  "Australia": "au", "澳大利亚": "au",
  "Mexico": "mx", "墨西哥": "mx",
  "Italy": "it", "意大利": "it",
  "Spain": "es", "西班牙": "es",
  "Russia": "ru", "俄罗斯": "ru",
  "Turkey": "tr", "土耳其": "tr",
  "Thailand": "th", "泰国": "th",
  "Vietnam": "vn", "越南": "vn",
  "Indonesia": "id", "印度尼西亚": "id",
  "Malaysia": "my", "马来西亚": "my",
  "Philippines": "ph", "菲律宾": "ph",
  "Singapore": "sg", "新加坡": "sg",
  "UAE": "ae", "阿联酋": "ae",
  "Saudi Arabia": "sa", "沙特阿拉伯": "sa",
};

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
  const created: (typeof prospects.$inferSelect)[] = [];
  const providers = await getEnabledProviders();
  const limit = params.limit || 10;
  // 放大搜索量，确保过滤后还有足够候选
  const searchDepth = Math.max(limit * 3, 20);

  if (params.domain) {
    const normalizedDomain = params.domain
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim()
      .toLowerCase();
    const websiteUrl = `https://${normalizedDomain}`;
    const discoveredEmails = new Map<string, DiscoveredEmailCandidate>();
    let companyNameFromSite: string | undefined;
    let directMetadata: Record<string, unknown> | undefined;

    try {
      const detectorConfig = await getDetectorConfig();
      const urlsToProbe = [websiteUrl, `${websiteUrl}/contact`, `${websiteUrl}/about`];

      for (const url of urlsToProbe) {
        const fetchResult = await fetchPage(url, detectorConfig);
        if (fetchResult.httpStatus !== 200 || fetchResult.error) {
          continue;
        }

        const signals = extractSignals(fetchResult, normalizedDomain, detectorConfig);
        const contacts = extractContacts(signals);
        companyNameFromSite = companyNameFromSite || contacts.companyName || undefined;
        directMetadata = {
          directFetch: true,
          fetchMethod: signals.fetchMethod,
          phones: contacts.phones,
          addresses: contacts.addresses,
          socialLinks: contacts.socialLinks,
        };

        for (const email of contacts.emails) {
          if (!discoveredEmails.has(email)) {
            discoveredEmails.set(email, {
              email,
              source: "detector",
              metadata: directMetadata,
            });
          }
        }
      }
    } catch (error) {
      console.error("Direct domain extraction failed:", error);
    }

    for (const provider of providers) {
      if (discoveredEmails.size > 0) break;

      try {
        if (provider === "hunter") {
          const results = await hunterDiscover(normalizedDomain, {
            limit,
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
          const results = await snovDiscover(normalizedDomain, {
            limit,
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
          companyName: companyNameFromSite || normalizedDomain,
          contactName: data.contactName,
          email: data.email,
          linkedinUrl: data.linkedinUrl,
          industry: params.industry,
          website: websiteUrl,
          source: data.source,
          status: "new",
          metadata: {
            ...(directMetadata || {}),
            ...(data.metadata || {}),
          },
        })
        .returning();

      created.push(prospect);
    }

    // If nothing found, create placeholder with inferred email
    if (created.length === 0) {
      const inferred = inferEmailPattern("contact", "", normalizedDomain);
      const [prospect] = await db
        .insert(prospects)
        .values({
          tenantId,
          companyName: companyNameFromSite || normalizedDomain,
          email: inferred,
          industry: params.industry,
          website: websiteUrl,
          source: "detector+inferred",
          status: "new",
          metadata: directMetadata,
        })
        .returning();

      created.push(prospect);
    }
  } else {
    // Industry/keyword-based discovery via SerpAPI + Detector
    const normalize = (s: string) => s.replace(/，/g, ",").replace(/、/g, " ").replace(/。/g, ".");
    const hasChinese = /[\u4e00-\u9fff]/.test(params.keywords || params.industry || "");
    const searchParts = [
      params.keywords ? normalize(params.keywords) : undefined,
      params.industry ? normalize(params.industry) : undefined,
      params.country,
    ].filter(Boolean);

    const searchQuery = hasChinese
      ? [...searchParts, "厂家 OR 工厂 OR 供应商 OR 官网"].join(" ")
      : [...searchParts, "manufacturer OR supplier OR official site"].join(" ");

    // Determine gl/hl for local results
    const gl = params.country ? COUNTRY_GL_MAP[params.country] : undefined;
    const hl = hasChinese ? "zh-CN" : "en";

    const searchResults = await searchCompany(searchQuery, { num: searchDepth, gl, hl });
    console.log(`[discover] SerpAPI returned ${searchResults.length} results (requested ${searchDepth}), query: ${searchQuery}`);

    if (searchResults.length === 0) return created;

    // Use detector to find official websites
    const detectorResult = await detectOfficialWebsite(searchQuery, searchResults);
    console.log(`[discover] Detector: passedFilter=${detectorResult.passedFilter}, fetched=${detectorResult.fetchedSuccessfully}, candidates=${detectorResult.allCandidates.length}, winner=${detectorResult.winner ? 'yes' : 'no'}`);

    // Loop over all scored candidates (already sorted by score desc)
    for (const scored of detectorResult.allCandidates) {
      if (created.length >= limit) break;
      if (scored.score < MINIMUM_SCORE_THRESHOLD) break;

      const domain = scored.signals.domain;

      // Skip if we already have a prospect from this domain
      const [existing] = await db
        .select()
        .from(prospects)
        .where(
          and(
            eq(prospects.tenantId, tenantId),
            or(
              eq(prospects.companyName, domain),
              sql`${prospects.website} LIKE ${`%${domain}%`}`
            )!
          )
        )
        .limit(1);

      if (existing) continue;

      const contacts = extractContacts(scored.signals);
      const companyName = contacts.companyName || scored.candidate.title.split(/[-|–—]/)[0].trim() || domain;
      const website = scored.signals.finalUrl || scored.candidate.link;

      if (contacts.emails.length > 0) {
        // Insert with real extracted email (only first email per company)
        const [prospect] = await db
          .insert(prospects)
          .values({
            tenantId,
            companyName,
            email: contacts.emails[0],
            industry: params.industry,
            country: params.country,
            website,
            researchSummary: scored.candidate.snippet,
            companyScore: scored.score,
            source: "detector",
            status: "new",
            metadata: {
              detectorScore: scored.score,
              detectorDimensions: scored.dimensionScores,
              phones: contacts.phones,
              socialLinks: contacts.socialLinks,
            },
          })
          .returning();
        created.push(prospect);
      } else {
        // No email found — try Hunter/Snov fallback, then inferred email
        let fallbackEmails: string[] = [];

        for (const provider of providers) {
          if (fallbackEmails.length > 0) break;
          try {
            if (provider === "hunter") {
              const results = await hunterDiscover(domain, { limit: 2 });
              fallbackEmails = results
                .map((r: HunterEmailResult) => r.value)
                .filter(Boolean);
            } else if (provider === "snovio") {
              const results = await snovDiscover(domain, { limit: 2 });
              fallbackEmails = results
                .map((r: SnovEmailResult) => r.email)
                .filter(Boolean);
            }
          } catch {
            // provider failed, continue
          }
        }

        const email = fallbackEmails[0] || inferEmailPattern("contact", "", domain);
        const [prospect] = await db
          .insert(prospects)
          .values({
            tenantId,
            companyName,
            email,
            industry: params.industry,
            country: params.country,
            website,
            researchSummary: scored.candidate.snippet,
            companyScore: scored.score,
            source: fallbackEmails.length > 0 ? "detector+fallback" : "detector+inferred",
            status: "new",
            metadata: {
              detectorScore: scored.score,
              detectorDimensions: scored.dimensionScores,
              fallbackUsed: fallbackEmails.length > 0,
            },
          })
          .returning();
        created.push(prospect);
      }
    }
  }

  return created;
}
