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
  jmaSnowDepth: "#60a5fa",
  jmaRadar: "#2563eb",
  jmaRasrf: "#0284c7",
  jmaRiskLand: "#a16207",
  jmaRiskInund: "#7c3aed",
  jmaUvIndex: "#f59e0b",
  jmaSst: "#f43f5e",
  jmaSeaIce: "#38bdf8",
  jmaHimawari: "#94a3b8",
  jmaAnaSnowFirst: "#8b5cf6",
  jmaAnaSnowDays: "#3b82f6",
  jmaAnaRainDays: "#0d9488",
  jmaAnaRiskLandHours: "#b45309",
  jmaAnaRiskInundHours: "#6d28d9",
  jmaRiskFlood: "#ff2800",
  jmaKosa: "#d97706",
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

/**
 * 種類篩選下拉的選項（值＝JMA 種別碼；與 collector jma_warnings.py KIND_NAMES 同步，名稱為日文原文）。
 * 下拉選項在規格層是靜態的；選了目前沒發布的種類，地圖就是空的（圖例只列發布中的種類）。
 */
export const JMA_WARNING_KINDS = [
  { value: "all", label: "全部" },
  { value: "33", label: "レベル５大雨特別警報" }, { value: "39", label: "レベル５土砂災害特別警報" }, { value: "38", label: "レベル５高潮特別警報" },
  { value: "35", label: "暴風特別警報" }, { value: "32", label: "暴風雪特別警報" }, { value: "36", label: "大雪特別警報" }, { value: "37", label: "波浪特別警報" },
  { value: "43", label: "レベル４大雨危険警報" }, { value: "49", label: "レベル４土砂災害危険警報" }, { value: "48", label: "レベル４高潮危険警報" },
  { value: "03", label: "レベル３大雨警報" }, { value: "09", label: "レベル３土砂災害警報" }, { value: "08", label: "レベル３高潮警報" },
  { value: "05", label: "暴風警報" }, { value: "02", label: "暴風雪警報" }, { value: "06", label: "大雪警報" }, { value: "07", label: "波浪警報" },
  { value: "10", label: "レベル２大雨注意報" }, { value: "29", label: "レベル２土砂災害注意報" }, { value: "19", label: "レベル２高潮注意報" },
  { value: "15", label: "強風注意報" }, { value: "13", label: "風雪注意報" }, { value: "12", label: "大雪注意報" }, { value: "16", label: "波浪注意報" },
  { value: "14", label: "雷注意報" }, { value: "17", label: "融雪注意報" }, { value: "20", label: "濃霧注意報" }, { value: "21", label: "乾燥注意報" },
  { value: "22", label: "なだれ注意報" }, { value: "23", label: "低温注意報" }, { value: "24", label: "霜注意報" }, { value: "25", label: "着氷注意報" },
  { value: "26", label: "着雪注意報" },
] as const;

/** 下拉索引 → 種別碼；0／缺值＝全部（null）。 */
export function jmaWarningKindCode(idx: number | undefined): string | null {
  const v = JMA_WARNING_KINDS[idx ?? 0]?.value ?? "all";
  return v === "all" ? null : v;
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

// ── 發布幀影像（time-axis raster；契約 taipei-gis-analytics docs/topic-research/japan_opendata/jma-frontend-contract.md）──
// PNG 是 8-bit 灰階＋alpha（LA），不帶顏色：L＝等級值、A＝0 透明。顏色只在這裡定義（契約 §6），
// 色票修正只改本檔、不用重發 PNG。
//
// ── raster-color 解碼（mapbox-gl 3.x，image source 與 PMTiles raster 同一支 raster program）──
// 瀏覽器把 LA PNG（與 gray_jpeg_v1 單色 JPEG）解成 R=G=B=L。mapbox 3.x（draw_raster／raster_style_layer）取色帶的位置是
//   texel = floor(0.5 + L × mix × CMF × (RES−1) / (max−min))，CMF = (RES²−1)/(255·RES·(RES+3))，RES = 1024
// 即 mix=255 時 raster-value ≈ L × 0.9971，L=255 只取到 texel 1020（≈254.3）——2026-10-15 瀏覽器實測
// mix=255 時缺測 255 被畫成透明。所以 mix 用補償值 1/CMF ≈ 255.75，讓 texel = round(L × 1023/255)，
// raster-value 與 L 相差 ≤ 0.13；range 固定 [0,255]。
// step 門檻一律放在「等級 − 0.5」，讓整數 L 落在區間正中。
// L=255 = 缺測 → 「未涵蓋」灰；L=0 + A=0 → 透明（無值／畫布外），不是 0 值。

/** 未涵蓋（缺測 L=255、或此刻沒有可用幀）的灰 */
export const JMA_IMAGERY_UNCOVERED_COLOR = "#9ca3af";
/** 契約 §4 的缺測等級 */
export const JMA_IMAGERY_MISSING_LEVEL = 255;
/** mapbox 色帶解析度（raster_style_layer COLOR_RAMP_RES）；升級 mapbox-gl 時要重驗 */
export const MAPBOX_COLOR_RAMP_RES = 1024;
/** 補償 mapbox COLOR_MIX_FACTOR 的 R 係數（見上方說明），≈ 255.747 */
export const JMA_IMAGERY_MIX_R = (255 * MAPBOX_COLOR_RAMP_RES * (MAPBOX_COLOR_RAMP_RES + 3)) / (MAPBOX_COLOR_RAMP_RES ** 2 - 1);
export const JMA_IMAGERY_RASTER_COLOR_MIX = [JMA_IMAGERY_MIX_R, 0, 0, 0] as const;
export const JMA_IMAGERY_RASTER_COLOR_RANGE = [0, 255] as const;

export type JmaImageryEncoding = "level_la_v1" | "sst_la_v1" | "gray_jpeg_v1" | "count_la_v1";

export interface JmaImageryLevel {
  /** PNG L 值（等於 T2 等級值） */
  level: number;
  rgb: readonly [number, number, number];
  /** 圖例刻度（單位已含在字串內） */
  label: string;
}

/** sst_la_v1 一類連續值：L ↔ 物理值的線性換算，色帶 stop 寫物理值 */
export interface JmaImageryScalar {
  unit: string;
  /** 物理值 = L × scale + offset（sst_la_v1：°C = L/7 − 3） */
  scale: number;
  offset: number;
  stops: readonly { value: number; color: string }[];
  /** L=0 且 A=255 的特殊值（sst_la_v1：海冰）；未設 → 透明 */
  zeroColor?: string;
}

/**
 * gray_jpeg_v1（ひまわり B13）：單色 JPEG、無 alpha，灰階越白越冷（JMA 未公開灰階↔亮溫換算，不是溫度）。
 * 0 與 255 都是有效灰階（沒有缺測等級）。stops 以灰階值（raster-value）為輸入，輸出帶 alpha 的顏色。
 */
export interface JmaImageryGray {
  stops: readonly { value: number; color: string }[];
}

/**
 * count_la_v1（分析圖，契約 §8）：L＝計數值（日數／時數／積雪季日序，上限 254）；0＝透明（無事件／還沒）；
 * 255＝像素覆蓋率 < 0.5 →「未涵蓋」灰。classes（step）與 ramp（interpolate）擇一。
 */
export interface JmaImageryCount {
  /** 圖例單位：days／hours 加在分級刻度後；date＝刻度本身是月/日 */
  unit: "days" | "hours" | "date";
  /** 離散分級：value ≥ min 起畫該色（min 遞增；第一級 min ≥ 1） */
  classes?: readonly { min: number; rgb: readonly [number, number, number]; label: string }[];
  /** 連續色帶（ana_snow_first 日序）：label 是圖例刻度 */
  ramp?: readonly { value: number; color: string; label: string }[];
}

/** 上游只在部分時段／月份發布（UV 06–18 JST、海冰 12–5 月）；時段外顯示「夜間無資料」／「季外」，不算缺幀 */
export interface JmaImageryActiveWindow {
  /** JST 小時 [from, to)：t 的 JST 時刻落在區間外 → off_hours（UV：[6, 19)，18:00 幀顯示到 18:59） */
  hoursJst?: readonly [number, number];
  /** JST 月份（1–12）：t 的 JST 月份不在清單 → off_season */
  monthsJst?: readonly number[];
}

export interface JmaImageryProduct {
  /** RPC get_weather_imagery_manifest 的 product */
  product: string;
  encoding: JmaImageryEncoding;
  /** 上游色票版本（data-collectors config/decode_tables/jma/<product>.yaml 的 version） */
  paletteVersion: string;
  /** 發布幀間隔（分）；契約 §5 */
  cadenceMin: number;
  /** 回放：時間軸 t 與最近一幀（≤ t）相差超過此值 → 未涵蓋（缺幀，不沿用舊圖） */
  maxStaleMin: number;
  /** 即時：最新一幀距現在超過此值 → 未涵蓋（collector 停擺時不把舊圖當現況） */
  liveMaxStaleMin: number;
  /** 歷史日 RPC 抽稀（p_step_minutes；0 = 每幀） */
  historyStepMin: number;
  /** level_la_v1：離散等級 */
  levels?: readonly JmaImageryLevel[];
  /** sst_la_v1：連續值 */
  scalar?: JmaImageryScalar;
  /** gray_jpeg_v1：灰階 ramp */
  gray?: JmaImageryGray;
  /** count_la_v1：分析圖計數分級 */
  count?: JmaImageryCount;
  /** 上游發布時段（缺省 = 全天全年） */
  active?: JmaImageryActiveWindow;
}

/** 雷達與解析雨量共用 8 級（decode table PLTE；idx6 以 PLTE (250,245,0) 為準，legend SVG 是 (255,245,0)） */
const RAIN_RGB: readonly (readonly [number, number, number])[] = [
  [242, 242, 255], [160, 210, 255], [33, 140, 255], [0, 65, 255],
  [250, 245, 0], [255, 153, 0], [255, 40, 0], [180, 0, 104],
];
const RAIN_BREAKS = ["<1", "1–5", "5–10", "10–20", "20–30", "30–50", "50–80", "≥80"];
function rainLevels(unit: string): JmaImageryLevel[] {
  return RAIN_RGB.map((rgb, i) => ({ level: i + 1, rgb: [rgb[0], rgb[1], rgb[2]] as const, label: `${RAIN_BREAKS[i]} ${unit}` }));
}

/**
 * キキクル 2–5（decode table level 1「今後の情報等に留意」是白色，上游圖磚實際為透明 → 不登記，step 畫透明，
 * 避免整片白蓋住底圖）。plte_verified=false：依 legend SVG，待首次著色以實磚 PLTE 驗證。
 */
const RISK_LEVELS: readonly JmaImageryLevel[] = [
  { level: 2, rgb: [242, 231, 0], label: "注意（警戒レベル2相当）" },
  { level: 3, rgb: [255, 40, 0], label: "警戒（警戒レベル3相当）" },
  { level: 4, rgb: [170, 0, 170], label: "危険（警戒レベル4相当）" },
  { level: 5, rgb: [12, 0, 12], label: "災害切迫（警戒レベル5相当）" },
];

/**
 * 日別海面水温色帶：取自氣象廳「日別海面水温」圖（www.data.jma.go.jp/kaiyou/data/db/kaikyo/daily/image/HQ/2026/sstD_HQ20261013.png）
 * 右側色條，逐 1 ℃ 取色（2026-10-15）；stop 放在各 1 ℃ 區間中點。
 */
const SST_STOPS: readonly { value: number; color: string }[] = [
  ["#4100c5", -1.5], ["#2900c5", -0.5], ["#1800c5", 0.5], ["#0008c5", 1.5], ["#0029c5", 2.5], ["#0062c5", 3.5],
  ["#009cc5", 4.5], ["#00c5bd", 5.5], ["#00d5ac", 6.5], ["#00de8b", 7.5], ["#00e673", 8.5], ["#08ee62", 9.5],
  ["#20ee4a", 10.5], ["#39f631", 11.5], ["#52f629", 12.5], ["#7bff4a", 13.5], ["#acff8b", 14.5], ["#d5ffcd", 15.5],
  ["#f6ffd5", 16.5], ["#ffffac", 17.5], ["#ffff62", 18.5], ["#ffff20", 19.5], ["#ffee00", 20.5], ["#ffd500", 21.5],
  ["#ffbd00", 22.5], ["#ffa400", 23.5], ["#ff7b08", 24.5], ["#ff4a10", 25.5], ["#ff2008", 26.5], ["#ff2031", 27.5],
  ["#ff5a9c", 28.5], ["#ff94ee", 29.5], ["#ffa4ff", 30.5],
].map(([color, value]) => ({ value: value as number, color: color as string }));

// ── 分析圖色票（count_la_v1）──
/**
 * 積雪季日序（10/1＝1）的月初刻度。以非閏年計（2/29 存在的季，3/1 以後實際日序 +1，色帶差 1 天可忽略）。
 * 早→晚：紫→藍→青→綠→黃→橘→紅。
 */
const ANA_SNOW_FIRST_RAMP: readonly { value: number; color: string; label: string }[] = [
  { value: 1, color: "#7c3aed", label: "10/1" },
  { value: 32, color: "#2563eb", label: "11/1" },
  { value: 62, color: "#0891b2", label: "12/1" },
  { value: 93, color: "#10b981", label: "1/1" },
  { value: 124, color: "#84cc16", label: "2/1" },
  { value: 152, color: "#eab308", label: "3/1" },
  { value: 183, color: "#f97316", label: "4/1" },
  { value: 213, color: "#dc2626", label: "5/1" },
];

/** 分級下限（value ≥ min）；最後一級為「≥」 */
const ANA_RAIN_DAYS_BREAKS = [1, 2, 4, 7, 11, 16, 21] as const;
const ANA_RAIN_DAYS_RGB: readonly (readonly [number, number, number])[] = [
  [204, 236, 230], [153, 216, 201], [102, 194, 164], [65, 174, 118], [35, 139, 69], [0, 109, 44], [0, 68, 27],
];
/** 積雪季日數（10 月起整季累計，可超過 31）：1 週、2 週、1 月、2 月、3 月 */
const ANA_SNOW_DAYS_BREAKS = [1, 2, 8, 15, 31, 61, 91] as const;
const ANA_SNOW_DAYS_RGB: readonly (readonly [number, number, number])[] = [
  [222, 235, 247], [198, 219, 239], [158, 202, 225], [107, 174, 214], [66, 146, 198], [33, 113, 181], [8, 69, 148],
];
/** 警戒以上時數（當月）：1、3、6、12、24、48+ */
const ANA_HOURS_BREAKS = [1, 3, 6, 12, 24, 48] as const;
const ANA_RISK_LAND_RGB: readonly (readonly [number, number, number])[] = [
  [254, 227, 145], [254, 196, 79], [254, 153, 41], [236, 112, 20], [204, 76, 2], [140, 45, 4],
];
const ANA_RISK_INUND_RGB: readonly (readonly [number, number, number])[] = [
  [218, 218, 235], [188, 189, 220], [158, 154, 200], [128, 125, 186], [106, 81, 163], [74, 20, 134],
];

/** 分級下限 → 圖例刻度（只有數字；單位由圖例依 count.unit 加上，跟著語系） */
function countClasses(
  breaks: readonly number[],
  rgbs: readonly (readonly [number, number, number])[],
): { min: number; rgb: readonly [number, number, number]; label: string }[] {
  return breaks.map((min, i) => {
    const next = breaks[i + 1];
    const label = next == null ? `≥${min}` : next - 1 === min ? `${min}` : `${min}–${next - 1}`;
    return { min, rgb: rgbs[i]!, label };
  });
}

/**
 * 產品登記簿：每個發布幀產品一筆。容忍度（maxStaleMin／liveMaxStaleMin）依發布頻率各自設定：
 * collector 每小時整批＋上游延遲，即時容忍度依 2026-10-16 實測最舊可達：radar 66、rasrf 95、risk 125、snow／himawari 112 分。
 * radar 15/90、rasrf 60/120、risk 60/150、snow 90/180、uv 90/180、sst／sea_ice 72h/72h（上游約晚 1.5 天發布，最新一幀可達約 58 小時前）。
 */
export const JMA_IMAGERY_PRODUCTS = {
  // 解析積雪深 snowd（data-collectors config/decode_tables/jma/snow_depth.yaml）。
  // ⚠ plte_verified=false：idx4/5（<5、5–20 cm）已以 2026-10-15 實磚驗證，其餘 5 級仍依 legend SVG 暫定。
  snow_depth: {
    product: "snow_depth",
    encoding: "level_la_v1",
    paletteVersion: "jma-snow_depth-2026-10-09-provisional",
    cadenceMin: 60,
    maxStaleMin: 90,
    liveMaxStaleMin: 180,
    historyStepMin: 0,
    levels: [
      { level: 1, rgb: [160, 210, 255], label: "<5 cm" },
      { level: 2, rgb: [33, 140, 255], label: "5–20 cm" },
      { level: 3, rgb: [0, 65, 255], label: "20–50 cm" },
      { level: 4, rgb: [255, 245, 0], label: "50–100 cm" },
      { level: 5, rgb: [255, 153, 0], label: "100–150 cm" },
      { level: 6, rgb: [255, 40, 0], label: "150–200 cm" },
      { level: 7, rgb: [180, 0, 104], label: "≥200 cm" },
    ],
  },
  // 高解像度降水ナウキャスト解析值（decode table radar.yaml，plte_verified）。5 分一幀。
  radar: {
    product: "radar",
    encoding: "level_la_v1",
    paletteVersion: "jma-radar-2026-10-09",
    cadenceMin: 5,
    maxStaleMin: 15,
    liveMaxStaleMin: 90,
    historyStepMin: 0,
    levels: rainLevels("mm/h"),
  },
  // 解析雨量（1 小時雨量，decode table rasrf.yaml，plte_verified）。30 分一幀。
  rasrf: {
    product: "rasrf",
    encoding: "level_la_v1",
    paletteVersion: "jma-rasrf-2026-10-09",
    cadenceMin: 30,
    maxStaleMin: 60,
    liveMaxStaleMin: 120,
    historyStepMin: 0,
    levels: rainLevels("mm"),
  },
  // 土砂キキクル（decode table risk_land.yaml，provisional）。30 分一幀。
  risk_land: {
    product: "risk_land",
    encoding: "level_la_v1",
    paletteVersion: "jma-risk_land-2026-10-09-provisional",
    cadenceMin: 30,
    maxStaleMin: 60,
    liveMaxStaleMin: 150,
    historyStepMin: 0,
    levels: RISK_LEVELS,
  },
  // 浸水キキクル（decode table risk_inund.yaml，provisional）。30 分一幀。
  risk_inund: {
    product: "risk_inund",
    encoding: "level_la_v1",
    paletteVersion: "jma-risk_inund-2026-10-09-provisional",
    cadenceMin: 30,
    maxStaleMin: 60,
    liveMaxStaleMin: 150,
    historyStepMin: 0,
    levels: RISK_LEVELS,
  },
  // 紫外線 UV インデックス解析（decode table uv_anal.yaml，plte_verified）：level = UVI + 1；每正時 06–18 JST。
  uv_anal: {
    product: "uv_anal",
    encoding: "level_la_v1",
    paletteVersion: "jma-uv_anal-2026-10-12",
    cadenceMin: 60,
    maxStaleMin: 90,
    liveMaxStaleMin: 180,
    historyStepMin: 0,
    active: { hoursJst: [6, 19] },
    levels: ([
      [255, 255, 255], [217, 217, 255], [153, 203, 255], [255, 255, 190], [250, 250, 150], [250, 245, 0], [255, 200, 0],
      [255, 140, 0], [250, 90, 0], [255, 20, 0], [165, 0, 33], [181, 0, 91], [204, 0, 160], [204, 0, 204],
    ] as const).map((rgb, i) => ({ level: i + 1, rgb, label: i === 13 ? "UVI ≥13" : `UVI ${i}` })),
  },
  // 日別海面水温（him_sst_pac_D，0.1°）：sst_la_v1，L = clamp(round((℃+3)×7), 1, 254)；L=0（A=255）= 海冰。
  // 每日一幀，valid_time = 該日 00:00 JST（R2 key 日期是 UTC 前一日 150000）。
  sst_him: {
    product: "sst_him",
    encoding: "sst_la_v1",
    paletteVersion: "jma-sstD-colorbar-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 72 * 60,
    liveMaxStaleMin: 72 * 60,
    historyStepMin: 0,
    scalar: { unit: "°C", scale: 1 / 7, offset: -3, stops: SST_STOPS, zeroColor: "#f8fafc" },
  },
  // 海氷（man_ice_okh_D，0.05°）：密接度級 2–5；0 開水面、254 陸地透明；只有 12–5 月。
  // ⚠ 色票 provisional：氣象廳官方海氷圖在季外（10 月）下架、Wayback 無快照，暫用藍色系單調色階，季內取官方圖例再改。
  sea_ice: {
    product: "sea_ice",
    encoding: "level_la_v1",
    paletteVersion: "pulse-sea_ice-2026-10-15-provisional",
    cadenceMin: 1440,
    maxStaleMin: 72 * 60,
    liveMaxStaleMin: 72 * 60,
    historyStepMin: 0,
    active: { monthsJst: [12, 1, 2, 3, 4, 5] },
    levels: [
      { level: 2, rgb: [198, 232, 255], label: "1–3/10" },
      { level: 3, rgb: [130, 190, 245], label: "4–6/10" },
      { level: 4, rgb: [70, 130, 225], label: "7–8/10" },
      { level: 5, rgb: [35, 60, 170], label: "9–10/10" },
    ],
  },
  // ひまわり B13 赤外（gray_jpeg_v1，1024×768 單色 JPEG，z5 12 磚拼成）。每小時一幀。
  // 不上色只調透明：暖（暗，晴空海面約 30–55）全透明讓底圖透出，冷（亮，雲頂）漸白漸不透明。
  // 門檻依 2026-10-15 上游 z5 磚實測灰階分位（P50≈55、P90≈114、P99≈149）與瀏覽器實測訂定：
  // 85 以下（晴空海面、夜間陸地）全透明，避免整片灰霧蓋住底圖。
  himawari_b13: {
    product: "himawari_b13",
    encoding: "gray_jpeg_v1",
    paletteVersion: "pulse-himawari_b13-gray-2026-10-15",
    cadenceMin: 60,
    maxStaleMin: 90,
    liveMaxStaleMin: 180,
    historyStepMin: 0,
    gray: {
      stops: [
        { value: 85, color: "rgba(150, 150, 150, 0)" },
        { value: 130, color: "rgba(195, 195, 195, 0.6)" },
        { value: 180, color: "rgba(235, 235, 235, 0.9)" },
        { value: 255, color: "rgba(255, 255, 255, 0.95)" },
      ],
    },
  },
  // ── 分析圖（P6，契約 §8；data-collectors #152）：每日一張，valid_time＝當日 00:00 JST（內容含當日），
  // R2 key 落在前一 UTC 日 150000。2026-10 各月與 2026 積雪季都是 partial（資料 10-10 起）。
  ana_snow_first: {
    product: "ana_snow_first",
    encoding: "count_la_v1",
    paletteVersion: "pulse-ana_snow_first-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 36 * 60,
    liveMaxStaleMin: 48 * 60,
    historyStepMin: 0,
    count: { ramp: ANA_SNOW_FIRST_RAMP, unit: "date" },
  },
  ana_snow_days: {
    product: "ana_snow_days",
    encoding: "count_la_v1",
    paletteVersion: "pulse-ana_snow_days-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 36 * 60,
    liveMaxStaleMin: 48 * 60,
    historyStepMin: 0,
    count: { classes: countClasses(ANA_SNOW_DAYS_BREAKS, ANA_SNOW_DAYS_RGB), unit: "days" },
  },
  ana_rain_days: {
    product: "ana_rain_days",
    encoding: "count_la_v1",
    paletteVersion: "pulse-ana_rain_days-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 36 * 60,
    liveMaxStaleMin: 48 * 60,
    historyStepMin: 0,
    count: { classes: countClasses(ANA_RAIN_DAYS_BREAKS, ANA_RAIN_DAYS_RGB), unit: "days" },
  },
  ana_risk_land_hours: {
    product: "ana_risk_land_hours",
    encoding: "count_la_v1",
    paletteVersion: "pulse-ana_risk_land_hours-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 36 * 60,
    liveMaxStaleMin: 48 * 60,
    historyStepMin: 0,
    count: { classes: countClasses(ANA_HOURS_BREAKS, ANA_RISK_LAND_RGB), unit: "hours" },
  },
  ana_risk_inund_hours: {
    product: "ana_risk_inund_hours",
    encoding: "count_la_v1",
    paletteVersion: "pulse-ana_risk_inund_hours-2026-10-15",
    cadenceMin: 1440,
    maxStaleMin: 36 * 60,
    liveMaxStaleMin: 48 * 60,
    historyStepMin: 0,
    count: { classes: countClasses(ANA_HOURS_BREAKS, ANA_RISK_INUND_RGB), unit: "hours" },
  },
} as const satisfies Record<string, JmaImageryProduct>;

export type JmaImageryProductId = keyof typeof JMA_IMAGERY_PRODUCTS;

/** 圖層 key ↔ 發布幀 product（host、圖例共用） */
export const JMA_IMAGERY_LAYERS = {
  jmaSnowDepth: "snow_depth",
  jmaRadar: "radar",
  jmaRasrf: "rasrf",
  jmaRiskLand: "risk_land",
  jmaRiskInund: "risk_inund",
  jmaUvIndex: "uv_anal",
  jmaSst: "sst_him",
  jmaSeaIce: "sea_ice",
  jmaHimawari: "himawari_b13",
  jmaAnaSnowFirst: "ana_snow_first",
  jmaAnaSnowDays: "ana_snow_days",
  jmaAnaRainDays: "ana_rain_days",
  jmaAnaRiskLandHours: "ana_risk_land_hours",
  jmaAnaRiskInundHours: "ana_risk_inund_hours",
} as const satisfies Record<string, JmaImageryProductId>;

export type JmaImageryLayerKey = keyof typeof JMA_IMAGERY_LAYERS;

export function jmaImageryProduct(id: JmaImageryProductId): JmaImageryProduct {
  return JMA_IMAGERY_PRODUCTS[id];
}

export function jmaRgb(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** sst_la_v1 一類：物理值 → L（契約 §4 的 clamp 1–254） */
export function jmaImageryValueToLevel(scalar: JmaImageryScalar, value: number): number {
  return Math.min(254, Math.max(1, (value - scalar.offset) / scalar.scale));
}

/** `raster-color` 表達式（raster-value = L） */
export function jmaImageryRasterColor(p: JmaImageryProduct): unknown[] {
  const missing = JMA_IMAGERY_MISSING_LEVEL - 0.5;
  if (p.encoding === "level_la_v1") {
    const levels = [...(p.levels ?? [])].sort((a, b) => a.level - b.level);
    const expr: unknown[] = ["step", ["raster-value"], TRANSPARENT];
    levels.forEach((lv, i) => {
      expr.push(lv.level - 0.5, jmaRgb(lv.rgb));
      const next = levels[i + 1];
      // 等級不連續（或最後一級之後）→ 未登記的等級畫透明，不沿用上一級顏色
      if (!next || next.level !== lv.level + 1) {
        if (lv.level + 0.5 < missing) expr.push(lv.level + 0.5, TRANSPARENT);
      }
    });
    expr.push(missing, JMA_IMAGERY_UNCOVERED_COLOR);
    return expr;
  }
  if (p.encoding === "count_la_v1") {
    // L=0 透明（無事件／還沒）；1–254 計數；255 覆蓋率不足 → 未涵蓋
    const count = p.count!;
    if (count.ramp) {
      const ramp: unknown[] = ["interpolate", ["linear"], ["raster-value"], ...count.ramp.flatMap((s) => [s.value, s.color])];
      return ["step", ["raster-value"], TRANSPARENT, 0.5, ramp, missing, JMA_IMAGERY_UNCOVERED_COLOR];
    }
    const expr: unknown[] = ["step", ["raster-value"], TRANSPARENT];
    for (const c of count.classes ?? []) expr.push(c.min - 0.5, jmaRgb(c.rgb));
    expr.push(missing, JMA_IMAGERY_UNCOVERED_COLOR);
    return expr;
  }
  if (p.encoding === "gray_jpeg_v1") {
    // 灰階連續值、沒有缺測等級；低於第一個 stop 一律沿用第一個 stop（透明）
    return ["interpolate", ["linear"], ["raster-value"], ...p.gray!.stops.flatMap((s) => [s.value, s.color])];
  }
  // sst_la_v1：L=0（A=255 海冰；A=0 陸地由 alpha 透明）→ zeroColor；1–254 連續；255 未涵蓋
  const scalar = p.scalar!;
  const ramp: unknown[] = ["interpolate", ["linear"], ["raster-value"],
    ...scalar.stops.flatMap((s) => [jmaImageryValueToLevel(scalar, s.value), s.color])];
  return ["step", ["raster-value"], scalar.zeroColor ?? TRANSPARENT, 0.5, ramp, missing, JMA_IMAGERY_UNCOVERED_COLOR];
}

/** raster layer paint（opacity 由呼叫端帶） */
export function jmaImageryRasterPaint(p: JmaImageryProduct, opacity: number): Record<string, unknown> {
  return {
    "raster-opacity": opacity,
    "raster-resampling": "nearest",
    "raster-fade-duration": 0,
    "raster-color-mix": [...JMA_IMAGERY_RASTER_COLOR_MIX],
    "raster-color-range": [...JMA_IMAGERY_RASTER_COLOR_RANGE],
    "raster-color": jmaImageryRasterColor(p),
  };
}

// ── 上游直連（瀏覽器直接讀 JMA，不經我們的 DB／R2；P5，2026-10-15 實測見 jma-frontend-plan §3.2）──

/** 出典：洪水キキクル只重新上色（加工）；黃砂圖原圖照登 */
export const JMA_FLOOD_ATTRIBUTION = "出典：気象庁（加工）";
export const JMA_KOSA_ATTRIBUTION = "出典：気象庁";

// 洪水キキクル（向量 pbf，source-layer flood、欄位 level）。
// JMA 自家 viewer（bosai/risk/table/risk.properties*.xml）：imageType flood type=pbf zoomUse="even"、minZoom 4、maxZoom 14。
export const JMA_FLOOD_TARGET_TIMES_URL = "https://www.jma.go.jp/bosai/jmatile/data/risk/targetTimes.json";
export const JMA_FLOOD_MIN_ZOOM = 4;
export const JMA_FLOOD_MAX_ZOOM = 14;
/** 上游只有偶數 zoom 的圖磚：每個偶數層一個 source（minzoom=maxzoom），layer 只在 [z, z+2) 顯示，奇數 zoom 由前一個偶數層 overzoom */
export const JMA_FLOOD_SOURCE_ZOOMS = [4, 6, 8, 10, 12, 14] as const;

export const JMA_FLOOD_LEVELS = [
  { value: 1, label: "注意", color: "#f2e700" },
  { value: 2, label: "警戒", color: "#ff2800" },
  { value: 3, label: "危険", color: "#aa00aa" },
  { value: 4, label: "災害切迫", color: "#0c000c" },
] as const;
/** level 不在 1–4（今後の情報等に留意等）：JMA viewer 的預設色 */
export const JMA_FLOOD_OTHER_COLOR = "#3cffff";
export const JMA_FLOOD_OPACITY = 0.75;

export function jmaFloodTileUrl(basetime: string, member: string, validtime: string): string {
  return `https://www.jma.go.jp/bosai/jmatile/data/risk/${basetime}/${member}/${validtime}/surf/flood/{z}/{x}/{y}.pbf`;
}

export function jmaFloodLineColorExpr(): unknown[] {
  return ["match", ["get", "level"], ...JMA_FLOOD_LEVELS.flatMap((l) => [l.value, l.color]), JMA_FLOOD_OTHER_COLOR];
}

/** 線寬：z≥10 為 zoom−7，否則 2（照 JMA viewer）。["zoom"] 只能當頂層 interpolate 的輸入，故以 9.99→10 的陡升近似階梯 */
export function jmaFloodLineWidthExpr(): unknown[] {
  return ["interpolate", ["linear"], ["zoom"], 9.99, 2, 10, 3, 22, 15];
}

// 黃砂予測（地上濃度）：800×580 不透明 PNG（底圖、圖例燒在圖裡）→ 圖片面板，不貼地圖。
export const JMA_KOSA_LIST_URL = "https://www.data.jma.go.jp/env/kosa/fcst/list_js/s_jpjp_list.js";
export const JMA_KOSA_PAGE_URL = "https://www.data.jma.go.jp/env/kosa/fcst/";

export function jmaKosaImageUrl(stamp: string): string {
  return `https://www.data.jma.go.jp/env/kosa/fcst/img/surf/jp/${stamp}_kosafcst-s_jp_jp.png`;
}
