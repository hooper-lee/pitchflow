import crypto from "crypto";
import { nanoid } from "nanoid";

export function generateApiKey(): string {
  return `ac_live_${nanoid(32)}`;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
