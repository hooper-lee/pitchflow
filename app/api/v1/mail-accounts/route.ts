import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { createMailAccountSchema } from "@/lib/utils/validators";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";
import { createMailAccount, listMailAccounts } from "@/lib/services/mail-account.service";
import { getReadableMailAccountError } from "@/lib/services/mail-account-error";

export async function GET() {
  try {
    const { tenantId, user } = await requireTenant();
    const accounts = await listMailAccounts(tenantId, user.id);
    return apiResponse(accounts);
  } catch (error) {
    if (error instanceof Error) {
      return apiError(getReadableMailAccountError(error.message), 400);
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireTenant();
    const body = await request.json();
    const input = createMailAccountSchema.parse(body);
    const account = await createMailAccount(
      tenantId,
      user.id,
      user.email || "",
      input
    );
    return apiResponse(account, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
