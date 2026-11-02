// 2026 選舉活動（owner-only）— overlay 分色／圖例／popup／hook 共用的單一真實來源。
// 色與代碼只在這裡定義一次（同 livestockTypes.ts 的做法）。

/** 陣營分組（`camp_key` 由 loader 依 `camp` 衍生；類別篩選與 paint 都讀它） */
export type ElectionCampKey = "dpp" | "kmt" | "tpp" | "npp" | "other";

export interface ElectionCampStyle {
  key: ElectionCampKey;
  color: string;
  /** 中文正本（圖例／篩選選項用；外文介面走 legend.politics.camp.*） */
  label: string;
}

// 政黨慣用色；國民黨藍取亮一階，避免在深色底圖上看不見。
export const ELECTION_CAMPS: readonly ElectionCampStyle[] = [
  { key: "dpp", color: "#1f9d55", label: "民主進步黨" },
  { key: "kmt", color: "#3b6fe0", label: "中國國民黨" },
  { key: "tpp", color: "#22b8c7", label: "台灣民眾黨" },
  { key: "npp", color: "#f2c230", label: "時代力量" },
  { key: "other", color: "#9ca3af", label: "其他政黨／無黨籍" },
];

export const ELECTION_CAMP_COLOR: Record<ElectionCampKey, string> = Object.fromEntries(
  ELECTION_CAMPS.map((c) => [c.key, c.color]),
) as Record<ElectionCampKey, string>;

const CAMP_ALIASES: Record<string, ElectionCampKey> = {
  民主進步黨: "dpp", 民進黨: "dpp",
  中國國民黨: "kmt", 國民黨: "kmt",
  台灣民眾黨: "tpp", 臺灣民眾黨: "tpp", 民眾黨: "tpp",
  時代力量: "npp",
};

export function electionCampKey(camp: unknown): ElectionCampKey {
  return CAMP_ALIASES[String(camp ?? "").trim()] ?? "other";
}

/** 規模分級 → 基準半徑（px，再乘大小滑桿） */
export const ELECTION_TIER_RADIUS: Record<"L" | "M" | "S", number> = { L: 9, M: 6, S: 4 };

/** 已過時間軸時間的活動：透明度與半徑倍率 */
export const ELECTION_PAST_OPACITY = 0.35;
export const ELECTION_PAST_RADIUS = 0.7;

/** 取消／延期：畫成空心圈 */
export const ELECTION_HOLLOW_STATUSES = ["cancelled", "postponed"] as const;

export const ELECTION_STATUSES = ["scheduled", "changed", "postponed", "cancelled", "held"] as const;
export const ELECTION_CLAIMANTS = ["organizer", "party_press", "media_estimate", "police_estimate"] as const;
export const ELECTION_PRECISIONS = ["address", "landmark", "intersection"] as const;

/** 時間範圍篩選（layerParamsSpec 的 select 值） */
export type ElectionRange = "all" | "next7" | "next30" | "held";

const DAY_S = 86_400;

/** YYYY-MM-DD（台北日）→ 該日 00:00 +08:00 的 unix 秒 */
function taipeiDayStart(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00+08:00`);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

function isoToSec(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

/**
 * 活動的起訖（unix 秒）。
 * 起＝starts_at，缺則 event_date 當日 00:00；訖＝ends_at，缺則 event_date 當日結束（23:59:59）。
 */
export function electionEventSpan(props: Record<string, unknown>): { start: number; end: number } | null {
  const day = taipeiDayStart(String(props.event_date ?? ""));
  const startsAt = isoToSec(props.starts_at);
  const endsAt = isoToSec(props.ends_at);
  const start = startsAt ?? day;
  if (start === null) return null;
  const dayOfStart = day ?? taipeiDayStart(new Date(start * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }));
  const end = endsAt ?? (dayOfStart !== null ? dayOfStart + DAY_S - 1 : start);
  return { start, end: Math.max(start, end) };
}

/** 依時間軸時間 t（unix 秒）判斷是否落在篩選範圍 */
export function inElectionRange(span: { start: number; end: number }, t: number, range: ElectionRange): boolean {
  switch (range) {
    case "next7": return span.end >= t && span.start <= t + 7 * DAY_S;
    case "next30": return span.end >= t && span.start <= t + 30 * DAY_S;
    case "held": return span.end < t;
    default: return true;
  }
}

export function asElectionRange(v: unknown): ElectionRange {
  return v === "next7" || v === "next30" || v === "held" ? v : "all";
}

/**
 * Mapbox 讀到的陣列屬性會變成 JSON 字串；兩種都吃。
 */
export function parseJsonArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 來源連結：只收 http(s)，最多 5 筆 */
export function electionSources(v: unknown): { source: string; url: string }[] {
  return parseJsonArray<{ source?: unknown; url?: unknown }>(v)
    .map((s) => ({ source: String(s?.source ?? ""), url: String(s?.url ?? "") }))
    .filter((s) => /^https?:\/\//i.test(s.url))
    .slice(0, 5);
}

/** 宣稱人數的數字部分：中文介面用「萬」，其他語系用千分位 */
export function formatCrowdNumber(n: number, locale: string, formatNumber: (v: number) => string): string {
  if (locale === "zh-TW" && n >= 10_000) {
    const wan = Math.round((n / 10_000) * 10) / 10;
    return `${wan} 萬`;
  }
  return formatNumber(n);
}

/** 宣稱人數措辭的 i18n key 尾碼（popup.politics.claimant.*） */
export function electionClaimantKey(claimant: unknown): (typeof ELECTION_CLAIMANTS)[number] | "unknown" {
  const v = String(claimant ?? "");
  return (ELECTION_CLAIMANTS as readonly string[]).includes(v) ? (v as (typeof ELECTION_CLAIMANTS)[number]) : "unknown";
}
