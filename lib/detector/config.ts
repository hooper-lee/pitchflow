import { db } from "@/lib/db";
import { systemConfigs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import type { DetectorConfig, ScoreWeights } from "./types";
import {
  DEFAULT_CONFIG,
  DEFAULT_BLOCKED_DOMAINS,
  DEFAULT_BLOCKED_TLDS,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_NAV_KEYWORDS,
} from "./constants";

function parseJsonArray(raw: string | null | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return fallback;
    // Filter out comment lines (starting with #) just in case
    return v.filter((item) => typeof item === "string" && !item.startsWith("#"));
  } catch {
    return fallback;
  }
}

function parseJsonRecord<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? v : fallback;
  } catch {
    return fallback;
  }
}

export async function getDetectorConfig(): Promise<DetectorConfig> {
  try {
    const rows = await db
      .select({ key: systemConfigs.key, value: systemConfigs.value })
      .from(systemConfigs)
      .where(
        or(
          eq(systemConfigs.key, "DETECTOR_BLOCKED_DOMAINS"),
          eq(systemConfigs.key, "DETECTOR_BLOCKED_TLDS"),
          eq(systemConfigs.key, "DETECTOR_SCORE_WEIGHTS"),
          eq(systemConfigs.key, "DETECTOR_NAV_KEYWORDS"),
          eq(systemConfigs.key, "DETECTOR_ENABLE_PLAYWRIGHT")
        )
      );

    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    return {
      blockedDomains: parseJsonArray(map.DETECTOR_BLOCKED_DOMAINS, DEFAULT_BLOCKED_DOMAINS),
      blockedTlds: parseJsonArray(map.DETECTOR_BLOCKED_TLDS, DEFAULT_BLOCKED_TLDS),
      scoreWeights: parseJsonRecord<ScoreWeights>(map.DETECTOR_SCORE_WEIGHTS, DEFAULT_SCORE_WEIGHTS),
      navKeywords: parseJsonRecord(map.DETECTOR_NAV_KEYWORDS, DEFAULT_NAV_KEYWORDS),
      enablePlaywright: map.DETECTOR_ENABLE_PLAYWRIGHT === "true",
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
