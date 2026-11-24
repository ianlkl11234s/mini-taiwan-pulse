/**
 * 美國第 0–1 波（2026-11-25）圖層規格 SSOT：hook paint、圖例、popup、參數規格共用。
 * - 行政邊界（C001）：Census CB 2025 州 51（50 州＋DC）／郡 3,144；人口（C023）：ACS 2020–2024 5 年估計，州／郡／普查區三層級；專用 hook `useUsLayers.ts`。
 * - 其餘 9 層重用菲律賓規格引擎（`PhLayerSpec`＋`usePhDataLayer`）。
 * 涵蓋 50 州＋DC；波多黎各、關島等屬地不在本國範圍（另有屬地國別）。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/topic-research/us_opendata/waves/` 與各 `_manifest.json`。
 * 授權空白來源照常上線、圖例寫「授權未明示」；HIFLD 存檔標「HIFLD 存檔 2025-08」（使用者 2026-11-21）。
 */
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhPart, PhSizeBands } from "./intlLayerShared";
import type { UsDataKey } from "./usDataKeys";
import type { LayerSourceInfo } from "./layerSourceInfo";

export type { L3 } from "./intlLayerShared";
export { pickL3, phText } from "./intlLayerShared";

export interface UsLayerSpec extends PhLayerSpec<UsDataKey> {
  /** 類別多選的預設選取（類別 id）；省略＝全選 */
  defaultCats?: readonly string[];
  /** 這層放進「說明・來源」備註的固定說明 */
  sourceNotes?: readonly L3[];
}

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
const cat = (id: string, values: readonly string[], color: string, zh: string, en: string, ja: string, extra: Partial<PhCat> = {}): PhCat =>
  ({ id, values, color, label: l3(zh, en, ja), ...extra });
const point = (id: string, sourceLayer: string, minzoom: number, c: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: c, ...extra });

export const US_FETCHED_AT = "2026-11-25";
export const US_LICENSE_PD = l3("美國聯邦政府作品（公有領域）", "U.S. Government Work (public domain)", "米国連邦政府著作物（パブリックドメイン）");
export const US_HIFLD_NOTE = l3("HIFLD 存檔 2025-08：HIFLD Open 已於 2025-08 下架，此為 SeerAI 存檔（CC BY 4.0），之後不會更新", "HIFLD archive 2025-08: HIFLD Open was retired in 2025-08; this is the SeerAI archive (CC BY 4.0) and will not be updated", "HIFLD アーカイブ 2025-08：HIFLD Open は 2025-08 に終了。SeerAI のアーカイブ（CC BY 4.0）で今後更新されない");
export const US_SCOPE_NOTE = l3("範圍：50 州＋華盛頓特區；波多黎各、關島等屬地不含", "Scope: 50 states + DC; territories (Puerto Rico, Guam, etc.) excluded", "範囲：50 州＋DC。プエルトリコ・グアム等の属領は含まない");
/** 未涵蓋＝灰（不畫成 0）。 */
export const US_NOT_COVERED_COLOR = "#6b7280";
export const US_ADMIN_COLOR = "#9ca3af";

const COUNTY_FIELDS: readonly PhField[] = [
  { prop: "county_name", label: l3("郡", "County", "郡") },
  { prop: "state_abbr", label: l3("州", "State", "州") },
];
const NEAREST: PhNote = { text: l3("點落在郡界外（岸邊、離島），郡取最近者", "Point lies outside county polygons (shore, islands); nearest used", "点が郡境の外（海岸・離島）にあり、最寄りを採用"), when: (p) => str(p.admin_method) === "nearest" };
const OFFSHORE: PhNote = { text: l3("聯邦外海（OCS），不屬任何郡", "Federal offshore (OCS), not in any county", "連邦沖合（OCS）、どの郡にも属さない"), when: (p) => str(p.admin_method) === "offshore" };

// ═════════════════════════ 行政邊界 ═════════════════════════

/** 層級＝PMTiles tile layer 名（select encode 順序）；srcMinzoom／srcMaxzoom＝檔內該層實際縮放範圍。 */
export const US_ADMIN_LEVELS = [
  { value: "state", label: "州（State，51）", srcMinzoom: 2, srcMaxzoom: 10 },
  { value: "county", label: "郡（County，3,144）", srcMinzoom: 4, srcMaxzoom: 12 },
] as const;
export type UsAdminLevel = (typeof US_ADMIN_LEVELS)[number]["value"];
export const US_ADMIN_LEVEL_LABELS: Record<string, L3> = {
  state: l3("州", "State", "州"),
  county: l3("郡", "County", "郡"),
  tract: l3("普查區（Census tract）", "Census tract", "国勢調査区（Census tract）"),
};
export const US_ADMIN_NOTES: readonly L3[] = [
  l3("州 51（50 州＋DC）、郡 3,144（含郡級單位；康乃狄克州為 9 個規劃區）；一次只顯示一個層級", "51 states (50 + DC), 3,144 counties and equivalents (Connecticut uses 9 planning regions); one level at a time", "州 51（50 州＋DC）・郡 3,144（郡相当を含む。コネチカット州は計画区域 9）。一度に 1 階層のみ"),
  l3("Census Cartographic Boundary 2025（1:500,000 簡化），海岸線為製圖簡化版", "Census Cartographic Boundary 2025 (1:500,000 generalized); coastlines are generalized", "Census Cartographic Boundary 2025（1:500,000 簡略化）。海岸線は簡略化"),
  US_SCOPE_NOTE,
];

// ═════════════════════════ 人口 ═════════════════════════

export const US_POP_KEY = "usPopulation";
export const US_POP_LEVELS = [
  { value: "state", label: "州（51）", srcMinzoom: 2, srcMaxzoom: 9 },
  { value: "county", label: "郡（3,144）", srcMinzoom: 3, srcMaxzoom: 11 },
  { value: "tract", label: "普查區（84,119，z7 起）", srcMinzoom: 7, srcMaxzoom: 12 },
] as const;
export type UsPopLevel = (typeof US_POP_LEVELS)[number]["value"];
/** 人口密度（人／km² 陸地面積）6 級斷點：各層級取美國實際分布 P10／25／50／75／90（2 位有效數字，analytics manifest）。 */
export const US_DENSITY_BREAKS_BY_LEVEL = {
  state: [6.7, 20, 42, 88, 250],
  county: [1.5, 6.2, 17, 46, 170],
  tract: [18, 130, 860, 2100, 4300],
} as const;
export const US_DENSITY_LABELS_BY_LEVEL = {
  state: ["<6.7", "6.7–20", "20–42", "42–88", "88–250", "≥250"],
  county: ["<1.5", "1.5–6.2", "6.2–17", "17–46", "46–170", "≥170"],
  tract: ["<18", "18–130", "130–860", "860–2,100", "2,100–4,300", "≥4,300"],
} as const;
export const US_POPULATION_NOTES: readonly L3[] = [
  l3("ACS 2020–2024 5 年估計（B01003 總人口）是抽樣估計，不是 2020 普查；密度＝人口 ÷ 陸地面積", "ACS 2020–2024 5-year estimates (B01003 total population) are survey estimates, not the 2020 census; density = population ÷ land area", "ACS 2020–2024 5 年推計（B01003 総人口）は標本推計で 2020 年国勢調査ではない。密度＝人口 ÷ 陸地面積"),
  l3("級距依美國分布（州、郡、普查區各自取百分位），與其他國家不可直接比色", "Classes follow the U.S. distribution (percentiles per level); colors cannot be compared with other countries", "区分は米国内の分布（階層ごとの百分位）。他国と色を直接比較しないこと"),
  l3("灰色＝未涵蓋（無 ACS 值或全水域普查區），不是 0；普查區 z7 起", "Grey = not covered (no ACS value or all-water tract), not zero; tracts from z7", "灰色＝未収録（ACS 値なし・全水域の区）で 0 ではない。国勢調査区は z7 以上"),
  US_SCOPE_NOTE,
];

// ═════════════════════════ 分類 ═════════════════════════

const CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 1.5, label: "<50" }, { min: 50, radius: 3, label: "50–300" }, { min: 300, radius: 5.5, label: "300–1,500" }, { min: 1500, radius: 8.5, label: "≥1,500" }],
};
const FUEL_LABELS: Record<string, L3> = {
  gas: l3("天然氣", "Natural gas", "天然ガス"), coal: l3("燃煤", "Coal", "石炭"), nuclear: l3("核能", "Nuclear", "原子力"), oil: l3("石油", "Petroleum", "石油"),
  hydro: l3("水力（含抽蓄）", "Hydro (incl. pumped storage)", "水力（揚水含む）"), wind: l3("風力", "Wind", "風力"), solar: l3("太陽能", "Solar", "太陽光"),
  storage: l3("電池儲能", "Battery storage", "蓄電池"), geothermal: l3("地熱", "Geothermal", "地熱"), biomass: l3("生質能、廢棄物", "Biomass, waste", "バイオマス・廃棄物"), other: l3("其他", "Other", "その他"),
};
const PLANT_CATS: readonly PhCat[] = [
  cat("gas", ["gas"], "#f59e0b", "天然氣（1,986）", "Natural gas (1,986)", "天然ガス（1,986）"),
  cat("coal", ["coal"], "#a8a29e", "燃煤（195）", "Coal (195)", "石炭（195）"),
  cat("nuclear", ["nuclear"], "#c084fc", "核能（56）", "Nuclear (56)", "原子力（56）"),
  cat("oil", ["oil"], "#d97706", "石油（861）", "Petroleum (861)", "石油（861）"),
  cat("hydro", ["hydro"], "#38bdf8", "水力（1,426）", "Hydro (1,426)", "水力（1,426）"),
  cat("wind", ["wind"], "#2dd4bf", "風力（1,356）", "Wind (1,356)", "風力（1,356）"),
  cat("solar", ["solar"], "#facc15", "太陽能（7,223）", "Solar (7,223)", "太陽光（7,223）"),
  cat("storage", ["storage"], "#f472b6", "電池儲能（524）", "Battery storage (524)", "蓄電池（524）"),
  cat("geothermal", ["geothermal"], "#fb7185", "地熱（66）", "Geothermal (66)", "地熱（66）"),
  cat("biomass", ["biomass"], "#84cc16", "生質能、廢棄物（585）", "Biomass, waste (585)", "バイオマス・廃棄物（585）"),
];

const VOLT_CATS: readonly PhCat[] = [
  cat("735plus", ["735plus"], "#be123c", "735 kV 以上", "735 kV and above", "735 kV 以上"),
  cat("500", ["500"], "#ef4444", "500 kV", "500 kV", "500 kV"),
  cat("345", ["345"], "#f97316", "345 kV", "345 kV", "345 kV"),
  cat("220_287", ["220_287"], "#facc15", "220–287 kV", "220–287 kV", "220–287 kV"),
  cat("100_161", ["100_161"], "#38bdf8", "100–161 kV", "100–161 kV", "100–161 kV"),
  cat("lt100", ["lt100"], "#64748b", "100 kV 以下（z7 起）", "Below 100 kV (from z7)", "100 kV 未満（z7 以上）"),
  cat("dc", ["dc"], "#a78bfa", "直流（HVDC）", "Direct current (HVDC)", "直流（HVDC）"),
  cat("unknown", ["unknown"], "#94a3b8", "電壓未知（z7 起）", "Voltage unknown (from z7)", "電圧不明（z7 以上）"),
];
const VOLT_WIDTH: Record<string, readonly [number, number]> = {
  "735plus": [2, 3.2], "500": [1.8, 3], "345": [1.4, 2.4], "220_287": [1.1, 2], "100_161": [0.7, 1.4], lt100: [0.5, 1.1], dc: [1.4, 2.4], unknown: [0.5, 1.1],
};

const OG_FAC_CATS: readonly PhCat[] = [
  cat("refinery", ["refinery"], "#ef4444", "煉油廠（132）", "Petroleum refinery (132)", "製油所（132）", { parts: ["us-oil-gas-facilities-circle"], radius: 5 }),
  cat("gas_processing", ["gas_processing"], "#f59e0b", "天然氣處理廠（478）", "Natural gas processing plant (478)", "天然ガス処理プラント（478）", { parts: ["us-oil-gas-facilities-circle"], radius: 3.5 }),
  cat("lng", ["lng"], "#22d3ee", "LNG 進出口站（8）", "LNG import / export terminal (8)", "LNG 輸出入基地（8）", { parts: ["us-oil-gas-facilities-circle"], radius: 6 }),
  cat("platform", ["platform"], "#e879f9", "外海鑽井平台（1,303）", "Offshore platform (1,303)", "海洋プラットフォーム（1,303）", { parts: ["us-oil-gas-facilities-circle"], radius: 3 }),
  cat("well", ["well"], "#94a3b8", "外海油氣井（56,495，z6 起）", "Offshore well (56,495, from z6)", "海洋油ガス井（56,495、z6 以上）", { parts: ["us-oil-gas-wells-circle"] }),
  cat("ng_interstate", ["ng_interstate"], "#fb923c", "天然氣州際管線", "Interstate natural gas pipeline", "天然ガス州際パイプライン", { parts: ["us-oil-gas-pipelines-line"] }),
  cat("ng_intrastate", ["ng_intrastate", "ng_other"], "#fdba74", "天然氣州內管線", "Intrastate natural gas pipeline", "天然ガス州内パイプライン", { parts: ["us-oil-gas-pipelines-line"] }),
  cat("hgl", ["hgl"], "#a3e635", "液態烴（HGL）管線", "Hydrocarbon gas liquids pipeline", "炭化水素ガス液（HGL）パイプライン", { parts: ["us-oil-gas-pipelines-line"] }),
  cat("ocs", ["ocs"], "#c084fc", "外海油氣管線（OCS）", "Offshore oil & gas pipeline (OCS)", "海洋油ガスパイプライン（OCS）", { parts: ["us-oil-gas-pipelines-line"] }),
];
const OG_KIND_MAP: Record<string, L3> = {
  refinery: l3("煉油廠", "Petroleum refinery", "製油所"), gas_processing: l3("天然氣處理廠", "Natural gas processing plant", "天然ガス処理プラント"),
  lng: l3("LNG 進出口站", "LNG terminal", "LNG 基地"), platform: l3("外海鑽井平台", "Offshore platform", "海洋プラットフォーム"), well: l3("外海油氣井", "Offshore well", "海洋油ガス井"),
  ng_interstate: l3("天然氣州際管線", "Interstate gas pipeline", "天然ガス州際パイプライン"), ng_intrastate: l3("天然氣州內管線", "Intrastate gas pipeline", "天然ガス州内パイプライン"),
  ng_other: l3("天然氣管線（類別未標）", "Gas pipeline (type not stated)", "天然ガスパイプライン（種別不明）"), hgl: l3("液態烴管線", "HGL pipeline", "HGL パイプライン"), ocs: l3("外海油氣管線", "Offshore pipeline", "海洋パイプライン"),
};
const ORIGIN_MAP: Record<string, L3> = {
  hifld: l3("HIFLD 存檔 2025-08（原始 EIA）", "HIFLD archive 2025-08 (original EIA)", "HIFLD アーカイブ 2025-08（元 EIA）"),
  boem: l3("BOEM／BSEE（現行）", "BOEM / BSEE (current)", "BOEM／BSEE（現行）"),
};

/** 機場：商業客運（FAR 139）→ 港口 → 直升機場 → 其他航空 → 公用／私用機場。 */
const hubGetter: PhCatGetter = {
  expr: ["case", ["==", ["get", "hub"], "commercial"], "commercial", ["==", ["get", "kind"], "port"], "port", ["==", ["get", "kind"], "heliport"], "heliport",
    ["==", ["get", "kind"], "other"], "other_av", ["==", ["get", "use"], "public"], "public_airport", "private_airport"],
  js: (p) => str(p.hub) === "commercial" ? "commercial" : str(p.kind) === "port" ? "port" : str(p.kind) === "heliport" ? "heliport"
    : str(p.kind) === "other" ? "other_av" : str(p.use) === "public" ? "public_airport" : "private_airport",
};
const HUB_CATS: readonly PhCat[] = [
  cat("commercial", ["commercial"], "#f472b6", "商業客運機場（FAR 139，505）", "Commercial service airport (FAR 139, 505)", "商業旅客空港（FAR 139、505）", { radius: 5.5 }),
  cat("port", ["port"], "#38bdf8", "主要港口（USACE 前 150 大，145）", "Principal port (USACE top 150, 145)", "主要港湾（USACE 上位 150、145）", { radius: 5 }),
  cat("public_airport", ["public_airport"], "#fbbf24", "其他公用機場", "Other public-use airport", "その他公共用空港", { radius: 3 }),
  cat("private_airport", ["private_airport"], "#a8a29e", "私用機場、跑道（預設不開）", "Private-use airport / airstrip (off by default)", "私用空港・滑走路（既定で非表示）", { radius: 2.2 }),
  cat("heliport", ["heliport"], "#a78bfa", "直升機場（5,663，預設不開）", "Heliport (5,663, off by default)", "ヘリポート（5,663、既定で非表示）", { radius: 2.2 }),
  cat("other_av", ["other_av"], "#94a3b8", "滑翔、熱氣球、超輕航空場（711，預設不開）", "Glider, balloon, ultralight field (711, off by default)", "グライダー・気球・超軽量機場（711、既定で非表示）", { radius: 2.2 }),
];
const HUB_KIND_MAP: Record<string, L3> = { airport: l3("機場", "Airport", "空港"), heliport: l3("直升機場", "Heliport", "ヘリポート"), other: l3("其他航空場", "Other airfield", "その他の飛行場"), port: l3("港口", "Port", "港湾") };

const STATION_CATS: readonly PhCat[] = [
  cat("amtrak", ["amtrak"], "#ef4444", "Amtrak 城際鐵路站（1,022）", "Amtrak station (1,022)", "Amtrak 駅（1,022）", { radius: 4.5 }),
  cat("subway", ["subway"], "#f472b6", "地鐵、捷運站", "Subway / metro", "地下鉄・メトロ", { radius: 3.2 }),
  cat("rail", ["rail"], "#fb923c", "通勤鐵路站", "Commuter rail", "通勤鉄道", { radius: 3.2 }),
  cat("light_rail", ["light_rail"], "#a78bfa", "輕軌、路面電車、纜車", "Light rail / streetcar / cable car", "ライトレール・路面電車・ケーブルカー", { radius: 2.8 }),
  cat("ferry", ["ferry"], "#38bdf8", "渡輪碼頭", "Ferry", "フェリー", { radius: 3.2 }),
  cat("bus", ["bus"], "#f59e0b", "公車站（555,233，z9 起）", "Bus stop (555,233, from z9)", "バス停（555,233、z9 以上）", { radius: 1.8 }),
  cat("other", ["other"], "#94a3b8", "未標運具的站（z9 起）", "Mode not stated (from z9)", "モード不明（z9 以上）", { radius: 1.8 }),
];
const STATION_MODE_MAP = Object.fromEntries(STATION_CATS.map((c) => [c.id, l3(c.label.zh.replace(/（.*）$/, ""), c.label.en.replace(/ \(.*\)$/, ""), c.label.ja.replace(/（.*）$/, ""))]));

const RAIL_CATS: readonly PhCat[] = [
  cat("main", ["main"], "#a78bfa", "幹線（z3 起）", "Main line (from z3)", "幹線（z3 以上）"),
  cat("transit", ["transit"], "#f472b6", "都市軌道（z7 起）", "Transit (from z7)", "都市鉄道（z7 以上）"),
  cat("branch", ["spur", "industrial", "yard"], "#818cf8", "支線、工業線、調車場（z7 起）", "Spur, industrial, yard (from z7)", "支線・工業線・操車場（z7 以上）"),
  cat("other", ["other"], "#94a3b8", "其他（z7 起）", "Other (from z7)", "その他（z7 以上）"),
  cat("inactive", ["out_of_service", "abandoned", "rail_trail"], "#57534e", "停駛、廢線、鐵道步道（預設不開）", "Out of service, abandoned, rail-trail (off by default)", "休止・廃線・レールトレイル（既定で非表示）"),
];
const RAIL_WIDTH: Record<string, readonly [number, number]> = { main: [1, 2], transit: [0.8, 1.6], branch: [0.6, 1.2], other: [0.6, 1.2], inactive: [0.5, 1] };
const NET_MAP: Record<string, L3> = {
  main: l3("幹線", "Main line", "幹線"), transit: l3("都市軌道", "Transit", "都市鉄道"), spur: l3("支線", "Spur", "支線"), industrial: l3("工業線", "Industrial", "工業線"),
  yard: l3("調車場", "Yard", "操車場"), other: l3("其他", "Other", "その他"), out_of_service: l3("停駛", "Out of service", "休止"), abandoned: l3("廢線", "Abandoned", "廃線"), rail_trail: l3("鐵道步道", "Rail-trail", "レールトレイル"),
};
const railGetter: PhCatGetter = {
  expr: ["match", ["to-string", ["coalesce", ["get", "net"], ""]], ["spur", "industrial", "yard"], "branch", ["out_of_service", "abandoned", "rail_trail"], "inactive", ["main"], "main", ["transit"], "transit", "other"],
  js: (p) => { const v = str(p.net); return ["spur", "industrial", "yard"].includes(v) ? "branch" : ["out_of_service", "abandoned", "rail_trail"].includes(v) ? "inactive" : v === "main" || v === "transit" ? v : "other"; },
};

const ROAD_CATS: readonly PhCat[] = [
  cat("interstate", ["interstate"], "#ef4444", "州際公路（z3 起）", "Interstate (from z3)", "州間高速道路（z3 以上）"),
  cat("freeway", ["freeway"], "#f97316", "其他高速、快速道路（z6 起）", "Other freeway / expressway (from z6)", "その他の高速・自動車専用道路（z6 以上）"),
  cat("principal_arterial", ["principal_arterial"], "#facc15", "主要幹道（z6 起）", "Principal arterial (from z6)", "主要幹線道路（z6 以上）"),
  cat("other", ["other"], "#94a3b8", "其他 NHS 路段（z6 起）", "Other NHS segment (from z6)", "その他の NHS 区間（z6 以上）"),
];
const ROAD_WIDTH: Record<string, readonly [number, number]> = { interstate: [1.2, 2.6], freeway: [1, 2], principal_arterial: [0.6, 1.4], other: [0.5, 1.1] };
const ROAD_CLASS_MAP = Object.fromEntries(ROAD_CATS.map((c) => [c.id, l3(c.label.zh.replace(/（.*）$/, ""), c.label.en.replace(/ \(.*\)$/, ""), c.label.ja.replace(/（.*）$/, ""))]));
const SIGN_TYPE_MAP: Record<string, L3> = {
  interstate: l3("州際公路", "Interstate", "州間高速道路"), us_route: l3("美國國道（US Route）", "U.S. Route", "US ルート"), state_route: l3("州道", "State route", "州道"),
  county: l3("郡道", "County road", "郡道"), township: l3("鎮道", "Township road", "タウンシップ道"), municipal: l3("市道", "Municipal road", "市道"),
};

const WELL_STATUS_CATS: readonly PhCat[] = [
  cat("active", ["active"], "#22c55e", "使用中（生產、注入、完井）", "Active (producing, injection, completed)", "稼働（生産・圧入・完成）"),
  cat("inactive", ["inactive"], "#facc15", "停用（關井、暫時棄置）", "Inactive (shut-in, temporarily abandoned)", "休止（閉井・一時放棄）"),
  cat("permitted", ["permitted"], "#38bdf8", "已核准、鑽井中", "Permitted / drilling", "許可済み・掘削中"),
  cat("plugged", ["plugged"], "#64748b", "封井、棄置、乾井", "Plugged / abandoned / dry hole", "閉塞・放棄・空井戸"),
  cat("not_drilled", ["not_drilled"], "#475569", "未鑽（許可過期、撤回）", "Not drilled (permit expired / withdrawn)", "未掘削（許可失効・取消）"),
];

const BRAND_CATS: readonly PhCat[] = [
  cat("shell", ["shell"], "#facc15", "Shell", "Shell", "Shell"),
  cat("exxon", ["exxon"], "#ef4444", "ExxonMobil（Exxon、Mobil）", "ExxonMobil (Exxon, Mobil)", "ExxonMobil（Exxon・Mobil）"),
  cat("chevron", ["chevron"], "#38bdf8", "Chevron、Texaco", "Chevron, Texaco", "Chevron・Texaco"),
  cat("bp", ["bp"], "#22c55e", "BP、Amoco", "BP, Amoco", "BP・Amoco"),
  cat("marathon", ["marathon"], "#f97316", "Marathon、Speedway、ARCO", "Marathon, Speedway, ARCO", "Marathon・Speedway・ARCO"),
  cat("sunoco_family", ["sunoco_family"], "#c084fc", "Sunoco、Citgo、Valero、Phillips 66 系", "Sunoco, Citgo, Valero, Phillips 66 family", "Sunoco・Citgo・Valero・Phillips 66 系"),
  cat("chain", ["chain"], "#2dd4bf", "便利商店、量販、卡車休息站系", "Convenience / warehouse / truck-stop chains", "コンビニ・量販・トラックストップ系"),
];

// ═════════════════════════ 規格 ═════════════════════════

const loading = (zh: string, en: string, ja: string) => l3(zh, en, ja);
export const US_DATA_SPECS: readonly UsLayerSpec[] = [
  {
    key: "usPowerPlants", file: "us_power_plants.pmtiles", sourceId: "us-power-plants", srcMinzoom: 3, srcMaxzoom: 10, color: "#F2622E", count: 14_325,
    parts: [point("us-power-plants-circle", "plants", 3, propGetter("fuel"), { size: CAPACITY_BANDS })],
    cats: PLANT_CATS, otherColor: "#94a3b8", otherLabel: l3("其他（47）", "Other (47)", "その他（47）"),
    sizeLegend: [CAPACITY_BANDS],
    title: { props: ["name"], fallback: l3("電廠", "Power plant", "発電所") },
    fields: [
      { prop: "fuel", label: l3("主要能源（最大容量）", "Primary fuel (largest capacity)", "主燃料（最大容量）"), map: FUEL_LABELS },
      { prop: "fuels_mix", label: l3("全部能源", "All fuels", "全燃料"), kind: "code" },
      { prop: "capacity_mw", label: l3("裝置容量（運轉中機組）", "Capacity (operable units)", "設備容量（運転中ユニット）"), kind: "num", unit: "MW", digits: 1 },
      { prop: "n_generators", label: l3("機組數", "Generators", "ユニット数"), kind: "num" },
      { prop: "technology", label: l3("技術", "Technology", "技術") },
      { prop: "first_year", label: l3("最早商轉年", "First operating year", "最初の運転開始年"), kind: "year" },
      { prop: "utility_name", label: l3("事業者", "Utility", "事業者") },
      { prop: "sector", label: l3("部門", "Sector", "部門") },
      { prop: "balancing_authority", label: l3("調度區（BA）", "Balancing authority", "需給調整区域（BA）"), kind: "code" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("EIA-860 2025 年版運轉中電廠 14,325 座（≥1 MW）；顏色＝容量最大的能源", "EIA-860 2025 operable plants, 14,325 (≥1 MW); colour = fuel with the largest capacity", "EIA-860 2025 年版の運転中発電所 14,325（≥1 MW）。色＝容量最大の燃料"),
      l3("容量級距：圓圈大小", "Capacity bands shown as circle size", "容量区分は円の大きさ"),
    ],
    popupNotes: [NEAREST], sourceOrg: "U.S. Energy Information Administration, Form EIA-860 (2025)", sourceUrl: "https://www.eia.gov/electricity/data/eia860/",
    license: US_LICENSE_PD, fetchedAt: US_FETCHED_AT, loading: loading("美國電廠載入中", "Loading U.S. power plants", "米国の発電所を読み込み中"),
  },
  {
    key: "usPowerGrid", file: "us_power_grid.pmtiles", sourceId: "us-power-grid", srcMinzoom: 3, srcMaxzoom: 12, color: "#62D9AD", count: 167_925,
    parts: [
      { id: "us-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 3, cat: propGetter("volt_class"), lineWidth: VOLT_WIDTH },
      point("us-power-substations-circle", "substations", 7, propGetter("volt_class"), { small: true }),
    ],
    cats: VOLT_CATS,
    title: { props: ["name", "owner"], fallback: l3("輸電線／變電所", "Transmission line / substation", "送電線／変電所") },
    fields: [
      { prop: "voltage_kv", label: l3("電壓", "Voltage", "電圧"), kind: "num", unit: "kV" },
      { prop: "line_type", label: l3("型式", "Type", "型式") },
      { prop: "status", label: l3("狀態", "Status", "状態") },
      { prop: "sub_1", label: l3("起點變電所", "From substation", "起点変電所") },
      { prop: "sub_2", label: l3("終點變電所", "To substation", "終点変電所") },
      { prop: "inferred", label: l3("推定路徑", "Inferred", "推定"), kind: "code" },
      { prop: "operator", label: l3("營運者（變電所）", "Operator (substation)", "運営者（変電所）") },
      { prop: "sub_kind", label: l3("變電所類型（OSM）", "Substation type (OSM)", "変電所種別（OSM）"), kind: "code" },
      { prop: "source_date", label: l3("來源日期", "Source date", "出典日"), kind: "code" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("HIFLD 輸電線 94,339 段（約 69 kV 以上）；z3–6 只畫 220 kV 以上與直流", "94,339 HIFLD transmission segments (about 69 kV and above); z3–6 shows only ≥220 kV and DC", "HIFLD 送電線 94,339 区間（約 69 kV 以上）。z3–6 は 220 kV 以上と直流のみ"),
      l3("變電所 73,586 處（z7 起）：官方無全國名冊，取自 Overture／OpenStreetMap（ODbL，非官方）；電壓取 OSM 標籤最高值，缺值歸「電壓未知」", "73,586 substations (from z7): no official national register, taken from Overture／OpenStreetMap (ODbL, unofficial); voltage is the highest OSM tag value, missing → unknown", "変電所 73,586 か所（z7 以上）：公式の全国名簿がないため Overture／OpenStreetMap（ODbL、非公式）から。電圧は OSM タグの最大値、欠損は「電圧不明」"),
      US_HIFLD_NOTE,
    ],
    popupNotes: [NEAREST], sourceOrg: "HIFLD Electric Power Transmission Lines (archive by SeerAI, CC BY 4.0)", sourceUrl: "https://source.coop/seerai/hifld",
    license: "輸電線 CC BY 4.0（HIFLD 存檔）；變電所 ODbL（© OpenStreetMap contributors，經 Overture）", fetchedAt: US_FETCHED_AT, sourceNotes: [US_HIFLD_NOTE],
    loading: loading("美國輸電網載入中", "Loading U.S. transmission lines", "米国の送電網を読み込み中"),
  },
  {
    key: "usRenewables", file: "us_renewables.pmtiles", sourceId: "us-renewables", srcMinzoom: 3, srcMaxzoom: 13, color: "#F2E085", count: 84_260, heat: { intensity: 3 },
    parts: [
      { id: "us-solar-fill", sourceLayer: "solar", geom: "fill", minzoom: 8, cat: constGetter("solar"), fillOpacity: 0.6 },
      point("us-solar-circle", "solar_points", 3, constGetter("solar")),
      point("us-wind-turbines-circle", "turbines", 4, constGetter("wind"), { small: true }),
    ],
    cats: [
      cat("solar", ["solar"], "#facc15", "大型太陽能場（USPVDB，6,611；z8 起畫範圍）", "Utility-scale solar (USPVDB, 6,611; footprints from z8)", "大規模太陽光（USPVDB、6,611。z8 以上で範囲）", { radius: 3.5 }),
      cat("wind", ["wind"], "#38bdf8", "風機（USWTDB，77,649；z4 起）", "Wind turbine (USWTDB, 77,649; from z4)", "風車（USWTDB、77,649。z4 以上）", { parts: ["us-wind-turbines-circle"] }),
    ],
    title: { props: ["name", "project"], fallback: l3("再生能源", "Renewables", "再生可能エネルギー") },
    fields: [
      { prop: "energy", label: l3("能源", "Energy", "エネルギー"), map: { solar: l3("太陽能", "Solar", "太陽光"), wind: l3("風力", "Wind", "風力") } },
      { prop: "capacity_mw_ac", label: l3("裝置容量（AC）", "Capacity (AC)", "設備容量（AC）"), kind: "num", unit: "MW", digits: 1 },
      { prop: "turbine_mw", label: l3("單機容量", "Turbine capacity", "単機容量"), kind: "num", unit: "MW", digits: 2 },
      { prop: "project_mw", label: l3("風場容量", "Project capacity", "ウィンドファーム容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "project_turbines", label: l3("風場機組數", "Turbines in project", "ウィンドファームの基数"), kind: "num" },
      { prop: "hub_height_m", label: l3("輪轂高度", "Hub height", "ハブ高"), kind: "num", unit: "m", digits: 1 },
      { prop: "rotor_diameter_m", label: l3("葉輪直徑", "Rotor diameter", "ロータ直径"), kind: "num", unit: "m", digits: 1 },
      { prop: "manufacturer", label: l3("製造商", "Manufacturer", "メーカー") },
      { prop: "model", label: l3("型號", "Model", "型式"), kind: "code" },
      { prop: "tech", label: l3("技術", "Technology", "技術") },
      { prop: "axis", label: l3("追日方式", "Tracking", "追尾方式") },
      { prop: "agrivoltaic", label: l3("農電共生", "Agrivoltaic", "営農型") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "area" },
      { prop: "year", label: l3("商轉年", "Operating year", "運転開始年"), kind: "year" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("USGS／LBNL 風機資料庫 v9.1、大型太陽能資料庫 v4.0（≥1 MW 地面型）；屋頂型太陽能不含", "USGS / LBNL Wind Turbine Database v9.1 and Large-Scale Solar PV Database v4.0 (≥1 MW ground-mounted); rooftop solar excluded", "USGS／LBNL 風車データベース v9.1・大規模太陽光 DB v4.0（≥1 MW 地上設置）。屋根置きは含まない"),
    ],
    popupNotes: [NEAREST], sourceOrg: "USGS／LBNL／ACP U.S. Wind Turbine Database v9.1；USGS／LBNL U.S. Large-Scale Solar PV Database v4.0", sourceUrl: "https://energy.usgs.gov/uswtdb/",
    license: US_LICENSE_PD, fetchedAt: US_FETCHED_AT, loading: loading("美國再生能源載入中", "Loading U.S. renewables", "米国の再生可能エネルギーを読み込み中"),
  },
  {
    key: "usOilGas", file: "us_oil_gas.pmtiles", sourceId: "us-oil-gas", srcMinzoom: 3, srcMaxzoom: 11, color: "#f97316", count: 107_582,
    parts: [
      { id: "us-oil-gas-pipelines-line", sourceLayer: "pipelines", geom: "line", minzoom: 3, cat: propGetter("kind"), lineWidth: { ng_interstate: [0.9, 1.8], ng_intrastate: [0.6, 1.2], hgl: [0.9, 1.8], ocs: [0.5, 1.1] } },
      point("us-oil-gas-wells-circle", "wells", 6, constGetter("well"), { small: true }),
      point("us-oil-gas-facilities-circle", "facilities", 3, propGetter("kind")),
    ],
    cats: OG_FAC_CATS,
    title: { props: ["name", "well_name"], fallback: l3("油氣設施", "Oil & gas facility", "石油・ガス施設"), fallbackBy: { prop: "kind", map: OG_KIND_MAP } },
    fields: [
      { prop: "kind", label: l3("類別", "Type", "種別"), map: OG_KIND_MAP },
      { prop: "company", label: l3("公司、營運者", "Company / operator", "会社・事業者") },
      { prop: "capacity", label: l3("處理量", "Capacity", "処理能力"), kind: "num", digits: 1 },
      { prop: "capacity_unit", label: l3("處理量單位", "Capacity unit", "処理能力の単位"), map: { Mbpd: l3("千桶／日", "thousand bbl/day", "千バレル／日"), MMcfd: l3("百萬立方英尺／日", "million cu ft/day", "百万立方フィート／日") } },
      { prop: "functions", label: l3("功能", "Functions", "機能") },
      { prop: "status", label: l3("狀態", "Status", "状態") },
      { prop: "well_type", label: l3("井別", "Well type", "井戸種別") },
      { prop: "api", label: l3("API 井號", "API number", "API 番号"), kind: "code" },
      { prop: "spud_date", label: l3("開鑽日", "Spud date", "掘削開始日"), kind: "code" },
      { prop: "install_date", label: l3("安裝日", "Install date", "設置日"), kind: "code" },
      { prop: "depth_ft", label: l3("井深", "Depth", "深度"), kind: "num", unit: "ft" },
      { prop: "segment_num", label: l3("管段編號", "Segment no.", "区間番号"), kind: "code" },
      { prop: "origin", label: l3("資料來源", "Source", "出典"), map: ORIGIN_MAP },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("陸上設施與管線為 HIFLD 存檔（原始 EIA，停在 2025-08）；外海平台、井、管線為 BOEM／BSEE 現行資料", "Onshore facilities and pipelines are the HIFLD archive (original EIA, frozen 2025-08); offshore platforms, wells and pipelines are current BOEM / BSEE data", "陸上施設・パイプラインは HIFLD アーカイブ（元 EIA、2025-08 停止）。海洋プラットフォーム・井戸・パイプラインは BOEM／BSEE の現行データ"),
      l3("陸域油氣井屬各州職權，另見「州油氣井」圖層；原油管線不在 HIFLD 存檔內", "Onshore wells are under state jurisdiction — see the \"State oil & gas wells\" layer; crude oil pipelines are not in the HIFLD archive", "陸上の油ガス井は州の所管（「州別油ガス井」レイヤー参照）。原油パイプラインは HIFLD アーカイブにない"),
    ],
    popupNotes: [NEAREST, OFFSHORE],
    sourceOrg: "HIFLD archive by SeerAI (CC BY 4.0; original EIA); BOEM／BSEE via MarineCadastre.gov", sourceUrl: "https://source.coop/seerai/hifld",
    license: l3("逐列：HIFLD 存檔 CC BY 4.0／BOEM 聯邦作品", "Per record: HIFLD archive CC BY 4.0 / BOEM U.S. Government Work", "レコード別：HIFLD アーカイブ CC BY 4.0／BOEM 連邦著作物"), fetchedAt: US_FETCHED_AT, sourceNotes: [US_HIFLD_NOTE],
    loading: loading("美國油氣設施載入中", "Loading U.S. oil & gas", "米国の石油・ガス施設を読み込み中"),
  },
  {
    key: "usTransportHubs", file: "us_transport_hubs.pmtiles", sourceId: "us-transport-hubs", srcMinzoom: 3, srcMaxzoom: 10, color: "#38bdf8", count: 19_092,
    parts: [point("us-hubs-circle", "hubs", 3, hubGetter)],
    cats: HUB_CATS, defaultCats: ["commercial", "port", "public_airport"],
    title: { props: ["name"], fallback: l3("交通樞紐", "Transport hub", "交通拠点"), fallbackBy: { prop: "kind", map: HUB_KIND_MAP } },
    fields: [
      { prop: "kind", label: l3("類別", "Type", "種別"), map: HUB_KIND_MAP },
      { prop: "faa_id", label: l3("FAA 代碼", "FAA ID", "FAA コード"), kind: "code" },
      { prop: "icao_id", label: l3("ICAO 代碼", "ICAO ID", "ICAO コード"), kind: "code" },
      { prop: "use", label: l3("用途", "Use", "用途"), map: { public: l3("公用", "Public use", "公共用"), private: l3("私用", "Private use", "私用") } },
      { prop: "ownership", label: l3("所有權", "Ownership", "所有"), map: { public: l3("公有", "Public", "公有"), private: l3("私有", "Private", "私有"), air_force: l3("空軍", "Air Force", "空軍"), navy: l3("海軍", "Navy", "海軍"), army: l3("陸軍", "Army", "陸軍"), coast_guard: l3("海岸防衛隊", "Coast Guard", "沿岸警備隊") } },
      { prop: "far139", label: l3("FAR 139 認證", "FAR 139 certificate", "FAR 139 認証"), kind: "code" },
      { prop: "city", label: l3("城市", "City", "都市") },
      { prop: "elev_ft", label: l3("標高", "Elevation", "標高"), kind: "num", unit: "ft" },
      { prop: "usace_rank", label: l3("USACE 貨運排名", "USACE tonnage rank", "USACE 貨物量順位"), kind: "num" },
      { prop: "tons_total", label: l3("貨運量（短噸）", "Total tonnage (short tons)", "貨物量（ショートトン）"), kind: "num" },
      { prop: "tons_foreign", label: l3("國際貨運量", "Foreign tonnage", "外国貨物量"), kind: "num" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("FAA 營運中航空設施 18,947（私用占多數，預設只開商業客運、公用機場與港口）＋USACE 主要港口 145", "18,947 operating FAA aviation facilities (mostly private; default shows commercial, public airports and ports) + 145 USACE principal ports", "FAA 運用中の航空施設 18,947（大半が私用。既定は商業・公共用空港と港湾）＋USACE 主要港湾 145"),
    ],
    popupNotes: [NEAREST], sourceOrg: "FAA NASR via BTS NTAD (Aviation Facilities); U.S. Army Corps of Engineers (Principal Ports)", sourceUrl: "https://geodata.bts.gov/",
    license: US_LICENSE_PD, fetchedAt: US_FETCHED_AT, loading: loading("美國機場與港口載入中", "Loading U.S. airports and ports", "米国の空港・港湾を読み込み中"),
  },
  {
    key: "usStations", file: "us_stations.pmtiles", sourceId: "us-stations", srcMinzoom: 5, srcMaxzoom: 11, color: "#f59e0b", count: 582_087,
    parts: [point("us-stations-circle", "stops", 5, propGetter("mode"))],
    cats: STATION_CATS,
    title: { props: ["name"], fallback: l3("大眾運輸站", "Transit stop", "公共交通の停留所") },
    fields: [
      { prop: "mode", label: l3("運具", "Mode", "モード"), map: STATION_MODE_MAP },
      { prop: "mode_text", label: l3("運具（原文）", "Mode (source)", "モード（原文）"), kind: "code" },
      { prop: "stop_code", label: l3("站碼", "Stop code", "停留所コード"), kind: "code" },
      { prop: "station", label: l3("車站（含多個月台）", "Station (parent)", "駅（親）"), map: { station: l3("是", "Yes", "はい") } },
      { prop: "wheelchair", label: l3("輪椅可上下", "Wheelchair boarding", "車いす乗降"), map: { yes: l3("可", "Yes", "可"), no: l3("不可", "No", "不可") } },
      { prop: "ntd_id", label: l3("業者（NTD ID）", "Agency (NTD ID)", "事業者（NTD ID）"), kind: "code" },
      { prop: "city", label: l3("城市", "City", "都市") },
      { prop: "download_date", label: l3("GTFS 下載日", "GTFS download date", "GTFS 取得日"), kind: "code" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("BTS National Transit Map（各業者 GTFS 彙整）＋Amtrak 車站；公車站 55 萬處 z9 起才出現", "BTS National Transit Map (agency GTFS) + Amtrak stations; 555,000 bus stops appear from z9", "BTS National Transit Map（事業者 GTFS 集約）＋Amtrak 駅。バス停 55 万件は z9 以上"),
      l3("未上傳 GTFS 的業者沒有資料（未涵蓋，不是沒有站）", "Agencies that did not submit GTFS have no data (not covered, not absent)", "GTFS 未提出の事業者はデータなし（未収録で、停留所がないわけではない）"),
    ],
    popupNotes: [NEAREST], sourceOrg: "BTS National Transit Map Stops (CC BY 3.0 US; transit agency GTFS); BTS NTAD Amtrak Stations", sourceUrl: "https://geodata.bts.gov/",
    license: l3("逐列：NTM CC BY 3.0 US／Amtrak 公有領域", "Per record: NTM CC BY 3.0 US / Amtrak public domain", "レコード別：NTM CC BY 3.0 US／Amtrak パブリックドメイン"), fetchedAt: US_FETCHED_AT,
    loading: loading("美國大眾運輸站載入中", "Loading U.S. transit stops", "米国の公共交通停留所を読み込み中"),
  },
  {
    key: "usRailLines", file: "us_rail_lines.pmtiles", sourceId: "us-rail-lines", srcMinzoom: 3, srcMaxzoom: 12, color: "#a78bfa", count: 235_645,
    parts: [{ id: "us-rail-lines-line", sourceLayer: "rail", geom: "line", minzoom: 3, cat: railGetter, lineWidth: RAIL_WIDTH }],
    cats: RAIL_CATS, defaultCats: ["main", "transit", "branch", "other"],
    title: { props: ["owner"], fallback: l3("鐵路", "Railway", "鉄道") },
    fields: [
      { prop: "net", label: l3("路網分類", "Network", "路線区分"), map: NET_MAP },
      { prop: "owner", label: l3("所有鐵路公司", "Owner", "所有鉄道会社"), kind: "code" },
      { prop: "trackage_rights", label: l3("通行權公司", "Trackage rights", "線路使用権"), kind: "code" },
      { prop: "passenger", label: l3("客運", "Passenger", "旅客"), kind: "code" },
      { prop: "tracks", label: l3("股道數", "Tracks", "線路数"), kind: "num" },
      { prop: "stracnet", label: l3("國防鐵路網（STRACNET）", "STRACNET", "国防鉄道網（STRACNET）"), kind: "code" },
      { prop: "yard", label: l3("調車場", "Yard", "操車場") },
      { prop: "miles", label: l3("段長", "Segment length", "区間長"), kind: "num", unit: "mi", digits: 2 },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [l3("FRA 北美鐵路網 235,645 段；z3–6 只畫幹線", "FRA North American Rail Network, 235,645 segments; z3–6 shows main lines only", "FRA 北米鉄道網 235,645 区間。z3–6 は幹線のみ")],
    popupNotes: [], sourceOrg: "FRA North American Rail Network Lines (via BTS NTAD)", sourceUrl: "https://geodata.bts.gov/datasets/usdot::north-american-rail-network-lines",
    license: US_LICENSE_PD, fetchedAt: US_FETCHED_AT, loading: loading("美國鐵路網載入中", "Loading U.S. rail network", "米国の鉄道網を読み込み中"),
  },
  {
    key: "usHighways", file: "us_highways.pmtiles", sourceId: "us-highways", srcMinzoom: 3, srcMaxzoom: 12, color: "#ef4444", count: 482_407,
    parts: [{ id: "us-highways-line", sourceLayer: "roads", geom: "line", minzoom: 3, cat: propGetter("road_class"), lineWidth: ROAD_WIDTH }],
    cats: ROAD_CATS,
    title: { props: ["sign", "name"], fallback: l3("國家公路系統", "National Highway System", "国家道路網") },
    fields: [
      { prop: "name", label: l3("路名", "Name", "道路名"), unlessSameAs: "sign" },
      { prop: "road_class", label: l3("功能分類", "Functional class", "機能分類"), map: ROAD_CLASS_MAP },
      { prop: "sign_type", label: l3("路線系統", "Route system", "路線系統"), map: SIGN_TYPE_MAP },
      { prop: "lanes", label: l3("直行車道數", "Through lanes", "直進車線数"), kind: "num" },
      { prop: "speed_limit_mph", label: l3("速限", "Speed limit", "制限速度"), kind: "num", unit: "mph" },
      { prop: "aadt", label: l3("年平均日交通量（AADT）", "AADT", "年平均日交通量（AADT）"), kind: "num" },
      { prop: "aadt_truck", label: l3("貨車 AADT", "Truck AADT", "トラック AADT"), kind: "num" },
      { prop: "data_year", label: l3("交通量年份", "Data year", "交通量の年"), kind: "year" },
      { prop: "miles", label: l3("段長", "Segment length", "区間長"), kind: "num", unit: "mi", digits: 2 },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [l3("FHWA 國家公路系統（NHS，2025-08 版）；z3–5 只畫州際公路；交通量為各州回報年份，非同一年", "FHWA National Highway System (2025-08); z3–5 shows Interstates only; traffic counts are from each state's reporting year", "FHWA 国家道路網（NHS、2025-08 版）。z3–5 は州間高速のみ。交通量は州ごとの報告年")],
    popupNotes: [], sourceOrg: "FHWA National Highway System (via BTS NTAD)", sourceUrl: "https://geodata.bts.gov/datasets/usdot::national-highway-system",
    license: US_LICENSE_PD, fetchedAt: US_FETCHED_AT, loading: loading("美國國家公路系統載入中", "Loading U.S. National Highway System", "米国の国家道路網を読み込み中"),
  },
  {
    key: "usStateWells", file: "us_state_wells.pmtiles", sourceId: "us-state-wells", srcMinzoom: 6, srcMaxzoom: 12, color: "#d97706", count: 2_216_726,
    parts: [point("us-state-wells-circle", "wells", 6, propGetter("status_class"), { small: true })],
    cats: WELL_STATUS_CATS, otherColor: "#94a3b8", otherLabel: l3("其他、狀態不明", "Other / unknown status", "その他・状態不明"),
    defaultCats: ["active", "inactive", "permitted"],
    title: { props: ["operator"], fallback: l3("油氣井", "Oil / gas well", "石油・ガス井") },
    fields: [
      { prop: "src_state", label: l3("資料來源州", "Source state", "出典州"), kind: "code" },
      { prop: "status_text", label: l3("狀態（州原文）", "Status (state wording)", "状態（州の原文）") },
      { prop: "well_type", label: l3("井別（州原文）", "Well type (state wording)", "井戸種別（州の原文）") },
      { prop: "api", label: l3("API 井號／許可號", "API / permit number", "API 番号・許可番号"), kind: "code" },
      { prop: "date", label: l3("日期（開鑽或完井，依州）", "Date (spud or completion, by state)", "日付（掘削開始または完成、州による）"), kind: "code" },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [
      l3("州子層：AK、AR、CA、FL、ID、IL、KS、KY、MO、MT、NV、OH、OK、PA、UT、VA、WA、WY 共 18 州；其他州未涵蓋（不是沒有井）", "State sub-layers: AK, AR, CA, FL, ID, IL, KS, KY, MO, MT, NV, OH, OK, PA, UT, VA, WA, WY (18 states); other states not covered (not \"no wells\")", "州サブレイヤー：AK, AR, CA, FL, ID, IL, KS, KY, MO, MT, NV, OH, OK, PA, UT, VA, WA, WY (18 states)。その他の州は未収録（井戸がないわけではない）"),
      l3("每州各自來源與日期；狀態依各州原文以關鍵字歸類，原文在彈窗；預設只開使用中、停用、已核准", "Each state has its own source and date; status is grouped from each state's wording (original in popup); by default only active, inactive and permitted are shown", "州ごとに出典・日付が異なる。状態は州の原文からキーワードで分類（原文はポップアップ）。既定は稼働・休止・許可のみ表示"),
      l3("伊利諾、堪薩斯的狀態是州的井分類（含歷史分類），不一定是現況；奧克拉荷馬有 15,098 口沒有座標未收", "Illinois and Kansas statuses are the state's well classification (partly historical), not necessarily current; 15,098 Oklahoma wells have no coordinates and are omitted", "イリノイ・カンザスの状態は州の井戸分類（履歴を含む）で現況とは限らない。オクラホマの座標なし 15,098 本は未収録"),
      l3("授權未明示（各州服務未載明）；不收井名與地主名", "License not stated by the state services; well and landowner names are omitted", "ライセンス未明示（州のサービスに記載なし）。井戸名・地主名は収録しない"),
    ],
    popupNotes: [NEAREST], sourceOrg: "State oil and gas regulators (AOGCC, AOGC, CalGEM, FDEP, IDL, ISGS, KGS, KY EEC, MGS, MBOGC, NDOM, ODNR, OCC, PA DEP, UT DOGM, VA DGO, WA DNR, WOGCC)", sourceUrl: "https://github.com/ianlkl11234s/taipei-gis-analytics/blob/master/docs/topic-research/united_states_opendata/states/state_matrix.csv",
    license: l3("授權未明示（各州）", "License not stated (per state)", "ライセンス未明示（州ごと）"), fetchedAt: US_FETCHED_AT,
    loading: loading("美國州油氣井載入中", "Loading U.S. state oil & gas wells", "米国の州別油ガス井を読み込み中"),
  },
  {
    key: "usFuelStations", file: "us_fuel_stations.pmtiles", sourceId: "us-fuel-stations", srcMinzoom: 6, srcMaxzoom: 12, color: "#F2622E", count: 170_712,
    parts: [point("us-fuel-stations-circle", "stations", 6, propGetter("brand_group"), { small: true })],
    cats: BRAND_CATS, otherColor: "#94a3b8", otherLabel: l3("其他品牌、未標品牌", "Other / unbranded", "その他・ブランド不明"),
    title: { props: ["name", "brand"], fallback: l3("加油站", "Gas station", "ガソリンスタンド") },
    fields: [
      { prop: "brand", label: l3("品牌", "Brand", "ブランド") },
      { prop: "category", label: l3("類別", "Category", "種別"), map: { gas_station: l3("加油站", "Gas station", "ガソリンスタンド"), fueling_station: l3("加油站", "Fueling station", "給油所"), truck_gas_station: l3("卡車加油站", "Truck stop", "トラック給油所") } },
      { prop: "locality", label: l3("城市", "City", "都市") },
      { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
      ...COUNTY_FIELDS,
    ],
    legendNotes: [l3("Overture Places（Meta、Microsoft 等彙整，非官方）；z6 起顯示", "Overture Places (aggregated from Meta, Microsoft, etc.; unofficial); from z6", "Overture Places（Meta・Microsoft 等の集約、非公式）。z6 以上")],
    popupNotes: [NEAREST], sourceOrg: "Overture Maps Foundation Places (release 2026-11-18.0)", sourceUrl: "https://overturemaps.org/",
    license: "CDLA-Permissive-2.0", fetchedAt: US_FETCHED_AT, loading: loading("美國加油站載入中", "Loading U.S. gas stations", "米国のガソリンスタンドを読み込み中"),
  },
];
export const US_SPEC_BY_KEY: Readonly<Record<UsDataKey, UsLayerSpec>> = Object.fromEntries(US_DATA_SPECS.map((s) => [s.key, s])) as Record<UsDataKey, UsLayerSpec>;

// ═════════════════════════ 圖層來源表（「說明・來源」） ═════════════════════════

const st = (t: string | L3) => (typeof t === "string" ? t : { "zh-TW": t.zh, en: t.en, ja: t.ja });
const srcRow = (org: string | L3, license: string | L3, url: string, notes?: readonly L3[]): LayerSourceInfo => ({
  org: st(org), license: st(license), url, asOf: US_FETCHED_AT, ...(notes?.length ? { notes: notes.map((n) => st(n) as never) } : {}), from: "popup",
});
/** 美國各層來源表；layerSourceInfo.data.ts 展開進總表。 */
export const US_SOURCE_INFO: Record<string, LayerSourceInfo> = {
  usAdminBoundaries: srcRow("U.S. Census Bureau, Cartographic Boundary Files 2025 (1:500,000)", US_LICENSE_PD, "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html", [...US_ADMIN_NOTES]),
  usPopulation: srcRow("U.S. Census Bureau, American Community Survey 2020–2024 5-year estimates (B01003); Cartographic Boundary Files 2025／2024", US_LICENSE_PD, "https://www.census.gov/programs-surveys/acs/data/summary-file.html", [...US_POPULATION_NOTES]),
  ...Object.fromEntries(US_DATA_SPECS.map((sp) => [sp.key, srcRow(sp.sourceOrg, sp.license, sp.sourceUrl, sp.sourceNotes)])),
};
