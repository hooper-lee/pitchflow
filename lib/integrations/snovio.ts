import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SNOV_API_BASE = "https://api.snov.io";

interface SnovToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: SnovToken | null = null;

async function getConfig(key: string, envFallback: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  return process.env[envFallback] || null;
}

async function getAccessToken(): Promise<string> {
  const clientId = await getConfig("SNOV_CLIENT_ID", "SNOV_CLIENT_ID");
  const clientSecret = await getConfig("SNOV_CLIENT_SECRET", "SNOV_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("SNOV_CLIENT_ID or SNOV_CLIENT_SECRET not configured");
  }

  // Return cached token if still valid
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const res = await fetch(`${SNOV_API_BASE}/v1/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`Snov.io auth error: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.access_token;
}

async function snovRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${SNOV_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Snov.io API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function pollTask<T>(resultEndpoint: string, maxRetries = 10): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 1000 : 2000));
    const result = await snovRequest<any>(resultEndpoint);
    if (result.data && !result.data.is_in_progress) {
      return result.data;
    }
  }
  throw new Error("Snov.io task timed out");
}

export interface SnovProspect {
  first_name: string;
  last_name: string;
  position: string;
  source_page: string; // LinkedIn URL
  emails: { email: string; status: string }[];
}

export interface SnovEmailResult {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  linkedinUrl?: string;
}

export async function discoverEmails(
  domain: string,
  options: { limit?: number; positions?: string[] } = {}
): Promise<SnovEmailResult[]> {
  try {
    const limit = options.limit || 10;

    // Step 1: Start domain search
    const startResult = await snovRequest<{ data: { task_hash: string } }>(
      "/v2/domain-search/start",
      {
        method: "POST",
        body: JSON.stringify({ domain }),
      }
    );

    // Step 2: Get domain search results
    const domainResult = await pollTask<any>(
      `/v2/domain-search/result/${startResult.data.task_hash}`
    );

    if (!domainResult.prospects_url) return [];

    // Step 3: Get prospect profiles with optional position filter
    const prospectsBody: Record<string, any> = { domain };
    if (options.positions?.length) {
      prospectsBody.positions = options.positions;
    }

    const prospectsStart = await snovRequest<{ data: { task_hash: string } }>(
      "/v2/domain-search/prospects/start",
      {
        method: "POST",
        body: JSON.stringify(prospectsBody),
      }
    );

    const prospectsResult = await pollTask<{ prospects: SnovProspect[] }>(
      `/v2/domain-search/prospects/result/${prospectsStart.data.task_hash}`
    );

    // Step 4: For each prospect, find their email
    const results: SnovEmailResult[] = [];
    const prospects = (prospectsResult.prospects || []).slice(0, limit);

    for (const prospect of prospects) {
      if (!prospect.source_page) continue;

      try {
        const emailStart = await snovRequest<{ data: { task_hash: string } }>(
          `/v2/domain-search/prospects/search-emails/start/${prospect.source_page}`,
          { method: "POST" }
        );

        const emailResult = await pollTask<{ emails: { email: string; status: string }[] }>(
          `/v2/domain-search/prospects/search-emails/result/${emailStart.data.task_hash}`
        );

        const validEmail = emailResult.emails?.find(
          (e) => e.status === "valid" || e.status === "accept_all"
        ) || emailResult.emails?.[0];

        if (validEmail) {
          results.push({
            email: validEmail.email,
            firstName: prospect.first_name || "",
            lastName: prospect.last_name || "",
            position: prospect.position || "",
            linkedinUrl: prospect.source_page || undefined,
          });
        }
      } catch {
        // Skip this prospect if email lookup fails
        continue;
      }
    }

    return results;
  } catch (err) {
    console.error("Snov.io discoverEmails error:", err);
    return [];
  }
}

export async function checkEmailCount(domain: string): Promise<number> {
  try {
    const data = await snovRequest<{ data: { result: number } }>(
      "/v1/get-domain-emails-count",
      {
        method: "POST",
        body: JSON.stringify({ domain }),
      }
    );
    return data.data?.result || 0;
  } catch {
    return 0;
  }
}
