export const ROLES = {
  super_admin: "super_admin",
  team_admin: "team_admin",
  member: "member",
  viewer: "viewer",
} as const;

export type UserRole = keyof typeof ROLES;

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  team_admin: [
    "campaigns:read",
    "campaigns:write",
    "campaigns:delete",
    "prospects:read",
    "prospects:write",
    "prospects:delete",
    "templates:read",
    "templates:write",
    "templates:delete",
    "team:read",
    "team:write",
    "api_keys:read",
    "api_keys:write",
    "settings:read",
    "settings:write",
    "analytics:read",
  ],
  member: [
    "campaigns:read",
    "campaigns:write",
    "prospects:read",
    "prospects:write",
    "templates:read",
    "templates:write",
    "analytics:read",
  ],
  viewer: [
    "campaigns:read",
    "prospects:read",
    "templates:read",
    "analytics:read",
  ],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (perms.includes("*")) return true;
  return perms.includes(permission);
}
