/**
 * 房地產總市值（urban_composite/property_value）三件套的配色、分級、格式化單一真實來源。
 *
 * 上游 SSOT：taipei-gis-analytics `docs/handoff/property-value.md`
 * 估值公式：footprint(m²) × 樓層(h÷3.2) × 所在 150m 網格買賣中位單價 × per-county GFA 校正係數；
 * 非市場建物（機關/學校/車站等）標記後排除。全台市場only 校正後 ≈ 204.1 兆（vs 國富統計 230 兆 = 0.887x）。
 *
 * 三個消費端共用本檔（同 urbanFormGridTypes.ts 慣例）：
 *   1. overlayRegistry —— buildingsGba 第 5 模式「估值」fill-color + propertyValueGrid fill-color/opacity
 *   2. LegendPanel    —— BuildingsGbaLegend(modeIdx=4) + PropertyValueGridLegend
 *   3. featureInfo    —— BuildingsGbaPanel（估值列）+ PropertyValueGridPanel
 *   4. PropertyValuePanel —— 縣市總市值長條圖（金額格式化共用）
 *
 * ⚠️ 金額單位：PMTiles 的 `v` / `v_mkt` / `v_all` 皆為 **萬元**（×10,000 = 元）；
 *    admin_value.json 的 `value_*` 欄位皆為 **元**。兩者用不同 formatter，別混用。
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（見 streetTreeColors.ts 註）。
 */

import type { GridColorBand } from "./urbanFormGridTypes";

// ── 金額格式化（輸入單位：萬元）──────────────────────────────

/**
 * 萬元 → 人類可讀（萬 / 億 / 兆自動換算）。
 * < 1 億 → 萬元整數；< 1 兆 → 億元（量級決定小數位）；≥ 1 兆 → 兆元。
 */
export function formatWanTwd(wan: number): string {
  if (!Number.isFinite(wan) || wan <= 0) return "";
  if (wan < 10_000) return `${Math.round(wan).toLocaleString()} 萬元`;
  const yi = wan / 10_000; // 億元
  if (yi < 10_000) {
    const digits = yi < 100 ? 2 : yi < 1_000 ? 1 : 0;
    return `${yi.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} 億元`;
  }
  return `${(yi / 10_000).toFixed(2)} 兆元`;
}

/** 元 → 兆元（admin_value.json 的 value_* 欄位用；縣市級數字一律 ≥ 1 兆量級） */
export function formatNtdTrillion(ntd: number): string {
  if (!Number.isFinite(ntd) || ntd <= 0) return "";
  return `${(ntd / 1e12).toFixed(2)} 兆元`;
}

// ── 價格來源（誠實度標記）────────────────────────────────────
// buildings 層 `ps` 用單字母、grid 層 `ps_dom` 用完整字串，兩份對照表都要。
// t/c 代表該棟/該格所在網格無成交，是用行政區中位價推的 → tooltip 必須講明。

export const PRICE_SOURCE_LABEL: Record<string, string> = {
  g: "實價網格",
  n: "鄰近網格",
  t: "鄉鎮中位",
  c: "縣市中位",
};

export const PRICE_SOURCE_DOM_LABEL: Record<string, string> = {
  grid: "實價網格",
  neighbor: "鄰近網格",
  township: "鄉鎮中位",
  county: "縣市中位",
};

/** 價格來源代碼 → 中文（吃單字母與完整字串兩種形式；未知值原樣回傳） */
export function priceSourceLabel(code: unknown): string {
  const s = String(code ?? "");
  return PRICE_SOURCE_LABEL[s] ?? PRICE_SOURCE_DOM_LABEL[s] ?? s;
}

// ── 建物估值分級（buildingsGba modeIdx=4）────────────────────
// 單棟市場估值 log 分級（線性會全糊：p50=1,384 萬 / p99=20.6 億 / max=1,818 億）。
// 斷點依市場建物實際分位數取人類友善量級，7 級各佔 20.3/22.9/20.9/16.6/13.8/4.9/0.6%。
// 色票 ColorBrewer YlOrRd 7-class（低→高：淺黃→深紅），刻意與高度模式的
// RdYlBu（藍→紅）區隔，避免兩模式看起來像同一件事。
export const BUILDING_VALUE_BANDS: GridColorBand[] = [
  { max: 300,     color: "#ffffb2", label: "< 300 萬" },
  { max: 1_000,   color: "#fed976", label: "300 – 1,000 萬" },
  { max: 3_000,   color: "#feb24c", label: "1,000 – 3,000 萬" },
  { max: 10_000,  color: "#fd8d3c", label: "3,000 萬 – 1 億" },
  { max: 50_000,  color: "#fc4e2a", label: "1 – 5 億" },
  { max: 300_000, color: "#e31a1c", label: "5 – 30 億" },
  { max: null,    color: "#b10026", label: "≥ 30 億" },
];

/** 非市場建物（nm=1：機關/學校/車站等）一律灰色「未估值」——方法誠實度的視覺承諾 */
export const BUILDING_VALUE_NON_MARKET_COLOR = "#78909c";

/**
 * 建物估值 fill-color：nm=1 或 v<=0 → 灰（未估值）；否則依 7 級 band 上色。
 * ⚠️ nm 判斷必須在前：非市場建物的 `v` 在磚裡是有值的（只是不計入總值），
 *    先看 v 會把它們染成正常估值色，違反上游「nm=1 一律灰」的約定。
 */
export function buildingValueColorExpr(): unknown[] {
  const val: unknown[] = ["to-number", ["get", "v"], 0];
  const step: unknown[] = ["step", val, BUILDING_VALUE_BANDS[0]!.color];
  for (let i = 1; i < BUILDING_VALUE_BANDS.length; i++) {
    step.push(BUILDING_VALUE_BANDS[i - 1]!.max as number, BUILDING_VALUE_BANDS[i]!.color);
  }
  return [
    "case",
    ["==", ["to-number", ["get", "nm"], 0], 1], BUILDING_VALUE_NON_MARKET_COLOR,
    ["<=", val, 0], BUILDING_VALUE_NON_MARKET_COLOR,
    step,
  ];
}

// ── 總市值網格：三尺度（150m / 450m / 1.5km）SSOT ──────────────
//
// 主數字 = `v_mkt`（萬元，市場only + GFA 校正）。這是**總量**不是單價 ——
// 跟 realEstate*Grid 的 price_per_sqm_median（每 m² 多貴）語意不同，圖例要講清楚。
// 三尺度為巢狀聚合（450m = 3×3 個 150m、1500m = 10×10 個，共用 origin），
// 三者 v_mkt 加總皆 204.105 兆。**尺度由使用者手動選，不隨 zoom 自動切換**
// （用戶明確要求：想在 z4/z5 也看 150m 細格紋理）。
//
// 配色：**9 級 inferno**（perceptually-uniform，亮度嚴格單調 L* 0.22→0.98、
// 相鄰級 WCAG 對比比 1.32–1.47 幾乎等距）。深紫沉入深色底圖、亮黃跳出 ——
// 「錢多的地方會發光」，方向性刻意如此。亦與 buildingsGba 估值模式的 YlOrRd（單棟）
// 區隔：兩層同開時分得出誰是誰。三尺度共用同一組色，只有斷點平移。
//
// 斷點：**1-3-10 對數階梯**，各尺度自己算（粗格值域整體右移，沿用細格斷點會全部爆頂）。
// 設計準則（與 stats JSON 的「均衡版」不同，刻意選這條）：
//   中段 1-6 級各佔 8–25%（吃掉主體）＋**頂兩級合計 0.5–2%**（亮黃只屬於最誇張的格，
//   與 3D 高度不封頂呼應）。實算三尺度都只有唯一一組階梯同時滿足，見各 scale 註解。
export const PROPERTY_VALUE_INFERNO_9 = [
  "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d03c", "#fcffa4",
] as const;

/** 依 8 個斷點（萬元）+ 億元標籤產生 9 級 band（色票固定為 inferno 9） */
function infernoBands(breaksWan: number[], labels: string[]): GridColorBand[] {
  return PROPERTY_VALUE_INFERNO_9.map((color, i) => ({
    max: i < breaksWan.length ? breaksWan[i]! : null,
    color,
    label: labels[i]!,
  }));
}

export interface PropertyValueScale {
  /** select value（= 陣列 index 字串），對齊 overlayParams.propertyValueGridScaleIdx */
  value: string;
  label: string;
  /** 供 popup 標題與圖例標題顯示 */
  shortLabel: string;
  sourceId: string;
  sourceUrl: string;
  sourceLayer: string;
  minzoom: number;
  maxzoom: number;
  /** grid_id 前綴，供 popup 反推目前是哪個尺度（不必額外傳參） */
  idPrefix: string;
  bands: GridColorBand[];
  /** 3D 高度下錨（萬元）= 該尺度第 1 斷點；以下貼地 */
  heightFloorWan: number;
  /** 3D 高度上錨（萬元）= 該尺度資料真實最大格；**不封頂**，超過就刺出滿格 */
  heightMaxWan: number;
  /**
   * 該尺度 PMTiles 是否帶 `pop` 屬性（人口，最小統計區面積加權；0 = 無人口資料或無人）。
   * 上游只烤進 450m / 1.5km 兩份磚，**150m 沒有** → 人均模式在 150m 停用（UI disabled）。
   */
  hasPop: boolean;
}

// 逐級占比（上游 grid_value_150m.parquet 實算，2026-07-27）：
//   150m  n=333,847：17.14 / 15.51 / 21.28 / 18.07 / 14.94 / 8.66 / 3.60 / 0.71 / 0.08 %  頂兩級 0.79%
//   450m  n= 69,172：15.89 / 14.64 / 18.55 / 20.10 / 13.38 / 10.27 / 5.43 / 1.54 / 0.20 % 頂兩級 1.74%
//   1500m n=  9,828：26.32 / 14.23 / 17.40 / 17.30 / 10.84 / 9.04 / 3.79 / 0.95 / 0.14 %  頂兩級 1.09%
// 平移量非線性（450m 只 +1 階、1500m +3 階，而面積是 9× / 100×）：粗格值由少數密集子格主導，
// 不隨面積等比放大 —— 所以一定要各尺度實算，不能直接照面積倍率推。
// 1500m 第 1 級 26.3% 略超 25% 準則：往下移一階會讓頂兩級暴增到 4.87%（亮黃泛濫、
// 重演封頂觀感），兩害相權保留 —— 第 1 級是「鄉間近乎空格」的背景色，胖一點無妨。
export const PROPERTY_VALUE_SCALES: PropertyValueScale[] = [
  {
    value: "0", label: "150m 細格", shortLabel: "150m",
    sourceId: "property-value-grid-150",
    sourceUrl: "./urban/property_value_grid_150m.pmtiles",
    sourceLayer: "grid_value_150m", minzoom: 4, maxzoom: 14, idPrefix: "G_", hasPop: false,
    bands: infernoBands(
      [1_000, 3_000, 10_000, 30_000, 100_000, 300_000, 1_000_000, 3_000_000],
      ["< 0.1 億", "0.1 – 0.3 億", "0.3 – 1 億", "1 – 3 億", "3 – 10 億", "10 – 30 億", "30 – 100 億", "100 – 300 億", "> 300 億"],
    ),
    heightFloorWan: 1_000,
    heightMaxWan: 18_730_533,      // 1,873 億
  },
  {
    value: "1", label: "450m 中格", shortLabel: "450m",
    sourceId: "property-value-grid-450",
    sourceUrl: "./urban/property_value_grid_450m.pmtiles",
    sourceLayer: "grid_value_450m", minzoom: 4, maxzoom: 13, idPrefix: "G450_", hasPop: true,
    bands: infernoBands(
      [3_000, 10_000, 30_000, 100_000, 300_000, 1_000_000, 3_000_000, 10_000_000],
      ["< 0.3 億", "0.3 – 1 億", "1 – 3 億", "3 – 10 億", "10 – 30 億", "30 – 100 億", "100 – 300 億", "300 – 1,000 億", "> 1,000 億"],
    ),
    heightFloorWan: 3_000,
    heightMaxWan: 63_339_355,      // 6,334 億
  },
  {
    value: "2", label: "1.5km 粗格", shortLabel: "1.5km",
    sourceId: "property-value-grid-1500",
    sourceUrl: "./urban/property_value_grid_1500m.pmtiles",
    sourceLayer: "grid_value_1500m", minzoom: 4, maxzoom: 12, idPrefix: "G1500_", hasPop: true,
    bands: infernoBands(
      [30_000, 100_000, 300_000, 1_000_000, 3_000_000, 10_000_000, 30_000_000, 100_000_000],
      ["< 3 億", "3 – 10 億", "10 – 30 億", "30 – 100 億", "100 – 300 億", "300 – 1,000 億", "1,000 – 3,000 億", "3,000 – 1 兆", "> 1 兆"],
    ),
    heightFloorWan: 30_000,
    heightMaxWan: 240_892_448,     // 24,089 億
  },
];

/** scaleIdx → scale 設定（越界回退 150m） */
export function resolvePropertyValueScale(scaleIdx: number): PropertyValueScale {
  return PROPERTY_VALUE_SCALES[scaleIdx] ?? PROPERTY_VALUE_SCALES[0]!;
}

/** grid_id 前綴反推尺度（popup 用：三尺度共用同一個 panel，不必額外傳參） */
export function scaleFromGridId(gridId: unknown): PropertyValueScale {
  const s = String(gridId ?? "");
  // ⚠️ 由長到短比對：G_ 是 G450_/G1500_ 的前綴子字串，順序反了會全部判成 150m
  return (
    PROPERTY_VALUE_SCALES.find((sc) => sc.idPrefix !== "G_" && s.startsWith(sc.idPrefix)) ??
    PROPERTY_VALUE_SCALES[0]!
  );
}

/** 150m 尺度的 band（PropertyValuePanel 長條圖色帶取樣用；圖例/popup 一律走 scale.bands） */
export const PROPERTY_VALUE_GRID_BANDS: GridColorBand[] = PROPERTY_VALUE_SCALES[0]!.bands;

/** 總市值網格 fill-color：依該尺度 9 級 step 上色（0 值格靠 opacity 淡出，不另給色） */
export function propertyValueGridColorExpr(scaleIdx: number): unknown[] {
  const bands = resolvePropertyValueScale(scaleIdx).bands;
  const val: unknown[] = ["to-number", ["get", "v_mkt"], 0];
  const step: unknown[] = ["step", val, bands[0]!.color];
  for (let i = 1; i < bands.length; i++) {
    step.push(bands[i - 1]!.max as number, bands[i]!.color);
  }
  return step;
}

/**
 * 總市值網格 fill-opacity：v_mkt=0 的格（150m 1,808 / 450m 82 / 1500m 3 格，
 * 格內僅非市場建物）淡出，避免用最深色蓋掉底圖被誤讀成「有一點價值」
 * （同 urbanFormGrid zeroFade 慣例）。
 */
export function propertyValueGridOpacityExpr(baseOpacity: number): unknown[] {
  return ["case", ["<=", ["to-number", ["get", "v_mkt"], 0], 0], 0.04, baseOpacity];
}

// ── 上色模式：總市值（0，預設）/ 人均市值（1）────────────────────
//
// 人均市值 = `v_mkt / pop`（萬元/人）。`pop` 只存在於 450m / 1.5km 兩份磚（150m 沒有）
// → 150m 時人均選項 disabled（不自動跳尺度），paint 端由 resolvePropertyValueGridMode()
// 統一回退成總市值，UI / 圖例 / paint 三邊都吃同一個 helper，不會各自為政。
//
// 配色：**viridis 8 級**（perceptually-uniform；紫→藍→青→綠→黃）。刻意選一條與總市值
// 模式的 inferno（紫→紅→橙→黃）中段區分得開的色帶——兩模式切換時一眼看得出「換了語意」，
// 且與 buildingsGba 估值 YlOrRd 也不撞。
//
// pop < PROPERTY_VALUE_PER_CAPITA_MIN_POP 的格視為統計不可靠（分母太小，一棟豪宅配
// 兩個人會爆表）→ 上灰 #555 + 半透明，**不隱藏**（保留可點查，popup 會講明樣本不足）。

/** 顯示模式 select 選項；index 對齊 overlayParams.propertyValueGridModeIdx。預設 0=總市值。 */
export const PROPERTY_VALUE_GRID_MODES = [
  { value: "0", label: "總市值" },
  { value: "1", label: "人均市值" },
] as const;

/** 人均統計可靠門檻（人）：pop < 10 → 灰色不分級（含 pop=0 = 無人口資料或無人） */
export const PROPERTY_VALUE_PER_CAPITA_MIN_POP = 10;

/** pop < 門檻的格用色（半透明處理在 opacity expr，這裡只管色相） */
export const PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR = "#555555";

/**
 * 人均市值斷點（萬元/人），已依上游實算分位數校準（2026-07-29，pop>=10 格）：
 *   450m  p5 50 / p25 261 / p50 549 / p75 1235 / p90 3179 / p95 6178 / p99 28730
 *   1.5km p5 63 / p25 310 / p50 560 / p75 1073 / p90 2373 / p95 4263 / p99 20090
 * 中位數 ~550 落第 4 級、頂級 >10000 約佔 2%（長尾主要是工業區/機場等低人口格）。
 * 級距標籤與 mapbox expression 都從這裡自動衍生，再校準只改這一個陣列。
 * 兩尺度共用同一組（人均是強度量、已被人口正規化，實算分佈確認相近，不拆 per-scale）。
 */
export const PROPERTY_VALUE_PER_CAPITA_BREAKS_WAN: number[] = [100, 250, 550, 1000, 2000, 4000, 10000];

/** viridis 8 級（低→高）；與總市值 inferno 9 級明確區分（見上方模式段註解） */
export const PROPERTY_VALUE_VIRIDIS_8 = [
  "#440154", "#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#fde725",
] as const;

/** 斷點 → 人均 band（標籤自動衍生，校準只動 BREAKS 陣列） */
function perCapitaBands(): GridColorBand[] {
  const br = PROPERTY_VALUE_PER_CAPITA_BREAKS_WAN;
  const fmt = (n: number) => n.toLocaleString();
  return PROPERTY_VALUE_VIRIDIS_8.map((color, i) => ({
    max: i < br.length ? br[i]! : null,
    color,
    label:
      i === 0 ? `< ${fmt(br[0]!)} 萬/人`
      : i < br.length ? `${fmt(br[i - 1]!)} – ${fmt(br[i]!)} 萬/人`
      : `> ${fmt(br[br.length - 1]!)} 萬/人`,
  }));
}

/** 人均市值 8 級 band（圖例 / popup Title 上色共用） */
export const PROPERTY_VALUE_PER_CAPITA_BANDS: GridColorBand[] = perCapitaBands();

/**
 * scaleIdx + modeIdx → **有效**模式（0=總市值 / 1=人均）。
 * 人均只在帶 pop 的尺度（450m / 1.5km）有效；150m 選了人均一律回退總市值 ——
 * paint / 圖例 / popup 的模式判斷都必須走這裡，不可自己讀 raw modeIdx。
 */
export function resolvePropertyValueGridMode(scaleIdx: number, modeIdx: number): number {
  return modeIdx === 1 && resolvePropertyValueScale(scaleIdx).hasPop ? 1 : 0;
}

/**
 * 人均市值 fill-color：pop < 門檻（含 0）→ 灰；否則依 `v_mkt / pop` 8 級 viridis step。
 * 除法只發生在 pop ≥ 門檻的分支，不會除以 0。
 */
export function propertyValueGridPerCapitaColorExpr(): unknown[] {
  const bands = PROPERTY_VALUE_PER_CAPITA_BANDS;
  const perCapita: unknown[] = [
    "/", ["to-number", ["get", "v_mkt"], 0], ["to-number", ["get", "pop"], 0],
  ];
  const step: unknown[] = ["step", perCapita, bands[0]!.color];
  for (let i = 1; i < bands.length; i++) {
    step.push(bands[i - 1]!.max as number, bands[i]!.color);
  }
  return [
    "case",
    ["<", ["to-number", ["get", "pop"], 0], PROPERTY_VALUE_PER_CAPITA_MIN_POP],
    PROPERTY_VALUE_PER_CAPITA_LOW_POP_COLOR,
    step,
  ];
}

/**
 * 人均市值 fill-opacity：pop < 門檻的灰格半透明（×0.45），其餘吃 baseOpacity。
 * 不做 v_mkt=0 淡出——人均模式下 pop ≥ 門檻而 v_mkt=0 是「有人住但格內僅非市場建物」，
 * 0 萬/人落在第 1 級是誠實的低值，不是缺值。
 */
export function propertyValueGridPerCapitaOpacityExpr(baseOpacity: number): unknown[] {
  return [
    "case",
    ["<", ["to-number", ["get", "pop"], 0], PROPERTY_VALUE_PER_CAPITA_MIN_POP],
    baseOpacity * 0.45,
    baseOpacity,
  ];
}

// ── 3D 立體高度映射（照人口網格 h3LayerFactory 的 log + gamma 慣例）──────
//
// 人口層做法：`norm = pow(log1p(v)/log1p(max), contrast)`、`height = norm × elevationScale × 100`，
// 但那是 per-feature JS（GeoJSON 產檔時算好塞進 properties.height）。本層是 PMTiles，
// 只能用 mapbox expression 現算，且 v_mkt 偏斜遠比人口嚴重（150m p50=8,050 / max=1,873 萬萬元
// = 2,300 倍），純 log1p(v)/log1p(max) 會把 p25→p99 壓成只差 2.9 倍（整片一樣高，看不出天際線）。
//
// 故改「**在對數軸上錨定下限 + 用資料真實最大值當上錨**」，且**上下錨隨尺度換**
// （粗格值域整體右移，沿用細格的錨會全部爆頂 —— 同斷點要平移的道理）：
//   FLOOR = 該尺度色階第 1 斷點 → 高度 0
//   MAX   = 該尺度資料實際最大格 → 高度滿格
// Contrast / Height 滑桿三尺度共用（切尺度不重置，正規化已各自吃自己的錨）。
//
// 🔴 **不做上限 clamp**（2026-07-27 用戶實測回饋）：初版用 CAP=100 億（p99.2）封頂，
//    導致台北核心 0.79%（2,642 格）全部撞頂變「平頂高原」，看不出核心裡誰更貴。
//    改用真實 max 當上錨後，p99 / p99.9 / max 之間拉出明顯階差，極端值直接刺出來 ——
//    高度負責「突出極值」、顏色負責「呈現分佈」（9 級 inferno），兩個視覺通道分工。
//    表達式也因此不需要 `min(v, MAX)`：真有超過上錨的值（未來上游重跑）就自然刺出滿格。
//
// 實測 150m（contrast=1.8, elevationScale=40 → 滿格 4,000m）：
//   p25 26m / p50 245m / p75 659m / p90 1,150m / p99 2,040m / p99.9 2,703m / max 4,000m

/**
 * 總市值網格 fill-extrusion-height（公尺）。
 *
 * `height = pow(max(0, (ln(1+v_mkt) − ln(1+FLOOR)) / LN_SPAN), contrast) × elevationScale × 100`
 *
 * @param scaleIdx       尺度 index（決定 FLOOR / MAX 錨）
 * @param contrast       對比 γ（同人口層 0.5–4）：>1 壓低中低值只留天際線、<1 抬高中低值讓鄉間也看得見
 * @param elevationScale 整體高度（10–400）；實際滿格高度 = ×100 公尺
 *
 * ⚠️ `["^", 負數, 小數]` 會回 NaN → 冪次前必須先 `max 0` 夾住（FLOOR 以下的格會是負值）。
 * ⚠️ 上方**沒有** clamp —— 刻意的，見上方註解。
 * ⚠️ 表達式不得含 ["zoom"]。
 */
export function propertyValueGridHeightExpr(
  scaleIdx: number,
  contrast: number,
  elevationScale: number,
): unknown[] {
  const scale = resolvePropertyValueScale(scaleIdx);
  const lnFloor = Math.log(1 + scale.heightFloorWan);
  const lnSpan = Math.log(1 + scale.heightMaxWan) - lnFloor;
  const norm: unknown[] = [
    "max", 0,
    ["/", ["-", ["ln", ["+", 1, ["to-number", ["get", "v_mkt"], 0]]], lnFloor], lnSpan],
  ];
  return ["*", ["^", norm, contrast], elevationScale * 100];
}

/** 純 JS 版 band 查色（供 featureInfo popup Title 上色，不進 mapbox 表達式） */
export function propertyValueBandColor(bands: GridColorBand[], value: number): string {
  if (!Number.isFinite(value) || value <= 0) return BUILDING_VALUE_NON_MARKET_COLOR;
  for (const band of bands) {
    if (band.max === null || value < band.max) return band.color;
  }
  return bands[bands.length - 1]!.color;
}

// 衍生產物從嚴採 CC BY-NC 4.0（GBA 禁商用），圖例必掛
export const PROPERTY_VALUE_ATTRIBUTION = "© GlobalBuildingAtlas (TUM) · Zhu et al. 2025 · CC BY-NC 4.0 + 內政部實價登錄";

/** popup / 圖例共用的方法近似提醒（上游 handoff §前端接線要點 + 已知限制 2） */
export const PROPERTY_VALUE_APPROX_NOTE =
  "估值 = 建物量體 × 網格實價中位單價（房+地合計），建物高度為 2019 衛星推估 → 保守估計；z13+ 才可逐棟看";
