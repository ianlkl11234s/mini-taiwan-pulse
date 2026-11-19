/**
 * 30 天地圖挑戰 Day 19「氣味 Smell」（模擬入口，2026-11-19）：三層的網址、四角座標、類別、級距單一資料源，
 * hook／overlayRegistry／圖例／說明框都從這裡 import。零 import（layerManifest 會引用本檔的代表色）；
 * 依賴 map/mapStyleScale 的顏色運算式在 mapchallengeDay19Style.ts。
 *
 * 資料（taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day19_smell 00–05，研究文件同名 topic-research）：
 * - day19_complaints_2025／2026.geojson：環境部公害陳情案件分佈圖（data.gov.tw 6390）的異味陳情，自適應 H3 網格
 *   （res 9 約 0.1 km²；格內不足 3 個不同被陳情地點就併到 res 8 約 0.7 km²、再併到 res 7 約 5 km²），
 *   props lvl／n／六類件數／top／area（km²）／dens（件/km²）。不含地址、點位、地點數。
 * - day19_potential_{iso,winter,summer}.png：設施氣味潛勢 500 m 格，4 級色已燒進圖，已轉 Web Mercator。
 * - day19_wind_arrows.geojson：ERA5 2025 盛行風箭頭（season／from／spd／calm／steady）。
 * - day19_odor_facilities.geojson：掩埋場、焚化廠、公共污水廠、屠宰場、飼料廠（kind／name／label）。
 * - day19_dumping_sites.geojson：列管廢棄物棄置場址 WR_P_244（county／dist／kind／updated／soilwater）。
 * - day19_odor_penalties.geojson：事實欄寫到「異味污染物」的環保裁處，依設施彙總（505 處、848 件）。
 */

export const MAPCHALLENGE_DAY19_COMPLAINTS_2025_URL = "./mapchallenge/day19_complaints_2025.geojson";
export const MAPCHALLENGE_DAY19_COMPLAINTS_2026_URL = "./mapchallenge/day19_complaints_2026.geojson";
export const MAPCHALLENGE_DAY19_POTENTIAL_ISO_URL = "./mapchallenge/day19_potential_iso.png";
export const MAPCHALLENGE_DAY19_POTENTIAL_WINTER_URL = "./mapchallenge/day19_potential_winter.png";
export const MAPCHALLENGE_DAY19_POTENTIAL_SUMMER_URL = "./mapchallenge/day19_potential_summer.png";
export const MAPCHALLENGE_DAY19_WIND_URL = "./mapchallenge/day19_wind_arrows.geojson";
export const MAPCHALLENGE_DAY19_FACILITIES_URL = "./mapchallenge/day19_odor_facilities.geojson";
export const MAPCHALLENGE_DAY19_DUMPING_URL = "./mapchallenge/day19_dumping_sites.geojson";
export const MAPCHALLENGE_DAY19_PENALTIES_URL = "./mapchallenge/day19_odor_penalties.geojson";

export const MAPCHALLENGE_DAY19_COMPLAINTS_ATTRIBUTION = "環境部公害陳情案件分佈圖（data.gov.tw 6390）· 政府資料開放授權條款第 1 版";
export const MAPCHALLENGE_DAY19_POTENTIAL_ATTRIBUTION = "TEDS 13.0 氨排放；掩埋場、焚化廠、公共污水廠、屠宰場、飼料廠；ERA5（Copernicus／ECMWF，經 Open-Meteo）；列管廢棄物棄置場址（WR_P_244）· 政府資料開放授權條款第 1 版";
export const MAPCHALLENGE_DAY19_PENALTIES_ATTRIBUTION = "環境部環保裁處 · 政府資料開放授權條款第 1 版";

// ── 代表色（sidebar） ──────────────────────────────────────────
export const MAPCHALLENGE_DAY19_COMPLAINTS_COLOR = "#ffa41b"; // C-5 琥珀（餐飲油煙，最多的一類）
export const MAPCHALLENGE_DAY19_POTENTIAL_COLOR = "#ec7014"; // 潛勢第 3 級
export const MAPCHALLENGE_DAY19_PENALTIES_COLOR = "#fe9929"; // 超標 2–5 倍

// ── 1. 異味陳情網格 ───────────────────────────────────────────
/** 期間下拉：encode 0＝2025 全年（預設）、1＝2026 年 1–9 月。兩期是兩份檔，切換只顯示所選那份，不相加。 */
export const MAPCHALLENGE_DAY19_PERIODS = [
  { value: "2025", label: "2025 全年", url: MAPCHALLENGE_DAY19_COMPLAINTS_2025_URL },
  { value: "2026", label: "2026 年 1–9 月（7 月官方未提供）", url: MAPCHALLENGE_DAY19_COMPLAINTS_2026_URL },
] as const;
export type MapchallengeDay19Period = (typeof MAPCHALLENGE_DAY19_PERIODS)[number]["value"];
export function mapchallengeDay19PeriodAt(idx: number | undefined): MapchallengeDay19Period {
  return MAPCHALLENGE_DAY19_PERIODS[Math.trunc(idx ?? 0)]?.value ?? "2025";
}
export function mapchallengeDay19PeriodByKey(key: string | undefined): MapchallengeDay19Period {
  return MAPCHALLENGE_DAY19_PERIODS.find((p) => p.value === key)?.value ?? "2025";
}

/** 六類（欄名＝geojson 件數欄＝top 的值）；順序即圖例與說明框順序 */
export const MAPCHALLENGE_DAY19_CATEGORIES = [
  { key: "cooking", label: "餐飲油煙" },
  { key: "burning", label: "露天燃燒" },
  { key: "incense", label: "燒香紙錢" },
  { key: "industry", label: "工廠作業" },
  { key: "farm", label: "畜牧與堆肥" },
  { key: "other", label: "其他或不明" },
] as const;
export type MapchallengeDay19Category = (typeof MAPCHALLENGE_DAY19_CATEGORIES)[number]["key"];
export const MAPCHALLENGE_DAY19_CATEGORY_KEYS = MAPCHALLENGE_DAY19_CATEGORIES.map((c) => c.key);

/** 類別下拉：encode 0＝全部（依主因上色，預設），1–6＝單一類別 */
export const MAPCHALLENGE_DAY19_CATEGORY_OPTIONS = [
  { value: "all", label: "全部（依主因上色）" },
  ...MAPCHALLENGE_DAY19_CATEGORIES.map((c) => ({ value: c.key, label: c.label })),
] as const;
export function mapchallengeDay19CategoryAt(idx: number | undefined): MapchallengeDay19Category | "all" {
  const v = MAPCHALLENGE_DAY19_CATEGORY_OPTIONS[Math.trunc(idx ?? 0)]?.value ?? "all";
  return v as MapchallengeDay19Category | "all";
}
export function mapchallengeDay19CategoryByKey(key: string | undefined): MapchallengeDay19Category | "all" {
  return (MAPCHALLENGE_DAY19_CATEGORY_OPTIONS.find((o) => o.value === key)?.value ?? "all") as MapchallengeDay19Category | "all";
}

/** 密度切點（件/km²；2025 格的 q50／q75／q90／q97，兩期共用） */
export const MAPCHALLENGE_DAY19_DENS_CUTS = [31.7, 63.3, 108, 212] as const;
/** 5 級填色透明度（× 透明度滑桿 ÷ 預設）：密度越高越實 */
export const MAPCHALLENGE_DAY19_DENS_OPACITY = [0.22, 0.38, 0.55, 0.72, 0.92] as const;
export function mapchallengeDay19DensBin(dens: number): number {
  return MAPCHALLENGE_DAY19_DENS_CUTS.filter((c) => dens >= c).length;
}
/** 網格大小（lvl → 說明框文字的 key 後綴） */
export const MAPCHALLENGE_DAY19_LEVELS = [9, 8, 7] as const;

/** 兩期案件總數（day19_layer_stats.json；畫出的件數＝總數減去不足 3 個地點未畫的） */
export const MAPCHALLENGE_DAY19_PERIOD_STATS = {
  "2025": { cases: 62451, drawn: 60093 },
  "2026": { cases: 40568, drawn: 38223 },
} as const;

// ── 2. 設施氣味潛勢＋風 ───────────────────────────────────────
/** 風向下拉：encode 0＝不計風（iso，預設）、1＝冬季、2＝夏季；wind 為箭頭檔的 season 值 */
export const MAPCHALLENGE_DAY19_WINDS = [
  { value: "iso", label: "不計風", url: MAPCHALLENGE_DAY19_POTENTIAL_ISO_URL, season: null },
  { value: "winter", label: "冬季風（1–3、10–12 月）", url: MAPCHALLENGE_DAY19_POTENTIAL_WINTER_URL, season: "winter" },
  { value: "summer", label: "夏季風（6–8 月）", url: MAPCHALLENGE_DAY19_POTENTIAL_SUMMER_URL, season: "summer" },
] as const;
export function mapchallengeDay19Wind(idx: number | undefined) {
  return MAPCHALLENGE_DAY19_WINDS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY19_WINDS[0];
}

/** 三張 PNG 同一組四角（左上、右上、右下、左下；Web Mercator 影像，四角換回經緯度） */
export const MAPCHALLENGE_DAY19_IMAGE_CORNERS: [[number, number], [number, number], [number, number], [number, number]] = [
  [119.95, 25.35], [122.05, 25.35], [122.05, 21.85], [119.95, 21.85],
];

/** 潛勢 4 級（與 PNG 燒進的色一致；陸地格的前 25／10／3／1%） */
export const MAPCHALLENGE_DAY19_POTENTIAL_CLASSES = [
  { color: "rgba(254,196,79,.27)", label: "前 25%" },
  { color: "rgba(254,153,41,.55)", label: "前 10%" },
  { color: "rgba(236,112,20,.78)", label: "前 3%" },
  { color: "rgba(204,56,2,.96)", label: "前 1%" },
] as const;

/** 設施五類（kind 值）＋假設權重；顏色索引取 C-5 類別色盤，避開潛勢的橘色系 */
export const MAPCHALLENGE_DAY19_FACILITY_KINDS = [
  { kind: "landfill", label: "掩埋場", weight: 30, colorIdx: 4 },
  { kind: "sewage", label: "公共污水廠", weight: 15, colorIdx: 2 },
  { kind: "incinerator", label: "焚化廠", weight: 10, colorIdx: 0 },
  { kind: "slaughter", label: "屠宰場", weight: 10, colorIdx: 7 },
  { kind: "feed", label: "飼料廠", weight: 5, colorIdx: 5 },
] as const;
export type MapchallengeDay19FacilityKind = (typeof MAPCHALLENGE_DAY19_FACILITY_KINDS)[number]["kind"];

/** 16 方位（0° 起每 22.5°，順時針） */
export const MAPCHALLENGE_DAY19_COMPASS_16 = [
  "北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東",
  "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西",
] as const;
export function mapchallengeDay19CompassIdx(deg: number): number {
  return ((Math.round((((deg % 360) + 360) % 360) / 22.5) % 16) + 16) % 16;
}

// ── 3. 異味裁罰設施 ───────────────────────────────────────────
export const MAPCHALLENGE_DAY19_PENALTY_TOTALS = { facilities: 505, events: 848 } as const;
/** 最高超標倍數切點：≤2、2–5、>5（null＝未載明倍數，灰） */
export const MAPCHALLENGE_DAY19_RATIO_CUTS = [2, 5] as const;
/** 顯示下拉：encode 0＝全部（預設）、1＝只看有載明超標倍數、2＝只看超標 >5 倍 */
export const MAPCHALLENGE_DAY19_PENALTY_SCOPES = [
  { value: "all", label: "全部" },
  { value: "ratio", label: "有載明超標倍數" },
  { value: "over5", label: "超標 >5 倍" },
] as const;
export function mapchallengeDay19PenaltyScopeAt(idx: number | undefined): "all" | "ratio" | "over5" {
  return MAPCHALLENGE_DAY19_PENALTY_SCOPES[Math.trunc(idx ?? 0)]?.value ?? "all";
}
/** 半徑依裁罰件數：base + k × √min(n, cap)（n 1–62，347 處只有 1 件，所以開根號並設上限） */
export const MAPCHALLENGE_DAY19_PENALTY_RADIUS = { base: 2.5, k: 2.2, cap: 36 } as const;
export function mapchallengeDay19PenaltyRadius(n: number, scale = 1): number {
  const r = MAPCHALLENGE_DAY19_PENALTY_RADIUS;
  return (r.base + r.k * Math.sqrt(Math.max(1, Math.min(n, r.cap)))) * scale;
}
