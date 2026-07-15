/**
 * 都市紋理網格（全台 500m 網格，PMTiles source-layer `urban_form`，145,119 格）
 * 六指標染色的單一真實來源。分級依 taipei-gis-analytics
 * `urban_form_grid_stats.json` 的 p75/p95/max 分位數人類友善取整，非線性均分
 * （資料重度偏綠：gg_index median=81.4、canopy_pct median=81.8）。
 *
 * 給 overlayRegistry 配色（fill-color/fill-opacity 表達式）、LegendPanel 圖例、
 * featureInfo popup Title 三處共用（同 buildingsGbaTypes.ts 慣例）。
 *
 * `bld_count`/`avg_height`/`total_vol`/`built_pct` 四個「建物衍生」欄位共用同一組
 * cell（=0 代表格內無建物，純綠地/森林，見上游 handoff）；這類 cell 佔多數
 * （四欄 median 皆為 0），若照常上色會把整島染成單一淡色蓋掉底圖，故用
 * `zeroFade: true` 對這四個模式的 0 值格做 opacity 淡出（見 zeroFadeOpacityExpr）。
 * `canopy_pct`/`gg_index` 兩欄分佈本就廣泛非零，`zeroFade: false` 正常上色。
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（見 streetTreeColors.ts 註）。
 */

export interface GridColorBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

export type UrbanFormGridField =
  | "bld_count"
  | "avg_height"
  | "total_vol"
  | "built_pct"
  | "canopy_pct"
  | "gg_index";

export interface UrbanFormGridMode {
  /** select value；index 對齊 overlayRegistry 讀的 urbanFormGridModeIdx */
  value: string;
  label: string;
  field: UrbanFormGridField;
  bands: GridColorBand[];
  /** true → 該欄位 =0（無建物）的格用 opacity 淡出，避免蓋掉底圖 */
  zeroFade: boolean;
}

// 棟數密度：0（無建物）淡出；非零 5 級 sequential OrRd（ColorBrewer 5-class）
// 依 p75=9/p95=55/max=1219 取整：1–10/10–50/50–150/150–400/>400
export const BLD_COUNT_BANDS: GridColorBand[] = [
  { max: 10,   color: "#fef0d9", label: "1–10 棟" },
  { max: 50,   color: "#fdcc8a", label: "10–50 棟" },
  { max: 150,  color: "#fc8d59", label: "50–150 棟" },
  { max: 400,  color: "#e34a33", label: "150–400 棟" },
  { max: null, color: "#b30000", label: "> 400 棟" },
];

// 平均高度：0（無建物）淡出；非零 6 級，沿用建物層 RdYlBu 反轉色感（同 buildingsGbaTypes
// 的 BUILDING_HEIGHT_BANDS 配色，但斷點依網格平均值域重切，遠低於單棟建物）
export const AVG_HEIGHT_BANDS: GridColorBand[] = [
  { max: 3,    color: "#4575b4", label: "< 3 m" },
  { max: 5,    color: "#91bfdb", label: "3–5 m" },
  { max: 7,    color: "#e0f3f8", label: "5–7 m" },
  { max: 12,   color: "#fee090", label: "7–12 m" },
  { max: 20,   color: "#fc8d59", label: "12–20 m" },
  { max: null, color: "#d73027", label: "> 20 m" },
];

// 總量體（萬 m³）：0（無建物）淡出；非零 5 級 sequential PuRd（ColorBrewer 5-class）
// 依 p75=1.5/p95=32.6/max=1619 取整：<1/1–10/10–50/50–200/>200
export const TOTAL_VOL_BANDS: GridColorBand[] = [
  { max: 1,    color: "#f1eef6", label: "< 1 萬m³" },
  { max: 10,   color: "#d4b9da", label: "1–10 萬m³" },
  { max: 50,   color: "#c994c7", label: "10–50 萬m³" },
  { max: 200,  color: "#df65b0", label: "50–200 萬m³" },
  { max: null, color: "#980043", label: "> 200 萬m³" },
];

// 建蔽率：0（無建物）淡出；非零 6 級 sequential YlOrBr 灰褐系（ColorBrewer 6-class）
// 依 p75=1.3/p95=15.3/max=100 取整：<1/1–5/5–15/15–30/30–50/>50%
export const BUILT_PCT_BANDS: GridColorBand[] = [
  { max: 1,    color: "#ffffd4", label: "< 1%" },
  { max: 5,    color: "#fee391", label: "1–5%" },
  { max: 15,   color: "#fec44f", label: "5–15%" },
  { max: 30,   color: "#fe9929", label: "15–30%" },
  { max: 50,   color: "#d95f0e", label: "30–50%" },
  { max: null, color: "#993404", label: "> 50%" },
];

// 樹冠覆蓋：無 0 淡出（分佈廣泛非零，僅少數 cell 真為 0）；6 級 sequential Greens
// （ColorBrewer 6-class，色感與 canopyHeight raster 一致）
export const CANOPY_PCT_BANDS: GridColorBand[] = [
  { max: 10,   color: "#edf8e9", label: "< 10%" },
  { max: 30,   color: "#c7e9c0", label: "10–30%" },
  { max: 60,   color: "#a1d99b", label: "30–60%" },
  { max: 85,   color: "#74c476", label: "60–85%" },
  { max: 95,   color: "#31a354", label: "85–95%" },
  { max: null, color: "#006d2c", label: "> 95%" },
];

// 灰綠指數（canopy_pct − built_pct）：diverging BrBG（ColorBrewer 6-class），以 0 為中心，
// 褐＝灰主導、綠＝綠主導；無 0 淡出（0 是有意義的中點，落在「均衡」級）
export const GG_INDEX_BANDS: GridColorBand[] = [
  { max: -40,  color: "#8c510a", label: "< −40（灰主導）" },
  { max: -10,  color: "#d8b365", label: "−40 ~ −10" },
  { max: 10,   color: "#f6e8c3", label: "−10 ~ +10（均衡）" },
  { max: 50,   color: "#c7eae5", label: "+10 ~ +50" },
  { max: 90,   color: "#5ab4ac", label: "+50 ~ +90" },
  { max: null, color: "#01665e", label: "> +90（綠主導）" },
];

/** 顯示模式 select 選項；index 對齊 overlayRegistry 讀的 urbanFormGridModeIdx。預設 5=灰綠指數。 */
export const URBAN_FORM_GRID_MODES: UrbanFormGridMode[] = [
  { value: "0", label: "棟數密度", field: "bld_count",  bands: BLD_COUNT_BANDS,  zeroFade: true },
  { value: "1", label: "平均高度", field: "avg_height",  bands: AVG_HEIGHT_BANDS, zeroFade: true },
  { value: "2", label: "總量體",   field: "total_vol",   bands: TOTAL_VOL_BANDS,  zeroFade: true },
  { value: "3", label: "建蔽率",   field: "built_pct",   bands: BUILT_PCT_BANDS,  zeroFade: true },
  { value: "4", label: "樹冠覆蓋", field: "canopy_pct",  bands: CANOPY_PCT_BANDS, zeroFade: false },
  { value: "5", label: "灰綠指數", field: "gg_index",    bands: GG_INDEX_BANDS,   zeroFade: false },
];

function resolveMode(modeIdx: number): UrbanFormGridMode {
  return URBAN_FORM_GRID_MODES[modeIdx] ?? URBAN_FORM_GRID_MODES[URBAN_FORM_GRID_MODES.length - 1]!;
}

/** 依 bands 產生 step 染色表達式（step 邊界即 band.max，第一級用 bands[0].color 打底） */
function gridStepColorExpr(field: UrbanFormGridField, bands: GridColorBand[]): unknown[] {
  const val: unknown[] = ["to-number", ["get", field], 0];
  const step: unknown[] = ["step", val, bands[0]!.color];
  for (let i = 1; i < bands.length; i++) {
    step.push(bands[i - 1]!.max as number, bands[i]!.color);
  }
  return step;
}

/** 依當前顯示模式產生 fill-color 表達式 */
export function urbanFormGridColorExpr(modeIdx: number): unknown[] {
  const mode = resolveMode(modeIdx);
  return gridStepColorExpr(mode.field, mode.bands);
}

/** 依當前顯示模式產生 fill-opacity（zeroFade 模式：欄位 =0 的格淡出，避免蓋掉底圖） */
export function urbanFormGridOpacityExpr(modeIdx: number, baseOpacity: number): unknown[] | number {
  const mode = resolveMode(modeIdx);
  if (!mode.zeroFade) return baseOpacity;
  return ["case", ["==", ["to-number", ["get", mode.field], 0], 0], 0.04, baseOpacity];
}

/** 純 JS 版 band 查色（供 featureInfo popup Title 上色，不進 mapbox 表達式） */
export function gridBandColor(bands: GridColorBand[], value: number): string {
  if (!Number.isFinite(value)) return bands[0]!.color;
  for (const band of bands) {
    if (band.max === null || value < band.max) return band.color;
  }
  return bands[bands.length - 1]!.color;
}

// 衍生產物從嚴採 CC BY-NC 4.0（禁商用），兩份上游資產署名皆須保留（圖例必掛）
export const URBAN_FORM_GRID_ATTRIBUTION_GBA = "© GlobalBuildingAtlas (TUM) · Zhu et al. 2025 · CC BY-NC 4.0";
export const URBAN_FORM_GRID_ATTRIBUTION_META = "© Meta & WRI · Tolan et al. 2024 · CC-BY 4.0";

// popup 近似假設提醒（見上游 handoff §6：centroid 歸屬 + 樹冠 5×5 粗塊窗近似）
export const URBAN_FORM_GRID_APPROX_NOTE = "500m 網格統計，建物 centroid 歸屬 + 樹冠 ≥3m 閾值之近似值";
