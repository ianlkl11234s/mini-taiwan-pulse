/**
 * 加拿大第 3 波（環境氣候、災害：全國官方點位子集）＋人口網格：色票、分類、署名、popup 欄位 SSOT。
 * hook（`hooks/useCaEnvLayers.ts`）、圖例（`legend/caEnvLegends.tsx`）、popup（`featureInfo/caEnvPanels.tsx`）三邊共用。
 *
 * 資料與授權原句見 taipei-gis-analytics `docs/data-catalog/{weather,environment,hazards,world}/ca_*.md`、
 * `ghsl_pop_h3_ca.md` 與 `docs/topic-research/canada_opendata/waves/w3/layer-plan.md`（2026-11-06）。
 * 色票沿用台灣同語意圖層（氣象站、空品站、環境輻射、污染申報、地震、污水設施），不另造色。
 * 涵蓋寫 n/13 省／地區，未涵蓋的省份寫「未涵蓋」（不補 0）。
 */
import { STATISTICS_SEQUENTIAL_SCHEMES as SEQ } from "./statisticsVisuals";
import type { CaCat, CaField, CaPopupSpec, CaSource, L3 } from "./caInfraTypes";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const OGL = "Open Government Licence – Canada";
const OGL_SOURCE = (org: string, url: string): CaSource => ({ org, url, license: OGL, short: `© ${org}（OGL–Canada）` });
/** ECCC MSC GeoMet（api.weather.gc.ca）不是 OGL，是 ECCC Data Services End-use Licence（可商用、須署名）。 */
const MSC_LICENSE = "ECCC Data Services End-use Licence";
const MSC_SOURCE = (what: string, url: string): CaSource => ({
  org: `Environment and Climate Change Canada, MSC GeoMet（${what}）`, url, license: MSC_LICENSE,
  short: `Data Source: Environment and Climate Change Canada（${what}；ECCC Data Services End-use Licence）`,
});
const PROVINCE: CaField = { prop: "province", label: l3("省／地區", "Province / territory", "州・準州") };

export const CA_ENV_FETCHED_AT = "2026-11-06";

// ─────────────────────────── 氣象站（C095 MSC climate-stations） ───────────────────────────

export const CA_CLIMATE_COUNT = 8_435;
/** 狀態：active＝HLY／DLY／整體最後資料日在 2026 年（1,160 站），其餘為歷史站（7,275）。 */
export const CA_CLIMATE_STATUSES: readonly CaCat[] = [
  { id: "active", values: ["active"], color: "#4dd0e1", label: l3("現役（2026 年仍有資料，1,160）", "Active (data in 2026, 1,160)", "現役（2026 年にデータあり、1,160）") },
  { id: "historical", values: ["historical"], color: "#94a3b8", label: l3("歷史站（7,275）", "Historical (7,275)", "廃止・過去局（7,275）") },
];
export const CA_CLIMATE_SOURCE = MSC_SOURCE("climate-stations", "https://api.weather.gc.ca/collections/climate-stations");
export const CA_CLIMATE_NOTES: readonly L3[] = [
  l3("站點名冊（含已停用的歷史站），不含觀測值；涵蓋 13/13 省／地區", "Station register incl. closed stations; no observations; 13/13 provinces & territories", "観測所台帳（廃止局を含む）、観測値なし。13/13 州・準州"),
];
export const CA_CLIMATE_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("氣象站", "Climate station", "気象観測所") },
  fields: [
    { prop: "status", label: l3("狀態", "Status", "状態"), map: Object.fromEntries(CA_CLIMATE_STATUSES.map((c) => [c.id, c.label])) },
    { prop: "climate_id", label: l3("氣候站代碼", "Climate ID", "Climate ID"), kind: "code" },
    { prop: "wmo_id", label: l3("WMO 代碼", "WMO ID", "WMO 番号"), kind: "code" },
    { prop: "elevation_m", label: l3("海拔", "Elevation", "標高"), kind: "num", unit: "m", digits: 1 },
    { prop: "first_date", label: l3("最早資料日", "First data", "観測開始"), kind: "code" },
    { prop: "last_date", label: l3("最後資料日", "Last data", "最終データ"), kind: "code" },
    { prop: "has_hourly", label: l3("有逐時資料", "Hourly data", "毎時データ"), kind: "bool" },
    PROVINCE,
  ],
};

// ─────────────────────────── AQHI 空品健康指數地點（C096） ───────────────────────────

export const CA_AQHI_COLOR = "#00bcd4";
export const CA_AQHI_SOURCE = MSC_SOURCE("aqhi-stations", "https://api.weather.gc.ca/collections/aqhi-stations");
export const CA_AQHI_NOTES: readonly L3[] = [
  l3("134 處 AQHI 發布地點（社區／區域代表點，不是單一監測站）；不含即時指數", "134 AQHI locations (community/region points, not single monitors); no live index", "AQHI 発表地点 134 か所（地域代表点、単一の測定局ではない）。リアルタイム値なし"),
  l3("Québec 只有 3 處（省府另行發布 AQHI），涵蓋偏弱", "Québec has only 3 locations (the province publishes its own index)", "ケベック州は 3 か所のみ（州が独自に発表）"),
];
export const CA_AQHI_POPUP: CaPopupSpec = {
  title: { props: ["name_en", "name_fr"], fallback: l3("AQHI 地點", "AQHI location", "AQHI 地点") },
  fields: [
    { prop: "name_fr", label: l3("法文名", "French name", "フランス語名") },
    { prop: "uid", label: l3("地點代碼", "Location ID", "地点コード"), kind: "code" },
    { prop: "zone_name_en", label: l3("ECCC 區域", "ECCC region", "ECCC 地域") },
    PROVINCE,
  ],
};

// ─────────────────────────── 輻射監測站（C076 Health Canada CRMN） ───────────────────────────

/** 同台灣環境輻射（nuscGammaRadiation）與英國加馬劑量的色。 */
export const CA_RADIATION_COLOR = SEQ.education.colors[3]!;
export const CA_RADIATION_SOURCE = OGL_SOURCE("Health Canada, Canadian Radiological Monitoring Network（CRMN）", "https://open.canada.ca/data/en/dataset/d256b422-2834-40a2-9f0c-bd5fc32781b2");
export const CA_RADIATION_NOTES: readonly L3[] = [
  l3("CRMN 46 站站址，不含劑量值；涵蓋 13/13 省／地區", "46 CRMN station sites; no dose readings; 13/13 provinces & territories", "CRMN 46 局の所在地（線量値なし）。13/13 州・準州"),
  l3("固定點監測（FPS）81 點、核電廠緊急計畫區未收（無開放向量）", "Fixed Point Surveillance (81 sites) and nuclear emergency planning zones not included", "固定点監視（FPS）81 点、原子力緊急時計画区域は未収録"),
];
export const CA_RADIATION_POPUP: CaPopupSpec = {
  title: { props: ["name"], fallback: l3("輻射監測站", "Radiation monitoring station", "放射線監視局") },
  fields: [{ prop: "services", label: l3("監測項目", "Monitoring", "監視項目") }, PROVINCE],
};

// ─────────────────────────── NPRI 污染物排放申報設施（C099） ───────────────────────────

export const CA_NPRI_COUNT = 24_540;
/** 關鍵產業別 19 類粗分 6 群（對照表在 analytics npri_facilities/07_export.py SECTOR_GROUP）；色取站上既有色、兩兩 ΔE ≥ 20。 */
export const CA_NPRI_GROUPS: readonly CaCat[] = [
  { id: "oil_gas", values: ["oil_gas"], color: "#F2622E", label: l3("油氣開採、管線與煉製（15,673）", "Oil & gas extraction, pipelines, refining (15,673)", "石油・ガス採掘、パイプライン、精製（15,673）") },
  { id: "manufacturing", values: ["manufacturing"], color: "#a78bfa", label: l3("製造業（5,310）", "Manufacturing (5,310)", "製造業（5,310）") },
  { id: "mining_metals", values: ["mining_metals"], color: "#d97706", label: l3("礦業與金屬（1,009）", "Mining & metals (1,009)", "鉱業・金属（1,009）") },
  { id: "electricity", values: ["electricity"], color: "#F2D64B", label: l3("電力（381）", "Electricity (381)", "電力（381）") },
  { id: "waste_water", values: ["waste_water"], color: "#60a5fa", label: l3("廢棄物與污水處理（674）", "Waste & wastewater (674)", "廃棄物・下水処理（674）") },
  { id: "other", values: ["other"], color: "#94a3b8", label: l3("其他（1,493）", "Other (1,493)", "その他（1,493）") },
];
export const CA_NPRI_RECENT: readonly CaCat[] = [
  { id: "recent", values: ["recent"], color: "#F2622E", label: l3("2023–2025 年仍申報（8,790）", "Reported 2023–2025 (8,790)", "2023–2025 年に報告あり（8,790）") },
  { id: "past", values: ["past"], color: "#94a3b8", label: l3("2022 年以前停止申報（15,750）", "Last reported 2022 or earlier (15,750)", "2022 年以前に報告終了（15,750）") },
];
export const CA_NPRI_SOURCE = OGL_SOURCE("Environment and Climate Change Canada, National Pollutant Release Inventory（NPRI）", "https://open.canada.ca/data/en/dataset/40e01423-7728-429c-ac9d-2954385ccdfb");
export const CA_NPRI_NOTES: readonly L3[] = [
  l3("1993 年起曾申報的設施（含已停止申報者），不含排放量；涵蓋 13/13 省／地區", "Facilities that have reported since 1993 (incl. no longer reporting); no release amounts; 13/13", "1993 年以降に報告した事業所（報告終了を含む）、排出量なし。13/13 州・準州"),
  l3("亞伯達油氣井場申報多（11,925），密度反映申報門檻，不等於污染量", "Alberta oil & gas sites dominate (11,925); density reflects reporting thresholds, not pollution amounts", "アルバータの油ガス井が多い（11,925）。密度は報告基準の反映で汚染量ではない"),
];
export const CA_NPRI_POPUP: CaPopupSpec = {
  title: { props: ["facility", "company"], fallback: l3("NPRI 申報設施", "NPRI facility", "NPRI 報告事業所") },
  fields: [
    { prop: "company", label: l3("公司", "Company", "会社") },
    { prop: "sector_group", label: l3("產業群", "Sector group", "業種グループ"), map: Object.fromEntries(CA_NPRI_GROUPS.map((c) => [c.id, c.label])) },
    { prop: "sector_en", label: l3("關鍵產業別", "Key industrial sector", "主要産業分類") },
    { prop: "naics", label: l3("NAICS", "NAICS", "NAICS"), kind: "code" },
    { prop: "last_report_year", label: l3("最近申報年", "Last reported", "最終報告年"), kind: "code" },
    { prop: "npri_id", label: l3("NPRI 編號", "NPRI ID", "NPRI ID"), kind: "code" },
    { prop: "city", label: l3("城市", "City", "市町村") },
    PROVINCE,
  ],
};

// ─────────────────────────── 污水處理系統 WSER（C098） ───────────────────────────

export const CA_WSER_STATUSES: readonly CaCat[] = [
  { id: "operational", values: ["operational"], color: "#60a5fa", label: l3("運轉中（2,475）", "Operational (2,475)", "稼働中（2,475）") },
  { id: "decommissioned", values: ["decommissioned"], color: "#94a3b8", label: l3("已除役（62）", "Decommissioned (62)", "廃止（62）") },
];
/** 日均放流量（m³）3 級 → 點大小。 */
export const CA_WSER_BANDS: readonly { min: number; radius: number; label: string }[] = [
  { min: 0, radius: 3, label: "<1,000 m³／日" },
  { min: 1_000, radius: 4.5, label: "1,000–50,000" },
  { min: 50_000, radius: 7, label: "≥50,000" },
];
export const CA_WSER_SOURCE = OGL_SOURCE("Environment and Climate Change Canada, Wastewater Systems Effluent Regulations Reported Data", "https://open.canada.ca/data/en/dataset/9e11e114-ef0d-4814-8d93-24af23716489");
export const CA_WSER_NOTES: readonly L3[] = [
  l3("點位是最終排放點或溢流口，不是處理廠位置；業主名未收", "Points are final discharge points or outfalls, not plant sites; owner names omitted", "点は最終放流点・越流口で処理場の位置ではない。所有者名は未収録"),
  l3("涵蓋 11/13；Northwest Territories、Nunavut 未涵蓋", "Coverage 11/13; Northwest Territories and Nunavut not covered", "11/13 を収録。ノースウェスト準州・ヌナブト準州は対象外"),
];
export const CA_WSER_POPUP: CaPopupSpec = {
  title: { props: ["system_name"], fallback: l3("污水處理系統", "Wastewater system", "下水処理システム") },
  fields: [
    { prop: "status", label: l3("狀態", "Status", "状態"), map: Object.fromEntries(CA_WSER_STATUSES.map((c) => [c.id, c.label])) },
    { prop: "effluent_m3_day", label: l3("日均放流量", "Average daily effluent", "日平均放流量"), kind: "num", unit: "m³" },
    { prop: "treatment", label: l3("處理方式", "Treatment", "処理方式") },
    { prop: "system_type", label: l3("系統類型", "System type", "システム種別") },
    { prop: "receiving_water", label: l3("承受水體", "Receiving water", "放流先水域") },
    { prop: "point_type", label: l3("點位類型", "Point type", "地点種別") },
    { prop: "point_verified", label: l3("點位查核", "Point verification", "地点確認") },
    { prop: "owner_type", label: l3("業主類型", "Owner type", "所有者種別") },
    { prop: "city", label: l3("城市", "City", "市町村") },
    PROVINCE,
  ],
};

// ─────────────────────────── 歷史地震（C070 NRCan 1985–2019） ───────────────────────────

/** spec §3.15 earthquake 語意色（＝台灣 earthquakes、英國 gbEarthquakes）。 */
export const CA_QUAKE_COLOR = "#ff3b30";
export const CA_QUAKE_COUNT = 101_365;
export const CA_QUAKE_MAJOR_MIN = 4;
export const CA_QUAKE_CLASSES: readonly CaCat[] = [
  { id: "lt2", values: ["lt2"], color: CA_QUAKE_COLOR, label: l3("規模 <2（48,100）", "M <2 (48,100)", "M2 未満（48,100）") },
  { id: "m2", values: ["m2"], color: CA_QUAKE_COLOR, label: l3("規模 2–3（35,928）", "M 2–3 (35,928)", "M2–3（35,928）") },
  { id: "m3", values: ["m3"], color: CA_QUAKE_COLOR, label: l3("規模 3–4（14,732）", "M 3–4 (14,732)", "M3–4（14,732）") },
  { id: "m4", values: ["m4"], color: CA_QUAKE_COLOR, label: l3("規模 4–5（2,231）", "M 4–5 (2,231)", "M4–5（2,231）") },
  { id: "m5", values: ["m5"], color: CA_QUAKE_COLOR, label: l3("規模 ≥5（374）", "M ≥5 (374)", "M5 以上（374）") },
];
export const CA_QUAKE_SOURCE = OGL_SOURCE("Natural Resources Canada, Earthquakes in Canada（1985–2019）", "https://open.canada.ca/data/en/dataset/4cedd37e-0023-41fe-8eff-bea45385e469");
export const CA_QUAKE_NOTES: readonly L3[] = [
  l3("加拿大地震網目錄 1985–2019（資料停更），含鄰近海域與境外事件", "Canadian National Seismograph Network catalogue 1985–2019 (no longer updated); includes offshore and cross-border events", "カナダ地震観測網カタログ 1985–2019（更新停止）。近海・国外のイベントを含む"),
  l3("規模 ≥4 全國視角直接畫點，其餘拉遠畫熱區；規模型別混合（ML、MN、Mw…）", "M≥4 drawn as points at national view, others as heatmap; mixed magnitude types (ML, MN, Mw…)", "M4 以上は全国表示で点、それ以外は縮小時ヒートマップ。マグニチュード種別は混在"),
];
export const CA_QUAKE_POPUP: CaPopupSpec = {
  title: { props: ["place"], fallback: l3("地震", "Earthquake", "地震") },
  fields: [
    { prop: "time_utc", label: l3("時間（UTC）", "Time (UTC)", "発生時刻（UTC）"), kind: "code" },
    { prop: "magnitude", label: l3("規模", "Magnitude", "マグニチュード"), kind: "num", digits: 1 },
    { prop: "mag_type", label: l3("規模型別", "Magnitude type", "マグニチュード種別"), kind: "code" },
    { prop: "depth_km", label: l3("深度", "Depth", "深さ"), kind: "num", unit: "km", digits: 1 },
    PROVINCE,
  ],
  notes: [l3("省外或海上事件不列省別", "Province is blank for offshore or out-of-country events", "海域・国外のイベントは州なし")],
};

// ─────────────────────────── 即時地震（NRCan FDSN event 服務，近 30 天） ───────────────────────────

/**
 * 授權：FDSN 服務無專屬條款，套 NRCan 站層級條款（https://natural-resources.canada.ca/corporate/terms-conditions）：
 * 非商業重製免申請；須標示完整標題與作者機關，並註明是加拿大政府官方著作之重製、非與其合作或經其背書；
 * 商業轉散布須書面許可。條款沒有固定署名句式，以下依這三個要素擬（2026-11-06 使用者拍板照此上線）。
 */
export const CA_QUAKE_LIVE_DAYS = 30;
export const CA_QUAKE_LIVE_QUERY_URL = "https://earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query";
export const CA_QUAKE_LIVE_PAGE_URL = "https://earthquakescanada.nrcan.gc.ca/stndon/NEDB-BNDS/bulletin-en.php";
/** 事件類型：依 NRCan 事件地名英文段的前綴關鍵字分（爆破／礦場／疑似產業活動），其餘視為天然地震。 */
/** 即時地震四類事件色（亮色、CIE76 ΔE 兩兩 ≥70；地震沿用 CA_QUAKE_COLOR，其餘取自站上既有色值）。 */
export const CA_QUAKE_LIVE_TYPE_COLORS = { earthquake: CA_QUAKE_COLOR, industry: "#fbbf24", mining: "#22d3ee", blast: "#e879f9" } as const;
export const CA_QUAKE_LIVE_TYPES: readonly CaCat[] = [
  { id: "earthquake", values: ["earthquake"], color: CA_QUAKE_LIVE_TYPE_COLORS.earthquake, label: l3("地震", "Earthquake", "地震") },
  { id: "industry", values: ["industry"], color: CA_QUAKE_LIVE_TYPE_COLORS.industry, label: l3("疑似產業活動誘發", "(Suspected) industry-related", "産業活動由来（疑い含む）") },
  { id: "mining", values: ["mining"], color: CA_QUAKE_LIVE_TYPE_COLORS.mining, label: l3("礦場事件", "Mining event", "鉱山イベント") },
  { id: "blast", values: ["blast"], color: CA_QUAKE_LIVE_TYPE_COLORS.blast, label: l3("爆破（含採石）", "Blast (incl. quarry)", "発破（採石含む）") },
];
export const CA_QUAKE_LIVE_SOURCE: CaSource = {
  org: "Natural Resources Canada（加拿大自然資源部）, Earthquakes Canada — Search the Earthquake Database（FDSN event web service）",
  url: CA_QUAKE_LIVE_PAGE_URL,
  license: "NRCan Terms and Conditions：非商業重製（商業轉散布須書面許可）",
  short: "資料來源：Natural Resources Canada（加拿大自然資源部）Earthquakes Canada 地震目錄（FDSN），非商業使用",
};
/** 條款要求的「官方著作重製、非合作或背書」聲明：圖例、popup 都放。 */
export const CA_QUAKE_LIVE_DISCLAIMER: L3 = l3(
  "本圖重製自加拿大政府官方著作，非與加拿大政府合作製作，亦未經其背書",
  "Reproduction of an official work published by the Government of Canada; not produced in affiliation with, or with the endorsement of, the Government of Canada",
  "カナダ政府の公式著作物の複製であり、カナダ政府との提携またはその承認を受けて作成されたものではありません",
);
export const CA_QUAKE_LIVE_NOTES: readonly L3[] = [
  l3("NRCan 地震目錄最近 30 天（含規模 <2 的小地震、鄰近海域與美國阿拉斯加等境外事件）；不跟時間軸，每 5 分鐘重抓", "Last 30 days from the NRCan catalogue (incl. M<2, offshore and cross-border events); not tied to the timeline, refreshed every 5 min", "NRCan カタログ直近 30 日（M2 未満、近海・国外を含む）。タイムライン非連動、5 分ごと更新"),
  l3("初報可能事後修訂或刪除；規模型別混合（ML、MwN…）不換算", "Preliminary solutions may be revised or removed; mixed magnitude types (ML, MwN…) not converted", "速報値は修正・削除されることがある。マグニチュード種別は混在（換算なし）"),
  CA_QUAKE_LIVE_DISCLAIMER,
];
export const CA_QUAKE_LIVE_POPUP: CaPopupSpec = {
  title: { props: ["place"], fallback: l3("地震", "Earthquake", "地震") },
  fields: [
    { prop: "event_type", label: l3("事件類型", "Event type", "種別"), map: Object.fromEntries(CA_QUAKE_LIVE_TYPES.map((c) => [c.id, c.label])) },
    { prop: "time_utc", label: l3("時間（UTC）", "Time (UTC)", "発生時刻（UTC）"), kind: "code" },
    { prop: "magnitude", label: l3("規模", "Magnitude", "マグニチュード"), kind: "num", digits: 1 },
    { prop: "mag_type", label: l3("規模型別", "Magnitude type", "マグニチュード種別"), kind: "code" },
    { prop: "depth_km", label: l3("深度", "Depth", "深さ"), kind: "num", unit: "km", digits: 1 },
    { prop: "event_id", label: l3("事件代碼", "Event ID", "イベント ID"), kind: "code" },
  ],
  notes: [l3("地名為 NRCan 原文（英文段）；初報可能修訂", "Place name as published by NRCan (English part); preliminary solutions may be revised", "地名は NRCan 原文（英語部分）。速報値は修正されることがある"), CA_QUAKE_LIVE_DISCLAIMER],
};

// ─────────────────────────── 人口網格（GHSL 2020 → H3） ───────────────────────────

export const CA_POP_GRID_PALETTE_ID = "YlOrBr";
/** 人口密度（人／km²）7 級，跨 r5／r6／r7 共用同一組斷點（不逐級重算，顏色語意固定）。 */
export const CA_POP_GRID_BREAKS: readonly { min: number; label: string }[] = [
  { min: 0, label: "<1" },
  { min: 1, label: "1–10" },
  { min: 10, label: "10–50" },
  { min: 50, label: "50–250" },
  { min: 250, label: "250–1,000" },
  { min: 1_000, label: "1,000–4,000" },
  { min: 4_000, label: "≥4,000" },
];
/** 縮放分段：H3 解析度與對應縮放（與 PMTiles tile layer `ca_population_grid_r<N>` 一致）。 */
export const CA_POP_GRID_LEVELS: readonly { res: number; minzoom: number; maxzoom: number | null }[] = [
  { res: 5, minzoom: 2, maxzoom: 5 },
  { res: 6, minzoom: 5, maxzoom: 7 },
  { res: 7, minzoom: 7, maxzoom: null },
];
export const CA_POP_GRID_SOURCE: CaSource = {
  org: "European Commission, Joint Research Centre（JRC）, GHSL GHS-POP R2023A（2020）",
  url: "https://ghsl.jrc.ec.europa.eu/ghs_pop2023.php",
  license: "CC BY 4.0",
  short: "© European Commission JRC, GHSL GHS-POP R2023A（CC BY 4.0）",
};
export const CA_POP_GRID_NOTES: readonly L3[] = [
  l3("GHSL 2020 模型推估、非普查；全國合計與 2021 普查 36,991,981 人的差異見圖層說明", "GHSL 2020 model estimate, not census counts; see layer notes for the gap to the 2021 Census (36,991,981)", "GHSL 2020 のモデル推計で国勢調査値ではない（2021 年国勢調査 36,991,981 人との差は説明参照）"),
  l3("只畫有人口的格；沒有格＝推估無人居住，不是缺資料", "Only populated cells are drawn; no cell = estimated uninhabited, not missing data", "人口のあるセルのみ表示。セルなし＝推計で無人（欠損ではない）"),
  l3("拉遠 H3 第 5 級（約 252 km²）、z5 起第 6 級（約 36 km²）、z7 起第 7 級（約 5 km²）", "H3 res 5 (~252 km²) when zoomed out, res 6 (~36 km²) from z5, res 7 (~5 km²) from z7", "縮小時 H3 第 5 級（約 252 km²）、z5 から第 6 級（約 36 km²）、z7 から第 7 級（約 5 km²）"),
];
export const CA_POP_GRID_POPUP: CaPopupSpec = {
  title: { props: [], fallback: l3("人口網格", "Population grid", "人口グリッド") },
  fields: [
    { prop: "pop", label: l3("2020 推估人口", "Population 2020 (estimate)", "2020 年推計人口"), kind: "num" },
    { prop: "density", label: l3("人口密度", "Density", "人口密度"), kind: "num", unit: "/km²", digits: 1 },
    { prop: "area_km2", label: l3("格面積", "Cell area", "セル面積"), kind: "num", unit: "km²", digits: 1 },
    { prop: "h3", label: l3("H3 格", "H3 cell", "H3 セル"), kind: "code" },
  ],
  notes: [l3("GHSL 2020 模型推估，非普查實數", "GHSL 2020 model estimate, not a census count", "GHSL 2020 モデル推計（国勢調査の実数ではない）")],
};
