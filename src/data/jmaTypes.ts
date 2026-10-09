// 日本氣象廳（JMA）即時 4 層的色票、分級與出典 SSOT：地圖 paint、圖例、popup 三邊共用。
// 零 import（layerManifest 只能 import 純色票常數檔）。
// 缺值一律保留 NULL 語意：地圖畫中空點、popup 寫「無觀測」，不可當 0。

export const JMA_ATTRIBUTION = "出典：気象庁（公共データ利用規約1.0）";
export const JMA_SOURCE_URL = "https://www.jma.go.jp/bosai/";
export const JMA_LICENSE = "公共データ利用規約（第1.0版）";

export const JMA_LAYER_COLORS = {
  jmaAmedas: "#0ea5e9",
  jmaWarnings: "#ef4444",
  jmaQuakes: "#f97316",
  jmaVolcanoes: "#b91c1c",
} as const;

/** 中空點（NULL／無資料）描邊色 */
export const JMA_MISSING_COLOR = "#94a3b8";

export interface JmaGradientStop { value: number; color: string }

export function jmaCssGradient(stops: readonly JmaGradientStop[]): string {
  return `linear-gradient(90deg, ${stops.map((s) => s.color).join(", ")})`;
}

// ── AMeDAS ───────────────────────────────────────────────────────────
const TEMP_STOPS: readonly JmaGradientStop[] = [
  { value: -10, color: "#313695" }, { value: 0, color: "#4575b4" }, { value: 10, color: "#74add1" },
  { value: 20, color: "#fee090" }, { value: 28, color: "#f46d43" }, { value: 35, color: "#a50026" },
];
const PRECIP_STOPS: readonly JmaGradientStop[] = [
  { value: 0.5, color: "#a5f3fc" }, { value: 5, color: "#38bdf8" }, { value: 10, color: "#2563eb" },
  { value: 20, color: "#7c3aed" }, { value: 50, color: "#c026d3" }, { value: 80, color: "#be123c" },
];
const SNOW_STOPS: readonly JmaGradientStop[] = [
  { value: 1, color: "#bae6fd" }, { value: 20, color: "#38bdf8" }, { value: 50, color: "#2563eb" },
  { value: 100, color: "#1e3a8a" }, { value: 200, color: "#581c87" },
];
const WIND_STOPS: readonly JmaGradientStop[] = [
  { value: 0, color: "#e0f2fe" }, { value: 5, color: "#7dd3fc" }, { value: 10, color: "#facc15" },
  { value: 15, color: "#f97316" }, { value: 20, color: "#dc2626" }, { value: 25, color: "#7f1d1d" },
];

/** 0（無雨／無積雪）用的實心灰，和 NULL 的中空點分開。 */
export const JMA_ZERO_COLOR = "#94a3b8";

export const JMA_AMEDAS_MODES = [
  { value: "temp", label: "氣溫", field: "temp", unit: "°C", stops: TEMP_STOPS, zeroIsDistinct: false, snowGaugeOnly: false },
  { value: "precip1h", label: "前 1 小時雨量", field: "precip1h", unit: "mm", stops: PRECIP_STOPS, zeroIsDistinct: true, snowGaugeOnly: false },
  { value: "snow", label: "積雪深", field: "snow", unit: "cm", stops: SNOW_STOPS, zeroIsDistinct: true, snowGaugeOnly: true },
  { value: "wind", label: "風速", field: "wind", unit: "m/s", stops: WIND_STOPS, zeroIsDistinct: false, snowGaugeOnly: false },
] as const;
export type JmaAmedasMode = (typeof JMA_AMEDAS_MODES)[number];

export function jmaAmedasMode(idx: number | undefined): JmaAmedasMode {
  return JMA_AMEDAS_MODES[idx ?? 0] ?? JMA_AMEDAS_MODES[0];
}

/** NULL 判斷：中空點。["==", null, null] 為 true；不經 to-number，避免 null 變 0。 */
export function jmaIsNullExpr(field: string): unknown[] {
  return ["==", ["get", field], null];
}

/** 填色：NULL 交給中空處理；0 與 >0 分色（雨量、積雪）；其餘連續色階。 */
export function jmaAmedasColorExpr(mode: JmaAmedasMode): unknown[] {
  const ramp = ["interpolate", ["linear"], ["get", mode.field], ...mode.stops.flatMap((s) => [s.value, s.color])];
  if (!mode.zeroIsDistinct) return ["case", jmaIsNullExpr(mode.field), JMA_MISSING_COLOR, ramp];
  return ["case", jmaIsNullExpr(mode.field), JMA_MISSING_COLOR, ["<=", ["get", mode.field], 0], JMA_ZERO_COLOR, ramp];
}

/** 積雪模式只畫有積雪計的站（has_snow_gauge=true），其餘模式全畫。 */
export function jmaAmedasFilter(mode: JmaAmedasMode): unknown[] | null {
  return mode.snowGaugeOnly ? ["==", ["get", "has_snow_gauge"], true] : null;
}

// ── 警報・注意報 ──────────────────────────────────────────────────────
// 嚴重度只從 kind_name 文字判（r8 只給代碼，名稱由 collector 推斷；對不到名稱的列不硬猜級別）。
export const JMA_WARNING_LEVELS = [
  { value: "special", label: "特別警報", color: "#581c87", rank: 4 },
  { value: "danger", label: "危険警報", color: "#a855f7", rank: 3 },
  { value: "warning", label: "警報", color: "#ef4444", rank: 2 },
  { value: "advisory", label: "注意報", color: "#facc15", rank: 1 },
  { value: "unknown", label: "種類未對照", color: "#94a3b8", rank: 0 },
] as const;
export type JmaWarningLevel = (typeof JMA_WARNING_LEVELS)[number]["value"];

export function jmaWarningLevel(kindName: string | null | undefined): JmaWarningLevel {
  const name = kindName ?? "";
  if (name.includes("特別警報")) return "special";
  if (name.includes("危険警報")) return "danger";
  if (name.includes("警報")) return "warning";
  if (name.includes("注意報")) return "advisory";
  return "unknown";
}

export function jmaWarningColor(level: JmaWarningLevel): string {
  return JMA_WARNING_LEVELS.find((l) => l.value === level)?.color ?? JMA_MISSING_COLOR;
}

/** status 為這些值的列不算「發表中」（解除／無發表）。 */
export const JMA_WARNING_INACTIVE_STATUS = ["解除", "発表警報・注意報はなし"] as const;

// ── 地震 ────────────────────────────────────────────────────────────
// 震度色接近 JMA 官方配色；震度 1 的白色在淺色底圖看不見，改淡藍灰。
export const JMA_INTENSITY_CLASSES = [
  { value: "1", label: "震度 1", color: "#a3b8d6" },
  { value: "2", label: "震度 2", color: "#00aaff" },
  { value: "3", label: "震度 3", color: "#0041ff" },
  { value: "4", label: "震度 4", color: "#e6c84a" },
  { value: "5-", label: "震度 5 弱", color: "#ffe600" },
  { value: "5+", label: "震度 5 強", color: "#ff9900" },
  { value: "6-", label: "震度 6 弱", color: "#ff2800" },
  { value: "6+", label: "震度 6 強", color: "#a50021" },
  { value: "7", label: "震度 7", color: "#b40068" },
] as const;

/** 來源可能寫 5-／5弱／5 弱；統一成 1..7、5-、5+、6-、6+；空字串或不認得 → null。 */
export function normalizeJmaIntensity(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!s) return null;
  const m = /^([1-7])(-|\+|弱|強)?$/.exec(s);
  if (!m) return null;
  const suffix = m[2] === "弱" ? "-" : m[2] === "強" ? "+" : (m[2] ?? "");
  const v = `${m[1]}${suffix}`;
  return JMA_INTENSITY_CLASSES.some((c) => c.value === v) ? v : null;
}

export function jmaIntensityLabel(v: string | null): string {
  return JMA_INTENSITY_CLASSES.find((c) => c.value === v)?.label ?? "震度未發表";
}

/** 規模 → 半徑（px，未乘大小滑桿）；規模 NULL 給最小半徑並中空。 */
export const JMA_QUAKE_RADIUS_STOPS: readonly (readonly [magnitude: number, px: number])[] = [[2, 3], [4, 6], [6, 13], [8, 24]];
export const JMA_QUAKE_LOOKBACK_DAYS = 7;

// ── 火山 ────────────────────────────────────────────────────────────
export const JMA_VOLCANO_LEVELS = [
  { value: "1", label: "レベル1（活火山であることに留意）", color: "#84cc16" },
  { value: "2", label: "レベル2（火口周辺規制）", color: "#facc15" },
  { value: "3", label: "レベル3（入山規制）", color: "#f97316" },
  { value: "4", label: "レベル4（高齢者等避難）", color: "#ef4444" },
  { value: "5", label: "レベル5（避難）", color: "#7e22ce" },
  { value: "none", label: "警戒レベル未導入（見警報名稱）", color: "#64748b" },
] as const;

/** 先從 level_name 文字抓「レベルN」（含全形數字），再看 level_code 11–15；都沒有 → none。 */
export function jmaVolcanoLevel(levelName: unknown, levelCode: unknown): string {
  const name = String(levelName ?? "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const m = /レベル\s*([1-5])/.exec(name);
  if (m) return m[1]!;
  const code = String(levelCode ?? "");
  if (/^1[1-5]$/.test(code)) return code.slice(1);
  return "none";
}

/** JST 顯示（所有 JMA 時間一律以日本時間呈現）。 */
export function formatJst(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false })} JST`;
}
