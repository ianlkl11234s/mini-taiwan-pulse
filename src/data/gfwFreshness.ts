const DAY_MS = 86_400_000;

export type GfwFreshnessStatus = "current" | "delayed" | "stale" | "invalid";

export interface GfwFreshness {
  readonly date: string;
  readonly ageDays: number | null;
  readonly status: GfwFreshnessStatus;
  readonly label: string;
}

export function gfwFreshness(date: string, now = Date.now()): GfwFreshness {
  const releaseMs = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(releaseMs) || !Number.isFinite(now)
    || new Date(releaseMs).toISOString().slice(0, 10) !== date) {
    return { date, ageDays: null, status: "invalid", label: `${date || "未提供"} UTC（日期異常）` };
  }
  const todayUtcMs = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const ageDays = Math.floor((todayUtcMs - releaseMs) / DAY_MS);
  if (ageDays < 0) return { date, ageDays, status: "invalid", label: `${date} UTC（未來日期）` };
  if (ageDays <= 7) return { date, ageDays, status: "current", label: `${date} UTC（落後 ${ageDays} 天）` };
  if (ageDays <= 14) return { date, ageDays, status: "delayed", label: `${date} UTC（落後 ${ageDays} 天 · DELAYED）` };
  return { date, ageDays, status: "stale", label: `${date} UTC（落後 ${ageDays} 天 · STALE／已過期）` };
}
