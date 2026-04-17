import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { apiResponse, handleApiError } from "@/lib/utils/api-handler";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const tenantId = searchParams.get("tenantId");
    const offset = (page - 1) * limit;

    const conditions = [];
    if (tenantId) {
      conditions.push(eq(auditLogs.tenantId, tenantId));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(conditions.length > 0 ? conditions[0] : undefined);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return apiResponse({
      logs,
      total: Number(totalResult?.count || 0),
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
