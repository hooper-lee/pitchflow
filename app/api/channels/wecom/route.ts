import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const echo = request.nextUrl.searchParams.get("echostr");
  return new NextResponse(echo || "ok");
}

export async function POST() {
  return NextResponse.json(
    {
      error: "WeCom Agent channel is not bound yet",
      message: "请先完成用户身份绑定后再启用企业微信 Agent 私聊入口。",
    },
    { status: 501 }
  );
}
