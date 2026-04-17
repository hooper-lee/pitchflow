const COMMON_PATTERNS = [
  "{first}.{last}@{domain}",
  "{first}{last}@{domain}",
  "{f}{last}@{domain}",
  "{first}_{last}@{domain}",
  "{first}@{domain}",
  "{last}@{domain}",
  "{f}.{last}@{domain}",
];

export function generateEmailVariants(
  firstName: string,
  lastName: string,
  domain: string
): string[] {
  const first = firstName.toLowerCase().trim();
  const last = lastName.toLowerCase().trim();
  const f = first[0] || "";

  return COMMON_PATTERNS.map((pattern) =>
    pattern
      .replace("{first}", first)
      .replace("{last}", last)
      .replace("{f}", f)
      .replace("{domain}", domain)
  );
}

export function inferEmailPattern(
  firstName: string,
  lastName: string,
  domain: string
): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
}
