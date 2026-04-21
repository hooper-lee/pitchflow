import { NextRequest } from "next/server";
import { requireTenant } from "@/lib/auth";
import { apiError, apiResponse, handleApiError } from "@/lib/utils/api-handler";
import {
  deleteMailAccount,
  reconnectMailAccount,
  setDefaultMailAccount,
  syncMailAccount,
} from "@/lib/services/mail-account.service";
import { getReadableMailAccountError } from "@/lib/services/mail-account-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId, user } = await requireTenant();
    const body = await request.json();

    if (body.action === "set_default") {
      const account = await setDefaultMailAccount(tenantId, user.id, params.id);
      if (!account) return apiError("Mailbox not found", 404);
      return apiResponse(account);
    }

    if (body.action === "reconnect") {
      const account = await reconnectMailAccount(tenantId, user.id, params.id);
      if (!account) return apiError("Mailbox not found", 404);
      return apiResponse(account);
    }

    if (body.action === "sync") {
      const account = await syncMailAccount(tenantId, user.id, params.id);
      if (!account) return apiError("Mailbox not found", 404);
      return apiResponse(account);
    }

    return apiError("Unsupported action", 400);
  } catch (error) {
    if (error instanceof Error) {
      return apiError(getReadableMailAccountError(error.message), 400);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId, user } = await requireTenant();
    const deleted = await deleteMailAccount(tenantId, user.id, params.id);
    if (!deleted) return apiError("Mailbox not found", 404);
    return apiResponse({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return apiError(getReadableMailAccountError(error.message), 400);
    }
    return handleApiError(error);
  }
}
