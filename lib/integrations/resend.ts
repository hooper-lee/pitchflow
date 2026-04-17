import { Resend } from "resend";
import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface SendEmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id: string;
}

let resendClient: Resend | null = null;

async function getApiKey(): Promise<string> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "RESEND_API_KEY"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return key;
}

async function getFromAddress(): Promise<string> {
  try {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "RESEND_FROM_EMAIL"))
      .limit(1);
    if (row?.value) return row.value;
  } catch {
    // DB not available
  }
  return process.env.RESEND_FROM_EMAIL || "noreply@localhost";
}

async function getResendClient(): Promise<Resend> {
  if (!resendClient) {
    const apiKey = await getApiKey();
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const client = await getResendClient();

  const { data, error } = await client.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    tags: params.tags,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { id: data!.id };
}

export { getFromAddress };
