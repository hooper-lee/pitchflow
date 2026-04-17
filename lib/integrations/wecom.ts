export async function sendWecomAlert(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: text },
      }),
    });

    const data = await res.json();
    return data.errcode === 0;
  } catch (error) {
    console.error("WeCom webhook error:", error);
    return false;
  }
}
