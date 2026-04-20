export function parseJsonWithRepair<T>(text: string): T {
  const candidates = buildJsonCandidates(text);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to parse AI JSON output");
}

function buildJsonCandidates(text: string): string[] {
  const normalized = stripCodeFences(text).trim();
  const baseCandidate = extractFirstJsonObject(normalized) || normalized;
  const trailingCommaFixed = repairTrailingCommas(baseCandidate);
  const quotedKeys = quoteBareObjectKeys(trailingCommaFixed);

  return Array.from(
    new Set(
      [normalized, baseCandidate, trailingCommaFixed, quotedKeys].filter(
        (candidate): candidate is string => candidate.length > 0
      )
    )
  );
}

function stripCodeFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
}

function extractFirstJsonObject(text: string): string {
  const startIndex = text.indexOf("{");
  if (startIndex === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return text.slice(startIndex);
}

function repairTrailingCommas(text: string): string {
  let repaired = text;

  while (repaired.match(/,\s*([}\]])/)) {
    repaired = repaired.replace(/,\s*([}\]])/g, "$1");
  }

  return repaired;
}

function quoteBareObjectKeys(text: string): string {
  return text.replace(
    /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g,
    '$1"$2"$3'
  );
}
