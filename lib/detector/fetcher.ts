import * as cheerio from "cheerio";
import type { DetectorConfig } from "./types";
import { FETCH_TIMEOUT_MS } from "./constants";

export interface FetchResult {
  html: string;
  $: cheerio.CheerioAPI;
  finalUrl: string;
  httpStatus: number;
  durationMs: number;
  method: "cheerio" | "playwright";
  error?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function fetchWithCheerio(url: string): Promise<FetchResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    return {
      html,
      $,
      finalUrl: res.url || url,
      httpStatus: res.status,
      durationMs: Date.now() - start,
      method: "cheerio",
    };
  } catch (err) {
    return {
      html: "",
      $: cheerio.load(""),
      finalUrl: url,
      httpStatus: 0,
      durationMs: Date.now() - start,
      method: "cheerio",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchWithPlaywright(url: string): Promise<FetchResult> {
  const start = Date.now();
  try {
    // Playwright is optional — installed separately via: npm install playwright && npx playwright install chromium
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = require("playwright");
    const chromium = pw.chromium as { launch: (opts: { headless: boolean }) => Promise<{ close: () => Promise<void>; newPage: () => Promise<{ goto: (url: string, opts: { timeout: number; waitUntil: string }) => Promise<void>; content: () => Promise<string>; url: () => string }> }> };
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { timeout: FETCH_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    const html = await page.content();
    const finalUrl = page.url();
    await browser.close();

    const $ = cheerio.load(html);
    return {
      html,
      $,
      finalUrl,
      httpStatus: 200,
      durationMs: Date.now() - start,
      method: "playwright",
    };
  } catch (err) {
    return {
      html: "",
      $: cheerio.load(""),
      finalUrl: url,
      httpStatus: 0,
      durationMs: Date.now() - start,
      method: "playwright",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchPage(
  url: string,
  config: DetectorConfig
): Promise<FetchResult> {
  const cheerioResult = await fetchWithCheerio(url);

  // If cheerio got a 200 but page looks empty and playwright is enabled, try playwright
  if (
    config.enablePlaywright &&
    cheerioResult.httpStatus === 200 &&
    !cheerioResult.error &&
    cheerioResult.$("body").text().trim().length < 200
  ) {
    try {
      const pwResult = await fetchWithPlaywright(url);
      if (pwResult.httpStatus === 200 && !pwResult.error) {
        return pwResult;
      }
    } catch {
      // Playwright failed, return cheerio result
    }
  }

  return cheerioResult;
}
