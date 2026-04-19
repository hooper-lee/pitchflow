import { db } from "@/lib/db";
import { prospects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchCompany, searchNews } from "@/lib/integrations/serpapi";
import { RESEARCH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { researchProspect as claudeResearch } from "@/lib/ai/claude";
import { researchProspect as openaiResearch } from "@/lib/ai/openai";
import { getTenantPlan } from "@/lib/services/quota.service";

export interface ResearchResult {
  summary: string;
  companyScore?: number;
  matchScore?: number;
  basicInfo?: string;
}

export async function researchProspect(
  prospectId: string,
  tenantId: string,
  aiProvider: "claude" | "openai" = "claude"
): Promise<ResearchResult> {
  // Get prospect
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId))
    )
    .limit(1);

  if (!prospect) throw new Error("Prospect not found");

  // Check plan tier
  const plan = await getTenantPlan(tenantId);

  // Gather search data (always)
  const [companyResults, newsResults] = await Promise.all([
    searchCompany(prospect.companyName || prospect.website || ""),
    searchNews(prospect.companyName || ""),
  ]);

  // Free plan: basic info only
  if (plan === "free") {
    const basicInfo = companyResults.length > 0
      ? companyResults.slice(0, 3).map((r) => `- ${r.title}: ${r.snippet}`).join("\n")
      : "暂无搜索结果";

    await db
      .update(prospects)
      .set({
        researchSummary: basicInfo,
        researchData: {
          companyResults: companyResults.slice(0, 3),
          researchedAt: new Date().toISOString(),
          plan: "free",
        },
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, prospectId));

    return { summary: basicInfo, basicInfo };
  }

  // Pro/Enterprise: deep research
  let websiteContent = "";
  let aboutContent = "";

  // Fetch main website
  if (prospect.website) {
    try {
      const res = await fetch(prospect.website, {
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);
    } catch {
      // Website not accessible
    }

    // Try About page
    try {
      const domain = new URL(prospect.website).origin;
      const aboutRes = await fetch(`${domain}/about`, {
        signal: AbortSignal.timeout(10000),
      });
      const aboutHtml = await aboutRes.text();
      aboutContent = aboutHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
    } catch {
      // About page not available
    }
  }

  // Build research context
  const context = `
Company: ${prospect.companyName || "Unknown"}
Contact: ${prospect.contactName || "Unknown"}
Email: ${prospect.email || "Unknown"}
Industry: ${prospect.industry || "Unknown"}
Country: ${prospect.country || "Unknown"}
Website: ${prospect.website || "Unknown"}

--- Website Content ---
${websiteContent || "Not available"}

${aboutContent ? `--- About Page ---\n${aboutContent}\n` : ""}

--- Google Search Results (${companyResults.length}) ---
${companyResults.slice(0, 10).map((r) => `- ${r.title}: ${r.snippet} [${r.link}]`).join("\n") || "None"}

--- Recent News (${newsResults.length}) ---
${newsResults.slice(0, 8).map((r) => `- ${r.title}: ${r.snippet}`).join("\n") || "None"}
`;

  // Generate AI research report
  const structuredPrompt = `${RESEARCH_SYSTEM_PROMPT}

Analyze this company and output a JSON object with these fields:
{
  "companyOverview": "1-2 sentence company description",
  "keyFacts": { "industry": "", "size": "", "location": "", "products": "" },
  "recentDevelopments": "any recent news",
  "talkingPoints": ["point1", "point2", "point3"],
  "recommendedApproach": "best angle for outreach",
  "companyScore": 1-10,
  "matchScore": 1-10,
  "verdict": "brief conclusion on whether to pursue this prospect"
}

Score guide:
- companyScore: 1=fake/non-existent, 5=small/incomplete info, 10=large verified company
- matchScore: 1=completely irrelevant, 5=somewhat related, 10=perfect target customer

Output ONLY valid JSON, no markdown wrapping.

Analyze this company:\n\n${context}`;

  let summary: string;
  if (aiProvider === "openai") {
    summary = await openaiResearch({ prompt: structuredPrompt });
  } else {
    summary = await claudeResearch({ prompt: structuredPrompt });
  }

  // Parse scores from AI response
  let companyScore: number | undefined;
  let matchScore: number | undefined;
  let formattedSummary = summary;

  try {
    // Try to extract JSON from the response
    const jsonMatch = summary.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      companyScore = parsed.companyScore;
      matchScore = parsed.matchScore;

      // Format as readable text
      formattedSummary = [
        `## 公司概况\n${parsed.companyOverview || ""}`,
        `## 关键信息`,
        `- 行业: ${parsed.keyFacts?.industry || "未知"}`,
        `- 规模: ${parsed.keyFacts?.size || "未知"}`,
        `- 位置: ${parsed.keyFacts?.location || "未知"}`,
        `- 产品/服务: ${parsed.keyFacts?.products || "未知"}`,
        parsed.recentDevelopments ? `## 近期动态\n${parsed.recentDevelopments}` : "",
        `## 联系建议`,
        ...(parsed.talkingPoints || []).map((p: string) => `- ${p}`),
        `## 推荐策略\n${parsed.recommendedApproach || ""}`,
        `## 综合评估\n- 公司真实性: ${companyScore}/10\n- 业务匹配度: ${matchScore}/10`,
        parsed.verdict ? `\n**结论: ${parsed.verdict}**` : "",
      ].filter(Boolean).join("\n");
    }
  } catch {
    // If JSON parsing fails, use raw summary
  }

  // Update prospect with research data
  await db
    .update(prospects)
    .set({
      researchSummary: formattedSummary,
      companyScore: companyScore || null,
      matchScore: matchScore || null,
      researchData: {
        companyResults: companyResults.slice(0, 10),
        newsResults: newsResults.slice(0, 8),
        websiteContent: websiteContent.slice(0, 2000),
        aboutContent: aboutContent.slice(0, 1000),
        researchedAt: new Date().toISOString(),
        plan,
      },
      status: "researched",
      updatedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  return { summary: formattedSummary, companyScore, matchScore };
}
