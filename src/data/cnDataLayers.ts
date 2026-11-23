/**
 * 中國第 0–1 波（2026-11-13）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。**9 層全部站主限定**（使用者 2026-11-10），
 * 圖磚只放私人 owner-data（同源 Range API，sidecar 驗站主 JWT 後回 Range；網址組在 hooks/useCnLayers.ts），不進公開 CDN、不入倉。
 * - 行政邊界（C001）、人口（C023）：省 31／地級 357（332 地級＋4 直轄市＋21 省直轄縣級），兩層級 select 切換；人口網格（GHS-POP）是已上色 PNG raster。
 * - 交通 3 層、能源 3 層：規格驅動（`CN_DATA_SPECS`＋`useCnDataLayer`），型別與 popup／類別篩選沿用菲律賓（`phDataLayers.ts`）。
 *   瘦身圖磚各 tile layer 最大縮放不同（甲案，analytics FRONTEND_SPEC §3a）：子圖層各自一個 source（`srcMaxzoom`），超過靠 overzoom。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/topic-research/china_opendata/waves/w01/FRONTEND_SPEC.md` 與各 `_manifest.json`（2026-11-13 讀）。
 * 爭議地區依實際管轄：金門、馬祖、澎湖、東沙、太平島、烏坵、大膽二膽屬台灣，台港澳不在任何中國圖層；不畫九段線或任何海域主張線。
 */
import type { CnDataKey, CnRasterKey } from "./cnDataKeys";
import { CN_PREFECTURE_NAMES } from "./cnPrefectureNames";
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
  // 第 2–5 波（2026-11-16，taipei-gis-analytics #395）
  "cn-eez": "cn_eez.pmtiles",
  "cn-terrain": "cn_terrain.pmtiles",
  "cn-place-names": "cn_place_names.pmtiles",
  "cn-ethnic-autonomy": "cn_ethnic_autonomy.pmtiles",
  "cn-dams": "cn_dams.pmtiles",
  "cn-rivers": "cn_rivers.pmtiles",
  "cn-active-faults": "cn_active_faults.pmtiles",
  "cn-nature-reserves": "cn_nature_reserves.pmtiles",
  "cn-wdpa": "cn_wdpa.pmtiles",
  "cn-aquaculture": "cn_aquaculture.pmtiles",
  "cn-soil": "cn_soil.pmtiles",
  "cn-bridges-tunnels": "cn_bridges_tunnels.pmtiles",
  "cn-schools": "cn_schools.pmtiles",
  "cn-medical": "cn_medical.pmtiles",
  "cn-nuclear-plants": "cn_nuclear_plants.pmtiles",
} as const;
export type CnOwnerAsset = keyof typeof CN_OWNER_ASSETS;

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
export interface CnPart extends Omit<PhPart, "geom"> {
  /** fill＝面（第 2–5 波起；同時畫同色外框 `<id 去 -fill>-outline`） */
  geom: "point" | "line" | "fill";
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
export const asPhPart = (part: CnPart) => part as unknown as PhPart;
/** 面子圖層的外框 layer id。 */
export const cnOutlineId = (part: CnPart) => part.id.replace(/-fill$/, "-outline");

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

// ═════════════════════════ 第 2–5 波（2026-11-16，taipei-gis-analytics #395） ═════════════════════════

const CN_W25_FETCHED_AT = "2026-11-16";
const yesNo = { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ") } as const;
const catMap = (cats: readonly PhCat[]) => Object.fromEntries(cats.flatMap((c) => c.values.map((v) => [v, c.label])));

// ───────────── EEZ（C002） ─────────────
const EEZ_CATS: readonly PhCat[] = [{ id: "eez", values: ["eez"], color: "#38bdf8", label: l3("專屬經濟區（200 浬，Marine Regions MRGID 8486）", "Exclusive economic zone (200 nm, Marine Regions MRGID 8486)", "排他的経済水域（200 海里、Marine Regions MRGID 8486）") }];

// ───────────── 地名（C007） ─────────────
const PLACE_CATS: readonly PhCat[] = [
  { id: "settlement", values: ["settlement"], color: "#fbbf24", label: l3("聚落（城市、鎮、村）", "Settlement (city, town, village)", "集落（都市・町・村）") },
  { id: "terrain", values: ["terrain"], color: "#a78bfa", label: l3("地形（山、山脈、山口）", "Terrain (peak, range, pass)", "地形（山・山脈・峠）") },
  { id: "water", values: ["water"], color: "#38bdf8", label: l3("水文（湖、河、水庫）", "Water (lake, river, reservoir)", "水文（湖・川・ダム湖）") },
];

// ───────────── 民族自治地方（C020） ─────────────
const ETHNIC_CATS: readonly PhCat[] = [
  { id: "region", values: ["region"], color: "#ef4444", label: l3("自治區（5）", "Autonomous region (5)", "自治区（5）") },
  { id: "prefecture", values: ["prefecture"], color: "#f59e0b", label: l3("自治州（30）", "Autonomous prefecture (30)", "自治州（30）") },
  { id: "county", values: ["county"], color: "#22c55e", label: l3("自治縣（117）", "Autonomous county (117)", "自治県（117）") },
  { id: "banner", values: ["banner"], color: "#14b8a6", label: l3("自治旗（3）", "Autonomous banner (3)", "自治旗（3）") },
];

// ───────────── 壩與水庫（C107＋C111） ─────────────
const DAM_CATS: readonly PhCat[] = [
  { id: "dam", values: ["dam"], color: "#38bdf8", parts: ["cn-dams-circle"], label: l3("壩（點）", "Dam (point)", "ダム（点）") },
  { id: "reservoir", values: ["reservoir"], color: "#2563eb", parts: ["cn-reservoirs-fill"], label: l3("水庫水面", "Reservoir surface", "貯水池の水面") },
];
const CN_DAM_HEIGHT_BANDS: PhSizeBands = {
  prop: "dam_hgt_m", title: l3("壩高（m）", "Dam height (m)", "堤高（m）"),
  bands: [{ min: 0, radius: 2.5, label: "<15" }, { min: 15, radius: 3.5, label: "15–30" }, { min: 30, radius: 5, label: "30–100" }, { min: 100, radius: 7, label: "≥100" }],
};
const DAM_USE_MAP: Record<string, L3> = {
  "Flood control": l3("防洪", "Flood control", "治水"), Hydroelectricity: l3("水力發電", "Hydroelectricity", "水力発電"),
  Irrigation: l3("灌溉", "Irrigation", "灌漑"), "Water supply": l3("供水", "Water supply", "給水"),
};
const DAM_TYPE_MAP: Record<string, L3> = {
  Dam: l3("壩", "Dam", "ダム"), "Lake Control Dam": l3("湖泊控制壩", "Lake control dam", "湖沼制御堰"),
  Lock: l3("船閘", "Lock", "閘門"), "Low Permeable Dam": l3("低透水壩", "Low permeable dam", "低透水堰"),
};

// ───────────── 河川（C109） ─────────────
const RIVER_CATS: readonly PhCat[] = [
  { id: "o2", values: ["2"], color: "#38bdf8", label: l3("流量等級 2（10,000–100,000 m³/s）", "Flow order 2 (10,000–100,000 m³/s)", "流量等級 2（10,000–100,000 m³/s）") },
  { id: "o3", values: ["3"], color: "#60a5fa", label: l3("流量等級 3（1,000–10,000 m³/s）", "Flow order 3 (1,000–10,000 m³/s)", "流量等級 3（1,000–10,000 m³/s）") },
  { id: "o4", values: ["4"], color: "#7dd3fc", label: l3("流量等級 4（100–1,000 m³/s）", "Flow order 4 (100–1,000 m³/s)", "流量等級 4（100–1,000 m³/s）") },
  { id: "o5", values: ["5"], color: "#a5d8ff", label: l3("流量等級 5（10–100 m³/s）", "Flow order 5 (10–100 m³/s)", "流量等級 5（10–100 m³/s）") },
];

// ───────────── 活動斷層（C071） ─────────────
const FAULT_CATS: readonly PhCat[] = [
  { id: "reverse", values: ["Reverse", "Dextral-Reverse", "Reverse-Dextral", "Sinistral-Reverse"], color: "#ef4444", label: l3("逆斷層（含斜滑）", "Reverse (incl. oblique)", "逆断層（斜めずれを含む）") },
  { id: "normal", values: ["Normal", "Dextral-Normal"], color: "#22c55e", label: l3("正斷層（含斜滑）", "Normal (incl. oblique)", "正断層（斜めずれを含む）") },
  { id: "strike", values: ["Dextral", "Sinistral"], color: "#f59e0b", label: l3("走向滑移（右移、左移）", "Strike-slip (dextral, sinistral)", "横ずれ（右・左）") },
  { id: "fold", values: ["Anticline", "Syncline"], color: "#a78bfa", label: l3("褶皺（背斜、向斜）", "Fold (anticline, syncline)", "褶曲（背斜・向斜）") },
  { id: "unknown", values: [""], color: "#94a3b8", label: l3("未標示", "Not specified", "未記載") },
];

// ───────────── 國家級自然保護區（C127） ─────────────
const RESERVE_CATS: readonly PhCat[] = [
  { id: "core", values: ["core"], color: "#15803d", label: l3("核心區", "Core zone", "核心区") },
  { id: "buffer", values: ["buffer"], color: "#4ade80", label: l3("緩衝區", "Buffer zone", "緩衝区") },
  { id: "experimental", values: ["experimental"], color: "#bef264", label: l3("實驗區", "Experimental zone", "実験区") },
  { id: "unzoned", values: ["unzoned"], color: "#2dd4bf", label: l3("未分區（整個保護區一個面）", "Not zoned (one polygon per reserve)", "区分なし（保護区全体で 1 面）") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他分區", "Other zone", "その他の区域") },
];

// ───────────── WDPA（C128＋C106） ─────────────
const WDPA_CATS: readonly PhCat[] = [
  { id: "ramsar", values: ["ramsar"], color: "#06b6d4", label: l3("國際重要濕地（Ramsar）", "Ramsar wetland", "ラムサール条約湿地") },
  { id: "biosphere", values: ["biosphere"], color: "#22c55e", label: l3("生物圈保護區（UNESCO MAB）", "Biosphere reserve (UNESCO MAB)", "生物圏保存地域（UNESCO MAB）") },
  { id: "world_heritage", values: ["world_heritage"], color: "#eab308", label: l3("世界遺產（自然、複合）", "World Heritage (natural, mixed)", "世界遺産（自然・複合）") },
  { id: "scenic_area", values: ["scenic_area"], color: "#a855f7", label: l3("風景名勝區", "Scenic area", "風景名勝区") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他保護區", "Other protected area", "その他の保護地域") },
];
const WDPA_NC_NOTE = l3("WDPA 使用條款：禁止商業使用（含衍生品）", "WDPA terms: no commercial use (including derived works)", "WDPA 利用規約：商用禁止（派生物を含む）");

// ───────────── 長橋與長隧道（C015） ─────────────
const STRUCT_CATS: readonly PhCat[] = [
  { id: "bridge", values: ["bridge"], color: "#fb923c", label: l3("橋梁（含高架）", "Bridge (incl. viaduct)", "橋（高架を含む）") },
  { id: "tunnel", values: ["tunnel"], color: "#a78bfa", label: l3("隧道", "Tunnel", "トンネル") },
];
const CN_STRUCT_LENGTH_BANDS: PhSizeBands = {
  prop: "length_m", title: l3("單段長度", "Segment length", "区間の長さ"),
  bands: [{ min: 0, radius: 2.5, label: "0.5–1 km" }, { min: 1000, radius: 3.5, label: "1–2 km" }, { min: 2000, radius: 5, label: "2–5 km" }, { min: 5000, radius: 7, label: "≥5 km" }],
};
const CARRIES_MAP: Record<string, L3> = {
  motorway: l3("高速公路", "Motorway", "高速道路"), trunk: l3("國道級幹道", "Trunk road", "幹線道路"), primary: l3("一級幹道", "Primary road", "主要道路"),
  rail_rail: l3("鐵路（含高鐵）", "Railway (incl. high-speed)", "鉄道（高速鉄道を含む）"), rail_subway: l3("地鐵", "Subway", "地下鉄"), rail_light_rail: l3("輕軌", "Light rail", "ライトレール"),
};

// ───────────── 學校（C039）、醫療（C063） ─────────────
const SCHOOL_CATS: readonly PhCat[] = [
  { id: "kindergarten", values: ["kindergarten"], color: "#f9a8d4", label: l3("幼兒園", "Kindergarten", "幼稚園") },
  { id: "school", values: ["school"], color: "#60a5fa", label: l3("中小學", "School", "小中高校") },
  { id: "college", values: ["college"], color: "#a78bfa", label: l3("專科（college）", "College", "専門学校（college）") },
  { id: "university", values: ["university"], color: "#f59e0b", label: l3("大學", "University", "大学") },
];
const MEDICAL_CATS: readonly PhCat[] = [
  { id: "hospital", values: ["hospital"], color: "#ef4444", label: l3("醫院", "Hospital", "病院") },
  { id: "clinic", values: ["clinic"], color: "#f97316", label: l3("診所（含醫師診間）", "Clinic (incl. doctors)", "診療所（医院を含む）") },
  { id: "pharmacy", values: ["pharmacy"], color: "#22c55e", label: l3("藥局", "Pharmacy", "薬局") },
];

// ───────────── 核電（C077） ─────────────
const NUCLEAR_CATS: readonly PhCat[] = [
  { id: "plant", values: ["plant"], color: "#d100ff", parts: ["cn-nuclear-plants-circle"], label: l3("核電廠（廠區）", "Nuclear power plant (site)", "原子力発電所（敷地）") },
  { id: "reactor", values: ["reactor"], color: "#f0abfc", radius: 3, parts: ["cn-nuclear-reactors-circle"], label: l3("機組（z9 起）", "Reactor unit (from z9)", "号機（z9 から）") },
];
const CN_NUCLEAR_OUTPUT_BANDS: PhSizeBands = {
  prop: "output_mw", title: l3("發電容量（OSM，MW）", "Capacity (OSM, MW)", "出力（OSM、MW）"),
  bands: [{ min: 0, radius: 4.5, label: "未標示或 <1,000" }, { min: 1000, radius: 6.5, label: "1,000–4,000" }, { min: 4000, radius: 9, label: "≥4,000" }],
};

/** 第 2–5 波向量層（12 層；地形、養殖、土壤是 raster，見 CN_RASTER_SPECS）。 */
const CN_W25_SPECS: readonly CnLayerSpec[] = [
  {
    key: "cnEez", asset: "cn-eez", file: "cn_eez.pmtiles", sourceId: "cn-eez", srcMinzoom: 2, srcMaxzoom: 8, color: "#38bdf8", count: 1,
    parts: [{ id: "cn-eez-fill", sourceLayer: "eez", geom: "fill", minzoom: 2, cat: constCat("eez") }],
    cats: EEZ_CATS,
    title: { props: ["name_zh", "name"], fallback: l3("專屬經濟區", "Exclusive economic zone", "排他的経済水域") },
    fields: [
      { prop: "name", label: l3("名稱（Marine Regions）", "Name (Marine Regions)", "名称（Marine Regions）") },
      { prop: "pol_type", label: l3("類型", "Type", "種別"), kind: "code" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 0 },
    ],
    legendNotes: [
      l3("不含南海重疊主張區，也不畫九段線", "South China Sea overlapping claim areas are not included, and the nine-dash line is not drawn", "南シナ海の重複主張区域は含まず、九段線も描かない"),
      l3("只畫 Marine Regions MRGID 8486（中國 200 浬 EEZ）；與鄰國、台灣的重疊或聯合主張區（8321、48954、49003）不畫，不畫九段線", "Only Marine Regions MRGID 8486 (China 200 nm EEZ); overlapping or joint claim areas with neighbours and Taiwan (8321, 48954, 49003) and the nine-dash line are not drawn", "Marine Regions MRGID 8486（中国 200 海里 EEZ）のみ。近隣国・台湾との重複・共同主張区域（8321、48954、49003）と九段線は描かない"),
      l3("金門、馬祖周邊與港澳水域已切除；台灣本島判定框內約 0.5 平方度照來源原樣保留", "Waters around Kinmen, Matsu, Hong Kong and Macao removed; about 0.5 square degrees inside the Taiwan main-island box kept as in the source", "金門・馬祖周辺と香港・マカオの水域は除去。台湾本島の判定枠内の約 0.5 平方度は出典のまま"),
      l3("海域界線依 Marine Regions，不代表任何立場；12／24 浬界未做", "Maritime limits follow Marine Regions and do not imply any position; 12/24 nm limits not included", "海域の境界は Marine Regions によるもので、いかなる立場も示さない。12／24 海里線は未収録"),
    ],
    popupNotes: [],
    sourceOrg: "Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12（Marine Regions）", sourceUrl: "https://www.marineregions.org/gazetteer.php?p=details&id=8486",
    license: "CC BY 4.0（請勿轉載原始檔）", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國專屬經濟區載入中", "Loading China EEZ", "中国の排他的経済水域を読み込み中"),
  },
  {
    key: "cnPlaceNames", asset: "cn-place-names", file: "cn_place_names.pmtiles", sourceId: "cn-place-names", srcMinzoom: 3, srcMaxzoom: 9, color: "#fbbf24", count: 25_978,
    parts: [{ id: "cn-place-names-circle", sourceLayer: "places", geom: "point", minzoom: 3, cat: propGetter("kind") }],
    cats: PLACE_CATS,
    minZoomNote: l3("依重要性分縮放出現：大城市、名山 z3 起，小村落 z8 起", "Shown by importance: major cities and peaks from z3, small villages from z8", "重要度順に表示：大都市・名山は z3 から、小さな村は z8 から"),
    title: { props: ["name_zh", "name"], fallback: l3("地名", "Place name", "地名") },
    fields: [
      { prop: "name", label: l3("名稱（GeoNames）", "Name (GeoNames)", "名称（GeoNames）") },
      { prop: "kind", label: l3("類別", "Category", "分類"), map: catMap(PLACE_CATS) },
      { prop: "population", label: l3("人口（GeoNames）", "Population (GeoNames)", "人口（GeoNames）"), kind: "num" },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("GeoNames 25,978 點（聚落 14,852、地形 5,622、水文 5,504）；23,395 筆有中文名，其餘顯示拼音", "25,978 GeoNames points (14,852 settlements, 5,622 terrain, 5,504 water); 23,395 have Chinese names, others show romanised names", "GeoNames 25,978 点（集落 14,852・地形 5,622・水文 5,504）。23,395 件に中国語名、その他はローマ字"),
      l3("人口欄為 GeoNames 登錄值，不是普查", "Population is the GeoNames value, not a census", "人口は GeoNames の登録値で国勢調査ではない"),
      JURISDICTION_NOTE,
    ],
    popupNotes: [],
    sourceOrg: "GeoNames（geonames.org）", sourceUrl: "https://download.geonames.org/export/dump/", license: "CC BY 4.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國地名載入中", "Loading China place names", "中国の地名を読み込み中"),
  },
  {
    key: "cnEthnicAutonomy", asset: "cn-ethnic-autonomy", file: "cn_ethnic_autonomy.pmtiles", sourceId: "cn-ethnic-autonomy", srcMinzoom: 2, srcMaxzoom: 9, color: "#f59e0b", count: 155,
    parts: [{ id: "cn-ethnic-autonomy-fill", sourceLayer: "units", geom: "fill", minzoom: 2, cat: propGetter("kind") }],
    cats: ETHNIC_CATS,
    title: { props: ["name_zh", "name_en"], fallback: l3("民族自治地方", "Ethnic autonomous area", "民族自治地方") },
    fields: [
      { prop: "name_en", label: l3("英文名", "English name", "英語名") },
      { prop: "kind", label: l3("層級", "Level", "階層"), map: catMap(ETHNIC_CATS) },
      { prop: "ethnic_groups", label: l3("自治民族", "Autonomous ethnic groups", "自治民族") },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("民政部 2024 名冊 155 個全上圖（自治區 5、自治州 30、自治縣 117、自治旗 3）；分布 20/31 省", "All 155 units in the 2024 MCA list (5 regions, 30 prefectures, 117 counties, 3 banners); in 20 of 31 provinces", "民政部 2024 名簿の 155 か所すべて（自治区 5・自治州 30・自治県 117・自治旗 3）。31 省中 20 省"),
      l3("自治區、自治州用 OCHA 面；自治縣、旗用 geoBoundaries 2017（OSM 衍生、概化）依地級與民族組合配對", "Regions and prefectures use OCHA polygons; counties and banners use geoBoundaries 2017 (OSM-derived, generalised), matched by prefecture and ethnic groups", "自治区・自治州は OCHA の面、自治県・旗は geoBoundaries 2017（OSM 由来・概略化）を地級と民族の組み合わせで照合"),
      l3("層級互相包含（自治區內有自治州、縣），可用類別篩選只看一級", "Levels nest (regions contain prefectures and counties); use the category filter to see one level", "階層は入れ子（自治区内に自治州・県）。分類フィルタで 1 階層だけ表示できる"),
      CN_NO_POSITION_NOTE,
    ],
    popupNotes: [],
    sourceOrg: "民政部 2024 行政區劃代碼（名冊）；OCHA COD-AB China（CC BY-IGO）；geoBoundaries CHN ADM3（ODbL）", sourceUrl: "https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html",
    license: "CC BY-IGO 3.0（省、地級面）＋ODbL 1.0（縣級面）；名冊未標示授權", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國民族自治地方載入中", "Loading China ethnic autonomous areas", "中国の民族自治地方を読み込み中"),
  },
  {
    key: "cnDams", asset: "cn-dams", file: "cn_dams.pmtiles", sourceId: "cn-dams", srcMinzoom: 3, srcMaxzoom: 10, color: "#38bdf8", count: 14_778,
    parts: [
      { id: "cn-reservoirs-fill", sourceLayer: "reservoirs", geom: "fill", minzoom: 3, cat: constCat("reservoir") },
      { id: "cn-dams-circle", sourceLayer: "dams", geom: "point", minzoom: 3, cat: constCat("dam"), size: CN_DAM_HEIGHT_BANDS },
    ],
    cats: DAM_CATS,
    sizeLegend: [CN_DAM_HEIGHT_BANDS],
    title: { props: ["dam_name", "res_name"], fallback: l3("壩、水庫", "Dam / reservoir", "ダム・貯水池") },
    fields: [
      { prop: "res_name", label: l3("水庫名", "Reservoir", "貯水池名") },
      { prop: "river", label: l3("河川", "River", "河川") },
      { prop: "year_dam", label: l3("完工年", "Year completed", "完成年"), kind: "year" },
      { prop: "dam_hgt_m", label: l3("壩高", "Dam height", "堤高"), kind: "num", unit: "m", digits: 0 },
      { prop: "cap_mcm", label: l3("庫容", "Storage capacity", "貯水容量"), kind: "num", unit: "百萬 m³", digits: 1 },
      { prop: "area_skm", label: l3("水面面積", "Surface area", "水面積"), kind: "num", unit: "km²", digits: 1 },
      { prop: "power_mw", label: l3("裝置容量", "Installed capacity", "設備容量"), kind: "num", unit: "MW", digits: 0 },
      { prop: "main_use", label: l3("主要用途", "Main use", "主な用途"), map: DAM_USE_MAP },
      { prop: "dam_type", label: l3("類型", "Type", "種別"), map: DAM_TYPE_MAP },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("Global Dam Watch：壩 8,238、水庫水面 6,540；30/31 省（上海無）", "Global Dam Watch: 8,238 dams, 6,540 reservoir surfaces; 30 of 31 provinces (none in Shanghai)", "Global Dam Watch：ダム 8,238・貯水池 6,540。31 省中 30 省（上海なし）"),
      l3("學術整合資料（GRanD 等），不是水利部名冊；名稱多為英文或拼音", "Academic compilation (GRanD and others), not the Ministry of Water Resources register; names mostly English or pinyin", "学術的な統合データ（GRanD など）で水利部の名簿ではない。名称は英語・ピンイン中心"),
      JURISDICTION_NOTE,
    ],
    popupNotes: [],
    sourceOrg: "Global Dam Watch v1.0（Lehner et al. 2024, Scientific Data）", sourceUrl: "https://www.globaldamwatch.org/", license: "CC BY 4.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國壩與水庫載入中", "Loading China dams and reservoirs", "中国のダム・貯水池を読み込み中"),
  },
  {
    key: "cnRivers", asset: "cn-rivers", file: "cn_rivers.pmtiles", sourceId: "cn-rivers", srcMinzoom: 3, srcMaxzoom: 8, color: "#60a5fa", count: 51_444,
    parts: [{ id: "cn-rivers-line", sourceLayer: "rivers", geom: "line", minzoom: 3, cat: propGetter("ord_flow"),
      lineWidth: { "2": [2.5, 4], "3": [1.8, 3], "4": [1.2, 2], "5": [0.7, 1.2] } }],
    cats: RIVER_CATS,
    title: { props: [], fallback: l3("河段（模型河網，無河名）", "River reach (modelled network, unnamed)", "河道区間（モデル河川網、名称なし）") },
    fields: [
      { prop: "ord_flow", label: l3("流量等級", "Flow order", "流量等級"), map: catMap(RIVER_CATS) },
      { prop: "dis_av_cms", label: l3("平均流量（模型值）", "Mean discharge (modelled)", "平均流量（モデル値）"), kind: "num", unit: "m³/s", digits: 1 },
      { prop: "upland_skm", label: l3("集水面積", "Upstream catchment", "集水面積"), kind: "num", unit: "km²", digits: 0 },
    ],
    legendNotes: [
      l3("HydroRIVERS 模型河網 51,444 段（流量等級 2–5，平均流量 ≥10 m³/s）；31/31 省", "HydroRIVERS modelled network, 51,444 reaches (flow orders 2–5, mean discharge ≥10 m³/s); 31 of 31 provinces", "HydroRIVERS モデル河川網 51,444 区間（流量等級 2–5、平均流量 ≥10 m³/s）。31 省すべて"),
      l3("由 15 秒 DEM 推導，沒有河名；平原區河道位置可能偏移，流量是模型值", "Derived from a 15-arc-second DEM, no names; channel positions may be off in plains, discharge is modelled", "15 秒 DEM から推定、名称なし。平野部では位置がずれることがあり、流量はモデル値"),
    ],
    popupNotes: [],
    sourceOrg: "HydroRIVERS v1.0（Lehner & Grill 2013），www.hydrosheds.org", sourceUrl: "https://www.hydrosheds.org/products/hydrorivers",
    license: "HydroSHEDS License Agreement（只准以衍生作品散布）", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國河川載入中", "Loading China rivers", "中国の河川を読み込み中"),
  },
  {
    key: "cnActiveFaults", asset: "cn-active-faults", file: "cn_active_faults.pmtiles", sourceId: "cn-active-faults", srcMinzoom: 3, srcMaxzoom: 10, color: "#ef4444", count: 671,
    parts: [{ id: "cn-active-faults-line", sourceLayer: "faults", geom: "line", minzoom: 3, cat: propGetter("slip_type") }],
    cats: FAULT_CATS,
    title: { props: ["name"], fallback: l3("活動斷層（未命名）", "Active fault (unnamed)", "活断層（名称なし）") },
    fields: [
      { prop: "slip_type", label: l3("錯動型態（GEM 原文）", "Slip type (GEM)", "変位の型（GEM 原文）"), kind: "code" },
      { prop: "average_dip", label: l3("平均傾角", "Average dip", "平均傾斜角"), kind: "num", unit: "°", digits: 0 },
      { prop: "net_slip_rate_mm_yr", label: l3("淨滑移速率（mm／年，GEM 原文）", "Net slip rate (mm/yr, GEM)", "正味すべり速度（mm／年、GEM 原文）"), kind: "code" },
      { prop: "catalog_name", label: l3("來源目錄", "Source catalogue", "出典カタログ"), kind: "code" },
    ],
    legendNotes: [
      l3("GEM 全球活動斷層 671 條；16/31 省，華東、華北幾乎沒有，空白不代表沒有斷層", "671 faults from the GEM global database; 16 of 31 provinces, almost none in East and North China, so gaps do not mean no faults", "GEM 全球活断層 671 本。31 省中 16 省で華東・華北はほぼなく、空白は断層がないという意味ではない"),
      l3("非中國官方斷層圖（中國活動斷層資料庫未公開下載）；各來源精度不一", "Not the official Chinese fault map (China's active fault database is not openly downloadable); accuracy varies by source catalogue", "中国の公式断層図ではない（中国活断層データベースは公開ダウンロードなし）。出典ごとに精度が異なる"),
    ],
    popupNotes: [],
    sourceOrg: "GEM Global Active Faults Database（Styron & Pagani 2020）", sourceUrl: "https://github.com/GEMScienceTools/gem-global-active-faults",
    license: "CC BY-SA 4.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國活動斷層載入中", "Loading China active faults", "中国の活断層を読み込み中"),
  },
  {
    key: "cnNatureReserves", asset: "cn-nature-reserves", file: "cn_nature_reserves.pmtiles", sourceId: "cn-nature-reserves", srcMinzoom: 3, srcMaxzoom: 10, color: "#22c55e", count: 1225,
    parts: [{ id: "cn-nature-reserves-fill", sourceLayer: "reserves", geom: "fill", minzoom: 3, cat: propGetter("zone") }],
    cats: RESERVE_CATS,
    title: { props: ["reserve_name"], fallback: l3("國家級自然保護區", "National nature reserve", "国家級自然保護区") },
    fields: [
      { prop: "unit_name", label: l3("分區面名稱", "Zone polygon", "区域ポリゴン名") },
      { prop: "zone", label: l3("分區", "Zone", "区域"), map: catMap(RESERVE_CATS) },
      { prop: "zone_raw", label: l3("分區（原文）", "Zone (source)", "区域（原文）"), kind: "code" },
      { prop: "target", label: l3("保護對象（作者英譯）", "Protection target (author's translation)", "保護対象（著者英訳）") },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("國家級自然保護區 351 處、分區面 1,225；29/31 省（北京、天津無）", "351 national nature reserves, 1,225 zone polygons; 29 of 31 provinces (none in Beijing, Tianjin)", "国家級自然保護区 351 か所・区域ポリゴン 1,225。31 省中 29 省（北京・天津なし）"),
      l3("只有國家級；名稱與保護對象為作者英譯（部分直譯）", "National level only; names and targets are the author's English translations (some literal)", "国家級のみ。名称と保護対象は著者の英訳（一部直訳）"),
    ],
    popupNotes: [],
    sourceOrg: "Jia, X. List of National Nature Reserves in China（Zenodo 18226534）", sourceUrl: "https://zenodo.org/records/18226534", license: "CC BY 4.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國自然保護區載入中", "Loading China nature reserves", "中国の自然保護区を読み込み中"),
  },
  {
    key: "cnWdpa", asset: "cn-wdpa", file: "cn_wdpa.pmtiles", sourceId: "cn-wdpa", srcMinzoom: 3, srcMaxzoom: 10, color: "#06b6d4", count: 149,
    parts: [
      { id: "cn-wdpa-fill", sourceLayer: "areas", geom: "fill", minzoom: 3, cat: propGetter("category") },
      { id: "cn-wdpa-circle", sourceLayer: "points", geom: "point", minzoom: 3, cat: propGetter("category"),
        ring: { when: ["==", ["get", "marine"], true], js: (p) => p.marine === true || str(p.marine) === "true", label: l3("白框：海洋保護區（只有中心點）", "White ring: marine site (centre point only)", "白枠：海洋保護地域（中心点のみ）") } },
    ],
    cats: WDPA_CATS,
    title: { props: ["name", "name_eng"], fallback: l3("保護區（WDPA）", "Protected area (WDPA)", "保護地域（WDPA）") },
    fields: [
      { prop: "name_eng", label: l3("英文名", "English name", "英語名") },
      { prop: "category", label: l3("類別", "Category", "分類"), map: catMap(WDPA_CATS) },
      { prop: "desig_eng", label: l3("指定類型（WDPA 原文）", "Designation (WDPA)", "指定種別（WDPA 原文）"), kind: "code" },
      { prop: "iucn_cat", label: l3("IUCN 類別", "IUCN category", "IUCN カテゴリ"), kind: "code" },
      { prop: "marine", label: l3("海洋", "Marine", "海洋"), map: yesNo },
      { prop: "status_yr", label: l3("指定年", "Year designated", "指定年"), kind: "year" },
      { prop: "rep_area_km2", label: l3("申報面積", "Reported area", "報告面積"), kind: "num", unit: "km²", digits: 1 },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("WDPA 公開版中國 149 處（面 106、只有中心點者 43）；28/31 省", "149 sites in the public WDPA for China (106 polygons, 43 centre points only); 28 of 31 provinces", "WDPA 公開版の中国 149 か所（面 106・中心点のみ 43）。31 省中 28 省"),
      l3("中國國家級、省級保護區多不在公開版（國家級自然保護區見另一層）；公開版沒有中國海洋保護區面", "Most national and provincial reserves are not in the public WDPA (see the national nature reserves layer); no Chinese marine protected area polygons in the public release", "国家級・省級保護区の多くは公開版にない（国家級自然保護区は別レイヤー）。公開版に中国の海洋保護区の面はない"),
      WDPA_NC_NOTE,
    ],
    popupNotes: [{ text: WDPA_NC_NOTE }],
    sourceOrg: "UNEP-WCMC and IUCN, Protected Planet：World Database on Protected Areas（Nov 2026）", sourceUrl: "https://www.protectedplanet.net/",
    license: "WDPA Terms of Use（非商用，含衍生品）", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國保護區（WDPA）載入中", "Loading China protected areas (WDPA)", "中国の保護地域（WDPA）を読み込み中"),
  },
  {
    key: "cnBridgesTunnels", asset: "cn-bridges-tunnels", file: "cn_bridges_tunnels.pmtiles", sourceId: "cn-bridges-tunnels", srcMinzoom: 5, srcMaxzoom: 10, color: "#fb923c", count: 108_778,
    parts: [{ id: "cn-bridges-tunnels-circle", sourceLayer: "structures", geom: "point", minzoom: 5, cat: propGetter("kind"), size: CN_STRUCT_LENGTH_BANDS }],
    cats: STRUCT_CATS,
    sizeLegend: [CN_STRUCT_LENGTH_BANDS],
    minZoomNote: l3("依長度分縮放出現：≥5 km z5 起、≥2 km z7 起、其餘 z9 起", "Shown by length: ≥5 km from z5, ≥2 km from z7, others from z9", "長さ順に表示：≥5 km は z5、≥2 km は z7、その他は z9 から"),
    title: { props: ["name"], fallback: l3("橋梁、隧道", "Bridge / tunnel", "橋・トンネル"),
      fallbackBy: { prop: "kind", map: { bridge: l3("未命名橋梁", "Unnamed bridge", "名称不明の橋"), tunnel: l3("未命名隧道", "Unnamed tunnel", "名称不明のトンネル") } } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(STRUCT_CATS) },
      { prop: "carries", label: l3("所在路線", "Carries", "路線"), map: CARRIES_MAP },
      { prop: "length_m", label: l3("單段長度（OSM way）", "Segment length (OSM way)", "区間の長さ（OSM way）"), kind: "num", unit: "m", digits: 0 },
    ],
    legendNotes: [
      l3("OSM 高速公路、國道級與一級幹道、鐵路上單段 ≥500 m 的橋隧 108,778 處（橋 71,842、隧道 36,936），以線段中點表示", "108,778 bridges and tunnels ≥500 m per segment on OSM motorways, trunk and primary roads and railways (71,842 bridges, 36,936 tunnels), shown at segment midpoints", "OSM の高速道路・幹線・主要道路・鉄道で 1 区間 ≥500 m の橋とトンネル 108,778 か所（橋 71,842・トンネル 36,936）、区間の中点で表示"),
      l3("同一座橋上下行或分段各有一點；不是官方橋梁清冊", "Each carriageway or segment of a bridge has its own point; not an official bridge register", "上下線や区間ごとに点がある。公式の橋梁台帳ではない"),
      OSM_SPARSE_NOTE,
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國長橋與長隧道載入中", "Loading China long bridges and tunnels", "中国の長大橋・長大トンネルを読み込み中"),
  },
  {
    key: "cnSchools", asset: "cn-schools", file: "cn_schools.pmtiles", sourceId: "cn-schools", srcMinzoom: 6, srcMaxzoom: 10, color: "#60a5fa", count: 89_109,
    parts: [{ id: "cn-schools-circle", sourceLayer: "schools", geom: "point", minzoom: 6, cat: propGetter("kind") }],
    cats: SCHOOL_CATS,
    heat: { intensity: 0.4 },
    minZoomNote: l3("z6 起顯示（拉遠沒有圖磚）；低縮放抽稀", "Shown from z6 (no tiles when zoomed out); thinned at low zoom", "z6 から表示（縮小時はタイルなし）。低ズームは間引き"),
    title: { props: ["name"], fallback: l3("學校", "School", "学校"),
      fallbackBy: { prop: "kind", map: Object.fromEntries(SCHOOL_CATS.map((c) => [c.id, l3(`未命名${c.label.zh}`, `Unnamed ${c.label.en.toLowerCase()}`, `名称不明の${c.label.ja}`)])) } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(SCHOOL_CATS) },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("OSM 學校 89,109（中小學 68,233、幼兒園 13,882、專科 4,228、大學 2,766）；官方名冊沒有座標", "89,109 OSM schools (68,233 schools, 13,882 kindergartens, 4,228 colleges, 2,766 universities); official registers have no coordinates", "OSM の学校 89,109（小中高 68,233・幼稚園 13,882・専門 4,228・大学 2,766）。公式名簿に座標はない"),
      OSM_SPARSE_NOTE,
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國學校載入中", "Loading China schools", "中国の学校を読み込み中"),
  },
  {
    key: "cnMedical", asset: "cn-medical", file: "cn_medical.pmtiles", sourceId: "cn-medical", srcMinzoom: 6, srcMaxzoom: 10, color: "#ef4444", count: 20_015,
    parts: [{ id: "cn-medical-circle", sourceLayer: "medical", geom: "point", minzoom: 6, cat: propGetter("kind") }],
    cats: MEDICAL_CATS,
    heat: { intensity: 0.5 },
    minZoomNote: l3("z6 起顯示（拉遠沒有圖磚）", "Shown from z6 (no tiles when zoomed out)", "z6 から表示（縮小時はタイルなし）"),
    title: { props: ["name"], fallback: l3("醫療院所", "Health facility", "医療機関"),
      fallbackBy: { prop: "kind", map: Object.fromEntries(MEDICAL_CATS.map((c) => [c.id, l3(`未命名${c.label.zh}`, `Unnamed ${c.label.en.toLowerCase()}`, `名称不明の${c.label.ja}`)])) } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(MEDICAL_CATS) },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("OSM 醫療 20,015（醫院 13,297、藥局 4,361、診所 2,357）；藥局、診所明顯少收", "20,015 OSM facilities (13,297 hospitals, 4,361 pharmacies, 2,357 clinics); pharmacies and clinics clearly under-mapped", "OSM の医療 20,015（病院 13,297・薬局 4,361・診療所 2,357）。薬局・診療所は明らかに少ない"),
      OSM_SPARSE_NOTE,
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國醫療院所載入中", "Loading China health facilities", "中国の医療機関を読み込み中"),
  },
  {
    key: "cnNuclearPlants", asset: "cn-nuclear-plants", file: "cn_nuclear_plants.pmtiles", sourceId: "cn-nuclear-plants", srcMinzoom: 3, srcMaxzoom: 12, color: "#d100ff", count: 66,
    parts: [
      { id: "cn-nuclear-reactors-circle", sourceLayer: "reactors", geom: "point", minzoom: 9, cat: constCat("reactor") },
      { id: "cn-nuclear-plants-circle", sourceLayer: "plants", geom: "point", minzoom: 3, cat: constCat("plant"), size: CN_NUCLEAR_OUTPUT_BANDS },
    ],
    cats: NUCLEAR_CATS,
    sizeLegend: [CN_NUCLEAR_OUTPUT_BANDS],
    title: { props: ["name", "name_en"], fallback: l3("核設施", "Nuclear facility", "原子力施設") },
    fields: [
      { prop: "name_en", label: l3("英文名", "English name", "英語名") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "output_raw", label: l3("發電容量（OSM 原文）", "Capacity (OSM tag)", "出力（OSM 原文）"), kind: "code" },
      { prop: "start_date", label: l3("啟用（OSM）", "Start (OSM)", "運転開始（OSM）"), kind: "code" },
      PROVINCE_FIELD, PREFECTURE_FIELD,
    ],
    legendNotes: [
      l3("OSM 核電廠 27 處（10/31：沿海 9 省與北京實驗快堆）、機組 39 個；未區分運轉、興建、規劃", "27 OSM nuclear plants (10 of 31: nine coastal provinces and the Beijing experimental fast reactor), 39 reactor units; operating, under construction and planned not distinguished", "OSM の原子力発電所 27 か所（31 省中 10：沿岸 9 省と北京の実験高速炉）・号機 39。運転・建設・計画は区別しない"),
      l3("運轉狀態請看「能源 › 電廠」的 GEM 核能；輻射監測站沒有公開 API，未做", "For operating status see GEM nuclear in Energy › Power plants; radiation monitoring has no public API and is not included", "運転状況は「エネルギー › 発電所」の GEM 原子力を参照。放射線モニタリングは公開 API がなく未収録"),
    ],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: OSM_URL, license: "ODbL 1.0", fetchedAt: CN_W25_FETCHED_AT,
    loading: l3("中國核電廠載入中", "Loading China nuclear power plants", "中国の原子力発電所を読み込み中"),
  },
];

// ═════════════════════════ 第 2–5 波 raster（地形、養殖、土壤） ═════════════════════════

export interface CnRasterSpec {
  key: CnRasterKey;
  asset: CnOwnerAsset;
  minzoom: number;
  maxzoom: number;
  opacity: number;
  color: string;
  /** 插在底圖第一個 symbol 下（地形、土壤）；否則疊在最上層 */
  belowSymbols: boolean;
  legendTitle: L3;
  legend: readonly { color: string; label: L3 }[];
  notes: readonly L3[];
  sourceOrg: string;
  sourceUrl: string;
  license: string;
  loading: L3;
}
/** SoilGrids WRB 土類（佔 31 省面積 ≥1% 的 15 類，合計 98.3%；顏色＝ISRIC MostProbable.qml）。 */
const SOIL_LEGEND: readonly { color: string; label: L3 }[] = [
  ["#7ccd5f", "薄層土", "Leptosols", 16.8], ["#8e3a23", "雛形土", "Cambisols", 16.8], ["#ac4fc5", "淋溶土", "Luvisols", 10.9],
  ["#9b1270", "強淋溶土", "Acrisols", 9.2], ["#e586f1", "石膏土", "Gypsisols", 8.4], ["#a2705c", "沖積土", "Fluvisols", 6.5],
  ["#923deb", "栗鈣土", "Kastanozems", 5.8], ["#52da36", "鈣積土", "Calcisols", 4.9], ["#a91d99", "砂性土", "Arenosols", 4.9],
  ["#e74c92", "黑土（Phaeozems）", "Phaeozems", 3.4], ["#13bb91", "黑鈣土", "Chernozems", 3.0], ["#bc1f47", "高活性強酸土", "Alisols", 2.4],
  ["#28a1ac", "冰凍土", "Cryosols", 2.2], ["#691d84", "鹽土", "Solonchaks", 1.6], ["#158cb3", "疏鬆岩性土", "Regosols", 1.5],
].map(([color, zh, en, pct]) => ({ color: color as string, label: l3(`${zh}（${en}）${pct}%`, `${en} ${pct}%`, `${en} ${pct}%`) }));

export const CN_RASTER_SPECS: readonly CnRasterSpec[] = [
  {
    key: "cnTerrain", asset: "cn-terrain", minzoom: 2, maxzoom: 7, opacity: 0.8, color: "#9ca3af", belowSymbols: true,
    legendTitle: l3("山影（高程推算）", "Hillshade (from elevation)", "陰影起伏（標高から算出）"),
    legend: [
      { color: "#f3f4f6", label: l3("向光坡（淡白）", "Lit slope (faint white)", "日向斜面（淡い白）") },
      { color: "#374151", label: l3("背光坡（越陡越暗）", "Shaded slope (darker = steeper)", "日陰斜面（急なほど暗い）") },
    ],
    notes: [
      l3("AWS Terrain Tiles z7（約 1 km）高程算山影，只到 z7，放大會變模糊；31 省面內", "Hillshade from AWS Terrain Tiles z7 (~1 km); max z7, blurs when zoomed in; inside the 31 provinces", "AWS Terrain Tiles z7（約 1 km）の標高から算出。z7 まで、拡大するとぼやける。31 省の範囲内"),
      l3("平地透明，只畫坡面明暗，不蓋住底圖", "Flat ground is transparent; only slope light and shade are drawn, so the basemap stays visible", "平地は透明で、斜面の明暗だけを描くため下の地図が見える"),
      l3("高程合成自 SRTM、GMTED2010、ETOPO1 等；只看大地形", "Elevation merged from SRTM, GMTED2010, ETOPO1 and others; for broad terrain only", "標高は SRTM・GMTED2010・ETOPO1 などの合成。大地形の把握用"),
    ],
    sourceOrg: "Terrain Tiles on AWS Open Data（Mapzen／Tilezen：SRTM、GMTED2010、ETOPO1 等）", sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
    license: "公有領域來源＋署名", loading: l3("中國地形載入中", "Loading China terrain", "中国の地形を読み込み中"),
  },
  {
    key: "cnAquaculture", asset: "cn-aquaculture", minzoom: 2, maxzoom: 10, opacity: 0.85, color: "#26a69a", belowSymbols: false,
    legendTitle: l3("2024 年養殖區（衛星判釋）", "Aquaculture areas, 2024 (satellite-derived)", "2024 年の養殖区域（衛星判読）"),
    legend: [
      { color: "#e69138", label: l3("陸上養殖（魚塭、池塘）", "Land-based (ponds)", "陸上養殖（養殖池）") },
      { color: "#26a69a", label: l3("海上養殖（筏式、網箱）", "Marine (rafts, cages)", "海面養殖（筏・生け簀）") },
    ],
    notes: [
      l3("中國沿海 11 省 2024 年養殖區 raster（衛星判釋，z2–10）；內陸省不在範圍內", "2024 aquaculture raster for 11 coastal provinces (satellite-derived, z2–10); inland provinces not covered", "沿岸 11 省の 2024 年養殖区域ラスター（衛星判読、z2–10）。内陸省は対象外"),
      l3("拉遠（z6 以下）是放大示意：粗格內有養殖就上色並外擴，會誇大範圍；放大到 z7 以上才是約 150 m 網格", "Zoomed out (z6 and below) is an enlarged sketch: coarse cells with any aquaculture are coloured and widened, overstating extent; z7 and above show the ~150 m grid", "縮小時（z6 以下）は拡大表示：粗いセルに養殖があれば着色して広げるため範囲を誇張する。z7 以上で約 150 m 格子"),
      l3("遙測分類結果，不是登記資料；小型池塘可能漏判", "Remote-sensing classification, not registered farms; small ponds may be missed", "リモートセンシング分類で登録データではない。小さな池は漏れることがある"),
    ],
    sourceOrg: "Annual Spatial Distribution Dataset of Aquaculture Areas in the Coastal Zone of China (1986–2024)，Zenodo 19418704", sourceUrl: "https://zenodo.org/records/19418704",
    license: "Apache-2.0", loading: l3("中國養殖區載入中", "Loading China aquaculture areas", "中国の養殖区域を読み込み中"),
  },
  {
    key: "cnSoil", asset: "cn-soil", minzoom: 2, maxzoom: 8, opacity: 0.7, color: "#8e3a23", belowSymbols: true,
    legendTitle: l3("WRB 最可能土類（約 1 km）", "Most probable WRB soil group (~1 km)", "WRB 最尤土壌群（約 1 km）"),
    legend: SOIL_LEGEND,
    notes: [
      l3("列出佔 31 省面積 ≥1% 的 15 類（合計 98.3%）；其餘 15 類合計 1.7%", "15 groups covering ≥1% of the 31 provinces listed (98.3% in total); the other 15 groups total 1.7%", "31 省の面積の 1% 以上を占める 15 群（計 98.3%）を表示。残り 15 群は計 1.7%"),
      l3("機器學習模型預測，不是土壤調查圖；SoilGrids 250 m 的約 1 km 金字塔層，只看大尺度", "Machine-learning prediction, not a soil survey; ~1 km overview of SoilGrids 250 m, for broad patterns only", "機械学習の予測で土壌調査図ではない。SoilGrids 250 m の約 1 km 概観レベルで、広域傾向の把握用"),
    ],
    sourceOrg: "SoilGrids 2.0（Poggio et al. 2021），ISRIC – World Soil Information", sourceUrl: "https://www.isric.org/explore/soilgrids",
    license: "CC BY 4.0", loading: l3("中國土壤載入中", "Loading China soil", "中国の土壌を読み込み中"),
  },
];
export const CN_RASTER_SPEC_BY_KEY: Readonly<Record<CnRasterKey, CnRasterSpec>> = Object.fromEntries(CN_RASTER_SPECS.map((s) => [s.key, s])) as Record<CnRasterKey, CnRasterSpec>;

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
    sourceUrl: "https://doi.org/10.6084/m9.figshare.28323971", license: "CC BY 4.0（figshare）；上游為高德／百度地圖 API，條款未查證", fetchedAt: CN_FETCHED_AT,
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
      l3("約 77% 位置為概略", "About 77% of locations are approximate", "位置の約 77% は概略"),
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
  ...CN_W25_SPECS,
];

export const CN_SPEC_BY_KEY: Readonly<Record<CnDataKey, CnLayerSpec>> = Object.fromEntries(CN_DATA_SPECS.map((s) => [s.key, s])) as Record<CnDataKey, CnLayerSpec>;

/** 類別多選選項（zh 標籤；layerParamsSpec 用）。中國層沒有「其他」選項。 */
export const cnCatOptions = (spec: CnLayerSpec): { value: string; label: string }[] => spec.cats.map((c) => ({ value: c.id, label: c.label.zh }));
