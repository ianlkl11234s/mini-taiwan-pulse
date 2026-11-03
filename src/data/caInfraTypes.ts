/**
 * 加拿大第 0＋1 波（行政邊界、交通 4 層、能源 4 層、人口中心）：色票、分類、署名、popup 欄位 SSOT。
 * hook（`hooks/useCa*Layers.ts`）、圖例（`legend/caLegends.tsx`）、popup（`featureInfo/caPanels.tsx`）三邊共用。
 *
 * 資料與授權原句見 taipei-gis-analytics `docs/data-catalog/{base_map,transportation,energy,demographics}/ca_*.md`
 * 與 `docs/topic-research/canada_opendata/waves/w{0,1}/layer-plan*.md`（2026-11-04）。
 * 介面字串（類別名、備註、欄位名）以三語 `L3` 寫在本檔（比照 `krDataLayers.ts`），顯示時依目前語系挑；
 * 圖層名走 layers.json。色票沿用台灣與南韓同語意圖層（交通：國道／省道、鐵道、機場港口；能源：燃料色、化石燃料色），
 * 不另造色。涵蓋寫 n/13 省／地區，未涵蓋的省份寫「未涵蓋」（不補 0）。
 */
import { FOSSIL_PAINT_COLORS, ROAD_DRIVE_PAINT_COLORS } from "../map/layerPaintColors";
import { FUEL_COLORS, FUEL_FALLBACK_COLOR } from "./energyLoader";
import { JP_BUS_STOP_CLASSES } from "./jpBusStopTypes";
import { KR_CAPACITY_BANDS } from "./krInfraTypes";
import type { L3 } from "./krDataLayers";

export type { L3 } from "./krDataLayers";
export { pickL3 } from "./krDataLayers";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const fuel = (key: string) => FUEL_COLORS[key] ?? FUEL_FALLBACK_COLOR;

export const CA_FETCHED_AT = "2026-11-04";
export const CA_FALLBACK_COLOR = FUEL_FALLBACK_COLOR;
export const CA_OGL_LICENSE = "Open Government Licence – Canada";
export const CA_OGL_URL = "https://open.canada.ca/en/open-government-licence-canada";
export const CA_OGL_SENTENCE = "Contains information licensed under the Open Government Licence – Canada.";

/** 共用：類別（`values` 為來源原值；`id` 是多選 option 值）。 */
export interface CaCat { id: string; values: readonly string[]; color: string; label: L3 }
export interface CaField { prop: string; label: L3; kind?: "text" | "num" | "code" | "bool"; unit?: string; digits?: number; /** 只顯示 >0 的數值（來源以 -1 表示未知） */ positive?: boolean; map?: Readonly<Record<string, L3>> }
/** 一個 tile layer 的 popup 規格（標題欄位、列、備註）。 */
export interface CaPopupSpec { title: { props: readonly string[]; fallback: L3 }; typeLabel?: L3; fields: readonly CaField[]; notes?: readonly L3[] }
/** 一個 layer key 的來源（popup 底部 SourceFooter 與圖例署名共用）。 */
export interface CaSource { org: string; url: string; license: string; short: string }

export const caText = (value: unknown): string => {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|nat|null|\.\.|\?)$/i.test(s) ? "" : s;
};

const PROVINCE: CaField = { prop: "province", label: l3("省／地區", "Province / territory", "州・準州") };
const OGL_SOURCE = (org: string, url: string): CaSource => ({ org, url, license: CA_OGL_LICENSE, short: `© ${org}（OGL–Canada）` });

// ─────────────────────────── 行政邊界（第 0 波 C001） ───────────────────────────

export const CA_ADMIN_COLOR = "#9ca3af";
/** 三層級（PMTiles tile layer 名＝value，select encode 順序）；CD z3、CSD z5 起才有圖磚。 */
export const CA_ADMIN_LEVELS = [
  { value: "pr", label: "省／地區（Province／territory）", count: 13, minzoom: 1 },
  { value: "cd", label: "普查區（Census division）", count: 293, minzoom: 3 },
  { value: "csd", label: "普查分區（Census subdivision）", count: 5161, minzoom: 5 },
] as const;
export type CaAdminLevel = (typeof CA_ADMIN_LEVELS)[number]["value"];
export const CA_ADMIN_LEVEL_LABELS: Record<CaAdminLevel, L3> = {
  pr: l3("省／地區", "Province / territory", "州・準州"),
  cd: l3("普查區（Census division）", "Census division", "センサス区（Census division）"),
  csd: l3("普查分區（Census subdivision）", "Census subdivision", "センサス小区（Census subdivision）"),
};
export const CA_ADMIN_SOURCE: CaSource = {
  org: "Statistics Canada, 2021 Census Cartographic Boundary Files",
  url: "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm",
  license: CA_OGL_LICENSE,
  short: "© Statistics Canada 2021 Census（OGL–Canada）",
};
export const CA_ADMIN_NOTES: readonly L3[] = [
  l3("涵蓋 13/13 省／地區；傳播區（DA）、街區（DB）級未涵蓋", "Coverage 13/13 provinces and territories; dissemination areas and blocks not covered", "13/13 州・準州を収録。DA・DB 級は対象外"),
  l3("普查區 z3、普查分區 z5 起顯示", "Census divisions appear from zoom 3, subdivisions from zoom 5", "センサス区はズーム 3、小区はズーム 5 から表示"),
  l3("人口為 2021 年普查；無資料顯示「無資料」，不當 0", "Population from the 2021 Census; missing values show 'No data', never 0", "人口は 2021 年国勢調査。欠測は「データなし」と表示し 0 にしない"),
];
export const CA_NO_DATA = l3("無資料", "No data", "データなし");

// ─────────────────────────── 交通：公共運輸站點（C009） ───────────────────────────

export const CA_TRANSIT_COUNT = 133_029;
export const CA_TRANSIT_COLOR = JP_BUS_STOP_CLASSES[0].color;
export const CA_TRANSIT_TYPES: readonly CaCat[] = [
  { id: "0", values: ["0"], color: CA_TRANSIT_COLOR, label: l3("站牌／月台", "Stop / platform", "停留所・ホーム") },
  { id: "1", values: ["1"], color: "#ab47bc", label: l3("車站", "Station", "駅") },
];
export const CA_TRANSIT_SOURCE: CaSource = {
  org: "各交通機構 GTFS（經 Mobility Database）",
  url: "https://mobilitydatabase.org/",
  license: "授權依各機構（多數未明示）",
  short: "GTFS：各交通機構（經 Mobility Database）；授權依各機構",
};
export const CA_TRANSIT_NOTES: readonly L3[] = [
  l3("135 個 GTFS feed 的站點；不同機構共站會重複", "Stops from 135 GTFS feeds; stops shared by several agencies are repeated", "135 の GTFS フィードの停留所。複数事業者の共用停留所は重複する"),
  l3("授權依各機構（多數未明示）", "Licence varies by agency (mostly unstated)", "ライセンスは事業者ごと（多くは明示なし）"),
  l3("Nunavut 未涵蓋", "Nunavut not covered", "ヌナブト準州は対象外"),
  l3("z12 起顯示單站，之下為密度熱區（格網計數；類別篩選只作用於單站）", "Individual stops from zoom 12; density heatmap (grid counts) below; the type filter applies to individual stops only", "ズーム 12 から個別表示、それ以下は密度ヒートマップ（格子集計。種別フィルタは個別表示のみ）"),
];
export const CA_TRANSIT_POPUP: CaPopupSpec = {
  title: { props: ["stop_name"], fallback: l3("公共運輸站點", "Transit stop", "公共交通の停留所") },
  fields: [
    { prop: "stop_code", label: l3("站碼", "Stop code", "停留所コード"), kind: "code" },
    { prop: "provider", label: l3("營運機構", "Agency", "事業者") },
    { prop: "location_type", label: l3("站型", "Type", "種別"), map: { "0": CA_TRANSIT_TYPES[0]!.label, "1": CA_TRANSIT_TYPES[1]!.label } },
    { prop: "wheelchair_boarding", label: l3("無障礙上下車", "Wheelchair boarding", "車いす乗降"), map: { "1": l3("可", "Accessible", "可"), "2": l3("不可", "Not accessible", "不可") } },
    PROVINCE,
  ],
  notes: [l3("授權依各機構 GTFS", "Licence follows each agency's GTFS terms", "各事業者の GTFS 条件に従う")],
};

// ─────────────────────────── 交通：機場與港口（C013） ───────────────────────────

export const CA_AIRPORT_CLASSES: readonly CaCat[] = [
  { id: "large", values: ["large_airport"], color: "#daa520", label: l3("大型機場", "Large airport", "大規模空港") },
  { id: "medium", values: ["medium_airport"], color: "#f59e0b", label: l3("中型機場", "Medium airport", "中規模空港") },
  { id: "small", values: ["small_airport", "balloonport"], color: "#fcd34d", label: l3("小型機場", "Small airport", "小規模空港") },
  { id: "heliport", values: ["heliport"], color: "#f472b6", label: l3("直升機場", "Heliport", "ヘリポート") },
  { id: "seaplane", values: ["seaplane_base"], color: "#38bdf8", label: l3("水上飛機基地", "Seaplane base", "水上機基地") },
];
export const CA_PORT_TYPES: readonly CaCat[] = [
  { id: "port", values: ["port"], color: "#4a90d9", label: l3("港口", "Port", "港湾") },
  { id: "mixed", values: ["mixed"], color: "#22d3ee", label: l3("綜合港（含漁港）", "Mixed harbour (incl. fishing)", "複合港（漁港を含む）") },
  { id: "marina", values: ["marina"], color: "#a78bfa", label: l3("遊艇港", "Marina", "マリーナ") },
];
/** 拉遠（z<7）只畫大中型機場與 `sub_type=port`，其餘 z7 起補上（layer-plan C013）。 */
export const CA_AIRPORT_MAJOR_IDS = ["large", "medium"] as const;
export const CA_PORT_MAJOR_IDS = ["port"] as const;
export const CA_HUB_MINOR_FROM_ZOOM = 7;
export const CA_AIRPORTS_SOURCE: CaSource = {
  org: "Statistics Canada, Open Database of Infrastructure v2（airports: OurAirports, public domain；ports: DFO, NGA World Port Index 等）",
  url: "https://www150.statcan.gc.ca/n1/pub/34-26-0003/342600032023001-eng.htm",
  license: `${CA_OGL_LICENSE}（OurAirports public domain）`,
  short: "© Statistics Canada ODI v2（OGL–Canada）／OurAirports（public domain）",
};
export const CA_AIRPORTS_NOTES: readonly L3[] = [
  l3("拉遠只顯示大中型機場與港口，z7 起補上小型機場、直升機場、水上飛機基地、綜合港與遊艇港", "Zoomed out, only large/medium airports and ports are shown; smaller types appear from zoom 7", "広域表示では大・中規模空港と港湾のみ。ズーム 7 から小規模空港などを追加"),
  l3("機場 13/13 省／地區；港口 12/13（Yukon 未涵蓋）", "Airports 13/13; ports 12/13 (Yukon not covered)", "空港 13/13、港湾 12/13（ユーコン準州は対象外）"),
  l3("港口 197 筆來自美國 NGA World Port Index（授權頁未讀到）", "197 ports come from the US NGA World Port Index (licence page not available)", "港湾 197 件は米 NGA World Port Index 由来（ライセンス頁未確認）"),
];
export const CA_AIRPORT_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("機場", "Airport", "空港") },
  fields: [
    { prop: "source_class", label: l3("類型", "Type", "種別"), map: Object.fromEntries(CA_AIRPORT_CLASSES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    { prop: "icao_code", label: l3("ICAO 代碼", "ICAO code", "ICAO コード"), kind: "code" },
    { prop: "local_code", label: l3("當地代碼", "Local code", "ローカルコード"), kind: "code" },
    { prop: "elevation_ft", label: l3("標高", "Elevation", "標高"), kind: "num", unit: "ft" },
    { prop: "municipality", label: l3("所在市鎮", "Municipality", "所在自治体") },
    PROVINCE,
  ],
  notes: [l3("機場資料源自 OurAirports（public domain）", "Airport data from OurAirports (public domain)", "空港データは OurAirports（パブリックドメイン）")],
};
export const CA_PORT_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("港口", "Port", "港湾") },
  fields: [
    { prop: "sub_type", label: l3("類型", "Type", "種別"), map: Object.fromEntries(CA_PORT_TYPES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    { prop: "source_class", label: l3("來源分類", "Source class", "出典分類") },
    { prop: "harbour_size", label: l3("港口規模", "Harbour size", "港の規模") },
    { prop: "ownership", label: l3("管理單位", "Ownership", "管理者") },
    { prop: "un_locode", label: l3("UN/LOCODE", "UN/LOCODE", "UN/LOCODE"), kind: "code" },
    { prop: "channel_depth", label: l3("航道水深", "Channel depth", "航路水深"), kind: "num", unit: "m", digits: 1 },
    { prop: "anchorage_depth", label: l3("錨地水深", "Anchorage depth", "錨地水深"), kind: "num", unit: "m", digits: 1 },
    { prop: "cargo_pier_depth", label: l3("貨運碼頭水深", "Cargo pier depth", "貨物岸壁水深"), kind: "num", unit: "m", digits: 1 },
    { prop: "provider", label: l3("資料提供者", "Provider", "データ提供者") },
    PROVINCE,
  ],
};

// ─────────────────────────── 交通：主要道路（C012 NRN） ───────────────────────────

export const CA_ROAD_CLASSES: readonly (CaCat & { width: "emphasis" | "standard" | "thin" })[] = [
  { id: "freeway", values: ["Freeway"], color: ROAD_DRIVE_PAINT_COLORS.motorway, width: "emphasis", label: l3("高速公路（Freeway）", "Freeway", "高速道路（Freeway）") },
  { id: "expressway", values: ["Expressway / Highway"], color: ROAD_DRIVE_PAINT_COLORS.trunk, width: "standard", label: l3("快速公路／幹線公路", "Expressway / highway", "高速・幹線道路") },
  { id: "arterial", values: ["Arterial"], color: ROAD_DRIVE_PAINT_COLORS.primary, width: "thin", label: l3("有編號的省道級幹道（Arterial）", "Numbered arterial (provincial-road level)", "番号付き幹線（州道クラス）") },
];
export const CA_ROADS_SOURCE: CaSource = OGL_SOURCE("Statistics Canada, National Road Network (NRN)", "https://open.canada.ca/data/en/dataset/3d282116-e556-400c-9306-ca1a3cada77f");
export const CA_ROADS_NOTES: readonly L3[] = [
  l3("拉遠（z<6）只顯示高速與快速公路，z6 起加省道級幹道", "Zoomed out (below z6) only freeways and expressways; arterials from zoom 6", "広域（z6 未満）は高速・幹線道路のみ。ズーム 6 から州道クラスを追加"),
  l3("Nunavut 無此等級道路（未涵蓋）；NB 部分省道在 NRN 歸 Collector，未收；ON 含 county road", "Nunavut has no roads of these classes (not covered); some NB provincial roads are 'Collector' in NRN and not included; ON includes county roads", "ヌナブト準州は該当道路なし（対象外）。NB の一部州道は NRN で Collector 扱いのため未収録。ON は county road を含む"),
];
export const CA_ROAD_POPUP: CaPopupSpec = {
  title: { props: ["rtename1en", "rtename1fr"], fallback: l3("主要道路", "Major road", "主要道路") },
  fields: [
    { prop: "rtnumber1", label: l3("路線編號", "Route number", "路線番号"), kind: "code" },
    { prop: "rtename1en", label: l3("路線名（英）", "Route name (EN)", "路線名（英）") },
    { prop: "rtename1fr", label: l3("路線名（法）", "Route name (FR)", "路線名（仏）") },
    { prop: "roadclass", label: l3("道路等級", "Road class", "道路等級"), map: Object.fromEntries(CA_ROAD_CLASSES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    PROVINCE,
  ],
};

// ─────────────────────────── 交通：鐵道（C012 CanVec） ───────────────────────────

export const CA_RAIL_TRACK_CLASSES: readonly (CaCat & { width: "emphasis" | "standard" | "thin"; opacity: number })[] = [
  { id: "main", values: ["Main"], color: "#b8a080", width: "emphasis", opacity: 0.95, label: l3("幹線", "Main line", "本線") },
  { id: "connecting", values: ["Connecting"], color: "#b8a080", width: "standard", opacity: 0.85, label: l3("聯絡線", "Connecting line", "連絡線") },
  { id: "ferry", values: ["Ferry Route"], color: "#38bdf8", width: "standard", opacity: 0.85, label: l3("鐵路渡輪航線", "Rail ferry route", "鉄道連絡船航路") },
  { id: "minor", values: ["Yard", "Spur", "Siding", "Crossover", "Wye", "Unknown"], color: "#9ca3af", width: "thin", opacity: 0.55, label: l3("側線／調車場／支線等", "Yard, spur, siding and other tracks", "側線・操車場・引込線など") },
];
/** 幹線類（Main／Connecting／Ferry）z3 起；其餘 z10 起（檔內 z<9 已只有幹線）。 */
export const CA_RAIL_MINOR_FROM_ZOOM = 10;
export const CA_RAIL_STATION_TYPES: readonly CaCat[] = [
  { id: "passenger", values: ["Passenger Station"], color: "#b8a080", label: l3("客運站", "Passenger station", "旅客駅") },
  { id: "mixed", values: ["Mixed", "Intermodal"], color: "#ab47bc", label: l3("客貨／聯運站", "Mixed / intermodal", "客貨・複合駅") },
  { id: "other", values: ["Freight", "Maintenance", "Other", "Unknown"], color: "#9ca3af", label: l3("貨運／維修／其他", "Freight, maintenance, other", "貨物・保守・その他") },
];
export const CA_RAIL_STATIONS_FROM_ZOOM = 8;
export const CA_RAIL_SOURCE: CaSource = OGL_SOURCE("Statistics Canada, Open Database of Infrastructure v2（NRCan CanVec 2023）", "https://www150.statcan.gc.ca/n1/pub/34-26-0003/342600032023001-eng.htm");
export const CA_RAIL_NOTES: readonly L3[] = [
  l3("拉遠只顯示幹線、聯絡線與渡輪航線；側線等 z10 起、車站 z8 起", "Zoomed out only main, connecting and ferry routes; other tracks from zoom 10, stations from zoom 8", "広域は本線・連絡線・連絡船のみ。側線などはズーム 10、駅はズーム 8 から"),
  l3("PE、Nunavut 未涵蓋；資料年份 NRCan CanVec 2023", "PE and Nunavut not covered; data year NRCan CanVec 2023", "PE・ヌナブト準州は対象外。データ年 NRCan CanVec 2023"),
];
const USE_TYPES: Record<string, L3> = {
  Freight: l3("貨運", "Freight", "貨物"),
  "Freight and Passenger": l3("客貨", "Freight and passenger", "客貨"),
  "Freight and Tourist": l3("貨運與觀光", "Freight and tourist", "貨物・観光"),
  Passenger: l3("客運", "Passenger", "旅客"),
  Tourist: l3("觀光", "Tourist", "観光"),
};
export const CA_RAIL_TRACK_POPUP: CaPopupSpec = {
  title: { props: ["track_name"], fallback: l3("鐵道", "Railway", "鉄道") },
  fields: [
    { prop: "track_class", label: l3("等級", "Class", "等級"), map: Object.fromEntries(CA_RAIL_TRACK_CLASSES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    { prop: "use_type", label: l3("用途", "Use", "用途"), map: USE_TYPES },
    { prop: "status", label: l3("狀態", "Status", "状態"), map: { Operational: l3("營運中", "Operational", "営業中"), "Under Construction": l3("興建中", "Under construction", "建設中") } },
    PROVINCE,
  ],
};
export const CA_RAIL_STATION_POPUP: CaPopupSpec = {
  title: { props: ["station_name"], fallback: l3("鐵道車站", "Rail station", "鉄道駅") },
  fields: [
    { prop: "station_type", label: l3("類型", "Type", "種別"), map: Object.fromEntries(CA_RAIL_STATION_TYPES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    PROVINCE,
  ],
};

// ─────────────────────────── 能源：電廠（C086 NACEI 2017） ───────────────────────────

export const CA_PLANT_FUELS: readonly CaCat[] = [
  { id: "hydro", values: ["hydro"], color: fuel("hydro"), label: l3("水力", "Hydro", "水力") },
  { id: "wind", values: ["wind"], color: fuel("wind"), label: l3("風力", "Wind", "風力") },
  { id: "solar", values: ["solar"], color: fuel("solar"), label: l3("太陽光電", "Solar", "太陽光") },
  { id: "bioenergy", values: ["bioenergy"], color: fuel("bioenergy"), label: l3("生質能", "Bioenergy", "バイオマス") },
  { id: "gas", values: ["gas"], color: fuel("natural_gas"), label: l3("燃氣", "Natural gas", "ガス") },
  { id: "coal", values: ["coal"], color: fuel("coal"), label: l3("燃煤", "Coal", "石炭") },
  { id: "nuclear", values: ["nuclear"], color: fuel("nuclear"), label: l3("核能", "Nuclear", "原子力") },
  { id: "oil", values: ["oil"], color: fuel("oil"), label: l3("燃油", "Oil", "石油") },
  { id: "pumped_hydro", values: ["pumped_hydro"], color: fuel("storage"), label: l3("抽蓄水力", "Pumped storage", "揚水") },
  { id: "other", values: ["tidal", "other"], color: fuel("other"), label: l3("潮汐／其他", "Tidal / other", "潮力・その他") },
];
export const CA_CAPACITY_BANDS = KR_CAPACITY_BANDS;
export const CA_PLANTS_SOURCE: CaSource = OGL_SOURCE("Natural Resources Canada, NACEI（Power Plants ≥100 MW；Renewable Energy Power Plants ≥1 MW）", "https://open.canada.ca/data/en/dataset/40ea8a2b-7b8f-4e41-91f2-a0e7c3cbcd2b");
export const CA_PLANTS_NOTES: readonly L3[] = [
  l3("資料年份 2017（NACEI 2017-08）", "Data year 2017 (NACEI, 2017-08)", "データ年 2017（NACEI 2017-08）"),
  l3("Nunavut 未涵蓋；<100 MW 的非再生能源電廠未收", "Nunavut not covered; non-renewable plants under 100 MW not included", "ヌナブト準州は対象外。100 MW 未満の非再生可能電源は未収録"),
];
export const CA_PLANT_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("電廠", "Power plant", "発電所") },
  fields: [
    { prop: "fuel_group", label: l3("燃料", "Fuel", "燃料"), map: Object.fromEntries(CA_PLANT_FUELS.flatMap((c) => c.values.map((v) => [v, c.label]))) },
    { prop: "capacity_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 1 },
    { prop: "owner", label: l3("業主", "Owner", "所有者") },
    { prop: "operator", label: l3("營運者", "Operator", "運営者") },
    { prop: "city", label: l3("所在城市", "City", "所在地") },
    PROVINCE,
  ],
  notes: [l3("資料日 2017-08（NACEI）", "Data date 2017-08 (NACEI)", "データ日 2017-08（NACEI）")],
};

// ─────────────────────────── 能源：風機（C088） ───────────────────────────

export const CA_WIND_COLOR = fuel("wind");
export const CA_WIND_COUNT = 7_841;
export const CA_WIND_SOURCE: CaSource = OGL_SOURCE("Natural Resources Canada, Canadian Wind Turbine Database（2026-04-24）", "https://open.canada.ca/data/en/dataset/79fdad93-9025-49ad-ba16-c26d718cc070");
export const CA_WIND_NOTES: readonly L3[] = [
  l3("陸域風機；Nunavut 未涵蓋；離岸風能區無開放資料", "Onshore turbines; Nunavut not covered; no open data for offshore wind areas", "陸上風車。ヌナブト準州は対象外。洋上風力区域のオープンデータなし"),
];
export const CA_WIND_POPUP: CaPopupSpec = {
  title: { props: ["project_name"], fallback: l3("風機", "Wind turbine", "風車") },
  fields: [
    { prop: "turbine_id", label: l3("機組編號", "Turbine ID", "機番"), kind: "code" },
    { prop: "rated_capacity_kw", label: l3("額定容量", "Rated capacity", "定格出力"), kind: "num", unit: "kW" },
    { prop: "hub_height_m", label: l3("輪轂高", "Hub height", "ハブ高"), kind: "num", unit: "m", digits: 1 },
    { prop: "rotor_diameter_m", label: l3("葉輪直徑", "Rotor diameter", "ローター径"), kind: "num", unit: "m", digits: 1 },
    { prop: "manufacturer", label: l3("廠牌", "Manufacturer", "メーカー") },
    { prop: "model", label: l3("型號", "Model", "型式") },
    { prop: "commissioning_year", label: l3("投運年", "Commissioned", "運転開始年"), kind: "code" },
    { prop: "project_capacity_mw", label: l3("風場容量", "Project capacity", "ウィンドファーム容量"), kind: "num", unit: "MW", digits: 1 },
    PROVINCE,
  ],
};

// ─────────────────────────── 能源：電網（C087 CanVec 2019） ───────────────────────────

export const CA_POWER_LINE_COLOR = "#62D9AD";
export const CA_SUBSTATION_COLOR = "#1AB6D9";
export const CA_SUBSTATIONS_FROM_ZOOM = 7;
/** 圖例子項多選（V-4）：架空線、水下線、變電站。 */
export const CA_GRID_PARTS: readonly CaCat[] = [
  { id: "above", values: ["Aboveground"], color: CA_POWER_LINE_COLOR, label: l3("電力線（架空，不分電壓）", "Power line (overhead, voltage not given)", "送電線（架空・電圧区分なし）") },
  { id: "under", values: ["Underwater"], color: CA_POWER_LINE_COLOR, label: l3("電力線（水下）", "Power line (underwater)", "送電線（水中）") },
  { id: "substation", values: [], color: CA_SUBSTATION_COLOR, label: l3("變電站", "Substation", "変電所") },
];
export const CA_GRID_SOURCE: CaSource = OGL_SOURCE("Natural Resources Canada, CanVec 1:50 000（Resource Management Features, 2019）", "https://open.canada.ca/data/en/dataset/8ba2aa2a-7bb9-4448-b4d7-f164409fe056");
export const CA_GRID_NOTES: readonly L3[] = [
  l3("資料年份 CanVec 2019；來源沒有電壓欄，不分等級", "Data year CanVec 2019; the source has no voltage field, so lines are not classed", "データ年 CanVec 2019。電圧欄がないため区分なし"),
  l3("1:50K 地形圖取材，配電線多未收；變電站 z7 起顯示、Nunavut 未涵蓋", "Compiled from 1:50K topographic maps, most distribution lines missing; substations from zoom 7, Nunavut not covered", "1:5 万地形図由来で配電線の多くは未収録。変電所はズーム 7 から、ヌナブト準州は対象外"),
];
export const CA_POWER_LINE_POPUP: CaPopupSpec = {
  title: { props: [], fallback: l3("電力線", "Power line", "送電線") },
  fields: [
    { prop: "location", label: l3("位置", "Location", "位置"), map: { Aboveground: l3("架空", "Overhead", "架空"), Underwater: l3("水下", "Underwater", "水中") } },
    { prop: "num_lines", label: l3("線數", "Number of lines", "回線数"), kind: "num" },
    { prop: "length_km", label: l3("長度", "Length", "延長"), kind: "num", unit: "km", digits: 2 },
    { prop: "date_max", label: l3("資料日期", "Data date", "データ日"), kind: "code" },
    PROVINCE,
  ],
  notes: [l3("來源無電壓欄", "No voltage in the source", "出典に電圧欄なし")],
};
export const CA_SUBSTATION_POPUP: CaPopupSpec = {
  title: { props: [], fallback: l3("變電站", "Substation", "変電所") },
  fields: [
    { prop: "geom_source", label: l3("位置來源", "Location source", "位置の出典"), map: { point: l3("點", "Point", "点"), polygon: l3("面的代表點", "Polygon representative point", "面の代表点") } },
    { prop: "date_max", label: l3("資料日期", "Data date", "データ日"), kind: "code" },
    PROVINCE,
  ],
};

// ─────────────────────────── 能源：油氣（C090） ───────────────────────────

/** 6 個 tile layer＝圖例子項（多選 `caOilGasPartMask`，順序即 option 順序）。 */
export const CA_OIL_GAS_PARTS = [
  { id: "major_pipelines", sourceLayer: "ca_oil_gas_major_pipelines", label: l3("主要管線（CanVec）", "Major pipelines (CanVec)", "主要パイプライン（CanVec）") },
  { id: "major_facilities", sourceLayer: "ca_oil_gas_major_facilities", label: l3("主要石化設施（2017）", "Major facilities (2017)", "主要石油・ガス施設（2017）") },
  { id: "wells", sourceLayer: "ca_oil_gas_wells", label: l3("油氣井（部分，非全量）", "Oil and gas wells (partial)", "油井・ガス井（一部）") },
  { id: "facilities", sourceLayer: "ca_oil_gas_facilities", label: l3("井場與集輸設施", "Well sites and gathering facilities", "坑井・集輸施設") },
  { id: "pipelines", sourceLayer: "ca_oil_gas_pipelines", label: l3("集輸／輸送管線", "Gathering / transmission pipelines", "集輸・輸送パイプライン") },
  { id: "pipeline_points", sourceLayer: "ca_oil_gas_pipeline_points", label: l3("管線附屬設施（riser、valve…）", "Pipeline installations (risers, valves…)", "パイプライン付属設備（ライザー・バルブなど）") },
] as const;
export type CaOilGasPart = (typeof CA_OIL_GAS_PARTS)[number]["id"];
/** 管線物質（主要管線 product、集輸管線 substance 粗分共用三類；多選 `caOilGasPipeMask`）。 */
export const CA_PIPELINE_SUBSTANCES: readonly CaCat[] = [
  { id: "gas", values: ["Natural Gas", "Sour Natural Gas", "Fuel Gas"], color: FOSSIL_PAINT_COLORS.pipelineGas, label: l3("天然氣", "Natural gas", "天然ガス") },
  { id: "oil", values: ["Oil", "Oil-Well Effluent", "Oil Well Effluent", "Crude Oil", "Condensate"], color: fuel("oil"), label: l3("石油／油井流體", "Oil / oil-well effluent", "石油・油井流体") },
  { id: "other", values: [], color: "#9ca3af", label: l3("多用途／其他／未標", "Multi-use / other / not identified", "多用途・その他・不明") },
];
export const CA_MAJOR_FACILITY_TYPES: readonly CaCat[] = [
  { id: "refinery", values: ["refinery"], color: FOSSIL_PAINT_COLORS.industrialRefinery, label: l3("煉油廠", "Refinery", "製油所") },
  { id: "gas_processing", values: ["gas_processing"], color: FOSSIL_PAINT_COLORS.pipelineGas, label: l3("天然氣處理廠", "Gas processing plant", "ガス処理プラント") },
  { id: "lng_terminal", values: ["lng_terminal"], color: FOSSIL_PAINT_COLORS.lngTerminal, label: l3("LNG 終端", "LNG terminal", "LNG ターミナル") },
  { id: "gas_storage", values: ["gas_storage"], color: FOSSIL_PAINT_COLORS.industrialStorageTank, label: l3("地下儲氣", "Underground gas storage", "地下ガス貯蔵") },
];
export const CA_OIL_GAS_WELL_COLOR = FOSSIL_PAINT_COLORS.lpgRetailers;
export const CA_OIL_GAS_FACILITY_COLOR = FOSSIL_PAINT_COLORS.lpgSubpackaging;
export const CA_OIL_GAS_PIPE_POINT_COLOR = FOSSIL_PAINT_COLORS.gasStationOther;
export const CA_OIL_GAS_WELLS_COUNT = 96_466;
export const CA_OIL_GAS_FACILITIES_COUNT = 36_425;
export const CA_ODI_PIPELINES_FROM_ZOOM = 8;
export const CA_ODI_PIPE_POINTS_FROM_ZOOM = 10;
export const CA_OIL_GAS_SOURCE: CaSource = {
  org: "Statistics Canada, Open Database of Infrastructure v2（compiled from AER, BC Energy Regulator, Saskatchewan, Manitoba, Ontario, New Brunswick, Nunavut, NRCan）；NRCan NACEI；NRCan CanVec",
  url: "https://www150.statcan.gc.ca/n1/pub/34-26-0003/342600032023001-eng.htm",
  license: CA_OGL_LICENSE,
  short: "© Statistics Canada ODI v2、NRCan NACEI／CanVec（OGL–Canada）",
};
export const CA_OIL_GAS_NOTES: readonly L3[] = [
  l3("亞伯達井點非全量：AB 井點只是 NRCan 全國井點子集（AER 未提供），不代表全部油氣井", "Alberta wells are not complete: they are only the NRCan national subset (AER did not supply wells)", "アルバータ州の坑井は全量ではない（NRCan 全国坑井の一部のみ、AER は未提供）"),
  l3("ODI 各提供者資料日 2017–2023；主要石化設施 2017", "ODI providers' data dates range 2017–2023; major facilities 2017", "ODI 各提供者のデータ日は 2017–2023、主要施設は 2017"),
  l3("井與設施 z10 起顯示單點、之下為熱區；集輸管線 z8 起、附屬設施 z10 起", "Wells and facilities as points from zoom 10 (heatmap below); gathering pipelines from zoom 8, installations from zoom 10", "坑井・施設はズーム 10 から個別表示（それ以下はヒートマップ）。集輸管線はズーム 8、付属設備はズーム 10 から"),
  l3("涵蓋：主要管線 12/13（PE 未涵蓋）、油氣井 12/13（NS 未涵蓋）、集輸管線 6/13", "Coverage: major pipelines 12/13 (PE not covered), wells 12/13 (NS not covered), gathering pipelines 6/13", "収録：主要パイプライン 12/13（PE 対象外）、坑井 12/13（NS 対象外）、集輸管線 6/13"),
];
const ODI_FIELDS: readonly CaField[] = [
  { prop: "source_class", label: l3("類型", "Type", "種別") },
  { prop: "substance", label: l3("物質", "Substance", "物質") },
  { prop: "status", label: l3("狀態", "Status", "状態") },
  { prop: "ownership", label: l3("所有者", "Owner", "所有者") },
  { prop: "provider", label: l3("資料提供者", "Provider", "データ提供者") },
  PROVINCE,
];
export const CA_OIL_GAS_POPUPS: Record<CaOilGasPart, CaPopupSpec> = {
  major_pipelines: {
    title: { props: [], fallback: CA_OIL_GAS_PARTS[0].label },
    fields: [
      { prop: "product", label: l3("產品", "Product", "製品"), map: { "Natural Gas": l3("天然氣", "Natural gas", "天然ガス"), Oil: l3("石油", "Oil", "石油"), Multiuse: l3("多用途", "Multi-use", "多用途"), "Not Identified": l3("未標", "Not identified", "不明") } },
      { prop: "relation_to_ground", label: l3("地上／地下", "Above / underground", "地上・地下"), map: { Aboveground: l3("地上", "Aboveground", "地上"), Underground: l3("地下", "Underground", "地下") } },
      { prop: "num_pipes", label: l3("管數", "Number of pipes", "管数"), kind: "num" },
      { prop: "length_km", label: l3("長度", "Length", "延長"), kind: "num", unit: "km", digits: 2 },
      PROVINCE,
    ],
  },
  major_facilities: {
    title: { props: ["name"], fallback: CA_OIL_GAS_PARTS[1].label },
    fields: [
      { prop: "facility_type", label: l3("類型", "Type", "種別"), map: Object.fromEntries(CA_MAJOR_FACILITY_TYPES.flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "refinery_type", label: l3("煉油類型", "Refinery type", "製油種別") },
      { prop: "capacity", label: l3("容量", "Capacity", "能力") },
      { prop: "owner", label: l3("業主", "Owner", "所有者") },
      { prop: "operator", label: l3("營運者", "Operator", "運営者") },
      { prop: "city", label: l3("所在城市", "City", "所在地") },
      PROVINCE,
    ],
    notes: [l3("資料日 2017-08（NACEI）", "Data date 2017-08 (NACEI)", "データ日 2017-08（NACEI）")],
  },
  wells: { title: { props: [], fallback: CA_OIL_GAS_PARTS[2].label }, fields: ODI_FIELDS, notes: [CA_OIL_GAS_NOTES[0]!] },
  facilities: { title: { props: [], fallback: CA_OIL_GAS_PARTS[3].label }, fields: ODI_FIELDS },
  pipelines: {
    title: { props: [], fallback: CA_OIL_GAS_PARTS[4].label },
    fields: [
      { prop: "substance", label: l3("物質", "Substance", "物質") },
      { prop: "source_class", label: l3("類型", "Type", "種別") },
      { prop: "status", label: l3("狀態", "Status", "状態") },
      { prop: "diameter_raw", label: l3("管徑（原值）", "Diameter (as published)", "管径（原値）"), kind: "code" },
      { prop: "length_km", label: l3("長度", "Length", "延長"), kind: "num", unit: "km", digits: 2 },
      { prop: "ownership", label: l3("所有者", "Owner", "所有者") },
      { prop: "provider", label: l3("資料提供者", "Provider", "データ提供者") },
      PROVINCE,
    ],
  },
  pipeline_points: { title: { props: [], fallback: CA_OIL_GAS_PARTS[5].label }, fields: ODI_FIELDS },
};

// ─────────────────────────── 人口中心（C022） ───────────────────────────

export const CA_POP_CLASSES: readonly CaCat[] = [
  { id: "large_urban", values: ["large_urban"], color: "#bd4503", label: l3("大都會人口中心（≥10 萬）", "Large urban (≥100,000)", "大都市人口中心（10 万以上）") },
  { id: "medium", values: ["medium"], color: "#f27d1b", label: l3("中型人口中心（3–10 萬）", "Medium (30,000–99,999)", "中規模人口中心（3–10 万）") },
  { id: "small", values: ["small"], color: "#fecc61", label: l3("小型人口中心（1,000–29,999）", "Small (1,000–29,999)", "小規模人口中心（1,000–29,999）") },
];
/** 代表點半徑依 2021 人口 4 級（B 階）。 */
export const CA_POP_BANDS: readonly { min: number; radius: number; label: string }[] = [
  { min: 0, radius: 3, label: "<1 萬" },
  { min: 10_000, radius: 4.5, label: "1–10 萬" },
  { min: 100_000, radius: 7, label: "10–100 萬" },
  { min: 1_000_000, radius: 11, label: "≥100 萬" },
];
export const CA_POP_POLYGON_FROM_ZOOM = 6;
export const CA_POP_SOURCE: CaSource = OGL_SOURCE("Statistics Canada, 2021 Census of Population（98-10-0011-01；Cartographic Boundary File, Population Centres）", "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810001101");
export const CA_POP_NOTES: readonly L3[] = [
  l3("人口中心以外為農村地區（本層不畫）；涵蓋 13/13 省／地區", "Areas outside population centres are rural (not drawn); coverage 13/13", "人口中心以外は農村部（本レイヤーでは描画しない）。13/13 州・準州を収録"),
  l3("「自動」樣式：z6 以下畫代表點（大小依人口），z6 起畫面", "'Auto' style: points sized by population below zoom 6, polygons from zoom 6", "「自動」表示：ズーム 6 未満は人口に応じた代表点、6 以上は面"),
];
export const CA_POP_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("人口中心", "Population centre", "人口中心") },
  fields: [
    { prop: "pc_class", label: l3("規模", "Size class", "規模"), map: Object.fromEntries(CA_POP_CLASSES.map((c) => [c.id, c.label])) },
    { prop: "population_2021", label: l3("2021 人口", "Population 2021", "2021 年人口"), kind: "num" },
    { prop: "pop_change_pct", label: l3("2016→2021 變化", "Change 2016→2021", "2016→2021 増減"), kind: "num", unit: "%", digits: 1 },
    { prop: "density_per_km2", label: l3("人口密度", "Density", "人口密度"), kind: "num", unit: "/km²", digits: 1 },
    { prop: "private_dwellings_2021", label: l3("私人住宅數", "Private dwellings", "民間住宅数"), kind: "num" },
    PROVINCE,
  ],
};
export const CA_POP_PROVINCE_PART = l3("本省部分；整個人口中心 {n} 人", "Part in this province; whole centre {n}", "本州部分。人口中心全体 {n} 人");

// ═══════════════════════════ 第 2 波（面資料與社經、地名與地形；2026-11-04） ═══════════════════════════
// layer-plan：analytics `docs/topic-research/canada_opendata/waves/w2/layer-plan-{areas,terrain}.md`。C002 海域界線、建物 HOLD。

export const CA_STATCAN_SOURCE_NOTE = "Source: Statistics Canada. Contains information licensed under the Open Government Licence – Canada.";

// ─────────────────────────── 聯邦選區（C134，2013 代表令 338 區） ───────────────────────────

export const CA_FED_COUNT = 338;
export const CA_FED_POLYGON_FROM_ZOOM = 6;
export const CA_FED_SOURCE: CaSource = {
  org: "Statistics Canada, 2021 Census Cartographic Boundary Files（Federal electoral districts, 2013 Representation Order）",
  url: "https://open.canada.ca/data/en/dataset/ef70dc3b-1069-4037-9bce-61f47e628a1d",
  license: CA_OGL_LICENSE,
  short: CA_STATCAN_SOURCE_NOTE,
};
export const CA_FED_NOTES: readonly L3[] = [
  l3("2025 大選起改用 2023 代表令 343 區（本層未更新）", "From the 2025 election the 2023 Representation Order (343 districts) applies; this layer is not updated", "2025 年総選挙からは 2023 年代表令（343 区）。本レイヤーは未更新"),
  l3("涵蓋 13/13 省／地區；z6 以下另畫代表點；選區名見點選資訊", "Coverage 13/13; representative points below zoom 6; click for district names", "13/13 州・準州を収録。ズーム 6 未満は代表点。選挙区名はクリックで表示"),
];
export const CA_FED_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("聯邦選區", "Federal electoral district", "連邦選挙区") },
  fields: [
    { prop: "name_en", label: l3("英文名", "English name", "英語名") },
    { prop: "name_fr", label: l3("法文名", "French name", "仏語名") },
    { prop: "fed_uid", label: l3("選區代碼", "District code", "選挙区コード"), kind: "code" },
    PROVINCE,
    { prop: "land_area_km2", label: l3("陸地面積", "Land area", "陸地面積"), kind: "num", unit: "km²", digits: 1 },
  ],
  notes: [l3("2013 Representation Order（2015–2021 大選）", "2013 Representation Order (2015–2021 elections)", "2013 年代表令（2015–2021 年総選挙）")],
};

// ─────────────────────────── 郵遞分區 FSA（X010，1,643 區） ───────────────────────────

export const CA_FSA_COUNT = 1_643;
export const CA_FSA_POLYGON_FROM_ZOOM = 6;
/** V-4 兩類（`rural` 布林轉字串）；農村用同色系較淡色（人口中心色）。 */
export const CA_FSA_CLASSES: readonly CaCat[] = [
  { id: "urban", values: ["false"], color: "#f27d1b", label: l3("都市 FSA（1,462）", "Urban FSA (1,462)", "都市 FSA（1,462）") },
  { id: "rural", values: ["true"], color: "#fecc61", label: l3("農村 FSA（181）", "Rural FSA (181)", "農村 FSA（181）") },
];
export const CA_FSA_SOURCE: CaSource = {
  org: "Statistics Canada, 2021 Census Cartographic Boundary Files（Forward sortation areas）",
  url: "https://open.canada.ca/data/en/dataset/ef70dc3b-1069-4037-9bce-61f47e628a1d",
  license: CA_OGL_LICENSE,
  short: CA_STATCAN_SOURCE_NOTE,
};
export const CA_FSA_ABOUT = l3("Canada Post 分揀區，非行政區；邊界為 StatCan 推估", "Canada Post sorting area, not an administrative unit; boundaries estimated by Statistics Canada", "カナダ郵便の仕分け区域で行政区域ではない。境界は StatCan の推計");
export const CA_FSA_NOTES: readonly L3[] = [
  CA_FSA_ABOUT,
  l3("涵蓋 13/13 省／地區；z6 以下為外框＋代表點熱區，z6 起畫面；代碼見點選資訊", "Coverage 13/13; outlines plus a representative-point heatmap below zoom 6, polygons from 6; click for the code", "13/13 州・準州を収録。ズーム 6 未満は外枠と代表点ヒートマップ、6 以上で面。コードはクリックで表示"),
];
export const CA_FSA_POPUP: CaPopupSpec = {
  title: { props: ["fsa"], fallback: l3("郵遞分區（FSA）", "Forward sortation area", "郵便仕分け区域（FSA）") },
  fields: [
    { prop: "rural", label: l3("都市／農村", "Urban / rural", "都市・農村"), map: { false: l3("都市", "Urban", "都市"), true: l3("農村", "Rural", "農村") } },
    PROVINCE,
    { prop: "land_area_km2", label: l3("陸地面積", "Land area", "陸地面積"), kind: "num", unit: "km²", digits: 1 },
  ],
  notes: [CA_FSA_ABOUT],
};

// ─────────────────────────── 原住民法定土地（C019 CLSS，3,377 筆） ───────────────────────────

export const CA_INDIGENOUS_COUNT = 3_377;
export const CA_INDIGENOUS_POLYGON_FROM_ZOOM = 7;
/** 4 類（`dist_type_en` 合併；layer-plan 建議）。色取自台灣原民 16 族色（兩兩 ΔE ≥ 20、亮色）。 */
export const CA_INDIGENOUS_TYPES: readonly CaCat[] = [
  { id: "reserve", values: ["Indian Reserve"], color: "#ea580c", label: l3("印第安保留地（Indian Reserve，3,289）", "Indian Reserve (3,289)", "インディアン保留地（3,289）") },
  { id: "inuit", values: ["Inuit Owned Land"], color: "#0891b2", label: l3("因紐特人所有地（27）", "Inuit Owned Land (27)", "イヌイット所有地（27）") },
  {
    id: "claim",
    values: ["Yukon First Nations Settlement Land", "Cree and Naskapi 1A and 1A-N Land", "Gwich’in Land", "Tlicho Land", "Inuvialuit Land", "Sahtu Land", "Salt River First Nation Settlement Land"],
    color: "#e879f9",
    label: l3("其他土地索償協定土地（27）", "Other land-claim settlement land (27)", "その他の土地請求協定地（27）"),
  },
  { id: "sechelt", values: ["Sechelt Land", "Indian Land"], color: "#65a30d", label: l3("Sechelt／Indian Land（34）", "Sechelt / Indian Land (34)", "Sechelt・Indian Land（34）") },
];
export const CA_INDIGENOUS_SOURCE: CaSource = {
  org: "Natural Resources Canada, Canada Lands Survey System（Aboriginal Lands of Canada Legislative Boundaries）",
  url: "https://open.canada.ca/data/en/dataset/522b07b9-78e2-4819-b736-ad9208eb1067",
  license: CA_OGL_LICENSE,
  short: "Source: Natural Resources Canada, Canada Lands Survey System. Contains information licensed under the Open Government Licence – Canada.",
};
export const CA_INDIGENOUS_BOUNDARY_NOTE = l3("法定土地邊界僅供參考，官方註明不可用於界定邊界", "Legislative boundaries are for reference only; the publisher states they must not be used to define boundaries", "法定境界は参考用。公式に境界の確定には使用不可とされている");
export const CA_INDIGENOUS_NOTES: readonly L3[] = [
  l3("法定原住民土地（保留地、土地索償協定土地），非傳統領域或條約區", "Legislated Indigenous lands (reserves, land-claim settlement lands), not traditional territories or treaty areas", "法定先住民族地（保留地・土地請求協定地）。伝統的領域や条約地域ではない"),
  CA_INDIGENOUS_BOUNDARY_NOTE,
  l3("涵蓋 13/13 省／地區；z7 以下顯示點，z7 起畫面（Nunavut、NWT 大面拉遠也看得到）", "Coverage 13/13; points below zoom 7, polygons from 7 (large Nunavut / NWT areas visible when zoomed out)", "13/13 州・準州を収録。ズーム 7 未満は点、7 以上で面（ヌナブト・北西準州の大面積は広域でも表示）"),
];
export const CA_INDIGENOUS_POPUP: CaPopupSpec = {
  title: { props: ["name_en", "name_fr"], fallback: l3("原住民法定土地", "Indigenous land", "先住民族地") },
  fields: [
    { prop: "name_fr", label: l3("法文名", "French name", "仏語名") },
    { prop: "dist_type_en", label: l3("類型（英）", "Type (EN)", "種別（英）") },
    { prop: "dist_type_fr", label: l3("類型（法）", "Type (FR)", "種別（仏）") },
    PROVINCE,
    { prop: "accuracy_m", label: l3("精度", "Accuracy", "精度"), kind: "num", unit: "m", positive: true },
    { prop: "rev_date", label: l3("修訂日", "Revised", "改訂日"), kind: "code" },
  ],
  notes: [CA_INDIGENOUS_BOUNDARY_NOTE],
};

// ─────────────────────────── 剝奪指數 CIMD（C023，55,726 DA） ───────────────────────────

export const CA_CIMD_COUNT = 55_726;
export const CA_CIMD_POLYGON_FROM_ZOOM = 6;
/** 5 級共用循序色階（ColorBrewer BuPu；不以紅／綠暗示好壞）。 */
export const CA_CIMD_PALETTE_ID = "BuPu";
export const CA_CIMD_DIMENSIONS = [
  { value: "econ_dep", label: l3("經濟依賴", "Economic dependency", "経済的依存") },
  { value: "res_inst", label: l3("居住不穩定", "Residential instability", "居住の不安定性") },
  { value: "ethno_cult", label: l3("族裔文化組成", "Ethno-cultural composition", "民族・文化構成") },
  { value: "sit_vuln", label: l3("情境脆弱性", "Situational vulnerability", "状況的脆弱性") },
] as const;
export type CaCimdDimension = (typeof CA_CIMD_DIMENSIONS)[number]["value"];
export const CA_CIMD_QUINTILE_LABELS: readonly L3[] = [
  l3("1 最不剝奪", "1 least deprived", "1 最も剥奪が少ない"),
  l3("2", "2", "2"),
  l3("3", "3", "3"),
  l3("4", "4", "4"),
  l3("5 最剝奪", "5 most deprived", "5 最も剥奪が多い"),
];
export const CA_CIMD_SOURCE: CaSource = {
  org: "Statistics Canada, Canadian Index of Multiple Deprivation 2021",
  url: "https://open.canada.ca/data/en/dataset/ec6dc8e7-2fa0-4e49-8969-38541ca0a34d",
  license: CA_OGL_LICENSE,
  short: "Source: Statistics Canada, Canadian Index of Multiple Deprivation 2021. Contains information licensed under the Open Government Licence – Canada.",
};
export const CA_CIMD_ETHNO_NOTE = l3("族裔文化組成：高＝移民／少數族裔比例高，不代表貧困", "Ethno-cultural composition: high = larger share of immigrants / visible minorities, not poverty", "民族・文化構成：高＝移民・可視的少数者の割合が高い。貧困を意味しない");
export const CA_CIMD_NOTES: readonly L3[] = [
  l3("全國 DA（傳播區）五分位：1 最不剝奪…5 最剝奪；一次顯示一個面向", "National dissemination-area quintiles: 1 least … 5 most deprived; one dimension at a time", "全国 DA 五分位：1 最も少ない…5 最も多い。表示は一度に 1 指標"),
  CA_CIMD_ETHNO_NOTE,
  l3("YT、NT、NU 未涵蓋；另 2,206 個 DA 無指數（斜線／灰點，不當 0）", "YT, NT and NU not covered; 2,206 more DAs have no index (hatched / grey dots, never 0)", "YT・NT・NU は対象外。ほか 2,206 DA は指数なし（斜線・灰色点、0 扱いしない）"),
  l3("z6 以下畫 DA 代表點，z6 起畫面", "DA representative points below zoom 6, polygons from 6", "ズーム 6 未満は DA 代表点、6 以上で面"),
];

// ─────────────────────────── 租金 CMHC（C026，146 區） ───────────────────────────

export const CA_RENTS_COUNT = 146;
export const CA_RENTS_POLYGON_FROM_ZOOM = 6;
/** 住宅主題色（statistics-layer-guidelines §4 住宅 Oranges → 色盤庫 YlOrBr）。 */
export const CA_RENTS_PALETTE_ID = "YlOrBr";
/** 房型與分級門檻（加元；5 級＝4 個門檻）。2 房照 layer-plan，其他房型依分布取整數門檻（固定，不依當次資料重算）。 */
export const CA_RENT_UNITS = [
  { value: "br2", prop: "rent_br2", label: l3("2 房", "2 bedrooms", "2 寝室"), breaks: [1000, 1250, 1500, 1750] },
  { value: "bachelor", prop: "rent_bachelor", label: l3("套房（Bachelor）", "Bachelor", "ワンルーム（Bachelor）"), breaks: [800, 950, 1100, 1250] },
  { value: "br1", prop: "rent_br1", label: l3("1 房", "1 bedroom", "1 寝室"), breaks: [900, 1100, 1300, 1500] },
  { value: "br3", prop: "rent_br3", label: l3("3 房以上", "3+ bedrooms", "3 寝室以上"), breaks: [1200, 1500, 1800, 2100] },
] as const;
export type CaRentUnit = (typeof CA_RENT_UNITS)[number]["value"];
export const CA_RENTS_SOURCE: CaSource = {
  org: "Source: CMHC Rental Market Survey (Statistics Canada Table 34-10-0133-01)；邊界 Statistics Canada 2021 CMA／CA",
  url: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301",
  license: CA_OGL_LICENSE,
  short: "Source: CMHC Rental Market Survey (Statistics Canada Table 34-10-0133-01)（OGL–Canada）",
};
export const CA_RENTS_NOT_PUBLISHED = l3("不公布", "Not published", "非公表");
export const CA_RENTS_NOTES: readonly L3[] = [
  l3("CMHC 租金調查（每年 10 月），私人三戶以上出租住宅平均月租；只含人口 1 萬以上的 CMA／CA；Nunavut 未涵蓋", "CMHC Rental Market Survey (each October): average monthly rent in private rental buildings of 3+ units; CMAs / CAs of 10,000+ only; Nunavut not covered", "CMHC 賃貸市場調査（毎年 10 月）。3 戸以上の民間賃貸住宅の平均月額家賃。人口 1 万以上の CMA／CA のみ。ヌナブト準州は対象外"),
  l3("Yukon 只有 Whitehorse，租金不公布", "Yukon: Whitehorse only, rent not published", "ユーコン準州は Whitehorse のみで家賃非公表"),
  l3("不公布／無資料畫斜線（點為灰），不當 0；資料年 2025", "Not published / no data is hatched (grey dots), never 0; data year 2025", "非公表・データなしは斜線（点は灰色）で 0 扱いしない。データ年 2025"),
  l3("z6 以下畫代表點，z6 起畫面", "Representative points below zoom 6, polygons from 6", "ズーム 6 未満は代表点、6 以上で面"),
];

// ─────────────────────────── 地名（CGNDB，364,736 筆） ───────────────────────────

export const CA_PLACE_NAMES_COUNT = 364_736;
export const CA_PLACE_GROUPS: readonly CaCat[] = [
  { id: "settlement", values: ["settlement"], color: "#f27d1b", label: l3("聚落（29,754）", "Settlements (29,754)", "集落（29,754）") },
  { id: "admin", values: ["admin"], color: "#e879f9", label: l3("行政區與原住民保留地（10,278）", "Administrative areas and reserves (10,278)", "行政区域・先住民保留地（10,278）") },
  { id: "park", values: ["park"], color: "#16a34a", label: l3("公園與保護區（10,301）", "Parks and protected areas (10,301)", "公園・保護区（10,301）") },
  { id: "water", values: ["water"], color: "#38bdf8", label: l3("水體（224,426）", "Water features (224,426)", "水域（224,426）") },
  { id: "terrain", values: ["terrain"], color: "#b8a080", label: l3("山岳、地形與冰川（75,865）", "Mountains, landforms and glaciers (75,865)", "山岳・地形・氷河（75,865）") },
  { id: "constructed", values: ["constructed"], color: "#fcd34d", label: l3("人工設施（11,281）", "Constructed features (11,281)", "人工施設（11,281）") },
  { id: "other", values: ["other"], color: "#9ca3af", label: l3("其他（2,831）", "Other (2,831)", "その他（2,831）") },
];
export const CA_PLACE_NAMES_SOURCE: CaSource = {
  org: "Natural Resources Canada, Canadian Geographical Names Database（CGNDB）",
  url: "https://open.canada.ca/data/en/dataset/e27c6eba-3c5d-4051-9db2-082dc6411c2c",
  license: CA_OGL_LICENSE,
  short: "Contains information licensed under the Open Government Licence – Canada. Natural Resources Canada, Canadian Geographical Names Database",
};
export const CA_PLACE_NAMES_NOTES: readonly L3[] = [
  l3("依官方建議顯示比例尺逐級出現（z3 約 300 個，z12 全部）；名稱見點選資訊", "Names appear progressively by the official relevance scale (about 300 at zoom 3, all by zoom 12); click a point for its name", "公式の推奨表示縮尺に応じて段階表示（ズーム 3 で約 300、12 で全件）。名称はクリックで表示"),
  l3("資料庫含部分冒犯性歷史地名，命名機關仍在修訂", "The database still contains some offensive historical names; naming authorities are revising them", "データベースには一部不快な歴史的地名が残り、命名機関が改訂中"),
  l3("涵蓋 13/13 省／地區；只收官方核定名稱", "Coverage 13/13; official names only", "13/13 州・準州を収録。公式名称のみ"),
];
export const CA_PLACE_NAMES_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("地名", "Place name", "地名") },
  fields: [
    { prop: "names_other", label: l3("其他名稱", "Other names", "別名") },
    { prop: "syllabic", label: l3("音節文字", "Syllabics", "音節文字") },
    { prop: "generic_term", label: l3("類別（英）", "Generic term (EN)", "種別（英）") },
    { prop: "generic_term_fr", label: l3("類別（法）", "Generic term (FR)", "種別（仏）") },
    { prop: "language", label: l3("語言", "Language", "言語") },
    { prop: "location", label: l3("位置描述", "Location", "位置") },
    PROVINCE,
    { prop: "decision_date", label: l3("核定日", "Decision date", "決定日"), kind: "code" },
    { prop: "source_agency", label: l3("命名機關", "Naming authority", "命名機関") },
    { prop: "cgndb_id", label: l3("CGNDB 代碼", "CGNDB ID", "CGNDB ID"), kind: "code" },
  ],
};

// ─────────────────────────── 山體陰影（MRDEM-30） ───────────────────────────

export const CA_HILLSHADE_COPERNICUS = "Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.";
export const CA_HILLSHADE_SOURCE: CaSource = {
  org: "Natural Resources Canada, Medium Resolution Digital Elevation Model（MRDEM-30）",
  url: "https://open.canada.ca/data/en/dataset/18752265-bda3-498c-a4ba-9dfe68cb98da",
  license: CA_OGL_LICENSE,
  short: `${CA_OGL_SENTENCE} NRCan MRDEM-30. ${CA_HILLSHADE_COPERNICUS}`,
};
export const CA_HILLSHADE_NOTES: readonly L3[] = [
  l3("NRCan 預產的 MRDEM-30 山體陰影，取 240 m 解析度；z3–8", "NRCan pre-computed MRDEM-30 hillshade at 240 m resolution; zoom 3–8", "NRCan 作成の MRDEM-30 陰影起伏（240 m 解像度）、ズーム 3–8"),
  l3("大型湖泊與哈德遜灣為來源空白（透明）", "Large lakes and Hudson Bay are blank in the source (transparent)", "大きな湖とハドソン湾は出典で空白（透明）"),
];
