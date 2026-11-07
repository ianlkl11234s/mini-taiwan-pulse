/**
 * 愛爾蘭第 1 波起規格驅動資料層（第 1 波 6 層、第 2 波 2 層、第 3a 波 7 層、第 3b 波 5 層、第 4 波 6 層、第 5 波 9 層）SSOT：hook paint、圖例、popup 三邊共用。
 * 畫法沿用南韓規格驅動 hook（`hooks/useKrDataLayers.ts`），規格型別同 `KrLayerSpec`，只把 key 換成 `IeDataKey`；
 * 海床地形是 raster，另在 `hooks/useIeBathymetryLayer.ts`。
 * 資料、處理與授權見 taipei-gis-analytics `docs/data-catalog/{base_map,sports,funeral,urban_open_space}/ie_*.md`
 * 與 `docs/topic-research/ireland_opendata/waves/PLAN.md` 第 1 波（2026-11-07 重開授權頁）。
 * 北愛屬英國：所有點位以第 0 波 31 個地方政府面判定，落在北愛者剔除。
 */
import type { IeDataKey } from "./ieDataKeys";
import type { KrCat, KrFieldKind, KrLayerSpec, L3 } from "./krDataLayers";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

/** popup 欄位：南韓欄位種類再加 `pct`（0–1 比例 → 百分比）。 */
export interface IeField { prop: string; label: L3; kind?: KrFieldKind | "pct"; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export type IeLayerSpec = Omit<KrLayerSpec, "key" | "fields"> & { key: IeDataKey; fields: readonly IeField[] };

export const IE_W1_FETCHED_AT = "2026-11-07";
export const IE_W2_FETCHED_AT = "2026-11-07";
export const IE_W3A_FETCHED_AT = "2026-11-08";
export const IE_W4_FETCHED_AT = "2026-11-08";
const CC_BY_NC_ND = "CC BY-NC-ND 4.0（非商業使用・原樣未改作）";
const DGI = (id: string) => `https://data.gov.ie/dataset/${id}`;
const CC_BY = "CC BY 4.0";
const AGOL_TAILTE = "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/arcgis/rest/services";

const LA = { prop: "la_name", label: l3("地方政府", "Local authority", "地方自治体") } as const;

const MARITIME_KIND: Record<string, L3> = {
  territorial_sea: l3("領海外界（12 浬）", "Territorial sea limit (12 nm)", "領海の外側線（12海里）"),
  contiguous_zone: l3("鄰接區外界（24 浬）", "Contiguous zone limit (24 nm)", "接続水域の外側線（24海里）"),
  eez: l3("專屬經濟區外界", "Exclusive economic zone limit", "排他的経済水域の外側線"),
};
const PLACE_KIND: Record<string, L3> = {
  centre: l3("人口中心", "Centre of population", "人口集中地"),
  townland: l3("Townland（最小地籍單位）", "Townland", "タウンランド（最小の地名単位）"),
  island: l3("島嶼", "Island", "島"),
};
const YES_NO: Record<string, L3> = { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ"), Yes: l3("是", "Yes", "はい"), No: l3("否", "No", "いいえ") };
const GRAVE_CATS: readonly KrCat[] = [
  { id: "smr_graveyard", values: ["smr_graveyard"], color: "#a78bfa", label: l3("墓地（SMR 考古登錄）", "Graveyard (SMR)", "墓地（SMR 遺跡登録）") },
  { id: "smr_burial_ground", values: ["smr_burial_ground"], color: "#f59e0b", label: l3("埋葬地（SMR 考古登錄）", "Burial ground (SMR)", "埋葬地（SMR 遺跡登録）") },
  { id: "smr_childrens_burial_ground", values: ["smr_childrens_burial_ground"], color: "#f472b6", label: l3("兒童埋葬地（SMR 考古登錄）", "Children's burial ground (SMR)", "子どもの埋葬地（SMR 遺跡登録）") },
  { id: "council_historic_graveyard", values: ["council_historic_graveyard"], color: "#4ade80", label: l3("歷史墓地（Galway、Fingal 議會名冊）", "Historic graveyard (Galway, Fingal councils)", "歴史的墓地（Galway・Fingal 議会の名簿）") },
  { id: "council_burial_ground", values: ["council_burial_ground"], color: "#38bdf8", label: l3("現行公墓（Fingal 議會）", "Burial ground in use (Fingal council)", "現行の墓地（Fingal 議会）") },
];

// 第 2 波：商業房產估值類別（Valuation Office Category 合併；Cork 兩區是舊制 RV、無類別，獨立一類）
const VALUATION_CATS: readonly KrCat[] = [
  { id: "retail", values: ["retail"], color: "#f472b6", label: l3("零售（商店、量販倉儲）", "Retail (shops, warehouses)", "小売（店舗・倉庫型）") },
  { id: "office", values: ["office"], color: "#38bdf8", label: l3("辦公", "Office", "オフィス") },
  { id: "industrial", values: ["industrial"], color: "#a78bfa", label: l3("工業", "Industrial", "工業") },
  { id: "hospitality", values: ["hospitality"], color: "#f59e0b", label: l3("餐旅", "Hospitality", "宿泊・飲食") },
  { id: "leisure", values: ["leisure"], color: "#4ade80", label: l3("休閒", "Leisure", "レジャー") },
  { id: "health", values: ["health"], color: "#ef4444", label: l3("醫療", "Health", "医療") },
  { id: "fuel_depot", values: ["fuel_depot"], color: "#facc15", label: l3("加油站與油庫", "Fuel / depot", "燃料・デポ") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他（雜項、礦產、公用事業等）", "Other (miscellaneous, minerals, utilities…)", "その他（雑種・鉱物・公益事業など）") },
  { id: "cork_rv", values: ["cork_rv"], color: "#2dd4bf", label: l3("Cork 市、郡（舊制估值，未分類）", "Cork City & County (old-basis valuation, uncategorised)", "Cork 市・県（旧制評価、区分なし）") },
];
// 第 2 波：國有登記土地所有人分組（GovAgency 空值依登記所有人補）
const STATE_OWNER_CATS: readonly KrCat[] = [
  { id: "local_authority", values: ["local_authority"], color: "#38bdf8", label: l3("地方政府", "Local authorities", "地方自治体") },
  { id: "coillte", values: ["coillte"], color: "#4ade80", label: l3("Coillte（國營林業）", "Coillte (state forestry)", "Coillte（国営林業）") },
  { id: "bord_na_mona", values: ["bord_na_mona"], color: "#f59e0b", label: l3("Bord na Móna（國營泥炭、能源）", "Bord na Móna (state peat & energy)", "Bord na Móna（国営泥炭・エネルギー）") },
  { id: "esb", values: ["esb"], color: "#facc15", label: l3("ESB（國營電力）", "ESB (state electricity)", "ESB（国営電力）") },
  { id: "agriculture", values: ["agriculture"], color: "#2dd4bf", label: l3("農業食品海洋部", "Dept. of Agriculture, Food and the Marine", "農業・食料・海洋省") },
  { id: "housing", values: ["housing"], color: "#f472b6", label: l3("住房地方政府遺產部轄下（含 Irish Water）", "Dept. of Housing, Local Government and Heritage bodies (incl. Irish Water)", "住宅・地方自治・遺産省所管（Irish Water を含む）") },
  { id: "opw", values: ["opw"], color: "#a78bfa", label: l3("公共工程局（OPW）", "Office of Public Works", "公共事業局（OPW）") },
  { id: "central_government", values: ["central_government"], color: "#ef4444", label: l3("其他中央部會", "Other government departments", "その他の中央省庁") },
  { id: "other_state_body", values: ["other_state_body"], color: "#94a3b8", label: l3("其他國營事業與機構", "Other state bodies & companies", "その他の国営企業・機関") },
];

// ───────────── 第 3a 波：水系統與洪水 ─────────────
/** WFD 生態狀態五級（EPA 2019–2024）：沿用歐盟 WFD 慣例的藍、綠、黃、橙、紅語意。 */
const WFD_STATUS_CATS: readonly KrCat[] = [
  { id: "High", values: ["High"], color: "#38bdf8", label: l3("極佳 High", "High", "高い（High）") },
  { id: "Good", values: ["Good"], color: "#4ade80", label: l3("良好 Good", "Good", "良好（Good）") },
  { id: "Moderate", values: ["Moderate"], color: "#facc15", label: l3("普通 Moderate", "Moderate", "中程度（Moderate）") },
  { id: "Poor", values: ["Poor"], color: "#f59e0b", label: l3("不佳 Poor", "Poor", "不良（Poor）") },
  { id: "Bad", values: ["Bad"], color: "#ef4444", label: l3("極差 Bad", "Bad", "悪い（Bad）") },
];
const WFD_UNASSIGNED = l3("未評定 Unassigned", "Unassigned", "未評価（Unassigned）");
const WATER_MONITORING_CATS: readonly KrCat[] = [
  { id: "river", values: ["river"], color: "#38bdf8", label: l3("河川測站", "River station", "河川観測点") },
  { id: "lake", values: ["lake"], color: "#2dd4bf", label: l3("湖泊測站", "Lake station", "湖沼観測点") },
  { id: "transitional", values: ["transitional"], color: "#a78bfa", label: l3("河口（感潮）測站", "Transitional (estuary) station", "汽水域（河口）観測点") },
  { id: "coastal", values: ["coastal"], color: "#f472b6", label: l3("沿海測站", "Coastal station", "沿岸観測点") },
  { id: "groundwater", values: ["groundwater"], color: "#f59e0b", label: l3("地下水測站", "Groundwater station", "地下水観測点") },
  { id: "uww_plant", values: ["uww_plant"], color: "#ef4444", label: l3("都市污水處理廠", "Urban waste water treatment plant", "都市下水処理場") },
];
// 第 4 波：交通類別
const TRANSIT_MODE_CATS: readonly KrCat[] = [
  { id: "rail", values: ["rail"], color: "#f59e0b", label: l3("鐵路（Irish Rail、DART）", "Rail (Irish Rail, DART)", "鉄道（Irish Rail・DART）") },
  { id: "tram", values: ["tram"], color: "#a78bfa", label: l3("輕軌（Luas）", "Tram (Luas)", "路面電車（Luas）") },
  { id: "bus", values: ["bus"], color: "#38bdf8", label: l3("公車、客運", "Bus & coach", "バス・長距離バス") },
];
const PORT_KIND_CATS: readonly KrCat[] = [
  { id: "airport", values: ["airport"], color: "#f472b6", label: l3("機場（≥0.4 km²）", "Airport (≥0.4 km²)", "空港（0.4 km² 以上）") },
  { id: "airfield", values: ["airfield"], color: "#a78bfa", label: l3("小型機場、跑道場（<0.4 km²）", "Small airfield (<0.4 km²)", "小規模飛行場（0.4 km² 未満）") },
  { id: "main_harbour", values: ["main_harbour"], color: "#38bdf8", label: l3("主要港口", "Main harbour", "主要港") },
  { id: "other_harbour", values: ["other_harbour"], color: "#2dd4bf", label: l3("其他港口", "Other harbour", "その他の港") },
  { id: "ferry_port", values: ["ferry_port"], color: "#f59e0b", label: l3("渡輪碼頭", "Ferry port", "フェリー乗り場") },
];
const ROAD_CLASS_CATS: readonly KrCat[] = [
  { id: "motorway", values: ["motorway"], color: "#ef4444", label: l3("高速公路", "Motorway", "高速道路") },
  { id: "primary", values: ["primary"], color: "#f59e0b", label: l3("主要道路", "Primary route", "主要道路") },
  { id: "secondary", values: ["secondary"], color: "#facc15", label: l3("次要道路", "Secondary route", "準主要道路") },
  { id: "local", values: ["local"], color: "#94a3b8", label: l3("地方道路", "Local road", "地方道路") },
  { id: "unknown", values: ["unknown"], color: "#64748b", label: l3("來源未分類", "Unclassified in source", "出典で未分類") },
  { id: "railway", values: ["railway"], color: "#a78bfa", label: l3("鐵路", "Railway", "鉄道") },
];
const MARKER_KIND_CATS: readonly KrCat[] = [
  { id: "motorway_marker", values: ["motorway_marker"], color: "#38bdf8", label: l3("高速公路（M）里程標", "Motorway (M) marker plate", "高速道路（M）キロポスト") },
  { id: "national_marker", values: ["national_marker"], color: "#4ade80", label: l3("國道（N）里程標", "National road (N) marker plate", "国道（N）キロポスト") },
  { id: "interchange", values: ["interchange"], color: "#facc15", label: l3("交流道", "Interchange", "インターチェンジ") },
];
const COUNTER_ROAD_CATS: readonly KrCat[] = [
  // 與里程標（藍、綠）錯開，兩層同開時分得出來
  { id: "motorway", values: ["motorway"], color: "#f472b6", label: l3("高速公路（M）", "Motorway (M)", "高速道路（M）") },
  { id: "national", values: ["national"], color: "#f59e0b", label: l3("國道（N）", "National road (N)", "国道（N）") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("標籤無路線碼", "No route in label", "ラベルに路線なし") },
];
const MODE_MAP = Object.fromEntries(TRANSIT_MODE_CATS.map((c) => [c.id, c.label]));
const IE_GTFS_NOTE = l3("TFI 全國整合 GTFS（NTA，2026-11-06 起一年期時刻表；Mobility Database 鏡像）", "TFI national GTFS (NTA, timetable valid from 2026-11-06 for one year; via Mobility Database mirror)", "TFI 全国統合 GTFS（NTA、2026-11-06 から1年間の時刻表。Mobility Database のミラー）");
const DRAINAGE_CATS: readonly KrCat[] = [
  { id: "channel", values: ["channel"], color: "#38bdf8", label: l3("主幹排水渠（OPW 維護）", "Arterial drainage channel (OPW-maintained)", "幹線排水路（OPW 管理）") },
  { id: "embankment", values: ["embankment"], color: "#f59e0b", label: l3("堤防", "Embankment", "堤防") },
];
const EROSION_CATS: readonly KrCat[] = [
  { id: "2050", values: ["2050"], color: "#ef4444", label: l3("2050 侵蝕線（現況情境推估）", "2050 erosion line (current scenario)", "2050年侵食線（現況シナリオ）") },
  { id: "RL", values: ["RL"], color: "#f59e0b", label: l3("侵蝕速率線（2010–2014）", "Erosion rate line (2010–2014)", "侵食速度線（2010–2014）") },
];
const WFD_STATUS_FIELD: IeField = { prop: "status", label: l3("生態狀態（2019–2024）", "Ecological status (2019–2024)", "生態学的状態（2019–2024）"),
  map: Object.fromEntries([...WFD_STATUS_CATS.map((c) => [c.id, c.label]), ["Unassigned", WFD_UNASSIGNED]]) };

/** NIFM 河川淹水範圍：3 情境 × 3 重現期，一組一支 PMTiles（同一個 source-layer），依 `ieRiverFloodExtentsScenarioIdx` 換檔。順序即 select encode。 */
export const IE_FLOOD_SCENARIOS = [
  { value: "c_0020", label: l3("現況・20 年一遇", "Current · 1-in-20 year", "現況・20年確率") },
  { value: "c_0100", label: l3("現況・100 年一遇", "Current · 1-in-100 year", "現況・100年確率") },
  { value: "c_1000", label: l3("現況・1000 年一遇", "Current · 1-in-1000 year", "現況・1000年確率") },
  { value: "m_0020", label: l3("中端未來・20 年一遇", "Mid-range future · 1-in-20 year", "中位将来・20年確率") },
  { value: "m_0100", label: l3("中端未來・100 年一遇", "Mid-range future · 1-in-100 year", "中位将来・100年確率") },
  { value: "m_1000", label: l3("中端未來・1000 年一遇", "Mid-range future · 1-in-1000 year", "中位将来・1000年確率") },
  { value: "h_0020", label: l3("高端未來・20 年一遇", "High-end future · 1-in-20 year", "高位将来・20年確率") },
  { value: "h_0100", label: l3("高端未來・100 年一遇", "High-end future · 1-in-100 year", "高位将来・100年確率") },
  { value: "h_1000", label: l3("高端未來・1000 年一遇", "High-end future · 1-in-1000 year", "高位将来・1000年確率") },
] as const;
export const IE_FLOOD_SCENARIO_DEFAULT = "c_0100";
export const ieFloodScenarioFile = (value: string) => `ie_river_flood_extents_${value}.pmtiles`;
/** overlayParams 的情境序號 → 檔名；越界退回預設 */
export function ieFloodScenarioFileAt(idx: number | undefined): string {
  const s = IE_FLOOD_SCENARIOS[idx ?? -1] ?? IE_FLOOD_SCENARIOS.find((x) => x.value === IE_FLOOD_SCENARIO_DEFAULT)!;
  return ieFloodScenarioFile(s.value);
}
const FLOOD_SCENARIO_CODE: Record<string, L3> = {
  c: l3("現況", "Current", "現況"), m: l3("中端未來（MRFS）", "Mid-range future (MRFS)", "中位将来（MRFS）"), h: l3("高端未來（HEFS）", "High-end future (HEFS)", "高位将来（HEFS）"),
};
const FLOOD_PERIOD_CODE: Record<string, L3> = {
  "0020": l3("20 年一遇", "1-in-20 year", "20年確率"), "0100": l3("100 年一遇", "1-in-100 year", "100年確率"), "1000": l3("1000 年一遇", "1-in-1000 year", "1000年確率"),
};
const NC_ND_NOTE = (org: string) => l3(`CC BY-NC-ND 4.0・非商業使用；© ${org}。原樣上圖、未改作（不合併、不裁切、不改屬性）`,
  `CC BY-NC-ND 4.0 · non-commercial use; © ${org}. Shown unaltered (not merged, clipped or re-classified)`,
  `CC BY-NC-ND 4.0・非商用；© ${org}。改変せず原データのまま表示（統合・切り抜き・属性変更なし）`);

// ───────────── 第 3b 波：海洋 ─────────────
export const IE_W3B_FETCHED_AT = "2026-11-08";
export const IE_W5_FETCHED_AT = "2026-11-08";
/** EPA 年度浴場水質分級（Bathing Water Quality Regulations 2008，前 4 季採樣）：沿用歐盟浴場分級慣例的藍、綠、黃、紅。 */
const BATHING_CATS: readonly KrCat[] = [
  { id: "excellent", values: ["excellent"], color: "#38bdf8", label: l3("極佳 Excellent", "Excellent", "極めて良好（Excellent）") },
  { id: "good", values: ["good"], color: "#4ade80", label: l3("良好 Good", "Good", "良好（Good）") },
  { id: "sufficient", values: ["sufficient"], color: "#facc15", label: l3("合格 Sufficient", "Sufficient", "可（Sufficient）") },
  { id: "poor", values: ["poor"], color: "#ef4444", label: l3("不良 Poor", "Poor", "不良（Poor）") },
  { id: "not_classified", values: ["not_classified"], color: "#94a3b8", label: l3("法定浴場・本年未分級", "Identified bathing water, not classified", "指定水浴場・今年は未分類") },
  { id: "non_identified", values: ["non_identified"], color: "#a78bfa", label: l3("非法定監測點（無年度分級）", "Non-identified (monitored, no annual classification)", "指定外の監視地点（年次分類なし）") },
];
const SURVEY_SERIES_CATS: readonly KrCat[] = [
  { id: "groundfish", values: ["groundfish"], color: "#38bdf8", label: l3("愛爾蘭底拖網漁業調查 IGFS（2003–2015）", "Irish Groundfish Survey (2003–2015)", "アイルランド底魚調査 IGFS（2003–2015）") },
  { id: "nephrops_uwtv", values: ["nephrops_uwtv"], color: "#f472b6", label: l3("挪威海螯蝦水下攝影調查（2000–2016）", "Nephrops underwater TV survey (2000–2016)", "ヨーロッパアカザエビ水中TV調査（2000–2016）") },
  { id: "mackerel_egg", values: ["mackerel_egg"], color: "#facc15", label: l3("鯖魚卵調查（2007–2016）", "Mackerel egg survey (2007–2016)", "サバ卵調査（2007–2016）") },
  { id: "acoustic", values: ["acoustic"], color: "#a78bfa", label: l3("聲學資源調查（1999–2009）", "Acoustic survey (1999–2009)", "音響資源調査（1999–2009）") },
  { id: "biological_sampling", values: ["biological_sampling"], color: "#4ade80", label: l3("生物採樣調查（2004–2009）", "Biological sampling survey (2004–2009)", "生物サンプリング調査（2004–2009）") },
  { id: "deepwater", values: ["deepwater"], color: "#2dd4bf", label: l3("深水調查（2006–2009）", "Deepwater survey (2006–2009)", "深海調査（2006–2009）") },
  { id: "boarfish", values: ["boarfish"], color: "#f59e0b", label: l3("野豬魚調查（2014）", "Boarfish survey (2014)", "ヒシダイ類（boarfish）調査（2014）") },
];
const SEABED_PROGRAMME_CATS: readonly KrCat[] = [
  { id: "infomar", values: ["infomar"], color: "#38bdf8", label: l3("INFOMAR（2006–2026）", "INFOMAR (2006–2026)", "INFOMAR（2006–2026）") },
  { id: "inss", values: ["inss"], color: "#a78bfa", label: l3("國家海床調查 INSS（1999–2005）", "Irish National Seabed Survey (1999–2005)", "国家海底調査 INSS（1999–2005）") },
  { id: "other", values: ["other"], color: "#2dd4bf", label: l3("其他合作航次（海洋能、棲地、漁業等）", "Other surveys (ocean energy, habitat, fisheries…)", "その他の調査（海洋エネルギー・生息地・漁業など）") },
];
const OFFSHORE_CATS: readonly KrCat[] = [
  { id: "mac", values: ["mac"], color: "#f59e0b", label: l3("海域許可 MAC（2022 第一批）", "Maritime Area Consent (first batch, 2022)", "海域利用同意 MAC（2022年第1陣）") },
  { id: "foreshore_commissioned", values: ["foreshore_commissioned"], color: "#4ade80", label: l3("已運轉（前灘程序）", "Fully commissioned (foreshore process)", "運転中（フォアショア手続）") },
  { id: "foreshore_relevant", values: ["foreshore_relevant"], color: "#38bdf8", label: l3("過渡案 Relevant Projects（前灘程序）", "Relevant Projects (foreshore process)", "移行案件 Relevant Projects（フォアショア手続）") },
  { id: "foreshore_site_investigation", values: ["foreshore_site_investigation"], color: "#a78bfa", label: l3("場址調查許可（前灘程序）", "Site investigation licence (foreshore process)", "サイト調査許可（フォアショア手続）") },
  { id: "amets", values: ["amets"], color: "#f472b6", label: l3("大西洋海洋能試驗場 AMETS", "Atlantic Marine Energy Test Site (AMETS)", "大西洋海洋エネルギー試験場 AMETS") },
];
const MARINE_SITE_CATS: readonly KrCat[] = [
  { id: "sac", values: ["sac"], color: "#38bdf8", label: l3("特別保育區 SAC（Natura 2000）", "Special Area of Conservation (Natura 2000)", "特別保護区 SAC（Natura 2000）") },
  { id: "spa", values: ["spa"], color: "#a78bfa", label: l3("鳥類特別保護區 SPA（Natura 2000）", "Special Protection Area (Natura 2000)", "鳥類特別保護区 SPA（Natura 2000）") },
  { id: "nha", values: ["nha"], color: "#4ade80", label: l3("國家自然遺產區 NHA", "Natural Heritage Area", "国家自然遺産地域 NHA") },
  { id: "biosphere", values: ["biosphere"], color: "#2dd4bf", label: l3("都柏林灣生物圈（海域分區）", "Dublin Bay Biosphere (marine zones)", "ダブリン湾生物圏（海域区分）") },
  { id: "nature_reserve", values: ["nature_reserve"], color: "#f59e0b", label: l3("自然保留區（只有點位）", "Nature reserve (point only)", "自然保護区（点のみ）") },
  { id: "refuge", values: ["refuge"], color: "#f472b6", label: l3("地方動物避難所（只有點位）", "Refuge for fauna (point only)", "動物避難地（点のみ）") },
  { id: "ramsar", values: ["ramsar"], color: "#facc15", label: l3("拉姆薩濕地（只有點位）", "Ramsar wetland (point only)", "ラムサール湿地（点のみ）") },
];
// 第 5 波：自然保護與地質類別
const PROTECTED_SITE_CATS: readonly KrCat[] = MARINE_SITE_CATS.filter((c) => c.id === "sac" || c.id === "spa" || c.id === "nha");
const TRAIL_CATS: readonly KrCat[] = [
  { id: "walking", values: ["Walking Trail"], color: "#4ade80", label: l3("步行步道", "Walking trail", "ウォーキングトレイル") },
  { id: "long_distance", values: ["Long Distance Waymarked Way", "Pilgrim Path"], color: "#f59e0b", label: l3("長距離標示步道、朝聖路", "Long-distance waymarked way, pilgrim path", "長距離ウェイマーク・巡礼路") },
  { id: "greenway", values: ["Greenway"], color: "#2dd4bf", label: l3("綠道（Greenway）", "Greenway", "グリーンウェイ") },
  { id: "cycling", values: ["Road Cycling Trail", "Off Road Cycling Trail", "Mountain Biking Trail"], color: "#f472b6", label: l3("單車（公路、越野、登山車）", "Cycling (road, off-road, mountain bike)", "自転車（ロード・オフロード・MTB）") },
  { id: "water", values: ["Paddling Trail", "Snorkelling Trail"], color: "#38bdf8", label: l3("水上（划槳、浮潛）", "Water (paddling, snorkelling)", "水上（パドリング・シュノーケリング）") },
];
const TREE_COUNCIL_CATS: readonly KrCat[] = [
  { id: "fingal", values: ["fingal"], color: "#4ade80", label: l3("Fingal 議會", "Fingal County Council", "Fingal 議会") },
  { id: "dlr", values: ["dlr"], color: "#facc15", label: l3("Dún Laoghaire-Rathdown 議會（2019）", "Dún Laoghaire-Rathdown County Council (2019)", "Dún Laoghaire-Rathdown 議会（2019）") },
  { id: "dcc", values: ["dcc"], color: "#38bdf8", label: l3("Dublin City 議會", "Dublin City Council", "Dublin City 議会") },
];
const RADIATION_CATS: readonly KrCat[] = [
  { id: "land_live", values: ["land_live"], color: "#4ade80", label: l3("陸地（即時上線）", "Land (live)", "陸上（リアルタイム）") },
  { id: "land", values: ["land"], color: "#facc15", label: l3("陸地（非即時）", "Land (not live)", "陸上（非リアルタイム）") },
  { id: "marine", values: ["marine"], color: "#38bdf8", label: l3("海域", "Marine", "海域") },
];
const LANDSLIDE_MATERIAL_CATS: readonly KrCat[] = [
  { id: "peat", values: ["peat"], color: "#f59e0b", label: l3("泥炭（含泥炭質土）", "Peat (incl. peaty soil)", "泥炭（泥炭質土を含む）") },
  { id: "earth", values: ["earth"], color: "#a78bfa", label: l3("土、泥、冰磧", "Earth, mud, till", "土・泥・氷礫土") },
  { id: "rock", values: ["rock"], color: "#38bdf8", label: l3("岩石、岩屑坡", "Rock, scree", "岩・崖錐") },
  { id: "debris", values: ["debris"], color: "#f472b6", label: l3("岩屑", "Debris", "岩屑") },
  { id: "undifferentiated", values: ["undifferentiated"], color: "#94a3b8", label: l3("未分類", "Undifferentiated", "未区分") },
];
const RADON_CATS: readonly KrCat[] = [
  { id: "1_in_5", values: ["1_in_5"], color: "#ef4444", label: l3("約每 5 戶有 1 戶偏高（High Radon Area）", "About 1 in 5 homes high (High Radon Area)", "約5戸に1戸が高い（High Radon Area）") },
  { id: "1_in_10", values: ["1_in_10"], color: "#f59e0b", label: l3("約每 10 戶有 1 戶偏高", "About 1 in 10 homes high", "約10戸に1戸が高い") },
  { id: "1_in_20", values: ["1_in_20"], color: "#facc15", label: l3("約每 20 戶有 1 戶偏高", "About 1 in 20 homes high", "約20戸に1戸が高い") },
];
const FOUNDATION: Record<string, L3> = { "Fixed-Bottom": l3("固定式", "Fixed-bottom", "着床式"), Floating: l3("浮動式", "Floating", "浮体式") };

export const IE_DATA_SPECS: readonly IeLayerSpec[] = [
  // ───────────── 底圖：海域界線、地名 ─────────────
  {
    key: "ieMaritimeBoundaries", file: "ie_maritime_boundaries.pmtiles", sourceLayer: "ie_maritime_boundaries", geom: "line", layerId: "ie-maritime-boundaries-line",
    srcMinzoom: 0, srcMaxzoom: 10, minzoom: 0, color: "#38bdf8", count: 17,
    catProp: "kind",
    cats: [
      { id: "territorial_sea", values: ["territorial_sea"], color: "#38bdf8", label: MARITIME_KIND.territorial_sea! },
      { id: "contiguous_zone", values: ["contiguous_zone"], color: "#a78bfa", label: MARITIME_KIND.contiguous_zone! },
      { id: "eez", values: ["eez"], color: "#f59e0b", label: MARITIME_KIND.eez! },
    ],
    title: { props: [], fallback: l3("海域界線", "Maritime boundary", "海域境界") },
    fields: [{ prop: "kind", label: l3("界線", "Boundary", "境界"), map: MARITIME_KIND }, { prop: "segment", label: l3("段落（原文）", "Segment", "区間（原文）") },
             { prop: "version", label: l3("資料版本", "Version", "データ版"), kind: "year" }],
    legendNotes: [l3("領海自正常基線與直線基線起算 12 浬；專屬經濟區含 200 浬線與依 S.I. No. 86 of 2014 劃定的段落", "Territorial sea measured 12 nm from normal and straight baselines; EEZ includes the 200 nm line and the segments set by S.I. No. 86 of 2014", "領海は通常基線・直線基線から12海里。EEZは200海里線と S.I. No. 86 of 2014 で定めた区間を含む"),
                  l3("海洋研究所 2016 版資料，不可用於航海", "Marine Institute 2016 dataset; not for navigation", "Marine Institute 2016年版。航海用ではない")],
    popupNotes: [],
    sourceOrg: "Marine Institute / Department of the Environment, Climate and Communications", sourceUrl: "https://atlas.marine.ie/", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭海域界線載入中", "Loading Ireland maritime boundaries", "アイルランドの海域境界を読み込み中"),
  },
  {
    key: "iePlaceNames", file: "ie_place_names.pmtiles", sourceLayer: "ie_place_names", geom: "point", layerId: "ie-place-names-circle",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#f59e0b", tier: "S", count: 52402,
    catProp: "kind",
    cats: [
      { id: "centre", values: ["centre"], color: "#f59e0b", label: l3("人口中心（城鎮、村落）2,022", "Centres of population 2,022", "人口集中地 2,022") },
      { id: "townland", values: ["townland"], color: "#94a3b8", label: l3("Townland 50,046（z9 起）", "Townlands 50,046 (from z9)", "タウンランド 50,046（z9 から）") },
      { id: "island", values: ["island"], color: "#38bdf8", label: l3("島嶼 334（z9 起）", "Islands 334 (from z9)", "島 334（z9 から）") },
    ],
    title: { props: ["name_en", "name_ga"], fallback: l3("地名", "Place name", "地名") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: PLACE_KIND }, { prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") },
             { prop: "county", label: l3("郡", "County", "県") }, LA,
             { prop: "gaeltacht", label: l3("位於 Gaeltacht", "In the Gaeltacht", "ゲールタハト内"), map: YES_NO },
             { prop: "legislation", label: l3("愛爾蘭語名法定依據", "Irish name legislation", "アイルランド語名の法的根拠") },
             { prop: "logainm_id", label: l3("logainm.ie 編號", "logainm.ie ID", "logainm.ie ID"), kind: "code" }],
    legendNotes: [l3("拉遠只顯示人口中心；放大到 z9 才出現 townland 與島嶼", "Zoomed out only centres of population are shown; townlands and islands appear from z9", "縮小時は人口集中地のみ。タウンランドと島は z9 から表示"),
                  l3("只畫點、名稱放 popup（不畫文字標籤）；英文名由官方大寫轉為字首大寫", "Points only, names in the popup (no text labels); English names converted from upper case to title case", "点のみで名称はポップアップ（文字ラベルなし）。英語名は大文字表記を語頭大文字に変換")],
    popupNotes: [],
    sourceOrg: "Tailte Éireann, National Placenames Gazetteer", sourceUrl: `${AGOL_TAILTE}/Townlands___OSi_National_Placenames_Gazetteer/FeatureServer/0`, license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭地名載入中", "Loading Ireland place names", "アイルランドの地名を読み込み中"),
  },
  // ───────────── 原民與農村：Gaeltacht 語言規劃區 ─────────────
  {
    key: "ieGaeltacht", file: "ie_gaeltacht_lpa.pmtiles", sourceLayer: "ie_gaeltacht_lpa", geom: "polygon", layerId: "ie-gaeltacht-fill", outlineId: "ie-gaeltacht-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#fea332", count: 26,
    ramp: { prop: "daily_share", palette: "YlOrBr", breaks: [0.05, 0.15, 0.3, 0.5], labels: ["< 5%", "5–15%", "15–30%", "30–50%", "≥ 50%"],
            unit: l3("每天在教育體系外說愛爾蘭語的人口比例（3 歲以上，2022 普查）", "Share speaking Irish daily outside education (aged 3+, Census 2022)", "教育の場以外で毎日アイルランド語を話す人の割合（3歳以上、2022年国勢調査）") },
    title: { props: ["name_en", "name_ga"], fallback: l3("Gaeltacht 語言規劃區", "Gaeltacht language planning area", "ゲールタハト言語計画区域") },
    fields: [{ prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") }, { prop: "county", label: l3("郡", "County", "県") },
             { prop: "daily_share", label: l3("每天在教育體系外說愛爾蘭語", "Speak Irish daily outside education", "教育の場以外で毎日話す"), kind: "pct" },
             { prop: "speaker_share", label: l3("會說愛爾蘭語", "Can speak Irish", "アイルランド語を話せる"), kind: "pct" },
             { prop: "pop_3plus", label: l3("3 歲以上人口", "Population aged 3+", "3歳以上人口"), kind: "num" },
             { prop: "irish_speakers", label: l3("會說愛爾蘭語人數", "Irish speakers", "アイルランド語話者数"), kind: "num" },
             { prop: "daily_outside_edu", label: l3("每天在教育體系外說的人數", "Daily speakers outside education", "教育の場以外で毎日話す人数"), kind: "num" },
             { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 }],
    legendNotes: [l3("26 個 Gaeltacht 語言規劃區（法定 Gaeltacht 範圍與其聯集只差約 3.7 km²，不另畫）", "26 Gaeltacht language planning areas (their union differs from the statutory Gaeltacht by only about 3.7 km², so that layer is not drawn separately)", "ゲールタハト言語計画区域26区（法定ゲールタハト範囲との差は約3.7km²のため別表示しない）"),
                  l3("語言統計為 CSO 2022 普查，26 區合計 3 歲以上 102,973 人、會說 65,156 人、每天在教育體系外說 20,261 人", "Language figures from CSO Census 2022: 102,973 aged 3+, 65,156 Irish speakers and 20,261 daily speakers outside education across the 26 areas", "言語統計は CSO 2022年国勢調査。26区合計で3歳以上102,973人、話者65,156人、教育の場以外で毎日話す人20,261人")],
    popupNotes: [l3("語言統計為 2022 年普查（3 歲以上）", "Language statistics: Census 2022 (aged 3+)", "言語統計は2022年国勢調査（3歳以上）")],
    sourceOrg: "Tailte Éireann (Gaeltacht language planning areas 2026); Central Statistics Office (Census 2022 SAP2022T3T1LPT／T3T2LPT)", sourceUrl: "https://data.cso.ie/table/SAP2022T3T2LPT", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭 Gaeltacht 載入中", "Loading Ireland Gaeltacht areas", "アイルランドのゲールタハトを読み込み中"),
  },
  // ───────────── 運動休閒：活動地點、公園 ─────────────
  {
    key: "ieActivityLocations", file: "ie_activity_locations.pmtiles", sourceLayer: "ie_activity_locations", geom: "point", layerId: "ie-activity-locations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#ef6c00", tier: "M", count: 5318,
    catProp: "location_type",
    cats: [
      { id: "outdoor", values: ["Outdoor Facility"], color: "#ef6c00", label: l3("戶外場地", "Outdoor facility", "屋外施設") },
      { id: "indoor", values: ["Indoor Facility"], color: "#a78bfa", label: l3("室內場館", "Indoor facility", "屋内施設") },
      { id: "both", values: ["Indoor & Outdoor Facility"], color: "#f472b6", label: l3("室內外兼具", "Indoor & outdoor facility", "屋内外施設") },
      { id: "beach", values: ["Beach/Seashore"], color: "#facc15", label: l3("海灘、海岸", "Beach / seashore", "海浜・海岸") },
      { id: "inland_water", values: ["Inland Water"], color: "#38bdf8", label: l3("內陸水域", "Inland water", "内水面") },
      { id: "park", values: ["Park/Garden", "Green/Open Space"], color: "#7cb342", label: l3("公園、綠地", "Park, garden, green space", "公園・緑地") },
      { id: "nature", values: ["Forest/Woodland", "National Park/Nature Reserve"], color: "#2dd4bf", label: l3("森林、國家公園與自然保留區", "Forest, national park, nature reserve", "森林・国立公園・自然保護区") },
    ],
    title: { props: ["name"], fallback: l3("運動活動地點", "Activity location", "スポーツ活動地点") },
    fields: [{ prop: "location_type", label: l3("地點類型", "Location type", "地点種別") }, { prop: "activity", label: l3("活動項目", "Activities", "活動") },
             { prop: "owned_by_type", label: l3("所有者類型", "Owner type", "所有者種別") }, { prop: "managed_by_type", label: l3("管理者類型", "Manager type", "管理者種別") },
             { prop: "open_to_public", label: l3("開放大眾", "Open to the public", "一般開放"), map: YES_NO }, { prop: "amenities", label: l3("設施", "Amenities", "設備") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "eircode", label: l3("Eircode", "Eircode", "Eircode"), kind: "code" }, LA,
             { prop: "data_owner", label: l3("資料提供單位", "Data owner", "データ提供者") }],
    legendNotes: [l3("Sport Ireland「Get Ireland Active」名冊：各運動總會與地方政府登錄的活動地點，非完整場館普查", "Sport Ireland 'Get Ireland Active' roster of activity locations submitted by sports bodies and councils; not a complete facility census", "Sport Ireland「Get Ireland Active」の名簿（競技団体と自治体が登録した活動地点）。施設の全数調査ではない"),
                  l3("原資料含北愛 186 筆，已剔除；所有者空白歸「Unspecified」", "186 Northern Ireland records in the source were removed; blank owner type shown as 'Unspecified'", "原資料の北アイルランド186件は除外。所有者が空欄のものは「Unspecified」")],
    popupNotes: [],
    sourceOrg: "Sport Ireland, Get Ireland Active", sourceUrl: "https://data.gov.ie/dataset/getirelandactive_activitylocations", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭運動活動地點載入中", "Loading Ireland activity locations", "アイルランドのスポーツ活動地点を読み込み中"),
  },
  {
    // V-5：面＋代表點（`ie_parks_points.pmtiles`，登記在 repPointLayers，預設點）
    key: "ieParks", file: "ie_parks.pmtiles", sourceLayer: "ie_parks", geom: "polygon", layerId: "ie-parks-fill", outlineId: "ie-parks-line",
    srcMinzoom: 6, srcMaxzoom: 13, minzoom: 6, color: "#7cb342", count: 3221,
    catProp: "category",
    cats: [
      { id: "council_park", values: ["council_park"], color: "#7cb342", label: l3("議會公園（Dublin City、South Dublin 官方）", "Council parks (Dublin City, South Dublin official)", "議会の公園（Dublin City・South Dublin 公式）") },
      { id: "osm_park", values: ["osm_park"], color: "#a3e635", label: l3("公園（OSM leisure=park）", "Park (OSM leisure=park)", "公園（OSM leisure=park）") },
      { id: "osm_garden", values: ["osm_garden"], color: "#f472b6", label: l3("公共花園（OSM leisure=garden）", "Public garden (OSM leisure=garden)", "公共庭園（OSM leisure=garden）") },
    ],
    title: { props: ["name", "name_ga"], fallback: l3("公園", "Park", "公園") },
    fields: [{ prop: "category", label: l3("來源類別", "Source category", "出典区分"), map: {
                council_park: l3("議會官方公園", "Council park (official)", "議会の公園（公式）"), osm_park: l3("OSM 公園", "OSM park", "OSM 公園"), osm_garden: l3("OSM 公共花園", "OSM public garden", "OSM 公共庭園") } },
             { prop: "kind", label: l3("議會分類", "Council classification", "議会の分類") }, { prop: "name_ga", label: l3("愛爾蘭語名", "Irish name", "アイルランド語名") },
             { prop: "operator", label: l3("經營者", "Operator", "運営者") }, { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" }, LA,
             { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" }],
    legendNotes: [l3("官方公園面只有 Dublin City、South Dublin 兩個地方政府；其餘 29 個用 OpenStreetMap，完整度未驗", "Official park polygons exist only for Dublin City and South Dublin; the other 29 local authorities use OpenStreetMap (completeness unverified)", "公式の公園ポリゴンは Dublin City と South Dublin のみ。他の29自治体は OpenStreetMap（網羅性は未検証）"),
                  l3("私人花園已排除；無名花園只留標示開放者", "Private gardens excluded; unnamed gardens kept only when tagged as open to the public", "私有庭園は除外。名称のない庭園は一般開放のタグがあるもののみ")],
    popupNotes: [],
    sourceOrg: "Dublin City Council, South Dublin County Council (CC BY 4.0); © OpenStreetMap contributors (ODbL 1.0)", sourceUrl: "https://data.gov.ie/dataset/parks-and-open-spaces-dcc", license: "CC BY 4.0＋ODbL 1.0", fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭公園載入中", "Loading Ireland parks", "アイルランドの公園を読み込み中"),
  },
  // ───────────── 殯葬：墓地 ─────────────
  {
    key: "ieGraveyards", file: "ie_graveyards.pmtiles", sourceLayer: "ie_graveyards", geom: "point", layerId: "ie-graveyards-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", tier: "S", count: 6449,
    catProp: "category", cats: GRAVE_CATS,
    title: { props: ["name", "townland"], fallback: l3("墓地", "Graveyard", "墓地") },
    fields: [{ prop: "monument_class", label: l3("SMR 類別", "SMR class", "SMR 区分") }, { prop: "townland", label: l3("Townland", "Townland", "タウンランド") },
             { prop: "county", label: l3("郡", "County", "県") }, LA, { prop: "smr_no", label: l3("SMR 編號", "SMR no.", "SMR 番号"), kind: "code" }],
    legendNotes: [l3("SMR 是國家考古登錄（Sites and Monuments Record），收的是有考古或歷史價值的墓地，不是現行公墓名冊", "SMR is the national archaeological Sites and Monuments Record: graveyards of archaeological or historic interest, not a register of cemeteries in use", "SMR は国の遺跡登録（Sites and Monuments Record）。考古・歴史的価値のある墓地で、現行墓地の名簿ではない"),
                  l3("現行公墓只有 Fingal 議會名冊；其他地方政府的現行公墓未涵蓋", "Cemeteries in use come only from Fingal County Council; other local authorities' current cemeteries are not covered", "現行墓地は Fingal 議会の名簿のみ。他の自治体の現行墓地は未収録")],
    popupNotes: [],
    sourceOrg: "National Monuments Service (DHLGH) Sites and Monuments Record; Galway County Council; Fingal County Council", sourceUrl: "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services/SMROpenData/FeatureServer/0", license: CC_BY, fetchedAt: IE_W1_FETCHED_AT,
    loading: l3("愛爾蘭墓地載入中", "Loading Ireland graveyards", "アイルランドの墓地を読み込み中"),
  },
  // ───────────── 房地產（第 2 波）：商業房產估值、國有登記土地 ─────────────
  {
    // 15.6 萬點：z12 以下畫熱區（低縮放圖磚只帶 category），z12 起畫點
    key: "ieCommercialValuations", file: "ie_commercial_valuations.pmtiles", sourceLayer: "ie_commercial_valuations", geom: "point", layerId: "ie-commercial-valuations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, heat: { intensity: 0.6 }, color: "#f472b6", tier: "S", count: 156089,
    catProp: "category", cats: VALUATION_CATS,
    title: { props: ["uses", "address"], fallback: l3("商業房產", "Commercial property", "商業用不動産") },
    fields: [{ prop: "valuation_category", label: l3("估值類別", "Valuation category", "評価区分") }, { prop: "uses", label: l3("用途", "Uses", "用途") },
             { prop: "nav_eur", label: l3("淨年值 NAV（€／年）", "Net annual value (NAV, €/yr)", "純年間価値 NAV（€／年）"), kind: "num" },
             { prop: "rv_cork", label: l3("舊制應課稅估值 RV（Cork，非 NAV、不可比）", "Rateable valuation, old basis (Cork; not NAV, not comparable)", "旧制の課税評価額 RV（Cork、NAV と比較不可）"), kind: "num" },
             { prop: "floor_area_m2", label: l3("樓地板面積", "Floor area", "床面積"), kind: "num", unit: "m²", digits: 1 },
             { prop: "main_floor_use", label: l3("主要樓層用途", "Main floor use", "主な床用途") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "eircode", label: l3("Eircode", "Eircode", "Eircode"), kind: "code" },
             { prop: "valuation_date", label: l3("估值基準日", "Valuation date", "評価基準日") }, { prop: "publication_date", label: l3("公布日", "Publication date", "公表日") },
             LA, { prop: "property_number", label: l3("房產編號", "Property number", "物件番号"), kind: "code" }],
    legendNotes: [l3("Valuation Office 對應繳商業地方稅（commercial rates）房產的估值，不含住宅，也不是市價", "Valuation Office valuations of property liable for commercial rates; excludes homes and is not market value", "商業用固定資産税（commercial rates）の課税対象物件の評価。住宅を含まず、市場価格ではない"),
                  l3("29 個地方政府為淨年值 NAV（各區重估基準日不同）；Cork 市、郡尚未重估，數字是舊制 RV，不能和 NAV 比較，也沒有類別", "29 local authorities show net annual value (revaluation dates differ by area); Cork City and County are not yet revalued, so figures are old-basis RV, not comparable with NAV and uncategorised", "29自治体は純年間価値 NAV（再評価基準日は地域ごとに異なる）。Cork 市・県は未再評価で旧制 RV のため NAV と比較できず区分もない"),
                  l3("官方說明不保證完整；旅館、酒吧、加油站等因保密可能缺細項。拉遠為熱區，放大到 z12 才出現點", "Not guaranteed complete; hotels, pubs, filling stations etc. may lack details for confidentiality. Heatmap when zoomed out; points from z12", "完全性は保証されない。ホテル・パブ・給油所などは守秘のため詳細が欠ける場合あり。縮小時はヒートマップ、z12 から点"),
                  l3("地址只留街道、單位與地名行；可能是商號或人名的行不顯示", "Address shows street, unit and place-name lines only; lines that may be trading or personal names are omitted", "住所は通り・区画・地名の行のみ。屋号や個人名の可能性がある行は表示しない")],
    popupNotes: [l3("金額為 Valuation Office 估值，不是市價", "Values are Valuation Office valuations, not market prices", "金額は Valuation Office の評価額で市場価格ではない")],
    sourceOrg: "Tailte Éireann (Valuation Office), Valuation API", sourceUrl: "https://tailte.ie/home/api/", license: CC_BY, fetchedAt: IE_W2_FETCHED_AT,
    loading: l3("愛爾蘭商業房產估值載入中", "Loading Ireland commercial valuations", "アイルランドの商業用不動産評価を読み込み中"),
  },
  {
    // V-5：面（z8 起）＋代表點（`ie_state_assets_points.pmtiles`，登記在 repPointLayers，預設點、拉遠熱區）
    key: "ieStateAssets", file: "ie_state_assets.pmtiles", sourceLayer: "ie_state_assets", geom: "polygon", layerId: "ie-state-assets-fill", outlineId: "ie-state-assets-line",
    srcMinzoom: 8, srcMaxzoom: 14, minzoom: 8, color: "#38bdf8", count: 75443,
    catProp: "owner_group", cats: STATE_OWNER_CATS,
    title: { props: ["reg_owner"], fallback: l3("國有登記土地", "State-owned registered land", "国有登記地") },
    fields: [{ prop: "reg_owner", label: l3("登記所有人", "Registered owner", "登記所有者") }, { prop: "gov_agency", label: l3("主管部會", "Government agency", "所管省庁") },
             { prop: "folio", label: l3("Folio 編號", "Folio", "フォリオ番号"), kind: "code" },
             { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 2 },
             // BUILDING_USE 只有 C／U／R／B 代碼、來源未附定義，不放 popup
             { prop: "county", label: l3("郡", "County", "県") }, LA],
    legendNotes: [l3("土地開發署（LDA）國有資產資料庫：在不動產登記署（PRA）登記為國家機關、地方政府或國營事業所有的 folio；不是待標售名單", "Land Development Agency State Assets Database: folios registered with the Property Registration Authority to state bodies, local authorities or state companies; not a list of land for sale", "土地開発庁（LDA）国有資産データベース：不動産登記庁（PRA）に国・自治体・国営企業の所有として登記された筆。売却予定地の一覧ではない"),
                  l3("2023 年第 3 季版，之後未更新；folio 為當時登記查詢結果、不保證現況。未在 PRA 登記的國有地未涵蓋", "Q3 2023 edition, not updated since; folios reflect the registry search at that time. State land not registered with the PRA is not covered", "2023年第3四半期版で以後未更新。筆は当時の登記照会の結果で現況は保証されない。PRA 未登記の国有地は未収録"),
                  l3("folio 邊界源自 PRA 資料、另受 PRA 版權註記（授權待確認）。拉遠為代表點熱區，面在 z8 起出現", "Folio boundaries derive from PRA data and carry a PRA copyright notice (licence to be confirmed). Heatmap of representative points when zoomed out; polygons from z8", "筆界は PRA データ由来で PRA の著作権表示あり（ライセンス確認中）。縮小時は代表点のヒートマップ、面は z8 から")],
    popupNotes: [l3("2023 Q3 登記狀態，不保證現況", "Registry status as of Q3 2023; may have changed", "2023年第3四半期時点の登記状況で現況は保証されない")],
    sourceOrg: "Land Development Agency, State Assets Database (PRA State Assets, Q3 2023); folio boundaries © Property Registration Authority", sourceUrl: "https://opendata-lda-ie.hub.arcgis.com/datasets/lda-ie::pra-state-assets", license: "CC BY 4.0 (folio boundaries © PRA; licence to be confirmed)", fetchedAt: IE_W2_FETCHED_AT,
    loading: l3("愛爾蘭國有登記土地載入中", "Loading Ireland state-owned land", "アイルランドの国有登記地を読み込み中"),
  },
  // ───────────── 第 3a 波：水資源（測站、水體、排水）、災害（淹水、海岸侵蝕） ─────────────
  {
    key: "ieHydrometricStations", file: "ie_hydrometric_stations.pmtiles", sourceLayer: "ie_hydrometric_stations", geom: "point", layerId: "ie-hydrometric-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#2dd4bf", tier: "S", count: 2322,
    title: { props: ["station_name"], fallback: l3("水文站", "Hydrometric station", "水文観測所") },
    fields: [{ prop: "station_number", label: l3("站號", "Station number", "観測所番号"), kind: "code" }, LA],
    legendNotes: [l3("EPA 水文站名冊：OPW、地方政府與 EPA 的水位、流量站；名冊只有站名與站號，沒有讀數與啟用狀態", "EPA register of hydrometric gauges run by the OPW, local authorities and the EPA; the register has names and numbers only, no readings or operating status", "EPA の水文観測所名簿（OPW・自治体・EPA の水位・流量観測所）。名称と番号のみで、観測値や稼働状況はない"),
                  l3("北愛的站已剔除（2,591 筆中空座標 17、北愛 252）", "Northern Ireland stations removed (of 2,591: 17 without coordinates, 252 in Northern Ireland)", "北アイルランドの観測所は除外（2,591件中、座標なし17・北アイルランド252）")],
    popupNotes: [l3("即時水位請看 waterlevel.ie（OPW）", "For live levels see waterlevel.ie (OPW)", "リアルタイム水位は waterlevel.ie（OPW）を参照")],
    sourceOrg: "Environmental Protection Agency (EPA), Monitoring – Hydrometric Gauges", sourceUrl: DGI("monitoring-hydrometric-gauges"), license: CC_BY, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭水文站載入中", "Loading Ireland hydrometric stations", "アイルランドの水文観測所を読み込み中"),
  },
  {
    // 1.5 萬點：拉遠畫熱區（V-1）
    key: "ieWaterMonitoring", file: "ie_water_monitoring.pmtiles", sourceLayer: "ie_water_monitoring", geom: "point", layerId: "ie-water-monitoring-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, heat: { intensity: 3 }, color: "#38bdf8", tier: "S", count: 14766,
    catProp: "category", cats: WATER_MONITORING_CATS,
    title: { props: ["name"], fallback: l3("水質監測站", "Water monitoring station", "水質観測点") },
    fields: [{ prop: "station_id", label: l3("站碼", "Station ID", "観測点コード"), kind: "code" }, { prop: "water_body", label: l3("水體", "Water body", "水域") },
             { prop: "monitoring_purpose", label: l3("WFD 監測類型", "WFD monitoring type", "WFD 監視区分") },
             { prop: "river_basin_district", label: l3("流域區", "River basin district", "流域区") }, { prop: "created_by", label: l3("建站單位", "Created by", "設置機関") },
             { prop: "operator", label: l3("營運單位", "Operator", "運営者") }, { prop: "pe_band", label: l3("集污區人口當量級距", "Agglomeration PE band", "集水区の人口当量区分") },
             { prop: "agglomeration_pe", label: l3("集污區人口當量", "Agglomeration PE", "集水区の人口当量"), kind: "num" },
             { prop: "plant_design_pe", label: l3("設計處理人口當量", "Plant design PE", "設計処理人口当量"), kind: "num" },
             { prop: "treatment_type", label: l3("處理等級", "Treatment type", "処理方式") }, { prop: "licence_status", label: l3("排放許可狀態", "Licence status", "排出許可の状態") },
             { prop: "licence_number", label: l3("許可證號", "Licence number", "許可番号"), kind: "code" }, LA],
    legendNotes: [l3("EPA 水框架指令（WFD）監測站 14,220（河川、湖泊、河口、沿海、地下水；北愛 41 站已剔除）＋都市污水處理廠 546（集污區人口當量 ≥500）", "EPA Water Framework Directive monitoring stations 14,220 (river, lake, transitional, coastal, groundwater; 41 Northern Ireland stations removed) plus 546 urban waste water treatment plants (agglomerations ≥500 PE)", "EPA 水枠組み指令（WFD）観測点 14,220（河川・湖沼・汽水域・沿岸・地下水。北アイルランド41点を除外）＋都市下水処理場546（集水区の人口当量500以上）"),
                  l3("只有站點與屬性，沒有水質數值；河川、湖泊的水質評等請看「WFD 河川／湖泊水體」", "Locations and attributes only, no measurements; for water quality status see the WFD river / lake waterbody layers", "位置と属性のみで測定値はない。水質評価は「WFD 河川／湖沼水域」を参照"),
                  l3("拉遠為熱區，放大後出現點", "Heatmap when zoomed out; points appear when zoomed in", "縮小時はヒートマップ、拡大すると点")],
    popupNotes: [],
    sourceOrg: "Environmental Protection Agency (EPA), WFD monitoring stations; urban waste water treatment plant locations", sourceUrl: DGI("water-monitoring-stations"), license: CC_BY, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭水質監測站載入中", "Loading Ireland water monitoring stations", "アイルランドの水質観測点を読み込み中"),
  },
  {
    key: "ieRiverWaterBodies", file: "ie_river_water_bodies.pmtiles", sourceLayer: "ie_river_water_bodies", geom: "line", layerId: "ie-river-water-bodies-line",
    srcMinzoom: 5, srcMaxzoom: 12, minzoom: 5, color: "#38bdf8", count: 3208,
    catProp: "status", cats: WFD_STATUS_CATS, otherColor: "#94a3b8", otherLabel: WFD_UNASSIGNED,
    title: { props: ["name"], fallback: l3("河川水體", "River waterbody", "河川水域") },
    fields: [WFD_STATUS_FIELD, { prop: "code", label: l3("水體代碼", "Waterbody code", "水域コード"), kind: "code" },
             { prop: "period", label: l3("評定期間", "Assessment period", "評価期間") }],
    legendNotes: [l3("EPA 依歐盟水框架指令（WFD）劃設的河川水體 3,208 段，顏色為 2019–2024 生態狀態", "3,208 river waterbodies delineated by the EPA under the EU Water Framework Directive, coloured by 2019–2024 ecological status", "EU 水枠組み指令（WFD）に基づき EPA が区分した河川水域3,208区間。色は2019–2024年の生態学的状態"),
                  l3("一個水體是一段河川（含支流），不是全部河網", "Each waterbody is a river stretch (with tributaries), not the full river network", "1水域は河川の一区間（支流を含む）で、全河川網ではない")],
    popupNotes: [],
    sourceOrg: "Environmental Protection Agency (EPA), WFD River Waterbody Status 2019–2024", sourceUrl: DGI("wfd-river-waterbody-status-2019-2024"), license: CC_BY, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭河川水體載入中", "Loading Ireland river waterbodies", "アイルランドの河川水域を読み込み中"),
  },
  {
    key: "ieLakeWaterBodies", file: "ie_lake_water_bodies.pmtiles", sourceLayer: "ie_lake_water_bodies", geom: "polygon", layerId: "ie-lake-water-bodies-fill", outlineId: "ie-lake-water-bodies-line",
    srcMinzoom: 5, srcMaxzoom: 12, minzoom: 5, color: "#38bdf8", count: 812,
    catProp: "status", cats: WFD_STATUS_CATS, otherColor: "#94a3b8", otherLabel: WFD_UNASSIGNED,
    title: { props: ["name"], fallback: l3("湖泊水體", "Lake waterbody", "湖沼水域") },
    fields: [WFD_STATUS_FIELD, { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 2 },
             { prop: "local_authority", label: l3("地方政府", "Local authority", "地方自治体") }, { prop: "hydrometric_area", label: l3("水文區", "Hydrometric area", "水文区") },
             { prop: "code", label: l3("水體代碼", "Waterbody code", "水域コード"), kind: "code" }, { prop: "period", label: l3("評定期間", "Assessment period", "評価期間") }],
    legendNotes: [l3("EPA 依 WFD 劃設的湖泊水體 812 個，顏色為 2019–2024 生態狀態", "812 lake waterbodies delineated by the EPA under the WFD, coloured by 2019–2024 ecological status", "WFD に基づき EPA が区分した湖沼水域812。色は2019–2024年の生態学的状態")],
    popupNotes: [],
    sourceOrg: "Environmental Protection Agency (EPA), WFD Lake Waterbody Status 2019–2024", sourceUrl: DGI("wfd-lake-waterbody-status-2019-2024"), license: CC_BY, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭湖泊水體載入中", "Loading Ireland lake waterbodies", "アイルランドの湖沼水域を読み込み中"),
  },
  {
    key: "ieArterialDrainage", file: "ie_arterial_drainage.pmtiles", sourceLayer: "ie_arterial_drainage", geom: "line", layerId: "ie-arterial-drainage-line",
    srcMinzoom: 5, srcMaxzoom: 13, minzoom: 5, color: "#38bdf8", count: 6693,
    catProp: "feature_type", cats: DRAINAGE_CATS,
    title: { props: ["scheme"], fallback: l3("主幹排水工程", "Arterial drainage scheme", "幹線排水事業") },
    fields: [{ prop: "feature_type", label: l3("類型", "Type", "種別"), map: Object.fromEntries(DRAINAGE_CATS.map((c) => [c.id, c.label])) },
             { prop: "scheme", label: l3("排水工程", "Scheme", "排水事業") }, { prop: "ref", label: l3("渠道／堤防編號", "Reference", "番号"), kind: "code" },
             { prop: "region", label: l3("OPW 分區", "OPW region", "OPW 管区") }],
    legendNotes: [l3("依 1945、1995 年 Arterial Drainage Acts 興建、OPW 有法定維護義務的排水渠 6,094 段與堤防 599 段（65 個工程）", "6,094 channel and 599 embankment segments (65 schemes) built under the Arterial Drainage Acts 1945 & 1995 that the OPW is legally obliged to maintain", "1945・1995年 Arterial Drainage Acts に基づき建設され OPW に法定維持義務がある排水路6,094区間と堤防599区間（65事業）"),
                  l3("不含地方政府維護的 Drainage District 渠道與堤防、防洪工程", "Excludes Drainage District channels and embankments (local authority) and flood relief schemes", "自治体管理の Drainage District の水路・堤防と洪水対策事業は含まない")],
    popupNotes: [],
    sourceOrg: "Office of Public Works (OPW), Arterial Drainage Scheme channels and embankments", sourceUrl: DGI("arterial-drainage-scheme-channels"), license: CC_BY, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭主幹排水渠載入中", "Loading Ireland arterial drainage", "アイルランドの幹線排水路を読み込み中"),
  },
  {
    // ND：原樣上圖、單獨成層。一情境一支 PMTiles（`IE_FLOOD_SCENARIOS`），host 依參數換 `file`
    key: "ieRiverFloodExtents", file: ieFloodScenarioFile(IE_FLOOD_SCENARIO_DEFAULT), sourceLayer: "ie_river_flood_extents", geom: "polygon",
    layerId: "ie-river-flood-extents-fill", outlineId: "ie-river-flood-extents-line",
    srcMinzoom: 5, srcMaxzoom: 13, minzoom: 5, color: "#3b82f6", count: 4116,
    title: { props: [], fallback: l3("河川淹水範圍（模擬）", "River flood extent (modelled)", "河川浸水範囲（シミュレーション）") },
    fields: [{ prop: "c", label: l3("情境", "Scenario", "シナリオ"), map: FLOOD_SCENARIO_CODE },
             { prop: "pppp", label: l3("重現期", "Return period", "再現期間"), map: FLOOD_PERIOD_CODE },
             { prop: "ext_id", label: l3("範圍編號", "Extent ID", "範囲 ID"), kind: "code" }],
    legendNotes: [NC_ND_NOTE("OPW"),
                  l3("OPW 全國指示性河川淹水模擬（NIFM）：現況與兩種未來氣候情境（中端 MRFS、高端 HEFS）× 20／100／1000 年一遇，共 9 組，在圖層設定切換（預設現況・100 年一遇）", "OPW National Indicative Fluvial Mapping: current and two future scenarios (mid-range MRFS, high-end HEFS) × 1-in-20/100/1000 year, 9 sets switchable in layer settings (default: current, 1-in-100)", "OPW 全国指示的河川浸水図（NIFM）：現況と将来2シナリオ（中位 MRFS・高位 HEFS）× 20／100／1000年確率の9組をレイヤー設定で切替（既定：現況・100年確率）"),
                  l3("指示性模擬，不是個別地塊的淹水判定；只含河川淹水，不含海岸、地下水與地表逕流淹水", "Indicative modelling, not a property-level flood assessment; fluvial only (excludes coastal, groundwater and pluvial flooding)", "指示的なシミュレーションで個別地点の判定ではない。河川氾濫のみ（沿岸・地下水・内水は含まない）"),
                  l3("拉遠時圖磚會省略最小的淹水面（只影響顯示）", "Smallest flood polygons are omitted in zoomed-out tiles (display only)", "縮小時のタイルでは最小の浸水面を省略（表示のみ）")],
    popupNotes: [l3("CC BY-NC-ND・非商業使用；OPW 指示性模擬，非地塊判定", "CC BY-NC-ND · non-commercial; OPW indicative modelling, not property-level", "CC BY-NC-ND・非商用。OPW の指示的シミュレーションで地点判定ではない")],
    sourceOrg: "Office of Public Works (OPW), National Indicative Fluvial Mapping (NIFM)", sourceUrl: DGI("nifm-river-flood-extents-current-scenario"), license: CC_BY_NC_ND, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭河川淹水範圍載入中", "Loading Ireland river flood extents", "アイルランドの河川浸水範囲を読み込み中"),
  },
  {
    // ND：兩份 ICPSS 原樣疊在同一支圖磚，以原有 typecode 區分（不新增欄位）
    key: "ieCoastalErosion", file: "ie_coastal_erosion.pmtiles", sourceLayer: "ie_coastal_erosion", geom: "line", layerId: "ie-coastal-erosion-line",
    srcMinzoom: 5, srcMaxzoom: 13, minzoom: 5, color: "#ef4444", count: 74256,
    catProp: "typecode", cats: EROSION_CATS,
    title: { props: [], fallback: l3("海岸侵蝕", "Coastal erosion", "海岸侵食") },
    fields: [{ prop: "typecode", label: l3("線別", "Line", "線種"), map: Object.fromEntries(EROSION_CATS.map((c) => [c.id, c.label])) },
             { prop: "eros_rate", label: l3("侵蝕速率", "Erosion rate", "侵食速度"), kind: "num", unit: "m／年", digits: 3 },
             { prop: "region", label: l3("ICPSS 分區", "ICPSS region", "ICPSS 区域") }, { prop: "pub_date", label: l3("發布", "Published", "公表") }],
    legendNotes: [NC_ND_NOTE("OPW"),
                  l3("OPW 愛爾蘭海岸防護策略研究（ICPSS 2010–2014）：2050 侵蝕線 1,220 段（現況情境推估）、侵蝕速率線 73,036 段（約 72% 為 0）", "OPW Irish Coastal Protection Strategy Study (ICPSS 2010–2014): 2050 erosion line 1,220 segments (current scenario) and erosion rate line 73,036 segments (about 72% are 0)", "OPW アイルランド海岸防護戦略調査（ICPSS 2010–2014）：2050年侵食線1,220区間（現況シナリオ）・侵食速度線73,036区間（約72%が0）"),
                  l3("官方說明：評估未排除既有海岸防護結構的影響", "Per the OPW: the assessment does not exclude the effect of existing coastal defences", "OPW の説明：既存の海岸防護施設の影響は除外されていない")],
    popupNotes: [l3("CC BY-NC-ND・非商業使用；ICPSS 2010–2014 推估", "CC BY-NC-ND · non-commercial; ICPSS 2010–2014 estimate", "CC BY-NC-ND・非商用。ICPSS 2010–2014 の推計")],
    sourceOrg: "Office of Public Works (OPW), Irish Coastal Protection Strategy Study (ICPSS 2010–2014)", sourceUrl: DGI("icpss-2010-2014-erosion-rate-line"), license: CC_BY_NC_ND, fetchedAt: IE_W3A_FETCHED_AT,
    loading: l3("愛爾蘭海岸侵蝕載入中", "Loading Ireland coastal erosion", "アイルランドの海岸侵食を読み込み中"),
  },  // ───────────── 第 4 波：交通（場站、路網、樞紐節點） ─────────────
  {
    // 1.4 萬站：拉遠畫熱區（V-1），z12 起點
    key: "ieTransitStops", file: "ie_transit_stops.pmtiles", sourceLayer: "ie_transit_stops", geom: "point", layerId: "ie-transit-stops-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, heat: { intensity: 2 }, color: "#38bdf8", tier: "S", count: 14149,
    catProp: "mode", cats: TRANSIT_MODE_CATS,
    title: { props: ["stop_name"], fallback: l3("大眾運輸站牌", "Public transport stop", "公共交通の停留所") },
    fields: [{ prop: "mode", label: l3("主要運具", "Main mode", "主な交通機関"), map: MODE_MAP },
             { prop: "route_count", label: l3("經過路線數", "Routes serving", "経由路線数"), kind: "num" },
             { prop: "routes", label: l3("路線", "Routes", "路線") }, { prop: "operators", label: l3("營運者", "Operators", "運行事業者") },
             { prop: "wheelchair", label: l3("輪椅可上下車", "Wheelchair boarding", "車いす乗降"), map: { yes: l3("是", "Yes", "はい"), no: l3("否", "No", "いいえ") } },
             { prop: "stop_code", label: l3("站牌號碼", "Stop number", "停留所番号"), kind: "code" }, LA],
    legendNotes: [IE_GTFS_NOTE,
                  l3("運具依經過路線的 GTFS route_type 判定；一站有多種運具時依鐵路＞輕軌＞公車取一類。GTFS 沒有渡輪路線", "Mode from the GTFS route_type of routes serving the stop; stops with several modes take rail > tram > bus. The GTFS has no ferry routes", "交通機関は経由路線の GTFS route_type で判定。複数ある停留所は鉄道＞路面電車＞バスの順で1つ。GTFS にフェリー路線はない"),
                  l3("北愛的站（跨境路線）已剔除。只有站位與路線，沒有班次頻率與即時到站。拉遠為熱區，放大到 z12 才出現點", "Northern Ireland stops (cross-border routes) removed. Locations and routes only; no frequency or real-time arrivals. Heatmap when zoomed out; points from z12", "北アイルランドの停留所（越境路線）は除外。位置と路線のみで、運行頻度やリアルタイム到着はない。縮小時はヒートマップ、z12 から点")],
    popupNotes: [],
    sourceOrg: "National Transport Authority (Transport for Ireland), GTFS — all operators (via Mobility Database mirror mdb-2364)", sourceUrl: DGI("nta-gtfs"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("愛爾蘭大眾運輸站牌載入中", "Loading Ireland public transport stops", "アイルランドの公共交通停留所を読み込み中"),
  },
  {
    key: "ieDublinbikesStations", file: "ie_dublinbikes_stations.pmtiles", sourceLayer: "ie_dublinbikes_stations", geom: "point", layerId: "ie-dublinbikes-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#4ade80", tier: "S", count: 113,
    title: { props: ["name"], fallback: l3("Dublinbikes 站", "Dublinbikes station", "Dublinbikes ステーション") },
    fields: [{ prop: "address", label: l3("地址", "Address", "住所") }, { prop: "capacity", label: l3("車柱數", "Docks", "ドック数"), kind: "num" },
             { prop: "station_id", label: l3("站號", "Station ID", "ステーション番号"), kind: "code" }],
    legendNotes: [l3("都柏林市公共自行車 Dublinbikes 113 站（車柱合計 3,617），只有都柏林市", "Dublinbikes public bike scheme: 113 stations (3,617 docks), Dublin City only", "都市型シェアサイクル Dublinbikes の113ステーション（ドック計3,617）、ダブリン市のみ"),
                  l3("靜態站點；即時可借車數未收", "Static station list; live availability not included", "静的なステーション一覧で、リアルタイムの貸出可能台数は含まない")],
    popupNotes: [],
    sourceOrg: "Dublin City Council / JCDecaux, dublinbikes (Smart Dublin)", sourceUrl: DGI("dublinbikes-api"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("Dublinbikes 站點載入中", "Loading Dublinbikes stations", "Dublinbikes ステーションを読み込み中"),
  },
  {
    key: "ieRoadRailNetwork", file: "ie_road_rail_network.pmtiles", sourceLayer: "ie_road_rail_network", geom: "line", layerId: "ie-road-rail-network-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#f59e0b", count: 5667,
    catProp: "road_class", cats: ROAD_CLASS_CATS,
    title: { props: [], fallback: l3("主要道路與鐵路", "Main roads & railways", "主要道路と鉄道") },
    fields: [{ prop: "road_class", label: l3("等級", "Class", "等級"), map: Object.fromEntries(ROAD_CLASS_CATS.map((c) => [c.id, c.label])) },
             { prop: "length_km", label: l3("路段長", "Segment length", "区間長"), kind: "num", unit: "km", digits: 2 }, LA],
    legendNotes: [l3("Tailte Éireann 1:250,000 一般化路網：道路 5,188 段、鐵路 479 段；城市內只畫穿越主幹道，不含 Luas", "Tailte Éireann 1:250,000 generalised network: 5,188 road and 479 railway segments; only through routes inside towns, no Luas", "Tailte Éireann 1:250,000 の一般化網：道路5,188区間・鉄道479区間。市街地は通過幹線のみで Luas は含まない"),
                  l3("道路等級依 EuroRegionalMap 代碼表（RTT）推定，Tailte 未附說明；沒有路線編號（M／N／R）與路名", "Road classes follow the EuroRegionalMap RTT code list (inferred; Tailte publishes no code description); no route numbers (M/N/R) or names", "道路等級は EuroRegionalMap の RTT コード表による推定（Tailte の説明なし）。路線番号（M／N／R）や名称はない")],
    popupNotes: [],
    sourceOrg: "Tailte Éireann, National 250k Map of Ireland: Roads, Rail Network", sourceUrl: DGI("roads-national-250k-map-of-ireland"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("愛爾蘭道路與鐵路載入中", "Loading Ireland roads and railways", "アイルランドの道路と鉄道を読み込み中"),
  },
  {
    key: "ieRoadMarkers", file: "ie_road_markers.pmtiles", sourceLayer: "ie_road_markers", geom: "point", layerId: "ie-road-markers-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "S", count: 4206,
    catProp: "kind", cats: MARKER_KIND_CATS,
    title: { props: ["road"], fallback: l3("交流道", "Interchange", "インターチェンジ") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: Object.fromEntries(MARKER_KIND_CATS.map((c) => [c.id, c.label])) },
             { prop: "km", label: l3("里程", "Chainage", "キロ程"), kind: "num", unit: "km", digits: 1 },
             { prop: "direction", label: l3("方向（推定為行車方向）", "Direction (inferred: carriageway)", "方向（進行方向と推定）"), kind: "code" },
             { prop: "townland", label: l3("Townland", "Townland", "タウンランド") }, { prop: "county", label: l3("郡", "County", "県") },
             { prop: "route_id", label: l3("TII 路線代碼", "TII route ID", "TII 路線コード"), kind: "code" }],
    legendNotes: [l3("TII 國道（M、N 路）每 0.5 km 的里程牌 4,163 面，加 Tailte 250k 交流道 43 處（無名稱）", "TII marker plates every 0.5 km on national roads (M and N): 4,163, plus 43 Tailte 250k interchanges (unnamed)", "TII 国道（M・N）0.5 km ごとのキロポスト4,163枚と、Tailte 250k のインターチェンジ43か所（名称なし）"),
                  l3("TII 條目停在 2018-03-05，之後新闢路段未涵蓋；地方道路（R 路）沒有來源", "TII listing dated 2018-03-05; later road sections are not covered; no source for regional (R) roads", "TII の登録は2018-03-05で以後の新設区間は未収録。地方道路（R）の出典はない")],
    popupNotes: [],
    sourceOrg: "Transport Infrastructure Ireland, Marker Plates; Tailte Éireann, National 250k Road Interchanges", sourceUrl: DGI("marker-plates"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("愛爾蘭國道里程標載入中", "Loading Ireland road marker plates", "アイルランドのキロポストを読み込み中"),
  },
  {
    key: "ieTrafficCounters", file: "ie_traffic_counters.pmtiles", sourceLayer: "ie_traffic_counters", geom: "point", layerId: "ie-traffic-counters-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f472b6", tier: "S", count: 308,
    catProp: "road_type", cats: COUNTER_ROAD_CATS,
    title: { props: ["label"], fallback: l3("交通量計數站", "Traffic counter", "交通量計測所") },
    fields: [{ prop: "description", label: l3("路段", "Section", "区間") }, { prop: "road", label: l3("路線", "Road", "路線") },
             { prop: "site_id", label: l3("站號", "Site ID", "計測所番号"), kind: "code" }],
    legendNotes: [l3("TII（前身 NRA）國道自動交通量計數站 308 站的位置；名冊停在 2018-03-05", "Locations of 308 TII (formerly NRA) automatic traffic counters on national roads; register dated 2018-03-05", "TII（旧 NRA）国道自動交通量計測所308か所の位置。名簿は2018-03-05時点"),
                  l3("只有位置、沒有流量：TII 每日計數檔 2021 年後無法取得", "Locations only, no counts: TII daily count files are unavailable after 2021", "位置のみで交通量はない。TII の日次計測ファイルは2021年以降取得できない")],
    popupNotes: [l3("2018 名冊，站點現況未確認", "2018 register; current status unverified", "2018年名簿で現況は未確認")],
    sourceOrg: "Transport Infrastructure Ireland, Traffic Counter Locations", sourceUrl: DGI("traffic-counter-locations"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("愛爾蘭交通量計數站載入中", "Loading Ireland traffic counters", "アイルランドの交通量計測所を読み込み中"),
  },
  {
    key: "ieAirportsPorts", file: "ie_airports_ports.pmtiles", sourceLayer: "ie_airports_ports", geom: "point", layerId: "ie-airports-ports-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 104,
    catProp: "kind", cats: PORT_KIND_CATS,
    title: { props: ["name"], fallback: l3("機場、港口", "Airport / port", "空港・港") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: Object.fromEntries(PORT_KIND_CATS.map((c) => [c.id, c.label])) },
             { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
             { prop: "status", label: l3("狀態", "Status", "状態"), map: { closed: l3("已停用（OurAirports）", "Closed (OurAirports)", "閉鎖（OurAirports）") } },
             { prop: "area_km2", label: l3("機場面積", "Airfield area", "空港面積"), kind: "num", unit: "km²", digits: 2 },
             { prop: "route", label: l3("渡輪航線", "Ferry route", "フェリー航路") }, LA],
    legendNotes: [l3("Tailte 250k：機場 9（≥0.4 km² 機場面，取中心）、小型機場 21、主要港口 6、其他港口 30；國家海洋規劃架構渡輪碼頭 38（2021）", "Tailte 250k: 9 airports (≥0.4 km² airfield areas, centre point), 21 small airfields, 6 main and 30 other harbours; 38 National Marine Planning Framework ferry ports (2021)", "Tailte 250k：空港9（0.4 km² 以上の空港面の中心）、小規模飛行場21、主要港6、その他の港30。国家海洋計画枠組みのフェリー乗り場38（2021）"),
                  l3("大機場名稱以 OurAirports（public domain）3 km 內最近機場補上；沒有運量與等級", "Airport names matched from OurAirports (public domain) within 3 km; no traffic or ranking", "空港名は OurAirports（パブリックドメイン）の3 km 以内の空港で補完。取扱量や等級はない")],
    popupNotes: [],
    sourceOrg: "Tailte Éireann, National 250k (Airfield Area, Airports, Harbours); National Marine Planning Framework Ferry Port (DHLGH); names: OurAirports", sourceUrl: DGI("airports-national-250k-map-of-ireland"), license: CC_BY, fetchedAt: IE_W4_FETCHED_AT,
    loading: l3("愛爾蘭機場與港口載入中", "Loading Ireland airports and ports", "アイルランドの空港と港を読み込み中"),
  },
  // ───────────── 第 3b 波：海洋 ─────────────
  {
    key: "ieBathingWaters", file: "ie_bathing_waters.pmtiles", sourceLayer: "ie_bathing_waters", geom: "point", layerId: "ie-bathing-waters-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 243,
    catProp: "category", cats: BATHING_CATS,
    title: { props: ["name"], fallback: l3("浴場", "Bathing water", "水浴場") },
    fields: [{ prop: "category", label: l3("水質分級", "Water quality class", "水質区分"), map: Object.fromEntries(BATHING_CATS.map((c) => [c.id, c.label])) },
             { prop: "class_year", label: l3("分級年度", "Classification year", "区分年度"), kind: "year" },
             { prop: "class_history", label: l3("前 3 年分級", "Previous 3 years", "過去3年の区分") },
             { prop: "restriction", label: l3("全季禁止游泳", "All-season bathing restriction", "通年遊泳禁止"), map: YES_NO },
             { prop: "restriction_reason", label: l3("禁止原因", "Restriction reason", "禁止理由") },
             { prop: "blue_flag", label: l3("藍旗海灘", "Blue Flag", "ブルーフラッグ"), map: YES_NO },
             { prop: "green_coast", label: l3("Green Coast 獎", "Green Coast award", "Green Coast 賞"), map: YES_NO },
             { prop: "lifeguard", label: l3("救生員", "Lifeguard", "ライフガード"), map: YES_NO },
             { prop: "toilets", label: l3("廁所", "Toilets", "トイレ"), map: YES_NO },
             { prop: "accessible", label: l3("無障礙", "Disability access", "バリアフリー"), map: YES_NO },
             { prop: "authority", label: l3("管理地方政府", "Local authority", "管理自治体") },
             { prop: "beach_id", label: l3("浴場代碼", "Bathing water ID", "水浴場コード"), kind: "code" }],
    legendNotes: [l3("EPA 浴場名冊 243 處（法定 154、非法定監測點 89；17 個郡，含湖泊與河口）", "EPA register of 243 bathing waters (154 identified, 89 non-identified; 17 counties, incl. lakes and estuaries)", "EPA 水浴場名簿243か所（指定154・指定外89、17県、湖沼・河口を含む）"),
                  l3("分級為 2025 年度，依 2022–2025 四季採樣（Bathing Water Quality Regulations 2008）；法定浴場的點是監測點，非法定的是海灘大致位置", "Classes are for 2025, based on the 2022–2025 seasons (Bathing Water Quality Regulations 2008); identified sites are monitoring points, non-identified are approximate beach locations", "区分は2025年度（2022–2025年の4シーズン、Bathing Water Quality Regulations 2008）。指定水浴場は監視地点、指定外は海浜の概略位置"),
                  l3("即時警示與逐次採樣結果未收（第 12 波）；最新狀況請看 beaches.ie", "Live alerts and individual sample results not included (wave 12); see beaches.ie for current status", "リアルタイム警報と個別の採水結果は未収録（第12波）。最新状況は beaches.ie")],
    popupNotes: [l3("分級反映前 4 季，不代表今天能否游泳；請看 beaches.ie", "Class reflects the previous four seasons, not today's conditions; check beaches.ie", "区分は過去4シーズンの評価で当日の可否ではない。beaches.ie を参照")],
    sourceOrg: "Environmental Protection Agency (EPA), Bathing Water Open Data (data from local authorities)", sourceUrl: "https://data.epa.ie/api-list/bathing-water-open-data/", license: CC_BY, fetchedAt: IE_W3B_FETCHED_AT,
    loading: l3("愛爾蘭浴場水質載入中", "Loading Ireland bathing waters", "アイルランドの水浴場を読み込み中"),
  },
  {
    key: "ieMarineSurveyStations", file: "ie_marine_survey_stations.pmtiles", sourceLayer: "ie_marine_survey_stations", geom: "point", layerId: "ie-marine-survey-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#38bdf8", tier: "S", count: 7548,
    catProp: "series", cats: SURVEY_SERIES_CATS,
    title: { props: ["cruise"], fallback: l3("漁業調查站位", "Fisheries survey station", "漁業調査地点") },
    fields: [{ prop: "series", label: l3("調查系列", "Survey series", "調査シリーズ"), map: Object.fromEntries(SURVEY_SERIES_CATS.map((c) => [c.id, c.label])) },
             { prop: "date", label: l3("採樣日", "Date", "採取日") }, { prop: "station", label: l3("站號／網次", "Station / haul", "地点・曳網番号"), kind: "code" },
             { prop: "stratum", label: l3("分層", "Stratum", "層") }, { prop: "description", label: l3("航次說明", "Survey description", "航海の説明") }],
    legendNotes: [l3("Marine Institute 漁業資源調查 7 個系列的歷史站位 7,548 點（1999–2016），不是現行站網", "7,548 historical stations from 7 Marine Institute fisheries survey series (1999–2016); not a current network", "Marine Institute の漁業資源調査7シリーズの過去の調査地点7,548点（1999–2016）。現行の観測網ではない"),
                  l3("站位延伸到愛爾蘭周邊的 ICES 調查海域，部分在愛爾蘭專屬經濟區外；只有位置，不含漁獲量", "Stations extend across ICES survey areas around Ireland, some outside the Irish EEZ; locations only, no catch data", "地点はアイルランド周辺の ICES 調査海域に及び、一部は EEZ 外。位置のみで漁獲量は含まない")],
    popupNotes: [l3("歷史調查站位（只有位置）", "Historical survey station (location only)", "過去の調査地点（位置のみ）")],
    sourceOrg: "Marine Institute, Fisheries survey stations (7 series)", sourceUrl: DGI("irish-groundfish-survey-stations"), license: CC_BY, fetchedAt: IE_W3B_FETCHED_AT,
    loading: l3("愛爾蘭漁業調查站位載入中", "Loading Ireland fisheries survey stations", "アイルランドの漁業調査地点を読み込み中"),
  },
  {
    key: "ieSeabedSurveyCoverage", file: "ie_seabed_survey_coverage.pmtiles", sourceLayer: "ie_seabed_survey_coverage", geom: "polygon",
    layerId: "ie-seabed-survey-coverage-fill", outlineId: "ie-seabed-survey-coverage-line",
    srcMinzoom: 4, srcMaxzoom: 11, minzoom: 4, color: "#38bdf8", count: 376,
    catProp: "programme", cats: SEABED_PROGRAMME_CATS,
    title: { props: ["survey_id", "project"], fallback: l3("海床測深調查", "Seabed survey", "海底測深調査") },
    fields: [{ prop: "project", label: l3("計畫", "Project", "プロジェクト") }, { prop: "year", label: l3("年度", "Year", "年度"), kind: "year" },
             { prop: "vessel", label: l3("船舶／載具", "Vessel / platform", "船舶・機材") }, { prop: "system", label: l3("測深系統", "Survey system", "測深システム") },
             { prop: "methods", label: l3("觀測項目", "Methods", "観測項目") }, { prop: "collector", label: l3("執行單位", "Collected by", "実施機関") },
             { prop: "place", label: l3("地點", "Location", "場所") }, { prop: "sea_area", label: l3("海域", "Sea area", "海域") },
             { prop: "start", label: l3("開始", "Start", "開始") }, { prop: "end", label: l3("結束", "End", "終了") },
             { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
             { prop: "bathy_res_m", label: l3("測深網格", "Bathymetry resolution", "測深グリッド"), kind: "num", unit: "m" },
             { prop: "survey_id", label: l3("航次代碼", "Survey ID", "航海コード"), kind: "code" }],
    legendNotes: [l3("GSI 與 Marine Institute 的海床測深航次足跡 376 個（1996–2026；INFOMAR 291、前身 INSS 22、其他 63）", "376 seabed survey footprints by GSI and the Marine Institute (1996–2026; INFOMAR 291, predecessor INSS 22, others 63)", "GSI と Marine Institute の海底測深調査範囲376（1996–2026。INFOMAR 291・前身 INSS 22・その他63）"),
                  l3("面是測過的範圍、不是測深值（水深看「海床地形」）；航次會重疊，部分延伸到英國水域", "Footprints show where was surveyed, not depths (see Bathymetry); surveys overlap and some extend into UK waters", "範囲は測深済みの区域で水深値ではない（水深は「海底地形」）。航海は重なり、一部は英国水域に及ぶ"),
                  l3("顯示用每面各自簡化約 20 m", "Each footprint simplified by about 20 m for display", "表示用に各範囲を約20m簡略化")],
    popupNotes: [],
    sourceOrg: "Geological Survey Ireland & Marine Institute, INFOMAR Seabed Survey Coverage", sourceUrl: DGI("infomar-seabed-survey-coverage"), license: CC_BY, fetchedAt: IE_W3B_FETCHED_AT,
    loading: l3("愛爾蘭海床調查範圍載入中", "Loading Ireland seabed survey coverage", "アイルランドの海底調査範囲を読み込み中"),
  },
  {
    // V-5：面（SAC／SPA／NHA／生物圈）＋代表點檔（另含只有點位的自然保留區、避難所、拉姆薩；repPointLayers 預設點）
    key: "ieProtectedMarineSites", file: "ie_protected_marine_sites.pmtiles", sourceLayer: "ie_protected_marine_sites", geom: "polygon",
    layerId: "ie-protected-marine-sites-fill", outlineId: "ie-protected-marine-sites-line",
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#38bdf8", count: 290,
    catProp: "category", cats: MARINE_SITE_CATS,
    title: { props: ["name"], fallback: l3("受保護海域", "Protected marine site", "海域の保護区") },
    fields: [{ prop: "category", label: l3("類型", "Designation", "指定種別"), map: Object.fromEntries(MARINE_SITE_CATS.map((c) => [c.id, c.label])) },
             { prop: "code", label: l3("站點代碼", "Site code", "サイトコード"), kind: "code" },
             { prop: "sea_ha", label: l3("海域部分面積", "Area outside land", "陸域外の面積"), kind: "num", unit: "ha", digits: 0 },
             { prop: "area_ha", label: l3("總面積", "Total area", "総面積"), kind: "num", unit: "ha", digits: 0 },
             { prop: "location", label: l3("位置", "Location", "位置") }, { prop: "ownership", label: l3("所有權", "Ownership", "所有") },
             { prop: "instrument", label: l3("設立依據", "Statutory instrument", "設立根拠") },
             { prop: "data_year", label: l3("資料年份", "Data year", "データ年"), kind: "year" }],
    legendNotes: [l3("國家海洋規劃架構（NMPF）受保護海域，只收有海域部分的站點：SAC 137、SPA 95、NHA 7、生物圈 3 面，自然保留區 20、避難所 6、拉姆薩 22 點", "National Marine Planning Framework protected sites, only those with a marine part: 137 SAC, 95 SPA, 7 NHA, 3 biosphere zones (areas); 20 nature reserves, 6 refuges, 22 Ramsar sites (points)", "国家海洋計画枠組み（NMPF）の保護区のうち海域部分があるもの：SAC 137・SPA 95・NHA 7・生物圏3（面）、自然保護区20・避難地6・ラムサール22（点）"),
                  l3("收錄規則（本站自訂）：面在陸地以外 ≥ 10 ha、點在海上或離岸 1 km 內；保護區範圍不裁切。陸域保護區見之後的自然保護圖層", "Inclusion rule (set by this site): areas with ≥ 10 ha outside land, points at sea or within 1 km of the coast; site boundaries are not clipped. Land-based sites come in a later nature-protection layer", "収録基準（本サイト設定）：陸域外が10ha以上の面、海上または海岸1km以内の点。範囲は切り抜かない。陸域の保護区は今後の自然保護レイヤーで"),
                  l3("面模式只畫 SAC、SPA、NHA、生物圈；自然保留區、避難所、拉姆薩只有點位，請切換點模式", "Area mode shows SAC, SPA, NHA and biosphere zones only; nature reserves, refuges and Ramsar sites are points only (use point mode)", "面表示は SAC・SPA・NHA・生物圏のみ。自然保護区・避難地・ラムサールは点のみ（点表示で確認）"),
                  l3("愛爾蘭法定海洋保護區（MPA）尚未立法（2026 起草中）", "Ireland has no statutory Marine Protected Areas yet (bill being drafted in 2026)", "アイルランドの法定海洋保護区（MPA）は未制定（2026年に法案起草中）")],
    popupNotes: [],
    sourceOrg: "Department of Housing, Local Government and Heritage, National Marine Planning Framework – Protected Marine Sites (data: NPWS, EPA, Dublin Bay Biosphere Partnership)", sourceUrl: DGI("protected-marine-sites1"), license: CC_BY, fetchedAt: IE_W3B_FETCHED_AT,
    loading: l3("愛爾蘭受保護海域載入中", "Loading Ireland protected marine sites", "アイルランドの海域保護区を読み込み中"),
  },
  {
    key: "ieOffshoreRenewables", file: "ie_offshore_renewables.pmtiles", sourceLayer: "ie_offshore_renewables", geom: "polygon",
    layerId: "ie-offshore-renewables-fill", outlineId: "ie-offshore-renewables-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#f59e0b", count: 30,
    catProp: "category", cats: OFFSHORE_CATS,
    title: { props: ["name"], fallback: l3("離岸再生能源海域", "Offshore renewable energy area", "洋上再生可能エネルギー海域") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: Object.fromEntries(OFFSHORE_CATS.map((c) => [c.id, c.label])) },
             { prop: "consent_id", label: l3("MAC 編號", "MAC reference", "MAC 番号"), kind: "code" }, { prop: "developer", label: l3("開發商", "Developer", "開発事業者") },
             { prop: "foundation", label: l3("基礎型式", "Foundation", "基礎形式"), map: FOUNDATION },
             { prop: "location", label: l3("位置", "Location", "位置") }, { prop: "sea_area", label: l3("海域", "Sea area", "海域") },
             { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
             { prop: "data_owner", label: l3("資料提供", "Data owner", "データ提供者") }, { prop: "data_year", label: l3("資料年份", "Data year", "データ年"), kind: "year" }],
    legendNotes: [l3("國家海洋規劃架構（NMPF）的離岸風場與試驗場 30 面：2022 第一批海域許可 8、前灘程序風場 19、AMETS 3", "30 offshore wind and test-site areas from the National Marine Planning Framework: 8 Maritime Area Consents (2022), 19 foreshore-process wind farms, 3 AMETS", "国家海洋計画枠組み（NMPF）の洋上風力・試験場30区域：海域利用同意8（2022）・フォアショア手続の風力19・AMETS 3"),
                  l3("資料是 2020–2022 狀態，不代表現況；同一風場的不同許可階段會重疊", "Reflects 2020–2022 status, not current; different consent stages of the same wind farm overlap", "2020–2022年時点の状態で現況ではない。同一風力の許可段階が重なる"),
                  l3("氣象浮標與試驗場標記 15 點未收（浮標即時資料在第 12 波）", "15 weather-buoy and test-site markers not included (live buoy data in wave 12)", "気象ブイ・試験場マーカー15点は未収録（ブイのリアルタイムは第12波）")],
    popupNotes: [l3("2020–2022 資料，非現況", "2020–2022 data, not current status", "2020–2022年のデータで現況ではない")],
    sourceOrg: "Department of Housing, Local Government and Heritage, National Marine Planning Framework – Offshore Renewable Energy", sourceUrl: DGI("marine-area-consent-wind2"), license: CC_BY, fetchedAt: IE_W3B_FETCHED_AT,
    loading: l3("愛爾蘭離岸再生能源海域載入中", "Loading Ireland offshore renewable energy areas", "アイルランドの洋上再生可能エネルギー海域を読み込み中"),
  },
  // ───────────── 第 5 波：觀光（國家公園、Wild Atlantic Way）、環境氣候（保護區、樹木、輻射站）、林業（步道）、災害（崩塌、氡氣） ─────────────
  {
    // V-3：大範圍面，預設面；代表點檔 `ie_national_parks_points.pmtiles`（repPointLayers）
    key: "ieNationalParks", file: "ie_national_parks.pmtiles", sourceLayer: "ie_national_parks", geom: "polygon", layerId: "ie-national-parks-fill", outlineId: "ie-national-parks-line",
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#4ade80", count: 6,
    title: { props: ["name"], fallback: l3("國家公園", "National park", "国立公園") },
    fields: [{ prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
             { prop: "version", label: l3("邊界版本", "Boundary version", "境界の版"), kind: "code" }, LA],
    legendNotes: [l3("NPWS 管理的 6 座國家公園：Killarney、Glenveagh、Connemara、Burren、Wild Nephin、Wicklow Mountains，合計 693 km²", "The 6 national parks managed by NPWS: Killarney, Glenveagh, Connemara, Burren, Wild Nephin and Wicklow Mountains (693 km² in total)", "NPWS が管理する国立公園6か所（Killarney・Glenveagh・Connemara・Burren・Wild Nephin・Wicklow Mountains、計693 km²）")],
    popupNotes: [],
    sourceOrg: "National Parks and Wildlife Service (NPWS), DHLGH — National Park Boundaries", sourceUrl: DGI("killarney-national-park-boundary-map"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭國家公園載入中", "Loading Ireland national parks", "アイルランドの国立公園を読み込み中"),
  },
  {
    key: "ieWildAtlanticWay", file: "ie_wild_atlantic_way.pmtiles", sourceLayer: "ie_wild_atlantic_way", geom: "line", layerId: "ie-wild-atlantic-way-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#f59e0b", count: 406,
    title: { props: [], fallback: l3("Wild Atlantic Way", "Wild Atlantic Way", "ワイルド・アトランティック・ウェイ") },
    fields: [{ prop: "length_km", label: l3("此段長度", "Segment length", "区間長"), kind: "num", unit: "km", digits: 2 }, LA],
    legendNotes: [l3("Fáilte Ireland 的西岸觀光路線 Wild Atlantic Way，Donegal 到 Cork 共 406 段、約 2,500 km（資料年 2020）", "Fáilte Ireland's Wild Atlantic Way touring route along the west coast, Donegal to Cork: 406 segments, about 2,500 km (data year 2020)", "Fáilte Ireland の西海岸観光ルート Wild Atlantic Way（Donegal〜Cork、406区間・約2,500 km、2020年データ）"),
                  l3("來源沒有路名與分段名稱；沿線 Discovery Points 未收", "The source has no road or section names; Discovery Points along the route are not included", "出典に道路名・区間名はない。沿線の Discovery Points は未収録")],
    popupNotes: [],
    sourceOrg: "Fáilte Ireland — Wild Atlantic Way Route, via National Marine Planning Framework (DHLGH)", sourceUrl: DGI("wild-atlantic-way-route1"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("Wild Atlantic Way 載入中", "Loading Wild Atlantic Way", "ワイルド・アトランティック・ウェイを読み込み中"),
  },
  {
    // V-3：保護區小而零散，預設點；代表點檔 `ie_protected_sites_points.pmtiles`
    key: "ieProtectedSites", file: "ie_protected_sites.pmtiles", sourceLayer: "ie_protected_sites", geom: "polygon", layerId: "ie-protected-sites-fill", outlineId: "ie-protected-sites-line",
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#38bdf8", count: 806,
    catProp: "designation", cats: PROTECTED_SITE_CATS,
    title: { props: ["name"], fallback: l3("指定保護區", "Designated site", "指定保護区") },
    fields: [{ prop: "designation", label: l3("類型", "Designation", "指定種別"), map: Object.fromEntries(PROTECTED_SITE_CATS.map((c) => [c.id, c.label])) },
             { prop: "site_code", label: l3("站點代碼", "Site code", "サイトコード"), kind: "code" },
             { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 0 },
             { prop: "version", label: l3("邊界版本", "Boundary version", "境界の版"), kind: "code" }, LA],
    legendNotes: [l3("NPWS 法定指定保護區：SAC 433、SPA 202、NHA 171（含海域部分）；同一地可同時是 SAC 與 SPA，兩面重疊", "NPWS statutory designated sites: 433 SAC, 202 SPA and 171 NHA (including marine parts); a site can be both SAC and SPA, so areas overlap", "NPWS の法定指定保護区：SAC 433・SPA 202・NHA 171（海域部分を含む）。SAC と SPA が重なる場所がある"),
                  l3("提議中的 pNHA（1,180 處）未收；海域部分與「受保護海域」圖層重疊", "Proposed NHAs (pNHA, 1,180 sites) not included; marine parts overlap the Protected Marine Sites layer", "提案中の pNHA（1,180か所）は未収録。海域部分は「海域の保護区」レイヤーと重なる")],
    popupNotes: [],
    sourceOrg: "National Parks and Wildlife Service (NPWS), DHLGH — SAC, SPA and NHA boundaries", sourceUrl: DGI("special-protection-areas"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭指定保護區載入中", "Loading Ireland designated sites", "アイルランドの指定保護区を読み込み中"),
  },
  {
    key: "ieNationalTrails", file: "ie_national_trails.pmtiles", sourceLayer: "ie_national_trails", geom: "line", layerId: "ie-national-trails-line",
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#4ade80", count: 1340,
    catProp: "trail_type", cats: TRAIL_CATS, otherColor: "#94a3b8", otherLabel: l3("其他、未分類（登山通道、騎馬等）", "Other / unspecified (mountain access, horse riding…)", "その他・未分類（登山アクセス・乗馬など）"),
    title: { props: ["name"], fallback: l3("步道", "Trail", "トレイル") },
    fields: [{ prop: "trail_type", label: l3("類型（原文）", "Type", "種別（原文）") },
             { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 1 },
             { prop: "registered", label: l3("已登錄", "Registered", "登録済み"), map: YES_NO }, LA],
    legendNotes: [l3("Sport Ireland 國家步道登錄（National Trails Register）1,340 條、約 18,500 km：步行、長距離標示步道、綠道、單車、划槳等", "Sport Ireland National Trails Register: 1,340 trails, about 18,500 km — walking, long-distance waymarked ways, greenways, cycling, paddling and more", "Sport Ireland の全国トレイル登録1,340本・約18,500 km（徒歩・長距離ウェイマーク・グリーンウェイ・自転車・パドリングなど）"),
                  l3("北愛 3 條已剔除；Coillte 林道與遊憩步道未收", "3 Northern Ireland trails removed; Coillte forest roads and recreation trails not included", "北アイルランドの3本は除外。Coillte の林道・レクリエーション路は未収録")],
    popupNotes: [],
    sourceOrg: "Sport Ireland — National Trails Register", sourceUrl: DGI("national-trails-register"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭國家步道載入中", "Loading Ireland national trails", "アイルランドの全国トレイルを読み込み中"),
  },
  {
    // 6.8 萬株：拉遠熱區（V-1），z12 起點
    key: "ieStreetTrees", file: "ie_street_trees.pmtiles", sourceLayer: "ie_street_trees", geom: "point", layerId: "ie-street-trees-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, heat: { intensity: 1 }, color: "#4ade80", tier: "S", count: 67962,
    catProp: "council", cats: TREE_COUNCIL_CATS,
    title: { props: ["common_name", "species"], fallback: l3("樹木", "Tree", "樹木") },
    fields: [{ prop: "species", label: l3("學名", "Species", "学名") }, { prop: "common_name", label: l3("俗名", "Common name", "一般名") },
             { prop: "height", label: l3("樹高", "Height", "樹高") }, { prop: "age", label: l3("樹齡階段", "Age class", "樹齢区分") },
             { prop: "condition", label: l3("狀況", "Condition", "状態") }, { prop: "trunk", label: l3("幹徑", "Trunk / stem diameter", "幹径") },
             { prop: "location", label: l3("位置", "Location", "位置") },
             { prop: "council", label: l3("調查議會", "Surveying council", "調査した議会"), map: Object.fromEntries(TREE_COUNCIL_CATS.map((c) => [c.id, c.label])) },
             { prop: "tree_id", label: l3("樹木編號", "Tree ID", "樹木番号"), kind: "code" }],
    legendNotes: [l3("只有都柏林三個議會：Fingal 35,978、Dún Laoghaire-Rathdown 16,235（2019）、Dublin City 15,749 株；其餘 28 個地方政府（含 South Dublin）未涵蓋", "Dublin's three councils only: Fingal 35,978, Dún Laoghaire-Rathdown 16,235 (2019) and Dublin City 15,749 trees; the other 28 local authorities (incl. South Dublin) are not covered", "ダブリンの3議会のみ（Fingal 35,978・Dún Laoghaire-Rathdown 16,235〔2019〕・Dublin City 15,749本）。South Dublin を含む他28自治体は未収録"),
                  l3("各議會調查範圍與欄位不同，不是全市普查；DLR 樹高為實測值（推定單位公尺、未經官方確認）。拉遠為熱區，放大到 z12 才出現點", "Survey scope and fields differ by council; not a complete census. DLR heights are measured values (assumed metres, unconfirmed). Heatmap when zoomed out; points from z12", "調査範囲と項目は議会ごとに異なり全数調査ではない。DLR の樹高は実測値（単位はメートルと推定、未確認）。縮小時はヒートマップ、z12 から点")],
    popupNotes: [],
    sourceOrg: "Fingal County Council; Dún Laoghaire-Rathdown County Council; Dublin City Council — tree surveys", sourceUrl: DGI("trees-fcc2"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("都柏林樹木載入中", "Loading Dublin trees", "ダブリンの樹木を読み込み中"),
  },
  {
    key: "ieRadiationStations", file: "ie_radiation_stations.pmtiles", sourceLayer: "ie_radiation_stations", geom: "point", layerId: "ie-radiation-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#4ade80", tier: "M", count: 41,
    catProp: "category", cats: RADIATION_CATS,
    title: { props: ["name"], fallback: l3("輻射監測站", "Radiation monitoring station", "放射線モニタリング局") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: Object.fromEntries(RADIATION_CATS.map((c) => [c.id, c.label])) },
             { prop: "media", label: l3("採樣項目", "Sampled media", "採取対象") },
             { prop: "gamma", label: l3("伽瑪劑量率", "Gamma dose rate", "ガンマ線量率"), map: { yes: l3("有", "Yes", "あり"), no: l3("無", "No", "なし") } }, LA],
    legendNotes: [l3("EPA 環境輻射監測站 41 站：陸地 26（15 站即時上線）、海域 15（含愛爾蘭海 6 個採樣點）", "41 EPA environmental radiation monitoring locations: 26 on land (15 live) and 15 marine (incl. 6 Irish Sea sampling points)", "EPA 環境放射線モニタリング地点41か所：陸上26（うち15局はリアルタイム）・海域15（アイリッシュ海の採取点6を含む）"),
                  l3("只有站點與採樣項目，沒有量測值；即時伽瑪劑量率請看 EPA 網站", "Locations and sampled media only, no measurements; for live gamma dose rates see the EPA website", "地点と採取対象のみで測定値はない。リアルタイムのガンマ線量率は EPA サイトを参照")],
    popupNotes: [],
    sourceOrg: "Environmental Protection Agency (EPA), Radiation Monitoring Locations", sourceUrl: DGI("radiation-monitoring-locations"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭輻射監測站載入中", "Loading Ireland radiation monitoring stations", "アイルランドの放射線モニタリング局を読み込み中"),
  },
  {
    key: "ieLandslideEvents", file: "ie_landslide_events.pmtiles", sourceLayer: "ie_landslide_events", geom: "point", layerId: "ie-landslide-events-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f59e0b", tier: "S", count: 2779,
    catProp: "material", cats: LANDSLIDE_MATERIAL_CATS,
    title: { props: ["name", "event_id"], fallback: l3("崩塌事件", "Landslide event", "地すべり事例") },
    fields: [{ prop: "material_raw", label: l3("材料（原文）", "Material", "物質（原文）") }, { prop: "mechanism", label: l3("型態", "Mechanism", "形態") },
             { prop: "trigger", label: l3("誘因", "Trigger", "誘因") }, { prop: "impact", label: l3("影響", "Impact", "影響") },
             { prop: "event_date", label: l3("事件日期", "Event date", "発生日") }, { prop: "date_accuracy", label: l3("日期精度", "Date accuracy", "日付の精度") },
             { prop: "county", label: l3("郡", "County", "県") }, { prop: "event_id", label: l3("事件編號", "Event ID", "事例番号"), kind: "code" }, LA],
    legendNotes: [l3("GSI 國家崩塌資料庫事件點 2,779 筆（剔除北愛 32）；有事件日期的只有 226 筆，多數為判釋或文獻紀錄", "2,779 events from the GSI National Landslide Database (32 in Northern Ireland removed); only 226 have an event date, most are mapped or literature records", "GSI 全国地すべりデータベースの事例2,779件（北アイルランド32件を除外）。発生日があるのは226件のみで、多くは判読・文献記録"),
                  l3("材料五類是依原值合併（推定分組，GSI 未附代碼表）", "The five material groups merge the source values (inferred grouping; GSI publishes no code list)", "物質5区分は原値をまとめた推定区分（GSI のコード表なし）")],
    popupNotes: [],
    sourceOrg: "Contains Irish Public Sector Data (Geological Survey Ireland) licensed under CC BY 4.0 — Landslide Locations", sourceUrl: DGI("landslide-locations-and-extents-ireland-roini-itm"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭崩塌事件載入中", "Loading Ireland landslide events", "アイルランドの地すべり事例を読み込み中"),
  },
  {
    // V-3：崩塌範圍小而零散，預設點；面 z8 起
    key: "ieLandslideExtents", file: "ie_landslide_extents.pmtiles", sourceLayer: "ie_landslide_extents", geom: "polygon", layerId: "ie-landslide-extents-fill", outlineId: "ie-landslide-extents-line",
    srcMinzoom: 8, srcMaxzoom: 14, minzoom: 8, color: "#f59e0b", count: 2274,
    catProp: "material", cats: LANDSLIDE_MATERIAL_CATS,
    title: { props: ["type", "ref"], fallback: l3("崩塌範圍", "Landslide extent", "地すべり範囲") },
    fields: [{ prop: "type", label: l3("型態", "Type", "形態") }, { prop: "material_raw", label: l3("材料（原文）", "Material", "物質（原文）") },
             { prop: "year", label: l3("判釋年", "Year", "判読年") },
             { prop: "length_m", label: l3("長", "Length", "長さ"), kind: "num", unit: "m" }, { prop: "width_m", label: l3("寬", "Width", "幅"), kind: "num", unit: "m" },
             { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" },
             { prop: "mapping_source", label: l3("判釋來源", "Mapping source", "判読の出典") }, { prop: "county", label: l3("郡", "County", "県") },
             { prop: "ref", label: l3("參考編號", "Reference", "参照番号"), kind: "code" }, LA],
    legendNotes: [l3("GSI 判釋的崩塌範圍 2,274 面（剔除北愛 1）；與「崩塌事件」點沒有共用編號，無法一對一配對", "2,274 landslide extents mapped by GSI (1 in Northern Ireland removed); they share no ID with the landslide event points and cannot be matched one-to-one", "GSI が判読した地すべり範囲2,274面（北アイルランド1面を除外）。「地すべり事例」の点と共通の番号がなく1対1で対応しない"),
                  l3("多數範圍只有數千平方公尺，預設畫代表點；面在 z8 起出現", "Most extents are a few thousand m², so representative points are shown by default; polygons from z8", "多くは数千 m² のため既定は代表点。面は z8 から")],
    popupNotes: [],
    sourceOrg: "Contains Irish Public Sector Data (Geological Survey Ireland) licensed under CC BY 4.0 — Landslide Extents", sourceUrl: DGI("landslide-locations-and-extents-ireland-roini-itm"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭崩塌範圍載入中", "Loading Ireland landslide extents", "アイルランドの地すべり範囲を読み込み中"),
  },
  {
    // 模型網格鋪滿國土（V-3 網格豁免，不做點／面切換）
    key: "ieRadonRisk", file: "ie_radon_risk.pmtiles", sourceLayer: "ie_radon_risk", geom: "polygon", layerId: "ie-radon-risk-fill", outlineId: "ie-radon-risk-line",
    srcMinzoom: 4, srcMaxzoom: 11, minzoom: 4, color: "#ef4444", count: 51861,
    catProp: "risk", cats: RADON_CATS,
    title: { props: [], fallback: l3("氡氣風險", "Radon risk", "ラドンリスク") },
    fields: [{ prop: "risk", label: l3("預測", "Prediction", "予測"), map: Object.fromEntries(RADON_CATS.map((c) => [c.id, c.label])) }],
    legendNotes: [l3("EPA 氡氣風險圖：依室內量測與地質（岩盤、表層地質、土壤透水、含水層）以模型預測各地住宅氡氣偏高的比例；紅色稱 High Radon Area", "EPA radon risk map: model prediction of the share of homes likely to have high radon, from indoor measurements and geology (bedrock, Quaternary geology, soil permeability, aquifers); red areas are High Radon Areas", "EPA ラドンリスク図：室内測定と地質（岩盤・表層地質・土壌透水性・帯水層）からモデルで予測した、ラドン濃度が高い住宅の割合。赤は High Radon Area"),
                  l3("「偏高」門檻資料頁未定義（推定為住宅參考水準 200 Bq/m³，未經官方確認）；是區域機率，不代表單一住宅", "The 'high' threshold is not defined on the data page (assumed to be the 200 Bq/m³ home reference level, unconfirmed); an area-level probability, not a verdict on any single home", "「高い」の基準はデータページで未定義（住宅参考レベル200 Bq/m³ と推定、未確認）。地域の確率で個々の住宅を示すものではない")],
    popupNotes: [l3("區域預測，單一住宅請實測", "Area prediction; test individual homes", "地域予測。個々の住宅は測定が必要")],
    sourceOrg: "Environmental Protection Agency (EPA), Radon Risk Map of Ireland", sourceUrl: DGI("radon-risk-map-of-ireland"), license: CC_BY, fetchedAt: IE_W5_FETCHED_AT,
    loading: l3("愛爾蘭氡氣風險圖載入中", "Loading Ireland radon risk map", "アイルランドのラドンリスク図を読み込み中"),
  },
];

export const IE_SPEC_BY_KEY: Readonly<Record<IeDataKey, IeLayerSpec>> = Object.fromEntries(IE_DATA_SPECS.map((s) => [s.key, s])) as Record<IeDataKey, IeLayerSpec>;

/** 南韓規格驅動 hook／篩選共用同一套畫法：IE 規格只差 key 型別與 popup 欄位種類（hook 不讀 fields）。 */
export const asKrSpec = (spec: IeLayerSpec): KrLayerSpec => spec as unknown as KrLayerSpec;

export const IE_BATHY_STOPS: readonly { depth: number; color: string }[] = [
  { depth: 0, color: "#cdeef8" }, { depth: -20, color: "#97d7ef" }, { depth: -50, color: "#63bde3" }, { depth: -100, color: "#3d9bd0" }, { depth: -200, color: "#2c7ab8" },
  { depth: -500, color: "#215f9f" }, { depth: -1000, color: "#1a4b86" }, { depth: -2000, color: "#143a6c" }, { depth: -3000, color: "#102e57" }, { depth: -5000, color: "#0a2040" },
];

/** 海床地形（raster；hook 在 useIeBathymetryLayer）的署名與色階說明，圖例共用。 */
export const IE_BATHYMETRY = {
  file: "ie_bathymetry.pmtiles",
  sourceOrg: "Geological Survey Ireland & Marine Institute, INFOMAR",
  sourceUrl: "https://gsi.geodata.gov.ie/imagehost/rest/services/Marine/IE_GSI_MI_Bathymetry_25m_IE_Waters_WGS84_LAT_GRID/ImageServer",
  license: CC_BY,
  /** 色階斷點：與 analytics `pipelines/base_map/ie/bathymetry/07_export.py` STOPS 一致（改那邊要同步），圖例逐格列出 */
  stops: IE_BATHY_STOPS,
  notes: [
    l3("INFOMAR 測深網格重新取樣到約 300 m（0.003°）著色，疊山體陰影；z4–10", "INFOMAR bathymetry resampled to about 300 m (0.003°), colour ramp with hillshade; z4–10", "INFOMAR 測深グリッドを約300m（0.003°）に再サンプリングし段彩＋陰影；z4–10"),
    l3("只涵蓋愛爾蘭指定水域；陸地與英國水域為空白（未涵蓋）", "Irish designated waters only; land and UK waters are blank (not covered)", "アイルランド指定水域のみ。陸地と英国水域は空白（未収録）"),
  ] as readonly L3[],
};
