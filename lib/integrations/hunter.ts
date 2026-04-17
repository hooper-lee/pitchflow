import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const HUNTER_API_BASE = "https://api.hunter.io/v2";

async function getApiKey(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "HUNTER_IO_API_KEY"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  return process.env.HUNTER_IO_API_KEY || null;
}

export interface HunterEmailResult {
  value: string;
  type: string;
  confidence: number;
  sources: { domain: string; uri: string; extracted_on: string }[];
  first_name: string;
  last_name: string;
  position: string;
  seniority: string;
  department: string;
  linkedin: string;
  twitter: string;
  phone_number: string;
}

export interface HunterDomainSearchResponse {
  data: {
    domain: string;
    emails: HunterEmailResult[];
    organization: string;
    country: string;
    webmail: boolean;
    pattern: string | null;
  };
}

export async function discoverEmails(
  domain: string,
  options: { limit?: number; type?: string } = {}
): Promise<HunterEmailResult[]> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn("HUNTER_IO_API_KEY not configured");
    return [];
  }

  const params = new URLSearchParams({
    domain,
    api_key: apiKey,
    limit: String(options.limit || 10),
  });

  if (options.type) {
    params.set("type", options.type);
  }

  const res = await fetch(`${HUNTER_API_BASE}/domain-search?${params}`);
  if (!res.ok) {
    throw new Error(`Hunter.io API error: ${res.status}`);
  }

  const data: HunterDomainSearchResponse = await res.json();
  return data.data.emails || [];
}

export async function verifyEmail(email: string): Promise<boolean> {
  const apiKey = await getApiKey();
  if (!apiKey) return false;

  const params = new URLSearchParams({
    email,
    api_key: apiKey,
  });

  try {
    const res = await fetch(`${HUNTER_API_BASE}/email-verifier?${params}`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.data?.result === "deliverable";
  } catch {
    return false;
  }
}
