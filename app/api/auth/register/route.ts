import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "请填写邮箱和密码" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "密码至少 8 位" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "该邮箱已注册" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create tenant for the user
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: name ? `${name} 的团队` : `${email.split("@")[0]} 的团队`,
        plan: "free",
      })
      .returning();

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: name || null,
        passwordHash,
        role: "team_admin",
        tenantId: tenant.id,
      })
      .returning();

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "注册失败" },
      { status: 500 }
    );
  }
}
