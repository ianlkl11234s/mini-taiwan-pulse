/**
 * 南韓第 3–8 波資料層規格 SSOT：hook paint、圖例、popup 三邊共用。
 * 資料與授權原句見 taipei-gis-analytics `docs/data-catalog/{water_resources,marine,transportation,forestry}/kr_*.md`
 * 與 `docs/topic-research/south_korea_opendata/waves/w{3,4,5}/layer-plan.md`（2026-10-31 逐一重開授權頁）。
 * 介面字串（類別名、備註）以三語 `L3` 寫在本檔，顯示時依目前語系挑；圖層名／主題名走 layers.json／themes.json。
 *
 * 色票沿用台灣同語意圖層與英國第 3 波（水系藍／青、堤防琥珀、海洋保護區綠…），分類色之間以明度與色相區分。
 */
import type { KrDataKey } from "./krDataKeys";
import { selectedMultiSelectValues } from "./multiSelectMapbox";
import { paletteRamp, resampleRamp } from "../map/palettes";

export interface L3 { zh: string; en: string; ja: string }
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });

export interface KrCat { id: string; values: readonly string[]; color: string; label: L3; faded?: boolean }
/** `permit`：許可期間（`lcns_bgng_`～本欄，YYYYMMDD）＋快照日判斷的許可狀態；`addrBase`：地址只留到門牌（去掉逗號後與括號內的附註建物名）。 */
export type KrFieldKind = "text" | "num" | "year" | "measure" | "peak" | "code" | "permit" | "addrBase";
export interface KrField { prop: string; label: L3; kind?: KrFieldKind; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export interface KrLayerSpec {
  key: KrDataKey;
  file: string;
  sourceLayer: string;
  geom: "point" | "line" | "polygon";
  /** 主 layer id（literal；gisClickRegistry 以此比對）。polygon 另有 `${id}` fill 與 outline。 */
  layerId: string;
  outlineId?: string;
  /** 鋪滿國土的面（如通學區）：此縮放以下只畫細外框、不填色（全國視角不糊成一片），此縮放起才加填色。 */
  fillFromZoom?: number;
  srcMinzoom: number;
  srcMaxzoom: number;
  minzoom: number;
  /** V-1／P-4：拉遠改熱區（點在 `densePointsFromZoom(count, minzoom)` 起畫、之下為熱區）；intensity 依資料密度目視校正。 */
  /**
   * 序列分級面（第 6 波人口網格）：`prop` 依固定斷點 `breaks` 分 `breaks.length + 1` 級，色取色盤庫 `palette`
   * （暗／淡兩版，`paletteRamp`）重新取樣；不設外框。圖例逐級列出 `labels`。
   */
  ramp?: { prop: string; palette: "YlOrBr"; breaks: readonly number[]; labels: readonly string[]; unit: L3 };
  heat?: {
    intensity: number;
    /** 低縮放另用「格網計數」檔畫熱區（weight 吃 `count`；source maxzoom 以上自動 overzoom），點檔 `file` 從 `minzoom` 起接手。 */
    density?: { file: string; sourceLayer: string; srcMinzoom: number; srcMaxzoom: number; attribution: string };
  };
  color: string;
  tier?: "S" | "M";
  count: number;
  catProp?: string;
  /** 衍生分類（第 10 波漁場：許可到期另成一類）：`expr` 回傳分類值字串（hook 上色、類別多選共用），`of` 是 popup 標題色用的同一判斷。 */
  derivedCat?: { expr: unknown[]; of: (props: Record<string, unknown>) => string };
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

/** 第 6 波（2026-11-06 重開授權頁）。 */
export const KR_W6_FETCHED_AT = "2026-11-06";
/** 第 7 波（2026-11-07 重開授權頁）。 */
export const KR_W7_FETCHED_AT = "2026-11-07";
/** 第 8 波（2026-11-10 重開授權頁）。 */
export const KR_W8_FETCHED_AT = "2026-11-10";
/** 第 9 波（2026-11-10 重開授權頁）。 */
export const KR_W9_FETCHED_AT = "2026-11-10";
const KOGL4_LICENSE = "공공누리 제4유형（출처표시・상업적 이용금지・변경금지）";
/** 第 10 波（2026-11-13 下載時重讀授權頁）。 */
export const KR_W10_FETCHED_AT = "2026-11-13";
const KR_YN: Readonly<Record<string, L3>> = { Y: { zh: "有", en: "Yes", ja: "あり" }, N: { zh: "無", en: "No", ja: "なし" } };
/** 漁場資料快照日（rp_date 2024-04-24）：許可終止日 `lcns_end_y`（YYYYMMDD）早於此日＝快照時已到期（3,010 面）。用固定快照日、不用今天，筆數才與 manifest 一致。 */
export const KR_FISHING_SNAPSHOT = "20240424";
export const KR_FISHING_EXPIRED = "__expired_before_snapshot__";
const KR_FISHING_END = ["to-string", ["coalesce", ["get", "lcns_end_y"], ""]];
/** 已到期 → 固定值；否則回漁業區分原值（缺值＝""）。終止日缺值不算到期（"" < 任何日期會誤判）。 */
export const KR_FISHING_CAT_EXPR: unknown[] = ["case", ["all", ["!=", KR_FISHING_END, ""], ["<", KR_FISHING_END, KR_FISHING_SNAPSHOT]], KR_FISHING_EXPIRED, ["to-string", ["coalesce", ["get", "fids_se"], ""]]];
export function krFishingExpired(props: Record<string, unknown>): boolean | null {
  const end = props.lcns_end_y == null ? "" : String(props.lcns_end_y).trim();
  return end ? end < KR_FISHING_SNAPSHOT : null;
}
export function krFishingCat(props: Record<string, unknown>): string {
  return krFishingExpired(props) ? KR_FISHING_EXPIRED : props.fids_se == null ? "" : String(props.fids_se);
}

export const KR_UNMEASURED = l3("未測", "Not measured", "未測定");
const UNNAMED = l3("(未命名)", "(unnamed)", "(名称なし)");
const CODE_UNKNOWN = l3("代碼意義未公開", "Code meaning not published", "コードの意味は未公開");

const OSM_ATTR = "© OpenStreetMap contributors";

export const KR_DATA_SPECS: readonly KrLayerSpec[] = [
  // ───────────── 第 3 波：水系統與海洋 ─────────────
  {
    key: "krWaterLevelStations", file: "kr_water_level_stations.pmtiles", sourceLayer: "kr_water_level_stations", geom: "point", layerId: "kr-water-level-stations-circle",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#22d3ee", tier: "M", count: 1379,
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
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#f59e0b", tier: "M", count: 2342,
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
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#38bdf8", tier: "M", count: 1181,
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
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 9, heat: { intensity: 3 }, color: "#fb923c", tier: "M", count: 1982,
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
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 5, color: "#38bdf8", count: 33341,
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
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#ef4444", tier: "M", count: 2420,
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
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#14b8a6", tier: "M", count: 426,
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
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 5, color: "#22c55e", count: 38,
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
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 9, heat: { intensity: 3 }, color: "#22c55e", tier: "M", count: 4236,
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
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, heat: { intensity: 2 }, color: "#a78bfa", tier: "M", count: 35575,
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
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, heat: { intensity: 2.5 }, color: "#3b82f6", tier: "M", count: 17699,
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
    srcMinzoom: 5, srcMaxzoom: 14, minzoom: 11, heat: { intensity: 1.5 }, color: "#ef4444", tier: "M", count: 43743,
    catProp: "enforce_code", otherColor: "#94a3b8", otherLabel: l3("其他代碼", "Other codes", "その他のコード"),
    cats: [
      { id: "c2", values: ["2"], color: "#ef4444", label: l3("取締區分碼 2", "Enforcement code 2", "取締区分コード 2") },
      { id: "c1", values: ["1"], color: "#3b82f6", label: l3("取締區分碼 1", "Enforcement code 1", "取締区分コード 1") },
      { id: "c4", values: ["4"], color: "#f59e0b", label: l3("取締區分碼 4", "Enforcement code 4", "取締区分コード 4") },
      { id: "c12", values: ["1+2"], color: "#a78bfa", label: l3("取締區分碼 1+2", "Enforcement code 1+2", "取締区分コード 1+2") },
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
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 11, heat: { intensity: 2.5 }, color: "#f59e0b", tier: "M", count: 14639,
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
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 5, color: "#16a34a", count: 23,
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
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#ea580c", count: 671,
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
    srcMinzoom: 13, srcMaxzoom: 15, minzoom: 13, heat: { intensity: 120, density: { file: "kr_street_trees_density.pmtiles", sourceLayer: "kr_street_trees_density", srcMinzoom: 4, srcMaxzoom: 12, attribution: "산림청 도시숲가로수관리 가로수 현황 (공공데이터포털)" } }, color: "#22c55e", tier: "S", count: 1043931,
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
                  l3("僅約 85 個 시군구；zoom 13 起顯示單棵，之下為密度熱區（格網計數；類別篩選只作用於單棵點）", "Only ~85 municipalities; individual trees from zoom 13, a density heatmap (grid counts) below it; the species filter applies to individual trees only", "収録は約85市郡区のみ。ズーム13から1本ずつ表示、それ以下は密度ヒートマップ（格子集計。樹種フィルタは1本表示のみ）")],
    popupNotes: [l3("僅部分自治體有資料，無資料處不代表沒有行道樹", "Only some municipalities are covered; absence of data is not absence of trees", "一部の自治体のみ収録。データがない場所に樹木がないとは限らない")],
    sourceOrg: "산림청 도시숲가로수관리 가로수 현황 (공공데이터포털)", sourceUrl: DG("15120900"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_FETCHED_AT,
    loading: l3("南韓行道樹載入中", "Loading South Korea street trees", "韓国の街路樹を読み込み中"),
  },
  // ───────────── 第 6 波：底圖、運動休閒、殯葬、人口網格 ─────────────
  {
    key: "krTerritorialSea", file: "kr_territorial_sea.pmtiles", sourceLayer: "kr_territorial_sea", geom: "line", layerId: "kr-territorial-sea-line",
    srcMinzoom: 0, srcMaxzoom: 10, minzoom: 0, color: "#38bdf8", count: 1,
    title: { props: ["zone"], fallback: l3("領海外側線", "Territorial sea limit", "領海の外側線") },
    fields: [{ prop: "legal_basis", label: l3("法源", "Legal basis", "法的根拠") }, { prop: "revised", label: l3("修訂日", "Revised", "改訂日") },
             { prop: "reference_chart", label: l3("參考圖", "Reference chart", "参考図") }, { prop: "chart_scale", label: l3("比例尺", "Scale", "縮尺") },
             { prop: "agency", label: l3("調查機關", "Surveyed by", "調査機関") }, { prop: "survey_year", label: l3("調查年", "Survey year", "調査年"), kind: "year" }],
    legendNotes: [l3("領海外側界線（12 海里；大韓海峽 3 海里），含鬱陵島、獨島周邊", "Outer limit of the territorial sea (12 nm; 3 nm in the Korea Strait), incl. Ulleungdo and Dokdo", "領海の外側線（12海里。大韓海峡は3海里）。鬱陵島・独島周辺を含む"),
                  l3("直線基線、接續水域、專屬經濟海域、韓日／韓中暫定水域未涵蓋", "Baselines, contiguous zone, EEZ and the Korea–Japan / Korea–China provisional zones are not covered", "直線基線・接続水域・EEZ・日韓／中韓暫定水域は未収録")],
    popupNotes: [],
    sourceOrg: "해양수산부 국립해양조사원 영해한계선 (공공데이터포털)", sourceUrl: DG("15114329"), license: "공공누리 제1유형（출처표시）", fetchedAt: KR_W6_FETCHED_AT,
    loading: l3("南韓領海線載入中", "Loading South Korea territorial sea limit", "韓国の領海線を読み込み中"),
  },
  {
    key: "krUrbanParks", file: "kr_urban_parks.pmtiles", sourceLayer: "kr_urban_parks", geom: "point", layerId: "kr-urban-parks-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 1.5 }, color: "#7cb342", tier: "M", count: 17435,
    catProp: "kind", otherColor: "#94a3b8", otherLabel: l3("其他（含未分類）", "Other (incl. unclassified)", "その他（未分類を含む）"),
    cats: [
      { id: "children", values: ["어린이공원"], color: "#f59e0b", label: l3("兒童公園", "Children's park", "児童公園") },
      { id: "neighborhood", values: ["근린공원"], color: "#7cb342", label: l3("近鄰公園", "Neighbourhood park", "近隣公園") },
      { id: "small", values: ["소공원"], color: "#2dd4bf", label: l3("小公園", "Small park", "小公園") },
      { id: "theme", values: ["문화공원", "수변공원", "체육공원", "역사공원", "묘지공원", "도시농업공원", "문화공원수변공원", "가로공원"], color: "#a78bfa", label: l3("主題公園（文化、水邊、體育、歷史、墓地等）", "Themed park (culture, waterside, sports, history, cemetery…)", "主題公園（文化・水辺・運動・歴史・墓地など）") },
    ],
    title: { props: ["name"], fallback: l3("都市公園", "Urban park", "都市公園") },
    fields: [{ prop: "kind", label: l3("公園種類", "Park type", "公園種別") }, { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²", digits: 0 },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "designated", label: l3("指定告示日", "Designated", "指定告示日") },
             { prop: "fac_sport", label: l3("運動設施", "Sports facilities", "運動施設") }, { prop: "fac_play", label: l3("遊戲設施", "Play facilities", "遊戯施設") },
             { prop: "fac_amenity", label: l3("便利設施", "Amenities", "便益施設") }, { prop: "fac_culture", label: l3("教養設施", "Cultural facilities", "教養施設") },
             { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }, { prop: "manage_no", label: l3("管理號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("點為公園代表點，非公園範圍；只含依都市公園法指定的都市公園（國立公園、自然公園另層）", "Points are park reference points, not park extents; only parks designated under the Urban Parks Act (national and natural parks are separate)", "点は公園の代表点で範囲ではない。都市公園法の指定公園のみ（国立公園・自然公園は別レイヤー）"),
                  l3("清州市上傳的 195 筆座標落在大田、忠南、世宗（與地址不符），未上圖", "195 parks submitted by Cheongju have coordinates outside the city (in Daejeon, Chungnam, Sejong) and are not shown", "清州市提出の195件は座標が住所と合わず（大田・忠南・世宗に位置）、表示していない")],
    popupNotes: [],
    sourceOrg: "국토교통부·지방자치단체 전국도시공원정보표준데이터 (공공데이터포털)", sourceUrl: DGS("15012890"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W6_FETCHED_AT,
    loading: l3("南韓都市公園載入中", "Loading South Korea urban parks", "韓国の都市公園を読み込み中"),
  },
  {
    key: "krSportsFacilities", file: "kr_sports_facilities.pmtiles", sourceLayer: "kr_sports_facilities", geom: "point", layerId: "kr-sports-facilities-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#ef6c00", tier: "M", count: 346,
    catProp: "status",
    cats: [
      { id: "open", values: ["영업"], color: "#ef6c00", label: l3("營業中", "Operating", "営業中") },
      { id: "suspended", values: ["휴업"], color: "#94a3b8", label: l3("休業", "Temporarily closed", "休業") },
    ],
    title: { props: ["name"], fallback: l3("綜合體育設施", "Sports complex", "総合体育施設") },
    fields: [{ prop: "status", label: l3("營業狀態", "Status", "営業状態"), map: { "영업": l3("營業中", "Operating", "営業中"), "휴업": l3("休業", "Temporarily closed", "休業") } },
             { prop: "licensed", label: l3("許可日", "Licensed", "許可日") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "updated", label: l3("最後修改", "Last updated", "最終更新") }, { prop: "manage_no", label: l3("管理號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("只有民營綜合體育設施業許可；公營國民體育中心、學校體育設施、健身房與武道館未涵蓋", "Licensed private sports complexes only; public sports centres, school facilities, gyms and martial-arts dojos are not covered", "民間の総合体育施設業の許可のみ。公営の国民体育センター・学校体育施設・ジム・道場は未収録"),
                  l3("歇業、許可取消者已排除", "Closed and cancelled businesses are excluded", "廃業・許可取消は除外")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 종합체육시설업 (공공데이터포털)", sourceUrl: "https://www.data.go.kr/data/15155071/openapi.do", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W6_FETCHED_AT,
    loading: l3("南韓綜合體育設施載入中", "Loading South Korea sports complexes", "韓国の総合体育施設を読み込み中"),
  },
  {
    // V-5：面＋代表點（`kr_cemeteries_osm_points.pmtiles`，登記在 repPointLayers，預設點）
    key: "krCemeteriesOsm", file: "kr_cemeteries_osm.pmtiles", sourceLayer: "kr_cemeteries_osm", geom: "polygon", layerId: "kr-cemeteries-osm-fill", outlineId: "kr-cemeteries-osm-line",
    srcMinzoom: 6, srcMaxzoom: 13, minzoom: 6, color: "#4a7c59", count: 16565,
    catProp: "kind",
    cats: [
      { id: "cemetery", values: ["cemetery"], color: "#4a7c59", label: l3("墓地（landuse=cemetery）", "Cemetery (landuse=cemetery)", "墓地（landuse=cemetery）") },
      { id: "grave_yard", values: ["grave_yard"], color: "#a3a3a3", label: l3("墓園（amenity=grave_yard）", "Graveyard (amenity=grave_yard)", "墓所（amenity=grave_yard）") },
    ],
    title: { props: ["name"], fallback: l3("墓地", "Cemetery", "墓地") },
    fields: [{ prop: "kind", label: l3("OSM 類型", "OSM type", "OSM種別") }, { prop: "religion", label: l3("宗教", "Religion", "宗教") }, { prop: "operator", label: l3("經營者", "Operator", "運営者") },
             { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²", digits: 0 }, { prop: "osm_id", label: l3("OSM 編號", "OSM ID", "OSM ID"), kind: "code" }],
    legendNotes: [l3("OpenStreetMap 標註，完整度未驗、各地密度不均（全北 6,997 處占 42%，首爾 70、釜山 32）；空白不代表沒有墓地", "OpenStreetMap tagging; completeness unverified and very uneven (Jeonbuk 6,997 = 42%, Seoul 70, Busan 32); blank areas do not mean no cemeteries", "OpenStreetMapの登録。網羅性は未検証で地域差が大きい（全北6,997件で42%、ソウル70、釜山32）。空白は墓地がないことを意味しない"),
                  l3("官方都市計畫墓地圖層境外無法取得，未涵蓋", "The official urban-planning cemetery layer is not accessible from abroad and is not covered", "公式の都市計画墓地レイヤーは国外から取得できず未収録")],
    popupNotes: [],
    sourceOrg: OSM_ATTR, sourceUrl: "https://www.openstreetmap.org/copyright", license: "ODbL 1.0", fetchedAt: KR_W6_FETCHED_AT,
    loading: l3("南韓墓地載入中", "Loading South Korea cemeteries", "韓国の墓地を読み込み中"),
  },
  {
    key: "krPopulationH3", file: "kr_population_h3.pmtiles", sourceLayer: "kr_population_h3", geom: "polygon", layerId: "kr-population-h3-fill",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#fea332", count: 160048,
    ramp: { prop: "density", palette: "YlOrBr", breaks: [10, 50, 200, 1000, 5000, 15000], labels: ["< 10", "10–50", "50–200", "200–1,000", "1,000–5,000", "5,000–15,000", "≥ 15,000"],
            unit: l3("人口密度（人/km²）", "Population density (people/km²)", "人口密度（人/km²）") },
    title: { props: [], fallback: l3("人口網格", "Population grid", "人口グリッド") },
    fields: [{ prop: "pop", label: l3("推估人口", "Estimated population", "推計人口"), kind: "num", digits: 0 },
             { prop: "density", label: l3("人口密度（人/km²）", "Density (people/km²)", "人口密度（人/km²）"), kind: "num", digits: 0 },
             { prop: "res", label: l3("H3 解析度", "H3 resolution", "H3解像度"), kind: "code" }],
    legendNotes: [l3("GHSL 2020 模型推估、非戶籍：全國合計 51,850,602 人（行政安全部住民登錄 2026-09 為 51,082,431）", "GHSL 2020 model estimate, not the resident registry: national total 51,850,602 (resident registration, Sept 2026: 51,082,431)", "GHSL 2020年のモデル推計で住民登録ではない。全国計51,850,602人（住民登録2026年9月は51,082,431人）"),
                  l3("拉遠為 H3 第 7 級格（約 5 km²），zoom 9 起為第 8 級格（約 0.7 km²）；沒有格子＝推估無人居住", "H3 resolution 7 cells (≈5 km²) when zoomed out, resolution 8 (≈0.7 km²) from zoom 9; no cell = no estimated population", "縮小時はH3解像度7（約5km²）、ズーム9から解像度8（約0.7km²）。セルなし＝推計人口なし")],
    popupNotes: [l3("GHSL 2020 模型推估，非戶籍人口", "GHSL 2020 model estimate, not registered population", "GHSL 2020年のモデル推計（住民登録人口ではない）")],
    sourceOrg: "European Commission JRC, GHSL GHS-POP R2023A (2020)", sourceUrl: "https://ghsl.jrc.ec.europa.eu/ghs_pop2023.php", license: "CC BY 4.0", fetchedAt: KR_W6_FETCHED_AT,
    loading: l3("南韓人口網格載入中", "Loading South Korea population grid", "韓国の人口グリッドを読み込み中"),
  },
  // ───────────── 第 7 波：教育、醫療、消防 ─────────────
  {
    key: "krSchools", file: "kr_schools.pmtiles", sourceLayer: "kr_schools", geom: "point", layerId: "kr-schools-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 3 }, color: "#f59e0b", tier: "M", count: 12004,
    catProp: "level",
    cats: [
      { id: "elementary", values: ["초등학교"], color: "#f59e0b", label: l3("小學（초등학교）", "Elementary school", "小学校") },
      { id: "middle", values: ["중학교"], color: "#38bdf8", label: l3("國中（중학교）", "Middle school", "中学校") },
      { id: "high", values: ["고등학교"], color: "#a78bfa", label: l3("高中（고등학교）", "High school", "高等学校") },
    ],
    title: { props: ["name"], fallback: l3("學校", "School", "学校") },
    fields: [{ prop: "level", label: l3("學校級別", "Level", "学校種別"), map: { "초등학교": l3("小學", "Elementary", "小学校"), "중학교": l3("國中", "Middle", "中学校"), "고등학교": l3("高中", "High", "高等学校") } },
             { prop: "found", label: l3("設立別", "Founded by", "設立区分"), map: { "공립": l3("公立", "Public", "公立"), "사립": l3("私立", "Private", "私立"), "국립": l3("國立", "National", "国立") } },
             { prop: "branch", label: l3("本校／分校", "Main / branch", "本校／分校"), map: { "본교": l3("本校", "Main campus", "本校"), "분교": l3("分校", "Branch", "分校") } },
             { prop: "opened", label: l3("設立日", "Founded", "設立日") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "office", label: l3("教育支援廳", "Education office", "教育支援庁") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") },
             { prop: "school_id", label: l3("學校 ID", "School ID", "学校ID"), kind: "code" }],
    legendNotes: [l3("只含運作中的小學、國中、高中 12,004 校；特殊學校、各種學校、大學、幼稚園未涵蓋", "Operating elementary, middle and high schools only (12,004); special schools, miscellaneous schools, universities and kindergartens are not covered", "運営中の小・中・高12,004校のみ。特別支援学校・各種学校・大学・幼稚園は未収録")],
    popupNotes: [],
    sourceOrg: "한국교육시설안전원 초중등학교위치 (공공데이터포털)", sourceUrl: DG("15159184"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓學校載入中", "Loading South Korea schools", "韓国の学校を読み込み中"),
  },
  {
    // V-5：面＋代表點（`kr_school_districts_points.pmtiles`，登記在 repPointLayers；通學區鋪滿國土，預設面）
    key: "krSchoolDistricts", file: "kr_school_districts.pmtiles", sourceLayer: "kr_school_districts", geom: "polygon", layerId: "kr-school-districts-fill", outlineId: "kr-school-districts-line", fillFromZoom: 9,
    srcMinzoom: 5, srcMaxzoom: 13, minzoom: 5, color: "#38bdf8", count: 7132,
    title: { props: ["name"], fallback: l3("小學通學區", "Elementary school zone", "小学校通学区域") },
    fields: [{ prop: "office", label: l3("教育支援廳", "Education office", "教育支援庁") }, { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²", digits: 0 },
             { prop: "updated", label: l3("最後修改", "Last updated", "最終更新") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") },
             { prop: "district_id", label: l3("學區 ID", "Zone ID", "学区ID"), kind: "code" }],
    legendNotes: [l3("只含小學通學區（7,132 區）；國中學校群、高中學群未涵蓋", "Elementary school attendance zones only (7,132); middle-school and high-school groupings are not covered", "小学校の通学区域のみ（7,132区域）。中学校群・高校学群は未収録"),
                  l3("通學區是依住址分派入學的範圍，不是學校位置；跨區、共同學區以官方公告為準", "Zones assign enrolment by home address; they are not school locations. Official notices prevail for shared or cross-zone areas", "通学区域は住所による就学先の割当範囲で学校の位置ではない。共同学区などは公式告示が優先")],
    popupNotes: [],
    sourceOrg: "한국교육시설안전원 초등학교통학구역 (공공데이터포털)", sourceUrl: DG("15159265"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓小學通學區載入中", "Loading South Korea elementary school zones", "韓国の小学校通学区域を読み込み中"),
  },
  {
    key: "krHospitalsPharmacies", file: "kr_hospitals_pharmacies.pmtiles", sourceLayer: "kr_hospitals_pharmacies", geom: "point", layerId: "kr-hospitals-pharmacies-circle",
    srcMinzoom: 12, srcMaxzoom: 14, minzoom: 12,
    heat: { intensity: 150, density: { file: "kr_hospitals_pharmacies_density.pmtiles", sourceLayer: "kr_hospitals_pharmacies_density", srcMinzoom: 4, srcMaxzoom: 11, attribution: "건강보험심사평가원 (공공데이터포털)" } },
    color: "#38bdf8", tier: "S", count: 105739,
    catProp: "cat", otherColor: "#94a3b8", otherLabel: l3("其他（助產所）", "Other (midwifery clinics)", "その他（助産所）"),
    cats: [
      { id: "general", values: ["general"], color: "#ef4444", label: l3("綜合醫院（含上級綜合）", "General hospital (incl. tertiary)", "総合病院（上級総合を含む）") },
      { id: "hospital", values: ["hospital"], color: "#f59e0b", label: l3("醫院（含療養、精神、韓方、牙科醫院）", "Hospital (incl. long-term care, psychiatric, Korean medicine, dental)", "病院（療養・精神・韓方・歯科病院を含む）") },
      { id: "clinic", values: ["clinic"], color: "#38bdf8", label: l3("診所（의원）", "Clinic", "医院（診療所）") },
      { id: "dental_oriental", values: ["dental_oriental"], color: "#a78bfa", label: l3("牙醫、韓醫診所", "Dental / Korean-medicine clinic", "歯科医院・韓医院") },
      { id: "public_health", values: ["public_health"], color: "#22c55e", label: l3("保健所、保健支所、保健診療所", "Public health centre / branch / post", "保健所・保健支所・保健診療所") },
      { id: "pharmacy", values: ["pharmacy"], color: "#f472b6", label: l3("藥局", "Pharmacy", "薬局") },
    ],
    title: { props: ["name"], fallback: l3("醫療院所", "Medical facility", "医療機関") },
    fields: [{ prop: "kind", label: l3("種別", "Type", "種別") }, { prop: "doctors", label: l3("醫師數", "Doctors", "医師数"), kind: "num", digits: 0 },
             { prop: "opened", label: l3("開設日", "Opened", "開設日") }, { prop: "address", label: l3("地址", "Address", "住所") }],
    legendNotes: [l3("健保審查評價院 2026 年 9 月季報：醫院、診所 79,891＋藥局 25,848（無座標 10 筆未上圖）；只含健保簽約機構", "HIRA quarterly list, Sept 2026: 79,891 hospitals and clinics + 25,848 pharmacies (10 without coordinates not shown); National Health Insurance providers only", "健康保険審査評価院2026年9月四半期：病院・診療所79,891＋薬局25,848（座標なし10件は非表示）。健康保険の療養機関のみ"),
                  l3("zoom 12 起顯示單點，之下為密度熱區（格網計數；類別篩選只作用於單點）", "Individual facilities from zoom 12, a density heatmap (grid counts) below it; the type filter applies to individual points only", "ズーム12から1件ずつ表示、それ以下は密度ヒートマップ（格子集計。種別フィルタは個別表示のみ）")],
    popupNotes: [],
    sourceOrg: "건강보험심사평가원 전국 병의원 및 약국 현황 (공공데이터포털)", sourceUrl: DG("15051059"), license: "공공누리 제1유형（출처표시）", fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓醫院與藥局載入中", "Loading South Korea hospitals and pharmacies", "韓国の病院・薬局を読み込み中"),
  },
  {
    key: "krFireStations", file: "kr_fire_stations.pmtiles", sourceLayer: "kr_fire_stations", geom: "point", layerId: "kr-fire-stations-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#ef4444", tier: "M", count: 1213,
    catProp: "kind",
    cats: [
      { id: "station", values: ["소방서"], color: "#ef4444", label: l3("消防署（소방서）", "Fire station (HQ)", "消防署") },
      { id: "center", values: ["119안전센터"], color: "#f59e0b", label: l3("119 安全中心", "119 safety centre", "119安全センター") },
    ],
    title: { props: ["name"], fallback: l3("消防機關", "Fire service", "消防機関") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: { "소방서": l3("消防署", "Fire station", "消防署"), "119안전센터": l3("119 安全中心", "119 safety centre", "119安全センター") } },
             { prop: "hq", label: l3("所屬本部", "Headquarters", "所属本部") }, { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "registered", label: l3("登錄日", "Registered", "登録日") }],
    legendNotes: [l3("消防署 215＋119 安全中心 998；救助隊、救急隊與消防栓未涵蓋", "215 fire stations + 998 safety centres; rescue and ambulance units and hydrants are not covered", "消防署215＋119安全センター998。救助隊・救急隊・消火栓は未収録"),
                  l3("名冊為 2025 年 9 月版，早於 2026 年 7 月光州、全南合併與仁川改區；座標與地址所在道（시·도）不符的 3 筆未上圖", "List dated Sept 2025, before the July 2026 Gwangju–Jeonnam merger and Incheon district reform; 3 entries whose coordinates fall outside their address's province are not shown", "名簿は2025年9月版（2026年7月の光州・全南統合と仁川の区再編前）。座標が住所の道と合わない3件は非表示")],
    popupNotes: [],
    sourceOrg: "소방청 전국소방서 좌표현황 (공공데이터포털)", sourceUrl: DG("15138232"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓消防機關載入中", "Loading South Korea fire services", "韓国の消防機関を読み込み中"),
  },
  {
    key: "krCivilDefenseShelters", file: "kr_civil_defense_shelters.pmtiles", sourceLayer: "kr_civil_defense_shelters", geom: "point", layerId: "kr-civil-defense-shelters-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 3 }, color: "#22c55e", tier: "M", count: 17247,
    catProp: "kind",
    cats: [
      { id: "public", values: ["공공용시설"], color: "#22c55e", label: l3("公共用設施（공공용시설）", "Public-use facility", "公共用施設") },
      { id: "gov", values: ["정부지원시설"], color: "#f59e0b", label: l3("政府支援設施（정부지원시설）", "Government-funded shelter", "政府支援施設") },
    ],
    title: { props: ["name"], fallback: l3("民防避難設施", "Civil defence shelter", "民防避難施設") },
    fields: [{ prop: "kind", label: l3("設施類別", "Type", "施設区分"), map: { "공공용시설": l3("公共用設施", "Public-use facility", "公共用施設"), "정부지원시설": l3("政府支援設施", "Government-funded", "政府支援施設") } },
             { prop: "level", label: l3("地上／地下", "Above / below ground", "地上／地下"), map: { "지하": l3("地下", "Underground", "地下"), "지상": l3("地上", "Above ground", "地上") } },
             { prop: "capacity", label: l3("最大收容人數", "Max capacity", "最大収容人数") }, { prop: "area_m2", label: l3("面積（㎡）", "Area (m²)", "面積（㎡）") },
             { prop: "status", label: l3("營運狀態", "Status", "運営状態"), map: { "사용중": l3("使用中", "In use", "使用中"), "일시중지": l3("暫停", "Suspended", "一時中止") } },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "designated", label: l3("指定日", "Designated", "指定日") },
             { prop: "updated", label: l3("最後修改", "Last modified", "最終更新") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("使用中＋暫停 17,247 處（多為公寓、大樓地下停車場等法定指定設施）；已停止使用 1,591 處、無座標 8 處未上圖", "17,247 shelters in use or suspended (mostly designated basements and underground car parks); 1,591 decommissioned and 8 without coordinates are not shown", "使用中・一時中止の17,247か所（多くはマンション等の地下駐車場の指定施設）。使用中止1,591・座標なし8は非表示"),
                  l3("酷暑／寒流庇護所未涵蓋", "Heat- and cold-wave shelters are not covered", "暑さ・寒さ避難所は未収録")],
    popupNotes: [l3("來源的「最大收容人數」有 17,000 筆與面積（㎡）數值相同，可能是以面積代填，不宜直接當人數", "In 17,000 records the source's max capacity equals the floor area (m²) and may be a placeholder; do not read it as a head count", "出典の最大収容人数は17,000件で面積（㎡）と同値で、面積の代入の可能性あり。人数としての利用は不適")],
    sourceOrg: "행정안전부 민방위대피시설 (LOCALDATA, 공공데이터포털)", sourceUrl: DG("15044951"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓民防避難設施載入中", "Loading South Korea civil defence shelters", "韓国の民防避難施設を読み込み中"),
  },
  {
    key: "krPoliceBoxes", file: "kr_police_boxes.pmtiles", sourceLayer: "kr_police_boxes", geom: "point", layerId: "kr-police-boxes-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#3b82f6", tier: "M", count: 1544,
    catProp: "kind",
    cats: [
      { id: "district", values: ["지구대"], color: "#3b82f6", label: l3("地區隊（지구대）", "Police district unit (jigudae)", "地区隊（지구대）") },
      { id: "box", values: ["파출소"], color: "#a78bfa", label: l3("派出所（파출소）", "Police box (pachulso)", "派出所（파출소）") },
    ],
    title: { props: ["name"], fallback: l3("派出所", "Police box", "派出所") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: { "지구대": l3("地區隊", "District unit", "地区隊"), "파출소": l3("派出所", "Police box", "派出所") } },
             { prop: "station", label: l3("所屬警察署", "Police station", "所属警察署") }, { prop: "agency", label: l3("地方警察廳", "Provincial agency", "地方警察庁") },
             { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "precision", label: l3("定位精度", "Geocode precision", "位置精度"), map: { "시설": l3("OSM 設施點", "OSM facility", "OSM施設"), "門牌": l3("門牌", "House number", "番地") } }],
    legendNotes: [l3("名冊 2,047 處只有地址；以 Nominatim 補座標，只上設施點與門牌精度 1,544 處（75%），其餘 503 處未定位、未上圖", "The list of 2,047 has addresses only; geocoded with Nominatim and only facility- or house-level matches are shown (1,544, 75%); 503 unlocated", "名簿2,047件は住所のみ。Nominatimで位置付けし、施設・番地精度の1,544件（75%）のみ表示、503件は未表示"),
                  l3("廣域市定位率偏低（大田 19%、釜山 23%、蔚山 31%、大邱 32%、光州 38%、首爾 44%、仁川 44%；道級 81–98%），都市點少是未定位，不代表派出所少", "Match rates are low in metropolitan cities (Daejeon 19%, Busan 23%, Ulsan 31%, Daegu 32%, Gwangju 38%, Seoul 44%, Incheon 44%; provinces 81–98%) — sparse city points mean unlocated, not fewer police boxes", "広域市は位置付け率が低い（大田19%・釜山23%・蔚山31%・大邱32%・光州38%・ソウル44%・仁川44%、道は81–98%）。都市部の点が少ないのは未表示分で、派出所が少ないわけではない"),
                  l3("座標：Nominatim／© OpenStreetMap contributors（ODbL）", "Coordinates: Nominatim / © OpenStreetMap contributors (ODbL)", "座標：Nominatim／© OpenStreetMap contributors（ODbL）")],
    popupNotes: [l3("位置由地址比對 OpenStreetMap 推得，可能有數十公尺偏差", "Location derived by matching the address to OpenStreetMap; may be off by tens of metres", "位置は住所とOpenStreetMapの照合による推定で、数十m程度ずれる場合あり")],
    sourceOrg: "경찰청 전국 지구대 파출소 주소 현황 (공공데이터포털)；座標 Nominatim／© OpenStreetMap contributors", sourceUrl: DG("15077036"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W7_FETCHED_AT,
    loading: l3("南韓派出所載入中", "Loading South Korea police boxes", "韓国の派出所を読み込み中"),
  },
  // ───────────── 第 8 波：文化、觀光、生活據點 ─────────────
  {
    key: "krLibraries", file: "kr_libraries.pmtiles", sourceLayer: "kr_libraries", geom: "point", layerId: "kr-libraries-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#38bdf8", tier: "M", count: 3472,
    catProp: "kind", otherColor: "#94a3b8", otherLabel: l3("其他（學校、身障、專門、大學）", "Other (school, accessible, special, university)", "その他（学校・障害者・専門・大学）"),
    cats: [
      { id: "public", values: ["공공도서관"], color: "#38bdf8", label: l3("公共圖書館（공공도서관）", "Public library", "公共図書館") },
      { id: "small", values: ["작은도서관"], color: "#a78bfa", label: l3("小型圖書館（작은도서관）", "Small library", "小さな図書館") },
      { id: "children", values: ["어린이도서관"], color: "#f59e0b", label: l3("兒童圖書館（어린이도서관）", "Children's library", "子ども図書館") },
    ],
    title: { props: ["name"], fallback: l3("圖書館", "Library", "図書館") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: { "공공도서관": l3("公共圖書館", "Public", "公共図書館"), "작은도서관": l3("小型圖書館", "Small library", "小さな図書館"), "어린이도서관": l3("兒童圖書館", "Children's", "子ども図書館"), "학교도서관": l3("學校圖書館", "School", "学校図書館"), "장애인도서관": l3("身障圖書館", "Accessible", "障害者図書館"), "전문도서관": l3("專門圖書館", "Special", "専門図書館"), "대학도서관": l3("大學圖書館", "University", "大学図書館") } },
             { prop: "operator", label: l3("運營機關", "Operator", "運営機関") }, { prop: "closed", label: l3("休館日", "Closed", "休館日") },
             { prop: "weekday", label: l3("平日開放", "Weekday hours", "平日開館") }, { prop: "seats", label: l3("閱覽座位", "Seats", "閲覧席") },
             { prop: "books", label: l3("藏書（冊）", "Books", "蔵書（冊）") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "provider", label: l3("提供機關", "Data provider", "提供機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("3,472 館（小型圖書館 2,097、公共圖書館 1,308）；學校、大學圖書館只有少數機關申報，不代表全國", "3,472 libraries (2,097 small, 1,308 public); school and university libraries are reported by only a few agencies", "3,472館（小さな図書館2,097・公共図書館1,308）。学校・大学図書館は一部機関の申告のみ"),
                  l3("無座標 111 館未上圖", "111 without coordinates are not shown", "座標なし111館は非表示")],
    popupNotes: [],
    sourceOrg: "문화체육관광부 전국도서관표준데이터 (공공데이터포털)", sourceUrl: DGS("15013109"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓圖書館載入中", "Loading South Korea libraries", "韓国の図書館を読み込み中"),
  },
  {
    key: "krMuseums", file: "kr_museums.pmtiles", sourceLayer: "kr_museums", geom: "point", layerId: "kr-museums-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#f472b6", tier: "M", count: 873,
    catProp: "kind",
    cats: [
      { id: "museum", values: ["박물관"], color: "#f472b6", label: l3("博物館（박물관）", "Museum", "博物館") },
      { id: "gallery", values: ["미술관"], color: "#a78bfa", label: l3("美術館（미술관）", "Art gallery", "美術館") },
    ],
    title: { props: ["name"], fallback: l3("博物館", "Museum", "博物館") },
    fields: [{ prop: "kind", label: l3("類別", "Type", "種別"), map: { "박물관": l3("博物館", "Museum", "博物館"), "미술관": l3("美術館", "Art gallery", "美術館") } },
             { prop: "type", label: l3("種類", "Category", "種類") },
             { prop: "founder", label: l3("設立主體", "Founded by", "設立主体"), map: { "국립": l3("國立", "National", "国立"), "공립": l3("公立", "Public", "公立"), "사립": l3("私立", "Private", "私立"), "대학": l3("大學", "University", "大学") } },
             { prop: "opened", label: l3("開館日", "Opened", "開館日") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "updated", label: l3("最後修改", "Last modified", "最終更新") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("依《博物館及美術館振興法》登錄、營業中的 873 館；歇業 92、無座標 119 未上圖，同館由市與區重複登錄的 184 筆已合併", "873 registered, operating museums and galleries; 92 closed and 119 without coordinates are not shown, and 184 duplicate city/district registrations were merged", "博物館・美術館振興法に基づく登録館で営業中の873館。閉館92・座標なし119は非表示、市と区の重複登録184件は統合"),
                  l3("首爾幾乎未涵蓋：名冊中首爾只有 1 館（首爾市的館不在這份全國名冊，原因未查證）；未登錄的展示館、文化院、文藝會館也未涵蓋", "Seoul is almost entirely missing: the national list has only 1 Seoul entry (reason not verified); unregistered exhibition halls, cultural centres and arts halls are not covered either", "ソウルはほぼ未収録（全国名簿にソウルは1館のみ、理由は未確認）。未登録の展示館・文化院・文芸会館も未収録")],
    popupNotes: [],
    sourceOrg: "행정안전부 박물관·미술관 (LOCALDATA, 공공데이터포털)", sourceUrl: DG("15045093"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓博物館與美術館載入中", "Loading South Korea museums and galleries", "韓国の博物館・美術館を読み込み中"),
  },
  {
    key: "krPerformances", file: "kr_performances.pmtiles", sourceLayer: "kr_performances", geom: "point", layerId: "kr-performances-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#f472b6", tier: "M", count: 9552,
    catProp: "year_group",
    cats: [
      { id: "y2026", values: ["2026"], color: "#f472b6", label: l3("2026 年", "2026", "2026年") },
      { id: "y2025", values: ["2025"], color: "#a78bfa", label: l3("2025 年", "2025", "2025年") },
      { id: "older", values: ["2024_or_earlier"], color: "#94a3b8", label: l3("2024 年以前", "2024 or earlier", "2024年以前"), faded: true },
    ],
    title: { props: ["name"], fallback: l3("公演活動", "Performance", "公演") },
    fields: [{ prop: "venue", label: l3("場地", "Venue", "会場") }, { prop: "start", label: l3("開始日", "Starts", "開始日") }, { prop: "end", label: l3("結束日", "Ends", "終了日") },
             { prop: "time", label: l3("時間", "Time", "時間") }, { prop: "fee", label: l3("票價", "Fee", "料金") }, { prop: "age", label: l3("入場年齡", "Age", "入場年齢") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "provider", label: l3("提供機關", "Data provider", "提供機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("各機關申報的歷年活動清單（2017–2026，9,552 場），不是目前正在舉行的活動；依開始年分色", "A cumulative list of events reported by agencies (2017–2026, 9,552), not what is on now; coloured by start year", "各機関が申告した過去分を含む公演リスト（2017–2026、9,552件）で、現在開催中の一覧ではない。開始年で色分け"),
                  l3("同一場館的多場活動疊在同一點；國家機關申報占多數，地方小型活動不完整；世宗無資料", "Several events at one venue share a point; national agencies dominate and small local events are incomplete; no data for Sejong", "同じ会場の公演は同じ点に重なる。国の機関の申告が多く地方の小規模公演は不完全。世宗はデータなし")],
    popupNotes: [l3("同一點可能疊了多場活動，這裡只顯示其中一場", "Several events may share this point; only one is shown", "同じ点に複数の公演が重なる場合があり、ここでは1件のみ表示")],
    sourceOrg: "전국공연행사정보표준데이터 (공공데이터포털)", sourceUrl: DGS("15013106"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓公演活動載入中", "Loading South Korea performances", "韓国の公演を読み込み中"),
  },
  {
    key: "krFestivals", file: "kr_festivals.pmtiles", sourceLayer: "kr_festivals", geom: "point", layerId: "kr-festivals-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#fb7185", tier: "M", count: 1113,
    catProp: "year_group",
    cats: [
      { id: "y2026", values: ["2026"], color: "#fb7185", label: l3("2026 年", "2026", "2026年") },
      { id: "y2025", values: ["2025"], color: "#f59e0b", label: l3("2025 年", "2025", "2025年") },
      { id: "older", values: ["2024_or_earlier"], color: "#94a3b8", label: l3("2024 年以前", "2024 or earlier", "2024年以前"), faded: true },
    ],
    title: { props: ["name"], fallback: l3("文化祭", "Festival", "祭り") },
    fields: [{ prop: "venue", label: l3("會場", "Venue", "会場") }, { prop: "start", label: l3("開始日", "Starts", "開始日") }, { prop: "end", label: l3("結束日", "Ends", "終了日") },
             { prop: "desc", label: l3("內容", "Description", "内容") }, { prop: "host", label: l3("主辦", "Organiser", "主催") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "provider", label: l3("提供機關", "Data provider", "提供機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("自治團體申報的文化祭，每點一屆（1,113 屆）；檔案逐年累積，同一祭典可能有多屆多點；依開始年分色", "Festivals reported by local governments, one point per edition (1,113); the file accumulates by year, so a festival may appear more than once; coloured by start year", "自治体が申告した祭り（1回ごとに1点、1,113件）。年ごとに累積するため同じ祭りが複数回載る場合あり。開始年で色分け"),
                  l3("無座標 231 屆未上圖", "231 without coordinates are not shown", "座標なし231件は非表示")],
    popupNotes: [],
    sourceOrg: "전국문화축제표준데이터 (공공데이터포털)", sourceUrl: DGS("15013104"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓文化祭載入中", "Loading South Korea festivals", "韓国の祭りを読み込み中"),
  },
  {
    key: "krHeritage", file: "kr_heritage.pmtiles", sourceLayer: "kr_heritage", geom: "point", layerId: "kr-heritage-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 3 }, color: "#f59e0b", tier: "M", count: 10197,
    catProp: "cat",
    cats: [
      { id: "national", values: ["national"], color: "#f59e0b", label: l3("國家指定（國寶、寶物、史蹟、名勝、天然紀念物、民俗）", "National designation (treasures, historic sites, scenic sites, natural monuments, folklore)", "国指定（国宝・宝物・史跡・名勝・天然記念物・民俗）") },
      { id: "provincial", values: ["provincial"], color: "#a78bfa", label: l3("市道指定", "Provincial designation", "市道指定") },
      { id: "registered", values: ["registered"], color: "#38bdf8", label: l3("登錄文化遺產", "Registered heritage", "登録文化遺産") },
      { id: "material", values: ["material"], color: "#94a3b8", label: l3("文化遺產資料", "Heritage material", "文化遺産資料") },
    ],
    title: { props: ["name"], fallback: l3("國家遺產", "Heritage", "国家遺産") },
    fields: [{ prop: "name_hanja", label: l3("漢字名", "Hanja name", "漢字名") }, { prop: "grade", label: l3("指定種別", "Designation", "指定種別") },
             { prop: "region", label: l3("地區", "Region", "地域") }, { prop: "heritage_no", label: l3("指定號", "Designation no.", "指定番号"), kind: "code" },
             { prop: "registered", label: l3("登錄日", "Recorded", "登録日") }],
    legendNotes: [l3("有座標、未解除指定的 10,197 處；無形遺產 829 筆（座標是保有者所在地）與無座標的可移動文物 4,886 筆未上圖", "10,197 designated items with coordinates; 829 intangible heritage items (located at the holder) and 4,886 movable items without coordinates are not shown", "座標があり指定解除されていない10,197件。無形遺産829件（保持者の所在地）と座標のない動産文化財4,886件は非表示"),
                  l3("文物（書畫、典籍等）的點是收藏地，不是出土地", "Points for movable objects (paintings, books) mark where they are kept, not where they were found", "書画・典籍などの点は所蔵地で、出土地ではない")],
    popupNotes: [],
    sourceOrg: "국가유산청 국가유산 목록 Open API (khs.go.kr)", sourceUrl: "https://www.khs.go.kr/cha/SearchKindOpenapiList.do", license: "未標示授權（API 端點無條款）", fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓國家遺產載入中", "Loading South Korea heritage", "韓国の国家遺産を読み込み中"),
  },
  {
    key: "krLodging", file: "kr_lodging.pmtiles", sourceLayer: "kr_lodging", geom: "point", layerId: "kr-lodging-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 3 }, color: "#fb7185", tier: "S", count: 30358,
    catProp: "cat",
    cats: [
      { id: "hotel", values: ["hotel"], color: "#f59e0b", label: l3("飯店（관광／일반호텔）", "Hotel", "ホテル") },
      { id: "condo", values: ["condo"], color: "#22c55e", label: l3("渡假公寓（휴양콘도）", "Resort condominium", "リゾートコンド") },
      { id: "motel", values: ["motel"], color: "#fb7185", label: l3("旅館與旅人宿（여관／여인숙）", "Inn / motel (yeogwan)", "旅館（여관・여인숙）") },
      { id: "residence", values: ["residence"], color: "#38bdf8", label: l3("生活型住宿（생활숙박）", "Serviced residence", "生活型宿泊") },
    ],
    otherColor: "#94a3b8", otherLabel: l3("其他住宿", "Other lodging", "その他の宿泊"),
    title: { props: ["name"], fallback: l3("住宿", "Lodging", "宿泊施設") },
    fields: [{ prop: "kind", label: l3("業態", "Business type", "業態") }, { prop: "rooms", label: l3("客房數", "Rooms", "客室数"), kind: "num", digits: 0 },
             { prop: "licensed", label: l3("許可日", "Licensed", "許可日") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "updated", label: l3("最後修改", "Last modified", "最終更新") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("營業中的住宿業 30,358 處；歇業 27,607、無座標 1,042 未上圖", "30,358 operating lodging businesses; 27,607 closed and 1,042 without coordinates are not shown", "営業中の宿泊業30,358か所。廃業27,607・座標なし1,042は非表示"),
                  l3("農漁村民宿、外國人觀光都市民宿、韓屋體驗業未涵蓋", "Rural homestays, urban guesthouses for foreign tourists and hanok stays are not covered", "農漁村民泊・外国人観光都市民泊・韓屋体験業は未収録")],
    popupNotes: [],
    sourceOrg: "행정안전부 숙박업 (LOCALDATA, 공공데이터포털)", sourceUrl: DG("15044968"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓住宿載入中", "Loading South Korea lodging", "韓国の宿泊施設を読み込み中"),
  },
  {
    key: "krSafeDeliveryBoxes", file: "kr_safe_delivery_boxes.pmtiles", sourceLayer: "kr_safe_delivery_boxes", geom: "point", layerId: "kr-safe-delivery-boxes-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#22c55e", tier: "M", count: 789,
    title: { props: ["name"], fallback: l3("安心宅配櫃", "Safe parcel locker", "安心宅配ボックス") },
    fields: [{ prop: "address", label: l3("地址", "Address", "住所") }, { prop: "weekday", label: l3("平日時間", "Weekday hours", "平日時間") },
             { prop: "free_hours", label: l3("免費保管（小時）", "Free storage (hours)", "無料保管（時間）") }, { prop: "installed", label: l3("設置日", "Installed", "設置日") },
             { prop: "manager", label: l3("管理機關", "Managed by", "管理機関") }, { prop: "provider", label: l3("提供機關", "Data provider", "提供機関") },
             { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("自治團體設置的安心宅配櫃 789 處（免費代收包裹）；89 個機關申報，未申報的市郡區不代表沒有；世宗無資料", "789 safe parcel lockers run by local governments (free parcel pick-up); reported by 89 agencies, so gaps do not mean none; no data for Sejong", "自治体の安心宅配ボックス789か所（無料受け取り）。89機関の申告で、空白はゼロを意味しない。世宗はデータなし")],
    popupNotes: [],
    sourceOrg: "전국안심택배함표준데이터 (공공데이터포털)", sourceUrl: DGS("15034534"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓安心宅配櫃載入中", "Loading South Korea parcel lockers", "韓国の安心宅配ボックスを読み込み中"),
  },
  {
    key: "krSeniorCenters", file: "kr_senior_centers.pmtiles", sourceLayer: "kr_senior_centers", geom: "point", layerId: "kr-senior-centers-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 2 }, color: "#a78bfa", tier: "S", count: 56028,
    catProp: "kind",
    cats: [
      { id: "senior", values: ["경로당"], color: "#a78bfa", label: l3("敬老堂（경로당）", "Senior centre (gyeongnodang)", "敬老堂（경로당）") },
      { id: "both", values: ["마을회관및경로당"], color: "#38bdf8", label: l3("里民會館兼敬老堂", "Village hall with senior centre", "村会館兼敬老堂") },
      { id: "hall", values: ["마을회관"], color: "#f59e0b", label: l3("里民會館（마을회관）", "Village hall (maeul hoegwan)", "村会館（마을회관）") },
    ],
    title: { props: ["name"], fallback: l3("敬老堂", "Senior centre", "敬老堂") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: { "경로당": l3("敬老堂", "Senior centre", "敬老堂"), "마을회관및경로당": l3("里民會館兼敬老堂", "Village hall + senior centre", "村会館兼敬老堂"), "마을회관": l3("里民會館", "Village hall", "村会館") } },
             { prop: "status", label: l3("營運狀態", "Status", "運営状態"), map: { "영업": l3("營運中", "Open", "運営中"), "휴업": l3("暫停", "Suspended", "休止") } },
             { prop: "built", label: l3("建立日", "Built", "建立日") }, { prop: "area_m2", label: l3("建物面積（㎡）", "Floor area (m²)", "建物面積（㎡）") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "manager", label: l3("管理機關", "Managed by", "管理機関") },
             { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("163 個機關申報的 56,028 處；首爾只有 12 區申報，未申報區不代表沒有敬老堂", "56,028 reported by 163 agencies; only 12 Seoul districts reported, so gaps do not mean none", "163機関が申告した56,028か所。ソウルは12区のみで、空白はゼロを意味しない"),
                  l3("歇業 327、同名同座標重複 2,295 筆未上圖", "327 closed and 2,295 duplicates are not shown", "廃止327・重複2,295件は非表示")],
    popupNotes: [],
    sourceOrg: "전국마을회관및경로당표준데이터 (공공데이터포털)", sourceUrl: DGS("15114136"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W8_FETCHED_AT,
    loading: l3("南韓敬老堂載入中", "Loading South Korea senior centres", "韓国の敬老堂を読み込み中"),
  },
  // ───────────── 第 9 波：產業園區、環境噪音、舊衣回收箱 ─────────────
  {
    // V-5：面＋代表點（`kr_industrial_complexes_points.pmtiles`，登記在 repPointLayers，預設點）；KOGL 4 原樣、單獨成層
    key: "krIndustrialComplexes", file: "kr_industrial_complexes.pmtiles", sourceLayer: "kr_industrial_complexes", geom: "polygon",
    layerId: "kr-industrial-complexes-fill", outlineId: "kr-industrial-complexes-line",
    srcMinzoom: 4, srcMaxzoom: 14, minzoom: 4, color: "#a78bfa", count: 1372,
    catProp: "DANJI_TYPE",
    cats: [
      { id: "national", values: ["1"], color: "#f472b6", label: l3("國家產業園區（국가산업단지）", "National industrial complex", "国家産業団地") },
      { id: "general", values: ["2"], color: "#a78bfa", label: l3("一般產業園區（일반산업단지）", "General industrial complex", "一般産業団地") },
      { id: "hightech", values: ["3"], color: "#38bdf8", label: l3("都市尖端產業園區（도시첨단산업단지）", "Urban high-tech industrial complex", "都市先端産業団地") },
      { id: "agri", values: ["4"], color: "#84cc16", label: l3("農工園區（농공단지）", "Agro-industrial complex", "農工団地") },
    ],
    title: { props: ["DAN_NAME"], fallback: l3("產業園區", "Industrial complex", "産業団地") },
    fields: [{ prop: "DANJI_TYPE", label: l3("園區類型", "Type", "団地種別"), map: { "1": l3("國家產業園區", "National", "国家"), "2": l3("一般產業園區", "General", "一般"), "3": l3("都市尖端產業園區", "Urban high-tech", "都市先端"), "4": l3("農工園區", "Agro-industrial", "農工") } },
             { prop: "GOSI", label: l3("告示", "Official notice", "告示") }, { prop: "REMARK", label: l3("備註", "Remarks", "備考") },
             { prop: "DAN_ID", label: l3("園區代碼", "Complex ID", "団地コード"), kind: "code" }],
    legendNotes: [l3("公共著作物第 4 類（KOGL 4）：須標示出處、禁止商業使用、禁止變更；本層原樣呈現邊界與屬性、未改作", "KOGL Type 4: attribution required, no commercial use, no modification; boundaries and attributes are shown as published, unmodified", "公共ヌリ第4類型（出典表示・商用禁止・改変禁止）。境界と属性は原データのまま表示し、改変していない"),
                  l3("1,372 處：國家 65、一般 771、都市尖端 53、農工 483（同一園區可能分成多筆）", "1,372 areas: national 65, general 771, urban high-tech 53, agro-industrial 483 (one complex may span several records)", "1,372か所：国家65・一般771・都市先端53・農工483（1団地が複数件に分かれる場合あり）")],
    popupNotes: [l3("KOGL 4：非商用、未改作", "KOGL 4: non-commercial, unmodified", "KOGL 4：非商用・改変なし")],
    sourceOrg: "국토교통부 산업단지 경계도면 (공공데이터포털)", sourceUrl: DG("15152766"), license: KOGL4_LICENSE, fetchedAt: KR_W9_FETCHED_AT,
    loading: l3("南韓產業園區載入中", "Loading South Korea industrial complexes", "韓国の産業団地を読み込み中"),
  },
  {
    key: "krNoiseSites", file: "kr_noise_sites.pmtiles", sourceLayer: "kr_noise_sites", geom: "point", layerId: "kr-noise-sites-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#f59e0b", tier: "M", count: 546,
    catProp: "network",
    cats: [
      { id: "road", values: ["도로"], color: "#f59e0b", label: l3("道路噪音測點", "Roadside site", "道路沿い測定点") },
      { id: "general", values: ["일반"], color: "#38bdf8", label: l3("一般地區測點", "General-area site", "一般地域測定点") },
    ],
    title: { props: ["name"], fallback: l3("噪音測點", "Noise monitoring site", "騒音測定点") },
    fields: [{ prop: "network", label: l3("測定網", "Network", "測定網"), map: { "도로": l3("道路", "Roadside", "道路"), "일반": l3("一般地區", "General area", "一般地域") } },
             { prop: "zone_class", label: l3("噪音環境標準地區", "Noise standard zone", "騒音環境基準の地域区分"),
               map: { "가": l3("가：綠地、專用住宅、醫院與學校周邊", "Ga: green, exclusive residential, hospital/school areas", "가：緑地・専用住居・病院学校周辺"),
                      "나": l3("나：一般住宅、準住宅", "Na: general and semi-residential", "나：一般住居・準住居"),
                      "다": l3("다：商業、準工業", "Da: commercial and semi-industrial", "다：商業・準工業"),
                      "라": l3("라：一般工業、專用工業", "Ra: general and exclusive industrial", "라：一般工業・専用工業") } },
             { prop: "land_use", label: l3("用途", "Land use", "用途") }, { prop: "address", label: l3("地址", "Address", "住所") }],
    legendNotes: [l3("韓國環境公團環境噪音測定網 546 個測點（道路 331、一般 215）；只有位置，沒有測值", "546 Korea Environment Corporation noise monitoring sites (roadside 331, general 215); locations only, no readings", "韓国環境公団の環境騒音測定網546地点（道路331・一般215）。位置のみで測定値なし")],
    popupNotes: [],
    sourceOrg: "한국환경공단 환경소음 측정망 지점 정보 (공공데이터포털)", sourceUrl: DG("15093409"), license: KR_PLATFORM_LICENSE, fetchedAt: KR_W9_FETCHED_AT,
    loading: l3("南韓噪音測點載入中", "Loading South Korea noise monitoring sites", "韓国の騒音測定点を読み込み中"),
  },
  {
    key: "krClothingBins", file: "kr_clothing_bins.pmtiles", sourceLayer: "kr_clothing_bins", geom: "point", layerId: "kr-clothing-bins-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 2.5 }, color: "#2dd4bf", tier: "M", count: 20931,
    title: { props: ["place", "address"], fallback: l3("舊衣回收箱", "Clothing collection bin", "古着回収ボックス") },
    fields: [{ prop: "address", label: l3("地址", "Address", "住所") }, { prop: "dong", label: l3("行政洞", "Administrative dong", "行政洞") },
             { prop: "provider", label: l3("提供機關", "Provided by", "提供機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("57 個市郡區自行公開的清單合併，涵蓋 11 個市道（釜山、大邱、蔚山、世宗、忠北沒有可用座標檔）；空白不代表沒有回收箱", "Merged from lists published by 57 cities and districts, covering 11 provinces (Busan, Daegu, Ulsan, Sejong and North Chungcheong have no usable coordinate files); gaps do not mean no bins", "57の市郡区が個別に公開したリストを統合。11の広域自治体をカバー（釜山・大邱・蔚山・世宗・忠清北道は座標付きファイルなし）。空白は回収箱がないことを意味しない"),
                  l3("只有地址、沒有座標的 19 份清單未上圖；瑞草區清單為 KOGL 4（禁止變更），不併入", "19 address-only lists are not shown; the Seocho-gu list is KOGL Type 4 (no modification) and is not merged", "住所のみの19件は非表示。瑞草区のリストはKOGL第4類型（改変禁止）のため統合しない"),
                  l3("重複 2,103 筆、座標落在提供機關轄區外 25 筆未上圖", "2,103 duplicates and 25 points outside the provider's own district are not shown", "重複2,103件・提供機関の管轄外に落ちる25件は非表示")],
    popupNotes: [],
    sourceOrg: "각 시·군·구 의류수거함 위치 (공공데이터포털 파일데이터 57건)", sourceUrl: "https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=%EC%9D%98%EB%A5%98%EC%88%98%EA%B1%B0%ED%95%A8", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W9_FETCHED_AT,
    loading: l3("南韓舊衣回收箱載入中", "Loading South Korea clothing collection bins", "韓国の古着回収ボックスを読み込み中"),
  },  // ───────────── 第 10 波：動物醫院、地方文化院、傳統寺剎、保護樹、漁場、自行車停放處、民防給水、安全緊急鈴、體驗休養村、屠宰場、首爾用途地域 ─────────────
  {
    key: "krAnimalHospitals", file: "kr_animal_hospitals.pmtiles", sourceLayer: "kr_animal_hospitals", geom: "point", layerId: "kr-animal-hospitals-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#fb923c", tier: "M", count: 5255,
    title: { props: ["name"], fallback: l3("動物醫院", "Animal hospital", "動物病院") },
    fields: [{ prop: "address", label: l3("地址", "Address", "住所") }, { prop: "licensed", label: l3("許可日", "Licensed", "許可日") },
             { prop: "updated", label: l3("資料更新日", "Record updated", "データ更新日") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("營業中 5,255 處（LOCALDATA 동물병원）；歇業、停業不收，無座標 243 處未上圖", "5,255 animal hospitals in business (LOCALDATA); closed or suspended ones excluded, 243 without coordinates not shown", "営業中の5,255か所（LOCALDATA）。廃業・休業は除外、座標なし243か所は非表示"),
                  l3("名稱為事業登記的招牌名；電話不顯示", "Names are registered business names; phone numbers not shown", "名称は事業の登録名。電話番号は表示しない")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 동물병원 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/animal_hospitals/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓動物醫院載入中", "Loading South Korea animal hospitals", "韓国の動物病院を読み込み中"),
  },
  {
    key: "krLocalCultureCenters", file: "kr_local_culture_centers.pmtiles", sourceLayer: "kr_local_culture_centers", geom: "point", layerId: "kr-local-culture-centers-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#c084fc", tier: "M", count: 171,
    title: { props: ["name"], fallback: l3("地方文化院", "Local culture centre", "地方文化院") },
    fields: [{ prop: "kind", label: l3("法人類別", "Corporate type", "法人種別") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "licensed", label: l3("許可日", "Licensed", "許可日") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("地方文化院 171 處（13/16 個市道）；名冊沒有首爾、釜山、仁川的資料（未涵蓋，不代表沒有）", "171 local culture centres (13 of 16 provinces); the register has no entries for Seoul, Busan or Incheon (not covered, not zero)", "地方文化院171か所（16広域のうち13）。名簿にソウル・釜山・仁川の記載なし（未収録であり、ゼロではない）"),
                  l3("無座標 20 處未上圖", "20 entries without coordinates not shown", "座標なし20か所は非表示")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 지방문화원 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/local_culture_centers/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓地方文化院載入中", "Loading South Korea local culture centres", "韓国の地方文化院を読み込み中"),
  },
  {
    key: "krTraditionalTemples", file: "kr_traditional_temples.pmtiles", sourceLayer: "kr_traditional_temples", geom: "point", layerId: "kr-traditional-temples-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#f59e0b", tier: "M", count: 1599,
    catProp: "designation", otherColor: "#94a3b8", otherLabel: l3("未填", "Not recorded", "未記入"),
    cats: [
      { id: "designated", values: ["지정"], color: "#f59e0b", label: l3("指定（지정）", "Designated", "指定") },
      { id: "approved", values: ["승인"], color: "#fb7185", label: l3("承認（승인）", "Approved", "承認") },
    ],
    title: { props: ["name"], fallback: l3("傳統寺剎", "Traditional temple", "伝統寺刹") },
    fields: [{ prop: "designation", label: l3("指定類別", "Designation", "指定区分"), map: { "지정": l3("指定", "Designated", "指定"), "승인": l3("承認", "Approved", "承認") } },
             { prop: "founded", label: l3("創立年代", "Founded", "創建") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "licensed", label: l3("登錄日", "Registered", "登録日") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("傳統寺剎保存法登錄的 1,599 處；不含一般寺院與其他宗教", "1,599 temples registered under the Traditional Temples Preservation Act; ordinary temples and other religions not included", "伝統寺刹保存法に登録された1,599か所。一般の寺院や他宗教は含まない"),
                  l3("無座標 307 處未上圖；沿革全文與僧侶人數不顯示", "307 without coordinates not shown; history text and monk counts not shown", "座標なし307か所は非表示。沿革全文・僧侶数は表示しない")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 전통사찰 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/traditional_temples/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓傳統寺剎載入中", "Loading South Korea traditional temples", "韓国の伝統寺刹を読み込み中"),
  },
  {
    key: "krProtectedTrees", file: "kr_protected_trees.pmtiles", sourceLayer: "kr_protected_trees", geom: "point", layerId: "kr-protected-trees-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, heat: { intensity: 2.5 }, color: "#22c55e", tier: "M", count: 12308,
    catProp: "grade", otherColor: "#94a3b8", otherLabel: l3("未填", "Not recorded", "未記入"),
    cats: [
      { id: "province", values: ["도나무"], color: "#16a34a", label: l3("道樹（도나무）", "Provincial tree", "道の木") },
      { id: "city", values: ["시·군나무"], color: "#22c55e", label: l3("市郡樹（시·군나무）", "City/county tree", "市・郡の木") },
      { id: "township", values: ["면나무"], color: "#84cc16", label: l3("面樹（면나무）", "Township tree", "面の木") },
      { id: "village", values: ["마을나무"], color: "#facc15", label: l3("村樹（마을나무）", "Village tree", "村の木") },
    ],
    title: { props: ["species"], fallback: l3("保護樹", "Protected tree", "保護樹") },
    fields: [{ prop: "sci_name", label: l3("學名", "Scientific name", "学名") }, { prop: "grade", label: l3("品格", "Grade", "品格") },
             { prop: "age", label: l3("樹齡", "Age", "樹齢"), kind: "num", unit: "yr" }, { prop: "height_m", label: l3("樹高", "Height", "樹高"), kind: "num", unit: "m", digits: 1 },
             { prop: "girth_cm", label: l3("胸圍", "Girth", "幹周"), kind: "num", unit: "cm" }, { prop: "count", label: l3("株數", "Trees", "本数"), kind: "num" },
             { prop: "designated", label: l3("指定日", "Designated", "指定日") }, { prop: "designation_no", label: l3("指定編號", "Designation no.", "指定番号"), kind: "code" },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("保護樹 12,308 株；已解除指定 127、座標在南韓外 30、座標落在別的市道 327 筆未上圖", "12,308 protected trees; 127 de-designated, 30 outside South Korea and 327 placed in another province are not shown", "保護樹12,308本。指定解除127、韓国外30、別の広域に落ちる327件は非表示"),
                  l3("以下機關提供的座標有整批偏移，位置僅供參考：寧越郡、河東郡、曾坪郡、洪川郡（落在別的市道者已剔除，留下的點也可能偏移）、靈岩郡（多數點落在珍島、海南）", "Coordinates from these agencies are shifted in bulk; positions are indicative only: Yeongwol, Hadong, Jeungpyeong, Hongcheon (points in other provinces removed; remaining ones may still be shifted) and Yeongam (most points fall in Jindo/Haenam)", "次の機関の座標は一括でずれており、位置は参考程度：寧越郡・河東郡・曽坪郡・洪川郡（別の広域に落ちる点は除外、残りもずれの可能性）、霊岩郡（多くが珍島・海南に落ちる）"),
                  l3("所有者只有類別（個人／公共／團體），沒有姓名", "Ownership is recorded only as a category (private/public/group), no names", "所有者は区分（個人・公共・団体）のみで氏名なし")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 보호수 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/protected_tree_info/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓保護樹載入中", "Loading South Korea protected trees", "韓国の保護樹を読み込み中"),
  },
  {
    // 許可狀態以資料快照日（rp_date 2024-04-24）判斷：lcns_end_y（YYYYMMDD）早於快照日＝「快照日前已到期」另成一類（灰），其餘依漁業區分上色
    key: "krFishingGrounds", file: "kr_fishing_grounds.pmtiles", sourceLayer: "kr_fishing_grounds", geom: "polygon",
    layerId: "kr-fishing-grounds-fill", outlineId: "kr-fishing-grounds-line",
    srcMinzoom: 4, srcMaxzoom: 12, minzoom: 4, color: "#2dd4bf", count: 14858,
    catProp: "fids_se",
    derivedCat: { expr: KR_FISHING_CAT_EXPR, of: krFishingCat },
    cats: [
      { id: "aquaculture", values: ["양식어업", "양식어업(한정)"], color: "#2dd4bf", label: l3("養殖漁業（양식어업）", "Aquaculture", "養殖漁業") },
      { id: "village", values: ["마을어업", "마을어업(한정)"], color: "#38bdf8", label: l3("村落漁業（마을어업）", "Village fishery", "村落漁業") },
      { id: "setnet", values: ["정치망어업"], color: "#a78bfa", label: l3("定置網漁業（정치망어업）", "Set-net fishery", "定置網漁業") },
      { id: "expired", values: [KR_FISHING_EXPIRED], color: "#94a3b8", label: l3("快照日 2024-04-24 前許可已到期（是否續約不明）", "Licence ended before the 2024-04-24 snapshot (renewal unknown)", "2024-04-24の時点で許可期間終了（更新の有無は不明）") },
    ],
    title: { props: ["fids_knd", "fids_se"], fallback: l3("漁場", "Fishing ground", "漁場") },
    fields: [{ prop: "lcns_end_y", label: l3("許可期間", "Licence period", "免許期間"), kind: "permit" },
             { prop: "fids_se", label: l3("漁業區分", "Fishery class", "漁業区分") }, { prop: "fids_mthd", label: l3("漁法", "Method", "漁法") },
             { prop: "farm_knd", label: l3("品種", "Species", "品種") }, { prop: "addr", label: l3("位置", "Location", "位置") },
             { prop: "area", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 1 }, { prop: "rgn_nm", label: l3("市郡", "City/county", "市郡") },
             { prop: "rvsn_yr", label: l3("調查年", "Survey year", "調査年") }, { prop: "lcns_no", label: l3("許可編號", "Licence no.", "免許番号"), kind: "code" }],
    legendNotes: [l3("漁場 14,858 面（調查 2020–2023，資料快照 2024-04-24），涵蓋 11 個沿海市道；內陸的首爾、大邱、大田、世宗、忠北不適用", "14,858 fishing grounds (surveyed 2020–2023, snapshot 2024-04-24) in all 11 coastal provinces; inland Seoul, Daegu, Daejeon, Sejong and North Chungcheong not applicable", "漁場14,858面（調査2020–2023、スナップショット2024-04-24）。沿岸11広域をカバー。内陸のソウル・大邱・大田・世宗・忠清北道は対象外"),
                  l3("快照日前許可已到期 3,010 面照原樣保留、以灰色顯示，不刪除", "3,010 grounds whose licence ended before the snapshot are kept and shown in grey, not removed", "スナップショット時点で免許期間が終了した3,010面はそのまま残し灰色で表示（削除しない）"),
                  l3("拉遠時圖磚略去小面，放大到 8 級起完整顯示；許可人姓名不在資料中", "Small grounds are dropped when zoomed out; complete from zoom 8. No licensee names in the data", "縮小時は小さい面を省略、ズーム8から全件表示。免許者の氏名はデータに含まれない")],
    popupNotes: [],
    sourceOrg: "해양수산부 국립해양조사원 어장정보 (공공데이터포털)", sourceUrl: "https://www.data.go.kr/data/15130109/fileData.do", license: "공공누리 제1유형（출처표시）", fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓漁場載入中", "Loading South Korea fishing grounds", "韓国の漁場を読み込み中"),
  },
  {
    key: "krBicycleParking", file: "kr_bicycle_parking.pmtiles", sourceLayer: "kr_bicycle_parking", geom: "point", layerId: "kr-bicycle-parking-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, heat: { intensity: 2 }, color: "#38bdf8", tier: "M", count: 18220,
    catProp: "install_type", otherColor: "#94a3b8", otherLabel: l3("未填", "Not recorded", "未記入"),
    cats: [
      { id: "rack", values: ["거치형"], color: "#38bdf8", label: l3("車架式（거치형）", "Rack", "ラック式") },
      { id: "standalone", values: ["단독형"], color: "#2dd4bf", label: l3("獨立式（단독형）", "Stand-alone", "単独型") },
      { id: "fence", values: ["휀스형"], color: "#a78bfa", label: l3("圍欄式（휀스형）", "Fenced", "フェンス型") },
      { id: "other", values: ["기타"], color: "#f472b6", label: l3("其他形式（기타）", "Other type", "その他の形式") },
    ],
    title: { props: ["name"], fallback: l3("自行車停放處", "Bicycle parking", "自転車駐輪場") },
    fields: [{ prop: "racks", label: l3("保管台數", "Spaces", "収容台数"), kind: "num" }, { prop: "installed_year", label: l3("設置年", "Installed", "設置年") },
             { prop: "shade", label: l3("遮陽", "Shelter", "日よけ"), map: KR_YN }, { prop: "air_pump", label: l3("打氣機", "Air pump", "空気入れ"), map: KR_YN },
             { prop: "repair_stand", label: l3("修車台", "Repair stand", "修理台"), map: KR_YN }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("自行車停放處 18,220 處；無座標 124、南韓外或海上 9、座標落在別的市道 162 筆未上圖", "18,220 bicycle parking sites; 124 without coordinates, 9 outside South Korea or at sea and 162 placed in another province are not shown", "駐輪場18,220か所。座標なし124・韓国外または海上9・別の広域に落ちる162件は非表示"),
                  l3("以下機關提供的座標有整批偏移，位置僅供參考：羅州市（110 筆落在首爾）、大邱壽城區（41 筆落在慶南）；落在別的市道者已剔除，留下的點也可能偏移", "Coordinates from these agencies are shifted in bulk; positions are indicative only: Naju (110 points fell in Seoul) and Suseong-gu, Daegu (41 fell in Gyeongnam); points in other provinces removed, remaining ones may still be shifted", "次の機関の座標は一括でずれており、位置は参考程度：羅州市（110件がソウルに）、大邱寿城区（41件が慶南に）。別の広域に落ちる点は除外、残りもずれの可能性")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 자전거보관소 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/bicycle_parking_info/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓自行車停放處載入中", "Loading South Korea bicycle parking", "韓国の駐輪場を読み込み中"),
  },
  {
    // 設施名稱（含私人水井所有人姓名）資料端整欄不輸出；地址只顯示到門牌（去掉附註的建物名），避免帶出私人名稱
    key: "krCivilDefenseWater", file: "kr_civil_defense_water.pmtiles", sourceLayer: "kr_civil_defense_water", geom: "point", layerId: "kr-civil-defense-water-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#22d3ee", tier: "M", count: 5464,
    catProp: "facility_type", otherColor: "#94a3b8", otherLabel: l3("未填", "Not recorded", "未記入"),
    cats: [
      { id: "public", values: ["공공용시설"], color: "#22d3ee", label: l3("公共用設施（공공용시설）", "Public-use facility", "公共用施設") },
      { id: "gov", values: ["정부지원시설"], color: "#3b82f6", label: l3("政府支援設施（정부지원시설）", "Government-funded facility", "政府支援施設") },
      { id: "local", values: ["지자체시설"], color: "#a78bfa", label: l3("自治體設施（지자체시설）", "Local-government facility", "自治体施設") },
    ],
    title: { props: [], fallback: l3("民防緊急給水設施", "Civil defence emergency water", "民防緊急給水施設") },
    fields: [{ prop: "facility_type", label: l3("設施類別", "Facility type", "施設区分") }, { prop: "status", label: l3("使用狀態", "Status", "使用状態"), map: { "사용중": l3("使用中", "In use", "使用中") } },
             { prop: "address", label: l3("地址", "Address", "住所"), kind: "addrBase" }, { prop: "licensed", label: l3("指定日", "Designated", "指定日") }],
    legendNotes: [l3("使用中 5,464 處；停用 5,296 處不收，無座標 321 處未上圖", "5,464 facilities in use; 5,296 decommissioned excluded, 321 without coordinates not shown", "使用中の5,464か所。使用中止5,296か所は除外、座標なし321か所は非表示"),
                  l3("設施名稱不顯示（原資料含私人水井所有人姓名）；地址只顯示到門牌", "Facility names are not shown (the source includes private well owners' names); addresses shown to street number only", "施設名は表示しない（原データに私有井戸の所有者名を含むため）。住所は番地まで")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 민방위급수시설 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/civil_defense_water_facilities/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓民防給水設施載入中", "Loading South Korea civil defence water facilities", "韓国の民防給水施設を読み込み中"),
  },
  {
    key: "krEmergencyBells", file: "kr_emergency_bells.pmtiles", sourceLayer: "kr_emergency_bells", geom: "point", layerId: "kr-emergency-bells-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 10, heat: { intensity: 1.5 }, color: "#ef4444", tier: "M", count: 87711,
    catProp: "place_type",
    cats: [
      { id: "street", values: ["가로변"], color: "#ef4444", label: l3("路邊（가로변）", "Roadside", "路側") },
      { id: "park", values: ["공원"], color: "#22c55e", label: l3("公園（공원）", "Park", "公園") },
      { id: "toilet", values: ["화장실"], color: "#38bdf8", label: l3("廁所（화장실）", "Toilet", "トイレ") },
      { id: "building", values: ["건물"], color: "#a78bfa", label: l3("建物（건물）", "Building", "建物") },
      { id: "parking", values: ["주차장"], color: "#f59e0b", label: l3("停車場（주차장）", "Car park", "駐車場") },
      { id: "etc", values: ["기타"], color: "#f472b6", label: l3("其他場所（기타）", "Other place", "その他の場所") },
    ],
    title: { props: ["place", "bell_no"], fallback: l3("安全緊急鈴", "Emergency bell", "安全非常ベル") },
    fields: [{ prop: "purpose", label: l3("設置目的", "Purpose", "設置目的"), map: { "방범용": l3("防範犯罪", "Crime prevention", "防犯"), "약자보호": l3("保護弱勢", "Protecting vulnerable people", "弱者保護"), "기타": l3("其他", "Other", "その他") } },
             { prop: "police_link", label: l3("連動警方", "Linked to police", "警察連動"), map: KR_YN }, { prop: "security_link", label: l3("連動保全", "Linked to security firm", "警備会社連動"), map: KR_YN },
             { prop: "office_link", label: l3("連動管理室", "Linked to management office", "管理室連動"), map: KR_YN }, { prop: "features", label: l3("功能", "Functions", "機能") },
             { prop: "installed_year", label: l3("設置年", "Installed", "設置年") }, { prop: "last_check", label: l3("最近點檢", "Last inspected", "直近点検") },
             { prop: "address", label: l3("地址", "Address", "住所") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "bell_no", label: l3("鈴號", "Bell no.", "ベル番号"), kind: "code" }],
    legendNotes: [l3("安全緊急鈴 87,711 支（同地點多支逐支保留）；無座標 13、南韓外或海上 13、座標落在別的市道 897 筆未上圖", "87,711 emergency bells (several at one spot are kept individually); 13 without coordinates, 13 outside South Korea or at sea and 897 placed in another province are not shown", "安全非常ベル87,711基（同一地点の複数基はそれぞれ残す）。座標なし13・韓国外または海上13・別の広域に落ちる897件は非表示"),
                  l3("以下機關提供的座標有整批偏移或用佔位值，位置僅供參考：泗川市（249 筆落在仁川，已剔除）、沃川郡多個機關（36.0／127.0 一類整數座標，落在本道內者保留）", "Coordinates from these agencies are shifted in bulk or placeholders; positions are indicative only: Sacheon (249 fell in Incheon, removed) and several Okcheon agencies (round values such as 36.0/127.0; those inside the province are kept)", "次の機関の座標は一括でずれているか仮の値で、位置は参考程度：泗川市（249件が仁川に落ち除外）、沃川郡の複数機関（36.0／127.0 のような整数座標。道内に落ちるものは残す）")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 안전비상벨 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/emergency_call_box_info/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓安全緊急鈴載入中", "Loading South Korea emergency bells", "韓国の安全非常ベルを読み込み中"),
  },
  {
    key: "krRuralExperienceVillages", file: "kr_rural_experience_villages.pmtiles", sourceLayer: "kr_rural_experience_villages", geom: "point", layerId: "kr-rural-experience-villages-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#84cc16", tier: "M", count: 1097,
    title: { props: ["name"], fallback: l3("農漁村體驗休養村", "Rural experience village", "農漁村体験休養村") },
    fields: [{ prop: "program_type", label: l3("體驗類別", "Programme types", "体験区分") }, { prop: "programs", label: l3("體驗項目", "Programmes", "体験内容") },
             { prop: "designated", label: l3("指定日", "Designated", "指定日") }, { prop: "address", label: l3("地址", "Address", "住所") },
             { prop: "homepage", label: l3("網站", "Website", "ウェブサイト") }, { prop: "agency", label: l3("管理機關", "Agency", "管理機関") }, { prop: "ref_date", label: l3("資料基準日", "Data as of", "データ基準日") }],
    legendNotes: [l3("2023-05-12 名冊 1,097 村（13/16 個市道）；首爾、釜山、大邱未涵蓋（不代表沒有）", "1,097 villages from the 2023-05-12 register (13 of 16 provinces); Seoul, Busan and Daegu not covered (not zero)", "2023-05-12時点の名簿1,097村（16広域のうち13）。ソウル・釜山・大邱は未収録（ゼロではない）"),
                  l3("代表者姓名與電話不顯示", "Representatives' names and phone numbers are not shown", "代表者名・電話番号は表示しない")],
    popupNotes: [],
    sourceOrg: "한국농어촌공사 농어촌체험휴양마을 (공공데이터포털)", sourceUrl: "https://www.data.go.kr/data/15132811/fileData.do", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓體驗休養村載入中", "Loading South Korea rural experience villages", "韓国の体験休養村を読み込み中"),
  },
  {
    key: "krSlaughterhouses", file: "kr_slaughterhouses.pmtiles", sourceLayer: "kr_slaughterhouses", geom: "point", layerId: "kr-slaughterhouses-circle",
    srcMinzoom: 0, srcMaxzoom: 14, minzoom: 0, color: "#f87171", tier: "M", count: 111,
    title: { props: ["name"], fallback: l3("屠宰場", "Slaughterhouse", "と畜場") },
    fields: [{ prop: "address", label: l3("地址", "Address", "住所") }, { prop: "licensed", label: l3("許可日", "Licensed", "許可日") },
             { prop: "updated", label: l3("資料更新日", "Record updated", "データ更新日") }, { prop: "manage_no", label: l3("管理編號", "Management no.", "管理番号"), kind: "code" }],
    legendNotes: [l3("營業中 111 處（LOCALDATA 도축업，12/16 個市道）；首爾、釜山、大田、世宗未涵蓋", "111 slaughterhouses in business (LOCALDATA, 12 of 16 provinces); Seoul, Busan, Daejeon and Sejong not covered", "営業中の111か所（LOCALDATA、16広域のうち12）。ソウル・釜山・大田・世宗は未収録"),
                  l3("歇業、停業不收，無座標 23 處未上圖；畜禽飼養場不在本層", "Closed or suspended ones excluded, 23 without coordinates not shown; livestock farms not included", "廃業・休業は除外、座標なし23か所は非表示。畜産農場は含まない")],
    popupNotes: [],
    sourceOrg: "행정안전부 지방행정 인허가데이터(LOCALDATA) 도축업 (공공데이터포털)", sourceUrl: "https://file.localdata.go.kr/file/download/slaughterhouses/info", license: KR_PLATFORM_LICENSE, fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("南韓屠宰場載入中", "Loading South Korea slaughterhouses", "韓国のと畜場を読み込み中"),
  },
  {
    // DISPLAY_ONLY（pulse-data registry/_display_only.yaml）：data.go.kr 註「제3자 권리 포함」，不入分析倉庫
    key: "krSeoulZoning", file: "kr_seoul_zoning.pmtiles", sourceLayer: "kr_seoul_zoning", geom: "polygon",
    layerId: "kr-seoul-zoning-fill", outlineId: "kr-seoul-zoning-line",
    srcMinzoom: 8, srcMaxzoom: 14, minzoom: 8, color: "#facc15", count: 8318,
    catProp: "zone_group",
    cats: [
      { id: "exclusive", values: ["전용주거"], color: "#fde68a", label: l3("專用住宅（전용주거）", "Exclusive residential", "専用住居") },
      { id: "general", values: ["일반주거"], color: "#facc15", label: l3("一般住宅（일반주거）", "General residential", "一般住居") },
      { id: "semi", values: ["준주거"], color: "#fb923c", label: l3("準住宅（준주거）", "Semi-residential", "準住居") },
      { id: "commercial", values: ["상업"], color: "#f43f5e", label: l3("商業（상업）", "Commercial", "商業") },
      { id: "industrial", values: ["공업"], color: "#a78bfa", label: l3("工業（공업）", "Industrial", "工業") },
      { id: "green", values: ["녹지"], color: "#22c55e", label: l3("綠地（녹지）", "Green", "緑地") },
      { id: "etc", values: ["기타"], color: "#64748b", label: l3("其他都市地域（기타）", "Other urban area", "その他の都市地域") },
    ],
    title: { props: ["DGM_NM"], fallback: l3("用途地域", "Zoning district", "用途地域") },
    fields: [{ prop: "zone_group", label: l3("大類", "Group", "大分類") }, { prop: "DGM_AR", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" },
             { prop: "WTNNC_SN", label: l3("決定告示號", "Decision notice no.", "決定告示番号"), kind: "code" }, { prop: "CREATE_DAT", label: l3("建立日", "Created", "作成日") }],
    legendNotes: [l3("只涵蓋首爾（1/16 個市道，示範）；其他市道未涵蓋", "Seoul only (1 of 16 provinces, demonstration); other provinces not covered", "ソウルのみ（16広域のうち1、試行）。他の広域は未収録"),
                  l3("首爾平台標公共著作物第 1 類（KOGL 1），data.go.kr 註明含第三方權利：本層只做展示，不進分析倉庫", "Seoul's portal marks it KOGL Type 1, but data.go.kr notes third-party rights: display only, not in the analysis warehouse", "ソウル市のポータルは公共ヌリ第1類型だが、data.go.krは第三者の権利を含むと注記。表示のみで分析倉庫には入れない"),
                  l3("用途地域名照原值（60 多種寫法），大類由本站歸併", "District names are shown as published (60+ spellings); groups are assigned by this site", "用途地域名は原データのまま（60種以上の表記）、大分類は本サイトで集約")],
    popupNotes: [l3("只做展示，不進分析倉庫（含第三方權利）", "Display only, not in the analysis warehouse (third-party rights)", "表示のみ（第三者の権利を含むため分析倉庫に入れない）")],
    sourceOrg: "서울특별시 도시계획 용도지역 (서울 열린데이터광장 OA-21136)", sourceUrl: "https://data.seoul.go.kr/dataList/OA-21136/S/65/datasetView.do", license: "공공누리 제1유형（출처표시）；data.go.kr 註「제3자 권리 포함」", fetchedAt: KR_W10_FETCHED_AT,
    loading: l3("首爾用途地域載入中", "Loading Seoul zoning districts", "ソウルの用途地域を読み込み中"),
  },
];

export const KR_SPEC_BY_KEY: Readonly<Record<KrDataKey, KrLayerSpec>> = Object.fromEntries(KR_DATA_SPECS.map((s) => [s.key, s])) as Record<KrDataKey, KrLayerSpec>;
export const KR_UNNAMED = UNNAMED;

/** X003 擁擠度分級：以 `peak_wkd` 數值判斷（hook 用 step 表達式，圖例用同一組門檻）。 */
export const KR_CONGESTION_BREAKS = [34, 80, 130] as const;

/** 序列分級面的色階（色盤庫暗／淡版重新取樣成「斷點數＋1」級；圖例與 hook 共用）。 */
export function krRampColors(spec: Pick<KrLayerSpec, "ramp">, isDark: boolean): string[] {
  const r = spec.ramp!;
  return resampleRamp(paletteRamp(r.palette, isDark)!, r.breaks.length + 1);
}

export function pickL3(text: L3, locale: string): string {
  return locale === "ja" ? text.ja : locale === "en" ? text.en : text.zh;
}

// ─────────────────────────── V-4 類別篩選（分類多選）與 V-1 縮放區間共用 ───────────────────────────


/** 多選「其他」選項的固定 id（圖例有「其他」列的層才有）。 */
export const KR_CAT_OTHER_ID = "other";
export interface KrFilterGroup { id: string; values: readonly string[] }

/** 規格的多選選項 id（宣告順序；有 `otherLabel` 者最後加「其他」）。 */
export const krCatOptionIds = (spec: Pick<KrLayerSpec, "cats" | "otherLabel">): string[] =>
  spec.cats ? [...spec.cats.map((c) => c.id), ...(spec.otherLabel ? [KR_CAT_OTHER_ID] : [])] : [];

/**
 * 分類多選 → Mapbox filter。`getter` 是回傳字串的表達式（屬性值轉字串；subway 用擁擠度分級表達式）。
 * 全選／未傳 → null（不篩、含缺值 feature）；全關 → 永假 sentinel；選了「其他」→ 補上「不屬於任何已列類別」。
 */
export function krGroupFilter(getter: unknown, groups: readonly KrFilterGroup[], withOther: boolean, mask: number | undefined): unknown[] | null {
  if (mask === undefined || !Number.isFinite(mask)) return null;
  const ids = [...groups.map((g) => g.id), ...(withOther ? [KR_CAT_OTHER_ID] : [])];
  const selected = selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return null;
  if (selected.length === 0) return ["==", getter, "__multi_select_none__"];
  const chosen = groups.filter((g) => selected.includes(g.id)).flatMap((g) => [...g.values]);
  const hit = ["in", getter, ["literal", chosen]];
  if (!selected.includes(KR_CAT_OTHER_ID)) return hit;
  const other = ["!", ["in", getter, ["literal", groups.flatMap((g) => [...g.values])]]];
  return chosen.length ? ["any", hit, other] : other;
}

/** 屬性值（含數值型）統一轉字串，缺值＝""。 */
export const krStringProp = (prop: string): unknown[] => ["to-string", ["coalesce", ["get", prop], ""]];

/** 規格的分類篩選 filter（subway 以平日尖峰擁擠度分級當類別）。 */
export function krSpecCatFilter(spec: KrLayerSpec, mask: number | undefined): unknown[] | null {
  if (!spec.cats) return null;
  const getter = spec.key === "krSeoulSubwayCongestion"
    ? ["case", ["has", "peak_wkd"], ["step", ["to-number", ["get", "peak_wkd"], 0], "<34", KR_CONGESTION_BREAKS[0], "34-80", KR_CONGESTION_BREAKS[1], "80-130", KR_CONGESTION_BREAKS[2], ">=130"], ""]
    : spec.derivedCat ? spec.derivedCat.expr : krStringProp(spec.catProp!);
  return krGroupFilter(getter, spec.cats, !!spec.otherLabel, mask);
}
