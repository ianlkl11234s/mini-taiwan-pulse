/**
 * 30 天地圖挑戰 Day 17「光與暗 Light & dark」（模擬入口，2026-11-17）：三層的網址、四角座標、色、級距單一資料源，
 * hook／overlayRegistry／圖例／說明框都從這裡 import。零 import（layerManifest 會引用本檔的代表色）。
 *
 * 資料（taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day17_light_dark，研究文件同名 topic-research）：
 * - day17_skyglow_2025.png：天空光害推估 log10(rel)，rel＝S／S(台北車站)，0.001–1 套 magma；只畫台灣行政區陸地。
 * - day17_ground_radiance_2025.png：2025 地面亮度 log10(1+nW/cm²/sr)，0–150 nW 套 inferno；0 或缺值透明。
 *   兩張都已轉 EPSG:3857，四角座標換回經緯度（Mapbox image source 在麥卡托空間線性拉伸，直接貼 4326 會位移）。
 * - day17_protected_area_dark_rank.geojson：48 處保護區（國家公園、自然保留區、野生動物保護區）依天空推估平均排名。
 * - day17_dark_road_segments.geojson：全台「0」（衛星偵測不到）與「低」（0 < rad ≤ 3 nW）路段 7,310 段。
 * - day17_dark_road_runs.geojson：連續 ≥ 1 km 的「0」路段 353 段（含名次、長度、起訖鄉鎮、2024 也是 0 的比例）。
 * - day17_led_share_by_county.geojson：22 縣市 2021–2025 路燈 LED 用電占比（台電各縣市路燈用電量統計，data.gov.tw 152419）。
 * 用語：一律「衛星看不到光的路段」，不寫「沒有路燈」（一個像素約 460 m，單盞路燈看不到）。
 */

export const MAPCHALLENGE_DAY17_SKYGLOW_URL = "./mapchallenge/day17_skyglow_2025.png";
export const MAPCHALLENGE_DAY17_GROUND_URL = "./mapchallenge/day17_ground_radiance_2025.png";
export const MAPCHALLENGE_DAY17_PROTECTED_URL = "./mapchallenge/day17_protected_area_dark_rank.geojson";
export const MAPCHALLENGE_DAY17_SEGMENTS_URL = "./mapchallenge/day17_dark_road_segments.geojson";
export const MAPCHALLENGE_DAY17_RUNS_URL = "./mapchallenge/day17_dark_road_runs.geojson";
export const MAPCHALLENGE_DAY17_LED_URL = "./mapchallenge/day17_led_share_by_county.geojson";

/** 兩張 PNG 同一組四角（左上、右上、右下、左下；_bounds.json 原值） */
export const MAPCHALLENGE_DAY17_IMAGE_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [116.5, 26.5], [122.500258, 26.5], [122.500258, 20.501341], [116.5, 20.501341],
];
export const MAPCHALLENGE_DAY17_IMAGE_BOUNDS = { west: 116.5, east: 122.500258, north: 26.5, south: 20.501341 } as const;

export const MAPCHALLENGE_DAY17_ATTRIBUTION = "夜光：NASA Black Marble VNP46A4（2025 年合成）；保護區：各國家公園管理處、農業部林業及自然保育署（OGDL 1.0）";
export const MAPCHALLENGE_DAY17_NIGHT_LIGHTS_ATTRIBUTION = "夜光：NASA Black Marble VNP46A4（2025 年合成）";
export const MAPCHALLENGE_DAY17_ROADS_ATTRIBUTION = "夜光：NASA Black Marble VNP46A4（2025 年合成）；道路：OpenStreetMap（ODbL）";
export const MAPCHALLENGE_DAY17_LED_ATTRIBUTION = "台灣電力公司各縣市路燈用電量統計（data.gov.tw 152419）· 政府資料開放授權條款第 1 版";

// ── 代表色（sidebar） ──────────────────────────────────────────
export const MAPCHALLENGE_DAY17_DARK_SKY_COLOR = "#b73779"; // magma 中段
export const MAPCHALLENGE_DAY17_ROADS_COLOR = "#93c5fd"; // 月光冷藍
export const MAPCHALLENGE_DAY17_NIGHT_FALL_COLOR = "#fcb519"; // inferno 亮端
export const MAPCHALLENGE_DAY17_LED_COLOR = "#e3922b"; // 鈉燈琥珀

// ── 1. 真正的黑夜 ─────────────────────────────────────────────
/** 影像下拉：encode 0＝天空光害推估（預設）、1＝2025 地面亮度 */
export const MAPCHALLENGE_DAY17_PRODUCTS = [
  { value: "skyglow", label: "天空光害推估", url: MAPCHALLENGE_DAY17_SKYGLOW_URL },
  { value: "ground", label: "2025 地面亮度", url: MAPCHALLENGE_DAY17_GROUND_URL },
] as const;
export function mapchallengeDay17Product(idx: number | undefined) {
  return MAPCHALLENGE_DAY17_PRODUCTS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY17_PRODUCTS[0];
}

/** 天空推估 5 級切點（rel；台灣行政區陸地五分位，1 級＝最暗 20%） */
export const MAPCHALLENGE_DAY17_SKY_BREAKS = [0.004699, 0.012008, 0.046686, 0.132718] as const;
/** PNG 色階範圍：log10(rel) 從 −3（0.001）到 0（台北車站＝1） */
export const MAPCHALLENGE_DAY17_SKY_LOG_MIN = -3;
/** rel → 色帶位置 0–1（圖例切點刻度用） */
export function mapchallengeDay17SkyPos(rel: number): number {
  return Math.max(0, Math.min(1, (Math.log10(rel) - MAPCHALLENGE_DAY17_SKY_LOG_MIN) / -MAPCHALLENGE_DAY17_SKY_LOG_MIN));
}
/** 地面亮度色階上限（nW/cm²/sr；log10(1+nW) 線性） */
export const MAPCHALLENGE_DAY17_GROUND_MAX_NW = 150;

/** matplotlib magma／inferno 9 點（PNG 由同一色盤產生；圖例色帶用） */
export const MAPCHALLENGE_DAY17_MAGMA = ["#000004", "#1c1044", "#4f127b", "#812581", "#b5367a", "#e55064", "#fb8761", "#fec287", "#fcfdbf"] as const;
export const MAPCHALLENGE_DAY17_INFERNO = ["#000004", "#1f0c48", "#550f6d", "#88226a", "#ba3655", "#e35933", "#f98e09", "#f8c932", "#fcffa4"] as const;
export function mapchallengeDay17Gradient(stops: readonly string[]): string {
  return `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(", ")})`;
}

/** 保護區外框：中性對比色（暗底淺、淡底深），填色只當點擊範圍 */
export function mapchallengeDay17ProtectedLineColor(isDark: boolean): string {
  return isDark ? "#e2e8f0" : "#0f172a";
}
export const MAPCHALLENGE_DAY17_PROTECTED_FILL_OPACITY = 0.06;
export const MAPCHALLENGE_DAY17_PROTECTED_TOTAL = 48;

// ── 2. 衛星看不到光的路段 ─────────────────────────────────────
/** 顯示等級下拉：encode 0＝只有 0（預設）、1＝0＋低 */
export const MAPCHALLENGE_DAY17_ROAD_SCOPES = [
  { value: "zero", label: "只顯示偵測不到（0）" },
  { value: "zeroLow", label: "偵測不到＋低亮度" },
] as const;
export function mapchallengeDay17ScopeAt(idx: number | undefined): "zero" | "zeroLow" {
  return MAPCHALLENGE_DAY17_ROAD_SCOPES[Math.trunc(idx ?? 0)]?.value ?? "zero";
}
export const MAPCHALLENGE_DAY17_TOP_RANK = 10;

/** 「0」線色：暗底月光白藍、淡底深靛 */
export function mapchallengeDay17ZeroColor(isDark: boolean): string {
  return isDark ? "#dbeafe" : "#1e3a8a";
}
/** 「低」：中性灰、透明度烘進顏色（與 Day 4／5 同一個灰 #6b7280），比「0」弱 */
export const MAPCHALLENGE_DAY17_LOW_SWATCH = "#6b7280";
export const MAPCHALLENGE_DAY17_LOW_OPACITY = 0.6;
export const MAPCHALLENGE_DAY17_LOW_COLOR = `rgba(107,114,128,${MAPCHALLENGE_DAY17_LOW_OPACITY})`;

/**
 * 前 10 長路段的光暈（P-6 例外，使用者 2026-11-17 確認）：比照 Day 5 海景發光的兩層靜態線光暈，
 * 寬為主體 ×8／×3、blur ×6／×2、透明度 0.35／0.7×圖層透明度；淡底圖光暈透明度再減半。
 */
export const MAPCHALLENGE_DAY17_GLOW = [
  { suffix: "glow-outer", width: 8, blur: 6, opacity: 0.35 },
  { suffix: "glow-inner", width: 3, blur: 2, opacity: 0.7 },
] as const;
export const MAPCHALLENGE_DAY17_GLOW_LIGHT_FACTOR = 0.5;
export function mapchallengeDay17GlowColor(isDark: boolean): string {
  return isDark ? "#93c5fd" : "#1d4ed8";
}

// ── 3. 入夜變亮 ───────────────────────────────────────────────
/** 透明度遮罩格網（經度 × 緯度）：每格依格中心的太陽高度算亮度，再平滑放大到整張影像 */
export const MAPCHALLENGE_DAY17_MASK_GRID = { cols: 48, rows: 48 } as const;
/** 時間軸訂閱節流（ms）：亮度變化以分鐘計，0.5 秒夠 */
export const MAPCHALLENGE_DAY17_NIGHT_FALL_THROTTLE_MS = 500;

// ── 4. 縣市路燈 LED 化 ────────────────────────────────────────
/** 年份下拉（encode 索引＝陣列位置），預設最新年 */
export const MAPCHALLENGE_DAY17_LED_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export type MapchallengeDay17LedYear = (typeof MAPCHALLENGE_DAY17_LED_YEARS)[number];
export const MAPCHALLENGE_DAY17_LED_DEFAULT_YEAR: MapchallengeDay17LedYear = 2025;
export function mapchallengeDay17LedYearAt(idx: number | undefined): MapchallengeDay17LedYear {
  return MAPCHALLENGE_DAY17_LED_YEARS[Math.trunc(idx ?? MAPCHALLENGE_DAY17_LED_YEARS.length - 1)] ?? MAPCHALLENGE_DAY17_LED_DEFAULT_YEAR;
}
export function mapchallengeDay17LedYearByKey(key: string | undefined): MapchallengeDay17LedYear {
  return MAPCHALLENGE_DAY17_LED_YEARS.find((y) => String(y) === key) ?? MAPCHALLENGE_DAY17_LED_DEFAULT_YEAR;
}
/** LED 用電占比（0–1）5 級切點：20／40／60／80% */
export const MAPCHALLENGE_DAY17_LED_CUTS = [0.2, 0.4, 0.6, 0.8] as const;
/**
 * 鈉燈琥珀（LED 少）→ 冷白（LED 多）。暗底：亮度單調遞增，最高級近白；
 * 淡底：白色會融進底圖，冷端改鋼藍（琥珀→淡→藍），靠色相分高低。
 */
export const MAPCHALLENGE_DAY17_LED_COLORS_DARK = ["#b0500a", "#e3922b", "#f2c97a", "#94b8e0", "#f4f8ff"] as const;
export const MAPCHALLENGE_DAY17_LED_COLORS_LIGHT = ["#a3470a", "#d98a2b", "#ecc777", "#9cc0dd", "#4d82b3"] as const;
export const mapchallengeDay17LedColors = (isDark: boolean) => (isDark ? MAPCHALLENGE_DAY17_LED_COLORS_DARK : MAPCHALLENGE_DAY17_LED_COLORS_LIGHT);
/** 缺值（目前資料無缺格；保留語意不當 0） */
export const MAPCHALLENGE_DAY17_LED_NULL_COLOR = "#6b7280";
export function mapchallengeDay17LedColorExpr(year: MapchallengeDay17LedYear, isDark: boolean): unknown[] {
  const c = mapchallengeDay17LedColors(isDark);
  const v = ["get", `led_share_${year}`];
  const step: unknown[] = ["step", ["to-number", v], c[0]];
  MAPCHALLENGE_DAY17_LED_CUTS.forEach((cut, i) => step.push(cut, c[i + 1]));
  return ["case", ["==", ["typeof", v], "number"], step, MAPCHALLENGE_DAY17_LED_NULL_COLOR];
}
export function mapchallengeDay17LedFeatureColor(share: unknown, isDark: boolean): string {
  if (typeof share !== "number" || !Number.isFinite(share)) return MAPCHALLENGE_DAY17_LED_NULL_COLOR;
  return mapchallengeDay17LedColors(isDark)[MAPCHALLENGE_DAY17_LED_CUTS.filter((cut) => share >= cut).length]!;
}
/** 全台逐年 LED 用電占比（day17_led_summary.json） */
export const MAPCHALLENGE_DAY17_LED_NATIONAL: Readonly<Record<MapchallengeDay17LedYear, number>> = {
  2021: 0.4211, 2022: 0.4456, 2023: 0.4765, 2024: 0.506, 2025: 0.5217,
};
