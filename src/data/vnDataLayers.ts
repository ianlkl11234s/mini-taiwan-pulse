/**
 * 越南第 0–1 波（2026-11-13）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。
 * - 行政邊界（C001）與人口（C023）：2025-07 新制 34 省面（縣級已取消；3,321 社只有代碼表、沒有幾何），專用 hook `useVnLayers.ts`。
 * - 其餘 10 層重用菲律賓規格引擎（`PhLayerSpec`＋`usePhDataLayer`）。一個 dataset 一個 key；授權不同的來源分成不同 PMTiles
 *   （ODM／OSM、GEM／OSM），以 `more` 掛第二個檔，host 各畫一次，popup 依 `source` 欄選對應署名。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/data-catalog/<theme>/vn_*.md` 與
 * `docs/topic-research/vietnam_opendata/waves/w01/FRONTEND_SPEC.md`（各 `_manifest.json` 2026-11-13 讀）。
 * 不畫任何海上界線；Hoàng Sa、Trường Sa 兩特區沒有幾何（使用者 2026-11-10）。
 * 官方來源（NSO、envisoft、安江省開放資料）授權未明示：NĐ 47/2020 第 18 條已由 NĐ 194/2025 廢止、NĐ 278/2025 整部取代（未取得官方原文）。
 */
import type { VnDataKey } from "./vnDataKeys";
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhPart, PhSizeBands } from "./phDataLayers";

export type { L3 } from "./phDataLayers";
export { pickL3 } from "./phDataLayers";

type Expr = unknown[];
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export const VN_FETCHED_AT = "2026-11-13";
const ODBL = "ODbL 1.0";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const OSM_GEOFABRIK = "© OpenStreetMap contributors（ODbL），via Geofabrik vietnam-latest.osm.pbf";
const GEM_URL = "https://globalenergymonitor.org/projects/";
/** 官方來源授權未明示（使用者 2026-11-13：照常上線、commercial_ok null）。 */
export const VN_LAW_NOTE = l3(
  "越南政府開放資料原依 NĐ 47/2020 第 18 條署名使用；該條已由 NĐ 194/2025 廢止、NĐ 278/2025 整部取代（未取得官方原文），本層以「授權未明示」標示",
  "Vietnamese government open data was formerly usable with attribution under Decree 47/2020 Art. 18; that article was repealed by Decree 194/2025 and the decree replaced by Decree 278/2025 (official text not obtained), so this layer is marked 'licence not stated'",
  "ベトナム政府オープンデータは旧来 Decree 47/2020 第 18 条で出典表示により利用できたが、同条は Decree 194/2025 で廃止、Decree 278/2025 で全面置換（公式原文未入手）。本レイヤーは「ライセンス未明示」と表示",
);
/** 邊界立場聲明（使用者 2026-11-13）。 */
export const VN_BOUNDARY_NOTE = l3("邊界依 OCHA 資料，不代表任何立場；不畫海上界線，Hoàng Sa、Trường Sa 不畫", "Boundaries follow OCHA data and imply no position; no maritime lines; Hoàng Sa and Trường Sa not drawn", "境界は OCHA データに基づき、いかなる立場も示さない。海上の境界線と Hoàng Sa・Trường Sa は描画しない");

// ═════════════════════════ 行政邊界、人口（34 省） ═════════════════════════

export const VN_ADMIN_COLOR = "#9ca3af";
export const VN_ADMIN_SOURCE = {
  org: "OCHA COD-AB Viet Nam v02（CC BY-IGO），via HDX；社代碼 Cục Thống kê（NSO）Danh mục đơn vị hành chính（授權未明示）；Hoàng Sa／Trường Sa 幾何由 taipei-gis-analytics 移除",
  url: "https://data.humdata.org/dataset/cod-ab-vnm",
  license: "CC BY-IGO 3.0（面）；NSO 代碼表授權未明示",
  short: "© OCHA COD-AB Viet Nam v02（HDX，CC BY-IGO）；Cục Thống kê（NSO）授權未明示",
} as const;
export const VN_ADMIN_NOTES: readonly L3[] = [
  l3("2025-07 新制 34 省（6 個中央直轄市＋28 省；NSO 列 9 個 Thành phố Trung ương），縣級已取消", "34 provinces under the July 2025 reform (NSO lists 9 centrally-run cities); the district level was abolished", "2025 年 7 月新制の 34 省（NSO は中央直轄市 9 を列挙）。県級は廃止"),
  l3("3,321 個社只有代碼表、沒有可下載的社界，故只畫到省", "The 3,321 communes have codes only, no downloadable boundaries, so only provinces are drawn", "3,321 の社はコード表のみで境界データがなく、省まで描画"),
  l3("依 NĐ 194/2025、NĐ 278/2025 現況（未取得官方原文）", "Per Decrees 194/2025 and 278/2025 as currently reported (official text not obtained)", "Decree 194/2025・278/2025 による現況（公式原文未入手）"),
  VN_BOUNDARY_NOTE,
];

/** 人口密度（人／km²）5 級斷點（FRONTEND_SPEC §4）。34 省 55–2,636。 */
export const VN_DENSITY_BREAKS = [100, 300, 600, 1500] as const;
export const VN_DENSITY_LABELS = ["<100", "100–300", "300–600", "600–1,500", "≥1,500"] as const;
export const VN_NOT_COVERED_COLOR = "#6b7280";
export const VN_POP_YEARS = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
export const VN_POPULATION_SOURCE = {
  org: "Nguồn: Cục Thống kê（NSO）PL.V02.01（2025，34 省）、V02.01（2011–2024 舊 63 省加總）；邊界 OCHA COD-AB Viet Nam v02（CC BY-IGO）",
  url: "https://www.nso.gov.vn/",
  license: "Cục Thống kê（NSO）授權未明示",
  short: "Nguồn: Cục Thống kê（NSO），授權未明示",
} as const;
export const VN_POPULATION_NOTES: readonly L3[] = [
  l3("2025 年平均人口；密度為 NSO 公布值", "2025 average population; density as published by NSO", "2025 年平均人口。密度は NSO 公表値"),
  l3("2011–2024 由舊 63 省加總成新省；Tiền Giang 舊省整省計入 Đồng Tháp", "2011–2024 summed from the former 63 provinces; former Tiền Giang counted wholly in Đồng Tháp", "2011–2024 は旧 63 省を新省に合算。旧 Tiền Giang は全域を Đồng Tháp に計上"),
  VN_BOUNDARY_NOTE,
];

// ═════════════════════════ 規格驅動 10 層 ═════════════════════════

/** 同一層的第二個 PMTiles（授權不同，分檔）：`sourceValue`＝該檔 feature 的 `source` 欄值（popup 依此選署名）。 */
export interface VnMoreFile {
  file: string;
  sourceId: string;
  srcMinzoom: number;
  srcMaxzoom: number;
  parts: readonly PhPart[];
  sourceValue: string;
  sourceOrg: string;
  sourceUrl: string;
  license: string;
}
export interface VnLayerSpec extends PhLayerSpec<VnDataKey> {
  more?: VnMoreFile;
  /** GEM 狀態多選（電廠、風光、油氣）；預設值見 `statusDefault` */
  statusDefault?: readonly string[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const PROVINCE_FIELD: PhField = { prop: "province_name", label: l3("省（34 省新制）", "Province (2025)", "省（2025 新制）") };
const OFFSHORE_NOTE: PhNote = { text: l3("離岸／海上設施，不屬於任何省", "Offshore facility, not within any province", "洋上施設でどの省にも属さない"), when: (p) => str(p.province_method) === "offshore" };
const NEAREST_NOTE: PhNote = { text: l3("點落在省界外（岸邊、河道），省份取最近的省", "Point lies outside province polygons (shore, river); nearest province used", "点が省界の外（海岸・河道）にあり、最寄りの省を採用"), when: (p) => str(p.province_method) === "nearest" };
const OSM_NOTE = l3("OSM 為志願者繪製，完整度未經官方核對", "OSM is volunteer-mapped; completeness not officially verified", "OSM はボランティアによる作図で、網羅性は公式に未確認");
const COVERAGE_NOTE = (n: number) => l3(`有點的省 ${n}／34；沒有點的省是未涵蓋，不代表沒有`, `Points in ${n} of 34 provinces; provinces without points are not covered, not empty`, `点がある省は 34 中 ${n}。点のない省は未収録で、存在しないという意味ではない`);

// ───────────── GEM 狀態（電廠、風光、油氣共用；順序＝多選 bitmask） ─────────────
export const VN_STATUSES = [
  { id: "operating", label: l3("運轉中", "Operating", "運転中") },
  { id: "construction", label: l3("興建中", "Under construction", "建設中") },
  { id: "planned", label: l3("規劃中", "Planned", "計画中") },
  { id: "proposed", label: l3("提案", "Proposed", "提案") },
  { id: "shelved", label: l3("擱置", "Shelved", "保留") },
  { id: "mothballed", label: l3("封存", "Mothballed", "休止") },
  { id: "retired", label: l3("退役", "Retired", "廃止") },
  { id: "cancelled", label: l3("取消", "Cancelled", "中止") },
] as const;
const STATUS_MAP = Object.fromEntries(VN_STATUSES.map((s) => [s.id, s.label]));
const STATUS_FIELD: PhField = { prop: "status", label: l3("狀態", "Status", "状態"), map: STATUS_MAP };

// ───────────── 車站（C010） ─────────────
const STATION_CATS: readonly PhCat[] = [
  { id: "rail", values: ["rail"], color: "#f59e0b", radius: 5, label: l3("鐵路車站", "Railway station", "鉄道駅") },
  { id: "metro", values: ["metro"], color: "#a78bfa", radius: 4, label: l3("都市鐵路（捷運）站", "Metro station", "都市鉄道（メトロ）駅") },
  { id: "bus", values: ["bus"], color: "#38bdf8", radius: 3, label: l3("公車總站、轉運站", "Bus station / terminal", "バスターミナル") },
];

// ───────────── 機場與港口（C014） ─────────────
const AIRPORT_COLOR = "#f472b6";
const HUB_CATS: readonly PhCat[] = [
  { id: "intl", values: ["International"], color: AIRPORT_COLOR, radius: 6.5, parts: ["vn-airports-circle"], label: l3("國際機場（ODM）", "International airport (ODM)", "国際空港（ODM）") },
  { id: "domestic", values: ["Domestic"], color: AIRPORT_COLOR, radius: 4.5, parts: ["vn-airports-circle"], label: l3("國內機場（ODM）", "Domestic airport (ODM)", "国内空港（ODM）") },
  { id: "seaport", values: ["Seaport"], color: "#38bdf8", radius: 4.5, parts: ["vn-ports-circle"], label: l3("海港（ODM）", "Seaport (ODM)", "海港（ODM）") },
  { id: "inland_port", values: ["Inland port"], color: "#2dd4bf", radius: 4, parts: ["vn-ports-circle"], label: l3("內河港（ODM）", "Inland port (ODM)", "内陸港（ODM）") },
  { id: "osm_airport", values: ["osm"], color: "#fbcfe8", radius: 3, parts: ["vn-airports-osm-circle"], label: l3("OSM 補缺：機場（2019 後新機場、軍用、停用等）", "OSM gap-fill: aerodromes (post-2019, military, disused…)", "OSM 補完：空港（2019 年以降の新空港・軍用・廃止など）") },
];

// ───────────── 主要道路與鐵道（C013） ─────────────
const ROAD_CATS: readonly PhCat[] = [
  { id: "motorway", values: ["motorway"], color: "#ef4444", parts: ["vn-major-roads-line"], label: l3("高速公路（motorway）", "Motorway", "高速道路（motorway）") },
  { id: "trunk", values: ["trunk"], color: "#f59e0b", parts: ["vn-major-roads-line"], label: l3("幹道（trunk）", "Trunk road", "幹線道路（trunk）") },
  { id: "primary", values: ["primary"], color: "#facc15", parts: ["vn-major-roads-line"], label: l3("主要道路（primary）", "Primary road", "主要道路（primary）") },
  { id: "rail", values: ["operating"], color: "#a78bfa", parts: ["vn-major-rail-line"], label: l3("鐵道（營運中）", "Railway (operating)", "鉄道（営業中）") },
  { id: "rail_construction", values: ["construction"], color: "#c4b5fd", parts: ["vn-major-rail-construction-line"], label: l3("鐵道（興建中，虛線）", "Railway (under construction, dashed)", "鉄道（建設中、破線）") },
];
const RAIL_TYPE_MAP: Record<string, L3> = {
  rail: l3("一般鐵路", "Railway", "鉄道"), narrow_gauge: l3("窄軌", "Narrow gauge", "狭軌"), subway: l3("地鐵", "Metro", "地下鉄"),
  light_rail: l3("輕軌", "Light rail", "ライトレール"), monorail: l3("單軌", "Monorail", "モノレール"),
};

// ───────────── 電廠（C087） ─────────────
const PLANT_CATS: readonly PhCat[] = [
  { id: "coal", values: ["coal"], color: "#F2622E", label: l3("燃煤", "Coal", "石炭") },
  { id: "gas", values: ["gas"], color: "#F2D64B", label: l3("燃氣", "Gas", "ガス") },
  { id: "oil", values: ["oil"], color: "#A8502A", label: l3("燃油", "Oil", "石油") },
  { id: "hydro", values: ["hydro"], color: "#3C92A6", label: l3("水力", "Hydro", "水力") },
  { id: "bioenergy", values: ["bioenergy"], color: "#8C7C4A", label: l3("生質能", "Bioenergy", "バイオエネルギー") },
  { id: "geothermal", values: ["geothermal"], color: "#8C5D42", label: l3("地熱", "Geothermal", "地熱") },
  { id: "nuclear", values: ["nuclear"], color: "#d100ff", label: l3("核能（規劃）", "Nuclear (planned)", "原子力（計画）") },
];
export const VN_CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 3, label: "<10" }, { min: 10, radius: 4.5, label: "10–100" }, { min: 100, radius: 7, label: "100–1,000" }, { min: 1000, radius: 11, label: "≥1,000" }],
};
const GEM_PLANT_FIELDS: readonly PhField[] = [
  { prop: "name_local", label: l3("越南文名稱", "Vietnamese name", "ベトナム語名") },
  STATUS_FIELD,
  { prop: "capacity_mw", label: l3("裝置容量（該狀態機組）", "Capacity (units in this status)", "設備容量（この状態のユニット）"), kind: "num", unit: "MW", digits: 1 },
  { prop: "capacity_all_mw", label: l3("裝置容量（全部機組）", "Capacity (all units)", "設備容量（全ユニット）"), kind: "num", unit: "MW", digits: 1 },
  { prop: "units", label: l3("機組／分期數", "Units / phases", "ユニット・期数"), kind: "num" },
  { prop: "start_year", label: l3("啟用年", "Start year", "運転開始年"), kind: "year" },
  { prop: "owner", label: l3("所有者", "Owner", "所有者") },
  { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度"), map: { exact: l3("精確", "Exact", "正確"), approximate: l3("近似", "Approximate", "概略") } },
  { prop: "license", label: l3("授權（逐筆）", "Licence (per record)", "ライセンス（レコード別）") },
  PROVINCE_FIELD,
];

// ───────────── 再生能源（C090） ─────────────
const RENEWABLE_CATS: readonly PhCat[] = [
  { id: "wind", values: ["wind"], color: "#2F5A99", parts: ["vn-renewables-wind-solar-circle"], label: l3("風力（GEM）", "Wind (GEM)", "風力（GEM）") },
  { id: "solar", values: ["solar"], color: "#F2E085", parts: ["vn-renewables-wind-solar-circle"], label: l3("太陽光電（GEM）", "Solar (GEM)", "太陽光（GEM）") },
  { id: "solar_tz", values: ["solar"], color: "#f59e0b", parts: ["vn-renewables-solar-tz-circle"], label: l3("太陽光電（TransitionZero，CC BY-NC 4.0，非商用）", "Solar (TransitionZero, CC BY-NC 4.0, non-commercial)", "太陽光（TransitionZero、CC BY-NC 4.0、非商用）") },
  { id: "charging", values: ["osm"], color: "#4ade80", parts: ["vn-charging-circle"], label: l3("電動車充電站（OSM 補缺）", "EV charging station (OSM gap-fill)", "EV 充電スタンド（OSM 補完）") },
];

// ───────────── 電網（C088） ─────────────
const KV_CATS: readonly PhCat[] = [
  { id: "kv500", values: [">=500"], color: "#1AB6D9", label: l3("500 kV 以上", "500 kV and above", "500 kV 以上") },
  { id: "kv220", values: ["220-499"], color: "#62D9AD", label: l3("220–499 kV", "220–499 kV", "220–499 kV") },
  { id: "kv110", values: ["110-219"], color: "#c084fc", label: l3("110–219 kV", "110–219 kV", "110–219 kV") },
  // 110 kV 以下用 C-5 類別色的琥珀（與青、綠、紫三級分得開）；未標電壓用 C-5 中性灰（不是一個電壓等級）
  { id: "kvlt110", values: ["<110"], color: "#ffa41b", label: l3("110 kV 以下", "Below 110 kV", "110 kV 未満") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("電壓未標", "Voltage not tagged", "電圧未記載") },
];
const KV_WIDTH: Record<string, readonly [number, number]> = { ">=500": [2, 3.5], "220-499": [1.5, 2.8], "110-219": [1, 2], "<110": [0.5, 1], unknown: [0.5, 1] };

// ───────────── 加油站（C091） ─────────────
const FUEL_CATS: readonly PhCat[] = [
  { id: "petrolimex", values: ["Petrolimex"], color: "#3b82f6", label: l3("Petrolimex", "Petrolimex", "Petrolimex") },
  { id: "pvoil", values: ["PVOIL"], color: "#ef4444", label: l3("PVOIL", "PVOIL", "PVOIL") },
  { id: "mipec", values: ["Mipec"], color: "#facc15", label: l3("Mipec", "Mipec", "Mipec") },
  { id: "saigon_petro", values: ["Saigon Petro"], color: "#2dd4bf", label: l3("Saigon Petro", "Saigon Petro", "Saigon Petro") },
  { id: "unknown", values: ["unknown"], color: "#64748b", label: l3("品牌未知", "Brand unknown", "ブランド不明") },
];

// ───────────── 油氣（C092） ─────────────
const OIL_GAS_CATS: readonly PhCat[] = [
  { id: "lng", values: ["gem"], color: "#38bdf8", radius: 5, parts: ["vn-lng-terminals-circle"], label: l3("LNG 接收站（GEM）", "LNG terminal (GEM)", "LNG 受入基地（GEM）") },
  { id: "coal_terminal", values: ["gem"], color: "#78716c", radius: 5, parts: ["vn-coal-terminals-circle"], label: l3("煤炭碼頭（GEM）", "Coal terminal (GEM)", "石炭ターミナル（GEM）") },
  { id: "gas_pipeline", values: ["gas"], color: "#f97316", parts: ["vn-pipelines-gem-line"], label: l3("天然氣管線（GEM）", "Gas pipeline (GEM)", "ガスパイプライン（GEM）") },
  { id: "oil_pipeline", values: ["oil"], color: "#a16207", parts: ["vn-pipelines-gem-line"], label: l3("油管（GEM）", "Oil pipeline (GEM)", "石油パイプライン（GEM）") },
  { id: "refinery", values: ["refinery"], color: "#ef4444", radius: 6, parts: ["vn-refineries-circle"], label: l3("煉油廠（OSM）", "Refinery (OSM)", "製油所（OSM）") },
  { id: "tank", values: ["storage_tank"], color: "#fb923c", parts: ["vn-tanks-circle"], label: l3("油氣儲槽（OSM）", "Oil / gas storage tank (OSM)", "石油・ガス貯蔵タンク（OSM）") },
  { id: "osm_pipeline", values: ["osm"], color: "#fdba74", parts: ["vn-pipelines-osm-line"], label: l3("天然氣管線（OSM）", "Gas pipeline (OSM)", "ガスパイプライン（OSM）") },
];

// ───────────── envisoft 環境監測站（C098／C100／C101／C104／C033） ─────────────
export const VN_ENVISOFT_NOTE = l3("來源 envisoft.gov.vn，授權未明示", "Source envisoft.gov.vn, licence not stated", "出典 envisoft.gov.vn、ライセンス未明示");
const ENVISOFT_CATS: readonly PhCat[] = [
  { id: "air", values: ["air"], color: "#a78bfa", radius: 4.5, label: l3("空氣品質（KK，C098）", "Air quality (KK, C098)", "大気質（KK、C098）") },
  { id: "surface_water", values: ["surface_water"], color: "#38bdf8", radius: 4.5, label: l3("地面水質（NM，C100）", "Surface water quality (NM, C100)", "地表水質（NM、C100）") },
  { id: "sea_water", values: ["sea_water"], color: "#2dd4bf", radius: 4.5, label: l3("海水水質（NB，C100／C104）", "Sea water quality (NB, C100/C104)", "海水水質（NB、C100／C104）") },
  { id: "wastewater", values: ["wastewater_discharge"], color: "#a16207", radius: 3, label: l3("廢水排放口（NT，C033）", "Wastewater discharge (NT, C033)", "排水口（NT、C033）") },
  { id: "stack", values: ["stack_emission"], color: "#f97316", radius: 3, label: l3("煙道廢氣排放（KT，C101／C033）", "Stack emission (KT, C101/C033)", "煙突排ガス（KT、C101／C033）") },
];
const ENVISOFT_TYPE_MAP = Object.fromEntries([...ENVISOFT_CATS.map((c) => [c.values[0]!, c.label]), ["low_cost_sensor", l3("低成本感測器", "Low-cost sensor", "低コストセンサー")], ["unknown", l3("類型未知", "Type unknown", "種別不明")]]);

// ───────────── 安江示範（C034／C078） ─────────────
export const VN_ANGIANG_NOTE = l3("只涵蓋安江省（原堅江範圍）；其他 33 省是未涵蓋，不是沒有", "Covers An Giang province only (former Kiên Giang area); the other 33 provinces are not covered, not empty", "An Giang 省（旧 Kiên Giang の範囲）のみ。他の 33 省は未収録で、存在しないわけではない");
const ANGIANG_STATUS: Record<string, L3> = {
  chuaxd: l3("尚未興建", "Not yet built", "未着工"), dangxd: l3("興建中", "Under construction", "建設中"), hoatdong: l3("已營運", "Operating", "稼働中"),
};
const ANGIANG_CATS: readonly PhCat[] = [
  { id: "hoatdong", values: ["hoatdong"], color: "#f97316", parts: ["vn-angiang-clusters-fill", "vn-angiang-clusters-outline"], label: l3("工業群：已營運", "Industrial cluster: operating", "工業団地：稼働中") },
  { id: "dangxd", values: ["dangxd"], color: "#facc15", parts: ["vn-angiang-clusters-fill", "vn-angiang-clusters-outline"], label: l3("工業群：興建中", "Industrial cluster: under construction", "工業団地：建設中") },
  { id: "chuaxd", values: ["chuaxd"], color: "#94a3b8", parts: ["vn-angiang-clusters-fill", "vn-angiang-clusters-outline"], label: l3("工業群：尚未興建", "Industrial cluster: not yet built", "工業団地：未着工") },
  { id: "flood", values: ["angiang_opendata"], color: "#38bdf8", parts: ["vn-angiang-flood-circle"], label: l3("避洪居民點", "Flood resettlement site", "洪水避難居住地") },
];

export const VN_DATA_SPECS: readonly VnLayerSpec[] = [
  {
    key: "vnStations", file: "vn_stations.pmtiles", sourceId: "vn-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 989,
    parts: [{ id: "vn-stations-circle", sourceLayer: "stations", geom: "point", minzoom: 4, cat: propGetter("kind") }],
    cats: STATION_CATS,
    title: { props: ["name", "name_en"], fallback: l3("車站", "Station", "駅") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名") },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: Object.fromEntries(STATION_CATS.map((c) => [c.id, c.label])) },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      PROVINCE_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("OSM 補缺，官方無全國站名冊：鐵路站 293、捷運站 166、公車總站 530", "OSM gap-fill; no official national register: 293 railway, 166 metro, 530 bus stations", "OSM 補完。公式の全国駅名簿はない：鉄道駅 293・メトロ駅 166・バスターミナル 530"),
      l3("鐵路站涵蓋 23 省、捷運站 5 省（河內、胡志明市等）", "Railway stations in 23 provinces, metro stations in 5 (Hà Nội, Hồ Chí Minh…)", "鉄道駅は 23 省、メトロ駅は 5 省（ハノイ・ホーチミン市など）")],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: VN_FETCHED_AT,
    loading: l3("越南車站載入中", "Loading Vietnam stations", "ベトナムの駅を読み込み中"),
  },
  {
    key: "vnTransportHubs", file: "vn_transport_hubs_odm.pmtiles", sourceId: "vn-transport-hubs-odm", srcMinzoom: 3, srcMaxzoom: 14, color: AIRPORT_COLOR, count: 98,
    parts: [
      { id: "vn-airports-circle", sourceLayer: "airports", geom: "point", minzoom: 3, cat: propGetter("airport_type") },
      { id: "vn-ports-circle", sourceLayer: "ports", geom: "point", minzoom: 3, cat: propGetter("port_type") },
    ],
    more: {
      file: "vn_transport_hubs_osm.pmtiles", sourceId: "vn-transport-hubs-osm", srcMinzoom: 3, srcMaxzoom: 14, sourceValue: "osm",
      parts: [{ id: "vn-airports-osm-circle", sourceLayer: "airports_osm", geom: "point", minzoom: 3, cat: propGetter("source") }],
      sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL,
    },
    cats: HUB_CATS,
    title: { props: ["name"], fallback: l3("機場、港口", "Airport / port", "空港・港") },
    fields: [
      { prop: "city", label: l3("城市", "City", "都市") },
      { prop: "iata", label: l3("IATA", "IATA", "IATA"), kind: "code" },
      { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
      { prop: "airport_type", label: l3("機場類型", "Airport type", "空港の種別"), map: { International: l3("國際", "International", "国際"), Domestic: l3("國內", "Domestic", "国内") } },
      { prop: "runway_m", label: l3("跑道長度", "Runway length", "滑走路長"), kind: "num", unit: "m" },
      { prop: "port_type", label: l3("港口類型", "Port type", "港の種別"), map: { Seaport: l3("海港", "Seaport", "海港"), "Inland port": l3("內河港", "Inland port", "内陸港") } },
      { prop: "data_year", label: l3("資料年", "Data year", "データ年"), kind: "year" },
      { prop: "nearest_odm_airport_km", label: l3("距最近 ODM 機場", "Distance to nearest ODM airport", "最寄りの ODM 空港まで"), kind: "num", unit: "km", digits: 1 },
      { prop: "license", label: l3("授權（逐筆）", "Licence (per record)", "ライセンス（レコード別）") },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("Open Development Vietnam 彙編，原始機關未載明，2019（機場 25）／2021（港口 54）", "Compiled by Open Development Vietnam, original agency not stated; 2019 (25 airports) / 2021 (54 ports)", "Open Development Vietnam 編集、原機関未記載。2019（空港 25）／2021（港 54）"),
      l3("ODM 授權 CC BY-SA 4.0，但 copyright 標「To be determined」，以授權未明示處理", "ODM licence CC BY-SA 4.0, but copyright is 'To be determined', treated as licence not stated", "ODM のライセンスは CC BY-SA 4.0 だが copyright が「To be determined」のため、ライセンス未明示として扱う"),
      l3("OSM 補缺 19 處（2019 後新機場、軍用、停用機場等），淡色小點，ODbL", "19 OSM gap-fill aerodromes (post-2019, military, disused…), pale small points, ODbL", "OSM 補完 19 か所（2019 年以降の新空港・軍用・廃止空港など）、淡色の小点、ODbL"),
      COVERAGE_NOTE(27),
    ],
    popupNotes: [
      { text: l3("ODM 資料為 2019／2021 年版，可能已過時", "ODM data dates from 2019/2021 and may be outdated", "ODM のデータは 2019／2021 年版で古い可能性がある"), when: (p) => str(p.source) === "odm" },
      NEAREST_NOTE,
    ],
    sourceOrg: "Open Development Vietnam（ODV）彙編，原始機關未載明（CC BY-SA 4.0，copyright To be determined）",
    sourceUrl: "https://vietnam.opendevelopmentmekong.net/", license: "CC BY-SA 4.0（ODM 標示；copyright 未定，授權未明示）", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南機場港口載入中", "Loading Vietnam airports and ports", "ベトナムの空港・港を読み込み中"),
  },
  {
    key: "vnMajorRoads", file: "vn_major_roads.pmtiles", sourceId: "vn-major-roads", srcMinzoom: 4, srcMaxzoom: 13, color: "#f59e0b", count: 52_272,
    parts: [
      { id: "vn-major-roads-line", sourceLayer: "roads", geom: "line", minzoom: 4, cat: propGetter("road_class"), lineWidth: { motorway: [2, 3.5], trunk: [1, 2], primary: [0.5, 1] } },
      { id: "vn-major-rail-line", sourceLayer: "rail", geom: "line", minzoom: 4, cat: propGetter("status"), filter: ["!=", ["get", "status"], "construction"], lineWidth: { operating: [1, 2] } },
      { id: "vn-major-rail-construction-line", sourceLayer: "rail", geom: "line", minzoom: 4, cat: propGetter("status"), filter: ["==", ["get", "status"], "construction"], lineWidth: { construction: [1, 2] }, dashed: true },
    ],
    cats: ROAD_CATS,
    dashLabel: null, // 興建中鐵道已有自己的分類列（虛線色票），不再多一列虛線說明
    title: { props: ["name", "ref", "name_en"], fallback: l3("道路、鐵道", "Road / railway", "道路・鉄道"), fallbackBy: { prop: "rail_type", map: RAIL_TYPE_MAP } },
    fields: [
      { prop: "ref", label: l3("路線編號", "Route number", "路線番号"), kind: "code" },
      { prop: "road_class", label: l3("道路等級（OSM）", "Road class (OSM)", "道路等級（OSM）"), map: { motorway: l3("高速公路", "Motorway", "高速道路"), trunk: l3("幹道", "Trunk", "幹線道路"), primary: l3("主要道路", "Primary", "主要道路") } },
      { prop: "ref_class", label: l3("編號類別", "Route type", "番号の種別"), map: { CT: l3("高速公路（CT）", "Expressway (CT)", "高速道路（CT）"), QL: l3("國道（QL）", "National road (QL)", "国道（QL）"), DT: l3("省道（ĐT）", "Provincial road (ĐT)", "省道（ĐT）"), other: l3("其他", "Other", "その他") } },
      { prop: "rail_type", label: l3("鐵道類型", "Rail type", "鉄道の種別"), map: RAIL_TYPE_MAP },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: { operating: l3("營運中", "Operating", "営業中"), construction: l3("興建中", "Under construction", "建設中") } },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 2 },
      PROVINCE_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("道路 49,830 段（motorway、trunk、primary）、鐵道 2,442 段（興建中 185 段為虛線）", "49,830 road segments (motorway, trunk, primary); 2,442 railway segments (185 under construction, dashed)", "道路 49,830 区間（motorway・trunk・primary）、鉄道 2,442 区間（建設中 185 区間は破線）"),
      l3("道路等級是 OSM 類別，不是法定分級", "Road classes are OSM categories, not the statutory classification", "道路等級は OSM の分類で、法定の区分ではない")],
    popupNotes: [],
    sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: VN_FETCHED_AT,
    loading: l3("越南主要道路載入中", "Loading Vietnam major roads", "ベトナムの主要道路を読み込み中"),
  },
  {
    key: "vnPowerPlants", file: "vn_power_plants.pmtiles", sourceId: "vn-power-plants", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2622E", count: 253,
    parts: [{ id: "vn-power-plants-circle", sourceLayer: "plants", geom: "point", minzoom: 3, cat: propGetter("tech"), size: VN_CAPACITY_BANDS }],
    cats: PLANT_CATS,
    sizeLegend: [VN_CAPACITY_BANDS],
    statusDefault: ["operating", "construction"],
    title: { props: ["name", "name_local"], fallback: l3("電廠", "Power plant", "発電所") },
    fields: [{ prop: "tech", label: l3("技術", "Technology", "技術"), map: Object.fromEntries(PLANT_CATS.map((c) => [c.id, c.label])) },
      { prop: "fuel", label: l3("燃料／型式（GEM 原文）", "Fuel / type (GEM)", "燃料・形式（GEM 原文）"), kind: "code" }, ...GEM_PLANT_FIELDS],
    legendNotes: [
      l3("GEM 253 處（水力 123、燃煤 54、燃氣 45、生質 27 等）；預設只顯示運轉中與興建中，其餘在「狀態」篩選", "253 GEM plants (123 hydro, 54 coal, 45 gas, 27 bioenergy…); operating and under construction shown by default, others in the status filter", "GEM 253 か所（水力 123・石炭 54・ガス 45・バイオ 27 など）。既定は運転中と建設中、その他は「状態」で表示"),
      l3("風電與太陽能不在本層（見「風電、太陽能與充電站」），兩層不要合計", "Wind and solar are not in this layer (see the wind, solar and charging layer); do not add the two", "風力・太陽光は本レイヤーに含まない（「風力・太陽光・充電」レイヤー）。両者を合算しない"),
      COVERAGE_NOTE(34),
    ],
    popupNotes: [],
    sourceOrg: "Global Energy Monitor（Coal、Oil & Gas、Hydropower、Bioenergy、Nuclear、Geothermal trackers）",
    sourceUrl: GEM_URL, license: "CC BY 4.0", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南電廠載入中", "Loading Vietnam power plants", "ベトナムの発電所を読み込み中"),
  },
  {
    key: "vnRenewables", file: "vn_renewables_gem.pmtiles", sourceId: "vn-renewables-gem", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2E085", count: 2235,
    parts: [
      { id: "vn-renewables-wind-solar-circle", sourceLayer: "wind_solar", geom: "point", minzoom: 3, cat: propGetter("tech"), size: VN_CAPACITY_BANDS },
      { id: "vn-renewables-solar-tz-circle", sourceLayer: "solar_tz", geom: "point", minzoom: 3, cat: propGetter("tech"), size: VN_CAPACITY_BANDS },
    ],
    more: {
      file: "vn_renewables_osm.pmtiles", sourceId: "vn-renewables-osm", srcMinzoom: 5, srcMaxzoom: 14, sourceValue: "osm",
      parts: [{ id: "vn-charging-circle", sourceLayer: "charging", geom: "point", minzoom: 5, cat: propGetter("source"), small: true }],
      sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL,
    },
    cats: RENEWABLE_CATS,
    sizeLegend: [VN_CAPACITY_BANDS],
    statusDefault: ["operating", "construction"],
    title: { props: ["name", "name_local"], fallback: l3("再生能源設施", "Renewable facility", "再生可能エネルギー施設"), fallbackBy: { prop: "source", map: { osm: l3("充電站", "Charging station", "充電スタンド") } } },
    fields: [{ prop: "tech", label: l3("技術", "Technology", "技術"), map: { wind: l3("風力", "Wind", "風力"), solar: l3("太陽光電", "Solar", "太陽光") } },
      ...GEM_PLANT_FIELDS,
      { prop: "brand", label: l3("品牌", "Brand", "ブランド") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" }],
    legendNotes: [
      l3("GEM 風電與太陽能 842 處（預設只顯示運轉中與興建中；規劃中 492 處在「狀態」篩選）", "842 GEM wind and solar projects (operating and under construction by default; 492 planned in the status filter)", "GEM 風力・太陽光 842 か所（既定は運転中と建設中。計画中 492 は「状態」で表示）"),
      l3("TransitionZero 光電 1,017 處為 CC BY-NC 4.0（非商用授權），彈窗逐筆標示", "1,017 TransitionZero solar records are CC BY-NC 4.0 (non-commercial); licence shown per record in the popup", "TransitionZero の太陽光 1,017 件は CC BY-NC 4.0（非商用）。ポップアップでレコードごとに表示"),
      l3("GEM 風光位置約 85% 為近似；電動車充電站 376 處為 OSM 補缺（ODbL）", "About 85% of GEM wind/solar locations are approximate; 376 EV charging stations from OSM (ODbL)", "GEM 風力・太陽光の位置は約 85% が概略。EV 充電スタンド 376 か所は OSM 補完（ODbL）"),
      COVERAGE_NOTE(33),
    ],
    popupNotes: [
      { text: l3("本筆為 TransitionZero 資料，CC BY-NC 4.0（非商用授權）", "This record is TransitionZero data, CC BY-NC 4.0 (non-commercial)", "このレコードは TransitionZero のデータで CC BY-NC 4.0（非商用）"), when: (p) => p.commercial_ok === false || str(p.commercial_ok) === "false" },
      OFFSHORE_NOTE, NEAREST_NOTE,
    ],
    sourceOrg: "Global Energy Monitor（Wind、Solar trackers，CC BY 4.0）；solar_tz © TransitionZero Solar Asset Mapper via GEM（CC BY-NC 4.0，非商用）",
    sourceUrl: GEM_URL, license: "CC BY 4.0（GEM）；TransitionZero 1,017 筆 CC BY-NC 4.0（非商用）", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南再生能源載入中", "Loading Vietnam renewables", "ベトナムの再生可能エネルギーを読み込み中"),
  },
  {
    key: "vnPowerGrid", file: "vn_power_grid.pmtiles", sourceId: "vn-power-grid", srcMinzoom: 4, srcMaxzoom: 14, color: "#62D9AD", count: 13_087,
    parts: [
      { id: "vn-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: propGetter("kv_class"), filter: ["!=", ["get", "power"], "cable"], lineWidth: KV_WIDTH },
      { id: "vn-power-cables-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: propGetter("kv_class"), filter: ["==", ["get", "power"], "cable"], lineWidth: KV_WIDTH, dashed: true },
      { id: "vn-power-substations-circle", sourceLayer: "substations", geom: "point", minzoom: 4, cat: propGetter("kv_class"), small: true },
    ],
    cats: KV_CATS,
    title: { props: ["name"], fallback: l3("電力設施", "Power facility", "電力設備"),
      fallbackBy: { prop: "power", map: { line: l3("輸電線", "Power line", "送電線"), cable: l3("電纜", "Cable", "ケーブル") } } },
    fields: [
      { prop: "power", label: l3("類型", "Type", "種別"), map: { line: l3("輸電線（架空）", "Power line (overhead)", "送電線（架空）"), cable: l3("地下／海底電纜", "Underground / submarine cable", "地中・海底ケーブル") } },
      { prop: "kv_class", label: l3("電壓等級", "Voltage class", "電圧区分"), map: Object.fromEntries(KV_CATS.flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "voltage_kv", label: l3("電壓（最大）", "Voltage (highest)", "電圧（最大）"), kind: "num", unit: "kV", digits: 1 },
      { prop: "substation_type", label: l3("變電所類型（OSM 原文）", "Substation type (OSM tag)", "変電所の種別（OSM 原文）"), kind: "code" },
      { prop: "circuits", label: l3("迴路數", "Circuits", "回線数"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 2 },
      PROVINCE_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("線 11,656 段（電纜 97 段為虛線）＋變電所 1,431 處（電壓未標 418）；電壓取標籤最大值", "11,656 line segments (97 cables, dashed) plus 1,431 substations (418 untagged voltage); voltage is the highest tagged value", "線 11,656 区間（ケーブル 97 は破線）＋変電所 1,431（電圧未記載 418）。電圧はタグの最大値")],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: VN_FETCHED_AT,
    loading: l3("越南電網載入中", "Loading Vietnam power grid", "ベトナムの電力網を読み込み中"),
  },
  {
    key: "vnFuelStations", file: "vn_fuel_stations.pmtiles", sourceId: "vn-fuel-stations", srcMinzoom: 5, srcMaxzoom: 14, color: "#f59e0b", count: 4902,
    parts: [{ id: "vn-fuel-stations-circle", sourceLayer: "fuel", geom: "point", minzoom: 5, cat: propGetter("brand"), small: true }],
    cats: FUEL_CATS,
    otherColor: "#94a3b8",
    otherLabel: l3("其他品牌", "Other brand", "その他のブランド"),
    title: { props: ["name", "brand_osm"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド") },
    fields: [
      { prop: "brand", label: l3("品牌（依名稱、品牌標籤歸類）", "Brand (from name / brand tag)", "ブランド（名称・タグから分類）"), map: { other: l3("其他品牌", "Other brand", "その他のブランド"), unknown: l3("未知", "Unknown", "不明") } },
      { prop: "brand_osm", label: l3("品牌（OSM 原文）", "Brand (OSM tag)", "ブランド（OSM 原文）") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" },
      PROVINCE_FIELD,
    ],
    legendNotes: [OSM_NOTE,
      l3("amenity=fuel 共 4,902 站；Petrolimex 1,186、PVOIL 386，品牌未知 2,040", "4,902 amenity=fuel stations; Petrolimex 1,186, PVOIL 386, brand unknown 2,040", "amenity=fuel 計 4,902 か所。Petrolimex 1,186・PVOIL 386、ブランド不明 2,040")],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL, fetchedAt: VN_FETCHED_AT,
    loading: l3("越南加油站載入中", "Loading Vietnam fuel stations", "ベトナムのガソリンスタンドを読み込み中"),
  },
  {
    key: "vnOilGas", file: "vn_oil_gas_gem_v2.pmtiles", sourceId: "vn-oil-gas-gem", srcMinzoom: 3, srcMaxzoom: 14, color: "#f97316", count: 192,
    parts: [
      { id: "vn-pipelines-gem-line", sourceLayer: "pipelines_gem", geom: "line", minzoom: 3, cat: propGetter("kind"), lineWidth: { gas: [1.5, 2.5], oil: [1.5, 2.5] } },
      { id: "vn-lng-terminals-circle", sourceLayer: "lng_terminals", geom: "point", minzoom: 3, cat: propGetter("source") },
      { id: "vn-coal-terminals-circle", sourceLayer: "coal_terminals", geom: "point", minzoom: 3, cat: propGetter("source") },
    ],
    more: {
      file: "vn_oil_gas_osm.pmtiles", sourceId: "vn-oil-gas-osm", srcMinzoom: 5, srcMaxzoom: 14, sourceValue: "osm",
      parts: [
        { id: "vn-pipelines-osm-line", sourceLayer: "pipelines_osm", geom: "line", minzoom: 5, cat: propGetter("source") },
        { id: "vn-refineries-circle", sourceLayer: "refineries", geom: "point", minzoom: 5, cat: propGetter("kind") },
        { id: "vn-tanks-circle", sourceLayer: "tanks", geom: "point", minzoom: 5, cat: propGetter("kind"), small: true },
      ],
      sourceOrg: OSM_GEOFABRIK, sourceUrl: OSM_COPYRIGHT, license: ODBL,
    },
    cats: OIL_GAS_CATS,
    statusDefault: ["operating", "construction", "proposed"],
    title: { props: ["name"], fallback: l3("油氣設施", "Oil & gas facility", "石油・ガス施設"),
      fallbackBy: { prop: "kind", map: { gas: l3("天然氣管線", "Gas pipeline", "ガスパイプライン"), oil: l3("油管", "Oil pipeline", "石油パイプライン"), refinery: l3("煉油廠", "Refinery", "製油所"), storage_tank: l3("儲槽", "Storage tank", "貯蔵タンク") } } },
    fields: [
      STATUS_FIELD,
      { prop: "segment", label: l3("管段", "Segment", "区間") },
      { prop: "facility_type", label: l3("設施類型", "Facility type", "施設の種別"), map: { import: l3("進口接收站", "Import terminal", "輸入基地"), export: l3("出口", "Export", "輸出") } },
      { prop: "capacity_mtpa", label: l3("年處理量", "Capacity", "年間処理能力"), kind: "num", unit: "Mtpa", digits: 2 },
      { prop: "terminal_type", label: l3("碼頭類型（GEM 原文）", "Terminal type (GEM)", "ターミナル種別（GEM 原文）"), kind: "code" },
      { prop: "capacity_mt", label: l3("年吞吐量（GEM 原文）", "Capacity (GEM)", "取扱量（GEM 原文）"), kind: "code" },
      { prop: "content", label: l3("儲存物（OSM 原文）", "Content (OSM tag)", "貯蔵物（OSM 原文）"), kind: "code" },
      { prop: "substance", label: l3("輸送物（OSM 原文）", "Substance (OSM tag)", "輸送物（OSM 原文）"), kind: "code" },
      { prop: "countries", label: l3("經過國家", "Countries", "経由国") },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 1 },
      { prop: "license", label: l3("授權（逐筆）", "Licence (per record)", "ライセンス（レコード別）") },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("GEM：LNG 接收站 33（提案 20、取消 8；1 筆取消案上游座標錯誤，不畫）、煤炭碼頭 5、管線 12；預設顯示運轉中、興建中、提案，擱置與取消在「狀態」篩選", "GEM: 33 LNG terminals (20 proposed, 8 cancelled; 1 cancelled with a wrong upstream coordinate is not drawn), 5 coal terminals, 12 pipelines; operating, under construction and proposed shown by default, shelved and cancelled in the status filter", "GEM：LNG 基地 33（提案 20・中止 8。中止 1 件は上流座標の誤りで描画しない）、石炭ターミナル 5、パイプライン 12。既定は運転中・建設中・提案、保留と中止は「状態」で表示"),
      l3("OSM：煉油廠 2、油氣儲槽 75、天然氣管線 65（ODbL）", "OSM: 2 refineries, 75 oil/gas storage tanks, 65 gas pipelines (ODbL)", "OSM：製油所 2・石油ガス貯蔵タンク 75・ガスパイプライン 65（ODbL）"),
      COVERAGE_NOTE(18),
    ],
    popupNotes: [OFFSHORE_NOTE, NEAREST_NOTE],
    sourceOrg: "Global Energy Monitor（GGIT LNG Terminals 2025-09、Gas Pipelines 2025-11、GOIT Oil/NGL Pipelines 2025-03、Coal Terminals 2024-12）",
    sourceUrl: GEM_URL, license: "CC BY 4.0", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南油氣設施載入中", "Loading Vietnam oil & gas facilities", "ベトナムの石油・ガス施設を読み込み中"),
  },
  {
    key: "vnEnvisoftStations", file: "vn_envisoft_stations_v2.pmtiles", sourceId: "vn-envisoft-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#a78bfa", count: 2177,
    parts: [{ id: "vn-envisoft-stations-circle", sourceLayer: "stations", geom: "point", minzoom: 4, cat: propGetter("station_type") }],
    cats: ENVISOFT_CATS,
    otherColor: "#94a3b8",
    otherLabel: l3("其他（低成本感測器、類型未知）", "Other (low-cost sensor, type unknown)", "その他（低コストセンサー・種別不明）"),
    title: { props: ["name"], fallback: l3("環境監測站", "Environmental monitoring station", "環境モニタリング局") },
    fields: [
      { prop: "station_type", label: l3("類型", "Type", "種別"), map: ENVISOFT_TYPE_MAP },
      { prop: "address", label: l3("地址", "Address", "住所") },
      { prop: "station_type_code", label: l3("類型代碼（站名後綴）", "Type code (name suffix)", "種別コード（局名の接尾辞）"), kind: "code" },
      PROVINCE_FIELD,
    ],
    legendNotes: [
      l3("只有站點位置，沒有任何監測數值", "Station locations only, no measurements", "局の位置のみで、測定値は含まない"),
      l3("2,177 站：廢水排放口 1,043、煙道 822、空品 147、地面水 144、海水 17；類型由站名後綴判定；另 1 站上游座標錯誤（落在別省），不畫", "2,177 stations: 1,043 wastewater discharge, 822 stack, 147 air, 144 surface water, 17 sea water; type from the station-name suffix; 1 more station with a wrong upstream coordinate is not drawn", "2,177 局：排水口 1,043・煙突 822・大気 147・地表水 144・海水 17。種別は局名の接尾辞で判定。上流座標の誤り 1 局は描画しない"),
      VN_ENVISOFT_NOTE,
      COVERAGE_NOTE(33),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: "envisoft.gov.vn（越南環境自動監測系統）", sourceUrl: "https://envisoft.gov.vn/", license: "授權未明示", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南環境監測站載入中", "Loading Vietnam environmental monitoring stations", "ベトナムの環境モニタリング局を読み込み中"),
  },
  {
    key: "vnAngiangDemo", file: "vn_angiang_demo.pmtiles", sourceId: "vn-angiang-demo", srcMinzoom: 6, srcMaxzoom: 14, color: "#f97316", count: 72,
    parts: [
      { id: "vn-angiang-clusters-fill", sourceLayer: "industrial_clusters", geom: "fill", minzoom: 6, cat: propGetter("status_code") },
      // 工業群面積多在 1 km² 以下，z8 只剩小點：加同色外框，低縮放（z10 以下）2.5 px，放大後收到 1.5 px
      { id: "vn-angiang-clusters-outline", sourceLayer: "industrial_clusters", geom: "line", minzoom: 6, cat: propGetter("status_code"), lineWidth: { hoatdong: [2.5, 1.5], dangxd: [2.5, 1.5], chuaxd: [2.5, 1.5] } },
      { id: "vn-angiang-flood-circle", sourceLayer: "flood_resettlement", geom: "point", minzoom: 6, cat: propGetter("source") },
    ],
    cats: ANGIANG_CATS,
    title: { props: ["name", "site_id"], fallback: l3("安江示範", "An Giang demo", "An Giang デモ") },
    fields: [
      { prop: "status_code", label: l3("狀態", "Status", "状態"), map: ANGIANG_STATUS },
      { prop: "status", label: l3("狀態（越南文原文）", "Status (Vietnamese)", "状態（ベトナム語原文）") },
      { prop: "planned_area_ha", label: l3("規劃面積", "Planned area", "計画面積"), kind: "num", unit: "ha", digits: 1 },
      { prop: "industries", label: l3("產業", "Industries", "業種") },
      { prop: "investor", label: l3("投資者", "Investor", "投資者") },
      { prop: "plan_period", label: l3("規劃期程", "Plan period", "計画期間") },
      { prop: "address", label: l3("地址（舊行政區）", "Address (former units)", "住所（旧行政区）") },
      { prop: "site_id", label: l3("居民點代碼", "Site ID", "居住地コード"), kind: "code" },
      { prop: "old_district_code", label: l3("舊縣代碼", "Former district code", "旧県コード"), kind: "code" },
      { prop: "old_commune_code", label: l3("舊社代碼（不換算新社）", "Former commune code (not converted)", "旧社コード（新社に換算しない）"), kind: "code" },
    ],
    legendNotes: [
      VN_ANGIANG_NOTE,
      l3("工業群 13 處（面）、避洪居民點 59 處（點）；行政代碼為舊制，不換算新社", "13 industrial clusters (areas) and 59 flood resettlement sites (points); administrative codes are pre-reform and not converted", "工業団地 13（面）・洪水避難居住地 59（点）。行政コードは旧制で新社に換算しない"),
      l3("來源 安江省開放資料入口，授權未明示", "Source An Giang open data portal, licence not stated", "出典 An Giang 省オープンデータポータル、ライセンス未明示"),
    ],
    popupNotes: [{ text: VN_ANGIANG_NOTE }],
    sourceOrg: "Cổng dữ liệu mở tỉnh An Giang（opendata.angiang.gov.vn）Dữ liệu GIS", sourceUrl: "https://opendata.angiang.gov.vn/", license: "授權未明示", fetchedAt: VN_FETCHED_AT,
    loading: l3("越南安江示範載入中", "Loading Vietnam An Giang demo", "ベトナム An Giang デモを読み込み中"),
  },
];

export const VN_SPEC_BY_KEY: Readonly<Record<VnDataKey, VnLayerSpec>> = Object.fromEntries(VN_DATA_SPECS.map((s) => [s.key, s])) as Record<VnDataKey, VnLayerSpec>;

/** 第二個 PMTiles 的規格（共用類別、圖例、欄位；檔案、子圖層、署名換成該檔）。 */
export function vnMoreSpec(spec: VnLayerSpec): PhLayerSpec<VnDataKey> | null {
  const m = spec.more;
  if (!m) return null;
  return { ...spec, file: m.file, sourceId: m.sourceId, srcMinzoom: m.srcMinzoom, srcMaxzoom: m.srcMaxzoom, parts: m.parts, sourceOrg: m.sourceOrg, sourceUrl: m.sourceUrl, license: m.license };
}

/** popup 用：依 feature 的 `source` 欄選主檔或第二檔規格。 */
export function vnSpecForFeature(spec: VnLayerSpec, props: Record<string, unknown>): PhLayerSpec<VnDataKey> {
  return spec.more && str(props.source) === spec.more.sourceValue ? vnMoreSpec(spec)! : spec;
}

/** 狀態多選選項 id（宣告順序＝bitmask）。 */
export const VN_STATUS_IDS = VN_STATUSES.map((s) => s.id);
/** 狀態篩選：沒有 status 欄的點（OSM 子圖層）不受影響。`selected` undefined＝預設。 */
export function vnStatusFilter(spec: VnLayerSpec, selected: readonly string[] | undefined): Expr | null {
  if (!spec.statusDefault) return null;
  const sel = selected ?? spec.statusDefault;
  if (sel.length === VN_STATUS_IDS.length) return null;
  return ["any", ["!", ["has", "status"]], ["in", ["get", "status"], ["literal", [...sel]]]];
}
