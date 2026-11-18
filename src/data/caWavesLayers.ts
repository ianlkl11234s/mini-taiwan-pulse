/**
 * 加拿大第 3–8 波（2026-11-17）圖層規格 SSOT：規格驅動 36 層，畫法重用菲律賓引擎（`PhLayerSpec`＋`usePhDataLayer`）。
 * 資料端：taipei-gis-analytics #402（`docs/topic-research/canada_opendata/waves/w0{3…8}/layer-plan.md`、`HANDOFF-ca-3-8.md`）；
 * 類別與筆數以成品 GeoJSON 實際值為準（不照 layer-plan 草稿）。
 * 主 agent 決定（2026-11-17）：
 * - 野火點加回年份欄（依年代上色）；授權仍未確認，只上位置與年份。
 * - 多倫多開發申請：Toronto CKAN 授權欄仍是 notspecified，OGL-Toronto 條文沒寫適用全站 → 維持只上位置，圖例寫「授權未明示」。
 * - ODBus 不輸出名稱；BC 家庭式托育、LODE 個人藝術家不上圖。
 * - 土壤：沒有土綱的多邊形標「未涵蓋」（只畫外框），不畫成其他類。
 * - 乾旱、開發申請在圖例寫快照日期 2026-11-17。
 * 沒有資料的省區一律寫「未涵蓋」，不當 0；「該省沒有」（內陸無潮位站、沒有冰川）與「未涵蓋」分開寫。
 */
import type { CaWaveKey } from "./caWavesKeys";
import { phCatOptionIds, type L3, type PhCat, type PhCatGetter, type PhField, type PhLayerSpec, type PhNote, type PhPart } from "./phDataLayers";

export interface CaWaveSpec extends PhLayerSpec<CaWaveKey> {
  /** 類別多選預設勾選（省略＝全選；例：LODE 運動的步道 14 萬點預設關） */
  catDefault?: readonly string[];
}

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (id: string): PhCatGetter => ({ expr: ["to-string", id], js: () => id });
const cat = (id: string, color: string, zh: string, en: string, ja: string, extra: Partial<PhCat> = {}): PhCat => ({ id, values: [id], color, label: l3(zh, en, ja), ...extra });
const catMap = (cats: readonly PhCat[]): Record<string, L3> => Object.fromEntries(cats.flatMap((c) => c.values.map((v) => [v, c.label])));
const pt = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: getter, ...extra });
const fill = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, fillOpacity: number, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "fill", minzoom, cat: getter, fillOpacity, ...extra });
const line = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "line", minzoom, cat: getter, ...extra });
const isLine: unknown[] = ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString"]]];
const isPoint: unknown[] = ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]];

export const CA_WAVES_FETCHED_AT = "2026-11-17";
const OGL_CA = "Open Government Licence – Canada";
const OGL_BC = "Open Government Licence – British Columbia";
const OGL_ON = "Open Government Licence – Ontario";
const OGL_TO = "Open Government Licence – Toronto";
const MB_OD = "Manitoba Open Data Licence";

const PROV: PhField = { prop: "province", label: l3("省區", "Province / territory", "州・準州") };
const CITY: PhField = { prop: "city", label: l3("城市", "City", "都市") };
const PROVIDER: PhField = { prop: "provider", label: l3("提供機關", "Provider", "提供機関") };
const loading = (zh: string, en: string): L3 => l3(`加拿大${zh}載入中`, `Loading Canada ${en}`, `カナダの${zh}を読み込み中`);
/** n／13 省區有資料；其餘是未涵蓋（不是沒有）。 */
const COVER = (n: number, missing: string): L3 => l3(
  `有資料的省區 ${n}／13；${missing} 未涵蓋，不代表沒有`,
  `Data in ${n} of 13 provinces/territories; ${missing} not covered, not empty`,
  `データがある州・準州は 13 中 ${n}。${missing} は未収録で、存在しないという意味ではない`,
);
const COVER_ALL = l3("13 省區都有資料", "All 13 provinces/territories covered", "13 州・準州すべて収録");
const TORONTO_ONLY = l3("只有多倫多市（1／13），其他城市與省區未涵蓋", "City of Toronto only (1 of 13); other cities and provinces not covered", "トロント市のみ（13 中 1）。その他の都市・州は未収録");

// ───────── LODE（StatCan 開放資料庫）共用：官方座標實心、OSM 補點空心 ─────────
const LODE_HOLLOW = { when: ["==", ["to-string", ["coalesce", ["get", "coord_source"], ""]], "nominatim"], js: (p: Record<string, unknown>) => str(p.coord_source) === "nominatim",
  label: l3("空心＝OSM 補點（Nominatim 地理編碼）", "Hollow = OSM gap-fill (geocoded with Nominatim)", "白抜き＝OSM 補完（Nominatim でジオコーディング）") };
const PRECISION: PhField = { prop: "geocode_precision", label: l3("定位方式", "Location method", "位置の特定方法"), map: {
  official: l3("官方座標", "Official coordinates", "公式座標"), address: l3("門牌比對", "Address match", "番地照合"),
  street: l3("路段（位置為路段，非門牌）", "Street segment (not the exact address)", "路線（番地ではなく路線上）"), name_match: l3("設施名比對", "Facility-name match", "施設名照合"),
} };
const PRECISION_NOTE: PhNote = { text: l3("位置為路段，不是門牌", "Location is a street segment, not the exact address", "位置は路線上で番地ではない"), when: (p) => str(p.geocode_precision) === "street" };
const LODE_ODBL = l3("空心點是 OSM 補點：官方名冊只有地址，經 Nominatim 地理編碼（© OpenStreetMap contributors，ODbL）", "Hollow points are OSM gap-fills: addresses from the official list geocoded with Nominatim (© OpenStreetMap contributors, ODbL)", "白抜きは OSM 補完：公式名簿の住所を Nominatim でジオコーディング（© OpenStreetMap contributors、ODbL）");
const lodeSrc = (db: string) => `Statistics Canada, ${db} (LODE)（${OGL_CA}）；OSM 補點：© OpenStreetMap contributors（ODbL），經 Nominatim 地理編碼`;
const LODE_LICENSE = `${OGL_CA}（官方）＋ODbL 1.0（OSM 補點）`;
const LODE_URL = "https://www.statcan.gc.ca/en/lode/databases";

// ═════════════════════════ 第 2 波 C002 ＋ 第 3 波 ═════════════════════════

const MARITIME_ZONE_CATS: readonly PhCat[] = [
  cat("territorial_sea", "#38bdf8", "領海（12 浬）", "Territorial sea (12 NM)", "領海（12 海里）", { parts: ["ca-maritime-zones-fill"] }),
  cat("contiguous_zone", "#818cf8", "鄰接區（24 浬）", "Contiguous zone (24 NM)", "接続水域（24 海里）", { parts: ["ca-maritime-zones-fill"] }),
  cat("eez", "#2dd4bf", "專屬經濟區（200 浬）", "Exclusive economic zone (200 NM)", "排他的経済水域（200 海里）", { parts: ["ca-maritime-zones-fill"] }),
  cat("overlapping_claim", "#f59e0b", "加美重疊主張區（不併入 EEZ）", "Canada–US overlapping claim (not part of the EEZ)", "カナダ・米国の主張重複区域（EEZ に含めない）", { parts: ["ca-maritime-zones-fill"] }),
];
const MARITIME_LINE_CATS: readonly PhCat[] = [
  { id: "line_treaty", values: ["Treaty"], color: "#e5e7eb", label: l3("界線：條約", "Boundary: treaty", "境界：条約"), parts: ["ca-maritime-boundaries-line"] },
  { id: "line_court", values: ["Court ruling"], color: "#fbbf24", label: l3("界線：判決", "Boundary: court ruling", "境界：判決"), parts: ["ca-maritime-boundaries-line"] },
  { id: "line_median", values: ["Median line"], color: "#a78bfa", label: l3("界線：中線", "Boundary: median line", "境界：中間線"), parts: ["ca-maritime-boundaries-line"] },
  { id: "line_unsettled", values: ["Unsettled (maritime)", "Unilateral claim (undisputed)"], color: "#f87171", label: l3("界線：未定或單方主張", "Boundary: unsettled or unilateral claim", "境界：未確定・一方的主張"), parts: ["ca-maritime-boundaries-line"] },
  { id: "line_other", values: ["200 NM", "Straight baseline", "Connection line"], color: "#94a3b8", label: l3("界線：200 浬線、直線基線、連接線", "Boundary: 200 NM line, straight baseline, connection line", "境界：200 海里線・直線基線・接続線"), parts: ["ca-maritime-boundaries-line"] },
];
const ZONE_FIELD: PhField = { prop: "zone", label: l3("海域", "Zone", "海域"), map: catMap(MARITIME_ZONE_CATS) };

const PERMAFROST_CATS: readonly PhCat[] = [
  cat("C", "#1e40af", "連續（90–100%）", "Continuous (90–100%)", "連続（90–100%）"),
  cat("E", "#3b82f6", "廣泛不連續（50–90%）", "Extensive discontinuous (50–90%)", "広範不連続（50–90%）"),
  cat("S", "#60a5fa", "零星（10–50%）", "Sporadic discontinuous (10–50%)", "散在（10–50%）"),
  cat("I", "#bfdbfe", "孤立（0–10%）", "Isolated patches (0–10%)", "孤立（0–10%）"),
  cat("O", "#a78bfa", "海底永凍土", "Subsea permafrost", "海底永久凍土"),
];
const NO_PERMAFROST: unknown[] = ["!=", ["to-string", ["coalesce", ["get", "pmf_class"], ""]], "U"];

const DAM_CATS: readonly PhCat[] = [
  cat("BC", "#38bdf8", "卑詩省（BC Dams）", "British Columbia (BC Dams)", "ブリティッシュコロンビア州（BC Dams）"),
  cat("ON", "#a78bfa", "安大略省（Ontario Dam Inventory）", "Ontario (Ontario Dam Inventory)", "オンタリオ州（Ontario Dam Inventory）"),
];
const RECYCLE_CATS: readonly PhCat[] = [
  cat("QC", "#22c55e", "魁北克（生態中心、市政投放點）", "Québec (ecocentres, municipal drop-off)", "ケベック州（エコセンター・自治体回収拠点）"),
  cat("MB", "#a3e635", "曼尼托巴（回收投放點）", "Manitoba (recycling depots)", "マニトバ州（リサイクル回収拠点）"),
];
const FLOOD_INV_CATS: readonly PhCat[] = [
  cat("fully or partially publicly available", "#38bdf8", "研究範圍：成果公開（全部或部分）", "Study area: results public (fully or partly)", "調査範囲：成果公開（全部・一部）"),
  cat("not publicly available", "#94a3b8", "研究範圍：成果未公開", "Study area: results not public", "調査範囲：成果非公開"),
];
const AB_FLOOD_CATS: readonly PhCat[] = [
  cat("Floodway", "#1d4ed8", "洪水道（Floodway）", "Floodway", "洪水路（Floodway）"),
  cat("High Hazard Flood Fringe", "#ef4444", "高危險洪泛邊緣", "High hazard flood fringe", "高危険氾濫原周縁"),
  cat("Flood Fringe", "#f59e0b", "洪泛邊緣", "Flood fringe", "氾濫原周縁"),
  cat("Protected Flood Fringe", "#a3e635", "受保護洪泛邊緣", "Protected flood fringe", "保護された氾濫原周縁"),
  cat("Overland Flow", "#a78bfa", "地表漫流", "Overland flow", "地表流"),
];
const RIVER_CATS: readonly PhCat[] = [
  cat("lake", "#3b82f6", "湖泊（> 1 km²）", "Lake (> 1 km²)", "湖（1 km² 超）", { parts: ["ca-rivers-lakes-fill"] }),
  cat("reservoir_or_other", "#06b6d4", "水庫及其他水體", "Reservoir or other waterbody", "貯水池・その他の水域", { parts: ["ca-rivers-lakes-fill"] }),
  cat("true", "#60a5fa", "有名河段", "Named river", "名前のある河川", { parts: ["ca-rivers-line"] }),
  cat("false", "#93c5fd", "其他河段", "Other river segment", "その他の河川区間", { parts: ["ca-rivers-line"] }),
];

const W3: CaWaveSpec[] = [
  {
    key: "caMaritimeZones", file: "ca_maritime_zones.pmtiles", sourceId: "ca-maritime-zones", srcMinzoom: 1, srcMaxzoom: 9, color: "#2dd4bf", count: 4, opacity: 0.6,
    parts: [fill("ca-maritime-zones-fill", "ca_maritime_zones", 1, propGetter("zone"), 0.35), line("ca-maritime-boundaries-line", "ca_maritime_boundaries", 1, propGetter("line_type"), { dashed: true })],
    cats: [...MARITIME_ZONE_CATS, ...MARITIME_LINE_CATS], dashLabel: null,
    title: { props: ["name", "line_name"], fallback: l3("海域界線", "Maritime boundary", "海域境界") },
    fields: [ZONE_FIELD, { prop: "pol_type", label: l3("類型", "Type", "種別") }, { prop: "line_type", label: l3("界線類型", "Line type", "境界線の種別") },
      { prop: "territory1", label: l3("主權方 1", "Territory 1", "主権者 1") }, { prop: "territory2", label: l3("主權方 2", "Territory 2", "主権者 2") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²" }, { prop: "source1", label: l3("依據", "Source", "根拠") }, { prop: "doc_date", label: l3("文件日期", "Document date", "文書日付") }],
    legendNotes: [l3("來源：VLIZ Marine Regions，非加拿大官方界線（CHS 官方檔未開放）", "Source: VLIZ Marine Regions, not official Canadian boundaries (CHS files not open)", "出典：VLIZ Marine Regions。カナダ公式の境界ではない（CHS 公式データは非公開）"),
      l3("國家級海域，不依省區計", "National maritime zones, not counted by province", "国レベルの海域で州別には数えない")],
    popupNotes: [],
    sourceOrg: "Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12（EEZ、界線）／v4（12、24 浬），marineregions.org", sourceUrl: "https://www.marineregions.org/", license: "CC BY 4.0",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("海域界線", "maritime zones"),
  },
  {
    key: "caPermafrost", file: "ca_permafrost.pmtiles", sourceId: "ca-permafrost", srcMinzoom: 2, srcMaxzoom: 8, color: "#3b82f6", count: 442, opacity: 0.5,
    parts: [fill("ca-permafrost-fill", "ca_permafrost", 2, propGetter("pmf_class"), 1, { filter: NO_PERMAFROST })],
    cats: PERMAFROST_CATS,
    title: { props: ["pmf_e"], fallback: l3("永凍土", "Permafrost", "永久凍土") },
    fields: [{ prop: "pmf_class", label: l3("永凍土分布", "Permafrost extent", "永久凍土の分布"), map: catMap(PERMAFROST_CATS) },
      { prop: "ice_e", label: l3("地下冰含量", "Ground ice content", "地下氷の含有量") }, { prop: "wedge_e", label: l3("冰楔", "Ice wedges", "アイスウェッジ") },
      { prop: "pingo_e", label: l3("冰丘", "Pingos", "ピンゴ") }, { prop: "massive_e", label: l3("塊狀冰", "Massive ice", "塊状氷") }],
    legendNotes: [l3("1993 年地圖（Atlas of Canada 第 5 版）", "1993 map (Atlas of Canada, 5th edition)", "1993 年の地図（Atlas of Canada 第 5 版）"),
      l3("南部無永凍土區不畫（不是未涵蓋）", "Southern areas without permafrost are not drawn (not 'not covered')", "南部の永久凍土なし地域は描画しない（未収録ではない）")],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Permafrost, The Atlas of Canada 5th Edition (1993)", sourceUrl: "https://open.canada.ca/data/en/dataset/d1e2048b-ccff-5852-aaa5-b861bd55c367", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("永凍土", "permafrost"),
  },
  {
    key: "caDams", file: "ca_dams.pmtiles", sourceId: "ca-dams", srcMinzoom: 3, srcMaxzoom: 11, color: "#38bdf8", count: 4377,
    parts: [pt("ca-dams-circle", "ca_dams", 3, propGetter("src"))],
    cats: DAM_CATS,
    title: { props: ["name"], fallback: l3("水壩", "Dam", "ダム") },
    fields: [{ prop: "dam_type", label: l3("型式", "Dam type", "型式") }, { prop: "function", label: l3("用途", "Function", "用途") },
      { prop: "status", label: l3("狀態", "Status", "状態") }, { prop: "year", label: l3("完工年", "Year built", "完成年"), kind: "year" },
      { prop: "consequence", label: l3("失事後果等級", "Failure consequence", "決壊時の影響区分") },
      { prop: "ownership", label: l3("權屬", "Ownership", "所有者区分") }, { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度") }, PROV],
    legendNotes: [COVER(2, "BC、ON 以外 11 省區"), l3("BC 欄位較完整（型式、用途、失事後果）；ON 只有名稱與權屬", "BC records are richer (type, function, consequence); Ontario has name and ownership only", "BC は項目が豊富（型式・用途・決壊影響）、ON は名称と所有者のみ")],
    popupNotes: [],
    sourceOrg: "BC Dams（WRIS，OGL-BC）；Ontario Dam Inventory（LIO，OGL-Ontario）", sourceUrl: "https://catalogue.data.gov.bc.ca/dataset/bc-dams", license: `${OGL_BC}；${OGL_ON}`,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("水壩", "dams"),
  },
  {
    key: "caRecyclingDepots", file: "ca_recycling_depots.pmtiles", sourceId: "ca-recycling-depots", srcMinzoom: 3, srcMaxzoom: 12, color: "#22c55e", count: 2466,
    parts: [pt("ca-recycling-depots-circle", "ca_recycling_depots", 3, propGetter("src"))],
    cats: RECYCLE_CATS,
    title: { props: ["name"], fallback: l3("回收投放點", "Recycling depot", "リサイクル回収拠点") },
    fields: [CITY, { prop: "address", label: l3("地址", "Address", "住所") }, PROV],
    legendNotes: [COVER(2, "QC、MB 以外 11 省區")],
    popupNotes: [],
    sourceOrg: "QC：© Gouvernement du Québec（RECYC-QUÉBEC）／Données Québec；MB：Government of Manitoba, Recycling Depot Locations（OpenMB）",
    sourceUrl: "https://www.donneesquebec.ca/recherche/fr/dataset/00ec17f8-c7f1-414c-9860-a12bd0c91824", license: `CC BY 4.0（QC）；${MB_OD}（MB）`,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("回收投放點", "recycling depots"),
  },
  {
    key: "caFloodMapInventory", file: "ca_flood_map_inventory.pmtiles", sourceId: "ca-flood-map-inventory", srcMinzoom: 3, srcMaxzoom: 10, color: "#38bdf8", count: 675, opacity: 0.5,
    parts: [fill("ca-flood-map-inventory-fill", "ca_flood_map_inventory", 3, propGetter("availability"), 0.5)],
    cats: FLOOD_INV_CATS,
    title: { props: ["study_name"], fallback: l3("洪水圖研究範圍", "Flood mapping study area", "洪水マップ調査範囲") },
    fields: [{ prop: "study_date", label: l3("研究日期", "Study date", "調査日") }, { prop: "status", label: l3("狀態", "Status", "状態"), map: { final: l3("定稿", "Final", "確定"), "under review": l3("審查中", "Under review", "審査中") } },
      { prop: "availability", label: l3("成果公開", "Availability", "公開状況"), map: catMap(FLOOD_INV_CATS) }, { prop: "data_owner", label: l3("資料擁有者", "Data owner", "データ所有者") },
      { prop: "public_link", label: l3("成果連結", "Public link", "公開リンク"), kind: "code" }, PROV],
    legendNotes: [l3("面是洪水圖研究範圍，不是淹水範圍；面外是沒有研究，不代表不會淹", "Polygons are flood-mapping study areas, not flood extents; outside means no study, not no flood risk", "面は洪水マップの調査範囲で浸水範囲ではない。面の外は調査がないだけで浸水しないという意味ではない"),
      COVER(12, "NU")],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Canada Flood Map Inventory (CFM)", sourceUrl: "https://open.canada.ca/data/en/dataset/a13a2575-5bda-4bfd-a9b1-5bd2dd583f09", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("洪水圖研究範圍", "flood map inventory"),
  },
  {
    key: "caAbFloodHazard", file: "ca_ab_flood_hazard.pmtiles", sourceId: "ca-ab-flood-hazard", srcMinzoom: 5, srcMaxzoom: 12, color: "#ef4444", count: 12919, opacity: 0.6,
    parts: [fill("ca-ab-flood-hazard-fill", "ca_ab_flood_hazard", 5, propGetter("zone_detail"), 0.7)],
    cats: AB_FLOOD_CATS,
    title: { props: ["river"], fallback: l3("洪水危險區", "Flood hazard area", "洪水危険区域") },
    fields: [{ prop: "zone_detail", label: l3("分區", "Zone", "区分"), map: catMap(AB_FLOOD_CATS) },
      { prop: "mechanism", label: l3("成因", "Mechanism", "要因"), map: { "Open Water": l3("開放水流", "Open water", "開水面"), "Ice Jam": l3("冰塞", "Ice jam", "アイスジャム") } },
      { prop: "study", label: l3("研究", "Study", "調査") }, PROV],
    legendNotes: [l3("只有亞伯達省（1／13），其他省區未涵蓋", "Alberta only (1 of 13); other provinces not covered", "アルバータ州のみ（13 中 1）。その他の州は未収録"),
      l3("只收法定洪水危險區；1:200、1:500 淹水範圍面未收", "Regulatory flood hazard zones only; 1:200 and 1:500 inundation extents not included", "法定の洪水危険区域のみ。1:200・1:500 の浸水範囲は未収録")],
    popupNotes: [],
    sourceOrg: "Government of Alberta, Flood Hazard Identification Program Mapping", sourceUrl: "https://open.canada.ca/data/en/dataset/d192b9b1-caac-405e-8d2a-ba6b21929c3f", license: "Open Government Licence – Alberta",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("亞伯達洪水危險區", "Alberta flood hazard areas"),
  },
  {
    key: "caGlaciers", file: "ca_glaciers.pmtiles", sourceId: "ca-glaciers", srcMinzoom: 3, srcMaxzoom: 11, color: "#bae6fd", count: 29976, opacity: 0.7,
    parts: [fill("ca-glaciers-fill", "ca_glaciers", 3, constGetter("glacier"), 0.85)],
    cats: [cat("glacier", "#bae6fd", "冰川", "Glacier", "氷河")],
    title: { props: ["name"], fallback: l3("冰川", "Glacier", "氷河") },
    fields: [{ prop: "uid", label: l3("RGI 編號", "RGI ID", "RGI ID"), kind: "code" }, { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", digits: 3, unit: "km²" },
      { prop: "zmax_m", label: l3("最高海拔", "Max elevation", "最高標高"), kind: "num", unit: "m" }, PROV],
    legendNotes: [l3("RGI 7.0，約 2000 年冰川輪廓", "RGI 7.0, glacier outlines around 2000", "RGI 7.0、2000 年頃の氷河輪郭"),
      l3("PE、NS、NB、ON、MB、SK 沒有冰川（不是未涵蓋）", "PE, NS, NB, ON, MB and SK have no glaciers (not 'not covered')", "PE・NS・NB・ON・MB・SK には氷河がない（未収録ではない）")],
    popupNotes: [],
    sourceOrg: "RGI 7.0 Consortium (2023), Randolph Glacier Inventory v7.0, NSIDC", sourceUrl: "https://ihp-wins.unesco.org/dataset/randolph-glacier-inventory-rgi-7-0-glacier-product", license: "CC BY 4.0",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("冰川", "glaciers"),
  },
  {
    key: "caRiversLakes", file: "ca_rivers_lakes.pmtiles", sourceId: "ca-rivers-lakes", srcMinzoom: 2, srcMaxzoom: 10, color: "#3b82f6", count: 290612, opacity: 0.8,
    parts: [fill("ca-rivers-lakes-fill", "ca_rivers_lakes", 2, propGetter("kind"), 0.7),
      line("ca-rivers-line", "ca_rivers", 2, { expr: ["to-string", ["coalesce", ["get", "named"], false]], js: (p) => str(p.named ?? false) }, { lineWidth: { true: [1.2, 2.2], false: [0.5, 1] } })],
    cats: RIVER_CATS,
    title: { props: ["name", "nom"], fallback: l3("河湖", "River or lake", "河川・湖") },
    fields: [{ prop: "nom", label: l3("法文名", "French name", "フランス語名"), unlessSameAs: "name" }, { prop: "area_km2", label: l3("水體面積", "Water area", "水域面積"), kind: "num", digits: 1, unit: "km²" }, PROV],
    legendNotes: [l3("1:1,000,000 全國水系；小溪與 1 km² 以下水體未收", "National 1:1,000,000 hydrography; small streams and waterbodies under 1 km² omitted", "全国 1:1,000,000 水系。小河川と 1 km² 未満の水域は未収録")],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Atlas of Canada National Scale Data 1:1,000,000 (Rivers, Waterbodies)", sourceUrl: "https://open.canada.ca/data/en/dataset/87bb794c-eabf-5eea-bdb3-61d0338d9594", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("河湖", "rivers and lakes"),
  },
];

// ═════════════════════════ 第 4 波 ═════════════════════════

const PA_CATS: readonly PhCat[] = [
  { id: "pa", values: ["Protected area (PA)"], color: "#22c55e", label: l3("保護區", "Protected area", "保護区") },
  { id: "pa_interim", values: ["Interim - protected area (PA)"], color: "#86efac", label: l3("保護區（暫定）", "Protected area (interim)", "保護区（暫定）") },
  { id: "oecm", values: ["Other effective area-based conservation measure (OECM)", "Interim - other effective area-based conservation measure (OECM)"], color: "#f59e0b", label: l3("OECM 其他有效保育地（含暫定）", "OECM (incl. interim)", "OECM その他の効果的な保全地域（暫定含む）") },
  { id: "pa_na", values: ["Not applicable"], color: "#94a3b8", label: l3("不適用", "Not applicable", "該当なし") },
];
const HABITAT_TAXA: Record<string, L3> = {
  1: l3("兩棲類", "Amphibian", "両生類"), 2: l3("節肢動物", "Arthropod", "節足動物"), 3: l3("鳥類", "Bird", "鳥類"), 4: l3("淡水魚", "Fish (freshwater)", "淡水魚"),
  5: l3("海水魚", "Fish (marine)", "海水魚"), 6: l3("地衣", "Lichen", "地衣類"), 7: l3("海洋哺乳類", "Mammal (marine)", "海生哺乳類"), 8: l3("陸生哺乳類", "Mammal (terrestrial)", "陸生哺乳類"),
  9: l3("軟體動物（水生）", "Mollusk (marine or freshwater)", "軟体動物（水生）"), 10: l3("軟體動物（陸生）", "Mollusk (terrestrial)", "軟体動物（陸生）"), 11: l3("爬行類", "Reptile", "爬虫類"),
  12: l3("維管束植物", "Vascular plant", "維管束植物"), 13: l3("非維管束植物", "Non-vascular plant", "非維管束植物"), 14: l3("真菌", "Fungus", "菌類"),
};
const HABITAT_CATS: readonly PhCat[] = [
  { id: "plant", values: ["12", "13", "6", "14"], color: "#22c55e", label: l3("植物、地衣、真菌", "Plants, lichens, fungi", "植物・地衣類・菌類") },
  { id: "reptile", values: ["11"], color: "#a3e635", label: l3("爬行類", "Reptiles", "爬虫類") },
  { id: "bird", values: ["3"], color: "#38bdf8", label: l3("鳥類", "Birds", "鳥類") },
  { id: "amphibian", values: ["1"], color: "#2dd4bf", label: l3("兩棲類", "Amphibians", "両生類") },
  { id: "mammal", values: ["8", "7"], color: "#f59e0b", label: l3("哺乳類", "Mammals", "哺乳類") },
  { id: "fish", values: ["4", "5"], color: "#818cf8", label: l3("魚類", "Fish", "魚類") },
  { id: "invert", values: ["2", "9", "10"], color: "#f472b6", label: l3("昆蟲與軟體動物", "Arthropods & mollusks", "節足動物・軟体動物") },
];
const SARA: Record<string, L3> = { 1: l3("已滅絕（境內）", "Extirpated", "国内絶滅"), 2: l3("瀕危", "Endangered", "絶滅危惧"), 3: l3("受威脅", "Threatened", "危急"), 4: l3("需特別關注", "Special concern", "特別懸念") };
const MARINE_CATS: readonly PhCat[] = [
  cat("mpa", "#38bdf8", "海洋保護區（Oceans Act，49）", "Marine protected area (Oceans Act, 49)", "海洋保護区（Oceans Act、49）"),
  cat("oecm", "#f59e0b", "其他有效保育措施（OECM，61）", "Other effective conservation measure (OECM, 61)", "その他の効果的な保全措置（OECM、61）"),
];
const TIDE_CATS: readonly PhCat[] = [
  cat("PERMANENT", "#38bdf8", "常設站", "Permanent", "常設"),
  cat("TEMPORARY", "#a78bfa", "臨時站", "Temporary", "臨時"),
  cat("DISCONTINUED", "#94a3b8", "停用", "Discontinued", "廃止"),
];
const ECOZONE_NAMES = ["Arctic Cordillera", "Northern Arctic", "Southern Arctic", "Taiga Plains", "Taiga Shield", "Boreal Shield", "Atlantic Maritime", "Mixedwood Plains",
  "Boreal Plains", "Prairies", "Taiga Cordillera", "Boreal Cordillera", "Pacific Maritime", "Montane Cordillera", "Hudson Plains"] as const;
const ECOZONE_ZH: Record<(typeof ECOZONE_NAMES)[number], [string, string, string]> = {
  "Arctic Cordillera": ["北極山脈", "#e0f2fe", "北極山脈"], "Northern Arctic": ["北北極", "#bae6fd", "北部北極"], "Southern Arctic": ["南北極", "#7dd3fc", "南部北極"],
  "Taiga Plains": ["泰加平原", "#a7f3d0", "タイガ平原"], "Taiga Shield": ["泰加地盾", "#6ee7b7", "タイガ楯状地"], "Boreal Shield": ["北方地盾", "#34d399", "北方楯状地"],
  "Atlantic Maritime": ["大西洋濱海", "#2dd4bf", "大西洋沿岸"], "Mixedwood Plains": ["混交林平原", "#a3e635", "混交林平原"], "Boreal Plains": ["北方平原", "#4ade80", "北方平原"],
  Prairies: ["草原", "#fde68a", "プレーリー"], "Taiga Cordillera": ["泰加山脈", "#c4b5fd", "タイガ山脈"], "Boreal Cordillera": ["北方山脈", "#a78bfa", "北方山脈"],
  "Pacific Maritime": ["太平洋濱海", "#22d3ee", "太平洋沿岸"], "Montane Cordillera": ["山地山脈", "#f9a8d4", "山地山脈"], "Hudson Plains": ["哈德遜平原", "#fdba74", "ハドソン平原"],
};
const ECOZONE_CATS: readonly PhCat[] = [
  ...ECOZONE_NAMES.map((n) => ({ id: n.toLowerCase().replace(/ /g, "_"), values: [n], color: ECOZONE_ZH[n][1], label: l3(ECOZONE_ZH[n][0], n, ECOZONE_ZH[n][2]), parts: ["ca-ecozones-fill"] })),
  { id: "ecoregion", values: ["ecoregion"], color: "#e5e7eb", label: l3("生態區界（z5 起）", "Ecoregion boundary (from z5)", "生態地域境界（z5 から）"), parts: ["ca-ecoregions-line"] },
];
const FOREST_CATS: readonly PhCat[] = [
  cat("11", "#16a34a", "皇家林：長期林權", "Crown: long-term timber dispositions", "公有林：長期伐採権"),
  cat("12", "#4ade80", "皇家林：短期林權", "Crown: short-term timber dispositions", "公有林：短期伐採権"),
  cat("13", "#bbf7d0", "皇家林：目前無林權", "Crown: no current timber dispositions", "公有林：現在伐採権なし"),
  cat("20", "#2dd4bf", "法定保護區", "Legally protected lands", "法定保護地"),
  { id: "restricted", values: ["31", "32", "33"], color: "#a78bfa", label: l3("保留或限制使用（聯邦、省）", "Reserved or restricted use (federal, provincial)", "留保・利用制限（連邦・州）") },
  cat("40", "#f59e0b", "原住民土地", "Aboriginal lands", "先住民の土地"),
  cat("50", "#f472b6", "私有林地", "Privately-owned lands", "私有地"),
  cat("100", "#3b82f6", "水域", "Water", "水域"),
];
const FOREST_EN: Record<string, L3> = {
  31: l3("聯邦保留（軍事等）", "Federal reserve (military etc.)", "連邦留保地（軍用など）"), 32: l3("聯邦保留（印第安法）", "Federal reserve (Indian Act)", "連邦留保地（インディアン法）"),
  33: l3("省、領地保留或限制使用", "Provincial/territorial reserved or restricted use", "州・準州の留保・利用制限"),
};
const BRIDGE_CATS: readonly PhCat[] = [
  cat("bridge", "#f59e0b", "橋梁", "Bridge", "橋"),
  cat("culvert", "#38bdf8", "涵洞", "Culvert", "暗渠"),
  cat("mixed", "#a78bfa", "橋涵混合", "Mixed", "混合"),
  cat("tunnel", "#f472b6", "隧道", "Tunnel", "トンネル", { radius: 4.5 }),
  { id: "unknown", values: [""], color: "#9ca3af", label: l3("未分類（8,452）", "Unclassified (8,452)", "未分類（8,452）") },
];
const KSI_CATS: readonly PhCat[] = [
  cat("Fatal Injury", "#ef4444", "死亡事故", "Fatal", "死亡事故", { radius: 5 }),
  cat("Non-Fatal Injury", "#f59e0b", "重傷事故", "Serious injury", "重傷事故"),
];
const YESNO: Record<string, L3> = { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ") };
const flag = (prop: string, zh: string, en: string, ja: string): PhField => ({ prop, label: l3(zh, en, ja), map: { true: YESNO.true!, false: l3("", "", "") } });

const W4: CaWaveSpec[] = [
  {
    key: "caProtectedAreas", file: "ca_protected_areas.pmtiles", sourceId: "ca-protected-areas", srcMinzoom: 3, srcMaxzoom: 11, color: "#22c55e", count: 22438, opacity: 0.45,
    parts: [fill("ca-protected-areas-fill", "ca_protected_areas", 3, propGetter("pa_oecm"), 1)],
    cats: PA_CATS,
    title: { props: ["name", "name_fr"], fallback: l3("保護區", "Protected area", "保護区") },
    fields: [{ prop: "type", label: l3("類型", "Type", "種別") }, { prop: "pa_oecm", label: l3("保護區／OECM", "PA / OECM", "保護区・OECM"), map: catMap(PA_CATS) },
      { prop: "ipca", label: l3("原住民保護區（IPCA）", "Indigenous protected area (IPCA)", "先住民保護区（IPCA）"), map: YESNO },
      { prop: "iucn_cat", label: l3("IUCN 類別", "IUCN category", "IUCN カテゴリ") }, { prop: "status", label: l3("狀態", "Status", "状態") },
      { prop: "est_year", label: l3("設立年", "Established", "設立年"), kind: "year" }, { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha" },
      { prop: "owner_type", label: l3("土地權屬", "Owner type", "所有者区分") }, { prop: "gov_type", label: l3("治理類型", "Governance", "ガバナンス") },
      { prop: "mgmt", label: l3("管理機關", "Manager", "管理者") }, { prop: "loc_name", label: l3("省區或海域", "Province or marine area", "州・準州または海域") }],
    legendNotes: [l3("CPCAD，含海域保護區", "CPCAD, including marine protected areas", "CPCAD、海域保護区を含む"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Environment and Climate Change Canada, Canadian Protected and Conserved Areas Database (CPCAD)", sourceUrl: "https://open.canada.ca/data/en/dataset/6c343726-1e92-451a-876a-76e17d398a1c", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("保護區", "protected areas"),
  },
  {
    key: "caCriticalHabitat", file: "ca_critical_habitat.pmtiles", sourceId: "ca-critical-habitat", srcMinzoom: 3, srcMaxzoom: 11, color: "#22c55e", count: 25180, opacity: 0.4,
    parts: [fill("ca-critical-habitat-fill", "ca_critical_habitat", 3, propGetter("taxon"), 1),
      line("ca-critical-habitat-line", "ca_critical_habitat", 3, propGetter("taxon"), { filter: isLine }),
      pt("ca-critical-habitat-circle", "ca_critical_habitat", 3, propGetter("taxon"), { filter: isPoint, small: true })],
    cats: HABITAT_CATS,
    title: { props: ["common_name", "sci_name"], fallback: l3("關鍵棲地", "Critical habitat", "重要生息地") },
    fields: [{ prop: "sci_name", label: l3("學名", "Scientific name", "学名") }, { prop: "population", label: l3("族群", "Population", "個体群") },
      { prop: "sara_status", label: l3("SARA 保育等級", "SARA status", "SARA 区分"), map: SARA }, { prop: "taxon", label: l3("類群", "Taxon", "分類群"), map: HABITAT_TAXA },
      { prop: "site_name", label: l3("地點", "Site", "地点") },
      { prop: "agency", label: l3("主管機關", "Agency", "所管機関"), map: { 1: l3("環境與氣候變遷部", "Environment and Climate Change Canada", "環境・気候変動省"), 2: l3("加拿大國家公園管理局", "Parks Canada", "パークス・カナダ"), 3: l3("漁業及海洋部", "Fisheries and Oceans Canada", "漁業海洋省") } },
      { prop: "sensitive", label: l3("官方敏感度標記", "Official sensitivity flag", "公式の機微区分") }, PROV],
    legendNotes: [l3("SARA 物種關鍵棲地；敏感物種位置已由官方概化，座標未改動", "Critical habitat for SARA species; sensitive locations generalised by the government, coordinates unchanged here", "SARA 種の重要生息地。機微な位置は政府が概略化済みで座標は変更しない"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Environment and Climate Change Canada, Critical Habitat for Species at Risk National Dataset", sourceUrl: "https://open.canada.ca/data/en/dataset/47caa405-be2b-4e9e-8f53-c478ade2ca74", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("關鍵棲地", "critical habitat"),
  },
  {
    key: "caMarineConservation", file: "ca_marine_conservation.pmtiles", sourceId: "ca-marine-conservation", srcMinzoom: 2, srcMaxzoom: 10, color: "#38bdf8", count: 110, opacity: 0.55,
    parts: [fill("ca-marine-conservation-fill", "ca_marine_conservation", 2, propGetter("kind"), 1)],
    cats: MARINE_CATS,
    title: { props: ["name", "name_fr"], fallback: l3("海洋保護區", "Marine protected area", "海洋保護区") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(MARINE_CATS) }, { prop: "zone", label: l3("分區", "Zone", "区域") },
      { prop: "region", label: l3("海域", "Region", "海域") }, { prop: "km2", label: l3("面積", "Area", "面積"), kind: "num", digits: 2, unit: "km²" },
      { prop: "url", label: l3("說明頁", "Info page", "説明ページ"), kind: "code" }],
    legendNotes: [l3("聯邦海域，不依省區計；國家海洋保育區（Parks Canada）在保護區層", "Federal waters, not counted by province; national marine conservation areas (Parks Canada) are in the protected areas layer", "連邦管轄海域で州別には数えない。国立海洋保全区（Parks Canada）は保護区レイヤー")],
    popupNotes: [],
    sourceOrg: "Fisheries and Oceans Canada, Oceans Act Marine Protected Areas；Other Effective Area-based Conservation Measures", sourceUrl: "https://open.canada.ca/data/en/dataset/a1e18963-25dd-4219-a33f-1a38c4971250", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("海洋保護區", "marine conservation areas"),
  },
  {
    key: "caTideStations", file: "ca_tide_stations.pmtiles", sourceId: "ca-tide-stations", srcMinzoom: 2, srcMaxzoom: 11, color: "#38bdf8", count: 1839,
    parts: [pt("ca-tide-stations-circle", "ca_tide_stations", 2, propGetter("status"))],
    cats: TIDE_CATS, otherColor: "#cbd5e1", otherLabel: l3("狀態未標", "Status not stated", "状態不明"),
    title: { props: ["name"], fallback: l3("潮位站", "Tide station", "潮位観測所") },
    fields: [{ prop: "status", label: l3("狀態", "Status", "状態"), map: catMap(TIDE_CATS) }, PROV],
    legendNotes: [l3("站址名冊（含歷史站），不含即時水位", "Station inventory (incl. historical), no live water levels", "観測所名簿（廃止局を含む）で、リアルタイム水位はない"),
      l3("SK、AB 為內陸省，沒有潮位站（不是未涵蓋）", "SK and AB are landlocked and have no tide stations (not 'not covered')", "SK・AB は内陸州で潮位観測所がない（未収録ではない）")],
    popupNotes: [{ text: l3("海上站以 50 km 內最近省區歸屬", "Offshore stations assigned to the nearest province within 50 km", "海上の観測所は 50 km 以内の最寄り州に帰属") }],
    sourceOrg: "Fisheries and Oceans Canada, Canadian Hydrographic Service, Tide and Water Level Station Inventory", sourceUrl: "https://open.canada.ca/data/en/dataset/87b08750-4180-4d31-9414-a9470eba9b42", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("潮位站", "tide stations"),
  },
  {
    key: "caEcozones", file: "ca_ecozones.pmtiles", sourceId: "ca-ecozones", srcMinzoom: 2, srcMaxzoom: 9, color: "#34d399", count: 243, opacity: 0.35,
    parts: [fill("ca-ecozones-fill", "ca_ecozones", 2, propGetter("name"), 1), line("ca-ecoregions-line", "ca_ecoregions", 5, constGetter("ecoregion"), { lineWidth: { ecoregion: [0.6, 1] } })],
    cats: ECOZONE_CATS,
    title: { props: ["name"], fallback: l3("生態帶", "Ecozone", "生態帯") },
    fields: [{ prop: "name_fr", label: l3("法文名", "French name", "フランス語名") }],
    legendNotes: [l3("15 個生態帶（面）＋生態區界（線，z5 起）", "15 ecozones (areas) + ecoregion boundaries (lines, from z5)", "15 の生態帯（面）＋生態地域境界（線、z5 から）"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Agriculture and Agri-Food Canada, National Ecological Framework for Canada v2.2", sourceUrl: "https://open.canada.ca/data/en/dataset/7ad7ea01-eb23-4824-bccc-66adb7c5bdf8", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("生態分區", "ecozones"),
  },
  {
    key: "caForestManagement", file: "ca_forest_management.pmtiles", sourceId: "ca-forest-management", srcMinzoom: 2, srcMaxzoom: 9, color: "#16a34a", count: 958, opacity: 0.5,
    parts: [fill("ca-forest-management-fill", "ca_forest_management", 2, propGetter("class"), 1)],
    cats: FOREST_CATS,
    title: { props: [], fallback: l3("森林經營型態", "Forest management", "森林経営区分"), fallbackBy: { prop: "class", map: { ...catMap(FOREST_CATS), ...FOREST_EN } } },
    fields: [{ prop: "class_en", label: l3("類別（原文）", "Class", "区分（原文）") }],
    legendNotes: [l3("CCFM 2020，250 m 柵格向量化（低解析度版）", "CCFM 2020, vectorised from a 250 m raster (low-resolution edition)", "CCFM 2020、250 m ラスターをベクター化（低解像度版）"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Canadian Council of Forest Ministers／NRCan, Map of Forest Management in Canada (2020)", sourceUrl: "https://open.canada.ca/data/en/dataset/d8fa9a38-c4df-442a-8319-9bbcbdc29060", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("森林經營型態", "forest management"),
  },
  {
    key: "caBridgesTunnels", file: "ca_bridges_tunnels.pmtiles", sourceId: "ca-bridges-tunnels", srcMinzoom: 4, srcMaxzoom: 12, color: "#f59e0b", count: 99209,
    parts: [pt("ca-bridges-tunnels-circle", "ca_bridges_tunnels", 4, propGetter("kind"), { small: true })],
    cats: BRIDGE_CATS,
    title: { props: ["name"], fallback: l3("橋梁或隧道", "Bridge or tunnel", "橋・トンネル"), fallbackBy: { prop: "kind", map: catMap(BRIDGE_CATS) } },
    fields: [{ prop: "kind", label: l3("類型", "Kind", "種別"), map: catMap(BRIDGE_CATS) }, { prop: "ccpi_class", label: l3("CCPI 分類", "CCPI class", "CCPI 区分") },
      { prop: "source_class", label: l3("原始分類", "Source class", "元の区分") }, PROVIDER, { prop: "csdname", label: l3("市鎮", "Municipality", "市町村") }, PROV],
    legendNotes: [l3("StatCan ODI v2（2022）；線狀橋體取代表點；沒有材質、年份、狀況欄", "StatCan ODI v2 (2022); linear structures shown as representative points; no material, year or condition", "StatCan ODI v2（2022）。線状の橋は代表点。材質・年・状態の項目なし"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Statistics Canada, Open Database of Infrastructure (ODI) v2 — bridges and tunnels", sourceUrl: "https://www150.statcan.gc.ca/n1/pub/34-26-0003/342600032023001-eng.htm", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("橋梁與隧道", "bridges and tunnels"),
  },
  {
    key: "caFerryRoutes", file: "ca_ferry_routes.pmtiles", sourceId: "ca-ferry-routes", srcMinzoom: 3, srcMaxzoom: 10, color: "#22d3ee", count: 182,
    parts: [line("ca-ferry-routes-line", "ca_ferry_routes", 3, constGetter("ferry"), { dashed: true, lineWidth: { ferry: [1.5, 2.5] } })],
    cats: [cat("ferry", "#22d3ee", "汽車渡輪航線", "Road ferry route", "カーフェリー航路")], dashLabel: null,
    title: { props: [], fallback: l3("渡輪航線", "Ferry route", "フェリー航路") },
    fields: [PROV],
    legendNotes: [l3("Atlas of Canada 1:1M 汽車渡輪航線，沒有時刻", "Atlas of Canada 1:1M road ferries, no timetable", "Atlas of Canada 1:1M のカーフェリー航路。時刻表なし"), COVER(9, "AB、YT、NT、NU")],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Atlas of Canada National Scale Data 1:1,000,000 — Road Ferries", sourceUrl: "https://open.canada.ca/data/en/dataset/7cb17094-f1fb-591c-b8a9-9ace4bfef68c", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("渡輪航線", "ferry routes"),
  },
  {
    key: "caTorontoKsi", file: "ca_toronto_ksi_collisions.pmtiles", sourceId: "ca-toronto-ksi-collisions", srcMinzoom: 8, srcMaxzoom: 14, color: "#ef4444", count: 7677,
    parts: [pt("ca-toronto-ksi-circle", "ca_toronto_ksi_collisions", 8, propGetter("severity"))],
    cats: KSI_CATS, otherColor: "#9ca3af", otherLabel: l3("其他（僅財損、不明）", "Other (property damage, unknown)", "その他（物損・不明）"),
    title: { props: ["road"], fallback: l3("重大交通事故", "Serious collision", "重大交通事故") },
    fields: [{ prop: "date", label: l3("日期", "Date", "日付") }, { prop: "time", label: l3("時間", "Time", "時刻") },
      { prop: "severity", label: l3("嚴重度", "Severity", "重大度"), map: catMap(KSI_CATS) }, { prop: "road2", label: l3("交叉路", "Cross street", "交差道路") },
      { prop: "persons", label: l3("涉入人數", "Persons involved", "関係者数"), kind: "num" }, { prop: "light", label: l3("光線", "Light", "明るさ") },
      { prop: "visibility", label: l3("天候", "Visibility", "天候") }, { prop: "rdsfcond", label: l3("路面", "Road surface", "路面") },
      flag("pedestrian", "涉及行人", "Pedestrian involved", "歩行者関与"), flag("cyclist", "涉及自行車", "Cyclist involved", "自転車関与"),
      flag("motorcyclist", "涉及機車", "Motorcyclist involved", "二輪車関与"), flag("heavy_truck", "涉及重車", "Heavy truck involved", "大型車関与")],
    legendNotes: [TORONTO_ONLY, l3("一點＝一起事故（2006 年起）", "One point = one collision (since 2006)", "1 点＝1 件の事故（2006 年以降）")],
    popupNotes: [],
    sourceOrg: "Toronto Police Service, Motor Vehicle Collisions involving Killed or Seriously Injured Persons", sourceUrl: "https://open.toronto.ca/dataset/motor-vehicle-collisions-involving-killed-or-seriously-injured-persons/", license: OGL_TO,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("多倫多重大交通事故", "Toronto KSI collisions"),
  },
];

// ═════════════════════════ 第 5、6 波 LODE ＋ 其他 ═════════════════════════

const HEALTH_CATS: readonly PhCat[] = [
  cat("hospitals", "#ef4444", "醫院", "Hospital", "病院", { radius: 5 }),
  cat("ambulatory health care services", "#38bdf8", "診所與門診", "Ambulatory care", "診療所・外来"),
  cat("nursing and residential care facilities", "#a78bfa", "護理與住宿照顧", "Nursing & residential care", "看護・入所介護"),
];
const SCHOOL_LEVEL_CATS: readonly PhCat[] = [
  { id: "post", values: ["高中後"], color: "#f472b6", label: l3("高中後（大專）", "Post-secondary", "高等教育") },
  { id: "secondary", values: ["國中、高中", "高中", "國中", "國中、高中、高中後"], color: "#f59e0b", label: l3("國中、高中", "Secondary", "中等教育") },
  { id: "primary", values: ["小學", "小學、國中", "學前、小學", "學前、小學、國中", "小學、國中、高中", "學前、小學、國中、高中", "學前、小學、高中", "學前、國中、高中", "小學、國中、高中、高中後", "學前、小學、國中、高中、高中後", "學前、小學、高中後", "小學、高中後"],
    color: "#38bdf8", label: l3("小學（含學前、跨級）", "Primary (incl. pre-K, multi-level)", "初等教育（就学前・複数段階を含む）") },
  { id: "early", values: ["早期幼教", "學前", "早期幼教、學前", "早期幼教、學前、小學", "早期幼教、學前、小學、國中", "早期幼教、學前、小學、國中、高中"], color: "#22c55e", label: l3("早期幼教、學前", "Early childhood, pre-K", "幼児教育・就学前") },
];
const SPORT_CATS: readonly PhCat[] = [
  cat("park", "#22c55e", "公園", "Park", "公園"),
  { id: "field", values: ["sports field", "athletic park", "stadium"], color: "#a3e635", label: l3("運動場、體育場", "Sports field, stadium", "運動場・スタジアム") },
  cat("playground", "#facc15", "遊戲場", "Playground", "遊び場"),
  { id: "aquatic", values: ["pool", "splash pad", "beach", "marina"], color: "#38bdf8", label: l3("游泳池、戲水、海灘、碼頭", "Pool, splash pad, beach, marina", "プール・水遊び場・ビーチ・マリーナ") },
  { id: "indoor", values: ["community centre", "rink", "arena", "gym"], color: "#a78bfa", label: l3("社區中心、冰場、體育館", "Community centre, rink, arena, gym", "コミュニティセンター・リンク・アリーナ・ジム") },
  { id: "misc", values: ["skate park", "race track", "casino", "miscellaneous"], color: "#f472b6", label: l3("滑板場、賽道及其他", "Skate park, race track, other", "スケートパーク・競技場・その他") },
  cat("trail", "#a8a29e", "步道代表點（14.3 萬，預設關）", "Trail points (143k, off by default)", "トレイル代表点（14.3 万、既定オフ）"),
];
const CULTURE_CATS: readonly PhCat[] = [
  cat("library or archives", "#38bdf8", "圖書館、檔案館", "Library or archives", "図書館・アーカイブ"),
  cat("museum", "#f59e0b", "博物館", "Museum", "博物館"),
  cat("gallery", "#f472b6", "藝廊", "Gallery", "ギャラリー"),
  cat("theatre/performance and concert hall", "#a78bfa", "劇院、音樂廳", "Theatre / concert hall", "劇場・コンサートホール"),
  cat("heritage or historic site", "#fbbf24", "古蹟、歷史場址", "Heritage or historic site", "史跡"),
  cat("festival site", "#22c55e", "節慶場地", "Festival site", "祭り会場"),
  cat("art or cultural centre", "#2dd4bf", "藝文中心", "Art or cultural centre", "芸術文化センター"),
  cat("miscellaneous", "#9ca3af", "其他", "Miscellaneous", "その他"),
];
const COURT_CATS: readonly PhCat[] = [
  cat("court", "#a78bfa", "法院（BC、ON）", "Court (BC, ON)", "裁判所（BC・ON）"),
  cat("corrections", "#f87171", "矯正設施（只有 BC）", "Correctional facility (BC only)", "矯正施設（BC のみ）"),
];
const THEFT_CATS: readonly PhCat[] = [
  cat("Theft From Motor Vehicle Under", "#f59e0b", "車內竊盜（5,000 元以下）", "Theft from motor vehicle (under $5,000)", "車上荒らし（5,000 ドル以下）"),
  cat("Theft From Motor Vehicle Over", "#ef4444", "車內竊盜（5,000 元以上）", "Theft from motor vehicle (over $5,000)", "車上荒らし（5,000 ドル超）", { radius: 4.5 }),
];
const PARKS_ACC_CATS: readonly PhCat[] = [
  cat("Camping", "#22c55e", "營位", "Campsite", "キャンプサイト"),
  { id: "backcountry", values: ["Backcountry camping//Camping d'arrière-pays", "Backcountry accommodation//Hébergement d'arrière-pays"], color: "#a3e635", label: l3("野營、偏遠住宿", "Backcountry camping & accommodation", "奥地キャンプ・宿泊") },
  { id: "roofed", values: ["oTENTik", "Cabin//Chalet", "Yurt//Yourte", "Oasis", "MicrOcube", "Tipi", "Historic stay//Séjour historique"], color: "#f59e0b", label: l3("有頂住宿（oTENTik、小屋、蒙古包等）", "Roofed stays (oTENTik, cabins, yurts…)", "屋根付き宿泊（oTENTik・小屋・ユルトなど）") },
  { id: "group", values: ["Group camping//Camping de groupe", "Mooring//Amarrage"], color: "#38bdf8", label: l3("團體營地、繫泊位", "Group camping, moorings", "団体キャンプ・係留地") },
];
const WILDFIRE_DECADE: PhCatGetter = {
  expr: ["case", ["has", "year"], ["step", ["to-number", ["get", "year"], 0], "1980s", 1990, "1990s", 2000, "2000s", 2010, "2010s", 2020, "2020s"], ""],
  js: (p) => {
    const y = Number(p.year);
    if (p.year == null || !Number.isFinite(y)) return "";
    return y < 1990 ? "1980s" : y < 2000 ? "1990s" : y < 2010 ? "2000s" : y < 2020 ? "2010s" : "2020s";
  },
};
const WILDFIRE_CATS: readonly PhCat[] = [
  cat("1980s", "#fde68a", "1980–1989", "1980–1989", "1980–1989"),
  cat("1990s", "#fbbf24", "1990–1999", "1990–1999", "1990–1999"),
  cat("2000s", "#f97316", "2000–2009", "2000–2009", "2000–2009"),
  cat("2010s", "#ef4444", "2010–2019", "2010–2019", "2010–2019"),
  cat("2020s", "#b91c1c", "2020–2023", "2020–2023", "2020–2023"),
];
const BROADBAND_CATS: readonly PhCat[] = [
  cat("0", "#7f1d1d", "0%", "0%", "0%"),
  cat(">0% - 25%", "#ef4444", ">0–25%", ">0–25%", ">0–25%"),
  cat(">25% - 50%", "#f59e0b", ">25–50%", ">25–50%", ">25–50%"),
  cat(">50% - 75%", "#a3e635", ">50–75%", ">50–75%", ">50–75%"),
  cat(">75% -  100%", "#22c55e", ">75–100%", ">75–100%", ">75–100%"),
];

const W56: CaWaveSpec[] = [
  {
    key: "caLodeHealth", file: "ca_lode_health.pmtiles", sourceId: "ca-lode-health", srcMinzoom: 3, srcMaxzoom: 11, color: "#ef4444", count: 6663,
    parts: [pt("ca-lode-health-circle", "ca_lode_health", 3, propGetter("facility_type"), { hollow: LODE_HOLLOW })],
    cats: HEALTH_CATS,
    title: { props: ["name"], fallback: l3("醫療設施", "Healthcare facility", "医療施設") },
    fields: [{ prop: "facility_type", label: l3("類型", "Type", "種別"), map: catMap(HEALTH_CATS) }, { prop: "source_type", label: l3("原始類型", "Source type", "元の種別") }, CITY, PRECISION, PROVIDER, PROV],
    legendNotes: [l3("ODHF 2020 版；另有 370 筆只能定位到城市，未上圖", "ODHF 2020 edition; another 370 records locate only to a city and are not drawn", "ODHF 2020 年版。都市までしか特定できない 370 件は描画しない"), LODE_ODBL, COVER_ALL],
    popupNotes: [PRECISION_NOTE, { text: l3("已隱去執業者姓名，只顯示機構類型", "Practitioner's name withheld; facility type shown", "開業者の氏名は伏せ、施設種別のみ表示"), when: (p) => p.name_masked === true || str(p.name_masked) === "true" }],
    sourceOrg: lodeSrc("Open Database of Healthcare Facilities (ODHF) v1.1"), sourceUrl: `${LODE_URL}/odhf`, license: LODE_LICENSE,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("醫療設施", "healthcare facilities"),
  },
  {
    key: "caLodeSchools", file: "ca_lode_schools.pmtiles", sourceId: "ca-lode-schools", srcMinzoom: 3, srcMaxzoom: 12, color: "#38bdf8", count: 17161,
    parts: [pt("ca-lode-schools-circle", "ca_lode_schools", 3, propGetter("level"), { hollow: LODE_HOLLOW })],
    cats: SCHOOL_LEVEL_CATS, otherColor: "#9ca3af", otherLabel: l3("學制未標", "Level not stated", "段階不明"),
    title: { props: ["name"], fallback: l3("學校", "School", "学校") },
    fields: [{ prop: "level", label: l3("學制", "Level", "段階") }, { prop: "facility_type", label: l3("類型", "Type", "種別") }, { prop: "authority", label: l3("學區／主管", "Authority", "所管") },
      { prop: "olms", label: l3("官方語言少數學校", "Official-language minority school", "公用語少数派学校"), map: { 1: l3("是", "Yes", "はい") } }, CITY, PRECISION, PROV],
    legendNotes: [l3("ODEF 2022 版；另有 1,821 筆只到城市，未上圖", "ODEF 2022 edition; another 1,821 records locate only to a city and are not drawn", "ODEF 2022 年版。都市までしか特定できない 1,821 件は描画しない"), LODE_ODBL, COVER_ALL],
    popupNotes: [PRECISION_NOTE],
    sourceOrg: lodeSrc("Open Database of Educational Facilities (ODEF) v2.1"), sourceUrl: `${LODE_URL}/odef`, license: LODE_LICENSE,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("學校", "schools"),
  },
  {
    key: "caLodeSports", file: "ca_lode_sports.pmtiles", sourceId: "ca-lode-sports", srcMinzoom: 3, srcMaxzoom: 12, color: "#22c55e", count: 181849,
    catDefault: ["park", "field", "playground", "aquatic", "indoor", "misc"],
    parts: [pt("ca-lode-sports-circle", "ca_lode_sports", 3, propGetter("facility_type"), { hollow: LODE_HOLLOW, small: true })],
    cats: SPORT_CATS,
    title: { props: ["name"], fallback: l3("運動休閒設施", "Recreation facility", "運動・レクリエーション施設"), fallbackBy: { prop: "facility_type", map: catMap(SPORT_CATS) } },
    fields: [{ prop: "facility_type", label: l3("類型", "Type", "種別"), map: catMap(SPORT_CATS) }, { prop: "source_type", label: l3("原始類型", "Source type", "元の種別") }, CITY, PROVIDER, PRECISION, PROV],
    legendNotes: [l3("步道 14.3 萬點預設關閉，可在類別勾選", "143k trail points are off by default; enable under categories", "トレイル 14.3 万点は既定でオフ、種別で表示可"), LODE_ODBL,
      COVER(10, "NL、PE、NU"), l3("QC、NT 筆數偏少", "QC and NT are sparse", "QC・NT は件数が少ない")],
    popupNotes: [PRECISION_NOTE],
    sourceOrg: lodeSrc("Open Database of Recreational and Sport Facilities (ODRSF) v1.0"), sourceUrl: `${LODE_URL}/odrsf`, license: LODE_LICENSE,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("運動休閒設施", "recreation facilities"),
  },
  {
    key: "caBcChildcare", file: "ca_bc_childcare.pmtiles", sourceId: "ca-bc-childcare", srcMinzoom: 5, srcMaxzoom: 13, color: "#facc15", count: 3807,
    parts: [pt("ca-bc-childcare-circle", "ca_bc_childcare", 5, { expr: ["to-string", ["coalesce", ["get", "ccfri"], false]], js: (p) => str(p.ccfri ?? false) })],
    cats: [cat("true", "#facc15", "參加育兒費補助（CCFRI）", "In fee-reduction program (CCFRI)", "保育料軽減（CCFRI）参加"), cat("false", "#a8a29e", "未參加 CCFRI", "Not in CCFRI", "CCFRI 不参加")],
    title: { props: ["name"], fallback: l3("托育中心", "Child care centre", "保育所") },
    fields: [CITY, { prop: "ages", label: l3("收托年齡", "Ages served", "受入年齢") },
      { prop: "vacancy_under36", label: l3("36 個月以下有空位", "Vacancy: under 36 months", "36 か月未満の空き"), map: YESNO },
      { prop: "vacancy_30m_5y", label: l3("30 個月–5 歲有空位", "Vacancy: 30 months–5 years", "30 か月–5 歳の空き"), map: YESNO },
      { prop: "ccfri", label: l3("育兒費補助（CCFRI）", "Fee reduction (CCFRI)", "保育料軽減（CCFRI）"), map: YESNO }, PROV],
    legendNotes: [l3("只有 BC 群體式托育中心（1／13），其他省區未涵蓋", "BC group child care centres only (1 of 13); other provinces not covered", "BC の集団保育所のみ（13 中 1）。その他の州は未収録"),
      l3("家庭式托育在照護者住家，不上圖", "Family child care is in the caregiver's home and is not mapped", "家庭的保育は保育者の自宅のため描画しない")],
    popupNotes: [],
    sourceOrg: "BC Ministry of Education and Child Care, Child Care Map Data", sourceUrl: "https://catalogue.data.gov.bc.ca/dataset/child-care-map-data", license: OGL_BC,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("BC 托育中心", "BC child care centres"),
  },
  {
    key: "caLodeCulture", file: "ca_lode_culture.pmtiles", sourceId: "ca-lode-culture", srcMinzoom: 3, srcMaxzoom: 11, color: "#f59e0b", count: 7305,
    parts: [pt("ca-lode-culture-circle", "ca_lode_culture", 3, propGetter("facility_type"), { hollow: LODE_HOLLOW })],
    cats: CULTURE_CATS,
    title: { props: ["name"], fallback: l3("文化設施", "Cultural facility", "文化施設"), fallbackBy: { prop: "facility_type", map: catMap(CULTURE_CATS) } },
    fields: [{ prop: "facility_type", label: l3("類型", "Type", "種別"), map: catMap(CULTURE_CATS) }, { prop: "source_type", label: l3("原始類型", "Source type", "元の種別") }, CITY, PRECISION, PROV],
    legendNotes: [l3("個人藝術家 94 筆不上圖", "94 individual-artist records are not mapped", "個人アーティスト 94 件は描画しない"), LODE_ODBL, COVER_ALL],
    popupNotes: [PRECISION_NOTE],
    sourceOrg: lodeSrc("Open Database of Cultural and Art Facilities (ODCAF) v1.0"), sourceUrl: `${LODE_URL}/odcaf`, license: LODE_LICENSE,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("文化設施", "cultural facilities"),
  },
  {
    key: "caCbsaOffices", file: "ca_cbsa_offices.pmtiles", sourceId: "ca-cbsa-offices", srcMinzoom: 3, srcMaxzoom: 11, color: "#f87171", count: 978,
    parts: [pt("ca-cbsa-offices-circle", "ca_cbsa_offices", 3, constGetter("cbsa"))],
    cats: [cat("cbsa", "#f87171", "CBSA 辦公室與口岸", "CBSA office or port of entry", "CBSA 事務所・入国地点")],
    title: { props: ["name"], fallback: l3("CBSA 辦公室", "CBSA office", "CBSA 事務所") },
    fields: [CITY, { prop: "services", label: l3("服務", "Services", "サービス") }, PROV],
    legendNotes: [l3("邊境服務署辦公室與口岸；94 筆無座標未上圖（不合成座標）", "CBSA offices and ports of entry; 94 records without coordinates are not drawn (no synthetic coordinates)", "国境サービス庁の事務所・入国地点。座標のない 94 件は描画しない（座標は合成しない）"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Canada Border Services Agency, Directory of CBSA Offices", sourceUrl: "https://open.canada.ca/data/en/dataset/1018c301-d359-4077-8d9b-4e9fbe6a223f", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("邊境服務署據點", "CBSA offices"),
  },
  {
    key: "caParksCanadaAccommodation", file: "ca_parks_canada_accommodation.pmtiles", sourceId: "ca-parks-canada-accommodation", srcMinzoom: 4, srcMaxzoom: 13, color: "#22c55e", count: 11741,
    parts: [pt("ca-parks-canada-accommodation-circle", "ca_parks_canada_accommodation", 4, propGetter("kind"), { small: true })],
    cats: PARKS_ACC_CATS, otherColor: "#9ca3af", otherLabel: l3("類型未標", "Type not stated", "種別不明"),
    title: { props: ["name"], fallback: l3("國家公園營位", "Parks Canada site", "国立公園のサイト"), fallbackBy: { prop: "kind", map: catMap(PARKS_ACC_CATS) } },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別") }, PROV],
    legendNotes: [l3("Parks Canada 轄管地點的營位與住宿；省立公園未涵蓋", "Campsites and stays at Parks Canada places; provincial parks not covered", "Parks Canada 管轄地のキャンプサイト・宿泊。州立公園は未収録"), COVER(12, "NU")],
    popupNotes: [],
    sourceOrg: "Parks Canada, Accommodation", sourceUrl: "https://open.canada.ca/data/en/dataset/74054d44-68cf-41af-8919-5f09f80dcd02", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("國家公園營位", "Parks Canada sites"),
  },
  {
    key: "caCourtsCorrections", file: "ca_courts_corrections.pmtiles", sourceId: "ca-courts-corrections", srcMinzoom: 4, srcMaxzoom: 12, color: "#a78bfa", count: 194,
    parts: [pt("ca-courts-corrections-circle", "ca_courts_corrections", 4, propGetter("kind"))],
    cats: COURT_CATS,
    title: { props: ["name"], fallback: l3("法院或矯正設施", "Court or correctional facility", "裁判所・矯正施設") },
    fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(COURT_CATS) }, CITY, { prop: "detail", label: l3("層級／設施類型", "Level / facility type", "階層・施設種別") }, PROV],
    legendNotes: [COVER(2, "BC、ON 以外 11 省區"), l3("聯邦矯正署機構未找到座標檔", "Federal (CSC) institutions: no coordinate file found", "連邦矯正局の施設は座標データ未入手")],
    popupNotes: [],
    sourceOrg: "BC Court Locations、BC Correctional Facilities（OGL-BC）；Ontario courthouses（OGL-Ontario）", sourceUrl: "https://catalogue.data.gov.bc.ca/dataset/court-locations", license: `${OGL_BC}；${OGL_ON}`,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("法院與矯正設施", "courts and corrections"),
  },
  {
    key: "caTorontoTheftFromVehicle", file: "ca_toronto_theft_from_vehicle.pmtiles", sourceId: "ca-toronto-theft-from-vehicle", srcMinzoom: 9, srcMaxzoom: 14, color: "#f59e0b", count: 107088,
    parts: [pt("ca-toronto-theft-from-vehicle-circle", "ca_toronto_theft_from_vehicle", 9, propGetter("offence"), { small: true })],
    cats: THEFT_CATS,
    title: { props: [], fallback: l3("車內竊盜", "Theft from vehicle", "車上荒らし"), fallbackBy: { prop: "offence", map: catMap(THEFT_CATS) } },
    fields: [{ prop: "occ_date", label: l3("發生日期", "Date", "発生日") }, { prop: "premises", label: l3("場所", "Premises", "場所") },
      { prop: "neighbourhood", label: l3("社區編號", "Neighbourhood no.", "地区番号"), kind: "code" }],
    legendNotes: [TORONTO_ONLY, l3("點位為官方偏移至路口（保護隱私）", "Points are offset to the nearest intersection by the police (privacy)", "点は警察がプライバシー保護のため最寄りの交差点へ移動済み")],
    popupNotes: [],
    sourceOrg: "Toronto Police Service, Theft from Motor Vehicle", sourceUrl: "https://open.toronto.ca/dataset/theft-from-motor-vehicle/", license: OGL_TO,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("多倫多車內竊盜", "Toronto theft from vehicle"),
  },
  {
    key: "caWildfirePoints", file: "ca_wildfire_points.pmtiles", sourceId: "ca-wildfire-points", srcMinzoom: 3, srcMaxzoom: 11, color: "#f97316", count: 15204,
    parts: [pt("ca-wildfire-points-circle", "ca_wildfire_points", 3, WILDFIRE_DECADE, { small: true })],
    cats: WILDFIRE_CATS,
    title: { props: [], fallback: l3("野火點", "Wildfire point", "林野火災地点") },
    fields: [{ prop: "year", label: l3("年份", "Year", "年"), kind: "year" }, PROV],
    legendNotes: [l3("CWFIS 國家火災資料庫大型火災點（1980–2023），依年代上色", "CWFIS National Fire Database large-fire points (1980–2023), coloured by decade", "CWFIS 国家火災データベースの大規模火災点（1980–2023）、年代で色分け"),
      l3("授權未確認，只上位置與年份", "Licence not confirmed: location and year only", "ライセンス未確認のため位置と年のみ"), COVER(12, "PE")],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Canadian Wildland Fire Information System — National Fire Database", sourceUrl: "https://cwfis.cfs.nrcan.gc.ca/datamart", license: "授權未確認（只上位置與年份）",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("野火點", "wildfire points"),
  },
  {
    key: "caBroadbandHex", file: "ca_broadband_hex.pmtiles", sourceId: "ca-broadband-hex", srcMinzoom: 3, srcMaxzoom: 10, color: "#22c55e", count: 77765, opacity: 0.55,
    parts: [fill("ca-broadband-hex-fill", "ca_broadband_hex", 3, propGetter("avail_50_10"), 1, { filter: ["has", "avail_50_10"] })],
    cats: BROADBAND_CATS,
    title: { props: ["hex_id"], fallback: l3("寬頻六角格", "Broadband hexagon", "ブロードバンド六角形") },
    fields: [{ prop: "avail_50_10", label: l3("可用 50/10 Mbps 住戶比例", "Households with 50/10 Mbps", "50/10 Mbps 利用可能世帯の割合"), map: catMap(BROADBAND_CATS) },
      { prop: "avail_5_1_75pct", label: l3("逾 75% 住戶可用 5/1 Mbps", "Over 75% of households have 5/1 Mbps", "75% 超の世帯で 5/1 Mbps 利用可"), map: YESNO },
      { prop: "pop_2021", label: l3("人口（2021，ISED 分級）", "Population 2021 (ISED band)", "人口 2021（ISED 区分）") },
      { prop: "dwellings_2021", label: l3("住宅（2021，ISED 分級）", "Dwellings 2021 (ISED band)", "住宅 2021（ISED 区分）") }, PROV],
    legendNotes: [l3("ISED 25 km² 六角格，格內住戶可用 50/10 Mbps 的比例", "ISED 25 km² hexagons: share of households with 50/10 Mbps available", "ISED 25 km² 六角形、50/10 Mbps を利用できる世帯の割合"),
      l3("無住戶的格不畫（不是 0%）", "Hexagons without households are not drawn (not 0%)", "世帯のない六角形は描画しない（0% ではない）"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Innovation, Science and Economic Development Canada, National Broadband Data", sourceUrl: "https://open.canada.ca/data/en/dataset/00a331db-121b-445d-b119-35dbbe3eedd9", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("寬頻覆蓋", "broadband coverage"),
  },
];

// ═════════════════════════ 第 7、8 波 ═════════════════════════

const MINE_CATS: readonly PhCat[] = [
  { id: "metals", values: ["metals"], color: "#fbbf24", label: l3("金屬礦", "Metal mine", "金属鉱山"), radius: 5 },
  { id: "nonmetals", values: ["nonmetals"], color: "#a3e635", label: l3("非金屬礦", "Non-metal mine", "非金属鉱山"), radius: 5 },
  { id: "coal", values: ["coal", "oil_sands"], color: "#78716c", label: l3("煤礦、油砂", "Coal, oil sands", "炭鉱・オイルサンド"), radius: 5 },
  { id: "metallurgical", values: ["smelter_refinery", "steel_pellet", "ferroalloy", "metal_shredder", "helium"], color: "#f472b6", label: l3("冶煉、鋼鐵、金屬破碎、氦氣廠", "Smelter, steel, shredder, helium plant", "製錬・鉄鋼・金属破砕・ヘリウム工場"), radius: 4 },
  { id: "top100", values: ["top100"], color: "#38bdf8", label: l3("前 100 大探勘案", "Top 100 exploration projects", "上位 100 探鉱案件"), radius: 4 },
];
const NS_AQUA_CATS: readonly PhCat[] = [
  cat("Shellfish", "#f59e0b", "貝類", "Shellfish", "貝類"),
  cat("Finfish", "#38bdf8", "魚類", "Finfish", "魚類"),
  { id: "mixed", values: ["Shellfish; Marine Plants", "Combined Finfish and Shellfish", "Finfish; Shellfish; & Marine P"], color: "#a78bfa", label: l3("混養（含海藻）", "Mixed (incl. marine plants)", "複合（海藻を含む）") },
];
const NAICS: readonly PhCat[] = [
  cat("72", "#f59e0b", "住宿餐飲（72）", "Accommodation & food (72)", "宿泊・飲食（72）"),
  { id: "retail", values: ["44", "45"], color: "#f472b6", label: l3("零售（44–45）", "Retail (44–45)", "小売（44–45）") },
  cat("81", "#a78bfa", "其他服務（81）", "Other services (81)", "その他サービス（81）"),
  cat("23", "#fb923c", "營造（23）", "Construction (23)", "建設（23）"),
  { id: "prof", values: ["54", "55", "56"], color: "#38bdf8", label: l3("專業、管理與支援服務（54–56）", "Professional & support services (54–56)", "専門・支援サービス（54–56）") },
  { id: "health_edu", values: ["61", "62"], color: "#22c55e", label: l3("教育、醫療社福（61–62）", "Education, health & social (61–62)", "教育・医療福祉（61–62）") },
  { id: "fire", values: ["52", "53"], color: "#2dd4bf", label: l3("金融、不動產（52–53）", "Finance & real estate (52–53)", "金融・不動産（52–53）") },
  cat("71", "#facc15", "藝文娛樂（71）", "Arts & recreation (71)", "芸術・娯楽（71）"),
  { id: "goods", values: ["11", "21", "22", "31", "32", "33"], color: "#a8a29e", label: l3("製造與初級產業（11–33）", "Manufacturing & primary (11–33)", "製造・一次産業（11–33）") },
  { id: "trade", values: ["41", "42", "48", "49", "51"], color: "#818cf8", label: l3("批發、運輸、資訊（41–51）", "Wholesale, transport, information (41–51)", "卸売・運輸・情報（41–51）") },
  cat("91", "#e5e7eb", "公共行政（91）", "Public administration (91)", "公務（91）"),
  { id: "unclassified", values: [".."], color: "#6b7280", label: l3("未分類（4.6 萬）", "Unclassified (46k)", "未分類（4.6 万）") },
];
const DROUGHT_CATS: readonly PhCat[] = [
  cat("D0", "#fde68a", "D0 異常乾燥", "D0 Abnormally dry", "D0 異常乾燥"),
  cat("D1", "#fbbf24", "D1 中度乾旱", "D1 Moderate drought", "D1 中程度の干ばつ"),
  cat("D2", "#f97316", "D2 嚴重乾旱", "D2 Severe drought", "D2 深刻な干ばつ"),
  cat("D3", "#dc2626", "D3 極端乾旱", "D3 Extreme drought", "D3 極度の干ばつ"),
  cat("D4", "#7f1d1d", "D4 異常極端乾旱", "D4 Exceptional drought", "D4 異例の干ばつ"),
];
const SOIL_GETTER: PhCatGetter = {
  expr: ["case", ["==", ["to-string", ["coalesce", ["get", "order_en"], ""]], ""], "uncovered", ["get", "order_en"]],
  js: (p) => str(p.order_en) || "uncovered",
};
const SOIL_FILL = "ca-soil-landscapes-fill";
const SOIL_UNCOVERED = "ca-soil-landscapes-uncovered-line";
const soilCat = (id: string, color: string, zh: string, ja: string) => cat(id, color, zh, id, ja, { parts: [SOIL_FILL] });
const SOIL_CATS: readonly PhCat[] = [
  soilCat("Chernozemic", "#78350f", "黑鈣土", "チェルノーゼム"), soilCat("Luvisolic", "#d97706", "淋溶土", "ルビソル"),
  soilCat("Podzolic", "#a78bfa", "灰化土", "ポドゾル"), soilCat("Brunisolic", "#b45309", "棕色土", "ブルニソル"),
  soilCat("Gleysolic", "#38bdf8", "潛育土", "グライソル"), soilCat("Organic", "#166534", "有機土", "有機質土"),
  soilCat("Regosolic", "#fde68a", "未熟土", "レゴソル"), soilCat("Solonetzic", "#f472b6", "鹼土", "ソロネッツ"),
  soilCat("Vertisolic", "#64748b", "變性土", "バーティソル"), soilCat("Cryosolic", "#e0f2fe", "凍土", "クリオソル"),
  { id: "uncovered", values: ["uncovered"], color: "#9ca3af", label: l3("屬性未涵蓋（只畫外框）", "Attributes not covered (outline only)", "属性未収録（輪郭のみ）"), parts: [SOIL_UNCOVERED] },
];
const SOIL_DRAINAGE: Record<string, L3> = {
  VR: l3("排水極快", "Very rapid", "極めて速い"), R: l3("排水快", "Rapid", "速い"), W: l3("排水良好", "Well", "良好"), MW: l3("排水中等", "Moderately well", "やや良好"),
  I: l3("排水不完全", "Imperfect", "やや不良"), P: l3("排水不良", "Poor", "不良"), VP: l3("排水極差", "Very poor", "極めて不良"),
};

const W78: CaWaveSpec[] = [
  {
    key: "caMines", file: "ca_mines.pmtiles", sourceId: "ca-mines", srcMinzoom: 3, srcMaxzoom: 11, color: "#fbbf24", count: 379,
    parts: [pt("ca-mines-circle", "ca_mines", 3, propGetter("group"), { hollow: { when: ["==", ["get", "kind"], "exploration"], js: (p) => str(p.kind) === "exploration", label: l3("空心＝探勘案（尚未生產）", "Hollow = exploration project (not producing)", "白抜き＝探鉱案件（未生産）") } })],
    cats: MINE_CATS,
    title: { props: ["name"], fallback: l3("礦場", "Mine", "鉱山") },
    fields: [{ prop: "kind", label: l3("類型", "Kind", "種別"), map: { mine: l3("生產礦場", "Producing mine", "生産鉱山"), metallurgical: l3("冶金設施", "Metallurgical facility", "冶金施設"), exploration: l3("探勘案", "Exploration project", "探鉱案件") } },
      { prop: "operator", label: l3("營運者", "Operator", "運営者") }, { prop: "commodity", label: l3("礦產", "Commodity", "鉱種") },
      { prop: "facility", label: l3("設施", "Facility", "施設") }, CITY, PROV],
    legendNotes: [l3("NRCan 900A 主要礦場、冶煉廠＋前 100 大探勘案；油氣田與礦業權未收", "NRCan 900A producing mines and metallurgical plants + top 100 exploration projects; oil & gas fields and claims not included", "NRCan 900A の主要鉱山・製錬所＋上位 100 探鉱案件。油ガス田と鉱業権は未収録"), COVER_ALL],
    popupNotes: [],
    sourceOrg: "Natural Resources Canada, Principal Mineral Areas, Producing Mines, and Oil and Gas Fields (900A)；Top 100 Exploration Projects", sourceUrl: "https://open.canada.ca/data/en/dataset/000183ed-8864-42f0-ae43-c4313a860720", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("礦場", "mines"),
  },
  {
    key: "caGrainElevators", file: "ca_grain_elevators.pmtiles", sourceId: "ca-grain-elevators", srcMinzoom: 3, srcMaxzoom: 11, color: "#facc15", count: 401,
    parts: [pt("ca-grain-elevators-circle", "ca_grain_elevators", 3, propGetter("elev_type"), { size: {
      prop: "capacity_t", title: l3("圖示大小：容量（公噸）", "Symbol size: capacity (t)", "記号の大きさ：容量（t）"),
      bands: [{ min: 0, radius: 3, label: "< 10,000" }, { min: 10000, radius: 4.5, label: "10,000–50,000" }, { min: 50000, radius: 6.5, label: "≥ 50,000" }] } })],
    cats: [cat("Primary", "#facc15", "一級（集貨）升降機", "Primary elevator", "一次エレベーター"), cat("Process", "#f97316", "加工廠", "Process elevator", "加工エレベーター"), cat("Terminal", "#38bdf8", "港口終端升降機", "Terminal elevator", "ターミナルエレベーター")],
    sizeLegend: [{ prop: "capacity_t", title: l3("圖示大小：容量（公噸）", "Symbol size: capacity (t)", "記号の大きさ：容量（t）"),
      bands: [{ min: 0, radius: 3, label: "< 10,000" }, { min: 10000, radius: 4.5, label: "10,000–50,000" }, { min: 50000, radius: 6.5, label: "≥ 50,000" }] }],
    title: { props: ["station"], fallback: l3("穀物升降機", "Grain elevator", "穀物エレベーター") },
    fields: [{ prop: "elev_type", label: l3("類型", "Type", "種別"), map: { Primary: l3("一級（集貨）", "Primary", "一次"), Process: l3("加工", "Process", "加工"), Terminal: l3("港口終端", "Terminal", "ターミナル") } },
      { prop: "railway", label: l3("鐵路", "Railway", "鉄道") }, { prop: "capacity_t", label: l3("容量", "Capacity", "容量"), kind: "num", unit: "t" }, PROV],
    legendNotes: [l3("2015 年資料（最新有座標版）", "2015 data (latest edition with coordinates)", "2015 年データ（座標付きの最新版）"),
      l3("NL、PE、NB、YT、NT、NU 沒有持照穀物升降機（不是未涵蓋）", "NL, PE, NB, YT, NT and NU have no licensed grain elevators (not 'not covered')", "NL・PE・NB・YT・NT・NU には認可穀物エレベーターがない（未収録ではない）")],
    popupNotes: [],
    sourceOrg: "Agriculture and Agri-Food Canada／Canadian Grain Commission, Grain Elevators in Canada (2015)", sourceUrl: "https://open.canada.ca/data/en/dataset/5e0b5778-80cd-4697-8b84-23b4a814c1ae", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("穀物升降機", "grain elevators"),
  },
  {
    key: "caDroughtMonitor", file: "ca_drought_monitor.pmtiles", sourceId: "ca-drought-monitor", srcMinzoom: 2, srcMaxzoom: 9, color: "#f97316", count: 49, opacity: 0.55,
    parts: [fill("ca-drought-monitor-fill", "ca_drought_monitor", 2, propGetter("category"), 1)],
    cats: DROUGHT_CATS,
    title: { props: [], fallback: l3("乾旱", "Drought", "干ばつ"), fallbackBy: { prop: "category", map: catMap(DROUGHT_CATS) } },
    fields: [{ prop: "category", label: l3("等級", "Category", "区分"), map: catMap(DROUGHT_CATS) }, { prop: "month", label: l3("月份", "Month", "月") }],
    legendNotes: [l3("2026 年 10 月一期（快照 2026-11-17）", "October 2026 edition (snapshot 2026-11-17)", "2026 年 10 月版（2026-11-17 取得）"),
      l3("沒有面＝該月無乾旱，不是未涵蓋", "No polygon = no drought that month, not 'not covered'", "面がない＝その月は干ばつなし（未収録ではない）")],
    popupNotes: [],
    sourceOrg: "Agriculture and Agri-Food Canada, Canadian Drought Monitor", sourceUrl: "https://open.canada.ca/data/en/dataset/292646cd-619f-4200-afb1-8b2c52f984a2", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("乾旱監測", "drought monitor"),
  },
  {
    key: "caSoilLandscapes", file: "ca_soil_landscapes.pmtiles", sourceId: "ca-soil-landscapes", srcMinzoom: 2, srcMaxzoom: 10, color: "#b45309", count: 12353, opacity: 0.5,
    parts: [fill(SOIL_FILL, "ca_soil_landscapes", 3, SOIL_GETTER, 1, { filter: ["!=", ["to-string", ["coalesce", ["get", "order_en"], ""]], ""] }),
      line(SOIL_UNCOVERED, "ca_soil_landscapes", 3, SOIL_GETTER, { filter: ["==", ["to-string", ["coalesce", ["get", "order_en"], ""]], ""], lineWidth: { uncovered: [0.5, 1] } })],
    cats: SOIL_CATS,
    title: { props: ["dom_soil"], fallback: l3("土壤景觀", "Soil landscape", "土壌景観"), fallbackBy: { prop: "order_en", map: catMap(SOIL_CATS) } },
    fields: [{ prop: "order_en", label: l3("土綱（優勢組成）", "Soil order (dominant)", "土壌目（優占）"), map: catMap(SOIL_CATS) },
      { prop: "dom_pct", label: l3("優勢組成占比", "Dominant share", "優占割合"), kind: "num", unit: "%" },
      { prop: "drainage", label: l3("排水", "Drainage", "排水"), map: SOIL_DRAINAGE }, { prop: "parent_texture", label: l3("母質質地代碼", "Parent material texture code", "母材の土性コード"), kind: "code" }],
    legendNotes: [l3("SLC v3.2，1:1M，每個多邊形取優勢組成的土綱", "SLC v3.2, 1:1M; each polygon shows its dominant component's soil order", "SLC v3.2、1:1M。各ポリゴンは優占構成要素の土壌目"),
      l3("組成表只有十省南部 4,579／12,353 面；其餘（三領地、各省北部）沒有土綱屬性＝未涵蓋，只畫外框，不是沒有土壤", "Component tables cover only 4,579 of 12,353 polygons (southern provinces); the rest (territories, northern provinces) lack soil-order attributes = not covered, outline only, not 'no soil'", "構成表は 12,353 面中 4,579（10 州南部）のみ。その他（準州・各州北部）は土壌目の属性がなく未収録で輪郭のみ（土壌がないわけではない）")],
    popupNotes: [{ text: l3("本多邊形沒有組成屬性（未涵蓋）", "No component attributes for this polygon (not covered)", "このポリゴンは構成属性なし（未収録）"), when: (p) => !str(p.order_en) }],
    sourceOrg: "Agriculture and Agri-Food Canada, Soil Landscapes of Canada v3.2", sourceUrl: "https://open.canada.ca/data/en/dataset/5ad5e20c-f2bb-497d-a2a2-440eec6e10cd", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("土壤景觀", "soil landscapes"),
  },
  {
    key: "caNsAquaculture", file: "ca_ns_aquaculture.pmtiles", sourceId: "ca-ns-aquaculture", srcMinzoom: 5, srcMaxzoom: 13, color: "#38bdf8", count: 202, opacity: 0.75,
    parts: [fill("ca-ns-aquaculture-fill", "ca_ns_aquaculture", 5, propGetter("species_type"), 1)],
    cats: NS_AQUA_CATS,
    title: { props: ["waterbody"], fallback: l3("養殖租約", "Aquaculture lease", "養殖リース") },
    fields: [{ prop: "license_no", label: l3("執照號", "Licence no.", "許可番号"), kind: "code" }, { prop: "species", label: l3("養殖物種", "Species", "養殖種") },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: { Issued: l3("核發", "Issued", "発行済み"), "Issued Experimental": l3("核發（試驗）", "Issued (experimental)", "発行済み（試験）") } },
      { prop: "hectares", label: l3("面積", "Area", "面積"), kind: "num", digits: 2, unit: "ha" }, { prop: "county", label: l3("郡", "County", "郡") }],
    legendNotes: [l3("只有新斯科細亞省（1／13）；NB、PE、NL 等未涵蓋", "Nova Scotia only (1 of 13); NB, PE, NL and others not covered", "ノバスコシア州のみ（13 中 1）。NB・PE・NL などは未収録"), l3("租約持有人不輸出", "Leaseholder names not shown", "リース保有者名は表示しない")],
    popupNotes: [],
    sourceOrg: "NS Department of Fisheries and Aquaculture", sourceUrl: "https://data.novascotia.ca/datasets/h57h-p9mm", license: "Open Government Licence – Nova Scotia",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("新斯科細亞養殖", "Nova Scotia aquaculture"),
  },
  {
    key: "caAbattoirs", file: "ca_abattoirs.pmtiles", sourceId: "ca-abattoirs", srcMinzoom: 4, srcMaxzoom: 12, color: "#f87171", count: 135,
    parts: [pt("ca-abattoirs-circle", "ca_abattoirs", 4, propGetter("src"))],
    cats: [cat("ON", "#f87171", "安大略（省級持照）", "Ontario (provincially licensed)", "オンタリオ州（州認可）"), cat("MB", "#fb923c", "曼尼托巴（省級持照）", "Manitoba (provincially licensed)", "マニトバ州（州認可）")],
    title: { props: ["name"], fallback: l3("屠宰場", "Abattoir", "食肉処理場") },
    fields: [CITY, { prop: "species", label: l3("屠宰物種", "Species", "対象畜種") }, PROV],
    legendNotes: [l3("省級持照屠宰場；聯邦 CFIA 肉品廠未收", "Provincially licensed abattoirs; federal CFIA plants not included", "州認可の食肉処理場。連邦 CFIA 施設は未収録"), COVER(2, "ON、MB 以外 11 省區")],
    popupNotes: [],
    sourceOrg: "Ontario provincially licensed abattoirs（OGL-Ontario）；Government of Manitoba, Abattoirs and Processing Facilities", sourceUrl: "https://data.ontario.ca/dataset/a763088c-018d-48b7-bf47-3027a8c725b8", license: `${OGL_ON}；${MB_OD}`,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("屠宰場", "abattoirs"),
  },
  {
    key: "caOdbus", file: "ca_odbus.pmtiles", sourceId: "ca-odbus", srcMinzoom: 6, srcMaxzoom: 13, color: "#a78bfa", count: 312097,
    parts: [pt("ca-odbus-circle", "ca_odbus", 6, propGetter("naics"), { small: true })],
    cats: NAICS,
    title: { props: ["naics_descr"], fallback: l3("營業登記", "Business licence", "営業登録"), fallbackBy: { prop: "naics", map: catMap(NAICS) } },
    fields: [{ prop: "naics", label: l3("NAICS 大類", "NAICS sector", "NAICS 大分類"), map: catMap(NAICS) }, { prop: "naics_descr", label: l3("產業細類", "Industry", "産業細分類") },
      { prop: "status", label: l3("執照狀態", "Licence status", "許可状態") }, CITY, PROVIDER, PROV],
    legendNotes: [l3("部分城市營業執照彙整（StatCan ODBus）；不含名稱、地址", "Compiled from some cities' business licences (StatCan ODBus); names and addresses not shown", "一部都市の営業許可を集約（StatCan ODBus）。名称・住所は表示しない"),
      l3("另有 13.4 萬筆無座標未上圖", "Another 134k records without coordinates are not drawn", "座標のない 13.4 万件は描画しない"), COVER(7, "NL、PE、NS、MB、SK、NU")],
    popupNotes: [],
    sourceOrg: "Statistics Canada, Open Database of Businesses (ODBus) v1.0", sourceUrl: "https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm", license: OGL_CA,
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("營業登記", "business licences"),
  },
  {
    key: "caTorontoDevApplications", file: "ca_toronto_dev_applications.pmtiles", sourceId: "ca-toronto-dev-applications", srcMinzoom: 9, srcMaxzoom: 14, color: "#f472b6", count: 8592,
    parts: [pt("ca-toronto-dev-applications-circle", "ca_toronto_dev_applications", 9, constGetter("dev"))],
    cats: [cat("dev", "#f472b6", "開發申請位置", "Development application location", "開発申請の位置")],
    title: { props: [], fallback: l3("開發申請", "Development application", "開発申請") },
    fields: [PROV],
    legendNotes: [TORONTO_ONLY, l3("授權未明示，只上位置（快照 2026-11-17）", "Licence not stated: locations only (snapshot 2026-11-17)", "ライセンス未明示のため位置のみ（2026-11-17 取得）")],
    popupNotes: [],
    sourceOrg: "City of Toronto Open Data, Development Applications", sourceUrl: "https://open.toronto.ca/dataset/development-applications/", license: "授權未明示（Toronto CKAN：License not specified）",
    fetchedAt: CA_WAVES_FETCHED_AT, loading: loading("多倫多開發申請", "Toronto development applications"),
  },
];

export const CA_WAVE_SPECS: readonly CaWaveSpec[] = [...W3, ...W4, ...W56, ...W78];
export const CA_WAVE_SPEC_BY_KEY = Object.fromEntries(CA_WAVE_SPECS.map((s) => [s.key, s])) as Readonly<Record<CaWaveKey, CaWaveSpec>>;

/** 類別多選預設 bitmask（有 `catDefault` 者）；選項順序＝cats（＋「其他」）。 */
export function caWaveDefaultCatMask(spec: CaWaveSpec): number | undefined {
  if (!spec.catDefault) return undefined;
  const ids = phCatOptionIds(spec);
  return ids.reduce((m, id, i) => (spec.catDefault!.includes(id) ? m | (1 << i) : m), 0);
}
