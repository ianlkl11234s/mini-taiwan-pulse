/**
 * 泰國第 0–1 波（2026-11-22）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。
 * - 行政邊界（C001）與人口（C023）：COD-AB 國界／77 府／928 amphoe／7,425 tambon 面（人口只有府、amphoe 兩層），專用 hook `useThLayers.ts`。
 * - 其餘 8 層重用菲律賓規格引擎（`PhLayerSpec`＋`usePhDataLayer`），一個 dataset 一個 key、一支 PMTiles。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/data-catalog/<theme>/th_*.md` 與
 * `docs/topic-research/thailand_opendata/waves/w01/FRONTEND_SPEC.md`（各 `_manifest.json` 2026-11-22 讀）。
 * 不畫暹羅灣、安達曼海任何海域主張線（C002 不做）。
 * 授權空白的官方來源（NGIS、GISTDA Hosted、DOH drive）照常上線（使用者 2026-11-21），圖例與署名一律寫「授權未明示」＋機關名；
 * Overture 來源（電網、儲槽管線、加油站）寫「Overture 補缺（非官方）」；OSM 層署名 © OpenStreetMap contributors（ODbL）。
 */
import type { ThDataKey } from "./thDataKeys";
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhSizeBands } from "./phDataLayers";

export type { L3 } from "./phDataLayers";
export { pickL3, phText } from "./phDataLayers";

type Expr = unknown[];
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export const TH_FETCHED_AT = "2026-11-22";
const ODBL = "ODbL 1.0";
const OVERTURE_URL = "https://overturemaps.org/";
const GEM_URL = "https://globalenergymonitor.org/projects/";
const NGIS_URL = "https://ngis.go.th/";
const OSM_OVERTURE = "© OpenStreetMap contributors（ODbL），via Overture Maps Foundation";
const OVERTURE_NOTE = l3("Overture 補缺（非官方）：OSM 志願者繪製，完整度未經官方核對", "Overture gap-fill (unofficial): OSM volunteer-mapped, completeness not officially verified", "Overture 補完（非公式）：OSM のボランティア作図で、網羅性は公式に未確認");
/** 授權空白的官方來源（NGIS、GISTDA Hosted、DOH drive）：使用者 2026-11-21 決定照常上線並標示。 */
export const TH_LICENSE_UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
/** 邊界立場聲明（泰柬邊界段照 COD-AB 原樣）。 */
export const TH_BOUNDARY_NOTE = l3("邊界依 OCHA COD-AB（來源 Royal Thai Survey Department），不代表任何立場（含泰柬邊界段）；不畫海域主張線", "Boundaries follow OCHA COD-AB (source: Royal Thai Survey Department) and imply no position (including the Thailand–Cambodia section); no maritime claim lines", "境界は OCHA COD-AB（出典 Royal Thai Survey Department）に基づき、いかなる立場も示さない（タイ・カンボジア国境区間を含む）。海域の主張線は描画しない");

// ═════════════════════════ 行政邊界、人口 ═════════════════════════

/** 四層級＝PMTiles tile layer 名（select encode 順序）；srcMinzoom／srcMaxzoom＝檔內該層實際縮放範圍。 */
export const TH_ADMIN_LEVELS = [
  { value: "country", label: "國界（Country）", srcMinzoom: 2, srcMaxzoom: 8 },
  { value: "province", label: "府（Province，77）", srcMinzoom: 3, srcMaxzoom: 10 },
  { value: "amphoe", label: "縣（Amphoe／Khet，928）", srcMinzoom: 6, srcMaxzoom: 11 },
  { value: "tambon", label: "區（Tambon／Khwaeng，7,425）", srcMinzoom: 9, srcMaxzoom: 13 },
] as const;
export type ThAdminLevel = (typeof TH_ADMIN_LEVELS)[number]["value"];
export const TH_ADMIN_LEVEL_LABELS: Record<ThAdminLevel, L3> = {
  country: l3("國界", "Country", "国境"),
  province: l3("府（Province）", "Province", "県（Province）"),
  amphoe: l3("縣（Amphoe／Khet）", "District (Amphoe / Khet)", "郡（Amphoe／Khet）"),
  tambon: l3("區（Tambon／Khwaeng）", "Sub-district (Tambon / Khwaeng)", "区（Tambon／Khwaeng）"),
};
/** 人口只有府、amphoe 兩層（來源最細到 amphoe；tambon 沒有人口）。 */
export const TH_POP_LEVELS = [
  { value: "province", label: "府（Province，77）", srcMinzoom: 3, srcMaxzoom: 10 },
  { value: "amphoe", label: "縣（Amphoe／Khet，928）", srcMinzoom: 6, srcMaxzoom: 13 },
] as const;
export type ThPopLevel = (typeof TH_POP_LEVELS)[number]["value"];
export const TH_ADMIN_COLOR = "#9ca3af";
export const TH_ADMIN_SOURCE = {
  org: l3("OCHA COD-AB Thailand v01（來源 Royal Thai Survey Department），via HDX", "OCHA COD-AB Thailand v01 (source: Royal Thai Survey Department), via HDX", "OCHA COD-AB Thailand v01（出典 Royal Thai Survey Department）、HDX 経由"),
  url: "https://data.humdata.org/dataset/cod-ab-tha",
  license: "CC BY-IGO 3.0",
  short: "© OCHA COD-AB Thailand（RTSD，HDX，CC BY-IGO）",
} as const;
export const TH_ADMIN_NOTES: readonly L3[] = [
  l3("國界 1、府 77、縣（amphoe／khet）928、區（tambon／khwaeng）7,425；一次只顯示一個層級", "1 country, 77 provinces, 928 districts (amphoe / khet), 7,425 sub-districts (tambon / khwaeng); one level at a time", "国境 1・県 77・郡（amphoe／khet）928・区（tambon／khwaeng）7,425。一度に 1 階層のみ表示"),
  l3("曼谷 khwaeng 標註：版本落後（本層 169，官方現行 180）", "Bangkok khwaeng note: outdated edition (this layer 169, official 180)", "バンコクの khwaeng：版が古い（本レイヤー 169、公式現行 180）"),
  TH_BOUNDARY_NOTE,
];

/** 人口密度（人／km²）6 級斷點（沿用菲律賓）；amphoe 密度中位數 123.8。 */
export const TH_DENSITY_BREAKS = [100, 300, 1000, 5000, 20000] as const;
export const TH_DENSITY_LABELS = ["<100", "100–300", "300–1,000", "1,000–5,000", "5,000–20,000", "≥20,000"] as const;
/** 未涵蓋＝灰（不畫成 0）。 */
export const TH_NOT_COVERED_COLOR = "#6b7280";
export const TH_POP_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export const TH_POPULATION_SOURCE = {
  org: l3("National Statistical Office of Thailand（NSO）OS_0405_01_0005_01（來源 DOPA 戶籍登記）；邊界 OCHA COD-AB Thailand v01（CC BY-IGO）", "National Statistical Office of Thailand (NSO) OS_0405_01_0005_01 (source: DOPA civil registration); boundaries: OCHA COD-AB Thailand v01 (CC BY-IGO)", "National Statistical Office of Thailand（NSO）OS_0405_01_0005_01（出典 DOPA 住民登録）。境界：OCHA COD-AB Thailand v01（CC BY-IGO）"),
  url: "https://gdcatalog.go.th/dataset/gdpublish-os-01010200-0101",
  license: l3("Creative Commons Attributions（版本號未見）", "Creative Commons Attributions (version not stated)", "Creative Commons Attributions（バージョン不明）"),
  short: l3("NSO Thailand（DOPA 戶籍登記），Creative Commons Attributions（版本未見）", "NSO Thailand (DOPA civil registration), Creative Commons Attributions (version not stated)", "NSO Thailand（DOPA 住民登録）、Creative Commons Attributions（バージョン不明）"),
} as const;
export const TH_POPULATION_NOTES: readonly L3[] = [
  l3("戶籍人口（DOPA 登記），不是普查實住人口；顯示 2025，另附 2021–2025", "Registered population (DOPA civil registration), not census residents; 2025 shown, 2021–2025 in the popup", "住民登録人口（DOPA）で、国勢調査の居住人口ではない。2025 年を表示、ポップアップに 2021–2025"),
  l3("密度＝人口 ÷ 面積；灰色＝未涵蓋（不是 0）", "Density = population ÷ area; grey = not covered (not zero)", "密度＝人口 ÷ 面積。灰色＝未収録（0 ではない）"),
  l3("府層 z3–10、縣層 z6–13；人口最細到 amphoe（tambon 沒有）", "Province level z3–10, district level z6–13; finest population level is amphoe (none for tambon)", "県レベル z3–10、郡レベル z6–13。人口は amphoe まで（tambon はない）"),
  TH_BOUNDARY_NOTE,
];
export const TH_POP_STATUS: Record<string, L3> = {
  ok: l3("登記值", "Registered count", "登録値"),
  not_covered: l3("未涵蓋", "Not covered", "未収録"),
};

// ═════════════════════════ 規格驅動 8 層 ═════════════════════════

export interface ThLayerSpec extends PhLayerSpec<ThDataKey> {
  /** 狀態多選（GEM 電廠）；沒有 status 欄的點（DEDE、OSM）不受影響。預設值見 `statusDefault` */
  statusDefault?: readonly string[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const PROVINCE_FIELDS: readonly PhField[] = [
  { prop: "province_th", label: l3("府（泰文）", "Province (Thai)", "県（タイ語）") },
  { prop: "province_en", label: l3("府（英文）", "Province (English)", "県（英語）") },
];
const COVERAGE_NOTE = (n: number) => l3(`有點的府 ${n}／77；沒有點的府是未涵蓋，不代表沒有`, `Points in ${n} of 77 provinces; provinces without points are not covered, not empty`, `点がある県は 77 中 ${n}。点のない県は未収録で、存在しないという意味ではない`);
const NEAREST_NOTE: PhNote = { text: l3("點落在府界外（岸邊、河道），府取最近者", "Point lies outside province polygons (shore, river); nearest province used", "点が県境の外（海岸・河道）にあり、最寄りの県を採用"), when: (p) => str(p.province_method) === "nearest" };

// ───────────── 狀態（GEM 電廠；順序＝多選 bitmask） ─────────────
export const TH_STATUSES = [
  { id: "operating", label: l3("運轉中", "Operating", "運転中") },
  { id: "construction", label: l3("興建中", "Under construction", "建設中") },
  { id: "pre-construction", label: l3("籌備中", "Pre-construction", "着工準備中") },
  { id: "announced", label: l3("已公告", "Announced", "発表済み") },
  { id: "mothballed", label: l3("封存", "Mothballed", "休止") },
  { id: "retired", label: l3("退役", "Retired", "廃止") },
  { id: "cancelled", label: l3("取消", "Cancelled", "中止") },
] as const;
export const TH_STATUS_IDS = TH_STATUSES.map((s) => s.id);
const STATUS_MAP = Object.fromEntries(TH_STATUSES.map((s) => [s.id, s.label]));

/** 狀態篩選：沒有 status 欄的點（DEDE、OSM）不受影響。`selected` undefined＝預設。 */
export function thStatusFilter(spec: ThLayerSpec, selected: readonly string[] | undefined): Expr | null {
  if (!spec.statusDefault) return null;
  const sel = selected ?? spec.statusDefault;
  if (sel.length === TH_STATUS_IDS.length) return null;
  return ["any", ["!", ["has", "status"]], ["in", ["get", "status"], ["literal", [...sel]]]];
}

const SOURCE_MAP: Record<string, L3> = {
  dede_ngis: l3("DEDE（NGIS，授權未明示）", "DEDE (NGIS, license not stated)", "DEDE（NGIS、ライセンス未明示）"),
  gem: l3("Global Energy Monitor（CC BY 4.0）", "Global Energy Monitor (CC BY 4.0)", "Global Energy Monitor（CC BY 4.0）"),
  osm: l3("OSM 補缺（Overture，非官方）", "OSM gap-fill (Overture, unofficial)", "OSM 補完（Overture、非公式）"),
};
const OSM_HOLLOW = { when: ["==", ["get", "source"], "osm"] as Expr, js: (p: Record<string, unknown>) => str(p.source) === "osm", label: l3("空心：OSM 補缺（Overture，非官方）", "Hollow: OSM gap-fill (Overture, unofficial)", "中抜き：OSM 補完（Overture、非公式）") };

// ───────────── 機場、港口、渡輪碼頭（C014） ─────────────
const AIRPORT_COLOR = "#f472b6";
const hubsCat: PhCatGetter = {
  expr: ["case", ["==", ["get", "kind"], "airport"], ["to-string", ["coalesce", ["get", "ap_class"], "airport"]], ["to-string", ["coalesce", ["get", "kind"], ""]]],
  js: (p) => (str(p.kind) === "airport" ? str(p.ap_class) || "airport" : str(p.kind)),
};
/** 預設不顯示無名機場（GISTDA 51 筆沒有任何名稱、性質未驗；主 agent 2026-11-22 決定）。 */
const HUB_NAMED_FILTER: Expr = ["any", ["!=", ["get", "kind"], "airport"], ["has", "name_th"], ["has", "name_en"], ["has", "name_osm"]];
const HUB_CATS: readonly PhCat[] = [
  { id: "intl", values: ["international"], color: AIRPORT_COLOR, radius: 6.5, label: l3("國際機場（推定）", "International airport (inferred)", "国際空港（推定）") },
  { id: "airport", values: ["airport"], color: AIRPORT_COLOR, radius: 5, label: l3("機場（推定）", "Airport (inferred)", "空港（推定）") },
  { id: "airfield", values: ["airfield"], color: AIRPORT_COLOR, radius: 3.5, label: l3("簡易機場、飛行場（推定）", "Airfield (inferred)", "飛行場（推定）") },
  { id: "port", values: ["port"], color: "#38bdf8", radius: 4.5, label: l3("港口（OSM 補缺）", "Port (OSM gap-fill)", "港（OSM 補完）") },
  { id: "ferry", values: ["ferry_terminal"], color: "#2dd4bf", radius: 3, label: l3("渡輪碼頭（OSM 補缺）", "Ferry terminal (OSM gap-fill)", "フェリーターミナル（OSM 補完）") },
];

// ───────────── 車站（C010） ─────────────
const STATION_CATS: readonly PhCat[] = [
  { id: "rail_light", values: ["rail_light"], color: "#f59e0b", radius: 4, parts: ["th-stations-circle"], label: l3("輕軌（BTS 天空列車、SRT 紅線）", "Light rail (BTS Skytrain, SRT Red Line)", "ライトレール（BTS スカイトレイン・SRT レッドライン）") },
  { id: "rail_metro", values: ["rail_metro"], color: "#a78bfa", radius: 4, parts: ["th-stations-circle"], label: l3("地鐵（MRT）", "Metro (MRT)", "地下鉄（MRT）") },
  { id: "rail_srt", values: ["rail_srt"], color: "#ef4444", radius: 4.5, parts: ["th-stations-circle"], label: l3("國鐵（SRT）", "State Railway (SRT)", "国鉄（SRT）") },
  { id: "ferry", values: ["ferry"], color: "#38bdf8", radius: 4, parts: ["th-stations-circle"], label: l3("渡輪碼頭", "Ferry pier", "フェリー乗り場") },
  { id: "bus_stop", values: ["bus_stop"], color: "#94a3b8", radius: 2.5, parts: ["th-bus-stops-circle"], label: l3("公車站（z11 起顯示）", "Bus stop (shown from z11)", "バス停（z11 以上で表示）") },
  { id: "bus_unknown", values: ["unknown"], color: "#64748b", radius: 2.5, parts: ["th-bus-stops-circle"], label: l3("公車站（無班次資料）", "Bus stop (no service data)", "バス停（運行データなし）") },
];

// ───────────── 主要道路與鐵道（C013） ─────────────
const ROAD_CATS: readonly PhCat[] = [
  { id: "motorway", values: ["motorway"], color: "#ef4444", parts: ["th-major-roads-line"], label: l3("高速公路（motorway）", "Motorway", "高速道路（motorway）") },
  { id: "trunk", values: ["trunk"], color: "#f59e0b", parts: ["th-major-roads-line"], label: l3("國道・全國連結（trunk）", "National link (trunk)", "国道・全国連絡（trunk）") },
  { id: "primary", values: ["primary"], color: "#facc15", parts: ["th-major-roads-line"], label: l3("區域連結（primary）", "Regional link (primary)", "地域連絡（primary）") },
  { id: "secondary", values: ["secondary"], color: "#fde68a", parts: ["th-major-roads-line"], label: l3("府級連結（secondary）", "Provincial link (secondary)", "県レベル連絡（secondary）") },
  { id: "tertiary", values: ["tertiary"], color: "#d6d3d1", parts: ["th-major-roads-line"], label: l3("縣級連結（tertiary）", "District link (tertiary)", "郡レベル連絡（tertiary）") },
  { id: "unspecified", values: ["unspecified"], color: "#94a3b8", parts: ["th-major-roads-line"], label: l3("等級未明", "Class not specified", "等級不明") },
  { id: "rail", values: ["ngis_l02008"], color: "#a78bfa", parts: ["th-major-rail-line"], label: l3("鐵道（NGIS，授權未明示）", "Railway (NGIS, license not stated)", "鉄道（NGIS、ライセンス未明示）") },
];

// ───────────── 電廠（C088） ─────────────
const PLANT_CATS: readonly PhCat[] = [
  { id: "coal", values: ["coal"], color: "#F2622E", label: l3("燃煤", "Coal", "石炭") },
  { id: "gas", values: ["gas"], color: "#F2D64B", label: l3("燃氣", "Gas", "ガス") },
  { id: "hydro", values: ["hydro", "hydro_large", "hydro_mini"], color: "#3C92A6", label: l3("水力（大型、小水力）", "Hydro (large, mini)", "水力（大規模・小水力）") },
  { id: "biomass", values: ["biomass", "biogas"], color: "#8C7C4A", label: l3("生質能、沼氣", "Biomass, biogas", "バイオマス・バイオガス") },
  { id: "waste", values: ["waste"], color: "#a8a29e", label: l3("廢棄物發電", "Waste-to-energy", "廃棄物発電") },
  { id: "solar", values: ["solar"], color: "#F2E085", label: l3("太陽光電", "Solar", "太陽光") },
  { id: "wind", values: ["wind"], color: "#2F5A99", label: l3("風力", "Wind", "風力") },
  { id: "geothermal", values: ["geothermal"], color: "#8C5D42", label: l3("地熱", "Geothermal", "地熱") },
];
export const TH_CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 3, label: "<10" }, { min: 10, radius: 4.5, label: "10–100" }, { min: 100, radius: 7, label: "100–1,000" }, { min: 1000, radius: 11, label: "≥1,000" }],
};
const TECH_MAP = Object.fromEntries([...PLANT_CATS.flatMap((c) => c.values.map((v) => [v, c.label])), ["other", l3("其他", "Other", "その他")]]);

// ───────────── 電網（C089） ─────────────
const KV_CATS: readonly PhCat[] = [
  { id: "kv500", values: ["500kV+"], color: "#1AB6D9", label: l3("500 kV 以上", "500 kV and above", "500 kV 以上") },
  { id: "kv230", values: ["230kV"], color: "#62D9AD", label: l3("230 kV", "230 kV", "230 kV") },
  { id: "kv115", values: ["115-138kV"], color: "#c084fc", label: l3("115–138 kV", "115–138 kV", "115–138 kV") },
  { id: "kv69", values: ["69kV", "<69kV"], color: "#ffa41b", label: l3("69 kV 以下（含配電）", "69 kV and below (incl. distribution)", "69 kV 以下（配電を含む）") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("電壓未知", "Voltage unknown", "電圧不明") },
];
const KV_WIDTH: Record<string, readonly [number, number]> = { "500kV+": [2, 3.5], "230kV": [1.5, 2.8], "115-138kV": [1, 2], "69kV": [0.5, 1], "<69kV": [0.5, 1], unknown: [0.5, 1] };

// ───────────── 再生能源（C091） ─────────────
const RENEWABLE_CATS: readonly PhCat[] = [
  { id: "wind_farm", values: ["wind_farm"], color: "#2F5A99", parts: ["th-renewables-circle"], label: l3("風場（DEDE）", "Wind farm (DEDE)", "ウィンドファーム（DEDE）") },
  { id: "solar_plant", values: ["solar_plant"], color: "#F2E085", parts: ["th-renewables-circle"], label: l3("太陽能（DEDE，含屋頂型）", "Solar (DEDE, incl. rooftop)", "太陽光（DEDE、屋根置きを含む）") },
  { id: "geothermal", values: ["geothermal"], color: "#8C5D42", parts: ["th-renewables-circle"], label: l3("地熱（DEDE）", "Geothermal (DEDE)", "地熱（DEDE）") },
  { id: "wind_turbine", values: ["wind_turbine"], color: "#60a5fa", parts: ["th-wind-turbines-circle"], label: l3("風機機組點（OSM 補缺，z9 起）", "Wind turbine (OSM gap-fill, from z9)", "風車ユニット（OSM 補完、z9 以上）") },
];
const KIND_MAP = Object.fromEntries(RENEWABLE_CATS.map((c) => [c.values[0]!, c.label]));

// ───────────── 加油站（C092） ─────────────
const FUEL_CATS: readonly PhCat[] = [
  { id: "ptt", values: ["PTT"], color: "#3b82f6", label: l3("PTT", "PTT", "PTT") },
  { id: "bangchak", values: ["Bangchak"], color: "#22c55e", label: l3("Bangchak", "Bangchak", "Bangchak") },
  { id: "shell", values: ["Shell"], color: "#facc15", label: l3("Shell", "Shell", "Shell") },
  { id: "esso", values: ["Esso"], color: "#ef4444", label: l3("Esso", "Esso", "Esso") },
  { id: "caltex", values: ["Caltex"], color: "#f97316", label: l3("Caltex", "Caltex", "Caltex") },
  { id: "pt", values: ["PT"], color: "#2dd4bf", label: l3("PT", "PT", "PT") },
  { id: "susco", values: ["Susco"], color: "#a78bfa", label: l3("Susco", "Susco", "Susco") },
];

// ───────────── 儲槽與管線（C093） ─────────────
const pipeFacilityCat: PhCatGetter = {
  expr: ["case", ["==", ["get", "kind"], "lng_terminal"], "lng_terminal", ["to-string", ["coalesce", ["get", "content_group"], "unknown"]]],
  js: (p) => (str(p.kind) === "lng_terminal" ? "lng_terminal" : str(p.content_group) || "unknown"),
};
const PIPE_CATS: readonly PhCat[] = [
  { id: "oil_gas", values: ["oil_gas"], color: "#f97316", label: l3("油氣", "Oil and gas", "石油・ガス") },
  { id: "lng_terminal", values: ["lng_terminal"], color: "#f43f5e", radius: 5.5, parts: ["th-pipeline-facilities-circle"], label: l3("LNG 接收站（GEM）", "LNG terminal (GEM)", "LNG 受入基地（GEM）") },
  { id: "water", values: ["water"], color: "#38bdf8", label: l3("水", "Water", "水") },
  { id: "wastewater", values: ["wastewater"], color: "#a16207", label: l3("污水", "Wastewater", "下水") },
  { id: "other", values: ["other"], color: "#a78bfa", label: l3("其他", "Other", "その他") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("未標示內容物", "Contents not tagged", "内容物の記載なし") },
];
/** 圖層預設只開油氣與 LNG 接收站；「未標示」可自行打開（主 agent 2026-11-22）。 */
export const TH_PIPELINES_DEFAULT_CATS = ["oil_gas", "lng_terminal"] as const;

export const TH_DATA_SPECS: readonly ThLayerSpec[] = [
  {
    key: "thTransportHubs", file: "th_transport_hubs.pmtiles", sourceId: "th-transport-hubs", srcMinzoom: 4, srcMaxzoom: 14, color: AIRPORT_COLOR, count: 706,
    parts: [{ id: "th-hubs-circle", sourceLayer: "hubs", geom: "point", minzoom: 4, cat: hubsCat, filter: HUB_NAMED_FILTER }],
    cats: HUB_CATS,
    title: { props: ["name_th", "name_en", "name_osm"], fallback: l3("機場、港口、渡輪碼頭", "Airport / port / ferry terminal", "空港・港・フェリーターミナル"),
      fallbackBy: { prop: "kind", map: { port: l3("未命名港口", "Unnamed port", "名称不明の港"), ferry_terminal: l3("未命名渡輪碼頭", "Unnamed ferry terminal", "名称不明のフェリーターミナル") } } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { airport: l3("機場", "Airport", "空港"), port: l3("港口", "Port", "港"), ferry_terminal: l3("渡輪碼頭", "Ferry terminal", "フェリーターミナル") } },
      { prop: "ap_class", label: l3("機場分類（由名稱推定）", "Airport class (inferred from name)", "空港分類（名称から推定）"), map: { international: l3("國際機場", "International", "国際空港"), airport: l3("機場", "Airport", "空港"), airfield: l3("簡易機場、飛行場", "Airfield", "飛行場") } },
      { prop: "iata", label: l3("IATA", "IATA", "IATA"), kind: "code" },
      { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "pax_2018", label: l3("旅客數（L14 佛曆 2561 欄，單位來源未標）", "Passengers (L14 BE 2561 column, unit not stated)", "旅客数（L14 仏暦 2561 の列、単位は出典に記載なし）"), kind: "num" },
      { prop: "runway_surface", label: l3("跑道面", "Runway surface", "滑走路面") },
      { prop: "source", label: l3("來源", "Source", "出典"), map: { osm: l3("OSM 補缺", "OSM gap-fill", "OSM 補完"), gistda_hosted: l3("GISTDA Hosted（授權未明示）", "GISTDA Hosted (license not stated)", "GISTDA Hosted（ライセンス未明示）"),
        ngis_l14: l3("NGIS L14（授權未明示）", "NGIS L14 (license not stated)", "NGIS L14（ライセンス未明示）"), "ngis_l14+gistda_hosted": l3("NGIS L14＋GISTDA Hosted（授權未明示）", "NGIS L14 + GISTDA Hosted (license not stated)", "NGIS L14＋GISTDA Hosted（ライセンス未明示）") } },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("機場 144 處（NGIS L14、GISTDA Hosted，授權未明示）；港口 38、渡輪碼頭 524（OSM 補缺，ODbL）", "144 airports (NGIS L14, GISTDA Hosted, license not stated); 38 ports and 524 ferry terminals (OSM gap-fill, ODbL)", "空港 144（NGIS L14・GISTDA Hosted、ライセンス未明示）、港 38・フェリーターミナル 524（OSM 補完、ODbL）"),
      l3("預設不顯示無名機場（51 筆沒有任何名稱、性質未驗）；機場分類由名稱推定", "Unnamed airports (51 records with no name, nature unverified) are hidden; airport class is inferred from names", "名称のない空港（51 件、性質未確認）は既定で非表示。空港分類は名称から推定"),
      l3("機場旅客數欄單位來源未標；機場涵蓋 54/77 府、港口與碼頭 39 府", "Passenger unit not stated by the source; airports cover 54/77 provinces, ports and terminals 39", "旅客数の単位は出典に記載なし。空港は 54/77 県、港・桟橋は 39 県"),
      COVERAGE_NOTE(64),
    ],
    popupNotes: [NEAREST_NOTE, { text: l3("港口、渡輪碼頭為 OSM 補缺，座標與範圍未經官方核對", "Ports and ferry terminals are OSM gap-fill; positions not officially verified", "港・フェリーターミナルは OSM 補完で、位置は公式に未確認"), when: (p) => str(p.source) === "osm" }],
    sourceOrg: l3("NGIS L14 與 GISTDA Airport（授權未明示，存取 2026-11-22）；港口、渡輪碼頭 © OpenStreetMap contributors（ODbL），via HOT／HDX", "NGIS L14 and GISTDA Airport (license not stated, accessed 2026-11-22); ports and ferry terminals © OpenStreetMap contributors (ODbL), via HOT/HDX", "NGIS L14・GISTDA Airport（ライセンス未明示、2026-11-22 取得）。港・フェリーターミナル © OpenStreetMap contributors（ODbL）、HOT／HDX 経由"),
    sourceUrl: NGIS_URL, license: l3("授權未明示（機場）；ODbL 1.0（OSM 補缺）", "License not stated (airports); ODbL 1.0 (OSM gap-fill)", "ライセンス未明示（空港）。ODbL 1.0（OSM 補完）"), fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國機場港口載入中", "Loading Thailand airports and ports", "タイの空港・港を読み込み中"),
  },
  {
    key: "thStations", file: "th_stations.pmtiles", sourceId: "th-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 17_133,
    parts: [
      { id: "th-stations-circle", sourceLayer: "stations", geom: "point", minzoom: 4, cat: propGetter("kind") },
      // 公車站 16,600 點：z11 起、小點（z10 的曼谷已密成一片），低縮放不畫（避免糊成一片；比照菲律賓場站的縮放分級）
      { id: "th-bus-stops-circle", sourceLayer: "bus_stops", geom: "point", minzoom: 11, cat: propGetter("kind"), small: true },
    ],
    cats: STATION_CATS,
    title: { props: ["name_th", "name_en"], fallback: l3("車站、碼頭、公車站", "Station / pier / bus stop", "駅・桟橋・バス停") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { rail_light: l3("輕軌", "Light rail", "ライトレール"), rail_metro: l3("地鐵", "Metro", "地下鉄"), rail_srt: l3("國鐵", "State Railway", "国鉄"), ferry: l3("渡輪碼頭", "Ferry pier", "フェリー乗り場"), bus_stop: l3("公車站", "Bus stop", "バス停"), unknown: l3("公車站（無班次資料）", "Bus stop (no service data)", "バス停（運行データなし）") } },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "lines", label: l3("路線（BTS／MRT）", "Lines (BTS / MRT)", "路線（BTS／MRT）") },
      { prop: "route_count", label: l3("行經路線數", "Routes serving", "運行路線数"), kind: "num" },
      { prop: "wheelchair", label: l3("輪椅可達", "Wheelchair access", "車椅子対応"), map: { yes: l3("是", "Yes", "あり"), no: l3("否（或未標示）", "No (or not tagged)", "なし（または未記載）") } },
      { prop: "agency_id", label: l3("營運者代碼（Namtang agency_id，無名稱）", "Operator code (Namtang agency_id, no name)", "事業者コード（Namtang agency_id、名称なし）"), kind: "code" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("Namtang 全國 GTFS（OTP，2026 年班表）：鐵路、渡輪站 533、公車站 16,600（z11 起顯示）", "Namtang national GTFS (OTP, 2026 timetable): 533 rail and ferry stations, 16,600 bus stops (from z11)", "Namtang 全国 GTFS（OTP、2026 年ダイヤ）：鉄道・フェリー 533、バス停 16,600（z11 以上で表示）"),
      l3("鐵路、渡輪站涵蓋 40/77 府；其他府顯示未涵蓋，不是沒有車站", "Rail and ferry stations cover 40/77 provinces; other provinces are not covered, not empty", "鉄道・フェリーは 40/77 県。他の県は未収録で、駅がないという意味ではない"),
      l3("Pakse（寮國）站已排除；無班次資料的公車站另色標示", "Pakse (Laos) station excluded; bus stops without service data shown in another color", "Pakse（ラオス）の駅は除外。運行データのないバス停は別色で表示"),
      l3("本層 CC BY 4.0 僅見 Transitland 轉述（OTP 原文未讀到）", "CC BY 4.0 here is only per Transitland's restatement (OTP's original text not found)", "CC BY 4.0 は Transitland の転記のみ確認（OTP 原文は未確認）"),
    ],
    popupNotes: [{ text: l3("無班次資料", "No service data", "運行データなし"), when: (p) => str(p.kind) === "unknown" }, NEAREST_NOTE],
    sourceOrg: "Office of Transport and Traffic Policy and Planning（OTP）Namtang GTFS",
    sourceUrl: "https://namtang-api.otp.go.th/", license: l3("CC BY 4.0（Transitland 轉述；OTP 原文未讀到）", "CC BY 4.0 (per Transitland; OTP original not found)", "CC BY 4.0（Transitland の転記。OTP 原文は未確認）"), fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國車站載入中", "Loading Thailand stations", "タイの駅を読み込み中"),
  },
  {
    key: "thMajorRoads", file: "th_major_roads.pmtiles", sourceId: "th-major-roads", srcMinzoom: 4, srcMaxzoom: 13, color: "#f59e0b", count: 3_726,
    parts: [
      { id: "th-major-roads-line", sourceLayer: "roads", geom: "line", minzoom: 4, cat: propGetter("road_class"),
        lineWidth: { motorway: [2, 3.5], trunk: [1.5, 2.8], primary: [1, 2], secondary: [0.8, 1.5], tertiary: [0.5, 1], unspecified: [0.5, 1] } },
      { id: "th-major-rail-line", sourceLayer: "rail", geom: "line", minzoom: 4, cat: propGetter("source"), lineWidth: { ngis_l02008: [1, 2] } },
    ],
    cats: ROAD_CATS,
    title: { props: ["road_name_th", "highway_name_th", "main_name_th", "main_name_en"], fallback: l3("道路、鐵道", "Road / railway", "道路・鉄道") },
    fields: [
      { prop: "highway_code", label: l3("國道編號", "Highway number", "国道番号"), kind: "code" },
      { prop: "highway_name_th", label: l3("國道名稱（泰文）", "Highway name (Thai)", "国道名（タイ語）") },
      { prop: "road_class", label: l3("道路等級", "Road class", "道路等級"), map: { motorway: l3("高速公路", "Motorway", "高速道路"), trunk: l3("國道・全國連結", "Trunk", "国道・全国連絡"), primary: l3("區域連結", "Primary", "地域連絡"), secondary: l3("府級連結", "Secondary", "県レベル連絡"), tertiary: l3("縣級連結", "Tertiary", "郡レベル連絡"), unspecified: l3("等級未明", "Not specified", "等級不明") } },
      { prop: "hierarchy_th", label: l3("路網層級（泰文原文）", "Network hierarchy (Thai original)", "路網階層（タイ語原文）") },
      { prop: "km_start", label: l3("起點里程", "Start km", "起点キロ程"), kind: "num", unit: "km", digits: 1 },
      { prop: "km_end", label: l3("終點里程", "End km", "終点キロ程"), kind: "num", unit: "km", digits: 1 },
      { prop: "length_km", label: l3("路段長度（公里數，非幾何長度）", "Section length (km as recorded, not geometric)", "区間長（記録上のキロ数、幾何長ではない）"), kind: "num", unit: "km", digits: 2 },
      { prop: "division_th", label: l3("轄區（泰文）", "Division (Thai)", "管轄（タイ語）") },
      { prop: "main_name_en", label: l3("鐵道路線（英文）", "Rail line (English)", "鉄道路線（英語）") },
      { prop: "sub_name_th", label: l3("鐵道支線（泰文）", "Rail branch (Thai)", "鉄道支線（タイ語）") },
      { prop: "rail_type_th", label: l3("軌枕（泰文原文）", "Sleeper type (Thai original)", "枕木（タイ語原文）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("道路：DOH 路線中心線 BE 2568（2025）3,083 段；鐵道：NGIS L02008 643 段；兩者授權未明示", "Roads: DOH route centerlines BE 2568 (2025), 3,083 sections; railways: NGIS L02008, 643 sections; license not stated for both", "道路：DOH 路線中心線 BE 2568（2025）3,083 区間。鉄道：NGIS L02008 643 区間。いずれもライセンス未明示"),
      l3("只含 DOH 國道（無鄉道 DRR）；道路府數 77/77，鐵道只有 47/77 府有線段", "DOH national highways only (no rural roads); roads in 77/77 provinces, railways only in 47/77", "DOH 国道のみ（農道 DRR なし）。道路は 77/77 県、鉄道は 47/77 県のみ"),
      l3("鐵道來源版本 BE 2554（2011），與現況路網不完全一致", "Railway source edition BE 2554 (2011); not identical to the current network", "鉄道の出典は BE 2554（2011）版で、現況の路線網と完全には一致しない"),
    ],
    popupNotes: [],
    sourceOrg: l3("กรมทางหลวง（Department of Highways）路線中心線 BE 2568（授權未明示）；鐵道 NGIS L02008（MOT／SRT，授權未明示）", "Department of Highways (DOH) route centerlines BE 2568 (license not stated); railways NGIS L02008 (MOT/SRT, license not stated)", "Department of Highways（DOH）路線中心線 BE 2568（ライセンス未明示）。鉄道 NGIS L02008（MOT／SRT、ライセンス未明示）"),
    sourceUrl: NGIS_URL, license: TH_LICENSE_UNSTATED, fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國主要道路載入中", "Loading Thailand major roads", "タイの主要道路を読み込み中"),
  },
  {
    key: "thPowerPlants", file: "th_power_plants.pmtiles", sourceId: "th-power-plants", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2622E", count: 1_367,
    parts: [{ id: "th-power-plants-circle", sourceLayer: "plants", geom: "point", minzoom: 3, cat: propGetter("tech"), size: TH_CAPACITY_BANDS, hollow: OSM_HOLLOW }],
    cats: PLANT_CATS,
    otherColor: "#94a3b8",
    otherLabel: l3("其他技術", "Other technology", "その他の技術"),
    sizeLegend: [TH_CAPACITY_BANDS],
    statusDefault: ["operating", "construction"],
    title: { props: ["name_th", "name_en", "name"], fallback: l3("電廠", "Power plant", "発電所"), fallbackBy: { prop: "name_redacted", map: { true: l3("（個人名義，已遮蔽）", "(personal name, redacted)", "（個人名義、秘匿）") } } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "tech", label: l3("技術", "Technology", "技術"), map: TECH_MAP },
      { prop: "fuel_group", label: l3("燃料群", "Fuel group", "燃料グループ"), map: { renewable: l3("再生能源", "Renewable", "再生可能"), fossil: l3("化石燃料", "Fossil", "化石燃料") } },
      { prop: "status", label: l3("狀態（GEM）", "Status (GEM)", "状態（GEM）"), map: STATUS_MAP },
      { prop: "capacity_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "capacity_operating_mw", label: l3("運轉中容量", "Operating capacity", "運転中容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "grid_capacity_mw", label: l3("併網容量", "Grid-connected capacity", "系統連系容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "units", label: l3("機組數", "Units", "ユニット数"), kind: "num" },
      { prop: "start_year", label: l3("啟用年", "Start year", "運転開始年"), kind: "year" },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "source", label: l3("來源", "Source", "出典"), map: SOURCE_MAP },
      { prop: "license", label: l3("授權（逐筆）", "License (per record)", "ライセンス（レコード別）"), map: { unspecified: TH_LICENSE_UNSTATED } },
      { prop: "tambon_th", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("DEDE 再生能源電廠 1,076（授權未明示）＋GEM 火力 91（CC BY 4.0）＋OSM 補缺 200（空心，非官方）；預設只顯示 GEM 運轉中與興建中，DEDE／OSM 無狀態欄一律顯示", "1,076 DEDE renewable plants (license not stated) + 91 GEM fossil plants (CC BY 4.0) + 200 OSM gap-fill (hollow, unofficial); GEM shows operating and under construction by default, DEDE/OSM have no status and always show", "DEDE 再エネ発電所 1,076（ライセンス未明示）＋GEM 火力 91（CC BY 4.0）＋OSM 補完 200（中抜き、非公式）。既定は GEM の運転中・建設中のみ。DEDE／OSM は状態欄がなく常に表示"),
      l3("51 筆個人名義的 DEDE 電廠已遮蔽名稱；EGAT 大型水電主要靠 GEM／OSM（DEDE 大水力僅 6 座）", "51 DEDE plants under personal names have the name redacted; large EGAT hydro mostly comes from GEM/OSM (DEDE has only 6 large hydro)", "個人名義の DEDE 発電所 51 件は名称を秘匿。EGAT の大規模水力は主に GEM／OSM（DEDE の大水力は 6 件のみ）"),
      l3("容量級距：圓圈大小；太陽能含屋頂型", "Capacity bands shown as circle size; solar includes rooftop", "容量区分は円の大きさ。太陽光は屋根置きを含む"),
      COVERAGE_NOTE(75),
    ],
    popupNotes: [
      { text: l3("個人名義，名稱已遮蔽", "Personal name, redacted", "個人名義のため名称を秘匿"), when: (p) => p.name_redacted === true || str(p.name_redacted) === "true" },
      { text: l3("OSM 補缺（非官方）：僅補與官方點相距 >1.5 km 者", "OSM gap-fill (unofficial): only points >1.5 km from an official point", "OSM 補完（非公式）：公式点から 1.5 km 超のもののみ"), when: (p) => str(p.source) === "osm" },
      NEAREST_NOTE,
    ],
    sourceOrg: l3("DEDE（กรมพัฒนาพลังงานทดแทนและอนุรักษ์พลังงาน，NGIS Hosted，授權未明示，存取 2026-11-22）；Global Energy Monitor（CC BY 4.0）；OSM 補缺 © OpenStreetMap contributors（ODbL），via Overture", "DEDE (NGIS Hosted, license not stated, accessed 2026-11-22); Global Energy Monitor (CC BY 4.0); OSM gap-fill © OpenStreetMap contributors (ODbL), via Overture", "DEDE（NGIS Hosted、ライセンス未明示、2026-11-22 取得）。Global Energy Monitor（CC BY 4.0）。OSM 補完 © OpenStreetMap contributors（ODbL）、Overture 経由"),
    sourceUrl: GEM_URL, license: l3("逐筆：DEDE 授權未明示／GEM CC BY 4.0／OSM ODbL 1.0", "Per record: DEDE license not stated / GEM CC BY 4.0 / OSM ODbL 1.0", "レコード別：DEDE ライセンス未明示／GEM CC BY 4.0／OSM ODbL 1.0"), fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國電廠載入中", "Loading Thailand power plants", "タイの発電所を読み込み中"),
  },
  {
    key: "thPowerGrid", file: "th_power_grid.pmtiles", sourceId: "th-power-grid", srcMinzoom: 4, srcMaxzoom: 14, color: "#62D9AD", count: 2_300,
    parts: [
      { id: "th-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: propGetter("kv_class"), lineWidth: KV_WIDTH },
      { id: "th-power-substations-circle", sourceLayer: "substations", geom: "point", minzoom: 4, cat: propGetter("kv_class"), small: true },
    ],
    cats: KV_CATS,
    title: { props: ["name", "name_en", "name_th"], fallback: l3("電力設施", "Power facility", "電力設備") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" },
      { prop: "kv_class", label: l3("電壓等級", "Voltage class", "電圧区分"), map: Object.fromEntries(KV_CATS.flatMap((c) => c.values.map((v) => [v, c.label]))) },
      { prop: "voltage_kv", label: l3("電壓（最大）", "Voltage (highest)", "電圧（最大）"), kind: "num", unit: "kV", digits: 1 },
      { prop: "voltage_raw", label: l3("電壓（OSM 原文，V）", "Voltage (OSM tag, V)", "電圧（OSM 原文、V）"), kind: "code" },
      { prop: "substation", label: l3("變電所類型（OSM 原文）", "Substation type (OSM tag)", "変電所の種別（OSM 原文）"), kind: "code" },
      { prop: "circuits", label: l3("迴路數", "Circuits", "回線数"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [OVERTURE_NOTE,
      l3("輸電線 1,524 段（75/77 府）＋變電所 776 處（77/77 府）；電壓取標籤最大值，電壓未知 155 段", "1,524 line segments (75/77 provinces) plus 776 substations (77/77); voltage is the highest tagged value, 155 segments with unknown voltage", "送電線 1,524 区間（75/77 県）＋変電所 776（77/77 県）。電圧はタグの最大値、電圧不明 155 区間"),
      l3("非官方電網圖；寮國、馬來西亞營運者的邊境設施可能混入", "Not an official grid map; border facilities of Lao and Malaysian operators may be included", "公式の送電網図ではない。ラオス・マレーシア事業者の国境付近の設備が混入する可能性"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: OSM_OVERTURE, sourceUrl: OVERTURE_URL, license: ODBL, fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國電網載入中", "Loading Thailand power grid", "タイの電力網を読み込み中"),
  },
  {
    key: "thRenewables", file: "th_renewables.pmtiles", sourceId: "th-renewables", srcMinzoom: 4, srcMaxzoom: 14, color: "#F2E085", count: 1_136,
    parts: [
      { id: "th-renewables-circle", sourceLayer: "renewables", geom: "point", minzoom: 4, cat: propGetter("kind"), filter: ["!=", ["get", "kind"], "wind_turbine"], size: TH_CAPACITY_BANDS },
      // 風機機組點（OSM，546）尺度與風場不同：z9 起、小空心點
      { id: "th-wind-turbines-circle", sourceLayer: "renewables", geom: "point", minzoom: 9, cat: propGetter("kind"), filter: ["==", ["get", "kind"], "wind_turbine"], small: true, hollow: { label: l3("空心：OSM 補缺（Overture，非官方）", "Hollow: OSM gap-fill (Overture, unofficial)", "中抜き：OSM 補完（Overture、非公式）") } },
    ],
    cats: RENEWABLE_CATS,
    sizeLegend: [TH_CAPACITY_BANDS],
    title: { props: ["name_th", "name_en", "name"], fallback: l3("再生能源設施", "Renewable facility", "再生可能エネルギー施設"), fallbackBy: { prop: "kind", map: { wind_turbine: l3("風機", "Wind turbine", "風車") } } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: KIND_MAP },
      { prop: "capacity_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "grid_capacity_mw", label: l3("併網容量", "Grid-connected capacity", "系統連系容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "source", label: l3("來源", "Source", "出典"), map: SOURCE_MAP },
      { prop: "license", label: l3("授權（逐筆）", "License (per record)", "ライセンス（レコード別）"), map: { unspecified: TH_LICENSE_UNSTATED } },
      { prop: "tambon_th", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("DEDE 風場 27、太陽能 562、地熱 1（授權未明示）＋OSM 風機機組點 546（空心，z9 起）", "27 DEDE wind farms, 562 solar plants, 1 geothermal (license not stated) + 546 OSM turbine points (hollow, from z9)", "DEDE ウィンドファーム 27・太陽光 562・地熱 1（ライセンス未明示）＋OSM 風車ユニット 546（中抜き、z9 以上）"),
      l3("太陽能含屋頂型、無法分地面；風場點與風機點尺度不同，不要合計", "Solar includes rooftop and cannot be split from ground-mounted; wind-farm and turbine points differ in scale, do not add them", "太陽光は屋根置きを含み地上設置と区別できない。風場点と風車点は尺度が異なり、合算しない"),
      l3("涵蓋 64/77 府；沒有點的府是未涵蓋，不是沒有", "64 of 77 provinces covered; provinces without points are not covered, not empty", "77 県中 64 県。点のない県は未収録で、存在しないという意味ではない"),
    ],
    popupNotes: [{ text: l3("OSM 補缺（非官方）", "OSM gap-fill (unofficial)", "OSM 補完（非公式）"), when: (p) => str(p.source) === "osm" }, NEAREST_NOTE],
    sourceOrg: l3("DEDE（NGIS Hosted，授權未明示，存取 2026-11-22）；風機補缺 © OpenStreetMap contributors（ODbL），via Overture", "DEDE (NGIS Hosted, license not stated, accessed 2026-11-22); turbine gap-fill © OpenStreetMap contributors (ODbL), via Overture", "DEDE（NGIS Hosted、ライセンス未明示、2026-11-22 取得）。風車補完 © OpenStreetMap contributors（ODbL）、Overture 経由"),
    sourceUrl: NGIS_URL, license: l3("DEDE 授權未明示；OSM ODbL 1.0（逐筆）", "DEDE license not stated; OSM ODbL 1.0 (per record)", "DEDE ライセンス未明示。OSM ODbL 1.0（レコード別）"), fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國再生能源載入中", "Loading Thailand renewables", "タイの再生可能エネルギーを読み込み中"),
  },
  {
    key: "thFuelStations", file: "th_fuel_stations.pmtiles", sourceId: "th-fuel-stations", srcMinzoom: 5, srcMaxzoom: 14, color: "#f59e0b", count: 14_838,
    parts: [{ id: "th-fuel-stations-circle", sourceLayer: "fuel", geom: "point", minzoom: 5, cat: propGetter("brand_group"), small: true }],
    cats: FUEL_CATS,
    otherColor: "#94a3b8",
    otherLabel: l3("其他／未知品牌", "Other / unknown brand", "その他・不明なブランド"),
    heat: { intensity: 1.4 },
    title: { props: ["name"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド") },
    fields: [
      { prop: "brand_group", label: l3("品牌（歸類）", "Brand (grouped)", "ブランド（分類）"), map: { other: l3("其他品牌", "Other brand", "その他のブランド"), unknown: l3("未知", "Unknown", "不明") } },
      { prop: "brand", label: l3("品牌（Overture 原文）", "Brand (Overture)", "ブランド（Overture 原文）") },
      { prop: "category", label: l3("類別", "Category", "カテゴリ"), map: { gas_station: l3("加油站", "Gas station", "ガソリンスタンド"), fueling_station: l3("加注站", "Fueling station", "給油所") } },
      { prop: "address", label: l3("地址", "Address", "住所") },
      { prop: "locality", label: l3("地區", "Locality", "地域") },
      { prop: "operating_status", label: l3("營業狀態", "Operating status", "営業状況"), map: { open: l3("營業中", "Open", "営業中"), temporarily_closed: l3("暫停營業", "Temporarily closed", "一時休業") } },
      { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
      { prop: "datasets", label: l3("上游資料集", "Upstream datasets", "上流データセット") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("Overture 補缺（非官方）：14,838 處為登記數，可能含歇業；confidence ≥0.5", "Overture gap-fill (unofficial): 14,838 registered points, may include closed stations; confidence ≥0.5", "Overture 補完（非公式）：14,838 件は登録数で、閉業を含む可能性。confidence ≥0.5"),
      l3("PTT 6,389、Shell 1,398、Bangchak 1,079、Caltex 854、Esso 683、PT 398、Susco 93，品牌未知 3,900", "PTT 6,389, Shell 1,398, Bangchak 1,079, Caltex 854, Esso 683, PT 398, Susco 93; brand unknown 3,900", "PTT 6,389・Shell 1,398・Bangchak 1,079・Caltex 854・Esso 683・PT 398・Susco 93、ブランド不明 3,900"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("Overture Maps Foundation places（上游 Meta、AllThePlaces、Foursquare、Uberall、Microsoft；release 2026-11-18.0）", "Overture Maps Foundation places (upstream: Meta, AllThePlaces, Foursquare, Uberall, Microsoft; release 2026-11-18.0)", "Overture Maps Foundation places（上流 Meta・AllThePlaces・Foursquare・Uberall・Microsoft、release 2026-11-18.0）"),
    sourceUrl: OVERTURE_URL, license: "CDLA-Permissive-2.0", fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國加油站載入中", "Loading Thailand fuel stations", "タイのガソリンスタンドを読み込み中"),
  },
  {
    key: "thPipelines", file: "th_pipelines.pmtiles", sourceId: "th-pipelines", srcMinzoom: 5, srcMaxzoom: 14, color: "#f97316", count: 1_640,
    parts: [
      { id: "th-pipelines-line", sourceLayer: "pipelines", geom: "line", minzoom: 5, cat: propGetter("content_group"),
        lineWidth: { oil_gas: [1.5, 2.5], water: [0.8, 1.5], wastewater: [0.8, 1.5], other: [0.8, 1.5], unknown: [0.8, 1.5] } },
      { id: "th-pipeline-facilities-circle", sourceLayer: "facilities", geom: "point", minzoom: 5, cat: pipeFacilityCat, small: true },
    ],
    cats: PIPE_CATS,
    title: { props: ["name", "name_en"], fallback: l3("儲槽、管線", "Storage tank / pipeline", "貯蔵タンク・パイプライン"),
      fallbackBy: { prop: "kind", map: { storage_tank: l3("儲槽", "Storage tank", "貯蔵タンク"), gasometer: l3("氣櫃", "Gasometer", "ガスホルダー"), lng_terminal: l3("LNG 接收站", "LNG terminal", "LNG 受入基地"), pipeline: l3("管線", "Pipeline", "パイプライン") } } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" },
      { prop: "kind", label: l3("類型", "Type", "種別"), map: { storage_tank: l3("儲槽", "Storage tank", "貯蔵タンク"), gasometer: l3("氣櫃", "Gasometer", "ガスホルダー"), lng_terminal: l3("LNG 接收站", "LNG terminal", "LNG 受入基地"), pipeline: l3("管線", "Pipeline", "パイプライン") } },
      { prop: "content_group", label: l3("內容物分群", "Content group", "内容物グループ"), map: Object.fromEntries(PIPE_CATS.filter((c) => c.id !== "lng_terminal").map((c) => [c.id, c.label])) },
      { prop: "content", label: l3("內容物（OSM 原文）", "Content (OSM tag)", "内容物（OSM 原文）") },
      { prop: "substance", label: l3("輸送物質（原文）", "Substance (original)", "輸送物質（原文）") },
      { prop: "status", label: l3("狀態（GEM）", "Status (GEM)", "状態（GEM）"), map: { operating: l3("運轉中", "Operating", "運転中"), proposed: l3("提案", "Proposed", "提案"), shelved: l3("擱置", "Shelved", "保留"), cancelled: l3("取消", "Cancelled", "中止") } },
      { prop: "capacity_mtpa", label: l3("容量（百萬噸／年）", "Capacity (Mtpa)", "容量（百万トン／年）"), kind: "num", digits: 2 },
      { prop: "capacity_bcm_y", label: l3("容量（十億立方公尺／年）", "Capacity (bcm/yr)", "容量（10 億 m³／年）"), kind: "num", digits: 2 },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      { prop: "route_accuracy", label: l3("路徑精度（GEM）", "Route accuracy (GEM)", "ルート精度（GEM）") },
      { prop: "source", label: l3("來源", "Source", "出典"), map: { osm: l3("OSM（Overture，非官方）", "OSM (Overture, unofficial)", "OSM（Overture、非公式）"), gem: l3("Global Energy Monitor（CC BY 4.0）", "Global Energy Monitor (CC BY 4.0)", "Global Energy Monitor（CC BY 4.0）") } },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [OVERTURE_NOTE,
      l3("儲槽與管線不是油氣管線全圖：儲槽 1,377、氣櫃 81、LNG 接收站 6（GEM）、管線 176 段；多數未標示內容物", "Not a complete oil-and-gas pipeline map: 1,377 storage tanks, 81 gasometers, 6 LNG terminals (GEM), 176 pipeline segments; most have no content tag", "石油・ガスパイプラインの全体図ではない：貯蔵タンク 1,377・ガスホルダー 81・LNG 受入基地 6（GEM）・パイプライン 176 区間。多くは内容物の記載なし"),
      l3("預設只顯示油氣與 LNG 接收站；「未標示內容物」可在類別篩選打開", "Only oil and gas and LNG terminals shown by default; 'contents not tagged' can be turned on in the category filter", "既定は石油・ガスと LNG 受入基地のみ。「内容物の記載なし」はカテゴリ絞り込みで表示可能"),
      l3("GEM 管線為示意路徑（31 段），不是實測路由；涵蓋 49/77 府、油氣 28 府", "GEM pipelines are indicative routes (31 segments), not surveyed; 49 of 77 provinces covered, 28 for oil and gas", "GEM パイプラインは概略ルート（31 区間）で実測ではない。49/77 県、石油・ガスは 28 県"),
    ],
    popupNotes: [{ text: l3("GEM 管線為示意路徑，不是實測路由", "GEM pipeline is an indicative route, not surveyed", "GEM パイプラインは概略ルートで、実測ではない"), when: (p) => str(p.source) === "gem" && str(p.kind) === "pipeline" }, NEAREST_NOTE],
    sourceOrg: l3("© OpenStreetMap contributors（ODbL），via Overture Maps Foundation；Global Energy Monitor Gas／Oil & NGL Pipelines、LNG Terminals Trackers（CC BY 4.0）", "© OpenStreetMap contributors (ODbL), via Overture Maps Foundation; Global Energy Monitor Gas / Oil & NGL Pipelines and LNG Terminals Trackers (CC BY 4.0)", "© OpenStreetMap contributors（ODbL）、Overture Maps Foundation 経由。Global Energy Monitor Gas／Oil & NGL Pipelines・LNG Terminals Trackers（CC BY 4.0）"),
    sourceUrl: GEM_URL, license: l3("ODbL 1.0（OSM）／CC BY 4.0（GEM），逐筆", "ODbL 1.0 (OSM) / CC BY 4.0 (GEM), per record", "ODbL 1.0（OSM）／CC BY 4.0（GEM）、レコード別"), fetchedAt: TH_FETCHED_AT,
    loading: l3("泰國儲槽與管線載入中", "Loading Thailand tanks and pipelines", "タイの貯蔵タンクとパイプラインを読み込み中"),
  },
];

export const TH_SPEC_BY_KEY: Readonly<Record<ThDataKey, ThLayerSpec>> = Object.fromEntries(TH_DATA_SPECS.map((s) => [s.key, s])) as Record<ThDataKey, ThLayerSpec>;
