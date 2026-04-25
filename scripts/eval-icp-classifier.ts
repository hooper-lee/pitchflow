import { readFile } from "node:fs/promises";
import {
  evaluateGoldenSet,
  evaluateGoldenSetAB,
  resolveVariantFromEnv,
  type GoldenSet,
} from "@/lib/discovery/eval/icp-classifier-eval";

const DEFAULT_GOLDEN_SET_PATH = "data/eval/icp-golden-set.example.json";

async function main() {
  const goldenSetPath = process.argv.slice(2).find((argument) => !argument.startsWith("--")) || DEFAULT_GOLDEN_SET_PATH;
  const goldenSets = await loadGoldenSets(goldenSetPath);
  const reports = process.argv.includes("--ab")
    ? goldenSets.map(evaluateGoldenSetAB)
    : goldenSets.map((goldenSet) => evaluateGoldenSet(goldenSet, resolveVariantFromEnv()));
  console.log(JSON.stringify(reports, null, 2));
}

async function loadGoldenSets(filePath: string): Promise<GoldenSet[]> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as GoldenSet[];
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
