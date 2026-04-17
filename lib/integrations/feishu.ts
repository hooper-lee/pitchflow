export async function sendFeishuAlert(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text },
      }),
    });

    const data = await res.json();
    return data.code === 0 || data.StatusCode === 0;
  } catch (error) {
    console.error("Feishu webhook error:", error);
    return false;
  }
}
