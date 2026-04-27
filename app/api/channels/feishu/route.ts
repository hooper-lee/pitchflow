import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body?.type === "url_verification" && body?.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  return NextResponse.json(
    {
      error: "Feishu Agent channel is not bound yet",
      message: "请先完成用户身份绑定后再启用飞书 Agent 私聊入口。",
    },
    { status: 501 }
  );
}
