/**
 * 愛爾蘭第 1 波起規格驅動資料層（第 1 波 6 層、第 2 波 2 層、第 3a 波 7 層、第 3b 波 5 層、第 4 波 6 層、第 5 波 9 層、第 6 波 6 層、第 7a 波 3 層、第 8 波 5 層）SSOT：hook paint、圖例、popup 三邊共用。
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
export const IE_W7A_FETCHED_AT = "2026-11-08";
/** 來源頁未標示授權：依 2026-10-09 政策照常上線，圖例標「授權待確認」。 */
const LICENSE_PENDING = "未標示（授權待確認）";
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
// 第 7a 波：教育類別
const SCHOOL_CATS: readonly KrCat[] = [
  { id: "primary", values: ["primary"], color: "#38bdf8", label: l3("國小（Primary）", "Primary school", "小学校（Primary）") },
  { id: "post_primary", values: ["post_primary"], color: "#a78bfa", label: l3("中學（Post-primary）", "Post-primary school", "中等学校（Post-primary）") },
  { id: "special", values: ["special"], color: "#f472b6", label: l3("特殊學校", "Special school", "特別支援学校") },
  { id: "higher", values: ["higher"], color: "#f59e0b", label: l3("大學與校區（OSM university）", "University & campus (OSM university)", "大学・キャンパス（OSM university）") },
  { id: "college", values: ["college"], color: "#facc15", label: l3("學院、繼續教育與職訓（OSM college）", "College, further education & training (OSM college)", "カレッジ・継続教育・職業訓練（OSM college）") },
];
const CHILDCARE_CATS: readonly KrCat[] = [
  { id: "private", values: ["private"], color: "#2dd4bf", label: l3("私人經營", "Private", "民間") },
  { id: "community", values: ["community"], color: "#f59e0b", label: l3("社區（非營利）", "Community (not-for-profit)", "コミュニティ（非営利）") },
];
const YES_ONLY: Record<string, L3> = { yes: l3("是", "Yes", "はい"), no: l3("否", "No", "いいえ") };
const SCHEME: Record<string, L3> = { yes: l3("參加", "Participating", "参加"), no: l3("未參加", "Not participating", "不参加") };
const FOUNDATION: Record<string, L3> = { "Fixed-Bottom": l3("固定式", "Fixed-bottom", "着床式"), Floating: l3("浮動式", "Floating", "浮体式") };

// ───────────── 第 8 波：文化遺產與生活據點 ─────────────
export const IE_W8_FETCHED_AT = "2026-11-08";
/** SMR 依原類別前綴歸 7 組（本站分組）＋NIAH＋開放參觀古蹟。 */
const HERITAGE_CATS: readonly KrCat[] = [
  { id: "smr_ringfort", values: ["smr_ringfort"], color: "#4ade80", label: l3("環形堡與圍場（SMR）", "Ringforts & enclosures (SMR)", "環状砦・囲い地（SMR）") },
  { id: "smr_prehistoric", values: ["smr_prehistoric"], color: "#a78bfa", label: l3("史前墓葬、巨石與燒石堆（SMR）", "Prehistoric burials, megaliths & fulachtaí fia (SMR)", "先史時代の墓・巨石・焼石遺構（SMR）") },
  { id: "smr_ecclesiastical", values: ["smr_ecclesiastical"], color: "#f472b6", label: l3("教會遺址、十字碑與石刻（SMR）", "Ecclesiastical sites, crosses & slabs (SMR)", "教会遺跡・十字架・石板（SMR）") },
  { id: "smr_castle", values: ["smr_castle"], color: "#ef4444", label: l3("城堡與防禦工事（SMR）", "Castles & fortifications (SMR)", "城・防御施設（SMR）") },
  { id: "smr_settlement", values: ["smr_settlement"], color: "#f59e0b", label: l3("聚落、房屋與地窖（SMR）", "Settlements, houses & souterrains (SMR)", "集落・住居・地下室（SMR）") },
  { id: "smr_economy", values: ["smr_economy"], color: "#2dd4bf", label: l3("道路、產業與地景（SMR）", "Roads, industry & landscape (SMR)", "道路・産業・景観（SMR）") },
  { id: "smr_other", values: ["smr_other"], color: "#94a3b8", label: l3("其他考古遺址（SMR）", "Other monuments (SMR)", "その他の遺跡（SMR）") },
  { id: "niah", values: ["niah"], color: "#38bdf8", label: l3("建築遺產（NIAH，1700 年後）", "Architectural heritage (NIAH, post-1700)", "建築遺産（NIAH、1700年以降）") },
  { id: "visit", values: ["visit"], color: "#facc15", label: l3("開放參觀的國家古蹟", "National monuments to visit", "公開されている国指定記念物") },
];
const NIAH_RATING: Record<string, L3> = {
  International: l3("國際級", "International", "国際的"), National: l3("國家級", "National", "国家的"), Regional: l3("區域級", "Regional", "地域的"),
  Local: l3("地方級", "Local", "地方的"), "Record Only": l3("僅登錄", "Record only", "記録のみ"),
};
const MUSEUM_CATS: readonly KrCat[] = [
  { id: "lamn", values: ["lamn"], color: "#facc15", label: l3("地方政府博物館（LAMN）", "Local authority museum (LAMN)", "地方自治体の博物館（LAMN）") },
  { id: "museum", values: ["museum"], color: "#38bdf8", label: l3("博物館", "Museum", "博物館") },
  { id: "heritage_centre", values: ["heritage_centre"], color: "#f59e0b", label: l3("文化遺產中心、遊客中心", "Heritage & visitor centre", "ヘリテージ／ビジターセンター") },
  { id: "historic_site", values: ["historic_site"], color: "#a78bfa", label: l3("歷史建築、宅邸與園林", "Historic building, house & garden", "歴史的建造物・邸宅・庭園") },
  { id: "gallery", values: ["gallery"], color: "#f472b6", label: l3("美術館、藝廊", "Gallery", "美術館・ギャラリー") },
  { id: "archive_library", values: ["archive_library"], color: "#2dd4bf", label: l3("檔案館、地方文史室", "Archive & local studies", "アーカイブ・郷土資料室") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他（自然、科學、體驗）", "Other (nature, science, attractions)", "その他（自然・科学・体験）") },
];
const ARTS_CATS: readonly KrCat[] = [
  { id: "theatre", values: ["theatre"], color: "#f472b6", label: l3("劇場", "Theatre", "劇場") },
  { id: "arts_centre", values: ["arts_centre"], color: "#f59e0b", label: l3("藝術中心、文化中心", "Arts & cultural centre", "アートセンター・文化センター") },
  { id: "visual", values: ["visual"], color: "#38bdf8", label: l3("視覺藝術、展覽空間", "Visual arts & exhibition space", "視覚芸術・展示スペース") },
  { id: "music", values: ["music"], color: "#a78bfa", label: l3("音樂廳、演出場地", "Concert & music venue", "コンサート・音楽会場") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他", "Other", "その他") },
];
const ARTS_COUNCIL: Record<string, L3> = {
  dcc: l3("Dublin City", "Dublin City", "Dublin City"), dlr: l3("Dún Laoghaire-Rathdown", "Dún Laoghaire-Rathdown", "Dún Laoghaire-Rathdown"),
  fingal: l3("Fingal", "Fingal", "Fingal"), sdcc: l3("South Dublin", "South Dublin", "South Dublin"),
  galway_city: l3("Galway City", "Galway City", "Galway City"), roscommon: l3("Roscommon", "Roscommon", "Roscommon"),
};
const PUBLIC_FACILITY_CATS: readonly KrCat[] = [
  { id: "library", values: ["library"], color: "#38bdf8", label: l3("圖書館", "Library", "図書館") },
  { id: "community_centre", values: ["community_centre"], color: "#f59e0b", label: l3("社區中心", "Community centre", "コミュニティセンター") },
  { id: "toilet", values: ["toilet"], color: "#2dd4bf", label: l3("公廁", "Public toilet", "公衆トイレ") },
];
const RELIGION_CATS: readonly KrCat[] = [
  { id: "church", values: ["church"], color: "#a78bfa", label: l3("教堂、禮拜堂（NIAH）", "Church / chapel (NIAH)", "教会・礼拝堂（NIAH）") },
  { id: "cathedral", values: ["cathedral"], color: "#f472b6", label: l3("主教座堂（NIAH）", "Cathedral (NIAH)", "大聖堂（NIAH）") },
  { id: "other_worship", values: ["other_worship"], color: "#f59e0b", label: l3("會堂、猶太會堂、小祈禱所（NIAH）", "Meeting house, synagogue, oratory (NIAH)", "集会所・シナゴーグ・祈祷所（NIAH）") },
  { id: "holy_well", values: ["holy_well"], color: "#38bdf8", label: l3("聖井（SMR）", "Holy well (SMR)", "聖なる泉（SMR）") },
];
const DENOMINATION: Record<string, L3> = {
  catholic: l3("天主教", "Catholic", "カトリック"), church_of_ireland: l3("愛爾蘭聖公會", "Church of Ireland", "アイルランド聖公会"),
  presbyterian: l3("長老會", "Presbyterian", "長老派"), methodist: l3("循道會", "Methodist", "メソジスト"), quaker: l3("貴格會", "Quaker", "クエーカー"),
  other: l3("其他教派", "Other", "その他の宗派"),
};

// ───────────── 第 6 波：能源 ─────────────
export const IE_W6_FETCHED_AT = "2026-11-08";
const OSM_ATTR_IE = "© OpenStreetMap contributors (ODbL 1.0)";
const OSM_NOTE = l3("來源 OpenStreetMap（官方無開放 GIS），完整度依志工貢獻；2026-11-05 Geofabrik 快照", "Source: OpenStreetMap (no open official GIS); completeness depends on contributors; Geofabrik snapshot 2026-11-05", "出典 OpenStreetMap（公式の公開 GIS なし）。網羅性はボランティア次第。Geofabrik 2026-11-05 時点");
const PLANT_CATS: readonly KrCat[] = [
  { id: "tailte_major", values: ["tailte_major"], color: "#ef4444", label: l3("主要電廠（Tailte 250k）", "Major power station (Tailte 250k)", "主要発電所（Tailte 250k）") },
  { id: "prtr_power", values: ["prtr_power"], color: "#f59e0b", label: l3("其他發電廠（PRTR 燃燒設施）", "Other power plant (PRTR combustion)", "その他の発電所（PRTR 燃焼施設）") },
  { id: "prtr_datacentre", values: ["prtr_datacentre"], color: "#a78bfa", label: l3("資料中心自備燃燒機組（PRTR）", "Data-centre on-site combustion units (PRTR)", "データセンターの自家燃焼設備（PRTR）") },
  { id: "prtr_refinery_gas", values: ["prtr_refinery_gas"], color: "#f472b6", label: l3("煉油廠、天然氣處理廠（PRTR）", "Refinery / gas terminal (PRTR)", "製油所・ガス処理施設（PRTR）") },
  { id: "prtr_industrial", values: ["prtr_industrial"], color: "#2dd4bf", label: l3("其他工業鍋爐（PRTR）", "Other industrial boilers (PRTR)", "その他の産業用ボイラー（PRTR）") },
];
/** 電壓分級（EirGrid 輸電 400／220／110 kV、ESB 配電 38 kV 以下；275 kV 只在北愛與跨境線）：線與變電站共用 */
const VOLTAGE_CATS: readonly KrCat[] = [
  { id: "kv400", values: ["kv400"], color: "#ef4444", label: l3("400 kV", "400 kV", "400 kV") },
  { id: "kv220_275", values: ["kv220_275"], color: "#f59e0b", label: l3("220 kV（含跨境 275 kV）", "220 kV (incl. cross-border 275 kV)", "220 kV（越境の 275 kV を含む）") },
  { id: "kv110", values: ["kv110"], color: "#facc15", label: l3("110 kV", "110 kV", "110 kV") },
  { id: "kv38", values: ["kv38"], color: "#38bdf8", label: l3("38 kV（配電）", "38 kV (distribution)", "38 kV（配電）") },
  { id: "lt38", values: ["lt38"], color: "#a78bfa", label: l3("38 kV 以下（10／20 kV 配電）", "Below 38 kV (10/20 kV distribution)", "38 kV 未満（10／20 kV 配電）") },
  { id: "unknown", values: ["unknown"], color: "#94a3b8", label: l3("電壓未標", "Voltage not tagged", "電圧未記載") },
];
const WIND_SIZE_CATS: readonly KrCat[] = [
  { id: "lt5", values: ["lt5"], color: "#38bdf8", label: l3("< 5 MW", "< 5 MW", "5 MW 未満") },
  { id: "5_20", values: ["5_20"], color: "#4ade80", label: l3("5–20 MW", "5–20 MW", "5–20 MW") },
  { id: "20_50", values: ["20_50"], color: "#facc15", label: l3("20–50 MW", "20–50 MW", "20–50 MW") },
  { id: "ge50", values: ["ge50"], color: "#f59e0b", label: l3("≥ 50 MW", "≥ 50 MW", "50 MW 以上") },
];
const EV_POWER_CATS: readonly KrCat[] = [
  { id: "hpc", values: ["hpc"], color: "#f472b6", label: l3("高功率（≥150 kW）", "High power (≥150 kW)", "高出力（150 kW 以上）") },
  { id: "fast", values: ["fast"], color: "#a78bfa", label: l3("快充（43–149 kW）", "Fast (43–149 kW)", "急速（43–149 kW）") },
  { id: "ac", values: ["ac"], color: "#4ade80", label: l3("交流慢充（≤22 kW）", "AC (≤22 kW)", "普通充電（22 kW 以下）") },
];
const FUEL_BRAND_CATS: readonly KrCat[] = [
  { id: "circle_k", values: ["circle_k"], color: "#ef4444", label: l3("Circle K", "Circle K", "Circle K") },
  { id: "applegreen", values: ["applegreen"], color: "#4ade80", label: l3("Applegreen", "Applegreen", "Applegreen") },
  { id: "top", values: ["top"], color: "#38bdf8", label: l3("Top Oil", "Top Oil", "Top Oil") },
  { id: "texaco", values: ["texaco"], color: "#f59e0b", label: l3("Texaco", "Texaco", "Texaco") },
  { id: "maxol", values: ["maxol"], color: "#a78bfa", label: l3("Maxol", "Maxol", "Maxol") },
  { id: "inver", values: ["inver"], color: "#2dd4bf", label: l3("Inver", "Inver", "Inver") },
  { id: "emo", values: ["emo"], color: "#facc15", label: l3("Emo", "Emo", "Emo") },
  { id: "other_brand", values: ["other_brand"], color: "#f472b6", label: l3("其他品牌（Certa、Amber、Esso…）", "Other brands (Certa, Amber, Esso…)", "その他のブランド（Certa・Amber・Esso…）") },
  { id: "unbranded", values: ["unbranded"], color: "#94a3b8", label: l3("未標品牌", "Brand not tagged", "ブランド未記載") },
];
const catMap = (cats: readonly KrCat[]) => Object.fromEntries(cats.map((c) => [c.id, c.label]));
const VOLTAGE_FIELD: IeField = { prop: "voltage_class", label: l3("電壓等級", "Voltage class", "電圧区分"), map: catMap(VOLTAGE_CATS) };
const OSM_ID_FIELD: IeField = { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" };

// ───────────── 第 7b 波：醫療照護、消防警政、司法 ─────────────
export const IE_W7B_FETCHED_AT = "2026-11-08";
const NOMINATIM_ORG = "© OpenStreetMap contributors (ODbL 1.0), geocoded with OSM Nominatim";
const GEOCODE_NOTE = l3("座標由 OpenStreetMap Nominatim 依地址推定，精度不一（© OpenStreetMap contributors）", "Coordinates estimated from addresses with OpenStreetMap Nominatim; precision varies (© OpenStreetMap contributors)", "座標は OpenStreetMap Nominatim で住所から推定したもので精度にばらつきがある（© OpenStreetMap contributors）");
const GEOCODE_POPUP = l3("位置為地址推估", "Location estimated from address", "位置は住所からの推定");
/** 地理編碼精度（由 Nominatim 回應判定，不由查詢層級判定）；官方座標另列一類。顏色由準到粗：藍、綠、青、黃、橙。 */
const PRECISION_CATS: readonly KrCat[] = [
  { id: "official", values: ["official"], color: "#38bdf8", label: l3("官方座標（地方議會）", "Official coordinates (councils)", "公式座標（地方議会）") },
  { id: "facility", values: ["facility"], color: "#4ade80", label: l3("推估：命中 OSM 同名設施", "Estimated: matched OSM facility", "推定：OSM の同名施設に一致") },
  { id: "address", values: ["address"], color: "#2dd4bf", label: l3("推估：門牌、建物", "Estimated: house number / building", "推定：番地・建物") },
  { id: "street", values: ["street"], color: "#facc15", label: l3("推估：街道（路段代表點）", "Estimated: street (road midpoint)", "推定：通り（区間の代表点）") },
  { id: "town", values: ["town"], color: "#f59e0b", label: l3("推估：城鎮、聚落中心", "Estimated: town / village centre", "推定：町・集落の中心") },
];
const CARE_PRECISION_CATS = PRECISION_CATS.filter((c) => c.id !== "official");
const PRECISION_FIELD: IeField = { prop: "geocode_precision", label: l3("定位精度", "Location precision", "位置の精度"), map: catMap(PRECISION_CATS) };
const HEALTH_KIND_CATS: readonly KrCat[] = [
  { id: "hospital", values: ["hospital"], color: "#e53935", label: l3("醫院", "Hospital", "病院") },
  { id: "clinic", values: ["clinic"], color: "#42a5f5", label: l3("診所、醫療中心", "Clinic / health centre", "診療所・医療センター") },
  { id: "doctors", values: ["doctors"], color: "#a78bfa", label: l3("家庭醫師（GP）", "GP / doctors", "かかりつけ医（GP）") },
  { id: "dentist", values: ["dentist"], color: "#f59e0b", label: l3("牙醫", "Dentist", "歯科") },
  { id: "pharmacy", values: ["pharmacy"], color: "#66bb6a", label: l3("藥局", "Pharmacy", "薬局") },
];
const FIRE_SOURCE_CATS: readonly KrCat[] = [
  { id: "official", values: ["official"], color: "#e53935", label: l3("地方議會官方點位", "Council official locations", "地方議会の公式位置") },
  { id: "osm", values: ["osm"], color: "#ff7043", label: l3("OSM 補缺", "OpenStreetMap (gap-fill)", "OSM で補完") },
];
const FIRE_SOURCE_ORG: Record<string, L3> = {
  dfb: l3("Dublin Fire Brigade（Dublin City Council）", "Dublin Fire Brigade (Dublin City Council)", "Dublin Fire Brigade（Dublin City Council）"),
  fingal: l3("Fingal County Council", "Fingal County Council", "Fingal County Council"),
  dlr: l3("Dún Laoghaire-Rathdown County Council", "Dún Laoghaire-Rathdown County Council", "Dún Laoghaire-Rathdown County Council"),
  cork_city: l3("Cork City Council", "Cork City Council", "Cork City Council"),
  kildare: l3("Kildare County Council", "Kildare County Council", "Kildare County Council"),
  wicklow: l3("Wicklow County Council", "Wicklow County Council", "Wicklow County Council"),
  roscommon: l3("Roscommon County Council", "Roscommon County Council", "Roscommon County Council"),
  osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap"),
};
const COURT_REGION_CATS: readonly KrCat[] = [
  { id: "dublin", values: ["dublin"], color: "#a78bfa", label: l3("Dublin 區", "Dublin region", "Dublin 地域") },
  { id: "eastern", values: ["eastern"], color: "#38bdf8", label: l3("東部區", "Eastern region", "東部地域") },
  { id: "north_midlands", values: ["north_midlands"], color: "#4ade80", label: l3("中北部區", "North Midlands region", "中北部地域") },
  { id: "southern", values: ["southern"], color: "#f59e0b", label: l3("南部區", "Southern region", "南部地域") },
  { id: "western", values: ["western"], color: "#f472b6", label: l3("西部區", "Western region", "西部地域") },
];

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
  // ───────────── 第 6 波：能源 ─────────────
  {
    key: "iePowerPlants", file: "ie_power_plants.pmtiles", sourceLayer: "ie_power_plants", geom: "point", layerId: "ie-power-plants-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#ef4444", tier: "M", count: 44,
    catProp: "category", cats: PLANT_CATS,
    title: { props: ["name"], fallback: l3("電廠與能源設施", "Power plant / energy facility", "発電所・エネルギー施設") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: catMap(PLANT_CATS) },
             { prop: "prtr_records", label: l3("同站 PRTR 申報", "PRTR filings here", "同地点の PRTR 届出") },
             { prop: "reg_no", label: l3("EPA 執照編號", "EPA licence no.", "EPA 許可番号"), kind: "code" },
             { prop: "licence_type", label: l3("執照類型", "Licence type", "許可種別"), kind: "code" },
             { prop: "activity", label: l3("PRTR 活動代碼", "PRTR activity", "PRTR 活動コード"), map: { "1.(c)": l3("1.(c) 燃燒設施（熱輸入 >50 MW）", "1.(c) Combustion (>50 MW thermal input)", "1.(c) 燃焼施設（熱入力 50 MW 超）"), "1.(a)": l3("1.(a) 礦物油與天然氣煉製", "1.(a) Mineral oil and gas refineries", "1.(a) 鉱油・ガス精製") } },
             { prop: "latest_year", label: l3("最近申報年", "Latest filing", "最新届出年"), kind: "year" }, LA],
    legendNotes: [l3("Tailte Éireann 1:250,000 主要電廠 15 座，加 EPA PRTR 能源業設施 43 筆：同站 14 筆（1.5 km 內）併入 Tailte 電廠，其餘 29 筆另成點", "15 major power stations from Tailte Éireann 1:250,000, plus 43 EPA PRTR energy-sector facilities: 14 at the same sites (within 1.5 km) are merged into the Tailte stations, the other 29 shown separately", "Tailte Éireann 1:250,000 の主要発電所15か所と EPA PRTR エネルギー部門43件。同じ地点（1.5 km 以内）の14件は Tailte の発電所に統合し、残り29件は別の点"),
                  l3("PRTR 類別依設施名稱判定；資料中心是熱輸入 >50 MW 的自備燃燒機組，不是電廠", "PRTR types assigned from facility names; data centres are on-site combustion units above 50 MW thermal input, not power stations", "PRTR の種別は施設名で判定。データセンターは熱入力 50 MW 超の自家燃焼設備で発電所ではない"),
                  l3("兩個來源都沒有燃料別與裝置容量；最近申報年早於 2020 的可能已停運；風場另見「陸域風場」", "Neither source gives fuel type or capacity; sites whose latest filing predates 2020 may have closed; wind farms are a separate layer", "どちらの出典にも燃料種別と設備容量はない。最新届出が2020年より前の施設は廃止の可能性。風力は別レイヤー")],
    popupNotes: [],
    sourceOrg: "Tailte Éireann, National 250k Map of Ireland: Power Plant; Environmental Protection Agency, PRTR Energy sector", sourceUrl: DGI("prtr-energy-sector"), license: CC_BY, fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭電廠載入中", "Loading Ireland power plants", "アイルランドの発電所を読み込み中"),
  },
  {
    key: "iePowerLines", file: "ie_power_lines.pmtiles", sourceLayer: "ie_power_lines", geom: "line", layerId: "ie-power-lines-line",
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#f59e0b", count: 2383,
    catProp: "voltage_class", cats: VOLTAGE_CATS,
    title: { props: ["name", "ref"], fallback: l3("輸電線", "Power line", "送電線") },
    fields: [VOLTAGE_FIELD, { prop: "voltage", label: l3("電壓（V）", "Voltage (V)", "電圧（V）"), kind: "code" },
             { prop: "kind", label: l3("型式", "Type", "形式"), map: { line: l3("架空線", "Overhead line", "架空線"), cable: l3("地下／海底電纜", "Underground / submarine cable", "地中・海底ケーブル") } },
             { prop: "operator", label: l3("營運者", "Operator", "事業者") }, { prop: "circuits", label: l3("迴路數", "Circuits", "回線数"), kind: "code" },
             { prop: "length_km", label: l3("路段長", "Segment length", "区間長"), kind: "num", unit: "km", digits: 2 }, OSM_ID_FIELD, LA],
    legendNotes: [OSM_NOTE,
                  l3("收 power=line 全部架空線，加 110 kV 以上地下／海底電纜；低壓配電線（minor_line）與 110 kV 以下電纜不收", "All power=line overhead lines plus underground/submarine cables of 110 kV and above; low-voltage minor lines and cables below 110 kV excluded", "power=line の架空線すべてと 110 kV 以上の地中・海底ケーブル。低圧配電線（minor_line）と 110 kV 未満のケーブルは含まない"),
                  l3("電壓分級依 EirGrid 輸電網（400／220／110 kV）；北愛已剔除，跨境聯絡線與海纜（EWIC、Greenlink）未涵蓋", "Voltage classes follow the EirGrid grid (400/220/110 kV); Northern Ireland removed; cross-border interconnectors and submarine links (EWIC, Greenlink) not covered", "電圧区分は EirGrid 送電網（400／220／110 kV）に準拠。北アイルランドは除外し、越境連系線・海底連系線（EWIC・Greenlink）は未収録")],
    popupNotes: [],
    sourceOrg: OSM_ATTR_IE, sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL 1.0", fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭輸電線載入中", "Loading Ireland power lines", "アイルランドの送電線を読み込み中"),
  },
  {
    key: "ieSubstations", file: "ie_substations.pmtiles", sourceLayer: "ie_substations", geom: "point", layerId: "ie-substations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#facc15", tier: "S", count: 1177,
    catProp: "voltage_class", cats: VOLTAGE_CATS,
    title: { props: ["name"], fallback: l3("變電站", "Substation", "変電所") },
    fields: [VOLTAGE_FIELD, { prop: "voltage", label: l3("電壓（V）", "Voltage (V)", "電圧（V）"), kind: "code" },
             { prop: "substation", label: l3("用途（OSM 原文）", "Role (OSM tag)", "用途（OSM 原文）"), kind: "code" },
             { prop: "operator", label: l3("營運者", "Operator", "事業者") }, OSM_ID_FIELD, LA],
    legendNotes: [OSM_NOTE,
                  l3("power=substation 的點與面（面取代表點），共 1,177 處；電壓取標籤最大值，未標的歸「電壓未標」", "power=substation nodes and areas (areas shown at a representative point), 1,177 in total; voltage is the highest tagged value, untagged shown as “voltage not tagged”", "power=substation の点と面（面は代表点）、計1,177か所。電圧はタグの最大値、未記載は「電圧未記載」"),
                  l3("北愛已剔除；沒有容量與承載資料", "Northern Ireland removed; no capacity or headroom data", "北アイルランドは除外。容量・空き容量のデータはない")],
    popupNotes: [],
    sourceOrg: OSM_ATTR_IE, sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL 1.0", fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭變電站載入中", "Loading Ireland substations", "アイルランドの変電所を読み込み中"),
  },
  {
    key: "ieWindFarms", file: "ie_wind_farms.pmtiles", sourceLayer: "ie_wind_farms", geom: "point", layerId: "ie-wind-farms-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#4ade80", tier: "M", count: 313,
    catProp: "size_class", cats: WIND_SIZE_CATS,
    title: { props: ["name"], fallback: l3("風場", "Wind farm", "風力発電所") },
    fields: [{ prop: "mec_mw", label: l3("最大輸出容量 MEC", "Maximum export capacity (MEC)", "最大送電容量（MEC）"), kind: "num", unit: "MW", digits: 1 },
             { prop: "status", label: l3("狀態（SEAI 原文）", "Status (SEAI)", "状態（SEAI 原文）"), kind: "code" },
             { prop: "year_connected", label: l3("併網年", "Year connected", "系統連系年"), kind: "year" },
             { prop: "node", label: l3("接入節點", "Connection node", "接続ノード") },
             { prop: "operator_level", label: l3("接入電網", "Connected to", "接続先"), map: { DSO: l3("配電網（ESB Networks）", "Distribution (ESB Networks)", "配電網（ESB Networks）"), TSO: l3("輸電網（EirGrid）", "Transmission (EirGrid)", "送電網（EirGrid）") } },
             { prop: "connection_ref", label: l3("接入編號", "Connection ref.", "接続番号"), kind: "code" }, { prop: "county", label: l3("郡", "County", "県") }],
    legendNotes: [l3("SEAI 陸域風場 313 座（另含 Arklow Bank 離岸 1 座），MEC 合計 4,304 MW；2022-06 版，之後併網的風場未收", "313 SEAI wind farms (including 1 offshore, Arklow Bank), MEC 4,304 MW in total; June 2022 edition, later connections not included", "SEAI の風力発電所313か所（洋上の Arklow Bank 1 を含む）、MEC 計4,304 MW。2022年6月版で以後の連系は未収録"),
                  l3("點位是風場接入的變電站，不是風機位置；共用同一變電站的風場會疊在同一點", "Points are the connecting substations, not turbine locations; farms sharing a substation overlap", "点は接続先の変電所で風車の位置ではない。同じ変電所に接続する発電所は重なる")],
    popupNotes: [l3("位置為接入變電站", "Location is the connecting substation", "位置は接続先の変電所")],
    sourceOrg: "Sustainable Energy Authority of Ireland (SEAI), Wind Farms in Ireland", sourceUrl: DGI("wind-farms-in-ireland"), license: CC_BY, fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭風場載入中", "Loading Ireland wind farms", "アイルランドの風力発電所を読み込み中"),
  },
  {
    key: "ieEvCharging", file: "ie_ev_charging.pmtiles", sourceLayer: "ie_ev_charging", geom: "point", layerId: "ie-ev-charging-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", tier: "S", count: 440,
    catProp: "power_class", cats: EV_POWER_CATS,
    title: { props: ["address"], fallback: l3("充電站", "Charging site", "充電スポット") },
    fields: [{ prop: "power_class", label: l3("最大功率等級", "Max power class", "最大出力区分"), map: catMap(EV_POWER_CATS) },
             { prop: "max_kw", label: l3("最大功率", "Max power", "最大出力"), kind: "num", unit: "kW" },
             { prop: "chargers", label: l3("充電樁數", "Chargers", "充電器数"), kind: "num" },
             { prop: "ccs_kw", label: l3("CCS（kW）", "CCS (kW)", "CCS（kW）"), kind: "code" },
             { prop: "chademo_kw", label: l3("CHAdeMO（kW）", "CHAdeMO (kW)", "CHAdeMO（kW）"), kind: "code" },
             { prop: "ac_fast_kw", label: l3("交流快充（kW）", "AC fast (kW)", "交流急速（kW）"), kind: "code" },
             { prop: "ac_socket_kw", label: l3("交流插座（kW）", "AC socket (kW)", "交流コンセント（kW）"), kind: "code" },
             { prop: "open_hours", label: l3("開放時間", "Open hours", "利用時間") }, { prop: "county", label: l3("郡", "County", "県") }],
    legendNotes: [l3("ESB ecars 公共充電站 440 處（充電樁 520），2024-12 快照；北愛 151 處已剔除", "440 ESB ecars public charging sites (520 chargers), December 2024 snapshot; 151 Northern Ireland sites removed", "ESB ecars の公共充電スポット440か所（充電器520）、2024年12月時点。北アイルランドの151か所は除外"),
                  l3("只有 ESB 網路；Tesla、Ionity、Circle K 等其他營運商未涵蓋；不含即時可用狀態與價格。功率欄「150(2), 50」＝150 kW 2 支＋50 kW 1 支", "ESB network only; Tesla, Ionity, Circle K and other operators not covered; no live availability or prices. Power fields like “150(2), 50” mean two 150 kW plus one 50 kW", "ESB のネットワークのみ。Tesla・Ionity・Circle K などは未収録。リアルタイムの空き状況と料金は含まない。出力欄「150(2), 50」は 150 kW 2本＋50 kW 1本")],
    popupNotes: [l3("2024-12 快照", "December 2024 snapshot", "2024年12月時点")],
    sourceOrg: "ESB ecars, EV Public Charging Network", sourceUrl: DGI("esb-ev-public-charging-network"), license: CC_BY, fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭充電站載入中", "Loading Ireland EV charging sites", "アイルランドの充電スポットを読み込み中"),
  },
  {
    key: "ieFuelStations", file: "ie_fuel_stations.pmtiles", sourceLayer: "ie_fuel_stations", geom: "point", layerId: "ie-fuel-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f59e0b", tier: "S", count: 1687,
    catProp: "brand_group", cats: FUEL_BRAND_CATS,
    title: { props: ["name", "brand"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド") },
    fields: [{ prop: "brand", label: l3("品牌（OSM 原文）", "Brand (OSM tag)", "ブランド（OSM 原文）") }, { prop: "operator", label: l3("營運者", "Operator", "事業者") },
             { prop: "opening_hours", label: l3("營業時間（OSM 原文）", "Opening hours (OSM tag)", "営業時間（OSM 原文）"), kind: "code" }, OSM_ID_FIELD, LA],
    legendNotes: [OSM_NOTE,
                  l3("amenity=fuel 的點與面（面取代表點，面內重複的點已合併），共 1,687 站；愛爾蘭沒有官方全國加油站名冊", "amenity=fuel nodes and areas (areas at a representative point, duplicate nodes inside areas merged), 1,687 in total; Ireland has no official national register", "amenity=fuel の点と面（面は代表点、面内の重複点は統合）、計1,687か所。アイルランドに公式の全国名簿はない"),
                  l3("品牌依 OSM brand 標籤原文分組，未標的歸「未標品牌」（不從店名猜）；Topaz 已改掛 Circle K，但 OSM 仍標 Topaz 的照原文歸其他品牌", "Brands grouped from the OSM brand tag as written; untagged shown as “brand not tagged” (not guessed from names); Topaz (now Circle K) stays under other brands where OSM still says Topaz", "ブランドは OSM の brand タグの原文で分類し、未記載は「ブランド未記載」（店名から推測しない）。Topaz（現 Circle K）は OSM の表記どおり「その他」")],
    popupNotes: [],
    sourceOrg: OSM_ATTR_IE, sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL 1.0", fetchedAt: IE_W6_FETCHED_AT,
    loading: l3("愛爾蘭加油站載入中", "Loading Ireland fuel stations", "アイルランドのガソリンスタンドを読み込み中"),
  },
  // ───────────── 第 7a 波：教育（學校、學校規劃區、早期教保服務） ─────────────
  {
    key: "ieSchools", file: "ie_schools.pmtiles", sourceLayer: "ie_schools", geom: "point", layerId: "ie-schools-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 4150,
    catProp: "category", cats: SCHOOL_CATS,
    title: { props: ["name"], fallback: l3("學校", "School", "学校") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: Object.fromEntries(SCHOOL_CATS.map((c) => [c.id, c.label])) },
             { prop: "enrolments", label: l3("在學人數（2026）", "Enrolments (2026)", "在籍者数（2026）"), kind: "num", unit: "人" },
             { prop: "female", label: l3("女", "Female", "女子"), kind: "num" }, { prop: "male", label: l3("男", "Male", "男子"), kind: "num" },
             { prop: "gender", label: l3("男女校", "Gender", "男女別") }, { prop: "post_primary_type", label: l3("中學類型", "Post-primary type", "中等学校の種類") },
             { prop: "primary_type", label: l3("國小類型", "Primary type", "小学校の種類") }, { prop: "deis", label: l3("DEIS（弱勢扶助學校）", "DEIS school", "DEIS（不利地域支援校）"), map: YES_ONLY },
             { prop: "language", label: l3("教學語言", "Language of instruction", "授業言語") }, { prop: "ethos", label: l3("辦學宗教背景", "Ethos", "宗教的背景") },
             { prop: "patron", label: l3("辦學者（Patron）", "Patron", "設置者（Patron）") }, { prop: "fee_paying", label: l3("收學費", "Fee-paying", "授業料あり"), map: YES_ONLY },
             { prop: "gaeltacht", label: l3("位於 Gaeltacht", "In Gaeltacht", "ゲールタハト内"), map: YES_ONLY }, { prop: "island", label: l3("離島學校", "Island school", "離島の学校"), map: YES_ONLY },
             { prop: "planning_area", label: l3("學校規劃區", "School planning area", "学校計画区") },
             { prop: "roll_number", label: l3("學校代碼（Roll No.）", "Roll number", "学校番号（Roll No.）"), kind: "code" },
             { prop: "osm_type", label: l3("OSM 類型", "OSM type", "OSM 種別"), kind: "code" }, { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" },
             { prop: "county", label: l3("郡", "County", "県") }, LA],
    legendNotes: [l3("教育部 2026 名冊 3,927 校：國小 3,062、中學 720、特殊學校 145（缺座標 11 校未畫）；在學人數合計 972,874", "Department of Education 2026 list: 3,927 schools — 3,062 primary, 720 post-primary, 145 special (11 without coordinates not shown); 972,874 pupils enrolled", "教育省2026年名簿の3,927校（小学校3,062・中等学校720・特別支援学校145。座標のない11校は未表示）、在籍者計972,874人"),
                  l3("大專 223 點來自 OpenStreetMap（教育部名冊沒有大專）：大學與校區 85、學院／繼續教育／職訓 138，非官方名冊、完整度未驗", "223 higher/further education points from OpenStreetMap (the Department's list has no third level): 85 universities & campuses, 138 colleges / further education / training centres — not an official list, completeness unverified", "高等教育223地点は OpenStreetMap 由来（教育省名簿に高等教育なし）：大学・キャンパス85、カレッジ・継続教育・職業訓練138。公式名簿ではなく網羅性は未検証"),
                  l3("教育部名冊來源頁未標示授權（授權待確認）；大專點 © OpenStreetMap contributors（ODbL）", "Licence not stated on the Department's source page (to be confirmed); higher-education points © OpenStreetMap contributors (ODbL)", "教育省名簿の出典ページにライセンス表示なし（確認中）。高等教育の点は © OpenStreetMap contributors（ODbL）")],
    popupNotes: [],
    sourceOrg: "Department of Education, Statistics Unit — Schools Map 2026 (licence not stated); © OpenStreetMap contributors (ODbL 1.0)", sourceUrl: "https://www.arcgis.com/home/item.html?id=e71d0ca28fc54513b9a169dac2ebc28d", license: `${LICENSE_PENDING}＋ODbL 1.0`, fetchedAt: IE_W7A_FETCHED_AT,
    loading: l3("愛爾蘭學校載入中", "Loading Ireland schools", "アイルランドの学校を読み込み中"),
  },
  {
    // 鋪滿國土的規劃單位（比照行政界，V-3 豁免、不做點／面切換）；全國視角只畫外框，z9 起填色
    key: "ieSchoolPlanningAreas", file: "ie_school_planning_areas.pmtiles", sourceLayer: "ie_school_planning_areas", geom: "polygon", layerId: "ie-school-planning-areas-fill", outlineId: "ie-school-planning-areas-line", fillFromZoom: 9,
    srcMinzoom: 4, srcMaxzoom: 13, minzoom: 4, color: "#a78bfa", count: 314,
    title: { props: ["name"], fallback: l3("學校規劃區", "School planning area", "学校計画区") },
    fields: [{ prop: "spa_id", label: l3("規劃區代碼", "Planning area ID", "計画区コード"), kind: "code" },
             { prop: "schools", label: l3("區內學校（2026）", "Schools in area (2026)", "区内の学校（2026）"), kind: "num", unit: "校" },
             { prop: "primary", label: l3("國小", "Primary", "小学校"), kind: "num" }, { prop: "post_primary", label: l3("中學", "Post-primary", "中等学校"), kind: "num" },
             { prop: "special", label: l3("特殊學校", "Special", "特別支援学校"), kind: "num" },
             { prop: "enrolments", label: l3("區內在學人數（2026）", "Enrolments in area (2026)", "区内の在籍者数（2026）"), kind: "num", unit: "人" },
             { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 }, LA],
    legendNotes: [l3("教育部規劃學校供給用的 314 個學校規劃區（2011 年版，對齊 Census Small Area），不分學段", "The Department of Education's 314 school planning areas used to plan school provision (2011 version, aligned to Census Small Areas); not split by school level", "教育省が学校整備の計画に使う314の学校計画区（2011年版、国勢調査 Small Area に整合）。学校段階で分けていない"),
                  l3("不是入學學區：家長可申請任何學校，跨區就讀很常見", "Not a catchment area: parents may apply to any school, and cross-area enrolment is common", "通学区域ではない。保護者はどの学校にも出願でき、区をまたぐ通学は多い"),
                  l3("區內校數與在學人數依教育部 2026 名冊的規劃區欄彙總", "School counts and enrolments are summed from the planning-area field of the Department's 2026 school list", "区内の学校数と在籍者数は教育省2026年名簿の計画区欄から集計")],
    popupNotes: [l3("規劃區不是學區", "A planning area is not a catchment", "計画区は通学区域ではない")],
    sourceOrg: "Department of Education, GIS Division — School Planning Areas 2011", sourceUrl: "https://www.arcgis.com/home/item.html?id=bbdf93d83276489dbdcc0be2ee77aec0", license: CC_BY, fetchedAt: IE_W7A_FETCHED_AT,
    loading: l3("愛爾蘭學校規劃區載入中", "Loading Ireland school planning areas", "アイルランドの学校計画区を読み込み中"),
  },
  {
    key: "ieChildcareServices", file: "ie_childcare_services.pmtiles", sourceLayer: "ie_childcare_services", geom: "point", layerId: "ie-childcare-services-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#2dd4bf", tier: "S", count: 5071,
    catProp: "category", cats: CHILDCARE_CATS,
    title: { props: ["name"], fallback: l3("早期教保服務", "Early learning & care service", "幼児教育・保育サービス") },
    fields: [{ prop: "category", label: l3("經營型態", "Operator type", "運営形態"), map: Object.fromEntries(CHILDCARE_CATS.map((c) => [c.id, c.label])) },
             { prop: "name_hidden", label: l3("名稱", "Name", "名称"), map: { yes: l3("個人經營，名稱不顯示", "Sole operator, name withheld", "個人経営のため非表示") } },
             { prop: "afterschool", label: l3("課後照顧（依名稱判斷）", "After-school care (by name)", "放課後ケア（名称から判断）"), map: YES_ONLY },
             { prop: "ecce", label: l3("ECCE 免費學前教育（推定）", "ECCE free pre-school (assumed)", "ECCE 無償就学前教育（推定）"), map: SCHEME },
             { prop: "ncs", label: l3("NCS 國家托育補助（推定）", "National Childcare Scheme (assumed)", "NCS 全国保育補助（推定）"), map: SCHEME },
             { prop: "ccsp", label: l3("CCSP 社區托育補貼（推定）", "CCSP community childcare subvention (assumed)", "CCSP 地域保育補助（推定）"), map: SCHEME },
             { prop: "service_ref", label: l3("服務編號", "Service reference", "サービス番号"), kind: "code" }, LA],
    legendNotes: [l3("Pobal 早期教保（ELC）服務點 5,071（私人 3,895、社區 1,176；缺座標 4 未畫），含托兒所、學前班與課後照顧", "Pobal early learning and care (ELC) services: 5,071 (3,895 private, 1,176 community; 4 without coordinates not shown), incl. crèches, pre-schools and after-school care", "Pobal の幼児教育・保育（ELC）サービス5,071か所（民間3,895・コミュニティ1,176。座標のない4件は未表示）。託児所・就学前・放課後ケアを含む"),
                  l3("約三分之一是個人經營（名稱為個人姓名），名稱不顯示；ECCE／NCS／CCSP 旗標 Pobal 未附說明，語意為推定、未經官方確認", "About a third are sole operators whose service name is a personal name; those names are withheld. The ECCE / NCS / CCSP flags have no published definition (meaning assumed, unconfirmed)", "約3分の1は個人経営（名称が個人名）のため名称を表示しない。ECCE・NCS・CCSP の旗は Pobal に説明がなく、意味は推定（未確認）"),
                  l3("來源頁未標示授權（授權待確認）；補習班沒有官方名冊，未收", "Licence not stated on the source page (to be confirmed); grind schools have no official register and are not included", "出典ページにライセンス表示なし（確認中）。学習塾は公式名簿がなく未収録")],
    popupNotes: [],
    sourceOrg: "Pobal — Childcare Facilities (early learning and care services), PobalMaps (licence not stated)", sourceUrl: "https://www.arcgis.com/home/item.html?id=15b1106eb7594289824617f838215442", license: LICENSE_PENDING, fetchedAt: IE_W7A_FETCHED_AT,
    loading: l3("愛爾蘭早期教保服務點載入中", "Loading Ireland early learning and care services", "アイルランドの幼児教育・保育サービスを読み込み中"),
  },
  // ───────────── 第 8 波：文化遺產與生活據點（文化資產、博物館、藝文場館、公共設施、宗教場所） ─────────────
  {
    // 約 18 萬 點：z12 以下熱區（低縮放圖磚只帶 category），z12 起畫點（同第 2 波商業房產估值）
    key: "ieHeritageSites", file: "ie_heritage_sites.pmtiles", sourceLayer: "ie_heritage_sites", geom: "point", layerId: "ie-heritage-sites-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, heat: { intensity: 0.6 }, color: "#a78bfa", tier: "S", count: 179916,
    catProp: "category", cats: HERITAGE_CATS,
    title: { props: ["name", "class"], fallback: l3("文化資產", "Heritage site", "文化財") },
    fields: [{ prop: "category", label: l3("分組", "Group", "区分"), map: Object.fromEntries(HERITAGE_CATS.map((c) => [c.id, c.label])) },
             { prop: "class", label: l3("類別（原文）", "Class (original)", "種別（原文）") }, { prop: "in_use", label: l3("現在用途（NIAH）", "Current use (NIAH)", "現在の用途（NIAH）") },
             { prop: "rating", label: l3("NIAH 評級", "NIAH rating", "NIAH 評価"), map: NIAH_RATING },
             { prop: "date_from", label: l3("建造年代（起）", "Date from", "建造年代（から）"), kind: "year" }, { prop: "date_to", label: l3("建造年代（迄）", "Date to", "建造年代（まで）"), kind: "year" },
             { prop: "town", label: l3("鎮", "Town", "町") }, { prop: "townland", label: l3("Townland", "Townland", "タウンランド") },
             { prop: "county", label: l3("郡", "County", "県") }, LA, { prop: "ref", label: l3("登錄編號（SMR／NIAH）", "Record no. (SMR / NIAH)", "登録番号（SMR／NIAH）"), kind: "code" }],
    legendNotes: [l3("國家考古登錄 SMR 131,492 處＋建築遺產 NIAH 48,324 棟＋開放參觀的國家古蹟 100 處（SMR 佔位座標 10,879 筆剔除）", "Sites and Monuments Record (SMR) 131,492 + National Inventory of Architectural Heritage (NIAH) 48,324 buildings + 100 national monuments open to visit (10,879 SMR records with placeholder coordinates removed)", "国の遺跡登録 SMR 131,492件＋建築遺産目録 NIAH 48,324棟＋公開されている国指定記念物100か所（座標が仮置きの SMR 10,879件は除外）"),
                  l3("SMR 分組依原類別名稱歸併（本站分組，非官方分類），popup 保留原類別；點位是遺址中心點，不代表範圍", "SMR groups merge the original class names (this site's grouping, not an official classification); popups keep the original class. Points are site centroids, not extents", "SMR の区分は原分類名を本サイトでまとめたもの（公式分類ではない）。ポップアップに原分類を表示。点は遺跡の中心点で範囲ではない"),
                  l3("SMR 墓地三類在「殯葬 › 墓地」、聖井在「宗教 › 點位」，本層不重畫；NIAH 只收 1700 年後且已登錄的建築，各郡調查完成度不均（Cork、Dublin 多，Carlow 少）", "SMR graveyards are in Funeral › Graveyards and holy wells in Religion, not repeated here. NIAH covers registered buildings from 1700 on; survey completeness varies by county", "SMR の墓地3種は「葬祭 › 墓地」、聖なる泉は「宗教」にあり本レイヤーでは重複表示しない。NIAH は1700年以降の登録建築のみで、県ごとに調査の進み具合が異なる"),
                  l3("拉遠為熱區，放大到 z12 才出現點", "Heatmap when zoomed out; points from z12", "縮小時はヒートマップ、z12 から点")],
    popupNotes: [],
    sourceOrg: "National Monuments Service — Sites and Monuments Record, Monuments to Visit; National Inventory of Architectural Heritage (DHLGH)", sourceUrl: DGI("national-monuments-service-archaeological-survey-of-ireland"), license: CC_BY, fetchedAt: IE_W8_FETCHED_AT,
    loading: l3("愛爾蘭文化資產載入中", "Loading Ireland heritage sites", "アイルランドの文化財を読み込み中"),
  },
  {
    key: "ieMuseums", file: "ie_museums.pmtiles", sourceLayer: "ie_museums", geom: "point", layerId: "ie-museums-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 523,
    catProp: "category", cats: MUSEUM_CATS,
    title: { props: ["name"], fallback: l3("博物館", "Museum", "博物館") },
    fields: [{ prop: "category", label: l3("類型（推定）", "Type (assumed)", "種別（推定）"), map: Object.fromEntries(MUSEUM_CATS.map((c) => [c.id, c.label])) },
             { prop: "lamn", label: l3("地方政府博物館網絡（LAMN）", "Local Authority Museums Network", "地方自治体博物館ネットワーク（LAMN）"), map: { yes: l3("是", "Yes", "はい") } },
             { prop: "town", label: l3("鎮", "Town", "町") }, { prop: "county", label: l3("郡", "County", "県") }, LA],
    legendNotes: [l3("Heritage Council 博物館、典藏與檔案館名冊 523 處（2015 年版，之後新開或關閉的館未反映；剔北愛 64 處）", "Heritage Council list of museums, collections and archives: 523 (2015 edition — later openings and closures not reflected; 64 in Northern Ireland removed)", "Heritage Council の博物館・収蔵施設・アーカイブ名簿523か所（2015年版。その後の開館・閉館は未反映。北アイルランドの64か所は除外）"),
                  l3("名冊沒有類型欄：類型依名稱關鍵字推定、未經官方確認；名冊含對外開放的歷史宅邸、花園、遊客中心等，範圍比博物館寬", "The list has no type field: types are assumed from name keywords (unconfirmed). It includes historic houses, gardens and visitor centres open to the public, so it is broader than museums", "名簿に種別欄はなく、種別は名称のキーワードから推定（未確認）。公開されている歴史的邸宅・庭園・ビジターセンターなども含み、博物館より範囲が広い")],
    popupNotes: [],
    sourceOrg: "The Heritage Council — Museums, Collections and Archives (2015); Local Authority Museums Network", sourceUrl: DGI("museums-collections-archives"), license: CC_BY, fetchedAt: IE_W8_FETCHED_AT,
    loading: l3("愛爾蘭博物館載入中", "Loading Ireland museums", "アイルランドの博物館を読み込み中"),
  },
  {
    key: "ieArtsVenues", file: "ie_arts_venues.pmtiles", sourceLayer: "ie_arts_venues", geom: "point", layerId: "ie-arts-venues-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f472b6", tier: "M", count: 84,
    catProp: "category", cats: ARTS_CATS,
    title: { props: ["name"], fallback: l3("藝文場館", "Arts venue", "芸術文化施設") },
    fields: [{ prop: "category", label: l3("類型（推定）", "Type (assumed)", "種別（推定）"), map: Object.fromEntries(ARTS_CATS.map((c) => [c.id, c.label])) },
             { prop: "venue_type", label: l3("議會原類型", "Council's venue type", "議会の施設種別") },
             { prop: "council", label: l3("資料來源議會", "Source council", "出典の議会"), map: ARTS_COUNCIL }, LA],
    legendNotes: [l3("愛爾蘭沒有全國藝文場館名冊：只有 6 個地方政府有開放名冊（Dublin City、Dún Laoghaire-Rathdown、Fingal、South Dublin、Galway City、Roscommon），共 84 處；其餘 25 個地方政府未涵蓋", "Ireland has no national arts venue register: only 6 local authorities publish one (Dublin City, Dún Laoghaire-Rathdown, Fingal, South Dublin, Galway City, Roscommon), 84 venues in total; the other 25 are not covered", "アイルランドに全国の芸術文化施設名簿はなく、名簿を公開しているのは6自治体（Dublin City・Dún Laoghaire-Rathdown・Fingal・South Dublin・Galway City・Roscommon）の計84か所のみ。残る25自治体は未収録"),
                  l3("類型依議會類型欄與名稱關鍵字推定、未經官方確認；名冊年份不一（DLR 2016、Dublin City 2024）", "Types are assumed from the councils' type fields and names (unconfirmed); list vintages differ (DLR 2016, Dublin City 2024)", "種別は議会の種別欄と名称から推定（未確認）。名簿の年次はまちまち（DLR 2016年、Dublin City 2024年）")],
    popupNotes: [],
    sourceOrg: "Dublin City Council; Dún Laoghaire-Rathdown, Fingal, South Dublin, Galway City and Roscommon councils (data.gov.ie)", sourceUrl: DGI("theatres-arts-centres-performance-spaces-dcc"), license: CC_BY, fetchedAt: IE_W8_FETCHED_AT,
    loading: l3("愛爾蘭藝文場館載入中", "Loading Ireland arts venues", "アイルランドの芸術文化施設を読み込み中"),
  },
  {
    key: "iePublicFacilities", file: "ie_public_facilities.pmtiles", sourceLayer: "ie_public_facilities", geom: "point", layerId: "ie-public-facilities-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#2dd4bf", tier: "S", count: 3080,
    catProp: "category", cats: PUBLIC_FACILITY_CATS,
    title: { props: ["name"], fallback: l3("公共設施", "Public facility", "公共施設") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: Object.fromEntries(PUBLIC_FACILITY_CATS.map((c) => [c.id, c.label])) },
             { prop: "source", label: l3("來源", "Source", "出典"), map: { official: l3("議會名冊", "Council list", "議会の名簿"), osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap") } },
             { prop: "town", label: l3("鎮", "Town", "町") }, { prop: "opening_hours", label: l3("開放時間", "Opening hours", "開館・利用時間") },
             { prop: "wheelchair", label: l3("輪椅可用", "Wheelchair accessible", "車いす利用可"), map: { yes: l3("是", "Yes", "はい"), no: l3("否", "No", "いいえ"), limited: l3("部分", "Limited", "一部") } },
             { prop: "fee", label: l3("收費", "Fee", "有料"), map: { yes: l3("是", "Yes", "はい"), no: l3("否", "No", "いいえ") } },
             { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" }, LA],
    legendNotes: [l3("議會名冊 428 處：圖書館 11 個地方政府、社區中心 5 個、公廁 3 個（都柏林三議會）；其餘以 OpenStreetMap 補 2,652 處（同類議會點 150 m 內不重收），OSM 完整度未驗", "428 from council lists: libraries from 11 local authorities, community centres from 5, public toilets from 3 (Dublin councils); 2,652 more from OpenStreetMap (skipped within 150 m of a council point of the same type), completeness unverified", "議会名簿の428か所：図書館は11自治体、コミュニティセンターは5自治体、公衆トイレは3自治体（ダブリンの議会）。ほかに OpenStreetMap から2,652か所（同種の議会の点から150 m 以内は除外）、網羅性は未検証"),
                  l3("非公開公廁（OSM access=private／customers）不收；Wexford 圖書館名冊下載失效未收；郵局、超商、飲水點無官方開放來源", "Private toilets (OSM access=private / customers) excluded; Wexford's library list link is dead; post offices, shops and drinking fountains have no official open source", "非公開のトイレ（OSM access=private／customers）は除外。Wexford の図書館名簿はリンク切れで未収録。郵便局・コンビニ・水飲み場は公式の公開データなし"),
                  l3("議會名冊 CC BY 4.0（South Dublin 社區中心 CC0）；OSM 點 © OpenStreetMap contributors（ODbL）", "Council lists CC BY 4.0 (South Dublin community centres CC0); OSM points © OpenStreetMap contributors (ODbL)", "議会名簿は CC BY 4.0（South Dublin のコミュニティセンターは CC0）。OSM の点は © OpenStreetMap contributors（ODbL）")],
    popupNotes: [],
    sourceOrg: "11 Irish local authorities (libraries, community centres, public toilets; data.gov.ie); © OpenStreetMap contributors (ODbL 1.0)", sourceUrl: DGI("dublin-city-libraries"), license: `${CC_BY}＋ODbL 1.0`, fetchedAt: IE_W8_FETCHED_AT,
    loading: l3("愛爾蘭公共設施載入中", "Loading Ireland public facilities", "アイルランドの公共施設を読み込み中"),
  },
  {
    key: "ieReligiousSites", file: "ie_religious_sites.pmtiles", sourceLayer: "ie_religious_sites", geom: "point", layerId: "ie-religious-sites-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", tier: "S", count: 5950,
    catProp: "category", cats: RELIGION_CATS,
    title: { props: ["name", "townland"], fallback: l3("宗教場所", "Religious site", "宗教施設") },
    fields: [{ prop: "category", label: l3("類型", "Type", "種別"), map: Object.fromEntries(RELIGION_CATS.map((c) => [c.id, c.label])) },
             { prop: "original_type", label: l3("原始用途（NIAH）", "Original use (NIAH)", "当初の用途（NIAH）") }, { prop: "in_use", label: l3("現在用途（NIAH）", "Current use (NIAH)", "現在の用途（NIAH）") },
             { prop: "denomination", label: l3("教派（依名稱推定）", "Denomination (from name)", "宗派（名称から推定）"), map: DENOMINATION },
             { prop: "rating", label: l3("NIAH 評級", "NIAH rating", "NIAH 評価"), map: NIAH_RATING },
             { prop: "date_from", label: l3("建造年代（起）", "Date from", "建造年代（から）"), kind: "year" }, { prop: "date_to", label: l3("建造年代（迄）", "Date to", "建造年代（まで）"), kind: "year" },
             { prop: "town", label: l3("鎮", "Town", "町") }, { prop: "townland", label: l3("Townland", "Townland", "タウンランド") }, { prop: "county", label: l3("郡", "County", "県") }, LA,
             { prop: "ref", label: l3("登錄編號（NIAH／SMR）", "Record no. (NIAH / SMR)", "登録番号（NIAH／SMR）"), kind: "code" }],
    legendNotes: [l3("NIAH 原始用途為禮拜建築者 3,224 棟（教堂 3,140、主教座堂 43、會堂、猶太會堂與小祈禱所 41；現在仍作教堂 2,412）＋SMR 聖井 2,726 處", "3,224 NIAH buildings originally built for worship (3,140 churches/chapels, 43 cathedrals, 41 meeting houses, synagogues and oratories; 2,412 still in use as churches) + 2,726 holy wells from the SMR", "NIAH で当初の用途が礼拝建築の3,224棟（教会3,140・大聖堂43・集会所／シナゴーグ／祈祷所41。現在も教会として使用2,412）＋SMR の聖なる泉2,726か所"),
                  l3("沒有全國現用禮拜場所名冊：NIAH 是建築遺產登錄，只收 1700 年後且已登錄的建築（也收在「觀光 › 文化資產」）；中世紀教堂遺址在文化資產層", "There is no national register of places of worship in use: NIAH is a heritage inventory of registered buildings from 1700 on (also in Tourism › Heritage); medieval church sites are in the heritage layer", "現用の礼拝施設の全国名簿はない。NIAH は1700年以降の登録建築の遺産目録（「観光 › 文化財」にも収録）。中世の教会跡は文化財レイヤーにある"),
                  l3("教派依名稱關鍵字推定、未經官方確認，推不出的留空", "Denomination is assumed from name keywords (unconfirmed); left blank when unclear", "宗派は名称のキーワードから推定（未確認）。判別できないものは空欄")],
    popupNotes: [],
    sourceOrg: "National Inventory of Architectural Heritage; National Monuments Service — Sites and Monuments Record (DHLGH)", sourceUrl: DGI("national-inventory-of-architectural-heritage-niah-national-dataset"), license: CC_BY, fetchedAt: IE_W8_FETCHED_AT,
    loading: l3("愛爾蘭宗教場所載入中", "Loading Ireland religious sites", "アイルランドの宗教施設を読み込み中"),
  },
  // ───────────── 第 7b 波：醫療照護、消防警政、司法 ─────────────
  {
    key: "ieHealthFacilities", file: "ie_health_facilities.pmtiles", sourceLayer: "ie_health_facilities", geom: "point", layerId: "ie-health-facilities-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#e53935", tier: "S", count: 3482,
    catProp: "kind", cats: HEALTH_KIND_CATS,
    title: { props: ["name"], fallback: l3("醫療院所", "Health facility", "医療機関") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(HEALTH_KIND_CATS) },
             { prop: "operator", label: l3("營運者", "Operator", "運営者") }, { prop: "operator_type", label: l3("營運類型（OSM 原文）", "Operator type (OSM tag)", "運営形態（OSM 原文）"), kind: "code" },
             { prop: "emergency", label: l3("急診（OSM 標註）", "Emergency department (OSM tag)", "救急（OSM 記載）"), map: YES_NO },
             { prop: "speciality", label: l3("專科（OSM 原文）", "Speciality (OSM tag)", "専門（OSM 原文）"), kind: "code" }, OSM_ID_FIELD, LA],
    legendNotes: [l3("來源 OpenStreetMap（HSE 醫院、診所、GP、藥局名冊在 data.gov.ie 已下架），完整度依志工貢獻；2026-11-05 Geofabrik 快照", "Source: OpenStreetMap (the HSE hospital, clinic, GP and pharmacy registers were withdrawn from data.gov.ie); completeness depends on contributors; Geofabrik snapshot 2026-11-05", "出典 OpenStreetMap（HSE の病院・診療所・GP・薬局名簿は data.gov.ie から削除済み）。網羅性はボランティア次第。Geofabrik 2026-11-05 時点"),
                  l3("amenity=hospital／clinic／doctors／dentist／pharmacy 的點與面（面取代表點，面內重複點已合併），共 3,482 處；北愛已剔除", "amenity=hospital/clinic/doctors/dentist/pharmacy nodes and areas (areas at a representative point, duplicate nodes merged), 3,482 in total; Northern Ireland removed", "amenity=hospital／clinic／doctors／dentist／pharmacy の点と面（面は代表点、重複点は統合）、計3,482か所。北アイルランドは除外"),
                  l3("護理之家等照護機構另見「HIQA 老人照護機構」；AED 不收（NAS 登記不公開）", "Nursing homes are in the separate HIQA care homes layer; defibrillators not included (NAS register not public)", "介護施設は「HIQA 高齢者介護施設」レイヤーを参照。AED は含まない（NAS の登録は非公開）")],
    popupNotes: [],
    sourceOrg: OSM_ATTR_IE, sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL 1.0", fetchedAt: IE_W7B_FETCHED_AT,
    loading: l3("愛爾蘭醫療院所載入中", "Loading Ireland health facilities", "アイルランドの医療機関を読み込み中"),
  },
  {
    key: "ieCareHomes", file: "ie_care_homes.pmtiles", sourceLayer: "ie_care_homes", geom: "point", layerId: "ie-care-homes-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f59f00", tier: "M", count: 535,
    catProp: "geocode_precision", cats: CARE_PRECISION_CATS,
    title: { props: ["name"], fallback: l3("老人照護機構", "Care home", "高齢者介護施設") },
    fields: [{ prop: "address", label: l3("地址（HIQA）", "Address (HIQA)", "住所（HIQA）") }, { prop: "eircode", label: l3("Eircode", "Eircode", "Eircode"), kind: "code" },
             { prop: "max_occupancy", label: l3("核定床位上限", "Maximum occupancy", "定員上限"), kind: "num" },
             { prop: "operator_type", label: l3("營運者類型", "Provider type", "事業者の種別"), map: { hse: l3("HSE（公立）", "HSE (public)", "HSE（公立）"), other: l3("其他登記業者（私營、志願或宗教團體）", "Other registered provider (private, voluntary or religious)", "その他の登録事業者（民間・ボランタリー・宗教団体）") } },
             { prop: "provider", label: l3("登記業者", "Registered provider", "登録事業者") },
             { prop: "registration_no", label: l3("HIQA 登記號", "HIQA registration no.", "HIQA 登録番号"), kind: "code" },
             { prop: "registered", label: l3("登記日", "Registered", "登録日"), kind: "code" }, { prop: "expires", label: l3("登記到期", "Registration expires", "登録期限"), kind: "code" },
             PRECISION_FIELD, LA],
    legendNotes: [l3("HIQA 老人照護指定機構名冊 547 家（2026-11-08 下載）；授權待確認（HIQA 頁面未標示授權）", "HIQA register of designated centres for older persons, 547 centres (downloaded 2026-11-08); licence to be confirmed (not stated on the HIQA page)", "HIQA 高齢者向け指定施設名簿547か所（2026-11-08 取得）。ライセンス確認中（HIQA のページに記載なし）"),
                  GEOCODE_NOTE,
                  l3("上圖 535 家（命中 OSM 同名設施 200、門牌 45、街道 127、城鎮 163）；另 12 家查無結果、未上圖（無只到郡級者）", "535 mapped (matched OSM facility 200, house number 45, street 127, town 163); 12 more could not be located and are not mapped (none resolved only to county level)", "地図化535か所（OSM 同名施設 200、番地 45、通り 127、町 163）。ほか12か所は位置が特定できず未表示（県レベルのみのものはなし）"),
                  l3("負責人姓名、電話等個資欄位不收；身障機構 1,821 家只有郡別，未上圖", "Person-in-charge names, phone numbers and other personal fields are excluded; 1,821 disability centres have only a county and are not mapped", "管理者の氏名・電話などの個人情報は収録しない。障害者施設1,821か所は県のみで地図化していない")],
    popupNotes: [GEOCODE_POPUP, l3("授權待確認", "Licence to be confirmed", "ライセンス確認中")],
    sourceOrg: `Health Information and Quality Authority (HIQA), Register of Designated Centres — Older Persons (licence not stated); ${NOMINATIM_ORG}`, sourceUrl: "https://www.hiqa.ie/areas-we-work/older-persons-services", license: `${LICENSE_PENDING}＋ODbL 1.0`, fetchedAt: IE_W7B_FETCHED_AT,
    loading: l3("愛爾蘭老人照護機構載入中", "Loading Ireland care homes", "アイルランドの高齢者介護施設を読み込み中"),
  },
  {
    key: "ieFireStations", file: "ie_fire_stations.pmtiles", sourceLayer: "ie_fire_stations", geom: "point", layerId: "ie-fire-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#e53935", tier: "M", count: 226,
    catProp: "source_kind", cats: FIRE_SOURCE_CATS,
    title: { props: ["name"], fallback: l3("消防站", "Fire station", "消防署") },
    fields: [{ prop: "source", label: l3("資料來源", "Source", "出典"), map: FIRE_SOURCE_ORG }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "duty", label: l3("編制（來源原文）", "Crewing (as in source)", "勤務体制（出典の原文）"), kind: "code" },
             { prop: "operator", label: l3("營運者（OSM 原文）", "Operator (OSM tag)", "運営者（OSM 原文）") }, OSM_ID_FIELD, LA],
    legendNotes: [l3("官方點位 42 站：Dublin Fire Brigade（都柏林四區）、Fingal、Cork City、Kildare、Wicklow、Roscommon 議會（官方彼此 300 m 內視為同站）；只涵蓋約 8/31 個地方政府，Wexford 官方來源已失效", "42 official stations from Dublin Fire Brigade (four Dublin councils), Fingal, Cork City, Kildare, Wicklow and Roscommon councils (official points within 300 m treated as one); covers about 8 of 31 councils, and the Wexford source is dead", "公式42か所：Dublin Fire Brigade（Dublin 4 区）、Fingal・Cork City・Kildare・Wicklow・Roscommon の各議会（300 m 以内は同一とみなす）。31 自治体のうち約8のみで、Wexford の出典は失効"),
                  l3("其餘 184 站由 OpenStreetMap amenity=fire_station 補缺（距官方點 300 m 內者視為同站捨去），完整度依志工貢獻；北愛已剔除", "The other 184 stations are gap-filled from OpenStreetMap amenity=fire_station (OSM points within 300 m of an official one dropped); completeness depends on contributors; Northern Ireland removed", "残り184か所は OpenStreetMap amenity=fire_station で補完（公式点から 300 m 以内は同一として除外）。網羅性はボランティア次第。北アイルランドは除外")],
    popupNotes: [],
    sourceOrg: `Dublin City Council (Dublin Fire Brigade), Fingal, Cork City, Kildare, Wicklow, Roscommon County Councils; ${OSM_ATTR_IE}`, sourceUrl: DGI("dublin-fire-brigade-stations-dublin-region"), license: "CC BY 4.0／ODbL 1.0", fetchedAt: IE_W7B_FETCHED_AT,
    loading: l3("愛爾蘭消防站載入中", "Loading Ireland fire stations", "アイルランドの消防署を読み込み中"),
  },
  {
    key: "ieGardaStations", file: "ie_garda_stations.pmtiles", sourceLayer: "ie_garda_stations", geom: "point", layerId: "ie-garda-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 536,
    catProp: "geocode_precision", cats: PRECISION_CATS,
    title: { props: ["name"], fallback: l3("Garda 警察站", "Garda station", "Garda 警察署") },
    fields: [{ prop: "division", label: l3("Garda 分局（Division）", "Garda division", "Garda 管区（Division）") }, { prop: "station_code", label: l3("CSO 站碼", "CSO station code", "CSO 署コード"), kind: "code" },
             PRECISION_FIELD, { prop: "matched_name", label: l3("對到的名稱", "Matched name", "一致した名称") }, LA],
    legendNotes: [l3("站名冊取自 CSO 犯罪統計 CJA11（Garda 新營運模式，564 站）；不含犯罪件數", "Station list from CSO crime table CJA11 (new Garda operating model, 564 stations); crime counts not included", "署の名簿は CSO 犯罪統計 CJA11（Garda 新運営モデル、564署）。犯罪件数は含まない"),
                  l3("官方座標 56 站：Dublin City Council 都會區名冊 41、Cork City 12、Fingal 3（含 Meath、Kildare 邊界站），依同郡站名對應", "56 stations use official coordinates: Dublin City Council metropolitan list 41, Cork City 12, Fingal 3 (incl. border stations in Meath and Kildare), matched by name within the county", "公式座標56署：Dublin City Council 都市圏名簿41、Cork City 12、Fingal 3（Meath・Kildare の境界署を含む）。同じ県内で署名を照合"),
                  GEOCODE_NOTE,
                  l3("上圖 536 站（官方 56、命中 OSM Garda 站 344、門牌 6、街道 5、城鎮中心 125）；另 28 站（多為愛爾蘭語站名，含 2 站同名地點跨郡無法判斷）查無結果、未上圖", "536 mapped (official 56, matched OSM Garda station 344, house number 6, street 5, town centre 125); 28 more (mostly Irish-language names, incl. 2 with same-name places in several counties) could not be located and are not mapped", "地図化536署（公式 56、OSM の Garda 署に一致 344、番地 6、通り 5、町の中心 125）。ほか28署（多くはアイルランド語名、うち2署は同名地が複数県にあり判別不能）は未表示")],
    popupNotes: [],
    sourceOrg: `Central Statistics Office (CJA11); Dublin City, Fingal, Dún Laoghaire-Rathdown, Cork City Councils; ${NOMINATIM_ORG}`, sourceUrl: DGI("cja11-recorded-crime-incidents-new-garda-operating-model"), license: "CC BY 4.0／ODbL 1.0", fetchedAt: IE_W7B_FETCHED_AT,
    loading: l3("愛爾蘭 Garda 警察站載入中", "Loading Ireland Garda stations", "アイルランドの Garda 警察署を読み込み中"),
  },
  {
    key: "ieCourts", file: "ie_courts.pmtiles", sourceLayer: "ie_courts", geom: "point", layerId: "ie-courts-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", tier: "M", count: 94,
    catProp: "region", cats: COURT_REGION_CATS,
    title: { props: ["name"], fallback: l3("法院", "Courthouse", "裁判所") },
    fields: [{ prop: "region", label: l3("Courts Service 管理區", "Courts Service region", "Courts Service 地域"), map: catMap(COURT_REGION_CATS) },
             { prop: "circuit", label: l3("巡迴法院區", "Circuit", "巡回裁判区") }, { prop: "district_number", label: l3("地方法院區號", "District Court district no.", "地方裁判所の区番号"), kind: "code" },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "eircode", label: l3("Eircode", "Eircode", "Eircode"), kind: "code" }, { prop: "county", label: l3("郡", "County", "県") }],
    legendNotes: [l3("Courts Service 法院辦公處 94 處（26 郡），座標由來源提供；依 Courts Service 5 個管理區篩選", "94 Courts Service court offices (26 counties), coordinates from the source; filter by the 5 Courts Service regions", "Courts Service の裁判所事務所94か所（26県）、座標は出典のもの。Courts Service の5地域で絞り込み"),
                  l3("只有設辦公處的法院；監獄、法院管轄區邊界未涵蓋", "Court offices only; prisons and court district boundaries not covered", "事務所のある裁判所のみ。刑務所と管轄区域の境界は未収録")],
    popupNotes: [],
    sourceOrg: "Courts Service of Ireland, List of Courts Service Courthouses", sourceUrl: DGI("list-of-courts-service-courthouses"), license: CC_BY, fetchedAt: IE_W7B_FETCHED_AT,
    loading: l3("愛爾蘭法院載入中", "Loading Ireland courthouses", "アイルランドの裁判所を読み込み中"),
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
