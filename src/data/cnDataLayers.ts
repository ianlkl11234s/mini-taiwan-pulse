/**
 * 中國第 0–1 波（2026-11-13）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。**9 層全部站主限定**（使用者 2026-11-10），
 * 圖磚只放私人 owner-data（同源 `/api/private-research/owner-data/<asset>`，sidecar 驗站主 JWT 後回 Range），不進公開 CDN、不入倉。
 * - 行政邊界（C001）、人口（C023）：省 31／地級 357（332 地級＋4 直轄市＋21 省直轄縣級），兩層級 select 切換；人口網格（GHS-POP）是已上色 PNG raster。
 * - 交通 3 層、能源 3 層：規格驅動（`CN_DATA_SPECS`＋`useCnDataLayer`），型別與 popup／類別篩選沿用菲律賓（`phDataLayers.ts`）。
 *   瘦身圖磚各 tile layer 最大縮放不同（甲案，analytics FRONTEND_SPEC §3a）：子圖層各自一個 source（`srcMaxzoom`），超過靠 overzoom。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/topic-research/china_opendata/waves/w01/FRONTEND_SPEC.md` 與各 `_manifest.json`（2026-11-13 讀）。
 * 爭議地區依實際管轄：金門、馬祖、澎湖、東沙、太平島、烏坵、大膽二膽屬台灣，台港澳不在任何中國圖層；不畫九段線或任何海域主張線。
 */
import type { CnDataKey } from "./cnDataKeys";
import { CN_PREFECTURE_NAMES } from "./cnPrefectureNames";
import { OWNER_DATA_ENDPOINT } from "./ownerDataAssets";
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhPart, PhSizeBands } from "./phDataLayers";

export type { L3 } from "./krDataLayers";
export { pickL3 } from "./krDataLayers";

type Expr = unknown[];
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));

export const CN_FETCHED_AT = "2026-11-13";

/**
 * 私人 owner-data 檔名（上傳時加進 sidecar `OWNER_DATA_ASSETS` 白名單；未加入前 sidecar 回 404，前端當成未開放、不報錯）。
 * 大小＝瘦身後位元組數（2026-11-13，analytics PR #377）。
 */
export const CN_OWNER_ASSETS = {
  "cn-admin-boundaries": "cn_admin_boundaries.pmtiles",
  "cn-population": "cn_population.pmtiles",
  "cn-population-grid": "cn_population_grid.pmtiles",
  "cn-bus-stops": "cn_bus_stops.pmtiles",
  "cn-power-plants": "cn_power_plants.pmtiles",
  "cn-pipelines": "cn_pipelines.pmtiles",
  "cn-transport-hubs": "cn_transport_hubs.pmtiles",
  "cn-major-roads": "cn_major_roads.pmtiles",
  "cn-power-grid": "cn_power_grid.pmtiles",
} as const;
export type CnOwnerAsset = keyof typeof CN_OWNER_ASSETS;
export const cnOwnerUrl = (asset: CnOwnerAsset) => `${OWNER_DATA_ENDPOINT}/${asset}`;

export const CN_SIMPLIFIED_NOTE = l3("高縮放細節已簡化（圖磚瘦身；完整資料在分析端）", "High-zoom detail simplified (slimmed tiles; full data kept upstream)", "高ズームの詳細は簡略化（タイル軽量化、完全版は分析側）");
export const CN_NO_POSITION_NOTE = l3("邊界依 OCHA 資料，不代表任何立場", "Boundaries follow OCHA data and do not imply any position", "境界は OCHA データによるもので、いかなる立場も示さない");
const SANSHA_NOTE = l3("三沙市（南海島礁）無幾何，不上圖", "Sansha (South China Sea islets) has no geometry and is not drawn", "三沙市（南シナ海の島礁）は形状がなく描画しない");
const JURISDICTION_NOTE = l3("台港澳不在本層；金門、馬祖、澎湖、東沙、太平島依實際管轄屬台灣；不畫任何海域主張線", "Taiwan, Hong Kong and Macao not included; Kinmen, Matsu, Penghu, Pratas and Itu Aba follow actual jurisdiction (Taiwan); no maritime claim lines", "台湾・香港・マカオは含まない。金門・馬祖・澎湖・東沙・太平島は実効支配に従い台湾。海域の主張線は描かない");
const OSM_SPARSE_NOTE = l3("OSM，完整度有限、非官方；河南、貴州、雲南 OSM 稀疏，空白不代表沒有", "OSM, limited completeness, not official; OSM is sparse in Henan, Guizhou and Yunnan, so gaps do not mean absence", "OSM は網羅性が限られ非公式。河南・貴州・雲南は OSM が疎で、空白は「ない」という意味ではない");
const OSM_ATTR = "© OpenStreetMap contributors（ODbL），Geofabrik 2026-11-12 擷取";
const OSM_URL = "https://www.openstreetmap.org/copyright";
const GEM_ATTR = "Global Energy Monitor（CC BY 4.0）；部分光電 © TransitionZero Solar Asset Mapper（CC BY-NC 4.0）";

// ═════════════════════════ 行政邊界、人口（兩層級） ═════════════════════════

/** 兩層級＝PMTiles tile layer 名（select encode 順序）；minzoom／maxzoom＝檔內該層實際縮放範圍（行政界／人口檔各自不同）。 */
export const CN_ADMIN_LEVELS = [
  { value: "province", label: "省級（31）", admin: [2, 10], population: [2, 9] },
  { value: "prefecture", label: "地級（357，含直轄市、省直轄縣級）", admin: [4, 11], population: [4, 10] },
] as const;
export type CnAdminLevel = (typeof CN_ADMIN_LEVELS)[number]["value"];
export const CN_UNIT_TYPE: Record<string, L3> = {
  prefecture: l3("地級", "Prefecture-level", "地級"),
  municipality: l3("直轄市", "Municipality", "直轄市"),
  province_direct_county: l3("省直轄縣級", "Province-administered county-level", "省直轄県級"),
};
export const CN_ADMIN_COLOR = "#9ca3af";
export const CN_ADMIN_SOURCE = {
  org: "OCHA COD-AB China 2020（unofficial），via HDX；代碼：民政部 2024 行政區劃代碼",
  url: "https://data.humdata.org/dataset/cod-ab-chn",
  license: "CC BY-IGO 3.0（幾何）；民政部代碼表未標示授權",
  short: "© OCHA COD-AB China（HDX，CC BY-IGO）",
} as const;
export const CN_ADMIN_NOTES: readonly L3[] = [
  CN_NO_POSITION_NOTE,
  l3("省 31、地級 357（332 地級＋4 直轄市＋21 省直轄縣級）；縣級未涵蓋", "31 provinces, 357 prefecture-level units (332 prefectures + 4 municipalities + 21 province-administered counties); counties not covered", "省 31・地級 357（地級 332＋直轄市 4＋省直轄県級 21）。県級は未収録"),
  SANSHA_NOTE,
  JURISDICTION_NOTE,
];

/** 人口密度（人／km²）6 級斷點（FRONTEND_SPEC §4；地級中位數 272.8）。 */
export const CN_DENSITY_BREAKS = [50, 200, 500, 1000, 3000] as const;
export const CN_DENSITY_LABELS = ["<50", "50–200", "200–500", "500–1,000", "1,000–3,000", "≥3,000"] as const;
export const CN_NOT_COVERED_COLOR = "#6b7280";
/** 面量值欄：省＝2020 普查（官方），地級＝GHS-POP 2025 模型值（地級沒有普查值）。 */
export const CN_DENSITY_FIELD: Record<CnAdminLevel, string> = { province: "census2020_density", prefecture: "ghs2025_density" };
export const CN_POPULATION_SOURCE = {
  org: "国家统计局《中国人口普查年鉴-2020》表 1-1；GHS-POP R2023A E2025 © European Union（JRC）（模型值）",
  url: "https://www.stats.gov.cn/sj/pcsj/rkpc/7rp/zk/html/A0101.xls",
  license: "普查：國家統計局網站服務條款（註明出處）；網格：CC BY 4.0",
  short: "國家統計局 2020 普查；GHS-POP 2025（JRC，CC BY 4.0，模型值）",
} as const;
export const CN_POPULATION_NOTES: readonly L3[] = [
  l3("省級＝2020 年第七次普查密度；地級＝GHS-POP 2025 模型值（GHS 模型推估，非統計）", "Province = 2020 census density; prefecture = GHS-POP 2025 model value (model estimate, not statistics)", "省級＝2020 年国勢調査の密度。地級＝GHS-POP 2025 モデル値（統計ではない）"),
  l3("縣級未涵蓋（普查分縣只有紙本）；三沙市無幾何", "Counties not covered (county census only in print); Sansha has no geometry", "県級は未収録（県別国勢調査は紙のみ）。三沙市は形状なし"),
  JURISDICTION_NOTE,
];

/** 人口網格（GHS-POP 2025，已烤進 PNG，只畫 31 省面內；<1 人／km² 透明）。 */
export const CN_GRID_LEGEND = [
  { min: 1, color: "#fff5eb", label: "1–10" },
  { min: 10, color: "#fdd0a2", label: "10–50" },
  { min: 50, color: "#fdae6b", label: "50–200" },
  { min: 200, color: "#fd8d3c", label: "200–1,000" },
  { min: 1000, color: "#e6550d", label: "1,000–5,000" },
  { min: 5000, color: "#a63603", label: "5,000–20,000" },
  { min: 20000, color: "#7f2704", label: "≥20,000" },
] as const;
export const CN_GRID_SOURCE = {
  org: "GHS-POP R2023A E2025（30 arc-sec）© European Union（JRC）",
  url: "https://human-settlement.emergency.copernicus.eu/download.php?ds=pop",
  license: "CC BY 4.0",
} as const;
export const CN_GRID_NOTES: readonly L3[] = [
  l3("模型值：GHS 依建物推估的人口分布，不是普查；網格約 1 km", "Model values: GHS population estimated from built-up area, not a census; ~1 km grid", "モデル値：建物から推計した人口分布で国勢調査ではない。約 1 km メッシュ"),
  l3("只畫 31 省面內；<1 人／km² 透明", "Drawn only inside the 31 provinces; <1 person/km² transparent", "31 省の範囲内のみ描画。1 人／km² 未満は透明"),
];

// ═════════════════════════ 規格驅動 6 層 ═════════════════════════

/** 子圖層：菲律賓規格＋瘦身圖磚的各層最大縮放（給定＝獨立 source）＋淡化條件。 */
export interface CnPart extends PhPart {
  /** 此 tile layer 的最大縮放（與 spec.srcMaxzoom 不同時，另開一個 source 才不會在高縮放消失） */
  srcMaxzoom?: number;
  /** 符合者透明度減半（例：油氣管線 route_accuracy=low 示意路線） */
  fadeWhen?: Expr;
}
export interface CnLayerSpec extends Omit<PhLayerSpec, "key" | "parts"> {
  key: CnDataKey;
  asset: CnOwnerAsset;
  parts: readonly CnPart[];
  /** 低縮放沒有圖磚時的圖例說明（V-3） */
  minZoomNote?: L3;
}
/** 型別與 popup／篩選函式沿用菲律賓（只讀 cats、parts、title、fields 等欄位，不讀 key 的字面值）。 */
export const asPhSpec = (spec: CnLayerSpec) => spec as unknown as PhLayerSpec;

const constCat = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const PROVINCE_FIELD: PhField = { prop: "province_name", label: l3("省", "Province", "省") };
const PREFECTURE_FIELD: PhField = { prop: "prefecture_name", label: l3("地級", "Prefecture", "地級") };

// ───────────── 公交站（C010） ─────────────
export const CN_BUS_LINES_BANDS: PhSizeBands = {
  prop: "n_lines", title: l3("經過路線數", "Lines serving the stop", "経由路線数"),
  bands: [{ min: 0, radius: 2.5, label: "1" }, { min: 2, radius: 3.5, label: "2–4" }, { min: 5, radius: 5, label: "5–11" }, { min: 12, radius: 7, label: "≥12" }],
};
const PREFECTURE_NAME_MAP: Record<string, L3> = Object.fromEntries(
  Object.entries(CN_PREFECTURE_NAMES).map(([code, [zh, en]]) => [code, l3(zh, en || zh, zh)]),
);

// ───────────── 電廠（C087＋C090） ─────────────
const PLANT_CATS: readonly PhCat[] = [
  { id: "coal", values: ["coal"], color: "#F2622E", label: l3("燃煤", "Coal", "石炭") },
  { id: "gas", values: ["gas"], color: "#F2D64B", label: l3("燃氣", "Gas", "ガス") },
  { id: "oil", values: ["oil"], color: "#A8502A", label: l3("燃油", "Oil", "石油") },
  { id: "nuclear", values: ["nuclear"], color: "#d100ff", label: l3("核能", "Nuclear", "原子力") },
  { id: "hydro", values: ["hydro"], color: "#3C92A6", label: l3("水力", "Hydro", "水力") },
  { id: "bioenergy", values: ["bioenergy"], color: "#8C7C4A", label: l3("生質能", "Bioenergy", "バイオエネルギー") },
  { id: "solar", values: ["solar"], color: "#F2E085", label: l3("太陽光電", "Solar", "太陽光") },
  { id: "wind", values: ["wind"], color: "#2F5A99", label: l3("風力", "Wind", "風力") },
  { id: "geothermal", values: ["geothermal"], color: "#8C5D42", label: l3("地熱", "Geothermal", "地熱") },
];
/** GEM 狀態；預設只開運轉中與興建中（同菲律賓），其餘放篩選。順序＝多選 bitmask。 */
export const CN_PLANT_STATUSES = [
  { id: "operating", label: l3("運轉中", "Operating", "運転中") },
  { id: "construction", label: l3("興建中", "Under construction", "建設中") },
  { id: "planned", label: l3("規劃中", "Planned", "計画中") },
  { id: "shelved", label: l3("擱置", "Shelved", "保留") },
  { id: "mothballed", label: l3("封存", "Mothballed", "休止") },
  { id: "retired", label: l3("退役", "Retired", "廃止") },
  { id: "cancelled", label: l3("取消", "Cancelled", "中止") },
] as const;
export const CN_PLANT_STATUS_DEFAULT = ["operating", "construction"] as const;
export const CN_CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 2.5, label: "<50" }, { min: 50, radius: 4, label: "50–500" }, { min: 500, radius: 6.5, label: "500–2,000" }, { min: 2000, radius: 10, label: "≥2,000" }],
};
/** C090 再生能源＝同一層的子集（`renewable_c090`），不另做一層相加。 */
export const CN_PLANT_SCOPES = [
  { id: "all", label: "全部電廠" },
  { id: "renewable", label: "只看再生能源（C090）" },
] as const;

// ───────────── 機場與港口（C014） ─────────────
const AIRPORT_COLOR = "#f472b6";
const PORT_COLOR = "#38bdf8";
const hubsCat: PhCatGetter = {
  expr: ["case", ["has", "airport_type"], ["to-string", ["get", "airport_type"]], ["to-string", ["coalesce", ["get", "kind"], ""]]],
  js: (p) => (p.airport_type != null ? str(p.airport_type) : str(p.kind)),
};
const HUB_CATS: readonly PhCat[] = [
  { id: "large", values: ["large_airport"], color: AIRPORT_COLOR, radius: 6.5, parts: ["cn-airports-circle"], label: l3("大型機場", "Large airport", "大規模空港") },
  { id: "medium", values: ["medium_airport"], color: AIRPORT_COLOR, radius: 5, parts: ["cn-airports-circle"], label: l3("中型機場", "Medium airport", "中規模空港") },
  { id: "small", values: ["small_airport"], color: AIRPORT_COLOR, radius: 3.5, parts: ["cn-airports-circle"], label: l3("小型機場", "Small airport", "小規模空港") },
  { id: "heliport", values: ["heliport", "seaplane_base", "balloonport"], color: "#c084fc", radius: 3, parts: ["cn-airports-circle"], label: l3("直升機場（含水上機場、熱氣球場）", "Heliport (incl. seaplane base, balloonport)", "ヘリポート（水上飛行場・気球場を含む）") },
  { id: "port", values: ["port"], color: PORT_COLOR, radius: 4.5, parts: ["cn-ports-circle"], label: l3("港區（OSM）", "Port area (OSM)", "港湾区域（OSM）") },
  { id: "harbour", values: ["harbour"], color: "#bae6fd", radius: 3, parts: ["cn-ports-circle"], label: l3("港灣（OSM，含漁港、遊艇港）", "Harbour (OSM, incl. fishing and marinas)", "港（OSM、漁港・マリーナを含む）") },
];

// ───────────── 主要道路與鐵道（C013） ─────────────
const ROAD_CATS: readonly PhCat[] = [
  { id: "motorway", values: ["motorway"], color: "#ef4444", parts: ["cn-major-roads-line"], label: l3("高速公路（motorway）", "Motorway", "高速道路（motorway）") },
  { id: "trunk", values: ["trunk"], color: "#f59e0b", parts: ["cn-major-roads-line"], label: l3("國道級幹道（trunk）", "Trunk road", "幹線道路（trunk）") },
  { id: "high_speed_rail", values: ["high_speed_rail"], color: "#f472b6", parts: ["cn-major-rail-line"], label: l3("高鐵", "High-speed rail", "高速鉄道") },
  { id: "rail", values: ["rail"], color: "#a78bfa", parts: ["cn-major-rail-line"], label: l3("鐵路", "Railway", "鉄道") },
  { id: "subway", values: ["subway"], color: "#22d3ee", parts: ["cn-major-rail-line"], label: l3("地鐵", "Subway", "地下鉄") },
  { id: "light_rail", values: ["light_rail"], color: "#4ade80", parts: ["cn-major-rail-line"], label: l3("輕軌", "Light rail", "ライトレール") },
  { id: "narrow_gauge", values: ["narrow_gauge"], color: "#a8a29e", parts: ["cn-major-rail-line"], label: l3("窄軌", "Narrow gauge", "狭軌") },
];

// ───────────── 電網（C088） ─────────────
const KV_CATS: readonly PhCat[] = [
  { id: "kv1000", values: ["≥1000 kV（特高壓）"], color: "#f472b6", label: l3("≥1000 kV（特高壓）", "≥1000 kV (UHV)", "≥1000 kV（特別高圧）") },
  { id: "kv500", values: ["500–999 kV"], color: "#1AB6D9", label: l3("500–999 kV", "500–999 kV", "500–999 kV") },
  { id: "kv330", values: ["330–499 kV"], color: "#62D9AD", label: l3("330–499 kV", "330–499 kV", "330–499 kV") },
  { id: "kv220", values: ["220–329 kV"], color: "#c084fc", label: l3("220–329 kV", "220–329 kV", "220–329 kV") },
  { id: "kv110", values: ["110–219 kV"], color: "#468BA6", label: l3("110–219 kV", "110–219 kV", "110–219 kV") },
  { id: "kvlt110", values: ["<110 kV"], color: "#7c8a99", label: l3("<110 kV", "<110 kV", "<110 kV") },
  { id: "unknown", values: ["unknown"], color: "#DFE0DC", label: l3("電壓未知", "Voltage unknown", "電圧不明") },
];
const KV_WIDTH: Record<string, readonly [number, number]> = {
  "≥1000 kV（特高壓）": [2.5, 4], "500–999 kV": [2, 3.5], "330–499 kV": [1.5, 2.8], "220–329 kV": [1.2, 2.2], "110–219 kV": [0.8, 1.5], "<110 kV": [0.5, 1], unknown: [0.5, 1],
};

// ───────────── 油氣管線與 LNG 接收站（C092） ─────────────
const pipeCat: PhCatGetter = {
  expr: ["case", ["has", "fuel_kind"], ["to-string", ["get", "fuel_kind"]], ["concat", "lng:", ["to-string", ["coalesce", ["get", "status"], ""]]]],
  js: (p) => (p.fuel_kind != null ? str(p.fuel_kind) : `lng:${str(p.status)}`),
};
const PIPE_LINE_PARTS = ["cn-pipelines-line", "cn-pipelines-planned-line"];
const PIPE_CATS: readonly PhCat[] = [
  { id: "gas", values: ["gas"], color: "#f59e0b", parts: PIPE_LINE_PARTS, label: l3("天然氣管線", "Gas pipeline", "天然ガスパイプライン") },
  { id: "oil", values: ["oil"], color: "#a16207", parts: PIPE_LINE_PARTS, label: l3("石油管線", "Oil pipeline", "石油パイプライン") },
  { id: "ngl", values: ["ngl", "oil_ngl"], color: "#ef4444", parts: PIPE_LINE_PARTS, label: l3("天然氣凝液（NGL）管線", "Natural gas liquids (NGL) pipeline", "天然ガス液（NGL）パイプライン") },
  { id: "lng_operating", values: ["lng:operating"], color: "#22d3ee", parts: ["cn-lng-terminals-circle"], label: l3("LNG 接收站：運轉中", "LNG terminal: operating", "LNG 基地：運転中") },
  { id: "lng_construction", values: ["lng:construction"], color: "#a5f3fc", parts: ["cn-lng-terminals-circle"], label: l3("LNG 接收站：興建中", "LNG terminal: under construction", "LNG 基地：建設中") },
  { id: "lng_proposed", values: ["lng:proposed"], color: "#818cf8", parts: ["cn-lng-terminals-circle"], label: l3("LNG 接收站：規劃中", "LNG terminal: proposed", "LNG 基地：計画中") },
  { id: "lng_other", values: ["lng:shelved", "lng:cancelled", "lng:retired"], color: "#94a3b8", parts: ["cn-lng-terminals-circle"], label: l3("LNG 接收站：擱置、取消、退役", "LNG terminal: shelved, cancelled, retired", "LNG 基地：保留・中止・廃止") },
];
const GEM_STATUS_MAP: Record<string, L3> = {
  operating: l3("運轉中", "Operating", "運転中"), construction: l3("興建中", "Under construction", "建設中"),
  proposed: l3("規劃中", "Proposed", "計画中"), planned: l3("規劃中", "Planned", "計画中"), shelved: l3("擱置", "Shelved", "保留"),
  mothballed: l3("封存", "Mothballed", "休止"), cancelled: l3("取消", "Cancelled", "中止"), retired: l3("退役", "Retired", "廃止"),
  "mixed status": l3("狀態混合", "Mixed status", "状態混在"),
};
const LOCATION_ACCURACY_MAP: Record<string, L3> = { exact: l3("精確", "Exact", "正確"), approximate: l3("概略位置", "Approximate", "概略位置") };

export const CN_DATA_SPECS: readonly CnLayerSpec[] = [
  {
    key: "cnBusStops", asset: "cn-bus-stops", file: CN_OWNER_ASSETS["cn-bus-stops"], sourceId: "cn-bus-stops", srcMinzoom: 6, srcMaxzoom: 11, color: "#38bdf8", count: 859_061,
    parts: [{ id: "cn-bus-stops-circle", sourceLayer: "bus_stops", geom: "point", minzoom: 6, cat: constCat("bus"), size: CN_BUS_LINES_BANDS }],
    cats: [{ id: "bus", values: ["bus"], color: "#38bdf8", label: l3("公交站", "Bus stop", "バス停") }],
    sizeLegend: [CN_BUS_LINES_BANDS],
    heat: { intensity: 0.4 },
    minZoomNote: l3("z6 起顯示（拉遠沒有圖磚）；z12 前為熱區", "Shown from z6 (no tiles when zoomed out); heatmap below z12", "z6 から表示（縮小時はタイルなし）。z12 未満はヒートマップ"),
    title: { props: [], fallback: l3("公交站", "Bus stop", "バス停") },
    fields: [
      { prop: "n_lines", label: l3("經過路線數", "Lines serving the stop", "経由路線数"), kind: "num" },
      { prop: "prefecture_code", label: l3("所屬地級", "Prefecture", "所属地級"), map: PREFECTURE_NAME_MAP },
    ],
    legendNotes: [
      l3("2024 年 299 個城市 859,061 站（Wang et al. 2024，上游高德、百度地圖 API）；31/31 省、地級 291/333", "859,061 stops in 299 cities, 2024 (Wang et al. 2024, from Amap/Baidu APIs); 31/31 provinces, 291/333 prefectures", "2024 年・299 都市の 859,061 停留所（Wang et al. 2024、高徳・百度 API 由来）。31/31 省、地級 291/333"),
      l3("自治州、盟、地區（來源只收「市」）與部分城市未涵蓋，空白不是沒有公車", "Autonomous prefectures, leagues and prefectures (the source only covers cities) and some cities are not covered; gaps do not mean no buses", "自治州・盟・地区（出典は「市」のみ）と一部都市は未収録。空白はバスがないという意味ではない"),
      CN_SIMPLIFIED_NOTE,
    ],
    popupNotes: [{ text: l3("站名不在瘦身圖磚（英文機器翻譯，完整資料在分析端）", "Stop name not in slimmed tiles (machine-translated; full data kept upstream)", "停留所名は軽量タイルに含まない（機械翻訳、完全版は分析側）") }],
    sourceOrg: "Wang et al. (2024), A Comprehensive Vector Dataset of Bus Networks Across China for the Year 2024, figshare（上游高德、百度地圖 API）",
    sourceUrl: "https://doi.org/10.6084/m9.figshare.28323971", license: "CC BY 4.0（上游地圖 API 條款未另行審視）", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國公交站載入中", "Loading China bus stops", "中国のバス停を読み込み中"),
  },
  {
    key: "cnTransportHubs", asset: "cn-transport-hubs", file: CN_OWNER_ASSETS["cn-transport-hubs"], sourceId: "cn-transport-hubs", srcMinzoom: 3, srcMaxzoom: 13, color: AIRPORT_COLOR, count: 1474,
    parts: [
      { id: "cn-ports-circle", sourceLayer: "ports", geom: "point", minzoom: 3, cat: hubsCat },
      { id: "cn-airports-circle", sourceLayer: "airports", geom: "point", minzoom: 3, cat: hubsCat,
        ring: { when: ["==", ["get", "scheduled_service"], true], js: (p) => p.scheduled_service === true || str(p.scheduled_service) === "true", label: l3("白框：有定期航班（264 座）", "White ring: scheduled service (264)", "白枠：定期便あり（264 か所）") } },
    ],
    cats: HUB_CATS,
    title: { props: ["name_alt", "name"], fallback: l3("機場、港口", "Airport / port", "空港・港"),
      fallbackBy: { prop: "kind", map: { airport: l3("未命名機場", "Unnamed airport", "名称不明の空港"), port: l3("未命名港區", "Unnamed port", "名称不明の港湾区域"), harbour: l3("未命名港灣", "Unnamed harbour", "名称不明の港") } } },
    fields: [
      { prop: "name", label: l3("名稱（來源）", "Name (source)", "名称（出典）") },
      { prop: "airport_type", label: l3("機場類型", "Airport type", "空港の種別"), map: Object.fromEntries(HUB_CATS.filter((c) => c.parts?.includes("cn-airports-circle")).flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "iata", label: l3("IATA", "IATA", "IATA"), kind: "code" },
      { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
      { prop: "scheduled_service", label: l3("定期航班", "Scheduled service", "定期便"), map: { true: l3("有", "Yes", "あり"), false: l3("無", "No", "なし") } },
      { prop: "municipality", label: l3("所在城市（OurAirports）", "Municipality (OurAirports)", "所在都市（OurAirports）") },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { airport: l3("機場", "Airport", "空港"), port: l3("港區", "Port area", "港湾区域"), harbour: l3("港灣", "Harbour", "港") } },
      { prop: "osm_tags", label: l3("OSM 標籤", "OSM tags", "OSM タグ"), kind: "code" },
      { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 1 },
      PROVINCE_FIELD, PREFECTURE_FIELD,
    ],
    legendNotes: [
      l3("機場 709（OurAirports）、港口 765（OSM：港區 331、港灣 434）", "709 airports (OurAirports), 765 ports (OSM: 331 port areas, 434 harbours)", "空港 709（OurAirports）、港 765（OSM：港湾区域 331・港 434）"),
      l3("內蒙古、青海、寧夏為內陸無港口；南沙島礁 9 個機場與直升機坪不上圖", "Inner Mongolia, Qinghai and Ningxia are landlocked (no ports); 9 airfields and helipads on Spratly reefs not drawn", "内モンゴル・青海・寧夏は内陸で港なし。南沙の島礁にある 9 か所の飛行場・ヘリポートは描画しない"),
      OSM_SPARSE_NOTE,
    ],
    popupNotes: [],
    sourceOrg: `OurAirports（機場，Public Domain）；港口 ${OSM_ATTR}`,
    sourceUrl: "https://ourairports.com/data/", license: "Public Domain（機場）、ODbL 1.0（港口）", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國機場港口載入中", "Loading China airports and ports", "中国の空港・港を読み込み中"),
  },
  {
    key: "cnMajorRoads", asset: "cn-major-roads", file: CN_OWNER_ASSETS["cn-major-roads"], sourceId: "cn-major-roads", srcMinzoom: 3, srcMaxzoom: 10, color: "#f59e0b", count: 954_060,
    parts: [
      { id: "cn-major-rail-line", sourceLayer: "rail", geom: "line", minzoom: 3, cat: propGetter("kind"),
        lineWidth: { high_speed_rail: [1.5, 2.5], rail: [1, 2], subway: [1, 2], light_rail: [0.8, 1.5], narrow_gauge: [0.5, 1] } },
      { id: "cn-major-roads-line", sourceLayer: "roads", geom: "line", minzoom: 4, cat: propGetter("kind"), lineWidth: { motorway: [1.5, 3], trunk: [1, 2] } },
    ],
    cats: ROAD_CATS,
    title: { props: ["name", "ref"], fallback: l3("道路、鐵路", "Road / railway", "道路・鉄道") },
    fields: [
      { prop: "kind", label: l3("類型（OSM）", "Type (OSM)", "種別（OSM）"), map: Object.fromEntries(ROAD_CATS.map((c) => [c.id, c.label])) },
      { prop: "ref", label: l3("路線編號（G／S）", "Route number (G/S)", "路線番号（G／S）"), kind: "code" },
      { prop: "usage", label: l3("鐵路用途（OSM 原文）", "Rail usage (OSM tag)", "鉄道の用途（OSM 原文）"), kind: "code" },
    ],
    legendNotes: [
      l3("道路 697,980 段（motorway、trunk）、鐵路 256,080 段；OSM，非官方里程", "697,980 road segments (motorway, trunk), 256,080 railway segments; OSM, not official mileage", "道路 697,980 区間（motorway・trunk）、鉄道 256,080 区間。OSM、公式延長ではない"),
      OSM_SPARSE_NOTE,
      CN_SIMPLIFIED_NOTE,
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國主要道路與鐵路載入中", "Loading China major roads and railways", "中国の主要道路・鉄道を読み込み中"),
  },
  {
    key: "cnPowerPlants", asset: "cn-power-plants", file: CN_OWNER_ASSETS["cn-power-plants"], sourceId: "cn-power-plants", srcMinzoom: 3, srcMaxzoom: 9, color: "#F2622E", count: 31_700,
    parts: [{ id: "cn-power-plants-circle", sourceLayer: "plants", geom: "point", minzoom: 3, cat: propGetter("tech"), size: CN_CAPACITY_BANDS,
      ring: { when: ["==", ["get", "offshore"], true], js: (p) => p.offshore === true || str(p.offshore) === "true", label: l3("白框：離岸風電", "White ring: offshore wind", "白枠：洋上風力") } }],
    cats: PLANT_CATS,
    sizeLegend: [CN_CAPACITY_BANDS],
    title: { props: ["name"], fallback: l3("電廠", "Power plant", "発電所") },
    fields: [
      { prop: "tech", label: l3("技術", "Technology", "技術"), map: Object.fromEntries(PLANT_CATS.map((c) => [c.id, c.label])) },
      { prop: "fuel", label: l3("燃料／型式（GEM 原文）", "Fuel / type (GEM)", "燃料・形式（GEM 原文）"), kind: "code" },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: GEM_STATUS_MAP },
      { prop: "capacity_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "capacity_operating_mw", label: l3("運轉中容量", "Operating capacity", "運転中の容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "units", label: l3("機組數", "Units", "ユニット数"), kind: "num" },
      { prop: "start_year", label: l3("啟用年", "Start year", "運転開始年"), kind: "year" },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度"), map: LOCATION_ACCURACY_MAP },
      { prop: "renewable_c090", label: l3("再生能源（C090）", "Renewable (C090)", "再生可能エネルギー（C090）"), map: { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ") } },
      { prop: "license", label: l3("授權（逐筆）", "Licence (per record)", "ライセンス（レコード別）") },
    ],
    legendNotes: [
      l3("GEM 31,700 座（運轉中：太陽能 13,052、風電 5,581、煤 1,217、生質 1,078、水力 1,006、燃氣 240、燃油 105、核能 17、地熱 1）；預設只顯示運轉中與興建中", "31,700 GEM plants (operating: solar 13,052, wind 5,581, coal 1,217, bioenergy 1,078, hydro 1,006, gas 240, oil 105, nuclear 17, geothermal 1); operating and under construction shown by default", "GEM 31,700 か所（運転中：太陽光 13,052・風力 5,581・石炭 1,217・バイオ 1,078・水力 1,006・ガス 240・石油 105・原子力 17・地熱 1）。既定は運転中と建設中のみ"),
      l3("再生能源（C090）是同一層的子集，用「範圍」切換，不另成一層", "Renewables (C090) are a subset of this layer, switched with 'scope', not a separate layer", "再生可能エネルギー（C090）はこの層の部分集合で「範囲」で切り替える"),
      l3("63 筆 TransitionZero 光電為 CC BY-NC 4.0（非商用），彈窗逐筆標示；約 77% 位置為概略", "63 TransitionZero solar records are CC BY-NC 4.0 (non-commercial), shown per record; about 77% of locations are approximate", "TransitionZero の太陽光 63 件は CC BY-NC 4.0（非商用）でレコードごとに表示。位置の約 77% は概略"),
      CN_SIMPLIFIED_NOTE,
    ],
    popupNotes: [
      { text: l3("本筆為 TransitionZero 資料，CC BY-NC，非商用", "This record is TransitionZero data, CC BY-NC, non-commercial", "このレコードは TransitionZero のデータで CC BY-NC（非商用）"), when: (p) => p.commercial_ok === false || str(p.commercial_ok) === "false" },
      { text: l3("概略位置，可能偏離實際廠址", "Approximate location; may differ from the actual site", "概略位置で実際の所在地とずれることがある"), when: (p: Record<string, unknown>) => str(p.location_accuracy) === "approximate" } satisfies PhNote,
    ],
    sourceOrg: GEM_ATTR, sourceUrl: "https://globalenergymonitor.org/projects/", license: "CC BY 4.0（GEM）；63 筆 CC BY-NC 4.0（非商用）", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國電廠載入中", "Loading China power plants", "中国の発電所を読み込み中"),
  },
  {
    key: "cnPowerGrid", asset: "cn-power-grid", file: CN_OWNER_ASSETS["cn-power-grid"], sourceId: "cn-power-grid", srcMinzoom: 3, srcMaxzoom: 10, color: "#1AB6D9", count: 255_713,
    parts: [
      { id: "cn-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 3, cat: propGetter("kv_class"), lineWidth: KV_WIDTH },
      { id: "cn-power-substations-circle", sourceLayer: "substations", geom: "point", minzoom: 6, srcMaxzoom: 11, cat: propGetter("kv_class") },
    ],
    cats: KV_CATS,
    minZoomNote: l3("變電所 z6 起顯示", "Substations shown from z6", "変電所は z6 から表示"),
    title: { props: ["name"], fallback: l3("電力設施", "Power facility", "電力設備") },
    fields: [
      { prop: "kv_class", label: l3("電壓等級", "Voltage class", "電圧区分"), map: Object.fromEntries(KV_CATS.flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "voltage_kv", label: l3("電壓", "Voltage", "電圧"), kind: "num", unit: "kV", digits: 1 },
      { prop: "substation", label: l3("變電所用途（OSM 原文）", "Substation role (OSM tag)", "変電所の用途（OSM 原文）"), kind: "code" },
      { prop: "operator", label: l3("營運者（變電所）", "Operator (substation)", "事業者（変電所）") },
    ],
    legendNotes: [
      l3("OSM，完整度有限、非官方（國家電網、南方電網不公開名冊）", "OSM, limited completeness, not official (State Grid and China Southern Grid publish no registers)", "OSM は網羅性が限られ非公式（国家電網・南方電網は名簿を公開しない）"),
      l3("輸電線 216,960 段、變電所 38,753 處；電壓未知：線約 29%、變電所約 51%", "216,960 line segments, 38,753 substations; voltage unknown for about 29% of lines and 51% of substations", "送電線 216,960 区間・変電所 38,753 か所。電圧不明は線の約 29%・変電所の約 51%"),
      l3("河南、貴州、雲南 OSM 稀疏，空白不代表沒有", "OSM is sparse in Henan, Guizhou and Yunnan; gaps do not mean absence", "河南・貴州・雲南は OSM が疎で、空白は「ない」という意味ではない"),
      CN_SIMPLIFIED_NOTE,
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國電網載入中", "Loading China power grid", "中国の電力網を読み込み中"),
  },
  {
    key: "cnPipelines", asset: "cn-pipelines", file: CN_OWNER_ASSETS["cn-pipelines"], sourceId: "cn-pipelines", srcMinzoom: 3, srcMaxzoom: 10, color: "#f59e0b", count: 1276,
    parts: [
      { id: "cn-pipelines-line", sourceLayer: "pipelines", geom: "line", minzoom: 3, cat: pipeCat, filter: ["==", ["get", "status"], "operating"],
        fadeWhen: ["==", ["get", "route_accuracy"], "low"] },
      { id: "cn-pipelines-planned-line", sourceLayer: "pipelines", geom: "line", minzoom: 3, cat: pipeCat, filter: ["!=", ["get", "status"], "operating"], dashed: true,
        fadeWhen: ["==", ["get", "route_accuracy"], "low"] },
      { id: "cn-lng-terminals-circle", sourceLayer: "lng_terminals", geom: "point", minzoom: 3, cat: pipeCat },
    ],
    cats: PIPE_CATS,
    title: { props: ["name"], fallback: l3("油氣設施", "Oil & gas facility", "石油・ガス施設") },
    fields: [
      { prop: "segment", label: l3("段", "Segment", "区間") },
      { prop: "unit", label: l3("接收站單元", "Terminal unit", "基地ユニット") },
      { prop: "fuel_kind", label: l3("輸送物", "Fuel", "輸送物"), map: { gas: l3("天然氣", "Gas", "天然ガス"), oil: l3("石油", "Oil", "石油"), ngl: l3("NGL", "NGL", "NGL"), oil_ngl: l3("石油＋NGL", "Oil + NGL", "石油＋NGL") } },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: GEM_STATUS_MAP },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "capacity", label: l3("運量", "Capacity", "輸送量"), kind: "code" },
      { prop: "capacity_units", label: l3("運量單位", "Capacity unit", "輸送量の単位"), kind: "code" },
      { prop: "capacity_mtpa", label: l3("接收量", "Capacity", "受入量"), kind: "num", unit: "Mtpa", digits: 2 },
      { prop: "length_km", label: l3("長度", "Length", "延長"), kind: "num", unit: "km", digits: 0 },
      { prop: "route_accuracy", label: l3("路線精度", "Route accuracy", "ルート精度"), map: { high: l3("高", "High", "高"), medium: l3("中", "Medium", "中"), low: l3("低（示意路線）", "Low (schematic route)", "低（模式的なルート）"), "no route": l3("無路線", "No route", "ルートなし") } },
      { prop: "cross_border", label: l3("跨境", "Cross-border", "国境を越える"), map: { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ") } },
      { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度"), map: LOCATION_ACCURACY_MAP },
    ],
    legendNotes: [
      l3("管線 1,124 條（GEM GGIT）；實線＝運轉中，虛線＝興建、規劃、擱置等；淡色＝路線精度低（示意路線）", "1,124 pipelines (GEM GGIT); solid = operating, dashed = construction, proposed, shelved, etc.; faded = low route accuracy (schematic)", "パイプライン 1,124 本（GEM GGIT）。実線＝運転中、破線＝建設中・計画中・保留など。淡色＝ルート精度が低い（模式的）"),
      l3("LNG 接收站 152 處，分布 14/31 省", "152 LNG terminals in 14 of 31 provinces", "LNG 基地 152 か所（31 省中 14 省）"),
      l3("跨境管線全線照畫；省份歸屬見分析端", "Cross-border pipelines drawn in full; province attribution kept upstream", "国境を越えるパイプラインは全線を描画。省の帰属は分析側"),
    ],
    popupNotes: [{ text: l3("示意路線：GEM 路線精度低，只表示起訖與大致走向", "Schematic route: GEM route accuracy is low; shows only endpoints and rough path", "模式的ルート：GEM のルート精度が低く、起終点と大まかな経路のみ"), when: (p) => str(p.route_accuracy) === "low" }],
    sourceOrg: "Global Energy Monitor（Global Gas Infrastructure Tracker、Global Oil Infrastructure Tracker）",
    sourceUrl: "https://globalenergymonitor.org/projects/", license: "CC BY 4.0", fetchedAt: CN_FETCHED_AT,
    loading: l3("中國油氣管線載入中", "Loading China oil and gas pipelines", "中国の石油・ガスパイプラインを読み込み中"),
  },
];

export const CN_SPEC_BY_KEY: Readonly<Record<CnDataKey, CnLayerSpec>> = Object.fromEntries(CN_DATA_SPECS.map((s) => [s.key, s])) as Record<CnDataKey, CnLayerSpec>;

/** 類別多選選項（zh 標籤；layerParamsSpec 用）。中國層沒有「其他」選項。 */
export const cnCatOptions = (spec: CnLayerSpec): { value: string; label: string }[] => spec.cats.map((c) => ({ value: c.id, label: c.label.zh }));
