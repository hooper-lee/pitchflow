import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, prospects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { searchCompany } from "@/lib/integrations/serpapi";
import { hunterDomainSearch } from "@/lib/integrations/hunter";
import { inferEmailFromPattern } from "@/lib/utils/email-patterns";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tenantId, domain, industry, country, limit = 10 } = body;

    if (!tenantId || !domain) {
      return NextResponse.json(
        { error: "tenantId and domain are required" },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Discover prospects via Hunter.io
    const hunterResults = await hunterDomainSearch(domain, limit);

    const discovered: typeof prospects.$inferInsert[] = [];

    for (const result of hunterResults) {
      const email =
        result.email ||
        inferEmailFromPattern(
          result.first_name || "",
          result.last_name || "",
          domain
        );

      if (!email) continue;

      // Check for duplicates
      const [existing] = await db
        .select()
        .from(prospects)
        .where(eq(prospects.email, email))
        .limit(1);

      if (existing) continue;

      discovered.push({
        tenantId,
        companyName: result.company || domain,
        contactName:
          [result.first_name, result.last_name].filter(Boolean).join(" ") ||
          null,
        email,
        industry: industry || null,
        country: country || null,
        website: `https://${domain}`,
        source: "hunter",
        status: "new",
      });
    }

    if (discovered.length > 0) {
      await db.insert(prospects).values(discovered);
    }

    return NextResponse.json({
      data: {
        discovered: discovered.length,
        total: hunterResults.length,
      },
    });
  } catch (error) {
    console.error("Discover prospects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
