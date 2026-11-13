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

/** 圖層識別色（側欄 icon 等）：刻意不用任何陣營色，避免整層看起來偏向某一方 */
export const ELECTION_LAYER_COLOR = "#8b5cf6";

/**
 * 規模分級 → 基準半徑（px，再乘大小滑桿）。2026-11-13 使用者在預覽選 E 版：
 * 墊高下限、壓縮級距（原 9／6／4，小場次幾乎看不見），已過不縮小、較不透明。
 */
export const ELECTION_TIER_RADIUS: Record<"L" | "M" | "S", number> = { L: 10, M: 8, S: 6.5 };

/** 已過時間軸時間的活動：透明度與半徑倍率（原 0.35／0.7；半徑倍率保留常數，日後要再區分時只改這裡） */
export const ELECTION_PAST_OPACITY = 0.6;
export const ELECTION_PAST_RADIUS = 1;

/** 同一地點多場的數字圖示放大倍率（與圓點加大一起調；地圖 icon-size 與圖例示意共用） */
export const ELECTION_GROUP_ICON_SCALE = 1.3;

/** 取消／延期：畫成空心圈 */
export const ELECTION_HOLLOW_STATUSES = ["cancelled", "postponed"] as const;

export const ELECTION_STATUSES = ["scheduled", "changed", "postponed", "cancelled", "held"] as const;
export const ELECTION_CLAIMANTS = ["organizer", "party_press", "media_estimate", "police_estimate"] as const;
export const ELECTION_PRECISIONS = ["address", "landmark", "intersection", "settlement", "town_centroid", "city_centroid"] as const;
export type ElectionPrecision = (typeof ELECTION_PRECISIONS)[number];

/** 場館級（確切地點） */
export const ELECTION_VENUE_PRECISIONS = ["address", "landmark", "intersection"] as const;
/** 代表點（不是活動地點本身）：聚落代表點、鄉鎮市區代表點、縣市代表點。gis-platform mig 514 */
export const ELECTION_APPROX_PRECISIONS = ["settlement", "town_centroid", "city_centroid"] as const;
export type ElectionApproxPrecision = (typeof ELECTION_APPROX_PRECISIONS)[number];

export function isElectionApproxPrecision(v: unknown): v is ElectionApproxPrecision {
  return (ELECTION_APPROX_PRECISIONS as readonly unknown[]).includes(v);
}

/**
 * 代表點外環：半徑＝主點半徑＋位移（px，越粗略越遠）、描邊寬。
 * 外環是資料品質提示，已舉辦時有自己的下限，不跟主點一起 ×0.35 淡掉。
 */
export const ELECTION_RING_OFFSET: Record<ElectionApproxPrecision, number> = { settlement: 3, town_centroid: 6, city_centroid: 10 };
export const ELECTION_RING_STROKE: Record<ElectionApproxPrecision, number> = { settlement: 1.2, town_centroid: 1.2, city_centroid: 1.5 };
export const ELECTION_RING_FILL_OPACITY = { upcoming: 0.12, past: 0.06 } as const;
export const ELECTION_RING_STROKE_OPACITY = { upcoming: 0.8, past: 0.45 } as const;

/**
 * 聚落名稱（RPC `settlement_name`，gis-platform mig 515）：只有 location_precision='settlement' 才採用，
 * 其他精度或空值回 null。
 */
export function electionSettlementName(props: Record<string, unknown>): string | null {
  if (props.location_precision !== "settlement") return null;
  const v = props.settlement_name;
  if (typeof v !== "string") return null;
  const name = v.trim();
  return name && name !== "null" ? name : null;
}

/** 位置篩選（layerParamsSpec 的 select 值）：全部／只看確切地點／只看代表點 */
export type ElectionLocationFilter = "all" | "exact" | "approx";

export function asElectionLocationFilter(v: unknown): ElectionLocationFilter {
  return v === "exact" || v === "approx" ? v : "all";
}

/** 未知精度值視為確切地點（沿用：不認得的值不加說明，也不當代表點合併） */
export function matchesElectionLocation(precision: unknown, filter: ElectionLocationFilter): boolean {
  if (filter === "all") return true;
  return isElectionApproxPrecision(precision) === (filter === "approx");
}

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

/**
 * 來源代碼（intel.election_event_sources.source）→ 白話名稱的 i18n key（popup.politics.sourceName.*）。
 * 代碼以 analytics pipelines/analysis/election_events_2026 實際寫入的值為準；不認得的代碼顯示「其他來源」，不露內部代碼。
 * key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）。
 */
const ELECTION_SOURCE_NAME_KEY = {
  cna_mcp: "popup.politics.sourceName.cna",
  observe: "popup.politics.sourceName.observe",
  permits_npa: "popup.politics.sourceName.permits",
  permits: "popup.politics.sourceName.permits",
  traffic_notice: "popup.politics.sourceName.trafficNotice",
  kmt_press: "popup.politics.sourceName.kmtPress",
  dpp_press: "popup.politics.sourceName.dppPress",
  puma: "popup.politics.sourceName.campaignSite",
  kmtks: "popup.politics.sourceName.kmtks",
  kmt_knowledge: "popup.politics.sourceName.kmtKnowledge",
  manual_search: "popup.politics.sourceName.manual",
  manual: "popup.politics.sourceName.manual",
  poc_v01: "popup.politics.sourceName.early",
} as const;

export type ElectionSourceNameKey = (typeof ELECTION_SOURCE_NAME_KEY)[keyof typeof ELECTION_SOURCE_NAME_KEY] | "popup.politics.sourceName.other";

export function electionSourceNameKey(code: unknown): ElectionSourceNameKey {
  const k = String(code ?? "").trim();
  return Object.prototype.hasOwnProperty.call(ELECTION_SOURCE_NAME_KEY, k)
    ? ELECTION_SOURCE_NAME_KEY[k as keyof typeof ELECTION_SOURCE_NAME_KEY]
    : "popup.politics.sourceName.other";
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
