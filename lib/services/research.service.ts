import { db } from "@/lib/db";
import { prospects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchCompany, searchNews } from "@/lib/integrations/serpapi";
import { getAIProvider, RESEARCH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { researchProspect as claudeResearch } from "@/lib/ai/claude";
import { researchProspect as openaiResearch } from "@/lib/ai/openai";

export async function researchProspect(
  prospectId: string,
  tenantId: string,
  aiProvider: "claude" | "openai" = "claude"
) {
  // Get prospect
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(
      and(eq(prospects.id, prospectId), eq(prospects.tenantId, tenantId))
    )
    .limit(1);

  if (!prospect) throw new Error("Prospect not found");

  // Gather data
  const [companyResults, newsResults] = await Promise.all([
    searchCompany(prospect.companyName || prospect.website || ""),
    searchNews(prospect.companyName || ""),
  ]);

  // Fetch website content (basic)
  let websiteContent = "";
  if (prospect.website) {
    try {
      const res = await fetch(prospect.website, {
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      // Basic text extraction - strip HTML tags
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
    } catch {
      // Website not accessible
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

--- Google Search Results ---
${companyResults.map((r) => `- ${r.title}: ${r.snippet}`).join("\n") || "None"}

--- Recent News ---
${newsResults.map((r) => `- ${r.title}: ${r.snippet}`).join("\n") || "None"}
`;

  // Generate AI research report
  const prompt = `${RESEARCH_SYSTEM_PROMPT}\n\nAnalyze this company:\n\n${context}`;

  let summary: string;
  if (aiProvider === "openai") {
    summary = await openaiResearch({ prompt });
  } else {
    summary = await claudeResearch({ prompt });
  }

  // Update prospect with research data
  await db
    .update(prospects)
    .set({
      researchSummary: summary,
      researchData: {
        companyResults: companyResults.slice(0, 5),
        newsResults: newsResults.slice(0, 5),
        websiteContent: websiteContent.slice(0, 1000),
        researchedAt: new Date().toISOString(),
      },
      status: "researched",
      updatedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  return summary;
}
