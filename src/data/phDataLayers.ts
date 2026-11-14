/**
 * 菲律賓第 0–1 波（2026-11-13）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。
 * - 行政邊界（C001）與人口（C023）：同一套 18 region／88 province 級單位（82 省＋6 個非省單位）／1,642 municipality／42,048 barangay 面，四層級 select 切換
 *   （`usePhAdminLayers`、`usePhPopulationLayers`）。
 * - 交通 3 層、能源 5 層：規格驅動（`PH_DATA_SPECS`＋`usePhDataLayer`）。一個 key 可有多個子圖層（線＋點、架空＋電纜），
 *   類別多選一個 mask 涵蓋全部子圖層（`PhCat.parts` 指定類別屬於哪些子圖層）。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/data-catalog/{base_map,demographics,transportation,energy}/ph_*.md`
 * 與 `docs/topic-research/philippines_opendata/waves/w01/FRONTEND_SPEC.md`（各 `_manifest.json` provenance 2026-11-13 讀）。
 * 不上任何西菲律賓海／海域主張線；卡拉延群島（Kalayaan）的面與點不畫（使用者 2026-11-10）。
 * 本檔不 import energyLoader 等重相依（layerParamsSpec 會讀本檔）；燃料色抄自 `energyLoader.FUEL_COLORS`。
 */
import type { PhDataKey } from "./phDataKeys";
import type { L3 } from "./krDataLayers";

export type { L3 } from "./krDataLayers";
export { pickL3 } from "./krDataLayers";

type Expr = unknown[];
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export const PH_FETCHED_AT = "2026-11-13";
const ODBL = "ODbL 1.0";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const OSM_HOT = "© OpenStreetMap contributors（ODbL），via HOT Export Tool／HDX";
const OSM_OVERTURE = "© OpenStreetMap contributors（ODbL），via Overture Maps Foundation";
const NO_LICENSE_TEXT = "來源未附授權條文（Geoportal 盤點表 Conditional downloading）；OSM 補缺 ODbL 1.0";

// ═════════════════════════ 行政邊界、人口（四層級） ═════════════════════════

/** 四層級＝PMTiles tile layer 名（select encode 順序）；minzoom／maxzoom＝檔內該層實際縮放範圍。 */
export const PH_ADMIN_LEVELS = [
  { value: "region", label: "區域（Region，18）", srcMinzoom: 3, srcMaxzoom: 10 },
  { value: "province", label: "省（Province，82 省＋6 個非省單位）", srcMinzoom: 4, srcMaxzoom: 11 },
  { value: "municipality", label: "市鎮（City／Municipality，1,642）", srcMinzoom: 6, srcMaxzoom: 12 },
  { value: "barangay", label: "村里（Barangay，42,048）", srcMinzoom: 9, srcMaxzoom: 13 },
] as const;
export type PhAdminLevel = (typeof PH_ADMIN_LEVELS)[number]["value"];
export const PH_ADMIN_LEVEL_LABELS: Record<PhAdminLevel, L3> = {
  region: l3("區域（Region）", "Region", "地方（Region）"),
  province: l3("省（Province）", "Province", "州（Province）"),
  municipality: l3("市鎮（City／Municipality）", "City / Municipality", "市・町（City／Municipality）"),
  barangay: l3("村里（Barangay）", "Barangay", "バランガイ（Barangay）"),
};
/** 卡拉延群島不畫：市鎮層有 `kig`；barangay 與人口圖磚沒有，改用「Palawan 省的 Kalayaan」（Laguna 也有同名 Kalayaan，不能只比名稱）。 */
export function phKigExcludeFilter(level: PhAdminLevel): Expr | null {
  if (level === "region" || level === "province") return null;
  const nameKey = level === "barangay" ? "municipality_name" : "name";
  return ["!", ["all", ["==", ["get", nameKey], "Kalayaan"], ["==", ["get", "province_name"], "Palawan"]]];
}
export const PH_ADMIN_COLOR = "#9ca3af";
export const PH_ADMIN_SOURCE = {
  org: "OCHA COD-AB Philippines v03（source NAMRIA、PSA），via HDX；NIR 合成與 Sulu 改隸 Region IX 由 taipei-gis-analytics 處理",
  url: "https://data.humdata.org/dataset/cod-ab-phl",
  license: "CC BY-IGO 3.0",
  short: "© OCHA／PSA／NAMRIA COD-AB（HDX，CC BY-IGO）",
} as const;
export const PH_ADMIN_NOTES: readonly L3[] = [
  l3("18 個 region（PSGC 2 碼，沒有 15；含 2024 新設的 Negros Island Region，Sulu 歸 Region IX）", "18 regions (PSGC codes, no 15; includes the 2024 Negros Island Region; Sulu is under Region IX)", "18 地方（PSGC 2 桁、15 はない。2024 年新設の Negros Island Region を含み、Sulu は Region IX）"),
  l3("卡拉延群島（Kalayaan）的市鎮與村里不畫；不含任何海域界線", "Kalayaan Island Group municipality and barangay not drawn; no maritime boundaries shown", "カラヤン諸島の市町・バランガイは描画しない。海域の境界線は含まない"),
];

export const PH_POPULATION_KEY = "phPopulation";
/** 人口密度（人／km²）6 級斷點；圖例逐級列出。市鎮層中位數 314、barangay 層 478。 */
export const PH_DENSITY_BREAKS = [100, 300, 1000, 5000, 20000] as const;
export const PH_DENSITY_LABELS = ["<100", "100–300", "300–1,000", "1,000–5,000", "5,000–20,000", "≥20,000"] as const;
/** 未涵蓋＝灰（使用者決定：不畫成 0）。 */
export const PH_NOT_COVERED_COLOR = "#6b7280";
export const PH_POPULATION_SOURCE = {
  org: "Philippine Statistics Authority（PSA），2024 Census of Population（OpenSTAT 0231A6DPUP0）；邊界 OCHA COD-AB v03（CC BY-IGO）",
  url: "https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__1A__PO_2024/",
  license: "PSA OpenSTAT 未附授權條文（菲律賓開放資料政策：註明發布機關）",
  short: "PSA 2024 Census of Population（OpenSTAT）",
} as const;
export const PH_POPULATION_NOTES: readonly L3[] = [
  l3("2024 年普查（普查日 2024-07-01）；密度＝人口 ÷ 面積（EPSG:6933）", "2024 Census (reference date 2024-07-01); density = population ÷ area (EPSG:6933)", "2024 年国勢調査（調査日 2024-07-01）。密度＝人口 ÷ 面積（EPSG:6933）"),
  l3("灰色＝未涵蓋：普查表名稱對不到的面（111 個 barangay，例 Taguig EMBO、Bacoor 改號、新設 barangay），不是 0 人", "Grey = not covered: units whose census name could not be matched (111 barangays, e.g. Taguig EMBO, renumbered Bacoor, new barangays), not zero people", "灰色＝未収録：国勢調査表と名称を照合できない区域（111 バランガイ。Taguig EMBO、Bacoor の番号変更、新設など）で、0 人ではない"),
];
export const PH_POP_STATUS: Record<string, L3> = {
  ok: l3("普查值", "Census count", "国勢調査値"),
  not_covered: l3("未涵蓋（名稱對不到）", "Not covered (name not matched)", "未収録（名称照合できず）"),
  sum_of_barangays: l3("由所屬 barangay 加總", "Sum of its barangays", "所属バランガイの合計"),
  aggregated_split: l3("人口為合併值（普查後拆分的 barangay）", "Combined value (barangay split after the census)", "合算値（調査後に分割されたバランガイ）"),
};
/** barangay `urban_class`：PSA 表內沒有代碼說明，依資料推定 1＝都市、2＝鄉村。 */
export const PH_URBAN_CLASS: Record<string, L3> = {
  "1": l3("都市（推定，代碼 1）", "Urban (inferred, code 1)", "都市（推定、コード 1）"),
  "2": l3("鄉村（推定，代碼 2）", "Rural (inferred, code 2)", "農村（推定、コード 2）"),
};

// ═════════════════════════ 規格驅動 8 層 ═════════════════════════

export interface PhCat { id: string; values: readonly string[]; color: string; label: L3; /** 屬於哪些子圖層；省略＝全部 */ parts?: readonly string[]; /** 依類別的點半徑（px，乘大小滑桿） */ radius?: number }
export interface PhField { prop: string; label: L3; kind?: "text" | "num" | "code" | "year"; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export interface PhSizeBands { prop: string; title: L3; bands: readonly { min: number; radius: number; label: string }[] }
/** 類別取值：Mapbox 表達式（回傳字串）與同義的 JS 版（popup 配色用）。 */
export interface PhCatGetter { expr: Expr; js: (p: Record<string, unknown>) => string }
export interface PhPart {
  /** layer id（literal；gisClickRegistry 以此比對） */
  id: string;
  sourceLayer: string;
  /** fill＝面（越南安江工業群；2026-11-13 起） */
  geom: "point" | "line" | "fill";
  minzoom: number;
  cat: PhCatGetter;
  /** 固定 filter（例：只畫電纜、排除卡拉延群島的點） */
  filter?: Expr;
  dashed?: boolean;
  /** 點：依數值分級的半徑（覆蓋類別半徑） */
  size?: PhSizeBands;
  /** 線寬（z10／z14 兩段，依類別） */
  lineWidth?: Readonly<Record<string, readonly [number, number]>>;
  /** 點描邊編碼：符合條件者白框 2px（例：Climate TRACE 補缺） */
  ring?: { when: Expr; js: (p: Record<string, unknown>) => boolean; label: L3 };
  /** 點用小號半徑（S；密集點、附屬設施） */
  small?: boolean;
}
export interface PhNote { text: L3; /** 只在符合條件的 feature 顯示 */ when?: (p: Record<string, unknown>) => boolean }
/** `K`：圖層 key 型別（越南等他國重用本引擎時放寬，2026-11-13）。 */
export interface PhLayerSpec<K extends string = PhDataKey> {
  key: K;
  file: string;
  sourceId: string;
  srcMinzoom: number;
  srcMaxzoom: number;
  color: string;
  count: number;
  parts: readonly PhPart[];
  cats: readonly PhCat[];
  otherColor?: string;
  otherLabel?: L3;
  /** 圖例標題後綴（例：C090「補助安裝地點，非全國光電」） */
  legendTitleNote?: L3;
  /** 虛線子圖層的圖例文字（省略＝「地下、海底電纜」；null＝虛線已有自己的分類列，不另列） */
  dashLabel?: L3 | null;
  sizeLegend?: readonly PhSizeBands[];
  title: { props: readonly string[]; fallback: L3; fallbackBy?: { prop: string; map: Readonly<Record<string, L3>> } };
  fields: readonly PhField[];
  legendNotes: readonly L3[];
  popupNotes: readonly PhNote[];
  /** 低縮放熱區（≥1 萬點，map-layers §3.8 V-1／P-4） */
  heat?: { intensity: number };
  sourceOrg: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  loading: L3;
}

const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const REGION_FIELD: PhField = { prop: "region_name", label: l3("區域", "Region", "地方") };
const SOURCE_MAP: Record<string, L3> = {
  official: l3("官方名冊", "Official register", "公式名簿"),
  osm: l3("OSM 補缺", "OSM gap-fill", "OSM 補完"),
};

// ───────────── 機場與港口（C014） ─────────────
const AIRPORT_COLOR = "#f472b6";
const PORT_COLOR = "#38bdf8";
/** OSM 補缺用淡色＋較小點（與官方名冊分開一項） */
const hubsCat: PhCatGetter = {
  expr: ["case", ["==", ["get", "source"], "osm"], ["case", ["==", ["get", "kind"], "airport"], "osm_airport", "osm_port"], ["to-string", ["coalesce", ["get", "class"], ""]]],
  js: (p) => (str(p.source) === "osm" ? (str(p.kind) === "airport" ? "osm_airport" : "osm_port") : str(p.class)),
};
const HUB_CATS: readonly PhCat[] = [
  { id: "intl", values: ["International Airport"], color: AIRPORT_COLOR, radius: 6.5, label: l3("國際機場（DOTr）", "International airport (DOTr)", "国際空港（DOTr）") },
  { id: "class1", values: ["Principal Airport - Class 1"], color: AIRPORT_COLOR, radius: 5.5, label: l3("主要機場 Class 1（DOTr）", "Principal airport, Class 1 (DOTr)", "主要空港 Class 1（DOTr）") },
  { id: "class2", values: ["Principal Airport - Class 2"], color: AIRPORT_COLOR, radius: 4.5, label: l3("主要機場 Class 2（DOTr）", "Principal airport, Class 2 (DOTr)", "主要空港 Class 2（DOTr）") },
  { id: "community", values: ["Community Airport"], color: AIRPORT_COLOR, radius: 3.5, label: l3("社區機場（DOTr）", "Community airport (DOTr)", "コミュニティ空港（DOTr）") },
  { id: "ppa_port", values: ["PPA port"], color: PORT_COLOR, radius: 4.5, label: l3("港口（PPA）", "Port (PPA)", "港（PPA）") },
  { id: "pmo", values: ["PPA Port Management Office"], color: "#a78bfa", radius: 4.5, label: l3("PPA 港務管理處", "PPA Port Management Office", "PPA 港湾管理事務所") },
  { id: "osm_airport", values: ["osm_airport"], color: "#fbcfe8", radius: 3, label: l3("OSM 補缺：機場、跑道", "OSM gap-fill: aerodromes", "OSM 補完：空港・飛行場") },
  { id: "osm_port", values: ["osm_port"], color: "#bae6fd", radius: 3, label: l3("OSM 補缺：港口、碼頭", "OSM gap-fill: ports", "OSM 補完：港") },
];
/** 卡拉延群島的 Rancudo Airfield（Pag-asa，114.28E 11.05N）不畫，與行政界一致。 */
export const PH_KIG_EXCLUDED_SRC_IDS = ["osm:relation/12651735"] as const;

// ───────────── 車站與渡輪碼頭（C010） ─────────────
/**
 * 未通車車站（PM 2026-11-14 確認：第 1 波把它們畫成車站是錯誤）。來源：taipei-gis-analytics #390＋#391
 * `docs/topic-research/philippines_opendata/waves/w02/ph_stations_not_open_src_ids.csv`，37 站：
 * Metro Manila Subway 預定站 15、MRT-7 10、NSCR 北段 10（Valenzuela–San Fernando）、North Triangle Common Station 1、DOST AGT 試驗站 1。
 * ⚠️ 暫時性前端 filter：analytics 重切的 `ph_stations_v2.pmtiles`（已排除這 37 站）上線（換檔、改 lock）後，本常數可以拿掉。
 */
export const PH_STATIONS_NOT_OPEN_SRC_IDS = [
  "osm:node/10542991478", "osm:node/12752311664", "osm:node/13478815689", "osm:node/13478815690", "osm:node/13564626500", "osm:node/13564639203",
  "osm:node/13564783062", "osm:node/13564783063", "osm:node/13564783064", "osm:node/13565942041", "osm:node/13565942044", "osm:node/13565942045",
  "osm:node/13571995040", "osm:node/13571995042", "osm:node/13571995044", "osm:node/13571995050", "osm:node/13571995052", "osm:node/13571995054",
  "osm:node/13571995056", "osm:node/13571995058", "osm:node/13571995062", "osm:node/13686694948", "osm:node/5285111766", "osm:node/5525578965",
  "osm:node/5728168799", "osm:node/6313750523", "osm:way/1109949377", "osm:way/1488753262", "osm:way/1521984289", "osm:way/564479403",
  "osm:way/801909044", "osm:way/801909052", "osm:way/802086678", "osm:way/802086682", "osm:way/802086688", "osm:way/802086692",
  "osm:way/992204947",
] as const;
const stationsCat: PhCatGetter = {
  expr: ["concat", ["to-string", ["coalesce", ["get", "kind"], ""]], ":", ["to-string", ["coalesce", ["get", "source"], ""]]],
  js: (p) => `${str(p.kind)}:${str(p.source)}`,
};
const STATION_CATS: readonly PhCat[] = [
  { id: "rail_official", values: ["rail_station:official"], color: "#f59e0b", label: l3("鐵路站（官方 PNR）", "Railway station (official, PNR)", "鉄道駅（公式・PNR）") },
  { id: "rail_osm", values: ["rail_station:osm"], color: "#fde68a", label: l3("鐵路站（OSM 補缺：LRT、MRT 等）", "Railway station (OSM gap-fill: LRT, MRT…)", "鉄道駅（OSM 補完：LRT・MRT など）") },
  { id: "ferry_osm", values: ["ferry_terminal:osm"], color: "#7dd3fc", label: l3("渡輪碼頭（OSM 補缺）", "Ferry terminal (OSM gap-fill)", "フェリーターミナル（OSM 補完）") },
];

// ───────────── 主要道路與鐵道（C013） ─────────────
const ROAD_CATS: readonly PhCat[] = [
  { id: "motorway", values: ["motorway", "motorway_link"], color: "#ef4444", parts: ["ph-major-roads-line"], label: l3("高速公路（motorway）", "Motorway", "高速道路（motorway）") },
  { id: "trunk", values: ["trunk", "trunk_link"], color: "#f59e0b", parts: ["ph-major-roads-line"], label: l3("幹道（trunk）", "Trunk road", "幹線道路（trunk）") },
  { id: "primary", values: ["primary", "primary_link"], color: "#facc15", parts: ["ph-major-roads-line"], label: l3("主要道路（primary）", "Primary road", "主要道路（primary）") },
  { id: "rail", values: ["rail"], color: "#a78bfa", parts: ["ph-major-rail-line"], label: l3("鐵道", "Railway", "鉄道") },
];

// ───────────── 電廠（C087） ─────────────
const PLANT_CATS: readonly PhCat[] = [
  { id: "coal", values: ["coal"], color: "#F2622E", label: l3("燃煤", "Coal", "石炭") },
  { id: "gas", values: ["gas"], color: "#F2D64B", label: l3("燃氣", "Gas", "ガス") },
  { id: "oil", values: ["oil"], color: "#A8502A", label: l3("燃油", "Oil", "石油") },
  { id: "geothermal", values: ["geothermal"], color: "#8C5D42", label: l3("地熱", "Geothermal", "地熱") },
  { id: "hydro", values: ["hydro"], color: "#3C92A6", label: l3("水力", "Hydro", "水力") },
  { id: "bioenergy", values: ["bioenergy"], color: "#8C7C4A", label: l3("生質能", "Bioenergy", "バイオエネルギー") },
  { id: "solar", values: ["solar"], color: "#F2E085", label: l3("太陽光電", "Solar", "太陽光") },
  { id: "wind", values: ["wind"], color: "#2F5A99", label: l3("風力", "Wind", "風力") },
  { id: "nuclear", values: ["nuclear"], color: "#d100ff", label: l3("核能（規劃、未運轉）", "Nuclear (proposed, not operating)", "原子力（計画のみ・未運転）") },
];
/** GEM 狀態；預設只開運轉中與興建中（使用者決定），其餘放篩選。順序＝多選 bitmask。 */
export const PH_PLANT_STATUSES = [
  { id: "operating", label: l3("運轉中", "Operating", "運転中") },
  { id: "construction", label: l3("興建中", "Under construction", "建設中") },
  { id: "planned", label: l3("規劃中", "Planned", "計画中") },
  { id: "shelved", label: l3("擱置", "Shelved", "保留") },
  { id: "cancelled", label: l3("取消", "Cancelled", "中止") },
  { id: "retired", label: l3("退役", "Retired", "廃止") },
] as const;
export const PH_PLANT_STATUS_DEFAULT = ["operating", "construction"] as const;
export const PH_CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 3, label: "<10" }, { min: 10, radius: 4.5, label: "10–100" }, { min: 100, radius: 7, label: "100–1,000" }, { min: 1000, radius: 11, label: "≥1,000" }],
};

// ───────────── 電網（C088） ─────────────
const KV_CATS: readonly PhCat[] = [
  { id: "kv500", values: ["500kV+"], color: "#1AB6D9", label: l3("500 kV 以上", "500 kV and above", "500 kV 以上") },
  { id: "kv230", values: ["230kV"], color: "#62D9AD", label: l3("230 kV", "230 kV", "230 kV") },
  { id: "kv115", values: ["115-138kV"], color: "#c084fc", label: l3("115–138 kV", "115–138 kV", "115–138 kV") },
  { id: "kv69", values: ["69kV"], color: "#468BA6", label: l3("69 kV", "69 kV", "69 kV") },
  { id: "kvlt69", values: ["<69kV"], color: "#7c8a99", label: l3("69 kV 以下（配電）", "Below 69 kV (distribution)", "69 kV 未満（配電）") },
  { id: "unknown", values: ["unknown"], color: "#DFE0DC", label: l3("電壓未知", "Voltage unknown", "電圧不明") },
];
const KV_WIDTH: Record<string, readonly [number, number]> = { "500kV+": [2, 3.5], "230kV": [1.5, 2.8], "115-138kV": [1, 2], "69kV": [0.8, 1.5], "<69kV": [0.5, 1], unknown: [0.5, 1] };

// ───────────── 再生能源補助點、微電網（C090） ─────────────
const renewablesCat: PhCatGetter = {
  expr: ["case",
    ["==", ["get", "kind"], "pvm_shs"], "pvm_shs",
    ["==", ["get", "technology"], "Hybrid (Solar,Diesel)"], "mg_hybrid",
    ["==", ["get", "technology"], "Diesel"], "mg_diesel",
    ["in", "Hydro", ["to-string", ["coalesce", ["get", "technology"], ""]]], "mg_hydro",
    ["in", "Solar", ["to-string", ["coalesce", ["get", "technology"], ""]]], "mg_solar",
    "mg_other"],
  js: (p) => {
    if (str(p.kind) === "pvm_shs") return "pvm_shs";
    const t = str(p.technology);
    if (t === "Hybrid (Solar,Diesel)") return "mg_hybrid";
    if (t === "Diesel") return "mg_diesel";
    if (t.includes("Hydro")) return "mg_hydro";
    if (t.includes("Solar")) return "mg_solar";
    return "mg_other";
  },
};
const RENEWABLE_CATS: readonly PhCat[] = [
  { id: "pvm_shs", values: ["pvm_shs"], color: "#facc15", label: l3("家用太陽能系統補助點（PVM）", "Solar home system subsidy site (PVM)", "家庭用太陽光システム補助地点（PVM）") },
  { id: "mg_solar", values: ["mg_solar"], color: "#f59e0b", label: l3("微電網：太陽能", "Microgrid: solar", "マイクログリッド：太陽光") },
  { id: "mg_hybrid", values: ["mg_hybrid"], color: "#fb7185", label: l3("微電網：太陽能＋柴油混合", "Microgrid: solar + diesel hybrid", "マイクログリッド：太陽光＋ディーゼル") },
  { id: "mg_diesel", values: ["mg_diesel"], color: "#a8a29e", label: l3("微電網：柴油", "Microgrid: diesel", "マイクログリッド：ディーゼル") },
  { id: "mg_hydro", values: ["mg_hydro"], color: "#38bdf8", label: l3("微電網：水力（微型、小型）", "Microgrid: hydro (micro, mini, pico)", "マイクログリッド：水力（小規模）") },
  { id: "mg_other", values: ["mg_other"], color: "#a78bfa", label: l3("微電網：其他（風力、生質）", "Microgrid: other (wind, biomass)", "マイクログリッド：その他（風力・バイオマス）") },
];
const SHS_BANDS: PhSizeBands = {
  prop: "shs_units", title: l3("補助點大小：家用太陽能系統套數", "Subsidy site size: solar home systems installed", "補助地点の大きさ：家庭用システム数"),
  bands: [{ min: 0, radius: 3, label: "<25" }, { min: 25, radius: 4.5, label: "25–150" }, { min: 150, radius: 6.5, label: "150–500" }, { min: 500, radius: 9, label: "≥500" }],
};

// ───────────── 加油站（C091） ─────────────
const FUEL_BRAND_CATS: readonly PhCat[] = [
  { id: "petron", values: ["Petron"], color: "#3b82f6", label: l3("Petron", "Petron", "Petron") },
  { id: "shell", values: ["Shell"], color: "#facc15", label: l3("Shell", "Shell", "Shell") },
  { id: "caltex", values: ["Caltex"], color: "#ef4444", label: l3("Caltex", "Caltex", "Caltex") },
  { id: "seaoil", values: ["Seaoil"], color: "#2dd4bf", label: l3("Seaoil", "Seaoil", "Seaoil") },
  { id: "phoenix", values: ["Phoenix"], color: "#f97316", label: l3("Phoenix", "Phoenix", "Phoenix") },
  { id: "flying_v", values: ["Flying V"], color: "#a78bfa", label: l3("Flying V", "Flying V", "Flying V") },
  { id: "total", values: ["TotalEnergies"], color: "#f472b6", label: l3("TotalEnergies", "TotalEnergies", "TotalEnergies") },
  { id: "ptt", values: ["PTT"], color: "#4ade80", label: l3("PTT", "PTT", "PTT") },
];

// ───────────── 管線與儲槽（C092） ─────────────
const CONTENT_CATS: readonly PhCat[] = [
  { id: "oil_gas", values: ["oil_gas"], color: "#f97316", label: l3("油氣", "Oil & gas", "石油・ガス") },
  { id: "water", values: ["water"], color: "#38bdf8", label: l3("水", "Water", "水") },
  { id: "wastewater", values: ["wastewater"], color: "#a16207", label: l3("污水", "Wastewater", "下水") },
  { id: "geothermal", values: ["geothermal"], color: "#ef4444", label: l3("地熱蒸汽、熱水", "Geothermal steam / hot water", "地熱蒸気・熱水") },
  { id: "other", values: ["other"], color: "#a78bfa", label: l3("其他（水泥、電線等）", "Other (cement, cables…)", "その他（セメント・電線など）") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("未標示內容物", "Contents not tagged", "内容物未記載") },
];
const CONTENT_MAP = Object.fromEntries(CONTENT_CATS.map((c) => [c.id, c.label]));

const OSM_NOTE = l3("OSM 為志願者繪製，完整度未經官方核對", "OSM is volunteer-mapped; completeness not officially verified", "OSM はボランティアによる作図で、網羅性は公式に未確認");

export const PH_DATA_SPECS: readonly PhLayerSpec[] = [
  {
    key: "phTransportHubs", file: "ph_transport_hubs.pmtiles", sourceId: "ph-transport-hubs", srcMinzoom: 4, srcMaxzoom: 14, color: AIRPORT_COLOR, count: 581,
    parts: [{ id: "ph-transport-hubs-circle", sourceLayer: "hubs", geom: "point", minzoom: 4, cat: hubsCat, filter: ["!", ["in", ["get", "src_id"], ["literal", [...PH_KIG_EXCLUDED_SRC_IDS]]]] }],
    cats: HUB_CATS,
    title: { props: ["name", "location"], fallback: l3("機場、港口", "Airport / port", "空港・港"),
      fallbackBy: { prop: "kind", map: { airport: l3("未命名機場", "Unnamed airport", "名称不明の空港"), port: l3("未命名港口", "Unnamed port", "名称不明の港") } } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { airport: l3("機場", "Airport", "空港"), port: l3("港口", "Port", "港"), pmo_office: l3("港務管理處", "Port management office", "港湾管理事務所") } },
      { prop: "class", label: l3("等級（來源原文）", "Class (source)", "等級（出典原文）"), kind: "code" },
      { prop: "location", label: l3("所在地（DOTr）", "Location (DOTr)", "所在地（DOTr）") },
      { prop: "pmo", label: l3("所屬港務管理處（PPA）", "Port Management Office (PPA)", "所属港湾管理事務所（PPA）") },
      { prop: "port_type", label: l3("港口用途（OSM）", "Port use (OSM)", "港の用途（OSM）"), kind: "code" },
      { prop: "operator_type", label: l3("營運者類型（OSM）", "Operator type (OSM)", "運営者の種別（OSM）"), kind: "code" },
      { prop: "source", label: l3("來源", "Source", "出典"), map: SOURCE_MAP },
      { prop: "publisher", label: l3("發布者", "Publisher", "発行者") },
      REGION_FIELD,
    ],
    legendNotes: [
      l3("官方：DOTr 機場 85、PPA 港口 111（Geoportal Philippines WMS）；OSM 補缺 385（淡色小點）", "Official: 85 DOTr airports and 111 PPA ports (Geoportal Philippines WMS); 385 OSM gap-fill points (pale, small)", "公式：DOTr 空港 85・PPA 港 111（Geoportal Philippines WMS）。OSM 補完 385（淡色の小点）"),
      l3("官方機場座標多為城鎮近似位置（例：Clark 偏約 7.5 km），不是跑道位置", "Official airport coordinates are mostly approximate town locations (e.g. Clark is about 7.5 km off), not runway positions", "公式の空港座標は多くが町の概略位置（例：Clark は約 7.5 km ずれる）で滑走路の位置ではない"),
      l3("卡拉延群島的機場不畫", "Airfield in the Kalayaan Island Group not drawn", "カラヤン諸島の飛行場は描画しない"),
    ],
    popupNotes: [{ text: l3("官方座標為城鎮近似位置，可能偏離機場數公里", "Official coordinates are approximate town locations and may be several km from the airport", "公式座標は町の概略位置で、空港から数 km ずれることがある"), when: (p) => str(p.kind) === "airport" && str(p.source) === "official" }],
    sourceOrg: "DOTr（機場）、Philippine Ports Authority（港口）via Geoportal Philippines（NAMRIA）WMS；補缺 © OpenStreetMap contributors（ODbL），via HOT／HDX",
    sourceUrl: "https://www.geoportal.gov.ph/", license: NO_LICENSE_TEXT, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓機場港口載入中", "Loading Philippines airports and ports", "フィリピンの空港・港を読み込み中"),
  },
  {
    key: "phStations", file: "ph_stations.pmtiles", sourceId: "ph-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 525,
    parts: [{ id: "ph-stations-circle", sourceLayer: "stations", geom: "point", minzoom: 4, cat: stationsCat,
      filter: ["!", ["in", ["get", "src_id"], ["literal", [...PH_STATIONS_NOT_OPEN_SRC_IDS]]]] }],
    cats: STATION_CATS,
    title: { props: ["name"], fallback: l3("車站", "Station", "駅"),
      fallbackBy: { prop: "kind", map: { ferry_terminal: l3("未命名渡輪碼頭", "Unnamed ferry terminal", "名称不明のフェリーターミナル"), rail_station: l3("未命名車站", "Unnamed station", "名称不明の駅") } } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { rail_station: l3("鐵路站", "Railway station", "鉄道駅"), ferry_terminal: l3("渡輪碼頭", "Ferry terminal", "フェリーターミナル") } },
      { prop: "line", label: l3("路線", "Line", "路線") },
      { prop: "direction", label: l3("方向", "Direction", "方面"), map: { Southbound: l3("南下", "Southbound", "南行き"), Northbound: l3("北上", "Northbound", "北行き") } },
      { prop: "source", label: l3("來源", "Source", "出典"), map: SOURCE_MAP },
      { prop: "publisher", label: l3("發布者", "Publisher", "発行者") },
      REGION_FIELD,
    ],
    legendNotes: [
      l3("官方：PNR 車站 31（Geoportal WMS）；OSM 補缺：LRT、MRT 等鐵路站 81、渡輪碼頭 413（約一半沒有名稱）", "Official: 31 PNR stations (Geoportal WMS); OSM gap-fill: 81 LRT/MRT and other rail stations, 413 ferry terminals (about half unnamed)", "公式：PNR 駅 31（Geoportal WMS）。OSM 補完：LRT・MRT など鉄道駅 81、フェリーターミナル 413（約半数は名称なし）"),
      l3("尚未通車的 Metro Manila Subway、MRT-7、NSCR 北段預定站與 North Triangle Common Station、DOST 試驗站不畫（37 站）", "Not-yet-open Metro Manila Subway, MRT-7 and NSCR northern-section stations, North Triangle Common Station and the DOST test station are not drawn (37 stations)", "未開業のマニラ首都圏地下鉄・MRT-7・NSCR 北区間の予定駅、North Triangle Common Station、DOST 試験駅は描かない（37 駅）"),
      l3("巴士站不在本層；Tawi-Tawi 以外 17 個 region 有點", "Bus stops not included; points in 17 of 18 regions", "バス停は含まない。18 地方中 17 地方に点がある"),
    ],
    popupNotes: [],
    sourceOrg: "Philippine National Railways via Geoportal Philippines（NAMRIA）WMS；LRT／MRT 車站、渡輪碼頭 © OpenStreetMap contributors（ODbL），via HOT／HDX",
    sourceUrl: "https://www.geoportal.gov.ph/", license: NO_LICENSE_TEXT, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓車站載入中", "Loading Philippines stations", "フィリピンの駅を読み込み中"),
  },
  {
    key: "phMajorRoads", file: "ph_major_roads.pmtiles", sourceId: "ph-major-roads", srcMinzoom: 4, srcMaxzoom: 13, color: "#f59e0b", count: 47_429,
    parts: [
      { id: "ph-major-roads-line", sourceLayer: "roads", geom: "line", minzoom: 4, cat: propGetter("highway"),
        lineWidth: { motorway: [2, 3.5], motorway_link: [1, 2], trunk: [1, 2], trunk_link: [0.5, 1], primary: [0.5, 1], primary_link: [0.5, 1] } },
      { id: "ph-major-rail-line", sourceLayer: "rail", geom: "line", minzoom: 4, cat: propGetter("railway"), lineWidth: { rail: [1, 2] } },
    ],
    cats: ROAD_CATS,
    title: { props: ["name"], fallback: l3("道路", "Road", "道路"), fallbackBy: { prop: "railway", map: { rail: l3("鐵道", "Railway", "鉄道") } } },
    fields: [
      { prop: "highway", label: l3("道路等級（OSM）", "Road class (OSM)", "道路等級（OSM）"), map: {
        motorway: l3("高速公路", "Motorway", "高速道路"), motorway_link: l3("高速公路匝道", "Motorway link", "高速道路ランプ"),
        trunk: l3("幹道", "Trunk", "幹線道路"), trunk_link: l3("幹道連絡道", "Trunk link", "幹線道路連絡路"),
        primary: l3("主要道路", "Primary", "主要道路"), primary_link: l3("主要道路連絡道", "Primary link", "主要道路連絡路") } },
      { prop: "railway", label: l3("類型", "Type", "種別"), map: { rail: l3("鐵道", "Railway", "鉄道") } },
      { prop: "lanes", label: l3("車道數", "Lanes", "車線数"), kind: "code" },
      { prop: "surface", label: l3("鋪面（OSM 原文）", "Surface (OSM tag)", "舗装（OSM 原文）"), kind: "code" },
      { prop: "bridge", label: l3("橋梁（OSM 原文）", "Bridge (OSM tag)", "橋（OSM 原文）"), kind: "code" },
      REGION_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("motorway、trunk、primary 共 46,794 段，匝道與連絡道併入同級；鐵道 635 段（PNR 系統）", "46,794 motorway, trunk and primary segments (links merged into their class); 635 railway segments (PNR network)", "motorway・trunk・primary 計 46,794 区間（ランプ類は同級に統合）。鉄道 635 区間（PNR 系統）"),
      l3("LRT、MRT 路線不在本層（來源分類檔沒有 light_rail／subway）；DPWH 官方高速公路未出圖", "LRT/MRT lines not included (no light_rail/subway in the source extract); official DPWH expressways not mapped", "LRT・MRT の路線は含まない（出典の分類に light_rail／subway がない）。DPWH 公式の高速道路は未収録")],
    popupNotes: [],
    sourceOrg: OSM_HOT, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓主要道路載入中", "Loading Philippines major roads", "フィリピンの主要道路を読み込み中"),
  },
  {
    key: "phPowerPlants", file: "ph_power_plants.pmtiles", sourceId: "ph-power-plants", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2622E", count: 1051,
    parts: [{ id: "ph-power-plants-circle", sourceLayer: "plants", geom: "point", minzoom: 3, cat: propGetter("tech"), size: PH_CAPACITY_BANDS,
      ring: { when: ["==", ["get", "source"], "climate_trace"], js: (p) => str(p.source) === "climate_trace", label: l3("白框：Climate TRACE 補缺（GEM 未收）", "White ring: Climate TRACE gap-fill (not in GEM)", "白枠：Climate TRACE による補完（GEM 未収録）") } }],
    cats: PLANT_CATS,
    sizeLegend: [PH_CAPACITY_BANDS],
    title: { props: ["name"], fallback: l3("電廠", "Power plant", "発電所") },
    fields: [
      { prop: "tech", label: l3("技術", "Technology", "技術"), map: Object.fromEntries(PLANT_CATS.map((c) => [c.id, c.label])) },
      { prop: "fuel", label: l3("燃料／型式（GEM 原文）", "Fuel / type (GEM)", "燃料・形式（GEM 原文）"), kind: "code" },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: Object.fromEntries(PH_PLANT_STATUSES.map((s) => [s.id, s.label])) },
      { prop: "capacity_mw", label: l3("裝置容量（全部機組）", "Capacity (all units)", "設備容量（全ユニット）"), kind: "num", unit: "MW", digits: 1 },
      { prop: "capacity_operating_mw", label: l3("運轉中容量", "Operating capacity", "運転中の容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "ct_capacity_mw", label: l3("Climate TRACE 容量", "Climate TRACE capacity", "Climate TRACE の容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "units", label: l3("機組數", "Units", "ユニット数"), kind: "num" },
      { prop: "start_year", label: l3("啟用年", "Start year", "運転開始年"), kind: "year" },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度"), map: { exact: l3("精確", "Exact", "正確"), approximate: l3("近似", "Approximate", "概略"), unknown: l3("不明", "Unknown", "不明") } },
      { prop: "source", label: l3("來源", "Source", "出典"), map: { gem: l3("Global Energy Monitor", "Global Energy Monitor", "Global Energy Monitor"), climate_trace: l3("Climate TRACE（補缺）", "Climate TRACE (gap-fill)", "Climate TRACE（補完）") } },
      { prop: "license", label: l3("授權（逐筆）", "Licence (per record)", "ライセンス（レコード別）") },
      REGION_FIELD,
    ],
    legendNotes: [
      l3("GEM 1,038 座＋Climate TRACE 補缺 13 座；預設只顯示運轉中與興建中，規劃、擱置、取消、退役在「狀態」篩選", "1,038 GEM plants plus 13 Climate TRACE gap-fill plants; operating and under-construction shown by default, planned, shelved, cancelled and retired available in the status filter", "GEM 1,038 か所＋Climate TRACE 補完 13 か所。既定は運転中と建設中のみ、計画・保留・中止・廃止は「状態」で表示"),
      l3("6 個 TransitionZero 光電機組為 CC BY-NC 4.0（非商業授權），彈窗逐筆標示", "6 TransitionZero solar records are CC BY-NC 4.0 (non-commercial); licence shown per record in the popup", "TransitionZero の太陽光 6 件は CC BY-NC 4.0（非商用）。ポップアップでレコードごとに表示"),
      l3("GEM 位置約 8 成為近似（approximate）", "About 80% of GEM locations are approximate", "GEM の位置は約 8 割が概略（approximate）"),
    ],
    popupNotes: [{ text: l3("本筆為 TransitionZero 資料，CC BY-NC 4.0（非商業授權）", "This record is TransitionZero data, CC BY-NC 4.0 (non-commercial)", "このレコードは TransitionZero のデータで CC BY-NC 4.0（非商用）"), when: (p) => p.commercial_ok === false || str(p.commercial_ok) === "false" }],
    sourceOrg: "Global Energy Monitor（CC BY 4.0）；部分光電 © TransitionZero（CC BY-NC 4.0）；Climate TRACE via HDX（CC BY）",
    sourceUrl: "https://globalenergymonitor.org/projects/", license: "CC BY 4.0（GEM）、CC BY（Climate TRACE）；6 筆 CC BY-NC 4.0（非商業）", fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓電廠載入中", "Loading Philippines power plants", "フィリピンの発電所を読み込み中"),
  },
  {
    key: "phPowerGrid", file: "ph_power_grid.pmtiles", sourceId: "ph-power-grid", srcMinzoom: 4, srcMaxzoom: 14, color: "#62D9AD", count: 6597,
    parts: [
      { id: "ph-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: propGetter("kv_class"), filter: ["!=", ["get", "class"], "cable"], lineWidth: KV_WIDTH },
      { id: "ph-power-cables-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: propGetter("kv_class"), filter: ["==", ["get", "class"], "cable"], lineWidth: KV_WIDTH, dashed: true },
      { id: "ph-power-substations-circle", sourceLayer: "substations", geom: "point", minzoom: 4, cat: propGetter("kv_class") },
    ],
    cats: KV_CATS,
    title: { props: ["name"], fallback: l3("電力設施", "Power facility", "電力設備"),
      fallbackBy: { prop: "class", map: { power_line: l3("輸電線", "Power line", "送電線"), minor_line: l3("配電線", "Minor line", "配電線"), cable: l3("電纜", "Cable", "ケーブル"), substation: l3("變電所", "Substation", "変電所") } } },
    fields: [
      { prop: "class", label: l3("類型", "Type", "種別"), map: { power_line: l3("輸電線（架空）", "Power line (overhead)", "送電線（架空）"), minor_line: l3("配電線", "Minor line", "配電線"), cable: l3("地下／海底電纜", "Underground / submarine cable", "地中・海底ケーブル"), substation: l3("變電所", "Substation", "変電所") } },
      { prop: "kv_class", label: l3("電壓等級", "Voltage class", "電圧区分"), map: Object.fromEntries(KV_CATS.flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "voltage_kv", label: l3("電壓", "Voltage", "電圧"), kind: "num", unit: "kV", digits: 1 },
      { prop: "substation", label: l3("用途（OSM 原文）", "Role (OSM tag)", "用途（OSM 原文）"), kind: "code" },
      { prop: "location", label: l3("設置（OSM 原文）", "Location (OSM tag)", "設置（OSM 原文）"), kind: "code" },
      { prop: "circuits", label: l3("迴路數", "Circuits", "回線数"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      REGION_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("線 5,693 段（輸電 3,499、配電 1,997、電纜 197，虛線＝地下或海底電纜）＋變電所 904；電壓取標籤最大值", "5,693 line segments (3,499 power lines, 1,997 minor lines, 197 cables; dashed = underground or submarine cable) plus 904 substations; voltage is the highest tagged value", "線 5,693 区間（送電 3,499・配電 1,997・ケーブル 197、破線＝地中・海底ケーブル）＋変電所 904。電圧はタグの最大値"),
      l3("電壓未標者歸「電壓未知」（線 933、變電所 396）", "Untagged voltage shown as 'voltage unknown' (933 lines, 396 substations)", "電圧未記載は「電圧不明」（線 933・変電所 396）")],
    popupNotes: [],
    sourceOrg: OSM_OVERTURE, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓電網載入中", "Loading Philippines power grid", "フィリピンの電力網を読み込み中"),
  },
  {
    key: "phRenewables", file: "ph_renewables.pmtiles", sourceId: "ph-renewables", srcMinzoom: 4, srcMaxzoom: 14, color: "#facc15", count: 804,
    parts: [{ id: "ph-renewables-circle", sourceLayer: "renewables", geom: "point", minzoom: 4, cat: renewablesCat, size: SHS_BANDS }],
    cats: RENEWABLE_CATS,
    legendTitleNote: l3("補助安裝地點，非全國光電", "subsidised installations, not all solar in the country", "補助による設置地点で全国の太陽光ではない"),
    sizeLegend: [SHS_BANDS],
    title: { props: ["name", "municipality"], fallback: l3("補助安裝點", "Subsidised installation", "補助設置地点") },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { pvm_shs: l3("家用太陽能系統補助（PVM）", "Solar home system subsidy (PVM)", "家庭用太陽光システム補助（PVM）"), microgrid: l3("微電網", "Microgrid", "マイクログリッド") } },
      { prop: "barangay", label: l3("Barangay", "Barangay", "バランガイ") },
      { prop: "municipality", label: l3("市鎮", "Municipality", "市町") },
      { prop: "province", label: l3("省", "Province", "州") },
      { prop: "shs_units", label: l3("家用系統套數", "Solar home systems", "家庭用システム数"), kind: "num" },
      { prop: "n_records", label: l3("合併筆數", "Records merged", "統合レコード数"), kind: "num" },
      { prop: "fund_source", label: l3("經費來源", "Fund source", "財源") },
      { prop: "gida", label: l3("偏遠弱勢地區（GIDA）", "Geographically isolated area (GIDA)", "遠隔不利地域（GIDA）"), map: { Yes: l3("是", "Yes", "はい"), No: l3("否", "No", "いいえ") } },
      { prop: "location_precision", label: l3("位置精度", "Location precision", "位置精度"), map: { manual: l3("人工定位", "Manually located", "手作業で配置"), municipality: l3("市鎮中心", "Municipality centre", "市町の中心"), province: l3("省中心", "Province centre", "州の中心"), barangay: l3("Barangay 中心", "Barangay centre", "バランガイの中心") } },
      { prop: "technology", label: l3("技術（DOE 原文）", "Technology (DOE)", "技術（DOE 原文）") },
      { prop: "total_kw", label: l3("總容量", "Total capacity", "総容量"), kind: "num", unit: "kW" },
      { prop: "solar_kw", label: l3("太陽能容量", "Solar capacity", "太陽光容量"), kind: "num", unit: "kW" },
      { prop: "diesel_kw", label: l3("柴油容量", "Diesel capacity", "ディーゼル容量"), kind: "num", unit: "kW" },
      { prop: "served_households", label: l3("供電戶數", "Households served", "供給世帯数"), kind: "num" },
      { prop: "status", label: l3("狀態（DOE 原文）", "Status (DOE)", "状態（DOE 原文）") },
      { prop: "grid_connected", label: l3("併網", "Grid connection", "系統連系"), map: { "Off-grid": l3("離網", "Off-grid", "オフグリッド"), "On-grid": l3("併網", "On-grid", "オングリッド") } },
      { prop: "implementing_agency", label: l3("執行機關", "Implementing agency", "実施機関") },
      REGION_FIELD,
    ],
    legendNotes: [
      l3("能源部（DOE）家用太陽能系統補助（PV Mainstreaming）708 處、微電網 96 處；只是政府補助案的安裝地點", "708 Department of Energy solar home system subsidy sites (PV Mainstreaming) and 96 microgrids; only government-subsidised installations", "エネルギー省（DOE）の家庭用太陽光システム補助（PV Mainstreaming）708 か所とマイクログリッド 96 か所。政府補助案件の設置地点のみ"),
      l3("沒有點的省份是未涵蓋，不代表沒有太陽能；補助點涵蓋 13 個 region、微電網 15 個", "Provinces without points are not covered, not without solar; subsidy sites cover 13 regions, microgrids 15", "点のない州は未収録で、太陽光がないという意味ではない。補助地点は 13 地方、マイクログリッドは 15 地方"),
      l3("約 2 成補助點只定位到市鎮中心", "About 20% of subsidy sites are placed at the municipality centre", "補助地点の約 2 割は市町の中心に配置"),
    ],
    popupNotes: [{ text: l3("位置為市鎮或省的中心，不是安裝地點", "Location is the municipality or province centre, not the installation site", "位置は市町または州の中心で、設置地点ではない"), when: (p) => ["municipality", "province"].includes(str(p.location_precision)) }],
    sourceOrg: "Department of Energy（Philippines）Open Data API（PV Mainstreaming installations、microgrids）",
    sourceUrl: "https://www.doe.gov.ph/", license: "DOE 網站頁尾 public domain（無逐資料集條文）", fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓太陽能補助點與微電網載入中", "Loading Philippines solar subsidy sites and microgrids", "フィリピンの太陽光補助地点とマイクログリッドを読み込み中"),
  },
  {
    key: "phFuelStations", file: "ph_fuel_stations.pmtiles", sourceId: "ph-fuel-stations", srcMinzoom: 5, srcMaxzoom: 14, color: "#f59e0b", count: 10_100,
    parts: [{ id: "ph-fuel-stations-circle", sourceLayer: "fuel", geom: "point", minzoom: 5, cat: propGetter("brand") }],
    cats: FUEL_BRAND_CATS,
    otherColor: "#94a3b8",
    otherLabel: l3("其他／未知品牌", "Other / unknown brand", "その他・不明なブランド"),
    heat: { intensity: 0.6 },
    title: { props: ["name", "brand"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド") },
    fields: [
      { prop: "brand", label: l3("品牌（依名稱、品牌標籤歸類）", "Brand (from name / brand tag)", "ブランド（名称・タグから分類）"), map: { other: l3("其他品牌", "Other brand", "その他のブランド"), unknown: l3("未知", "Unknown", "不明") } },
      { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" },
      { prop: "addr_city", label: l3("城市（OSM）", "City (OSM)", "都市（OSM）") },
      REGION_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("amenity=fuel 共 10,100 站；8 個主要品牌各一色，其餘 13 個小品牌與未標品牌併「其他／未知」", "10,100 amenity=fuel stations; 8 major brands coloured, 13 smaller brands and untagged stations grouped as 'other / unknown'", "amenity=fuel 計 10,100 か所。主要 8 ブランドを色分けし、小規模 13 ブランドと未記載は「その他・不明」"),
      l3("拉遠（z10 以下）為熱區", "Heatmap when zoomed out (below z10)", "縮小時（z10 未満）はヒートマップ")],
    popupNotes: [],
    sourceOrg: OSM_HOT, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓加油站載入中", "Loading Philippines fuel stations", "フィリピンのガソリンスタンドを読み込み中"),
  },
  {
    key: "phPipelines", file: "ph_pipelines.pmtiles", sourceId: "ph-pipelines", srcMinzoom: 5, srcMaxzoom: 14, color: "#f97316", count: 3066,
    parts: [
      { id: "ph-pipelines-line", sourceLayer: "pipelines", geom: "line", minzoom: 5, cat: propGetter("content_group") },
      { id: "ph-tanks-circle", sourceLayer: "tanks", geom: "point", minzoom: 5, cat: propGetter("content_group") },
    ],
    cats: CONTENT_CATS,
    title: { props: ["name"], fallback: l3("管線、儲槽", "Pipeline / tank", "パイプライン・タンク"),
      fallbackBy: { prop: "kind", map: { pipeline: l3("管線", "Pipeline", "パイプライン"), storage_tank: l3("儲槽", "Storage tank", "貯蔵タンク") } } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { pipeline: l3("管線", "Pipeline", "パイプライン"), storage_tank: l3("儲槽", "Storage tank", "貯蔵タンク") } },
      { prop: "content_group", label: l3("內容物分類", "Contents group", "内容物の区分"), map: CONTENT_MAP },
      { prop: "substance", label: l3("輸送物質（OSM 原文）", "Substance (OSM tag)", "輸送物（OSM 原文）"), kind: "code" },
      { prop: "content", label: l3("儲存物（OSM 原文）", "Content (OSM tag)", "貯蔵物（OSM 原文）"), kind: "code" },
      { prop: "usage", label: l3("用途（OSM 原文）", "Usage (OSM tag)", "用途（OSM 原文）"), kind: "code" },
      { prop: "diameter", label: l3("管徑（OSM 原文）", "Diameter (OSM tag)", "管径（OSM 原文）"), kind: "code" },
      { prop: "location", label: l3("設置（OSM 原文）", "Location (OSM tag)", "設置（OSM 原文）"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      REGION_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("管線 825 段（水 397、未標示 299、地熱 94、油氣 27）＋儲槽 2,241（面取代表點）；依內容物分類，油氣與水管分開", "825 pipeline segments (397 water, 299 untagged, 94 geothermal, 27 oil & gas) plus 2,241 storage tanks (areas at representative points); grouped by contents, oil & gas separate from water", "パイプライン 825 区間（水 397・未記載 299・地熱 94・石油ガス 27）＋貯蔵タンク 2,241（面は代表点）。内容物で区分し、石油ガスと水道を分ける"),
      l3("不是油氣管線圖：大部分是水管；未標示內容物的另列一類", "Not an oil & gas pipeline map: most are water pipes; untagged contents listed separately", "石油・ガス管の地図ではない：大半は水道管。内容物未記載は別区分")],
    popupNotes: [],
    sourceOrg: OSM_OVERTURE, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: PH_FETCHED_AT,
    loading: l3("菲律賓管線與儲槽載入中", "Loading Philippines pipelines and tanks", "フィリピンのパイプラインとタンクを読み込み中"),
  },
];

export const PH_SPEC_BY_KEY: Readonly<Record<PhDataKey, PhLayerSpec>> = Object.fromEntries(PH_DATA_SPECS.map((s) => [s.key, s])) as Record<PhDataKey, PhLayerSpec>;

/** 多選「其他」選項的固定 id（有 `otherLabel` 的層才有）。 */
export const PH_CAT_OTHER_ID = "other_brand";
/** 類別多選選項 id（宣告順序＝bitmask；有 `otherLabel` 者最後加「其他」）。 */
export const phCatOptionIds = (spec: Pick<PhLayerSpec<string>, "cats" | "otherLabel">): string[] =>
  [...spec.cats.map((c) => c.id), ...(spec.otherLabel ? [PH_CAT_OTHER_ID] : [])];
/** 類別多選選項（zh 標籤；layerParamsSpec 用）。 */
export const phCatOptions = (spec: PhLayerSpec<string>): { value: string; label: string }[] =>
  [...spec.cats.map((c) => ({ value: c.id, label: c.label.zh })), ...(spec.otherLabel ? [{ value: PH_CAT_OTHER_ID, label: spec.otherLabel.zh }] : [])];

/** feature 屬於哪個類別（popup 配色）；不屬於任何已列類別回 undefined。 */
export function phCatOf(spec: PhLayerSpec<string>, props: Record<string, unknown>): PhCat | undefined {
  for (const part of spec.parts) {
    const v = part.cat.js(props);
    const hit = spec.cats.find((c) => (!c.parts || c.parts.includes(part.id)) && c.values.includes(v));
    if (hit) return hit;
  }
  return undefined;
}
