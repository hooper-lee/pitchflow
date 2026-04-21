import { db } from "@/lib/db";
import { tenants, emails, prospects, campaigns, users, emailReplies } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendFeishuAlert } from "@/lib/integrations/feishu";
import { sendWecomAlert } from "@/lib/integrations/wecom";
import { submitEmailEngineMessage } from "@/lib/integrations/emailengine";
import {
  getDefaultTenantMailAccount,
  getMailAccountByEmail,
} from "@/lib/services/mail-account.service";

function resolveTrackingSettings(settings: Record<string, unknown>) {
  return (
    (settings.tracking as Record<string, { enabled?: boolean; url?: string }>) ||
    (settings.alerts as Record<string, { enabled?: boolean; url?: string }>) ||
    {}
  );
}

export interface AlertTrigger {
  type: "replied";
  emailId: string;
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

  const [latestReply] = await db
    .select()
    .from(emailReplies)
    .where(eq(emailReplies.emailId, email.id))
    .orderBy(desc(emailReplies.receivedAt))
    .limit(1);

  const settings = (tenant.settings as Record<string, unknown>) || {};
  const tracking = resolveTrackingSettings(settings);

  const message = buildAlertMessage(trigger, prospect, campaign.name, latestReply);
  const recipientEmail = await getAlertRecipientEmail(campaign.tenantId, settings);

  // Email alert
  if (tracking.email?.enabled !== false && recipientEmail) {
    try {
      await sendEmailAlert(campaign.tenantId, recipientEmail, message);
    } catch (err) {
      console.error("Email alert failed:", err);
    }
  }

  // Feishu alert
  if (tracking.feishu?.enabled && tracking.feishu.url) {
    try {
      await sendFeishuAlert(tracking.feishu.url, message.text);
    } catch (err) {
      console.error("Feishu alert failed:", err);
    }
  }

  // WeCom alert
  if (tracking.wecom?.enabled && tracking.wecom.url) {
    try {
      await sendWecomAlert(tracking.wecom.url, message.text);
    } catch (err) {
      console.error("WeCom alert failed:", err);
    }
  }
}

async function sendEmailAlert(
  tenantId: string,
  recipientEmail: string,
  message: { title: string; text: string; html: string }
) {
  const recipientAccount = await getMailAccountByEmail(tenantId, recipientEmail);
  const senderAccount = recipientAccount || await getDefaultTenantMailAccount(tenantId);

  if (!senderAccount) {
    throw new Error("No connected mailbox available for alert delivery");
  }

  const messageId = buildAlertMessageId(message.title, senderAccount.email);
  await submitEmailEngineMessage(senderAccount.accountKey, {
    from: {
      address: senderAccount.email,
      name: senderAccount.name || "PitchFlow Alerts",
    },
    to: [{ address: recipientEmail }],
    subject: `[PitchFlow] ${message.title}`,
    text: message.text,
    html: message.html,
    messageId,
    headers: {
      "X-PitchFlow-Alert": "true",
      "X-Auto-Response-Suppress": "OOF, AutoReply",
    },
  });
}

async function getAlertRecipientEmail(
  tenantId: string,
  settings: Record<string, unknown>
): Promise<string | undefined> {
  const configuredRecipient = (resolveTrackingSettings(settings).recipientEmail as string) || "";
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
  campaignName: string,
  latestReply:
    | {
        fromName?: string | null;
        fromEmail?: string | null;
        subject?: string | null;
        textBody?: string | null;
        receivedAt?: Date | null;
      }
    | undefined
) {
  const name = prospect?.contactName || "未知联系人";
  const company = prospect?.companyName || "未知公司";
  const email = prospect?.email || "";
  const replySender = latestReply?.fromName || latestReply?.fromEmail || name;
  const replySubject = latestReply?.subject || "无主题";
  const replyTime = latestReply?.receivedAt
    ? latestReply.receivedAt.toLocaleString("zh-CN")
    : "刚刚";
  const replySummary = summarizeReply(latestReply?.textBody);

  switch (trigger.type) {
    case "replied":
      return {
        title: `客户已回复：${company}`,
        text: [
          "客户回复追踪",
          "",
          `联系人：${name}`,
          `公司：${company}`,
          `客户邮箱：${email}`,
          `活动：${campaignName}`,
          `回复人：${replySender}`,
          `回复主题：${replySubject}`,
          `回复时间：${replyTime}`,
          "",
          "回复摘要：",
          replySummary,
        ].join("\n"),
        html: [
          "<h2>客户回复追踪</h2>",
          `<p><strong>联系人：</strong>${name}<br/>`,
          `<strong>公司：</strong>${company}<br/>`,
          `<strong>客户邮箱：</strong>${email}<br/>`,
          `<strong>活动：</strong>${campaignName}<br/>`,
          `<strong>回复人：</strong>${replySender}<br/>`,
          `<strong>回复主题：</strong>${replySubject}<br/>`,
          `<strong>回复时间：</strong>${replyTime}</p>`,
          "<p><strong>回复摘要：</strong></p>",
          `<blockquote style="margin:0;padding:12px 16px;border-left:4px solid #cbd5e1;background:#f8fafc;color:#334155;">${escapeHtml(replySummary)}</blockquote>`,
        ].join(""),
      };
  }
}

function buildAlertMessageId(title: string, fromEmail: string) {
  const domain = fromEmail.split("@")[1] || "pitchflow.local";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "alert";
  return `<pitchflow-alert-${slug}-${Date.now()}@${domain}>`;
}

function summarizeReply(textBody?: string | null) {
  if (!textBody) {
    return "客户已回复，但当前没有抓取到可展示的正文摘要。";
  }

  const normalized = textBody
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "客户已回复，但当前没有抓取到可展示的正文摘要。";
  }

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function escapeHtml(content: string) {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
