export function getReadableMailAccountError(message: string) {
  if (message.includes("BasicAuthBlocked")) {
    return "Outlook / Hotmail 已禁用基础认证，当前不能用账号密码直连。请改用 Gmail 测试，或后续接入 Outlook OAuth。";
  }

  if (message.includes("Invalid login") || message.includes("AUTHENTICATE failed")) {
    return "邮箱认证失败。请检查邮箱地址、IMAP/SMTP 用户名，或确认是否应该使用 App Password。";
  }

  if (message.includes("Application-specific password required")) {
    return "当前邮箱要求使用 App Password，不能直接填登录密码。";
  }

  if (message.includes("EmailEngine not configured")) {
    return "邮件服务尚未配置完成，请刷新页面后重试。";
  }

  if (message.startsWith("EmailEngine error:")) {
    return message.replace(/^EmailEngine error:\s*/, "");
  }

  return message;
}
