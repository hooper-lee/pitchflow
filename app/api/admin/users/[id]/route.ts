import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiResponse, apiError, handleApiError } from "@/lib/utils/api-handler";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);

    if (!user) return apiError("User not found", 404);
    return apiResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.role) updateData.role = body.role;
    if (body.name !== undefined) updateData.name = body.name;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, params.id))
      .returning();

    if (!user) return apiError("User not found", 404);
    return apiResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
