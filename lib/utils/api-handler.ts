import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, TenantRequiredError } from "@/lib/auth";

export class QuotaExceededError extends Error {
  constructor(message = "Quota exceeded") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof ZodError) {
    return apiError("Validation failed", 400, error.errors);
  }
  if (error instanceof UnauthorizedError) {
    return apiError("Unauthorized", 401);
  }
  if (error instanceof TenantRequiredError) {
    return apiError("Tenant context required", 400);
  }
  if (error instanceof QuotaExceededError) {
    return apiError("Quota exceeded", 429);
  }
  return apiError("Internal server error", 500);
}
