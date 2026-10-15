// 日本氣象廳（JMA）時間軸點位／區域圖層（P4）的色票、分級、出典與時間桶 SSOT：
// 地圖 paint、圖例、popup、loader 共用。零 import（layerManifest 只能 import 純色票常數檔）。
//
// 時間軸語意（RPC 契約 gis-platform docs/jma-time-rpcs.md，migration 463/464）：
//   - 停在「現在」看最新，往回拉看時刻 t 的狀態；t 不在涵蓋期 →「未涵蓋」，不畫成「沒有」或 0。
//   - 時間桶：AMeDAS／WBGT 每小時；警報／地震 10 分；季節類（物候／初冠雪／梅雨）每 JST 日。

export const ENV_WBGT_ATTRIBUTION = "出典：環境省熱中症予防情報サイト（暑さ指数 WBGT 実況値）";
export const ENV_WBGT_SOURCE_URL = "https://www.wbgt.env.go.jp/";
/** WBGT 不適用 PDL1.0：依環境省網站利用規約，必須標示出典 */
export const ENV_WBGT_LICENSE = "環境省熱中症予防情報サイト 利用規約（出典明記）";

export const JMA_POINT_LAYER_COLORS = {
  jmaLightning: "#a78bfa",
  jmaWbgt: "#f97316",
  jmaSnowcap: "#64748b",
  jmaAutumnLeaves: "#dc2626",
  jmaSakura: "#ec4899",
  jmaRainySeason: "#3b82f6",
} as const;

/** 未觀測（not_yet）／無值的中空描邊色（與 JMA_MISSING_COLOR 同值，避免循環 import 另立） */
export const JMA_POINT_HOLLOW_COLOR = "#94a3b8";

// ── 時間桶 ───────────────────────────────────────────────────────────
const HOUR = 3600;
const JST_OFFSET = 9 * HOUR;

/** 整點桶（UTC 整點；JST 與 UTC 整點相同）→ ISO */
export function jmaHourBucketIso(tSec: number): string {
  return new Date(Math.floor(tSec / HOUR) * HOUR * 1000).toISOString();
}

/** N 分鐘桶 → ISO（向下取整） */
export function jmaMinuteBucketIso(tSec: number, minutes: number): string {
  const step = minutes * 60;
  return new Date(Math.floor(tSec / step) * step * 1000).toISOString();
}

/** 日本日期（YYYY-MM-DD，Asia/Tokyo）。不可用 timeStore.getDateKey()（那是台北日）。 */
export function jmaJstDateKey(tSec: number): string {
  return new Date((tSec + JST_OFFSET) * 1000).toISOString().slice(0, 10);
}

/** 兩個 YYYY-MM-DD 相差天數（b − a） */
export function jmaDaysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** M/D（不補零），給地圖標籤 */
export function jmaMonthDay(date: string | null | undefined): string {
  if (!date) return "";
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return m ? `${Number(m[1])}/${Number(m[2])}` : "";
}

/** 有號天數：+3／−2／±0 */
export function jmaSignedDays(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

// ── WBGT（環境省「日常生活に関する指針」4 段）────────────────────────
// 門檻 25／28／31（https://www.wbgt.env.go.jp/wbgt.php）。顏色是 Pulse 取的綠黃橙紅，
// 不是環境省網站色（該站「注意」為水色）。
export const ENV_WBGT_LEVELS = [
  { value: "caution", label: "注意（25 未満）", min: -Infinity, color: "#22c55e" },
  { value: "warning", label: "警戒（25 以上 28 未満）", min: 25, color: "#facc15" },
  { value: "severe", label: "厳重警戒（28 以上 31 未満）", min: 28, color: "#f97316" },
  { value: "danger", label: "危険（31 以上）", min: 31, color: "#dc2626" },
] as const;
export type EnvWbgtLevel = (typeof ENV_WBGT_LEVELS)[number]["value"];

export function envWbgtLevel(wbgt: number | null | undefined): EnvWbgtLevel | null {
  if (wbgt == null || !Number.isFinite(wbgt)) return null;
  let level: EnvWbgtLevel = "caution";
  for (const l of ENV_WBGT_LEVELS) if (wbgt >= l.min) level = l.value;
  return level;
}

/** mapbox step 表達式（NULL 交給中空處理，這裡給描邊灰） */
export function envWbgtColorExpr(): unknown[] {
  return ["case", ["==", ["get", "wbgt"], null], JMA_POINT_HOLLOW_COLOR,
    ["step", ["get", "wbgt"], ENV_WBGT_LEVELS[0].color,
      ...ENV_WBGT_LEVELS.slice(1).flatMap((l) => [l.min, l.color])]];
}

// ── 與平年差（物候、初冠雪共用的發散色）──────────────────────────────
// 分組是 Pulse 的視覺分段（±2 日內算平年並），不是氣象廳官方「かなり早い」等用語的門檻。
export const JMA_DIFF_CLASSES = [
  { value: "much_early", label: "早 7 日以上", max: -7, color: "#1d4ed8" },
  { value: "early", label: "早 3–6 日", max: -3, color: "#60a5fa" },
  { value: "normal", label: "平年並（±2 日）", max: 2, color: "#a8a29e" },
  { value: "late", label: "晚 3–6 日", max: 6, color: "#fb923c" },
  { value: "much_late", label: "晚 7 日以上", max: Infinity, color: "#c2410c" },
] as const;
export type JmaDiffClass = (typeof JMA_DIFF_CLASSES)[number]["value"];

export function jmaDiffClass(days: number | null | undefined): JmaDiffClass | null {
  if (days == null || !Number.isFinite(days)) return null;
  return JMA_DIFF_CLASSES.find((c) => days <= c.max)?.value ?? null;
}

/** observed 才上色；diff 無值（無平年）用圖層色 */
export function jmaDiffColorExpr(fallback: string): unknown[] {
  return ["match", ["get", "diff_class"], ...JMA_DIFF_CLASSES.flatMap((c) => [c.value, c.color]), fallback];
}

// ── 物候（櫻花前線／紅葉・黃葉前線）──────────────────────────────────
export const JMA_SAKURA_PHENOMENA = [
  { value: "004", label: "開花" },
  { value: "005", label: "満開" },
] as const;
export const JMA_AUTUMN_PHENOMENA = [
  { value: "015", label: "かえでの紅葉" },
  { value: "013", label: "いちょうの黄葉" },
  { value: "016", label: "かえでの落葉" },
  { value: "014", label: "いちょうの落葉" },
] as const;
export type JmaPhenologyLayerKey = "jmaSakura" | "jmaAutumnLeaves";
export const JMA_PHENOLOGY_LAYER_PHENOMENA: Record<JmaPhenologyLayerKey, readonly { value: string; label: string }[]> = {
  jmaSakura: JMA_SAKURA_PHENOMENA,
  jmaAutumnLeaves: JMA_AUTUMN_PHENOMENA,
};

export function jmaPhenologyCode(key: JmaPhenologyLayerKey, idx: number | undefined): string {
  const list = JMA_PHENOLOGY_LAYER_PHENOMENA[key];
  return (list[idx ?? 0] ?? list[0]!).value;
}

// ── 山頂初冠雪 ───────────────────────────────────────────────────────
/** 已觀測＝白點（深色描邊才看得見）；未觀測＝中空 */
export const JMA_SNOWCAP_OBSERVED_COLOR = "#ffffff";
export const JMA_SNOWCAP_OBSERVED_STROKE = "#334155";

// ── 梅雨入り・明け ───────────────────────────────────────────────────
// RPC 只回 12 個地方、沒有幾何 → 用既有市区町村界（jp_admin_boundaries.pmtiles）依「縣碼 2 碼」整縣著色；
// 奄美地方是鹿児島縣的一部分 → 先用市町村 5 碼（奄美市＋大島郡 11 町村，2026-10-15 對界線檔核過）切出。
// 地方定義依氣象庁「梅雨入りと梅雨明け」：山口屬九州北部、三重屬東海；北海道沒有梅雨（不著色）。
export const JMA_RAINY_REGION_PREFS: Record<string, readonly string[]> = {
  沖縄: ["47"],
  奄美: [],
  九州南部: ["45", "46"],
  九州北部: ["35", "40", "41", "42", "43", "44"],
  四国: ["36", "37", "38", "39"],
  中国: ["31", "32", "33", "34"],
  近畿: ["25", "26", "27", "28", "29", "30"],
  東海: ["21", "22", "23", "24"],
  関東甲信: ["08", "09", "10", "11", "12", "13", "14", "19", "20"],
  北陸: ["15", "16", "17", "18"],
  東北南部: ["04", "06", "07"],
  東北北部: ["02", "03", "05"],
};
export const JMA_RAINY_AMAMI_CODES = [
  "46222", "46523", "46524", "46525", "46527", "46529", "46530", "46531", "46532", "46533", "46534", "46535",
] as const;

export const JMA_RAINY_PHASES = [
  { value: "before", label: "梅雨入り前", color: "#cbd5e1" },
  { value: "in", label: "梅雨期間中", color: "#3b82f6" },
  { value: "after", label: "梅雨明け", color: "#f59e0b" },
  { value: "unspecified", label: "特定できず", color: "#a78bfa" },
] as const;
export type JmaRainyPhase = (typeof JMA_RAINY_PHASES)[number]["value"];

/** as-of 狀態 → 階段。onset／end 各為 observed／not_yet／unspecified。 */
export function jmaRainyPhase(onsetState: string | null | undefined, endState: string | null | undefined): JmaRainyPhase {
  if (onsetState === "unspecified" || endState === "unspecified") return "unspecified";
  if (onsetState !== "observed") return "before";
  return endState === "observed" ? "after" : "in";
}

export function jmaRainyPhaseColor(phase: JmaRainyPhase): string {
  return JMA_RAINY_PHASES.find((p) => p.value === phase)?.color ?? JMA_POINT_HOLLOW_COLOR;
}
