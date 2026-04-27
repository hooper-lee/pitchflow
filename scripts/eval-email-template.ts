import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expandEmailGoldenSet } from "@/lib/email/eval/email-golden-set";
import {
  evaluateEmailAB,
  evaluateEmailVariant,
} from "@/lib/email/eval/email-template-eval";
import type {
  EmailGoldenSetSeed,
  EmailVariant,
} from "@/lib/email/eval/email-eval-types";

const DEFAULT_GOLDEN_SET_PATH = "data/eval/golden-sets/email/email-ab.example.json";
const DEFAULT_REPORT_PATH = "data/eval/reports/email/latest-email-template-ab.json";

async function main() {
  const argumentsList = process.argv.slice(2);
  const goldenSetPath = readPositionalPath(argumentsList) || DEFAULT_GOLDEN_SET_PATH;
  const reportPath = readOption(argumentsList, "--output") || DEFAULT_REPORT_PATH;
  const seed = await loadGoldenSet(goldenSetPath);
  const samples = expandEmailGoldenSet(seed);
  const report = argumentsList.includes("--ab")
    ? evaluateEmailAB(samples)
    : evaluateEmailVariant(samples, resolveVariant());

  await writeJsonReport(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

async function loadGoldenSet(filePath: string): Promise<EmailGoldenSetSeed> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as EmailGoldenSetSeed;
}

function resolveVariant(): EmailVariant {
  return process.env.EMAIL_OUTREACH_PROMPT_VARIANT === "A" ? "A" : "B";
}

function readOption(argumentsList: string[], optionName: string) {
  const optionIndex = argumentsList.indexOf(optionName);
  if (optionIndex === -1) return null;
  return argumentsList[optionIndex + 1] || null;
}

function readPositionalPath(argumentsList: string[]) {
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const previousArgument = argumentsList[index - 1];
    if (argument.startsWith("--")) continue;
    if (previousArgument === "--output") continue;
    return argument;
  }
  return null;
}

async function writeJsonReport(filePath: string, report: unknown) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
