import { auth } from "./config";

export { auth, signIn, signOut } from "./config";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class TenantRequiredError extends Error {
  constructor(message = "Tenant context required") {
    super(message);
    this.name = "TenantRequiredError";
  }
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export async function requireTenant() {
  const user = await requireAuth();
  if (!user.tenantId) throw new TenantRequiredError();
  return { user, tenantId: user.tenantId };
}
