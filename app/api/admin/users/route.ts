import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, ilike, count } from "drizzle-orm";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) {
      conditions.push(ilike(users.email, `%${search}%`));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(users)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    const allUsers = await db
      .select()
      .from(users)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return apiResponse({
      users: allUsers,
      total: Number(totalResult?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
