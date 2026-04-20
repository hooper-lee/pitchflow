import { db } from "@/lib/db";
import { tenants, emails, prospects, campaigns, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/integrations/resend";
import { sendFeishuAlert } from "@/lib/integrations/feishu";
import { sendWecomAlert } from "@/lib/integrations/wecom";
import { getFromAddress } from "@/lib/integrations/resend";

export interface AlertTrigger {
  type: "high_intent" | "replied" | "clicked";
  emailId: string;
  openCount?: number;
  clickCount?: number;
}

export async function processAlert(emailId: string, trigger: AlertTrigger) {
  const [email] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1);

  if (!email) return;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, email.campaignId))
    .limit(1);

  if (!campaign) return;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, campaign.tenantId))
    .limit(1);

  if (!tenant) return;

  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, email.prospectId))
    .limit(1);

  const settings = (tenant.settings as Record<string, unknown>) || {};
  const alerts = (settings.alerts as Record<string, { enabled?: boolean; url?: string }>) || {};

  const message = buildAlertMessage(trigger, prospect, campaign.name);
  const recipientEmail = await getAlertRecipientEmail(campaign.tenantId, settings);

  // Email alert
  if (alerts.email?.enabled !== false && recipientEmail) {
    try {
      const fromAddress = await getFromAddress();
      await sendEmail({
        from: fromAddress,
        to: recipientEmail,
        subject: `[PitchFlow] ${message.title}`,
        html: message.html,
      });
    } catch (err) {
      console.error("Email alert failed:", err);
    }
  }

  // Feishu alert
  if (alerts.feishu?.enabled && alerts.feishu.url) {
    try {
      await sendFeishuAlert(alerts.feishu.url, message.text);
    } catch (err) {
      console.error("Feishu alert failed:", err);
    }
  }

  // WeCom alert
  if (alerts.wecom?.enabled && alerts.wecom.url) {
    try {
      await sendWecomAlert(alerts.wecom.url, message.text);
    } catch (err) {
      console.error("WeCom alert failed:", err);
    }
  }
}

async function getAlertRecipientEmail(
  tenantId: string,
  settings: Record<string, unknown>
): Promise<string | undefined> {
  const configuredRecipient = ((settings.alerts as Record<string, unknown>)?.recipientEmail as string) || "";
  if (configuredRecipient) {
    return configuredRecipient;
  }

  const [teamAdmin] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .limit(1);

  return teamAdmin?.email || undefined;
}

function buildAlertMessage(
  trigger: AlertTrigger,
  prospect: { contactName?: string | null; email?: string | null; companyName?: string | null } | undefined,
  campaignName: string
) {
  const name = prospect?.contactName || "未知联系人";
  const company = prospect?.companyName || "未知公司";
  const email = prospect?.email || "";

  switch (trigger.type) {
    case "high_intent":
      return {
        title: `高意向客户: ${name} (${company})`,
        text: `🔥 高意向客户告警\n\n联系人: ${name}\n公司: ${company}\n邮箱: ${email}\n活动: ${campaignName}\n打开次数: ${trigger.openCount || "多次"}`,
        html: `<h2>🔥 高意向客户告警</h2><p><strong>联系人:</strong> ${name}<br/><strong>公司:</strong> ${company}<br/><strong>邮箱:</strong> ${email}<br/><strong>活动:</strong> ${campaignName}<br/><strong>打开次数:</strong> ${trigger.openCount || "多次"}</p>`,
      };
    case "replied":
      return {
        title: `客户回复: ${name} (${company})`,
        text: `✉️ 客户回复告警\n\n联系人: ${name}\n公司: ${company}\n邮箱: ${email}\n活动: ${campaignName}`,
        html: `<h2>✉️ 客户回复告警</h2><p><strong>联系人:</strong> ${name}<br/><strong>公司:</strong> ${company}<br/><strong>邮箱:</strong> ${email}<br/><strong>活动:</strong> ${campaignName}</p>`,
      };
    case "clicked":
      return {
        title: `客户点击: ${name} (${company})`,
        text: `🔗 客户点击链接告警\n\n联系人: ${name}\n公司: ${company}\n邮箱: ${email}\n活动: ${campaignName}\n点击次数: ${trigger.clickCount || 1}`,
        html: `<h2>🔗 客户点击链接告警</h2><p><strong>联系人:</strong> ${name}<br/><strong>公司:</strong> ${company}<br/><strong>邮箱:</strong> ${email}<br/><strong>活动:</strong> ${campaignName}<br/><strong>点击次数:</strong> ${trigger.clickCount || 1}</p>`,
      };
  }
}
