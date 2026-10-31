/**
 * 南韓第 3–5 波資料層（18 層）規格 SSOT：hook paint、圖例、popup 三邊共用。
 * 資料與授權原句見 taipei-gis-analytics `docs/data-catalog/{water_resources,marine,transportation,forestry}/kr_*.md`
 * 與 `docs/topic-research/south_korea_opendata/waves/w{3,4,5}/layer-plan.md`（2026-10-31 逐一重開授權頁）。
 * 介面字串（類別名、備註）以三語 `L3` 寫在本檔，顯示時依目前語系挑；圖層名／主題名走 layers.json／themes.json。
 *
 * 色票沿用台灣同語意圖層與英國第 3 波（水系藍／青、堤防琥珀、海洋保護區綠…），分類色之間以明度與色相區分。
 */
import type { KrDataKey } from "./krDataKeys";

export interface L3 { zh: string; en: string; ja: string }
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export interface KrCat { id: string; values: readonly string[]; color: string; label: L3; faded?: boolean }
export type KrFieldKind = "text" | "num" | "year" | "measure" | "peak" | "code";
export interface KrField { prop: string; label: L3; kind?: KrFieldKind; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export interface KrLayerSpec {
  key: KrDataKey;
  file: string;
  sourceLayer: string;
  geom: "point" | "line" | "polygon";
  /** 主 layer id（literal；gisClickRegistry 以此比對）。polygon 另有 `${id}` fill 與 outline。 */
  layerId: string;
  outlineId?: string;
  srcMinzoom: number;
  srcMaxzoom: number;
  minzoom: number;
  color: string;
  tier?: "S" | "M";
  count: number;
  catProp?: string;
  cats?: readonly KrCat[];
  otherColor?: string;
  otherLabel?: L3;
  title: { props: readonly string[]; fallback: L3 };
  fields: readonly KrField[];
  legendNotes: readonly L3[];
  popupNotes: readonly L3[];
  sourceOrg: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  loading: L3;
}

export const KR_FETCHED_AT = "2026-10-31";
export const KR_PLATFORM_LICENSE = "이용허락범위 제한 없음（data.go.kr 平台標籤）";
const DG = (pk: string) => `https://www.data.go.kr/data/${pk}/fileData.do`;
const DGS = (pk: string) => `https://www.data.go.kr/data/${pk}/standard.do`;

export const KR_UNMEASURED = l3("未測", "Not measured", "未測定");
const UNNAMED = l3("(未命名)", "(unnamed)", "(名称なし)");
const CODE_UNKNOWN = l3("代碼意義未公開", "Code meaning not published", "コードの意味は未公開");

const OSM_ATTR = "© OpenStreetMap contributors";

export const KR_DATA_SPECS: readonly KrLayerSpec[] = [
  // ───────────── 第 3 波：水系統與海洋 ─────────────
  {
    key: "krWaterLevelStations", file: "kr_water_level_stations.pmtiles", sourceLayer: "kr_water_level_stations", geom: "point", layerId: "kr-water-level-stations-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 7, color: "#22d3ee", tier: "M", count: 1379,
    catProp: "agency", otherColor: "#94a3b8", otherLabel: l3("其他機關", "Other agencies", "その他の機関"),
    cats: [
      { id: "moe", values: ["기후에너지환경부", "환경부"], color: "#22d3ee", label: l3("環境部／洪水統制所", "Ministry of Environment / flood control offices", "環境部・洪水統制所") },
      { id: "kwater", values: ["한국수자원공사"], color: "#3b82f6", label: l3("韓國水資源公社 K-water", "K-water", "韓国水資源公社 K-water") },
      { id: "krc", values: ["한국농어촌공사"], color: "#2dd4bf", label: l3("農漁村公社", "Korea Rural Community Corp.", "農漁村公社") },
      { id: "khnp", values: ["한국수력원자력"], color: "#a78bfa", label: l3("韓國水力原子力", "KHNP", "韓国水力原子力") },
    ],
    title: { props: ["name"], fallback: l3("水位觀測站", "Water level station", "水位観測所") },
    fields: [
      { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "river_name", label: l3("河川", "River", "河川") }, { prop: "river_basin", label: l3("水系", "Basin", "水系") },
      { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "start_date", label: l3("觀測開始", "Observation start", "観測開始") },
      { prop: "flood_control_office", label: l3("洪水統制所", "Flood control office", "洪水統制所") }, { prop: "station_code", label: l3("站碼", "Station code", "観測所コード"), kind: "code" },
    ],
    legendNotes: [l3("名冊站點，非即時水位（三份名冊以站碼去重）", "Station roster only, no live water levels (three rosters de-duplicated by station code)", "観測所名簿のみ（リアルタイム水位なし。3つの名簿を観測所コードで重複排除）"),
                  l3("不含水庫、水壩與地下水站", "Reservoirs, dams and groundwater wells not included", "ダム・貯水池・地下水観測は含まない")],
    popupNotes: [l3("名冊站點，無即時水位", "Roster entry; no live water level", "名簿上の地点（リアルタイム水位なし）")],
    sourceOrg: "환경부 한강홍수통제소, 한국수자원공사, 한국농어촌공사 (공공데이터포털)", sourceUrl: DG("15117317"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓水位站載入中", "Loading South Korea water level stations", "韓国の水位観測所を読み込み中"),
  },
  {
    key: "krSluiceGates", file: "kr_sluice_gates.pmtiles", sourceLayer: "kr_sluice_gates", geom: "point", layerId: "kr-sluice-gates-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, color: "#f59e0b", tier: "M", count: 2342,
    title: { props: ["name"], fallback: l3("農業水門", "Agricultural sluice gate", "農業用水門") },
    fields: [{ prop: "hq", label: l3("農漁公社本部", "KRC regional HQ", "農漁村公社本部") }, { prop: "branch", label: l3("支社", "Branch", "支社") }, { prop: "sido", label: l3("시·도", "Province", "市・道") }],
    legendNotes: [l3("僅涵蓋農漁村公社 8 個農業本部（慶北、全北、忠南、全南、京畿、忠北、慶南、江原）", "Covers only the 8 agricultural regional HQs of Korea Rural Community Corp. (Gyeongbuk, Jeonbuk, Chungnam, Jeonnam, Gyeonggi, Chungbuk, Gyeongnam, Gangwon)", "農漁村公社の農業8本部のみ（慶北・全北・忠南・全南・京畿・忠北・慶南・江原）"),
                  l3("서울、부산、대구、인천、대전、울산、세종、제주 未涵蓋；僅農業水利水門", "Seoul, Busan, Daegu, Incheon, Daejeon, Ulsan, Sejong and Jeju not covered; agricultural sluices only", "ソウル・釜山・大邱・仁川・大田・蔚山・世宗・済州は未収録（農業用水門のみ）")],
    popupNotes: [l3("僅涵蓋農漁村公社 8 個農業本部", "Only 8 agricultural regional HQs are covered", "農漁村公社の農業8本部のみ収録")],
    sourceOrg: "한국농어촌공사 (공공데이터포털)", sourceUrl: DG("15117324"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓農業水門載入中", "Loading South Korea sluice gates", "韓国の農業用水門を読み込み中"),
  },
  {
    key: "krWaterQualityStations", file: "kr_water_quality_stations.pmtiles", sourceLayer: "kr_water_quality_stations", geom: "point", layerId: "kr-water-quality-stations-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 8, color: "#38bdf8", tier: "M", count: 1181,
    catProp: "water_type", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "river", values: ["하천"], color: "#38bdf8", label: l3("河川", "River", "河川") },
      { id: "lake", values: ["호소"], color: "#2563eb", label: l3("湖沼", "Lake / reservoir", "湖沼") },
      { id: "industrial", values: ["산단하천"], color: "#f97316", label: l3("產業園區河川", "Industrial-complex stream", "産業団地河川") },
      { id: "urban", values: ["도시관류"], color: "#a78bfa", label: l3("都市河川", "Urban stream", "都市河川") },
    ],
    title: { props: ["name"], fallback: l3("水質測站", "Water quality station", "水質測定所") },
    fields: [
      { prop: "water_type", label: l3("水體類型", "Water body", "水域区分") }, { prop: "year", label: l3("取值年", "Year", "年"), kind: "year" }, { prop: "month", label: l3("取值月", "Month", "月"), kind: "year" },
      { prop: "temp_c", label: l3("水溫", "Water temp.", "水温"), kind: "measure", unit: "°C" }, { prop: "ph", label: l3("pH", "pH", "pH"), kind: "measure", digits: 1 },
      { prop: "do_mgl", label: l3("溶氧 DO", "DO", "溶存酸素 DO"), kind: "measure", unit: "mg/L" }, { prop: "bod_mgl", label: l3("BOD", "BOD", "BOD"), kind: "measure", unit: "mg/L" },
      { prop: "cod_mgl", label: l3("COD", "COD", "COD"), kind: "measure", unit: "mg/L" }, { prop: "toc_mgl", label: l3("TOC", "TOC", "TOC"), kind: "measure", unit: "mg/L" },
      { prop: "ss_mgl", label: l3("懸浮固體 SS", "SS", "浮遊物質 SS"), kind: "measure", unit: "mg/L" }, { prop: "tn_mgl", label: l3("總氮 TN", "TN", "全窒素 TN"), kind: "measure", unit: "mg/L" },
      { prop: "tp_mgl", label: l3("總磷 TP", "TP", "全リン TP"), kind: "measure", unit: "mg/L", digits: 3 }, { prop: "station_code", label: l3("測站碼", "Station code", "測定所コード"), kind: "code" },
    ],
    legendNotes: [l3("水質值為 2025 年各站最新有實測的月份，非即時；未測顯示「未測」，不當 0", "Values are each station's latest measured month of 2025, not live; unmeasured shows 'Not measured', never 0", "水質値は各測定所の2025年の最新測定月（リアルタイムではない）。未測は「未測定」と表示し 0 にしない")],
    popupNotes: [l3("數值為 2025 年最新實測月；未測不顯示為 0", "Values are the latest measured month of 2025; unmeasured is not shown as 0", "2025年の最新測定月の値。未測は 0 として表示しない")],
    sourceOrg: "기후에너지환경부 물환경 수질측정망 (공공데이터포털)", sourceUrl: DG("15111317"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓水質測站載入中", "Loading South Korea water quality stations", "韓国の水質測定所を読み込み中"),
  },
  {
    key: "krCoastalErosionFacilities", file: "kr_coastal_erosion_facilities.pmtiles", sourceLayer: "kr_coastal_erosion_facilities", geom: "point", layerId: "kr-coastal-erosion-facilities-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 9, color: "#fb923c", tier: "M", count: 1982,
    catProp: "type_name", otherColor: "#94a3b8", otherLabel: l3("其他型態", "Other types", "その他の形態"),
    cats: [
      { id: "natural", values: ["자연해안", "암반지대", "사빈", "사취"], color: "#22c55e", label: l3("自然海岸", "Natural coast", "自然海岸") },
      { id: "revetment", values: ["석축호안", "석축호안Ⅰ", "석축호안Ⅱ", "사석경사식호안", "계단식호안", "방파호안"], color: "#fb923c", label: l3("傾斜／石砌護岸", "Sloped / masonry revetment", "傾斜・石積護岸") },
      { id: "wall", values: ["직립호안", "직립호안Ⅰ", "직립호안Ⅱ"], color: "#ef4444", label: l3("直立護岸", "Vertical seawall", "直立護岸") },
      { id: "harbour", values: ["선착장", "방파제", "도류제"], color: "#3b82f6", label: l3("碼頭／防波堤", "Landing / breakwater", "船着場・防波堤") },
      { id: "road", values: ["해안도로", "산책로", "주차장", "해안진입로", "친수공간", "배수로"], color: "#a78bfa", label: l3("海岸道路與附屬設施", "Coastal road and facilities", "海岸道路・付帯施設") },
    ],
    title: { props: ["type_name"], fallback: l3("沿岸型態調查點", "Coastal survey point", "沿岸形態調査地点") },
    fields: [{ prop: "type_name", label: l3("海岸型態", "Coast type", "海岸形態") }, { prop: "note", label: l3("備註", "Note", "備考") }, { prop: "segment_code", label: l3("區段碼", "Segment code", "区間コード"), kind: "code" },
             { prop: "sigungu_code", label: l3("시군구碼", "Municipality code", "市郡区コード"), kind: "code" }, { prop: "sido", label: l3("시·도", "Province", "市・道") }],
    legendNotes: [l3("點位為沿岸型態調查（含自然海岸），不是結構物線形；內陸 시·도 無資料屬正常", "Points are coastal-type survey sites (natural coast included), not structure outlines; inland provinces have none by nature", "地点は沿岸形態調査（自然海岸を含む）で構造物の線形ではない。内陸の市・道に資料がないのは正常")],
    popupNotes: [l3("沿岸型態調查點", "Coastal-type survey point", "沿岸形態調査地点")],
    sourceOrg: "해양수산부 연안침식시설물 공간정보 (공공데이터포털)", sourceUrl: DG("15128148"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓海岸型態點載入中", "Loading South Korea coastal survey points", "韓国の沿岸形態調査地点を読み込み中"),
  },
  {
    key: "krRiversOsm", file: "kr_rivers_osm.pmtiles", sourceLayer: "kr_rivers_osm", geom: "line", layerId: "kr-rivers-osm-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 7, color: "#38bdf8", count: 33341,
    catProp: "waterway", otherColor: "#7dd3fc", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "river", values: ["river"], color: "#38bdf8", label: l3("河（river）", "River", "河川（river）") },
      { id: "stream", values: ["stream"], color: "#7dd3fc", label: l3("溪流（stream）", "Stream", "小川（stream）") },
      { id: "canal", values: ["canal"], color: "#a78bfa", label: l3("運河（canal）", "Canal", "運河（canal）") },
    ],
    title: { props: ["name", "name_en"], fallback: l3("無名河川", "Unnamed waterway", "名称なしの河川") },
    fields: [{ prop: "waterway", label: l3("類型", "Type", "種別"), map: { river: l3("河", "River", "河川"), stream: l3("溪流", "Stream", "小川"), canal: l3("運河", "Canal", "運河") } },
             { prop: "name_en", label: l3("英文名", "English name", "英語名") }, { prop: "tunnel", label: l3("暗渠／涵洞", "Culvert / tunnel", "暗渠・トンネル") }, { prop: "intermittent", label: l3("間歇性", "Intermittent", "間欠") },
             { prop: "sido", label: l3("시·도", "Province", "市・道") }],
    legendNotes: [l3("OSM 補缺：官方河川網無免 key 境外可得檔；不含河川等級與流域", "OSM gap-fill: no official river network is openly downloadable from abroad; river class and basin not included", "OSM による補完。公式の河川網は国外から取得できないため。河川等級・流域は含まない")],
    popupNotes: [l3("OSM 補缺（非官方河川網）", "OSM gap-fill (not the official river network)", "OSM による補完（公式河川網ではない）")],
    sourceOrg: OSM_ATTR, sourceUrl: "https://download.geofabrik.de/asia/south-korea.html", license: "ODbL 1.0", fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓河川載入中", "Loading South Korea rivers", "韓国の河川を読み込み中"),
  },
  {
    key: "krMarinePollutionIncidents", file: "kr_marine_pollution_incidents.pmtiles", sourceLayer: "kr_marine_pollution_incidents", geom: "point", layerId: "kr-marine-pollution-incidents-circle",
    srcMinzoom: 0, srcMaxzoom: 12, minzoom: 6, color: "#ef4444", tier: "M", count: 2420,
    catProp: "source_type", otherColor: "#94a3b8", otherLabel: l3("不明", "Unknown", "不明"),
    cats: [
      { id: "ship", values: ["선박"], color: "#ef4444", label: l3("船舶", "Vessel", "船舶") },
      { id: "land", values: ["육상"], color: "#f59e0b", label: l3("陸上來源", "Land-based", "陸上") },
    ],
    title: { props: ["place"], fallback: l3("海洋污染事故", "Marine pollution incident", "海洋汚染事故") },
    fields: [
      { prop: "occurred_at", label: l3("發生時間", "Occurred", "発生日時") }, { prop: "coast_guard", label: l3("海警署", "Coast guard station", "海洋警察署") }, { prop: "source_type", label: l3("污染源", "Source", "汚染源") },
      { prop: "vessel_kind", label: l3("船種", "Vessel type", "船種") }, { prop: "tonnage", label: l3("噸數", "Tonnage", "トン数"), kind: "num", digits: 2 }, { prop: "cause", label: l3("原因", "Cause", "原因") },
      { prop: "pollutant1", label: l3("污染物", "Pollutant", "汚染物質") }, { prop: "total_spill_l", label: l3("總流出量（單位未載明）", "Total spill (unit not stated)", "総流出量（単位は未記載）"), kind: "num", digits: 1 },
      { prop: "summary", label: l3("概要", "Summary", "概要") },
    ],
    legendNotes: [l3("2017–2025 年；總流出量單位未載明", "2017–2025; spill-volume unit not stated in the source", "2017〜2025年。総流出量の単位は出典に記載なし"), l3("24 筆無法定位已剔除；離岸事件未歸 시·도", "24 records without usable coordinates removed; offshore events not assigned to a province", "位置不明の24件を除外。沖合の事案は市・道に割り当てない")],
    popupNotes: [l3("總流出量單位未載明", "Spill-volume unit not stated", "総流出量の単位は未記載")],
    sourceOrg: "해양경찰청 해양오염사고 상세데이터 (공공데이터포털)", sourceUrl: DG("15113375"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓海洋污染事故載入中", "Loading South Korea marine pollution incidents", "韓国の海洋汚染事故を読み込み中"),
  },
  {
    key: "krMarineEnvSites", file: "kr_marine_env_sites.pmtiles", sourceLayer: "kr_marine_env_sites", geom: "point", layerId: "kr-marine-env-sites-circle",
    srcMinzoom: 0, srcMaxzoom: 12, minzoom: 7, color: "#14b8a6", tier: "M", count: 426,
    catProp: "network", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "estuary", values: ["하천영향 및 반폐쇄성해역환경측정망"], color: "#14b8a6", label: l3("河口與半封閉海域網", "Estuary / semi-enclosed sea network", "河川影響・半閉鎖海域網") },
      { id: "coastal", values: ["연안해역환경측정망"], color: "#3b82f6", label: l3("沿岸海域網", "Coastal sea network", "沿岸海域網") },
      { id: "port", values: ["항만환경측정망"], color: "#f59e0b", label: l3("港灣網", "Port network", "港湾網") },
    ],
    title: { props: ["site_code"], fallback: l3("海洋環境調查定點", "Marine environment site", "海洋環境調査定点") },
    fields: [{ prop: "network", label: l3("測定網", "Network", "測定網") }, { prop: "eco_zone", label: l3("生態區", "Ecological zone", "生態区") }, { prop: "sea_area", label: l3("海域", "Sea area", "海域") },
             { prop: "location_desc", label: l3("概略位置", "Location", "概略位置") }, { prop: "site_type", label: l3("定點類別", "Site class", "定点区分") }, { prop: "site_info", label: l3("定點資訊", "Site info", "定点情報") }],
    legendNotes: [l3("僅調查定點，無水質數值；50 列無座標的生物調查點已剔除", "Survey sites only, no measurements; 50 biological sites without coordinates removed", "調査定点のみ（測定値なし）。座標のない生物調査点50件を除外")],
    popupNotes: [l3("僅調查定點，無測定值", "Survey site only; no measurements", "調査定点のみ（測定値なし）")],
    sourceOrg: "해양수산부 해양환경측정망 조사정점 정보 (공공데이터포털)", sourceUrl: DG("15127821"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓海洋環境測點載入中", "Loading South Korea marine environment sites", "韓国の海洋環境調査定点を読み込み中"),
  },
  {
    key: "krMarineProtectedAreas", file: "kr_marine_protected_areas.pmtiles", sourceLayer: "kr_marine_protected_areas", geom: "polygon", layerId: "kr-marine-protected-areas-fill", outlineId: "kr-marine-protected-areas-line",
    srcMinzoom: 0, srcMaxzoom: 12, minzoom: 5, color: "#22c55e", count: 38,
    catProp: "category", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "wetland", values: ["습지보호구역"], color: "#22c55e", label: l3("濕地保護區", "Wetland protected area", "湿地保護区域") },
      { id: "ecosystem", values: ["해양생태계보호구역"], color: "#0ea5e9", label: l3("海洋生態系保護區", "Marine ecosystem protected area", "海洋生態系保護区域") },
      { id: "biota", values: ["해양생물보호구역"], color: "#a78bfa", label: l3("海洋生物保護區", "Marine life protected area", "海洋生物保護区域") },
      { id: "landscape", values: ["해양경관보호구역"], color: "#f59e0b", label: l3("海洋景觀保護區", "Marine landscape protected area", "海洋景観保護区域") },
    ],
    title: { props: ["name"], fallback: l3("海洋保護區", "Marine protected area", "海洋保護区域") },
    fields: [{ prop: "category", label: l3("類別", "Category", "区分") }, { prop: "designated_on", label: l3("指定日", "Designated", "指定日") }, { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 2 }, { prop: "address", label: l3("地址", "Address", "住所") }],
    legendNotes: [l3("僅 해양환경공단 公布的 4 類；其他保護區（野生生物保護區、定置網漁業權區等）未涵蓋", "Only the 4 categories published by Korea Marine Environment Management Corp.; other protected areas not covered", "海洋環境公団が公表する4区分のみ。その他の保護区は未収録"),
                  l3("무안 갯벌 有舊版（2001）與擴大版（2024）兩筆重疊", "Muan tidal flat appears twice (2001 original and 2024 expansion), overlapping", "務安干潟は旧（2001）と拡大版（2024）の2件が重複")],
    popupNotes: [],
    sourceOrg: "해양환경공단 해양보호구역 공간정보 (공공데이터포털)", sourceUrl: DG("15136101"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓海洋保護區載入中", "Loading South Korea marine protected areas", "韓国の海洋保護区域を読み込み中"),
  },
  // ───────────── 第 4 波：公共運輸與道路設施 ─────────────
  {
    key: "krPublicBicycleStations", file: "kr_public_bicycle_stations.pmtiles", sourceLayer: "kr_public_bicycle_stations", geom: "point", layerId: "kr-public-bicycle-stations-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 9, color: "#22c55e", tier: "M", count: 4236,
    catProp: "source", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "std", values: ["std_15017319"], color: "#22c55e", label: l3("全國標準資料", "National standard data", "全国標準データ") },
      { id: "seoul", values: ["seoul_ttareungi_OA-13252"], color: "#3b82f6", label: l3("首爾 따릉이", "Seoul Ttareungi", "ソウル タルンイ") },
    ],
    title: { props: ["name"], fallback: l3("公共自行車站", "Public bicycle station", "公共自転車ステーション") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "区分") }, { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "district", label: l3("自治區", "District", "自治区") }, { prop: "open", label: l3("開始營業", "Opens", "営業開始") }, { prop: "close", label: l3("結束營業", "Closes", "営業終了") },
             { prop: "closed_days", label: l3("休息日", "Closed", "休業日") }, { prop: "fee_type", label: l3("收費類型", "Fee type", "料金区分") }, { prop: "fee", label: l3("資費", "Fee", "料金") }, { prop: "bikes", label: l3("車輛數", "Bikes", "自転車数"), kind: "num", digits: 0 },
             { prop: "racks", label: l3("停車架數", "Racks", "ラック数"), kind: "num", digits: 0 }, { prop: "racks_lcd", label: l3("LCD 停車架", "LCD racks", "LCDラック"), kind: "num", digits: 0 }, { prop: "racks_qr", label: l3("QR 停車架", "QR racks", "QRラック"), kind: "num", digits: 0 },
             { prop: "operator", label: l3("管理機關", "Operator", "管理機関") }, { prop: "installed", label: l3("設置日", "Installed", "設置日") }],
    legendNotes: [l3("全國標準資料僅約 1.4 千站，遠低於實際；首爾另以 따릉이 名冊補足", "The national standard dataset lists only ~1.4k stations, far fewer than reality; Seoul is supplemented by the Ttareungi roster", "全国標準データは約1.4千か所で実数を大きく下回る。ソウルはタルンイ名簿で補完"),
                  l3("站點靜態，無即時車輛數", "Static stations; no live availability", "ステーションは静的情報（リアルタイム台数なし）")],
    popupNotes: [],
    sourceOrg: "전국자전거대여소표준데이터(공공데이터포털); 서울특별시 공공자전거 대여소 정보(따릉이, 공공누리 제1유형)", sourceUrl: DGS("15017319"), license: `${KR_PLATFORM_LICENSE}／따릉이: 공공누리 제1유형`, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓公共自行車站載入中", "Loading South Korea bicycle stations", "韓国の公共自転車ステーションを読み込み中"),
  },
  {
    key: "krSeoulSubwayCongestion", file: "kr_seoul_subway_congestion.pmtiles", sourceLayer: "kr_seoul_subway_congestion", geom: "point", layerId: "kr-seoul-subway-congestion-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, color: "#f97316", tier: "M", count: 272,
    catProp: "__peak_wkd", otherColor: "#94a3b8", otherLabel: l3("無資料", "No data", "データなし"),
    cats: [
      { id: "low", values: ["<34"], color: "#fde68a", label: l3("平日尖峰 < 34%（座位未滿）", "Weekday peak < 34% (seats not full)", "平日ピーク 34%未満（着席に余裕）") },
      { id: "mid", values: ["34-80"], color: "#fdba74", label: l3("34–80%", "34–80%", "34–80%") },
      { id: "high", values: ["80-130"], color: "#f97316", label: l3("80–130%（擁擠）", "80–130% (crowded)", "80–130%（混雑）") },
      { id: "crush", values: [">=130"], color: "#b91c1c", label: l3("≥ 130%（極擁擠）", "≥ 130% (very crowded)", "130%以上（非常に混雑）") },
    ],
    title: { props: ["name"], fallback: l3("地鐵站", "Subway station", "地下鉄駅") },
    fields: [{ prop: "line", label: l3("路線", "Line", "路線") }, { prop: "peak_wkd", label: l3("平日尖峰", "Weekday peak", "平日ピーク"), kind: "peak" }, { prop: "peak_sat", label: l3("週六尖峰", "Saturday peak", "土曜ピーク"), kind: "peak" },
             { prop: "peak_sun", label: l3("週日尖峰", "Sunday peak", "日曜ピーク"), kind: "peak" }, { prop: "station_no", label: l3("站號", "Station no.", "駅番号"), kind: "code" }, { prop: "quarter_file", label: l3("資料季", "Data quarter", "データ四半期"), kind: "code" }],
    legendNotes: [l3("僅首爾交通公社 1–8 號線（9 號線、코레일路線未涵蓋）；11 座新站／改名站座標對不上，未顯示", "Seoul Metro lines 1–8 only (line 9 and Korail lines not covered); 11 new or renamed stations could not be matched to coordinates and are not shown", "ソウル交通公社1〜8号線のみ（9号線・コレイル路線は未収録）。新設・改称の11駅は座標が一致せず非表示"),
                  l3("擁擠度＝列車定員比；34% 為座位全滿；2026Q3 平均", "Congestion = share of train capacity; 34% means all seats taken; 2026Q3 average", "混雑度＝列車定員比。34%は座席が全て埋まった状態。2026年第3四半期の平均")],
    popupNotes: [l3("擁擠度為 2026Q3 平均；34% = 座位全滿", "2026Q3 average; 34% = all seats taken", "2026年第3四半期の平均。34% = 座席が全て埋まった状態")],
    sourceOrg: "서울교통공사 지하철혼잡도정보; 전국도시철도역사정보표준데이터 (공공데이터포털)", sourceUrl: DG("15071311"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("首爾地鐵擁擠度載入中", "Loading Seoul subway congestion", "ソウル地下鉄混雑度を読み込み中"),
  },
  {
    key: "krBridges", file: "kr_bridges.pmtiles", sourceLayer: "kr_bridges", geom: "point", layerId: "kr-bridges-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, color: "#a78bfa", tier: "M", count: 35575,
    catProp: "road_kind", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "expressway", values: ["고속국도"], color: "#ef4444", label: l3("高速國道", "Expressway", "高速国道") },
      { id: "national", values: ["일반국도"], color: "#f59e0b", label: l3("一般國道", "National highway", "一般国道") },
      { id: "local", values: ["지방도", "국가지원지방도"], color: "#a78bfa", label: l3("地方道", "Provincial road", "地方道") },
      { id: "city", values: ["시도", "특별시도", "구도", "군도"], color: "#38bdf8", label: l3("市／郡／區道", "City / county / district road", "市・郡・区道") },
    ],
    title: { props: ["name"], fallback: l3("橋梁", "Bridge", "橋梁") },
    fields: [{ prop: "road_kind", label: l3("道路種類", "Road class", "道路種別") }, { prop: "route_name", label: l3("路線", "Route", "路線") }, { prop: "length_m", label: l3("橋長", "Length", "橋長"), kind: "num", unit: "m", digits: 0 },
             { prop: "width_m", label: l3("橋寬", "Width", "幅員"), kind: "num", unit: "m", digits: 1 }, { prop: "lanes", label: l3("車道數", "Lanes", "車線数"), kind: "num", digits: 0 }, { prop: "structure", label: l3("上部構造", "Superstructure", "上部構造") },
             { prop: "built_year", label: l3("竣工年", "Built", "竣工年"), kind: "year" }, { prop: "inspect_date", label: l3("最近安全檢查", "Last inspection", "直近の安全点検") }, { prop: "inspect_grade", label: l3("檢查結果", "Inspection result", "点検結果") },
             { prop: "design_load", label: l3("設計活載重", "Design load", "設計活荷重") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "address", label: l3("地址", "Address", "住所") }],
    legendNotes: [l3("點位為橋起訖點中點；隧道未涵蓋", "Points are bridge midpoints; tunnels not covered", "地点は橋の起終点の中点。トンネルは未収録")],
    popupNotes: [],
    sourceOrg: "국토교통부 전국교량표준데이터 (공공데이터포털, 공공누리 제1유형)", sourceUrl: DG("15081953"), license: "공공누리 제1유형（出處標示）", fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓橋梁載入中", "Loading South Korea bridges", "韓国の橋梁を読み込み中"),
  },
  {
    key: "krParkingLots", file: "kr_parking_lots.pmtiles", sourceLayer: "kr_parking_lots", geom: "point", layerId: "kr-parking-lots-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, color: "#3b82f6", tier: "M", count: 17699,
    catProp: "owner_kind", otherColor: "#94a3b8", otherLabel: l3("其他", "Other", "その他"),
    cats: [
      { id: "public", values: ["공영"], color: "#3b82f6", label: l3("公營", "Public", "公営") },
      { id: "private", values: ["민영"], color: "#f59e0b", label: l3("民營", "Private", "民営") },
    ],
    title: { props: ["name"], fallback: l3("停車場", "Parking lot", "駐車場") },
    fields: [{ prop: "lot_type", label: l3("類型", "Type", "区分") }, { prop: "spaces", label: l3("車位數", "Spaces", "駐車台数"), kind: "num", digits: 0 }, { prop: "fee_info", label: l3("收費", "Fee", "料金") },
             { prop: "weekday_open", label: l3("平日開始", "Weekday open", "平日開始") }, { prop: "weekday_close", label: l3("平日結束", "Weekday close", "平日終了") }, { prop: "basic_fee", label: l3("基本費用", "Basic fee", "基本料金"), kind: "num", unit: "KRW", digits: 0 },
             { prop: "basic_min", label: l3("基本時間", "Basic time", "基本時間"), kind: "num", unit: "min", digits: 0 }, { prop: "day_ticket", label: l3("日票", "Day pass", "1日券"), kind: "num", unit: "KRW", digits: 0 },
             { prop: "monthly", label: l3("月票", "Monthly pass", "月極"), kind: "num", unit: "KRW", digits: 0 }, { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "operator", label: l3("管理機關", "Operator", "管理機関") }],
    legendNotes: [l3("僅提供機關上傳之停車場，涵蓋度偏低（764 筆無座標已剔除）", "Only lots uploaded by providing agencies; coverage is low (764 records without coordinates removed)", "提供機関が登録した駐車場のみで網羅性は低い（座標のない764件を除外）")],
    popupNotes: [],
    sourceOrg: "전국주차장정보표준데이터 (공공데이터포털)", sourceUrl: DGS("15012896"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓停車場載入中", "Loading South Korea parking lots", "韓国の駐車場を読み込み中"),
  },
  {
    key: "krSpeedCameras", file: "kr_speed_cameras.pmtiles", sourceLayer: "kr_speed_cameras", geom: "point", layerId: "kr-speed-cameras-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, color: "#ef4444", tier: "M", count: 43743,
    catProp: "enforce_code", otherColor: "#94a3b8", otherLabel: l3("其他代碼", "Other codes", "その他のコード"),
    cats: [
      { id: "c2", values: ["2"], color: "#ef4444", label: l3("單屬代碼 2", "Enforcement code 2", "取締区分コード 2") },
      { id: "c1", values: ["1"], color: "#3b82f6", label: l3("單屬代碼 1", "Enforcement code 1", "取締区分コード 1") },
      { id: "c4", values: ["4"], color: "#f59e0b", label: l3("單屬代碼 4", "Enforcement code 4", "取締区分コード 4") },
      { id: "c12", values: ["1+2"], color: "#a78bfa", label: l3("單屬代碼 1+2", "Enforcement code 1+2", "取締区分コード 1+2") },
    ],
    title: { props: ["place"], fallback: l3("取締攝影機", "Enforcement camera", "取締カメラ") },
    fields: [{ prop: "enforce_code", label: l3("取締區分碼（代碼意義未公開）", "Enforcement code (meaning not published)", "取締区分コード（意味は未公開）"), kind: "code" }, { prop: "speed_limit_kmh", label: l3("限速", "Speed limit", "制限速度"), kind: "num", unit: "km/h", digits: 0 },
             { prop: "road_kind", label: l3("道路種類", "Road class", "道路種別") }, { prop: "route_name", label: l3("路線", "Route", "路線") }, { prop: "section_len_m", label: l3("區間長", "Section length", "区間長"), kind: "num", unit: "m", digits: 0 },
             { prop: "installed_year", label: l3("設置年", "Installed", "設置年"), kind: "year" }, { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "manage_no", label: l3("管理號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("단속구분 碼值照原樣顯示，代碼意義未公開（不自行解釋為超速或闖紅燈）", "Enforcement codes are shown as published; their meaning is not published (not interpreted as speeding or red-light)", "取締区分コードは原値のまま表示。意味は未公開で、速度違反・信号無視などとは解釈しない"),
                  l3("僅固定式攝影機；限速 0 視為未填", "Fixed cameras only; speed limit 0 is treated as unset", "固定式カメラのみ。制限速度0は未入力として扱う")],
    popupNotes: [CODE_UNKNOWN],
    sourceOrg: "전국무인교통단속카메라표준데이터 (공공데이터포털, 경찰청·지방자치단체)", sourceUrl: DGS("15028200"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓取締攝影機載入中", "Loading South Korea enforcement cameras", "韓国の取締カメラを読み込み中"),
  },
  {
    key: "krChildProtectionZones", file: "kr_child_protection_zones.pmtiles", sourceLayer: "kr_child_protection_zones", geom: "point", layerId: "kr-child-protection-zones-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, color: "#f59e0b", tier: "M", count: 14639,
    catProp: "facility_kind", otherColor: "#94a3b8", otherLabel: l3("其他設施", "Other facilities", "その他の施設"),
    cats: [
      { id: "elementary", values: ["초등학교"], color: "#f59e0b", label: l3("小學", "Elementary school", "小学校") },
      { id: "kindergarten", values: ["유치원"], color: "#22c55e", label: l3("幼稚園", "Kindergarten", "幼稚園") },
      { id: "daycare", values: ["어린이집"], color: "#38bdf8", label: l3("托育所", "Daycare", "保育所") },
    ],
    title: { props: ["name"], fallback: l3("兒童保護區對象設施", "Child protection zone facility", "子ども保護区域の対象施設") },
    fields: [{ prop: "facility_kind", label: l3("設施類型", "Facility type", "施設種別") }, { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "road_width_m", label: l3("保護區道路寬", "Road width", "道路幅"), kind: "num", unit: "m", digits: 1 },
             { prop: "cctv", label: l3("CCTV", "CCTV", "CCTV") }, { prop: "cctv_count", label: l3("CCTV 台數", "CCTV count", "CCTV台数"), kind: "num", digits: 0 }, { prop: "police_station", label: l3("管轄警察署", "Police station", "管轄警察署") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }],
    legendNotes: [l3("點位為對象設施（學校、幼兒園等）位置，非保護區範圍", "Points mark the facilities (schools, kindergartens…), not the extent of the zone", "地点は対象施設（学校・幼稚園など）の位置で、保護区域の範囲ではない")],
    popupNotes: [],
    sourceOrg: "전국어린이보호구역표준데이터 (공공데이터포털)", sourceUrl: DGS("15012891"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓兒童保護區載入中", "Loading South Korea child protection zones", "韓国の子ども保護区域を読み込み中"),
  },
  // ───────────── 第 5 波：自然保護與林業 ─────────────
  {
    key: "krNationalParks", file: "kr_national_parks.pmtiles", sourceLayer: "kr_national_parks", geom: "polygon", layerId: "kr-national-parks-fill", outlineId: "kr-national-parks-line",
    srcMinzoom: 0, srcMaxzoom: 12, minzoom: 5, color: "#16a34a", count: 23,
    title: { props: ["name"], fallback: l3("國立公園", "National park", "国立公園") },
    fields: [{ prop: "created", label: l3("建檔日", "Created", "作成日") }, { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 }, { prop: "sido_all", label: l3("所在 시·도", "Provinces", "所在の市・道") }, { prop: "park_code", label: l3("公園碼", "Park code", "公園コード"), kind: "code" }],
    legendNotes: [l3("邊界為由連續地籍加工的緩衝面，非法定界線，面積不可當法定面積", "Boundaries are buffered polygons derived from cadastral data, not legal boundaries; areas are not legal areas", "境界は連続地籍から加工した緩衝面で法定界ではない。面積は法定面積として使えない")],
    popupNotes: [l3("緩衝加工面，非法定界線", "Buffered polygon, not the legal boundary", "緩衝加工面（法定界ではない）")],
    sourceOrg: "국립공원공단 국립공원 공원경계 (공공데이터포털)", sourceUrl: DG("15017313"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓國立公園載入中", "Loading South Korea national parks", "韓国の国立公園を読み込み中"),
  },
  {
    key: "krNpLocationSigns", file: "kr_np_location_signs.pmtiles", sourceLayer: "kr_np_location_signs", geom: "point", layerId: "kr-np-location-signs-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, color: "#f97316", tier: "M", count: 3215,
    title: { props: ["place", "sign_no"], fallback: l3("位置標示板", "Location sign", "位置標識板") },
    fields: [{ prop: "park", label: l3("國立公園", "National park", "国立公園") }, { prop: "office", label: l3("管理事務所", "Office", "事務所") }, { prop: "sign_no", label: l3("標示板號", "Sign no.", "標識番号"), kind: "code" },
             { prop: "point_no", label: l3("國家地點番號", "National point number", "国家地点番号"), kind: "code" }, { prop: "elevation_m", label: l3("海拔", "Elevation", "標高"), kind: "num", unit: "m", digits: 0 },
             { prop: "trail", label: l3("路段", "Trail section", "区間"), kind: "text" }, { prop: "phone_signal", label: l3("可通話", "Phone signal", "通話可") }],
    legendNotes: [l3("國立公園多目的位置標示板，附國家地點番號（登山救援定位）", "National park multipurpose location signs with national point numbers (for rescue positioning)", "国立公園の多目的位置標識板（国家地点番号付き。救助時の位置特定用）"),
                  l3("涵蓋 21/23 座公園（缺 한라산、팔공산）；非全國番號板名冊", "Covers 21 of 23 parks (Hallasan and Palgongsan missing); not the full national point-number roster", "23公園中21公園を収録（漢拏山・八公山なし）。全国番号板の名簿ではない")],
    popupNotes: [],
    sourceOrg: "국립공원공단 다목적위치표지판 (공공데이터포털)", sourceUrl: DG("15121015"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓位置標示板載入中", "Loading South Korea location signs", "韓国の位置標識板を読み込み中"),
  },
  {
    key: "krNpTrails", file: "kr_np_trails.pmtiles", sourceLayer: "kr_np_trails", geom: "line", layerId: "kr-np-trails-line",
    srcMinzoom: 6, srcMaxzoom: 14, minzoom: 10, color: "#ea580c", count: 671,
    catProp: "facility", otherColor: "#94a3b8", otherLabel: l3("其他線形設施", "Other linear facilities", "その他の線形施設"),
    cats: [
      { id: "trail", values: ["탐방로"], color: "#ea580c", label: l3("探訪路（步道）", "Trail", "探訪路") },
      { id: "access", values: ["진입도로"], color: "#a78bfa", label: l3("進入道路", "Access road", "進入道路") },
      { id: "lift", values: ["삭도", "궤도", "무궤도"], color: "#38bdf8", label: l3("纜車／軌道", "Cable car / rail", "索道・軌道") },
    ],
    title: { props: ["label", "facility"], fallback: l3("線形設施", "Linear facility", "線形施設") },
    fields: [{ prop: "facility", label: l3("設施", "Facility", "施設") }, { prop: "park", label: l3("國立公園", "National park", "国立公園") }, { prop: "length_m", label: l3("長度", "Length", "長さ"), kind: "num", unit: "m", digits: 0 }, { prop: "id", label: l3("編號", "ID", "ID"), kind: "code" }],
    legendNotes: [l3("僅國立公園內線形設施（22/23 座，缺 팔공산）；산림청 全國登山路未涵蓋", "Linear facilities inside national parks only (22 of 23 parks; Palgongsan missing); national forest hiking routes not covered", "国立公園内の線形施設のみ（23公園中22。八公山なし）。山林庁の全国登山道は未収録")],
    popupNotes: [],
    sourceOrg: "국립공원공단 국립공원 선형시설 (공공데이터포털)", sourceUrl: DG("15091972"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓國立公園步道載入中", "Loading South Korea national park trails", "韓国の国立公園探訪路を読み込み中"),
  },
  {
    key: "krStreetTrees", file: "kr_street_trees.pmtiles", sourceLayer: "kr_street_trees", geom: "point", layerId: "kr-street-trees-circle",
    srcMinzoom: 13, srcMaxzoom: 15, minzoom: 13, color: "#22c55e", tier: "S", count: 1043931,
    catProp: "species", otherColor: "#94a3b8", otherLabel: l3("其他樹種", "Other species", "その他の樹種"),
    cats: [
      { id: "ginkgo", values: ["은행나무"], color: "#eab308", label: l3("銀杏", "Ginkgo", "イチョウ") },
      { id: "cherry", values: ["벚나무", "왕벚나무"], color: "#f472b6", label: l3("櫻（山櫻／日本櫻花）", "Cherry", "サクラ") },
      { id: "fringe", values: ["이팝나무"], color: "#f5f5f4", label: l3("流蘇樹（이팝나무）", "Chionanthus (Ipap)", "イパプナム") },
      { id: "zelkova", values: ["느티나무"], color: "#16a34a", label: l3("欅（느티나무）", "Zelkova", "ケヤキ") },
      { id: "sycamore", values: ["버즘나무"], color: "#a3e635", label: l3("懸鈴木", "Plane tree", "スズカケノキ") },
      { id: "metasequoia", values: ["메타세쿼이아"], color: "#0d9488", label: l3("水杉", "Dawn redwood", "メタセコイア") },
    ],
    title: { props: ["species"], fallback: l3("行道樹", "Street tree", "街路樹") },
    fields: [{ prop: "species", label: l3("樹種", "Species", "樹種") }, { prop: "dbh_cm", label: l3("胸高直徑", "DBH", "胸高直径"), kind: "num", unit: "cm", digits: 0 }, { prop: "road", label: l3("道路", "Road", "道路") },
             { prop: "median_green", label: l3("道路內綠地", "In-road green", "道路内緑地") }, { prop: "roadside_green", label: l3("路側綠地", "Roadside green", "路側緑地") }, { prop: "sigungu", label: l3("시군구", "Municipality", "市郡区") }, { prop: "tree_no", label: l3("樹木編號", "Tree no.", "樹木番号"), kind: "code" }],
    legendNotes: [l3("首爾、釜山、大田、蔚山幾乎未涵蓋（서울 僅 2 棵、대전 43、울산 23、부산 0）；無資料不代表沒有樹", "Seoul, Busan, Daejeon and Ulsan are almost not covered (Seoul 2 trees, Daejeon 43, Ulsan 23, Busan 0); no data does not mean no trees", "ソウル・釜山・大田・蔚山はほぼ未収録（ソウル2本・大田43本・蔚山23本・釜山0本）。データがないことは樹木がないことを意味しない"),
                  l3("僅約 85 個 시군구；zoom 13 起顯示", "Only ~85 municipalities; shown from zoom 13", "収録は約85市郡区のみ。ズーム13から表示")],
    popupNotes: [l3("僅部分自治體有資料，無資料處不代表沒有行道樹", "Only some municipalities are covered; absence of data is not absence of trees", "一部の自治体のみ収録。データがない場所に樹木がないとは限らない")],
    sourceOrg: "산림청 도시숲가로수관리 가로수 현황 (공공데이터포털)", sourceUrl: DG("15120900"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓行道樹載入中", "Loading South Korea street trees", "韓国の街路樹を読み込み中"),
  },
];

export const KR_SPEC_BY_KEY: Readonly<Record<KrDataKey, KrLayerSpec>> = Object.fromEntries(KR_DATA_SPECS.map((s) => [s.key, s])) as Record<KrDataKey, KrLayerSpec>;
export const KR_UNNAMED = UNNAMED;

/** X003 擁擠度分級：以 `peak_wkd` 數值判斷（hook 用 step 表達式，圖例用同一組門檻）。 */
export const KR_CONGESTION_BREAKS = [34, 80, 130] as const;

export function pickL3(text: L3, locale: string): string {
  return locale === "ja" ? text.ja : locale === "en" ? text.en : text.zh;
}
