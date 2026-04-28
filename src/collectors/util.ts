/**
 * Format an epoch-ms timestamp as YYYY-MM-DD in the given IANA timezone.
 * Uses en-CA which renders as ISO date.
 */
export function dateInTz(ms: number, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date(ms));
}

/** Format a UTC date as YYYY/MM/DD path segments — Codex uses these literally. */
export function utcPathParts(ms: number): { y: string; m: string; d: string } {
  const date = new Date(ms);
  return {
    y: String(date.getUTCFullYear()),
    m: String(date.getUTCMonth() + 1).padStart(2, "0"),
    d: String(date.getUTCDate()).padStart(2, "0"),
  };
}
