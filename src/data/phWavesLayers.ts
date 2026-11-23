/**
 * 菲律賓觀光波與第 2–9 波（2026-11-16）圖層規格 SSOT：規格驅動層（展開進 `PH_DATA_SPECS`）與 raster 4 層。
 * 資料端：taipei-gis-analytics #394（`docs/topic-research/philippines_opendata/waves/tourism/layer-plan.md`）、
 * #396（`waves/w02`～`w09/layer-plan.md`、`HANDOFF-ph-2-9.md`）；各 `_manifest.json` provenance 2026-11-16 讀。
 * 主 agent 決定（2026-11-16）：HOLD 6 層不接（C020 祖傳領域、C072 液化、C110 水區、C127 BMB 保護區、C118 土壤、X005 ARC）；
 * 保護區用 WDPA（非商用、DISPLAY_ONLY）；Conditional 授權照常上欄位；完整性未驗證者圖例寫「部分」；餐飲不做；
 * GeoJSON 數值是字串（'2004.0'），popup 一律轉數字（`kind: "num"／"year"`）。
 * 卡拉延群島：其他層資料端已不輸出；地震保留周邊海域（`PH_EQ_SHOW_KALAYAAN_SEA`，站主可能改）。
 * 地名不畫文字標籤：PMTiles vector source 上的 symbol placement 會讓整張地圖 render 中止（見 useCaTerrainLayers），比照加拿大地名畫點、名稱放 popup。
 */
import type { PhDataKey, PhRasterKey } from "./phDataKeys";
import type { L3 } from "./krDataLayers";
import type { PhCat, PhCatGetter, PhField, PhLayerSpec, PhSizeBands } from "./phDataLayers";

type Expr = unknown[];
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });

export const PH_WAVES_FETCHED_AT = "2026-11-16";
const ODBL = "ODbL 1.0";
const OSM_URL = "https://www.openstreetmap.org/copyright";
const OSM_1115 = l3("© OpenStreetMap contributors（ODbL），via Geofabrik（philippines-261115，快照 2026-11-15）", "© OpenStreetMap contributors (ODbL), via Geofabrik (philippines-261115, snapshot 2026-11-15)", "© OpenStreetMap contributors（ODbL）、Geofabrik 経由（philippines-261115、2026-11-15 のスナップショット）");
const GEOPORTAL_URL = "https://www.geoportal.gov.ph/";
const CONDITIONAL = l3("Geoportal 盤點表：Conditional downloading（WMS GetFeatureInfo 取得）", "Geoportal inventory: Conditional downloading (obtained via WMS GetFeatureInfo)", "Geoportal 一覧表：Conditional downloading（WMS GetFeatureInfo で取得）");
const MO008 = l3("PSA／機關公開資料，依 MO 008 s.2022 視同署名", "PSA / agency open data; attribution deemed sufficient under MO 008 s.2022", "PSA／機関の公開データ。MO 008 s.2022 により出典表示で足りるとみなす");
/** 來源字串拼接：各語系各接各的（英／日介面不混中文） */
const j3 = (...parts: (string | L3)[]): L3 => ({
  zh: parts.map((p) => (typeof p === "string" ? p : p.zh)).join(""),
  en: parts.map((p) => (typeof p === "string" ? p : p.en)).join(""),
  ja: parts.map((p) => (typeof p === "string" ? p : p.ja)).join(""),
});
const SEP = l3("；", "; ", "。");
const GAP_FILL = l3("；補缺 ", "; gap-fill: ", "。補完：");
const COND_OSM = j3(CONDITIONAL, l3("；OSM ", "; OSM ", "。OSM "), ODBL);
const OSM_NOTE = l3("OpenStreetMap 非官方名冊，標註不全處不代表沒有", "OpenStreetMap is not an official register — gaps do not mean absence", "OpenStreetMap は公式名簿ではなく、未登録は「ない」という意味ではない");
const BARMM_SPARSE = l3("BARMM：OSM 稀疏（每 10 萬人筆數不到全國中位數 1/3）", "BARMM: sparse in OSM (fewer than a third of the national median per 100,000 people)", "BARMM：OSM が疎（10 万人あたり件数が全国中央値の 1/3 未満）");
const PARTIAL = l3("部分：Geoportal 查詢所得，完整性未驗證", "Partial: obtained by Geoportal queries; completeness not verified", "部分的：Geoportal の照会で取得、網羅性は未確認");

const PROV: PhField = { prop: "province_name", label: l3("省", "Province", "州") };
const REGION: PhField = { prop: "region_name", label: l3("區域", "Region", "地方") };
const NAME_EN: PhField = { prop: "name_en", label: l3("英文名", "English name", "英語名"), unlessSameAs: "name" };
const OPERATOR: PhField = { prop: "operator", label: l3("營運者", "Operator", "運営者") };
const cat = (id: string, color: string, zh: string, en: string, ja: string, extra: Partial<PhCat> = {}): PhCat => ({ id, values: [id], color, label: l3(zh, en, ja), ...extra });
const catMap = (cats: readonly PhCat[]): Record<string, L3> => Object.fromEntries(cats.flatMap((c) => c.values.map((v) => [v, c.label])));
const CATEGORY = (cats: readonly PhCat[]): PhField => ({ prop: "category", label: l3("類別", "Category", "種別"), map: catMap(cats) });
const SOURCE_FIELD = (map: Record<string, L3>): PhField => ({ prop: "source", label: l3("來源", "Source", "出典"), map });
const OSM_SRC = l3("OSM 補缺", "OSM gap-fill", "OSM 補完");
const notOfficial = (official: string): Expr => ["!=", ["to-string", ["coalesce", ["get", "source"], ""]], official];
const isOsm: Expr = ["==", ["to-string", ["coalesce", ["get", "source"], ""]], "osm"];
const HOLLOW_OSM = (zh: string, en: string, ja: string) => ({ when: isOsm, js: (p: Record<string, unknown>) => str(p.source) === "osm", label: l3(zh, en, ja) });
const loading = (zh: string, en: string): L3 => l3(`菲律賓${zh}載入中`, `Loading Philippines ${en}`, `フィリピンの${zh}を読み込み中`);

/** 單一 tile layer 的點層（最常見）。 */
function pointPart(id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhLayerSpec["parts"][number]> = {}) {
  return { id, sourceLayer, geom: "point" as const, minzoom, cat: getter, ...extra };
}

// ═════════════════════════ 觀光波（analytics #394） ═════════════════════════

const TOURISM_TIER: PhSizeBands = {
  prop: "tier", title: l3("圖示大小：重要程度", "Symbol size: prominence", "記号の大きさ：重要度"),
  bands: [
    { min: 0, radius: 6.5, label: l3("UNESCO／國家公園", "UNESCO / national park", "UNESCO・国立公園") },
    { min: 2, radius: 5, label: l3("Wikidata 熱門", "Popular on Wikidata", "Wikidata 人気") },
    { min: 3, radius: 3.5, label: l3("一般", "Other", "一般") },
    { min: 4, radius: 2.5, label: l3("未命名", "Unnamed", "名称なし") },
  ],
};
const DOT_APPROX: Expr = ["==", ["to-string", ["coalesce", ["get", "coord_quality"], ""]], "dot_approximate"];
const TOURISM_HOLLOW = { when: DOT_APPROX, js: (p: Record<string, unknown>) => str(p.coord_quality) === "dot_approximate",
  label: l3("空心＝DOT 清單近似位置（多筆共用市鎮中心座標）", "Hollow = approximate location from the DOT list (several share a town-centre coordinate)", "白抜き＝DOT 一覧の概略位置（複数が市町中心の座標を共有）") };
const COORD_QUALITY: Record<string, L3> = {
  dot_approximate: l3("近似位置（DOT 清單，多筆共用市鎮中心座標）", "Approximate (DOT list; shares a town-centre coordinate)", "概略位置（DOT 一覧、市町中心の座標を共有）"),
  dot_point: l3("DOT 清單座標", "DOT list coordinate", "DOT 一覧の座標"),
  osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap"),
  wikidata: l3("Wikidata", "Wikidata", "Wikidata"),
  unesco: l3("UNESCO 世界遺產構成點", "UNESCO World Heritage component", "UNESCO 世界遺産の構成資産"),
};
const TOURISM_NOTES_COMMON: readonly L3[] = [
  l3("大圖示＝UNESCO／國家公園或 Wikidata 熱門條目；熱門程度依網路關注度，不代表遊客量", "Large symbols = UNESCO / national parks or popular Wikidata items; popularity reflects online attention, not visitor numbers", "大きい記号＝UNESCO・国立公園または Wikidata の人気項目。人気度はネット上の注目度で、来訪者数ではない"),
  l3("拉遠只顯示重要條目（z4 起 UNESCO／國家公園、z7 起 Wikidata 熱門、z10 起一般、z12 起未命名）", "Zoomed out shows only prominent items (UNESCO / national parks from z4, popular Wikidata items from z7, others from z10, unnamed from z12)", "縮小時は重要項目のみ（z4 から UNESCO・国立公園、z7 から Wikidata 人気、z10 から一般、z12 から名称なし）"),
];
const TOURISM_FIELDS = (cats: readonly PhCat[]): PhField[] => [
  NAME_EN,
  { prop: "name_tl", label: l3("他加祿語名", "Tagalog name", "タガログ語名"), unlessSameAs: "name" },
  CATEGORY(cats),
  { prop: "whc_name", label: l3("世界遺產", "World Heritage site", "世界遺産") },
  { prop: "whc_inscribed", label: l3("登錄年", "Inscribed", "登録年"), kind: "year" },
  { prop: "coord_quality", label: l3("座標", "Coordinates", "座標"), map: COORD_QUALITY },
  { prop: "sources", label: l3("資料來源", "Sources", "出典"), kind: "code" },
  PROV, REGION,
];
const TOURISM_POPUP_NOTES = [{ text: l3("近似位置：DOT 清單多筆共用同一市鎮中心座標，不是景點實際位置", "Approximate: several DOT entries share one town-centre coordinate; not the exact site", "概略位置：DOT 一覧の複数項目が同じ市町中心の座標を共有し、実際の場所ではない"), when: (p: Record<string, unknown>) => str(p.coord_quality) === "dot_approximate" }];
const TOURISM_SOURCE = l3("© OpenStreetMap contributors（ODbL，Geofabrik 2026-11-15）；DOT 景點清單 via Geoportal（Conditional）；UNESCO（CC BY-SA 4.0）；Wikidata（CC0）", "© OpenStreetMap contributors (ODbL, Geofabrik 2026-11-15); DOT attraction list via Geoportal (Conditional); UNESCO (CC BY-SA 4.0); Wikidata (CC0)", "© OpenStreetMap contributors（ODbL、Geofabrik 2026-11-15）。DOT の観光地リスト（Geoportal 経由、Conditional）。UNESCO（CC BY-SA 4.0）。Wikidata（CC0）");
const TOURISM_LICENSE = "ODbL 1.0（OSM）＋CC BY-SA 4.0（UNESCO）＋CC0（Wikidata）；DOT Geoportal Conditional downloading";

const ATTRACTION_CATS: readonly PhCat[] = [
  cat("unesco_site", "#fbbf24", "世界遺產", "World Heritage site", "世界遺産"),
  cat("protected", "#22c55e", "保護區、國家公園", "Protected area / national park", "保護区・国立公園"),
  cat("attraction", "#f472b6", "景點", "Attraction", "観光スポット"),
  cat("heritage", "#a78bfa", "古蹟與紀念地", "Heritage & memorials", "史跡・記念地"),
  cat("museum", "#60a5fa", "博物館", "Museum", "博物館"),
  cat("viewpoint", "#2dd4bf", "觀景點", "Viewpoint", "展望地"),
  cat("park", "#86efac", "公園", "Park", "公園"),
];
const COAST_CATS: readonly PhCat[] = [
  cat("beach", "#fde68a", "海灘", "Beach", "ビーチ"),
  cat("island", "#34d399", "島", "Island", "島"),
  cat("islet", "#a7f3d0", "小島", "Islet", "小島"),
  cat("dive", "#38bdf8", "潛水點、潛水店", "Dive site / dive shop", "ダイビングスポット・ショップ"),
  cat("marine_site", "#818cf8", "海洋保護區、礁", "Marine site / reef", "海洋保護区・礁"),
  cat("lagoon", "#22d3ee", "潟湖", "Lagoon", "ラグーン"),
];
const NATURE_CATS: readonly PhCat[] = [
  cat("waterfall", "#38bdf8", "瀑布", "Waterfall", "滝"),
  cat("cave", "#a8a29e", "洞穴", "Cave", "洞窟"),
  cat("volcano", "#ef4444", "火山", "Volcano", "火山"),
  cat("hot_spring", "#f97316", "溫泉", "Hot spring", "温泉"),
  cat("lake", "#60a5fa", "湖", "Lake", "湖"),
  cat("mountain", "#a3e635", "山", "Mountain", "山"),
];
const SERVICE_CATS: readonly PhCat[] = [
  cat("lodging", "#c084fc", "住宿", "Lodging", "宿泊施設"),
  cat("resort", "#f472b6", "度假村", "Resort", "リゾート"),
  cat("theme_park_zoo", "#facc15", "樂園、動物園、水族館", "Theme park / zoo / aquarium", "テーマパーク・動物園・水族館"),
  cat("camp_site", "#4ade80", "露營地", "Campsite", "キャンプ場"),
  cat("visitor_centre", "#38bdf8", "遊客中心", "Visitor centre", "ビジターセンター"),
];
const TDA_CATS: readonly PhCat[] = [
  { id: "north", values: ["Northern Philippines"], color: "#60a5fa", label: l3("北菲律賓", "Northern Philippines", "北部フィリピン") },
  { id: "central", values: ["Central Philippines"], color: "#facc15", label: l3("中菲律賓", "Central Philippines", "中部フィリピン") },
  { id: "south", values: ["Southern Philippines"], color: "#f97316", label: l3("南菲律賓", "Southern Philippines", "南部フィリピン") },
];

function tourismPointSpec(key: PhDataKey, id: string, file: string, layer: string, color: string, count: number, cats: readonly PhCat[], titleZh: L3, extraNotes: readonly L3[], load: L3, extraFields: PhField[] = []): PhLayerSpec {
  return {
    key, file, sourceId: file.replace(/\.pmtiles$/, "").replace(/_/g, "-"), srcMinzoom: 4, srcMaxzoom: 14, color, count,
    parts: [pointPart(id, layer, 4, propGetter("category"), { size: TOURISM_TIER, hollow: TOURISM_HOLLOW })],
    cats, sizeLegend: [TOURISM_TIER],
    title: { props: ["name", "name_en"], fallback: titleZh },
    fields: [...TOURISM_FIELDS(cats), ...extraFields],
    legendNotes: [...TOURISM_NOTES_COMMON, ...extraNotes],
    popupNotes: TOURISM_POPUP_NOTES,
    sourceOrg: TOURISM_SOURCE, sourceUrl: OSM_URL, license: TOURISM_LICENSE, fetchedAt: PH_WAVES_FETCHED_AT, loading: load,
  };
}

const TOURISM_SPECS: PhLayerSpec[] = [
  tourismPointSpec("phTouristAttractions", "ph-tourist-attractions-circle", "ph_tourist_attractions.pmtiles", "tourist_attractions", "#f472b6", 7029, ATTRACTION_CATS,
    l3("未命名景點", "Unnamed attraction", "名称不明の観光スポット"),
    [l3("UNESCO 世界遺產 6 處（13 個構成點）併在本層；外海的 Tubbataha Reefs 歸 Palawan", "6 UNESCO World Heritage sites (13 components) are in this layer; offshore Tubbataha Reefs is assigned to Palawan", "UNESCO 世界遺産 6 件（構成資産 13）を含む。沖合の Tubbataha Reefs は Palawan に帰属"),
      l3("古蹟類含人名紀念碑（公開地名，不是個資）", "Heritage includes memorials named after people (public place names)", "史跡には人名の記念碑を含む（公開地名）")],
    loading("景點", "attractions")),
  tourismPointSpec("phCoastIslands", "ph-coast-islands-circle", "ph_coast_islands.pmtiles", "coast_islands", "#fde68a", 7033, COAST_CATS,
    l3("未命名海岸、島嶼", "Unnamed coast / island", "名称不明の海岸・島"),
    [l3("未命名的海灘與潛水點在放大後才出現", "Unnamed beaches and dive sites appear only when zoomed in", "名称のないビーチ・ダイビングスポットは拡大時のみ表示"),
      l3("潛水點只涵蓋 14/18 region", "Dive sites cover only 14 of 18 regions", "ダイビングスポットは 18 地方中 14 のみ")],
    loading("海岸與島嶼", "coasts and islands")),
  tourismPointSpec("phNatureSpots", "ph-nature-spots-circle", "ph_nature_spots.pmtiles", "nature_spots", "#38bdf8", 1949, NATURE_CATS,
    l3("未命名自然景觀", "Unnamed natural site", "名称不明の自然景観"),
    [l3("溫泉只涵蓋 11/18 region", "Hot springs cover only 11 of 18 regions", "温泉は 18 地方中 11 のみ")],
    loading("自然景觀", "natural sites")),
  tourismPointSpec("phTourismServices", "ph-tourism-services-circle", "ph_tourism_services.pmtiles", "tourism_services", "#c084fc", 15276, SERVICE_CATS,
    l3("未命名住宿、服務", "Unnamed lodging / service", "名称不明の宿泊・サービス"),
    [OSM_NOTE, l3("餐飲不在本層", "Restaurants are not included", "飲食店は含まない")],
    loading("住宿與觀光服務", "lodging and tourism services"),
    [{ prop: "stars", label: l3("星級（OSM）", "Stars (OSM)", "星（OSM）"), kind: "num", digits: 1 }]),
  {
    key: "phTourismDevelopmentAreas", file: "ph_tourism_development_areas.pmtiles", sourceId: "ph-tourism-development-areas", srcMinzoom: 4, srcMaxzoom: 12, color: "#facc15", count: 50, opacity: 0.6,
    parts: [
      { id: "ph-tda-fill", sourceLayer: "tourism_development_areas", geom: "fill", minzoom: 4, cat: propGetter("macro_area"), fillOpacity: 0.45 },
      { id: "ph-tda-line", sourceLayer: "tourism_development_areas", geom: "line", minzoom: 4, cat: propGetter("macro_area") },
    ],
    cats: TDA_CATS,
    title: { props: ["cluster_name", "tda_code"], fallback: l3("觀光發展區", "Tourism development area", "観光開発地域") },
    fields: [
      { prop: "cluster_name", label: l3("觀光群", "Cluster", "観光クラスター") },
      { prop: "macro_area", label: l3("大區", "Macro area", "大区分"), map: catMap(TDA_CATS) },
      { prop: "lgus_listed", label: l3("計畫列出的地方政府", "LGUs listed", "計画に記載の自治体") },
      { prop: "n_municipalities", label: l3("市鎮數", "Municipalities", "市町数"), kind: "num" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 0 },
    ],
    legendNotes: [
      l3("DOT 國家觀光發展計畫 2023–2028 Table 22：20 個觀光群、50 個 TDA；不代表遊客量", "DOT National Tourism Development Plan 2023–2028, Table 22: 20 clusters, 50 TDAs; not visitor numbers", "DOT 国家観光開発計画 2023–2028 表 22：20 クラスター・50 TDA。来訪者数ではない"),
      l3("Palawan 南北分界（以 Puerto Princesa 為界）與 Siargao 市鎮名單為本站依地理自訂", "The Palawan north/south split (at Puerto Princesa) and the Siargao municipality list are this site's geographic interpretation", "Palawan の南北境界（Puerto Princesa で区分）と Siargao の市町一覧は本サイトが地理的に設定"),
      l3("Cuyo、Agutaya、Magsaysay、Cagayancillo 與 BARMM Special Geographic Area 8 市鎮（共 12 個）不在任何 TDA：空白＝不在計畫內，不是缺資料；Clark、Subic 自由港未另畫", "Cuyo, Agutaya, Magsaysay, Cagayancillo and the 8 BARMM Special Geographic Area municipalities (12 in all) are in no TDA: blank = outside the plan, not missing data; Clark and Subic freeports not drawn separately", "Cuyo・Agutaya・Magsaysay・Cagayancillo と BARMM 特別地理区域の 8 市町（計 12）はどの TDA にも属さない。空白＝計画外でデータ欠落ではない。Clark・Subic 自由港は別途描画しない"),
    ],
    popupNotes: [],
    sourceOrg: l3("Department of Tourism，National Tourism Development Plan 2023–2028（Table 22 人工轉錄）；邊界 OCHA COD-AB（CC BY-IGO）", "Department of Tourism, National Tourism Development Plan 2023–2028 (Table 22, manually transcribed); boundaries: OCHA COD-AB (CC BY-IGO)", "Department of Tourism、National Tourism Development Plan 2023–2028（Table 22 を手作業で転記）。境界：OCHA COD-AB（CC BY-IGO）"), sourceUrl: "https://tourism.gov.ph/", license: l3("政府規劃文件，授權未明示", "Government planning document; license not stated", "政府の計画文書で、ライセンスは明示されていない"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("觀光發展區", "tourism development areas"),
  },
];

// ═════════════════════════ 第 2 波（剩餘）：地名、貧窮率 ═════════════════════════

const PLACE_CATS: readonly PhCat[] = [
  cat("P", "#e5e7eb", "聚落（P）", "Populated place (P)", "集落（P）"),
  cat("T", "#d6a26b", "地形（T）：山、火山、島", "Terrain (T): mountains, volcanoes, islands", "地形（T）：山・火山・島"),
  cat("H", "#60a5fa", "水文（H）：河、湖、灣", "Hydrography (H): streams, lakes, bays", "水文（H）：川・湖・湾"),
  cat("L", "#4ade80", "區域（L）", "Area (L)", "区域（L）"),
];
/** 貧窮率 6 級（%，越暗越多）；`incidence_2023` 沒有值＝未涵蓋（BARMM SGA 8 市鎮）。 */
export const PH_POVERTY_BREAKS = [5, 10, 20, 30, 40] as const;
const POVERTY_COLORS = ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#b45309", "#78350f"] as const;
const povertyCat: PhCatGetter = {
  expr: ["case", ["==", ["to-string", ["coalesce", ["get", "incidence_2023"], ""]], ""], "nc",
    ["step", ["to-number", ["get", "incidence_2023"], 0], "p0", 5, "p5", 10, "p10", 20, "p20", 30, "p30", 40, "p40"]],
  js: (p) => {
    const s = str(p.incidence_2023);
    if (!s) return "nc";
    const n = Number(s);
    return n >= 40 ? "p40" : n >= 30 ? "p30" : n >= 20 ? "p20" : n >= 10 ? "p10" : n >= 5 ? "p5" : "p0";
  },
};
const POVERTY_CATS: readonly PhCat[] = [
  ["p0", "0–5%"], ["p5", "5–10%"], ["p10", "10–20%"], ["p20", "20–30%"], ["p30", "30–40%"], ["p40", "≥40%"],
].map(([id, label], i) => ({ id: id!, values: [id!], color: POVERTY_COLORS[i]!, label: l3(label!, label!, label!) }));
const UNIT_TYPE: Record<string, L3> = {
  province_excl_huc: l3("省（不含其高度都市化城市）", "Province (excluding its HUCs)", "州（高度都市化都市を除く）"),
  huc_or_city: l3("高度都市化城市／獨立市", "Highly urbanised / independent city", "高度都市化都市・独立市"),
};

const W2_SPECS: PhLayerSpec[] = [
  {
    key: "phPlaceNames", file: "ph_place_names.pmtiles", sourceId: "ph-place-names", srcMinzoom: 5, srcMaxzoom: 14, color: "#e5e7eb", count: 68597,
    parts: [pointPart("ph-place-names-circle", "place_names", 5, propGetter("feature_class"), { small: true })],
    cats: PLACE_CATS,
    title: { props: ["name", "asciiname"], fallback: l3("地名", "Place name", "地名") },
    fields: [
      { prop: "asciiname", label: l3("拉丁字母拼寫", "ASCII name", "ASCII 表記"), unlessSameAs: "name" },
      { prop: "feature_desc", label: l3("地物類型（GeoNames）", "Feature type (GeoNames)", "地物の種別（GeoNames）"), kind: "code" },
      { prop: "population", label: l3("人口（GeoNames）", "Population (GeoNames)", "人口（GeoNames）"), kind: "num" },
      { prop: "elevation_m", label: l3("海拔", "Elevation", "標高"), kind: "num", unit: "m" },
      PROV, REGION,
    ],
    legendNotes: [
      l3("GeoNames 地名 68,597 筆；依重要性逐級出現：人口 ≥10 萬 z5、≥1 萬 z8、其他聚落 z11；山、火山、島、湖 z9；其他地形水文 z12", "68,597 GeoNames places, appearing by importance: population ≥100k at z5, ≥10k at z8, other settlements z11; mountains, volcanoes, islands, lakes z9; other terrain and water z12", "GeoNames 地名 68,597 件。重要度で段階表示：人口 10 万以上 z5、1 万以上 z8、その他の集落 z11、山・火山・島・湖 z9、その他 z12"),
      l3("只畫點，名稱在彈窗（地圖上不畫文字標籤）；不收行政區（見行政邊界層）、建物與道路", "Points only, names in the popup (no text labels on the map); administrative units (see boundaries), buildings and roads not included", "点のみで名称はポップアップ（地図上に文字ラベルなし）。行政区域（境界レイヤー参照）・建物・道路は含まない"),
    ],
    popupNotes: [{ text: l3("人口為 GeoNames 收錄值，不是普查", "Population is the GeoNames value, not a census", "人口は GeoNames の値で国勢調査ではない"), when: (p) => Number(p.population) > 0 }],
    sourceOrg: l3("GeoNames（PH.zip，2026-11-16 下載）", "GeoNames (PH.zip, downloaded 2026-11-16)", "GeoNames（PH.zip、2026-11-16 ダウンロード）"), sourceUrl: "https://www.geonames.org/", license: "CC BY 4.0", fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("地名", "place names"),
  },
  {
    key: "phPoverty", file: "ph_poverty.pmtiles", sourceId: "ph-poverty", srcMinzoom: 4, srcMaxzoom: 11, color: "#d97706", count: 118, opacity: 0.75,
    parts: [
      { id: "ph-poverty-fill", sourceLayer: "poverty", geom: "fill", minzoom: 4, cat: povertyCat },
    ],
    cats: POVERTY_CATS, otherColor: "#6b7280", otherLabel: l3("未涵蓋（BARMM Special Geographic Area，PSA 表沒有；不是 0）", "Not covered (BARMM Special Geographic Area, not in the PSA table; not zero)", "未収録（BARMM 特別地理区域、PSA 表になし。0 ではない）"),
    legendTitleNote: l3("2023 年", "2023", "2023 年"),
    title: { props: ["psa_label"], fallback: l3("貧窮率", "Poverty incidence", "貧困率") },
    fields: [
      { prop: "unit_type", label: l3("單位", "Unit", "単位"), map: UNIT_TYPE },
      { prop: "incidence_2023", label: l3("2023 貧窮人口比率", "Poverty incidence 2023", "2023 年の貧困率"), kind: "num", unit: "%", digits: 1 },
      { prop: "ci_lo_2023", label: l3("2023 信賴區間下限", "2023 CI lower", "2023 年信頼区間下限"), kind: "num", unit: "%", digits: 1 },
      { prop: "ci_hi_2023", label: l3("2023 信賴區間上限", "2023 CI upper", "2023 年信頼区間上限"), kind: "num", unit: "%", digits: 1 },
      { prop: "incidence_2021", label: l3("2021 貧窮人口比率", "Poverty incidence 2021", "2021 年の貧困率"), kind: "num", unit: "%", digits: 1 },
      { prop: "incidence_2018", label: l3("2018 貧窮人口比率", "Poverty incidence 2018", "2018 年の貧困率"), kind: "num", unit: "%", digits: 1 },
      { prop: "threshold_2023", label: l3("2023 年貧窮線（每人每年）", "2023 poverty threshold (per person per year)", "2023 年の貧困線（1 人年あたり）"), kind: "num", unit: "PhP" },
      REGION,
    ],
    legendNotes: [
      l3("PSA 貧窮人口比率（%）：118 單位＝82 省（不含其高度都市化城市）＋36 個 HUC／獨立市；彈窗另列 2018、2021", "PSA poverty incidence (%): 118 units = 82 provinces (excluding their HUCs) + 36 HUCs / independent cities; popup also lists 2018 and 2021", "PSA 貧困率（%）：118 単位＝82 州（高度都市化都市を除く）＋36 の HUC・独立市。ポップアップに 2018・2021 年も表示"),
      l3("PSA 只有分省前的 Maguindanao，值同時套到 del Norte 與 del Sur", "PSA has only the pre-split Maguindanao; its value is applied to both del Norte and del Sur", "PSA は分割前の Maguindanao のみで、del Norte と del Sur の両方に同じ値"),
    ],
    popupNotes: [
      { text: l3("估計精度低（變異係數 ≥20%）", "Low precision (coefficient of variation ≥20%)", "推定精度が低い（変動係数 20% 以上）"), when: (p) => Number(p.cv_2023) >= 20 },
      { text: l3("PSA 只有分省前的 Maguindanao，與另一半省同值", "PSA has only the pre-split Maguindanao; same value as the other half", "PSA は分割前の Maguindanao のみで、もう一方と同じ値"), when: (p) => str(p.psa_label) === "Maguindanao" },
    ],
    sourceOrg: l3("Philippine Statistics Authority（OpenSTAT 0041F3DF02A）；邊界 OCHA COD-AB（CC BY-IGO）", "Philippine Statistics Authority (OpenSTAT 0041F3DF02A); boundaries: OCHA COD-AB (CC BY-IGO)", "Philippine Statistics Authority（OpenSTAT 0041F3DF02A）。境界：OCHA COD-AB（CC BY-IGO）"), sourceUrl: "https://openstat.psa.gov.ph/", license: MO008, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("貧窮率", "poverty incidence"),
  },
];

// ═════════════════════════ 第 3 波：地震、NOAH、水資源 ═════════════════════════

/**
 * 卡拉延群島海域地震：先保留（主 agent 2026-11-16，站主可能另有決定）。改成 false 就濾掉經度 <116.9289 的南海震央
 * （與資料端 `_ph_waves.is_kalayaan` 的經度門檻一致；地震屬性沒有座標欄，改用 `within` 多邊形）。
 */
export const PH_EQ_SHOW_KALAYAAN_SEA = true;
const KALAYAAN_SEA: Expr = ["within", { type: "Polygon", coordinates: [[[108, 4], [116.9289, 4], [116.9289, 13], [108, 13], [108, 4]]] }];
const EQ_DEPTH_CATS: readonly PhCat[] = [
  cat("shallow", "#ef4444", "淺層（<70 km）", "Shallow (<70 km)", "浅発（70 km 未満）"),
  cat("mid", "#f59e0b", "中層（70–300 km）", "Intermediate (70–300 km)", "やや深発（70–300 km）"),
  cat("deep", "#3b82f6", "深層（>300 km）", "Deep (>300 km)", "深発（300 km 超）"),
];
const eqDepth: PhCatGetter = {
  expr: ["step", ["to-number", ["get", "depth_km"], 0], "shallow", 70, "mid", 300, "deep"],
  js: (p) => { const d = Number(p.depth_km); return d >= 300 ? "deep" : d >= 70 ? "mid" : "shallow"; },
};
const EQ_MAG: PhSizeBands = {
  prop: "magnitude", title: l3("規模", "Magnitude", "マグニチュード"),
  bands: [{ min: 0, radius: 2, label: "<3" }, { min: 3, radius: 3.5, label: "3–4" }, { min: 4, radius: 5.5, label: "4–5" }, { min: 5, radius: 8, label: "5–6" }, { min: 6, radius: 11, label: "≥6" }],
};
const FLOOD_CATS: readonly PhCat[] = [
  cat("1", "#facc15", "低：0–0.5 m", "Low: 0–0.5 m", "低：0–0.5 m"),
  cat("2", "#f97316", "中：0.5–1.5 m", "Medium: 0.5–1.5 m", "中：0.5–1.5 m"),
  cat("3", "#dc2626", "高：>1.5 m", "High: >1.5 m", "高：1.5 m 超"),
];
const LANDSLIDE_CATS: readonly PhCat[] = [
  cat("1", "#facc15", "低（需監測）", "Low (monitor)", "低（監視が必要）"),
  cat("2", "#f97316", "中（需邊坡保護）", "Medium (slope protection needed)", "中（法面保護が必要）"),
  cat("3", "#dc2626", "高（不宜居住）", "High (not suitable for settlement)", "高（居住に不適）"),
  cat("4", "#9ca3af", "其他（來源未說明）", "Other (not defined by the source)", "その他（出典に説明なし）"),
];
const NOAH_SOURCE = l3("UP Resilience Institute Project NOAH 危害圖（Hugging Face 鏡像 PMTiles，附 NOAH_License.pdf）；本站只依緯度切北中南三檔，未改幾何", "UP Resilience Institute Project NOAH hazard maps (Hugging Face mirror, PMTiles, with NOAH_License.pdf); this site only splits them by latitude into north/central/south files, geometry unchanged", "UP Resilience Institute Project NOAH ハザードマップ（Hugging Face ミラーの PMTiles、NOAH_License.pdf 付き）。本サイトは緯度で北・中・南の 3 ファイルに分割しただけで、ジオメトリは変更していない");
const NOAH_NOTES: readonly L3[] = [
  l3("來源原檔低縮放會省略密集小面（drop-densest），放大才完整", "The source file drops dense small polygons at low zoom; zoom in for full detail", "出典ファイルは低ズームで密集した小さな面を省略。拡大すると完全に表示"),
  l3("UP NOAH（Hugging Face 鏡像）；官方 NOAH Studio 目前無法逐處比對", "UP NOAH (Hugging Face mirror); not yet cross-checked against NOAH Studio", "UP NOAH（Hugging Face ミラー）。公式 NOAH Studio との照合は未実施"),
];
const WATER_PERMIT_CATS: readonly PhCat[] = [
  cat("groundwater", "#a16207", "地下水", "Groundwater", "地下水"),
  cat("surface_water", "#38bdf8", "地表水", "Surface water", "地表水"),
];
const DAM_CATS: readonly PhCat[] = [
  cat("dam", "#60a5fa", "壩", "Dam", "ダム"),
  cat("reservoir", "#1d4ed8", "水庫（面）", "Reservoir (area)", "貯水池（面）", { parts: ["ph-reservoirs-fill"] }),
];
const DAM_FIELDS: PhField[] = [
  { prop: "res_name", label: l3("水庫名", "Reservoir", "貯水池名") },
  { prop: "river", label: l3("河川", "River", "河川") },
  { prop: "main_basin", label: l3("流域", "Basin", "流域") },
  { prop: "dam_type", label: l3("壩型（GDW）", "Dam type (GDW)", "ダムの型（GDW）"), kind: "code" },
  { prop: "year_dam", label: l3("完工年", "Year completed", "完成年"), kind: "year" },
  { prop: "dam_hgt_m", label: l3("壩高", "Dam height", "堤高"), kind: "num", unit: "m" },
  { prop: "dam_len_m", label: l3("壩長", "Dam length", "堤頂長"), kind: "num", unit: "m" },
  { prop: "cap_mcm", label: l3("蓄水量", "Capacity", "貯水容量"), kind: "num", unit: l3("百萬 m³", "million m³", "百万 m³"), digits: 1 },
  { prop: "area_skm", label: l3("水面面積", "Reservoir area", "湛水面積"), kind: "num", unit: "km²", digits: 2 },
  { prop: "main_use", label: l3("主要用途", "Main use", "主な用途"), kind: "code" },
  { prop: "quality", label: l3("位置品質（GDW）", "Location quality (GDW)", "位置の品質（GDW）"), kind: "code" },
  PROV,
];

const W3_SPECS: PhLayerSpec[] = [
  {
    key: "phEarthquakes", file: "ph_earthquakes.pmtiles", sourceId: "ph-earthquakes", srcMinzoom: 4, srcMaxzoom: 12, color: "#ef4444", count: 137230,
    parts: [pointPart("ph-earthquakes-circle", "earthquakes", 4, eqDepth, { size: EQ_MAG, ...(PH_EQ_SHOW_KALAYAAN_SEA ? {} : { filter: ["!", KALAYAAN_SEA] }) })],
    cats: EQ_DEPTH_CATS, sizeLegend: [EQ_MAG],
    title: { props: ["location"], fallback: l3("地震", "Earthquake", "地震") },
    fields: [
      { prop: "time_pht", label: l3("發震時間（菲律賓時間）", "Origin time (PHT)", "発生時刻（フィリピン時間）"), kind: "code" },
      { prop: "magnitude", label: l3("規模", "Magnitude", "マグニチュード"), kind: "num", digits: 1 },
      { prop: "depth_km", label: l3("深度", "Depth", "深さ"), kind: "num", unit: "km" },
      REGION,
    ],
    legendNotes: [
      l3("PHIVOLCS 地震目錄（月報）2018-01～2026-10，137,230 筆，含海上；小地震放大才出現（M≥5 z4、M≥4 z6、M≥3 z8、其餘 z10）", "PHIVOLCS earthquake catalogue (monthly bulletins) 2018-01 to 2026-10, 137,230 events incl. offshore; small events appear when zoomed in (M≥5 z4, M≥4 z6, M≥3 z8, others z10)", "PHIVOLCS 地震カタログ（月報）2018-01～2026-10、137,230 件（海域含む）。小さな地震は拡大時に表示（M5 以上 z4、M4 以上 z6、M3 以上 z8、その他 z10）"),
      ...(PH_EQ_SHOW_KALAYAAN_SEA ? [l3("含卡拉延群島周邊海域地震（自然現象；不畫任何海域界線）", "Includes earthquakes in the seas around the Kalayaan Island Group (a natural phenomenon; no maritime lines drawn)", "カラヤン諸島周辺海域の地震を含む（自然現象。海域の境界線は描かない）")] : []),
      l3("靜態快照，不隨時間軸變動", "Static snapshot; not linked to the timeline", "静的スナップショットで、タイムラインとは連動しない"),
    ],
    popupNotes: [{ text: l3("海域（不屬任何 region）", "Offshore (no region)", "海域（地方に属さない）"), when: (p) => !str(p.region_name) }],
    sourceOrg: l3("PHIVOLCS 地震月報（Earthquake Information）", "PHIVOLCS monthly earthquake reports (Earthquake Information)", "PHIVOLCS 地震月報（Earthquake Information）"), sourceUrl: "https://earthquake.phivolcs.dost.gov.ph/", license: MO008, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("地震", "earthquakes"),
  },
  {
    key: "phNoahFlood100yr", file: "ph_noah_flood_100yr_north.pmtiles", sourceId: "ph-noah-flood", srcMinzoom: 0, srcMaxzoom: 10, color: "#f97316", count: 0, opacity: 0.45,
    extraFiles: [{ suffix: "central", file: "ph_noah_flood_100yr_central.pmtiles", partIds: ["ph-noah-flood-fill-central"] }, { suffix: "south", file: "ph_noah_flood_100yr_south.pmtiles", partIds: ["ph-noah-flood-fill-south"] }],
    parts: [{ id: "ph-noah-flood-fill", sourceLayer: "flood_100yr", geom: "fill", minzoom: 5, cat: propGetter("Var") }],
    cats: FLOOD_CATS,
    title: { props: [], fallback: l3("100 年重現期淹水危害", "100-year flood hazard", "100 年確率の浸水ハザード"), fallbackBy: { prop: "Var", map: catMap(FLOOD_CATS) } },
    fields: [{ prop: "Var", label: l3("危害等級", "Hazard level", "ハザード等級"), map: catMap(FLOOD_CATS) }],
    legendNotes: [l3("100 年重現期降雨淹水危害（淹水深）", "Flood hazard from a 100-year rainfall event (flood depth)", "100 年確率降雨の浸水ハザード（浸水深）"), ...NOAH_NOTES],
    popupNotes: [],
    sourceOrg: NOAH_SOURCE, sourceUrl: "https://noah.up.edu.ph/", license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("淹水危害", "flood hazard"),
  },
  {
    key: "phNoahLandslide", file: "ph_noah_landslide_north.pmtiles", sourceId: "ph-noah-landslide", srcMinzoom: 0, srcMaxzoom: 10, color: "#dc2626", count: 0, opacity: 0.6,
    extraFiles: [{ suffix: "central", file: "ph_noah_landslide_central.pmtiles", partIds: ["ph-noah-landslide-fill-central"] }, { suffix: "south", file: "ph_noah_landslide_south.pmtiles", partIds: ["ph-noah-landslide-fill-south"] }],
    parts: [{ id: "ph-noah-landslide-fill", sourceLayer: "landslide", geom: "fill", minzoom: 5, cat: propGetter("HAZ") }],
    cats: LANDSLIDE_CATS,
    title: { props: [], fallback: l3("崩塌危害", "Landslide hazard", "崩壊ハザード"), fallbackBy: { prop: "HAZ", map: catMap(LANDSLIDE_CATS) } },
    fields: [{ prop: "HAZ", label: l3("危害等級", "Hazard level", "ハザード等級"), map: catMap(LANDSLIDE_CATS) }],
    legendNotes: [
      l3("淺層崩塌危害", "Shallow landslide hazard", "表層崩壊ハザード"),
      l3("z9 以下來源抽稀，圖磚邊界可能出現直線缺口，放大到 z10 以上才完整；Benguet 一帶的高危害面與省界吻合，是來源分省評估的結果，不是切檔造成",
        "At z9 and below the source thins features, so straight gaps can appear along tile edges; zoom to z10+ for full detail. The high-hazard area matching the Benguet provincial boundary comes from the source's province-by-province assessment, not from our file split",
        "z9 以下は元データが間引かれ、タイル境界に直線状の欠けが出ることがある。z10 以上で完全表示。Benguet 周辺の高ハザード域が州境と一致するのは元データの州別評価によるもので、ファイル分割のせいではない"),
      ...NOAH_NOTES,
    ],
    popupNotes: [],
    sourceOrg: NOAH_SOURCE, sourceUrl: "https://noah.up.edu.ph/", license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("崩塌危害", "landslide hazard"),
  },
  {
    key: "phWaterPermits", file: "ph_water_permits.pmtiles", sourceId: "ph-water-permits", srcMinzoom: 7, srcMaxzoom: 14, color: "#38bdf8", count: 17411,
    parts: [pointPart("ph-water-permits-circle", "water_permits", 7, propGetter("kind"))],
    cats: WATER_PERMIT_CATS, heat: { intensity: 0.6 },
    title: { props: ["permit_no"], fallback: l3("取水許可", "Water permit", "取水許可") },
    fields: [
      { prop: "permit_no", label: l3("許可號", "Permit no.", "許可番号"), kind: "code" },
      { prop: "kind", label: l3("水源類型", "Source type", "水源の種別"), map: catMap(WATER_PERMIT_CATS) },
      { prop: "water_source", label: l3("水源（原文）", "Water source (as listed)", "水源（原文）") },
      { prop: "purpose", label: l3("用途", "Purpose", "用途"), kind: "code" },
      { prop: "granted_lps", label: l3("核准水量", "Granted", "許可水量"), kind: "num", unit: "L/s", digits: 2 },
      { prop: "date_approved", label: l3("核准日", "Approved", "許可日"), kind: "code" },
      PROV,
    ],
    legendNotes: [l3("NWRB 取水許可 17,411 筆（許可人姓名已排除）；z7 起有圖磚，拉遠為熱區", "17,411 NWRB water permits (permittee names removed); tiles from z7, heatmap when zoomed out", "NWRB 取水許可 17,411 件（許可者名は除外）。z7 からタイルあり、縮小時はヒートマップ")],
    popupNotes: [],
    sourceOrg: "National Water Resources Board via Geoportal Philippines（NAMRIA）WMS", sourceUrl: GEOPORTAL_URL, license: CONDITIONAL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("取水許可", "water permits"),
  },
  {
    key: "phLakes", file: "ph_lakes.pmtiles", sourceId: "ph-lakes", srcMinzoom: 5, srcMaxzoom: 13, color: "#3b82f6", count: 37,
    parts: [{ id: "ph-lakes-fill", sourceLayer: "lakes", geom: "fill", minzoom: 5, cat: { expr: ["literal", "lake"], js: () => "lake" }, fillOpacity: 0.7 }],
    cats: [cat("lake", "#3b82f6", "湖泊", "Lake", "湖")],
    title: { props: ["name"], fallback: l3("湖泊", "Lake", "湖") },
    fields: [{ prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 2 }, PROV],
    legendNotes: [l3("HDX 主要湖泊 37 個（10/18 region）；名稱「Not known」為來源未命名", "37 major lakes from HDX (10 of 18 regions); 'Not known' means unnamed in the source", "HDX の主要な湖 37（18 地方中 10）。「Not known」は出典で名称なし")],
    popupNotes: [],
    sourceOrg: "HDX Philippines – Lakes", sourceUrl: "https://data.humdata.org/", license: "CC0 1.0", fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("湖泊", "lakes"),
  },
  {
    key: "phDams", file: "ph_dams.pmtiles", sourceId: "ph-dams", srcMinzoom: 5, srcMaxzoom: 14, color: "#60a5fa", count: 79,
    parts: [
      { id: "ph-reservoirs-fill", sourceLayer: "reservoirs", geom: "fill", minzoom: 5, cat: propGetter("kind"), fillOpacity: 0.7 },
      pointPart("ph-dams-circle", "dams", 5, propGetter("kind")),
    ],
    cats: DAM_CATS,
    title: { props: ["dam_name", "res_name"], fallback: l3("壩、水庫", "Dam / reservoir", "ダム・貯水池") },
    fields: DAM_FIELDS,
    legendNotes: [l3("Global Dam Watch v1.0：壩 52 座、水庫面 27 個（14/18 region）", "Global Dam Watch v1.0: 52 dams and 27 reservoir polygons (14 of 18 regions)", "Global Dam Watch v1.0：ダム 52、貯水池の面 27（18 地方中 14）")],
    popupNotes: [],
    sourceOrg: "Global Dam Watch（GDW v1.0）", sourceUrl: "https://www.globaldamwatch.org/", license: "CC BY 4.0", fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("壩與水庫", "dams and reservoirs"),
  },
];

// ═════════════════════════ 第 4 波：橋梁、停車、里程牌、經濟特區、填海 ═════════════════════════

const BRIDGE_CATS: readonly PhCat[] = [
  cat("Good", "#22c55e", "良好（Good）", "Good", "良好（Good）"),
  cat("Fair", "#facc15", "尚可（Fair）", "Fair", "可（Fair）"),
  cat("Poor", "#f97316", "差（Poor）", "Poor", "不良（Poor）"),
  cat("Bad", "#dc2626", "劣（Bad）", "Bad", "劣（Bad）"),
];
const PARKING_CATS: readonly PhCat[] = [
  cat("surface", "#94a3b8", "平面停車場", "Surface", "平面駐車場"),
  cat("multi-storey", "#60a5fa", "立體停車場", "Multi-storey", "立体駐車場"),
  cat("underground", "#a78bfa", "地下停車場", "Underground", "地下駐車場"),
  cat("street_side", "#facc15", "路邊停車", "Street-side", "路上駐車"),
];
const ECOZONE_CATS: readonly PhCat[] = [
  { id: "it", values: ["IT Center", "IT Park"], color: "#60a5fa", label: l3("IT 中心／IT 園區", "IT centre / IT park", "IT センター・IT パーク") },
  { id: "manufacturing", values: ["Manufacturing Economic Zone"], color: "#a78bfa", label: l3("製造業經濟特區", "Manufacturing economic zone", "製造業経済特区") },
  { id: "agro", values: ["Agro-Industrial Economic Zone"], color: "#4ade80", label: l3("農工經濟特區", "Agro-industrial economic zone", "農工業経済特区") },
  { id: "tourism", values: ["Tourism Economic Zone"], color: "#f97316", label: l3("觀光經濟特區", "Tourism economic zone", "観光経済特区") },
  { id: "medical", values: ["Medical Tourism Center", "Medical Tourism Park"], color: "#ef4444", label: l3("醫療觀光", "Medical tourism", "医療ツーリズム") },
];
const RECLAMATION_CATS: readonly PhCat[] = [
  cat("A", "#22d3ee", "PRA 狀態代碼 A", "PRA status code A", "PRA 状態コード A"),
  cat("D", "#f472b6", "PRA 狀態代碼 D", "PRA status code D", "PRA 状態コード D"),
];
const DPWH = "Department of Public Works and Highways via Geoportal Philippines（NAMRIA）WMS";

const W4_SPECS: PhLayerSpec[] = [
  {
    key: "phBridges", file: "ph_bridges.pmtiles", sourceId: "ph-bridges", srcMinzoom: 8, srcMaxzoom: 14, color: "#22c55e", count: 8410,
    parts: [pointPart("ph-bridges-circle", "bridges", 8, propGetter("condition"))],
    cats: BRIDGE_CATS, otherColor: "#9ca3af", otherLabel: l3("待進一步評估", "For further assessment", "要追加評価"),
    title: { props: ["name"], fallback: l3("橋梁", "Bridge", "橋") },
    fields: [
      { prop: "road_name", label: l3("道路", "Road", "道路") },
      { prop: "road_class", label: l3("道路等級", "Road class", "道路等級"), kind: "code" },
      { prop: "condition", label: l3("狀況（DPWH 評等）", "Condition (DPWH rating)", "状態（DPWH 評価）"), map: catMap(BRIDGE_CATS) },
      { prop: "length_m", label: l3("長度", "Length", "長さ"), kind: "num", unit: "m", digits: 1 },
      { prop: "width_m", label: l3("寬度", "Width", "幅"), kind: "num", unit: "m", digits: 1 },
      { prop: "material", label: l3("材質", "Material", "材質"), kind: "code" },
      { prop: "year_built", label: l3("建造年", "Year built", "建設年"), kind: "year" },
      { prop: "lanes", label: l3("車道數", "Lanes", "車線数"), kind: "num" },
      { prop: "load_limit_t", label: l3("載重限制", "Load limit", "荷重制限"), kind: "num", unit: "t" },
      { prop: "recommendation", label: l3("DPWH 建議", "DPWH recommendation", "DPWH の推奨"), kind: "code" },
      PROV,
    ],
    legendNotes: [l3("DPWH 國道橋梁清冊（2021）8,410 座；狀況為 DPWH 評等；z8 起顯示", "DPWH national-road bridge inventory (2021), 8,410 bridges; condition is the DPWH rating; shown from z8", "DPWH 国道橋梁台帳（2021）8,410 橋。状態は DPWH の評価。z8 から表示")],
    popupNotes: [],
    sourceOrg: DPWH, sourceUrl: GEOPORTAL_URL, license: l3("Geoportal 盤點表：No restriction", "Geoportal inventory: No restriction", "Geoportal 一覧表：No restriction"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("橋梁", "bridges"),
  },
  {
    key: "phParking", file: "ph_parking.pmtiles", sourceId: "ph-parking", srcMinzoom: 10, srcMaxzoom: 14, color: "#94a3b8", count: 14514,
    parts: [pointPart("ph-parking-circle", "parking", 10, propGetter("category"), { small: true })],
    cats: PARKING_CATS, otherColor: "#6b7280", otherLabel: l3("其他或未標類型", "Other / type not tagged", "その他・種別未記載"),
    title: { props: ["name"], fallback: l3("停車場", "Parking", "駐車場") },
    fields: [
      { prop: "category", label: l3("類型", "Type", "種別"), map: { ...catMap(PARKING_CATS), unspecified: l3("未標類型", "Not tagged", "未記載") } },
      { prop: "capacity", label: l3("車位數（OSM）", "Capacity (OSM)", "収容台数（OSM）"), kind: "num" },
      { prop: "access", label: l3("開放對象（OSM 原文）", "Access (OSM tag)", "利用対象（OSM 原文）"), kind: "code" },
      OPERATOR, PROV,
    ],
    legendNotes: [OSM_NOTE, l3("14,514 處（面取代表點）；52% 沒標類型；z10 起顯示", "14,514 car parks (areas as representative points); 52% have no type tag; shown from z10", "14,514 か所（面は代表点）。52% は種別なし。z10 から表示"), BARMM_SPARSE],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("停車場", "car parks"),
  },
  {
    key: "phKmPosts", file: "ph_km_posts.pmtiles", sourceId: "ph-km-posts", srcMinzoom: 10, srcMaxzoom: 15, color: "#cbd5e1", count: 31017,
    parts: [pointPart("ph-km-posts-circle", "km_posts", 10, { expr: ["literal", "km"], js: () => "km" }, { small: true, hollow: { label: l3("里程牌", "Kilometre post", "キロポスト") } })],
    cats: [cat("km", "#cbd5e1", "國道里程牌（空心：只當參考座標）", "National-road kilometre post (hollow: reference only)", "国道キロポスト（白抜き：参照用）")],
    title: { props: ["road_name"], fallback: l3("里程牌", "Kilometre post", "キロポスト") },
    fields: [
      { prop: "km", label: l3("里程", "Kilometre", "キロ程"), kind: "num", unit: "km" },
      { prop: "side", label: l3("位置", "Side", "設置側"), map: { "Righthand Side": l3("右側", "Right-hand side", "右側"), "Lefthand Side": l3("左側", "Left-hand side", "左側") } },
      { prop: "deo", label: l3("工程區（DEO）", "District Engineering Office", "地区工事事務所（DEO）") },
      PROV,
    ],
    legendNotes: [l3("DPWH 國道里程牌 31,017 支；km 為自馬尼拉 Rizal Park 起算；z10 起顯示", "31,017 DPWH national-road kilometre posts; km measured from Rizal Park, Manila; shown from z10", "DPWH 国道キロポスト 31,017 本。キロ程はマニラ Rizal Park 起点。z10 から表示")],
    popupNotes: [],
    sourceOrg: DPWH, sourceUrl: GEOPORTAL_URL, license: l3("未列於 Geoportal 盤點表（同機關國道橋梁為 No restriction）", "Not listed in the Geoportal inventory (the same agency's national-road bridges are No restriction)", "Geoportal 一覧表に記載なし（同機関の国道橋梁は No restriction）"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("國道里程牌", "kilometre posts"),
  },
  {
    key: "phEcozones", file: "ph_ecozones.pmtiles", sourceId: "ph-ecozones", srcMinzoom: 5, srcMaxzoom: 14, color: "#a78bfa", count: 391,
    parts: [pointPart("ph-ecozones-circle", "ecozones", 5, propGetter("nature"))],
    cats: ECOZONE_CATS,
    title: { props: ["name"], fallback: l3("經濟特區", "Ecozone", "経済特区") },
    fields: [
      { prop: "nature", label: l3("類型（PEZA 原文）", "Type (PEZA)", "種別（PEZA 原文）"), kind: "code" },
      { prop: "industry", label: l3("產業", "Industry", "産業") },
      { prop: "developer", label: l3("開發商", "Developer", "開発事業者") },
      { prop: "land_area_ha", label: l3("面積", "Land area", "面積"), kind: "num", unit: "ha", digits: 2 },
      PROV,
    ],
    legendNotes: [l3("PEZA 經濟特區 391 處（點位為登記位置，不是範圍）；BARMM 沒有 PEZA 特區", "391 PEZA ecozones (points are registered locations, not boundaries); BARMM has no PEZA zones", "PEZA 経済特区 391 か所（点は登録位置で範囲ではない）。BARMM に PEZA 特区はない")],
    popupNotes: [],
    sourceOrg: "Philippine Economic Zone Authority via Geoportal Philippines（NAMRIA）WMS", sourceUrl: GEOPORTAL_URL, license: CONDITIONAL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("經濟特區", "ecozones"),
  },
  {
    key: "phReclamation", file: "ph_reclamation.pmtiles", sourceId: "ph-reclamation", srcMinzoom: 5, srcMaxzoom: 14, color: "#22d3ee", count: 219,
    parts: [pointPart("ph-reclamation-circle", "reclamation", 5, propGetter("status_code"))],
    cats: RECLAMATION_CATS, otherColor: "#9ca3af", otherLabel: l3("未填狀態代碼", "No status code", "状態コードなし"),
    title: { props: ["name", "location"], fallback: l3("填海造地", "Reclamation project", "埋立事業") },
    fields: [
      { prop: "proponent", label: l3("申請者", "Proponent", "事業者") },
      { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 1 },
      { prop: "location", label: l3("地點", "Location", "所在地") },
      PROV,
    ],
    legendNotes: [l3("PRA 填海造地專案點位 219 處（含已完成與提案中）；狀態代碼 A／D 的意義 PRA 未說明，照原文", "219 PRA reclamation project points (completed and proposed); meaning of status codes A / D is not documented by PRA and shown as-is", "PRA 埋立事業 219 地点（完了・提案中を含む）。状態コード A／D の意味は PRA の説明がなく原文のまま")],
    popupNotes: [],
    sourceOrg: "Philippine Reclamation Authority via Geoportal Philippines（NAMRIA）WMS", sourceUrl: GEOPORTAL_URL, license: CONDITIONAL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("填海造地", "reclamation projects"),
  },
];

// ═════════════════════════ 第 5 波：教育、醫療、公共安全 ═════════════════════════

const SCHOOL_CATS: readonly PhCat[] = [
  cat("school", "#facc15", "中小學（school）", "School", "学校（school）"),
  cat("college", "#fb923c", "學院（college）", "College", "カレッジ（college）"),
  cat("university", "#f472b6", "大學", "University", "大学"),
  cat("kindergarten", "#a3e635", "幼兒園", "Kindergarten", "幼稚園"),
];
const HEALTH_CATS: readonly PhCat[] = [
  cat("hospital", "#ef4444", "醫院", "Hospital", "病院"),
  cat("clinic", "#f472b6", "診所", "Clinic", "診療所"),
  cat("health_post", "#fb923c", "衛生站", "Health post", "保健所"),
  cat("pharmacy", "#4ade80", "藥局", "Pharmacy", "薬局"),
  cat("dentist", "#38bdf8", "牙科", "Dentist", "歯科"),
  cat("other", "#a78bfa", "其他（醫師診間等）", "Other (doctors etc.)", "その他（医院など）"),
];
const SCHOOL_COMMON = (count: L3): L3[] => [OSM_NOTE,
  l3(`OSM 學校${count.zh}；DepEd 官方名冊沒有現行可下載座標版`, `OSM schools: ${count.en}; no current downloadable DepEd register with coordinates`, `OSM の学校 ${count.ja}。DepEd の公式名簿に現行のダウンロード可能な座標版はない`),
  l3("NCR：每 10 萬人筆數低（人口密度高的計算特性，不一定是缺漏）", "NCR: low count per 100,000 people (a density effect, not necessarily missing)", "NCR：10 万人あたり件数が少ない（人口密度による計算上の特性で、欠落とは限らない）")];

const W5_SPECS: PhLayerSpec[] = [
  {
    key: "phSchools", file: "ph_schools.pmtiles", sourceId: "ph-schools", srcMinzoom: 7, srcMaxzoom: 14, color: "#facc15", count: 53825,
    parts: [pointPart("ph-schools-circle", "schools", 7, propGetter("category"))],
    cats: SCHOOL_CATS, heat: { intensity: 0.6 },
    title: { props: ["name"], fallback: l3("未命名學校", "Unnamed school", "名称不明の学校") },
    fields: [NAME_EN, CATEGORY(SCHOOL_CATS), { prop: "operator_type", label: l3("公私立（OSM 原文）", "Operator type (OSM tag)", "設置者の種別（OSM 原文）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [...SCHOOL_COMMON(l3(" 53,825 處（校地面取代表點）", "53,825 (campus polygons shown as representative points)", "53,825 件（校地の面は代表点で表示）")), l3("拉遠為熱區", "Heatmap when zoomed out", "縮小時はヒートマップ")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("學校", "schools"),
  },
  {
    key: "phSchoolCampuses", file: "ph_school_campuses.pmtiles", sourceId: "ph-school-campuses", srcMinzoom: 11, srcMaxzoom: 15, color: "#facc15", count: 49456, opacity: 0.7,
    parts: [
      { id: "ph-school-campuses-fill", sourceLayer: "school_campuses", geom: "fill", minzoom: 11, cat: propGetter("category"), fillOpacity: 0.5 },
      { id: "ph-school-campuses-line", sourceLayer: "school_campuses", geom: "line", minzoom: 11, cat: propGetter("category") },
    ],
    cats: SCHOOL_CATS,
    title: { props: ["name"], fallback: l3("未命名校地", "Unnamed campus", "名称不明の校地") },
    fields: [NAME_EN, CATEGORY(SCHOOL_CATS), { prop: "operator_type", label: l3("公私立（OSM 原文）", "Operator type (OSM tag)", "設置者の種別（OSM 原文）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [...SCHOOL_COMMON(l3("校地面 49,456 個", "49,456 campus polygons", "校地 49,456 面")), l3("z11 起顯示", "Shown from z11", "z11 から表示")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("校地", "school campuses"),
  },
  {
    key: "phHealthFacilities", file: "ph_health_facilities.pmtiles", sourceId: "ph-health-facilities", srcMinzoom: 7, srcMaxzoom: 14, color: "#ef4444", count: 17766,
    parts: [pointPart("ph-health-facilities-circle", "health_facilities", 7, propGetter("category"))],
    cats: HEALTH_CATS, heat: { intensity: 0.6 },
    title: { props: ["name"], fallback: l3("未命名醫療院所", "Unnamed health facility", "名称不明の医療施設") },
    fields: [NAME_EN, CATEGORY(HEALTH_CATS), { prop: "healthcare", label: l3("healthcare 標籤（OSM 原文）", "healthcare tag (OSM)", "healthcare タグ（OSM 原文）"), kind: "code" },
      { prop: "emergency", label: l3("急診（OSM 原文）", "Emergency (OSM tag)", "救急（OSM 原文）"), kind: "code" }, { prop: "beds", label: l3("病床（OSM）", "Beds (OSM)", "病床（OSM）"), kind: "num" }, OPERATOR, PROV, REGION],
    legendNotes: [OSM_NOTE, l3("OSM 醫療院所 17,766 處；DOH 設施名冊（NHFR）需登入，未使用", "17,766 OSM health facilities; the DOH facility register (NHFR) requires login and was not used", "OSM の医療施設 17,766 か所。DOH の施設名簿（NHFR）はログインが必要で未使用"), BARMM_SPARSE, l3("拉遠為熱區", "Heatmap when zoomed out", "縮小時はヒートマップ")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("醫療院所", "health facilities"),
  },
  {
    key: "phFireStations", file: "ph_fire_stations.pmtiles", sourceId: "ph-fire-stations", srcMinzoom: 6, srcMaxzoom: 14, color: "#ef4444", count: 2058,
    parts: [pointPart("ph-fire-stations-circle", "fire_stations", 6, { expr: ["literal", "fire"], js: () => "fire" }, { hollow: HOLLOW_OSM("空心＝OSM 補缺（BFP 名冊 300 m 內沒有的點）", "Hollow = OSM gap-fill (no BFP station within 300 m)", "白抜き＝OSM 補完（BFP 名簿の 300 m 以内にない点）") })],
    cats: [cat("fire", "#ef4444", "消防站", "Fire station", "消防署")],
    title: { props: ["name"], fallback: l3("消防站", "Fire station", "消防署") },
    fields: [NAME_EN, SOURCE_FIELD({ bfp: l3("BFP 名冊", "BFP register", "BFP 名簿"), osm: OSM_SRC }), OPERATOR, PROV, REGION],
    legendNotes: [l3("BFP 消防站 1,316＋OSM 補缺 742", "1,316 BFP fire stations + 742 OSM gap-fill", "BFP 消防署 1,316＋OSM 補完 742")],
    popupNotes: [],
    sourceOrg: j3("Bureau of Fire Protection via Geoportal Philippines (NAMRIA) WMS", GAP_FILL, OSM_1115), sourceUrl: GEOPORTAL_URL, license: COND_OSM, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("消防站", "fire stations"),
  },
  {
    key: "phNcrSafeOpenSpaces", file: "ph_ncr_safe_open_spaces.pmtiles", sourceId: "ph-ncr-safe-open-spaces", srcMinzoom: 10, srcMaxzoom: 16, color: "#4ade80", count: 5211, opacity: 0.75,
    parts: [{ id: "ph-ncr-safe-open-spaces-fill", sourceLayer: "safe_open_spaces", geom: "fill", minzoom: 10, cat: propGetter("size_class"), fillOpacity: 0.7 }],
    cats: [cat("Large", "#16a34a", "大型", "Large", "大"), cat("Medium", "#4ade80", "中型", "Medium", "中"), cat("Small", "#bbf7d0", "小型", "Small", "小")],
    title: { props: ["sos_id"], fallback: l3("避難空地", "Safe open space", "避難空地") },
    fields: [
      { prop: "size_class", label: l3("規模", "Size class", "規模"), map: { Large: l3("大型", "Large", "大"), Medium: l3("中型", "Medium", "中"), Small: l3("小型", "Small", "小") } },
      { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²" },
      { prop: "validation", label: l3("現地驗證", "Validation", "現地検証"), map: { Validated: l3("已驗證", "Validated", "検証済み"), "Not Validated": l3("未驗證", "Not validated", "未検証") } },
      { prop: "barangay_src", label: l3("Barangay（原文）", "Barangay (as listed)", "バランガイ（原文）") },
      { prop: "city_src", label: l3("城市（原文）", "City (as listed)", "市（原文）") },
      PROV,
    ],
    legendNotes: [
      l3("Metro Manila 地震避難空地 5,211 面（只涵蓋 NCR，其他地區未涵蓋）；z10 起顯示", "5,211 Metro Manila earthquake safe open spaces (NCR only; other regions not covered); shown from z10", "マニラ首都圏の地震避難空地 5,211 面（NCR のみ、他地域は未収録）。z10 から表示"),
      PARTIAL,
    ],
    popupNotes: [],
    sourceOrg: "MMDA／NAMRIA via Geoportal Philippines WMS", sourceUrl: GEOPORTAL_URL, license: MO008, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("避難空地", "safe open spaces"),
  },
  {
    key: "phPoliceStations", file: "ph_police_stations.pmtiles", sourceId: "ph-police-stations", srcMinzoom: 7, srcMaxzoom: 14, color: "#3b82f6", count: 2629,
    parts: [pointPart("ph-police-stations-circle", "police_stations", 7, { expr: ["literal", "police"], js: () => "police" }, { hollow: HOLLOW_OSM("空心＝OSM（NCR 以外只有 OSM）", "Hollow = OSM (outside NCR only OSM is available)", "白抜き＝OSM（NCR 以外は OSM のみ）") })],
    cats: [cat("police", "#3b82f6", "警察據點", "Police station / post", "警察施設")],
    title: { props: ["name"], fallback: l3("警察據點", "Police station", "警察施設") },
    fields: [NAME_EN, SOURCE_FIELD({ mmda_2003: l3("MMDA 2003 地標", "MMDA 2003 landmarks", "MMDA 2003 年ランドマーク"), osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap") }),
      { prop: "landmark_type", label: l3("地標類型（MMDA）", "Landmark type (MMDA)", "ランドマーク種別（MMDA）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [l3("NCR 為 MMDA 2003 地標 191 處，其他地區只有 OSM 2,438 處；PNP 全國駐所沒有公開座標", "NCR: 191 MMDA 2003 landmarks; elsewhere only 2,438 OSM points; PNP has no public nationwide station coordinates", "NCR は MMDA 2003 年ランドマーク 191 か所、他地域は OSM 2,438 か所のみ。PNP の全国拠点座標は非公開"),
      l3("MMDA 2003 地標有 9 處在 NCR 外，照原座標", "9 MMDA 2003 landmarks lie outside NCR and are kept at their source coordinates", "MMDA 2003 年ランドマークのうち 9 か所は NCR 外で、原座標のまま")],
    popupNotes: [],
    sourceOrg: j3(l3("MMDA（2003 地標）via Geoportal Philippines WMS", "MMDA (2003 landmarks) via Geoportal Philippines WMS", "MMDA（2003 年のランドマーク）、Geoportal Philippines WMS 経由"), SEP, OSM_1115), sourceUrl: GEOPORTAL_URL, license: COND_OSM, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("警察據點", "police stations"),
  },
  {
    key: "phJails", file: "ph_jails.pmtiles", sourceId: "ph-jails", srcMinzoom: 6, srcMaxzoom: 14, color: "#a78bfa", count: 558,
    parts: [pointPart("ph-jails-circle", "jails", 6, propGetter("category"), { hollow: HOLLOW_OSM("空心＝OSM 補缺（含 BuCor 監獄）", "Hollow = OSM gap-fill (incl. BuCor prisons)", "白抜き＝OSM 補完（BuCor 刑務所を含む）") })],
    cats: [cat("jail", "#a78bfa", "看守所（BJMP）", "Jail (BJMP)", "拘置所（BJMP）"), cat("prison", "#f472b6", "監獄（OSM）", "Prison (OSM)", "刑務所（OSM）")],
    title: { props: ["name"], fallback: l3("監所", "Jail / prison", "刑事施設") },
    fields: [
      NAME_EN,
      { prop: "address", label: l3("機關地址", "Facility address", "施設の所在地") },
      { prop: "pdl_population_2020", label: l3("2020 在押人數（BJMP）", "Persons deprived of liberty, 2020 (BJMP)", "2020 年の被収容者数（BJMP）"), kind: "num" },
      SOURCE_FIELD({ bjmp_2020: l3("BJMP 2020", "BJMP 2020", "BJMP 2020"), osm: OSM_SRC }), OPERATOR, PROV, REGION,
    ],
    legendNotes: [l3("BJMP 監所 462 處（2020）＋OSM 96 處（含 BuCor 監獄）", "462 BJMP jails (2020) + 96 OSM (incl. BuCor prisons)", "BJMP 拘置所 462（2020）＋OSM 96（BuCor 刑務所を含む）")],
    popupNotes: [],
    sourceOrg: j3("Bureau of Jail Management and Penology via Geoportal Philippines WMS", SEP, OSM_1115), sourceUrl: GEOPORTAL_URL, license: COND_OSM, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("監所", "jails"),
  },
];

// ═════════════════════════ 第 6 波：樹木、步道、KBA、濕地、林業計畫 ═════════════════════════

const FORESTRY_CATS: readonly PhCat[] = [
  cat("ngp_site", "#22c55e", "國家綠化計畫（NGP）造林地", "National Greening Program site", "国家緑化計画（NGP）植林地"),
  cat("potential_investment_area", "#facc15", "林業投資潛力區", "Potential forest investment area", "林業投資候補地"),
  cat("critical_watershed", "#38bdf8", "重要集水區（部分）", "Critical watershed (partial)", "重要集水域（部分）"),
  cat("proclaimed_watershed", "#1d4ed8", "公告集水保護區（部分）", "Proclaimed watershed reservation (partial)", "告示集水域保護区（部分）"),
  cat("flag", "#a78bfa", "林地協議（FLAg）", "Forest Land Use Agreement (FLAg)", "林地利用協定（FLAg）"),
];
const WETLAND_OSM_TYPES: Record<string, L3> = {
  mangrove: l3("紅樹林", "Mangrove", "マングローブ"), marsh: l3("沼澤", "Marsh", "湿原"), swamp: l3("森林沼澤", "Swamp", "沼沢林"),
  tidalflat: l3("潮間帶灘地", "Tidal flat", "干潟"), saltmarsh: l3("鹽沼", "Salt marsh", "塩性湿地"), reedbed: l3("蘆葦地", "Reed bed", "ヨシ原"),
};

const W6_SPECS: PhLayerSpec[] = [
  {
    key: "phTrees", file: "ph_trees.pmtiles", sourceId: "ph-trees", srcMinzoom: 12, srcMaxzoom: 16, color: "#22c55e", count: 231625,
    parts: [
      { id: "ph-tree-rows-line", sourceLayer: "tree_rows", geom: "line", minzoom: 12, cat: propGetter("category") },
      pointPart("ph-trees-circle", "trees", 12, propGetter("category"), { small: true }),
    ],
    cats: [cat("tree", "#22c55e", "樹木（點）", "Tree (point)", "樹木（点）", { parts: ["ph-trees-circle"] }), cat("tree_row", "#16a34a", "行道樹（線）", "Tree row (line)", "並木（線）", { parts: ["ph-tree-rows-line"] })],
    title: { props: ["name", "species"], fallback: l3("樹木", "Tree", "樹木"), fallbackBy: { prop: "category", map: { tree_row: l3("行道樹", "Tree row", "並木") } } },
    fields: [
      { prop: "species", label: l3("樹種（OSM 原文）", "Species (OSM tag)", "樹種（OSM 原文）"), kind: "code" },
      { prop: "genus", label: l3("屬（OSM 原文）", "Genus (OSM tag)", "属（OSM 原文）"), kind: "code" },
      { prop: "leaf_type", label: l3("葉型（OSM 原文）", "Leaf type (OSM tag)", "葉の型（OSM 原文）"), kind: "code" },
      PROV, REGION,
    ],
    legendNotes: [OSM_NOTE, l3("OSM 樹木 228,210 株＋行道樹 3,415 段，零星標註；z12 起顯示", "228,210 OSM trees + 3,415 tree rows, sparsely mapped; shown from z12", "OSM の樹木 228,210 本＋並木 3,415 区間、登録はまばら。z12 から表示"),
      l3("Bicol、BARMM：OSM 稀疏", "Bicol, BARMM: sparse in OSM", "Bicol・BARMM：OSM が疎")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("樹木", "trees"),
  },
  {
    key: "phTrails", file: "ph_trails.pmtiles", sourceId: "ph-trails", srcMinzoom: 10, srcMaxzoom: 14, color: "#a16207", count: 220599,
    parts: [{ id: "ph-trails-line", sourceLayer: "trails", geom: "line", minzoom: 10, cat: propGetter("category"), dashed: true }],
    cats: [cat("track", "#b45309", "農林道（track）", "Track (farm / forest road)", "農林道（track）"), cat("path", "#4ade80", "步道（path）", "Path / footpath", "歩道（path）")],
    dashLabel: null,
    title: { props: ["name"], fallback: l3("農林道、步道", "Track / path", "農林道・歩道"), fallbackBy: { prop: "category", map: { track: l3("農林道", "Track", "農林道"), path: l3("步道", "Path", "歩道") } } },
    fields: [
      { prop: "category", label: l3("類型", "Type", "種別"), map: { track: l3("農林道", "Track", "農林道"), path: l3("步道", "Path", "歩道") } },
      { prop: "surface", label: l3("鋪面（OSM 原文）", "Surface (OSM tag)", "舗装（OSM 原文）"), kind: "code" },
      { prop: "tracktype", label: l3("路況等級（OSM 原文）", "Track grade (OSM tag)", "路面等級（OSM 原文）"), kind: "code" },
      { prop: "access", label: l3("通行（OSM 原文）", "Access (OSM tag)", "通行（OSM 原文）"), kind: "code" },
      PROV,
    ],
    legendNotes: [OSM_NOTE, l3("OSM highway=track 116,128 段、path 104,471 段；z10 起顯示", "116,128 OSM highway=track and 104,471 path segments; shown from z10", "OSM の highway=track 116,128 区間・path 104,471 区間。z10 から表示"),
      l3("Ilocos、CALABARZON、IX、NCR：OSM 稀疏", "Ilocos, CALABARZON, IX, NCR: sparse in OSM", "Ilocos・CALABARZON・IX・NCR：OSM が疎")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("農林道與步道", "tracks and paths"),
  },
  {
    key: "phKba", file: "ph_kba.pmtiles", sourceId: "ph-kba", srcMinzoom: 4, srcMaxzoom: 12, color: "#f97316", count: 310,
    parts: [
      { id: "ph-kba-fill", sourceLayer: "kba", geom: "fill", minzoom: 4, cat: propGetter("kba_class"), fillOpacity: 0 },
      { id: "ph-kba-line", sourceLayer: "kba", geom: "line", minzoom: 4, cat: propGetter("kba_class"), filter: ["==", ["get", "kba_class"], "KBA"] },
      { id: "ph-kba-proposed-line", sourceLayer: "kba", geom: "line", minzoom: 4, cat: propGetter("kba_class"), filter: ["!=", ["get", "kba_class"], "KBA"], dashed: true },
    ],
    cats: [
      { id: "kba", values: ["KBA"], color: "#f97316", label: l3("已認定 KBA（實線框）", "Recognised KBA (solid outline)", "認定済み KBA（実線）"), parts: ["ph-kba-fill", "ph-kba-line"] },
      { id: "proposed", values: ["Proposed KBA"], color: "#fdba74", label: l3("提案中 KBA（虛線框）", "Proposed KBA (dashed outline)", "提案中の KBA（破線）"), parts: ["ph-kba-fill", "ph-kba-proposed-line"] },
    ],
    dashLabel: null,
    title: { props: ["name"], fallback: l3("關鍵生物多樣性區域", "Key Biodiversity Area", "生物多様性重要地域") },
    fields: [
      { prop: "kba_class", label: l3("認定狀態", "Status", "認定状況"), map: { KBA: l3("已認定", "Recognised", "認定済み"), "Proposed KBA": l3("提案中", "Proposed", "提案中") } },
      { prop: "kba_category", label: l3("類型（原文）", "Category (source)", "区分（原文）"), kind: "code" },
      { prop: "global_or_regional", label: l3("層級（原文）", "Level (source)", "レベル（原文）"), kind: "code" },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
      { prop: "provinces_listed", label: l3("所在省（原文）", "Provinces (as listed)", "所在州（原文）") },
    ],
    legendNotes: [l3("Key Biodiversity Areas 310 處：已認定 120＋提案 190；空心框，NCR 沒有 KBA（實況，不是缺資料）", "310 Key Biodiversity Areas: 120 recognised + 190 proposed; outlines only; NCR has no KBA (actual, not missing data)", "生物多様性重要地域 310：認定 120＋提案 190。枠のみ。NCR に KBA はない（実態でデータ欠落ではない）"),
      l3("卡拉延群島 1 處與國界外 4 處不畫", "1 in the Kalayaan Island Group and 4 outside the national boundary not drawn", "カラヤン諸島の 1 件と国境外の 4 件は描かない")],
    popupNotes: [],
    sourceOrg: l3("Key Biodiversity Areas Partnership／DENR-BMB Philippine KBA 資料集", "Key Biodiversity Areas Partnership / DENR-BMB Philippine KBA dataset", "Key Biodiversity Areas Partnership／DENR-BMB Philippine KBA データセット"), sourceUrl: "https://www.keybiodiversityareas.org/", license: "CC BY", fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("生物多樣性重要地域", "key biodiversity areas"),
  },
  {
    key: "phWetlands", file: "ph_wetlands.pmtiles", sourceId: "ph-wetlands", srcMinzoom: 6, srcMaxzoom: 14, color: "#0ea5e9", count: 8677, opacity: 0.75,
    parts: [
      { id: "ph-wetlands-official-fill", sourceLayer: "wetlands_official", geom: "fill", minzoom: 6, cat: propGetter("source"), fillOpacity: 0.7 },
      { id: "ph-wetlands-osm-fill", sourceLayer: "wetlands_osm", geom: "fill", minzoom: 6, cat: propGetter("source"), fillOpacity: 0.4 },
    ],
    cats: [
      { id: "bmb", values: ["bmb"], color: "#0ea5e9", label: l3("BMB 內陸濕地（部分）", "BMB inland wetlands (partial)", "BMB 内陸湿地（部分）"), parts: ["ph-wetlands-official-fill"] },
      { id: "osm", values: ["osm"], color: "#14b8a6", label: l3("OSM 濕地（含紅樹林；淡色）", "OSM wetlands incl. mangroves (pale)", "OSM の湿地（マングローブ含む、淡色）"), parts: ["ph-wetlands-osm-fill"] },
    ],
    title: { props: ["name"], fallback: l3("濕地", "Wetland", "湿地"), fallbackBy: { prop: "wetland_type", map: WETLAND_OSM_TYPES } },
    fields: [
      { prop: "wetland_type", label: l3("濕地類型", "Wetland type", "湿地の種別"), map: WETLAND_OSM_TYPES },
      { prop: "class", label: l3("BMB 分級（原文）", "BMB class (source)", "BMB 区分（原文）"), kind: "code" },
      { prop: "area_ha", label: l3("面積（BMB）", "Area (BMB)", "面積（BMB）"), kind: "num", unit: "ha" },
      { prop: "management", label: l3("管理（BMB 原文）", "Management (BMB)", "管理（BMB 原文）") },
      SOURCE_FIELD({ bmb: l3("DENR-BMB 內陸濕地", "DENR-BMB inland wetlands", "DENR-BMB 内陸湿地"), osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap") }),
      PROV,
    ],
    legendNotes: [l3("BMB 內陸濕地 384 面＋OSM 濕地 8,293 面（含紅樹林）", "384 BMB inland wetlands + 8,293 OSM wetlands (incl. mangroves)", "BMB 内陸湿地 384 面＋OSM 湿地 8,293 面（マングローブ含む）"), PARTIAL, OSM_NOTE],
    popupNotes: [{ text: l3("「No Data」為 BMB 原表未填", "'No Data' means blank in the BMB table", "「No Data」は BMB の原表で未記入"), when: (p) => str(p.source) === "bmb" }],
    sourceOrg: j3("DENR Biodiversity Management Bureau via Geoportal Philippines WMS", SEP, OSM_1115), sourceUrl: GEOPORTAL_URL, license: COND_OSM, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("濕地", "wetlands"),
  },
  {
    key: "phForestryPrograms", file: "ph_forestry_programs.pmtiles", sourceId: "ph-forestry-programs", srcMinzoom: 6, srcMaxzoom: 14, color: "#22c55e", count: 17943, opacity: 0.7,
    parts: [{ id: "ph-forestry-programs-fill", sourceLayer: "forestry_programs", geom: "fill", minzoom: 6, cat: propGetter("kind"), fillOpacity: 0.7 }],
    cats: FORESTRY_CATS,
    title: { props: ["name", "watershed"], fallback: l3("林業計畫區", "Forestry programme area", "林業計画区域"), fallbackBy: { prop: "kind", map: catMap(FORESTRY_CATS) } },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(FORESTRY_CATS) },
      { prop: "year", label: l3("年度", "Year", "年度"), kind: "year" },
      { prop: "component", label: l3("工作項目", "Component", "事業区分") },
      { prop: "commodity", label: l3("樹種、作物", "Commodity", "樹種・作物") },
      { prop: "tenure", label: l3("土地權屬", "Tenure", "土地権原"), kind: "code" },
      { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: "ha", digits: 1 },
      { prop: "watershed", label: l3("集水區", "Watershed", "集水域") },
      { prop: "proclamation_no", label: l3("公告號", "Proclamation no.", "告示番号"), kind: "year" },
      PROV,
    ],
    legendNotes: [l3("DENR-FMB 林業計畫區 17,943 面：NGP 16,928、投資區 884、重要集水區 87、公告集水區 37、FLAg 7（聯絡人、地址已排除）", "17,943 DENR-FMB forestry areas: NGP 16,928, investment areas 884, critical watersheds 87, proclaimed watersheds 37, FLAg 7 (contact names and addresses removed)", "DENR-FMB 林業計画区域 17,943 面：NGP 16,928・投資区域 884・重要集水域 87・告示集水域 37・FLAg 7（担当者・住所は除外）"),
      PARTIAL, l3("集水區兩類查詢未收斂，確定是部分資料；z6 起顯示", "The two watershed types did not converge and are known to be partial; shown from z6", "集水域 2 種は照会が収束せず部分データ。z6 から表示")],
    popupNotes: [],
    sourceOrg: "DENR Forest Management Bureau via Geoportal Philippines WMS", sourceUrl: GEOPORTAL_URL, license: CONDITIONAL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("林業計畫區", "forestry programme areas"),
  },
];

// ═════════════════════════ 第 7 波：海洋、保護區（WDPA）、廢棄物、污染源 ═════════════════════════

const MARINE_CATS: readonly PhCat[] = [
  cat("primary_tide_station", "#3b82f6", "一級潮位站", "Primary tide station", "一級験潮所"),
  cat("secondary_tide_station", "#93c5fd", "二級潮位站（空心）", "Secondary tide station (hollow)", "二級験潮所（白抜き）"),
  cat("lighted_buoy", "#facc15", "燈浮標", "Lighted buoy", "灯浮標"),
  cat("lighthouse", "#f8fafc", "燈塔", "Lighthouse", "灯台"),
];
const WDPA_CATS: readonly PhCat[] = [
  cat("Terrestrial", "#22c55e", "陸域", "Terrestrial", "陸域"),
  cat("Marine", "#3b82f6", "海域", "Marine", "海域"),
  cat("Coastal", "#14b8a6", "陸海混合", "Coastal (mixed)", "沿岸（陸海）"),
];
const WASTE_CATS: readonly PhCat[] = [
  cat("sanitary_landfill", "#a16207", "衛生掩埋場（DENR）", "Sanitary landfill (DENR)", "衛生埋立地（DENR）"),
  cat("landfill", "#d97706", "掩埋場（OSM，不分衛生或開放傾倒；空心）", "Landfill (OSM; sanitary or open dump not distinguished; hollow)", "埋立地（OSM、衛生・オープンダンプ区別なし、白抜き）"),
  cat("waste_transfer_station", "#94a3b8", "轉運站（OSM；空心）", "Transfer station (OSM; hollow)", "中継施設（OSM、白抜き）"),
];
const POLLUTION_CATS: readonly PhCat[] = [
  cat("textiles-leather-apparel", "#f472b6", "紡織、皮革、成衣", "Textiles, leather & apparel", "繊維・皮革・衣料"),
  cat("cement", "#a8a29e", "水泥", "Cement", "セメント"),
  cat("iron-and-steel", "#ef4444", "鋼鐵", "Iron & steel", "鉄鋼"),
  cat("food-beverage-tobacco", "#4ade80", "食品飲料菸草", "Food, beverage & tobacco", "食品・飲料・たばこ"),
  cat("pulp-and-paper", "#facc15", "紙漿與造紙", "Pulp & paper", "パルプ・紙"),
  cat("petrochemical-steam-cracking", "#a78bfa", "石化（蒸汽裂解）", "Petrochemical (steam cracking)", "石油化学（スチームクラッキング）"),
  { id: "mining", values: ["iron-mining", "copper-mining"], color: "#b45309", label: l3("礦業（鐵、銅）", "Mining (iron, copper)", "鉱業（鉄・銅）") },
];
const CO2E_BANDS: PhSizeBands = {
  prop: "co2e_20yr_t", title: l3("推估排放（CO₂e 20 年，噸）", "Estimated emissions (CO₂e, 20-yr, t)", "推計排出量（CO₂e 20 年、t）"),
  bands: [{ min: 0, radius: 3, label: l3("<1 萬", "<10k", "<1 万") }, { min: 10000, radius: 5, label: l3("1–10 萬", "10k–100k", "1–10 万") }, { min: 100000, radius: 8, label: l3("10–100 萬", "100k–1M", "10–100 万") }, { min: 1000000, radius: 11, label: l3("≥100 萬", "≥1M", "≥100 万") }],
};

const W7_SPECS: PhLayerSpec[] = [
  {
    key: "phCoastalResources", file: "ph_coastal_resources.pmtiles", sourceId: "ph-coastal-resources", srcMinzoom: 5, srcMaxzoom: 13, color: "#14b8a6", count: 195, opacity: 0.75,
    parts: [{ id: "ph-coastal-resources-fill", sourceLayer: "coastal_resources", geom: "fill", minzoom: 5, cat: propGetter("class_name"), fillOpacity: 0.8 }],
    cats: [cat("Corals", "#fb7185", "珊瑚", "Corals", "サンゴ"), cat("Seagrass/Seaweeds", "#4ade80", "海草、海藻", "Seagrass / seaweeds", "海草・海藻"), cat("Mangrove forest", "#15803d", "紅樹林", "Mangrove forest", "マングローブ林")],
    title: { props: ["class_name"], fallback: l3("海岸資源", "Coastal resource", "沿岸資源") },
    fields: [
      { prop: "class_name", label: l3("資源類型", "Resource", "資源の種別"), map: { Corals: l3("珊瑚", "Corals", "サンゴ"), "Seagrass/Seaweeds": l3("海草、海藻", "Seagrass / seaweeds", "海草・海藻"), "Mangrove forest": l3("紅樹林", "Mangrove forest", "マングローブ林") } },
      { prop: "area_ha", label: l3("面積（全省合計）", "Area (province total)", "面積（州合計）"), kind: "num", unit: "ha" },
      PROV, REGION,
    ],
    legendNotes: [l3("NAMRIA 2020 海岸資源圖：紅樹林 69、海草海藻 67、珊瑚 59 個面（依省聚合；17/18 region）", "NAMRIA 2020 coastal resource map: 69 mangrove, 67 seagrass/seaweed and 59 coral polygons (aggregated by province; 17 of 18 regions)", "NAMRIA 2020 沿岸資源図：マングローブ 69・海草海藻 67・サンゴ 59 面（州単位で集約、18 地方中 17）")],
    popupNotes: [],
    sourceOrg: l3("NAMRIA via Geoportal Philippines WMS（2020 全國版）", "NAMRIA via Geoportal Philippines WMS (2020 national edition)", "NAMRIA。Geoportal Philippines WMS 経由（2020 年全国版）"), sourceUrl: GEOPORTAL_URL, license: MO008, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("海岸資源", "coastal resources"),
  },
  {
    key: "phMarineStations", file: "ph_marine_stations.pmtiles", sourceId: "ph-marine-stations", srcMinzoom: 6, srcMaxzoom: 14, color: "#facc15", count: 1308,
    parts: [pointPart("ph-marine-stations-circle", "marine_stations", 6, propGetter("kind"), {
      hollow: { when: ["==", ["get", "kind"], "secondary_tide_station"], js: (p) => str(p.kind) === "secondary_tide_station", label: l3("空心＝二級潮位站", "Hollow = secondary tide station", "白抜き＝二級験潮所") },
    })],
    cats: MARINE_CATS,
    title: { props: ["name"], fallback: l3("潮位站、航標", "Tide station / aid to navigation", "験潮所・航路標識") },
    fields: [
      { prop: "kind", label: l3("類型", "Type", "種別"), map: catMap(MARINE_CATS) },
      { prop: "status", label: l3("狀態（原文）", "Status (source)", "状態（原文）"), kind: "code" },
      { prop: "light_character", label: l3("燈質", "Light character", "灯質"), kind: "code" },
      { prop: "height_m", label: l3("燈高", "Height", "灯高"), kind: "num", unit: "m" },
      { prop: "range_nm", label: l3("光達距離", "Range", "光達距離"), kind: "num", unit: "nm" },
      PROV,
    ],
    legendNotes: [l3("NAMRIA 燈浮標 617、燈塔 609、一級潮位站 62、二級 20；觀測員姓名已排除", "NAMRIA: 617 lighted buoys, 609 lighthouses, 62 primary and 20 secondary tide stations; observer names removed", "NAMRIA：灯浮標 617・灯台 609・一級験潮所 62・二級 20。観測員名は除外"),
      l3("潮位站、燈浮標 Open；燈塔 Conditional downloading", "Tide stations and buoys: Open; lighthouses: Conditional downloading", "験潮所・灯浮標は Open、灯台は Conditional downloading")],
    popupNotes: [],
    sourceOrg: "NAMRIA via Geoportal Philippines WMS", sourceUrl: GEOPORTAL_URL, license: l3("潮位站、燈浮標 Open（MO 008）；燈塔 Conditional downloading", "Tide gauges and light buoys: Open (MO 008); lighthouses: Conditional downloading", "検潮所・灯浮標は Open（MO 008）。灯台は Conditional downloading"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("潮位站與航標", "tide stations and navigation aids"),
  },
  {
    key: "phWdpca", file: "ph_wdpca.pmtiles", sourceId: "ph-wdpca", srcMinzoom: 4, srcMaxzoom: 12, color: "#22c55e", count: 302, opacity: 0.7,
    parts: [
      { id: "ph-wdpca-fill", sourceLayer: "wdpca", geom: "fill", minzoom: 4, cat: propGetter("realm"), fillOpacity: 0.45 },
      { id: "ph-wdpca-line", sourceLayer: "wdpca", geom: "line", minzoom: 4, cat: propGetter("realm") },
    ],
    cats: WDPA_CATS,
    legendTitleNote: l3("非商用", "non-commercial", "非商用"),
    title: { props: ["name_eng", "name"], fallback: l3("保護區", "Protected area", "保護区") },
    fields: [
      { prop: "desig_eng", label: l3("類型", "Designation", "指定種別") },
      { prop: "realm", label: l3("陸海", "Realm", "陸域・海域"), map: catMap(WDPA_CATS) },
      { prop: "iucn_cat", label: l3("IUCN 類別", "IUCN category", "IUCN カテゴリー"), kind: "code" },
      { prop: "status", label: l3("狀態", "Status", "状態"), kind: "code" },
      { prop: "status_yr", label: l3("公告年", "Status year", "指定年"), kind: "year" },
      { prop: "gov_type", label: l3("治理類型", "Governance", "ガバナンス") },
      { prop: "rep_area", label: l3("公告面積", "Reported area", "報告面積"), kind: "num", unit: "km²", digits: 1 },
      { prop: "site_type", label: l3("PA／OECM", "PA / OECM", "PA／OECM"), kind: "code" },
      PROV,
    ],
    legendNotes: [
      l3("WDPA 菲律賓 302 處（保護區 260＋OECM 42；18/18 region）；國界外與卡拉延 6 處不畫", "302 WDPA sites in the Philippines (260 protected areas + 42 OECMs; 18 of 18 regions); 6 outside the national boundary or in Kalayaan not drawn", "WDPA フィリピン 302 件（保護区 260＋OECM 42、18 地方すべて）。国境外とカラヤンの 6 件は描かない"),
      l3("非商用授權（UNEP-WCMC／IUCN Terms of Use）：只供顯示，不提供原始檔、不進分析倉庫", "Non-commercial licence (UNEP-WCMC / IUCN Terms of Use): display only; no raw download and not in the analysis warehouse", "非商用ライセンス（UNEP-WCMC／IUCN 利用規約）：表示のみ。元データの提供・分析倉庫への登録はしない"),
      l3("DENR-BMB 官方保護區圖層查詢未收斂，暫以 WDPA 當主層", "The official DENR-BMB protected-area layer did not converge; WDPA is used as the main layer for now", "DENR-BMB の公式保護区レイヤーは照会が収束せず、当面 WDPA を主レイヤーとする"),
    ],
    popupNotes: [],
    sourceOrg: l3("UNEP-WCMC and IUCN, Protected Planet：WDPA／WD-OECM（菲律賓）", "UNEP-WCMC and IUCN, Protected Planet: WDPA/WD-OECM (Philippines)", "UNEP-WCMC and IUCN, Protected Planet：WDPA／WD-OECM（フィリピン）"), sourceUrl: "https://www.protectedplanet.net/country/PHL", license: l3("WDPA Terms of Use（非商用）", "WDPA Terms of Use (non-commercial)", "WDPA Terms of Use（非商用）"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("保護區", "protected areas"),
  },
  {
    key: "phWasteFacilities", file: "ph_waste_facilities.pmtiles", sourceId: "ph-waste-facilities", srcMinzoom: 6, srcMaxzoom: 14, color: "#d97706", count: 255,
    parts: [pointPart("ph-waste-facilities-circle", "waste_facilities", 6, propGetter("category"), { hollow: { when: notOfficial("denr_emb"), js: (p) => str(p.source) !== "denr_emb", label: l3("空心＝OSM", "Hollow = OSM", "白抜き＝OSM") } })],
    cats: WASTE_CATS,
    title: { props: ["name"], fallback: l3("廢棄物設施", "Waste facility", "廃棄物施設"), fallbackBy: { prop: "category", map: catMap(WASTE_CATS) } },
    fields: [
      { prop: "category", label: l3("類型", "Type", "種別"), map: catMap(WASTE_CATS) },
      { prop: "capacity", label: l3("容量（DENR 原文）", "Capacity (DENR)", "容量（DENR 原文）"), kind: "code" },
      SOURCE_FIELD({ denr_emb: l3("DENR-EMB", "DENR-EMB", "DENR-EMB"), osm: l3("OpenStreetMap", "OpenStreetMap", "OpenStreetMap") }),
      OPERATOR, PROV,
    ],
    legendNotes: [l3("DENR 衛生掩埋場 23 處（Geoportal 舊表，全國實際遠多於此；沒有名稱欄）＋OSM 掩埋場 181、轉運站 51", "23 DENR sanitary landfills (old Geoportal table — far fewer than actually exist; no name field) + 181 OSM landfills and 51 transfer stations", "DENR 衛生埋立地 23（Geoportal の旧表で実数はさらに多い。名称欄なし）＋OSM 埋立地 181・中継施設 51"), OSM_NOTE],
    popupNotes: [],
    sourceOrg: j3("DENR Environmental Management Bureau via Geoportal Philippines WMS", SEP, OSM_1115), sourceUrl: GEOPORTAL_URL, license: COND_OSM, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("廢棄物設施", "waste facilities"),
  },
  {
    key: "phPollutionSources", file: "ph_pollution_sources.pmtiles", sourceId: "ph-pollution-sources", srcMinzoom: 5, srcMaxzoom: 14, color: "#f472b6", count: 85,
    parts: [pointPart("ph-pollution-sources-circle", "pollution_sources", 5, propGetter("subsector"), { size: CO2E_BANDS })],
    cats: POLLUTION_CATS, sizeLegend: [CO2E_BANDS],
    title: { props: ["name"], fallback: l3("排放源", "Emission source", "排出源") },
    fields: [
      { prop: "subsector", label: l3("產業", "Subsector", "業種"), map: catMap(POLLUTION_CATS) },
      { prop: "co2e_20yr_t", label: l3("推估排放（CO₂e 20 年）", "Estimated emissions (CO₂e, 20-yr)", "推計排出量（CO₂e 20 年）"), kind: "num", unit: "t" },
      { prop: "pm25_t", label: l3("推估 PM2.5", "Estimated PM2.5", "推計 PM2.5"), kind: "num", unit: "t", digits: 1 },
      { prop: "capacity", label: l3("推估產能", "Estimated capacity", "推計生産能力"), kind: "num" },
      { prop: "capacityUnits", label: l3("產能單位", "Capacity unit", "生産能力の単位"), kind: "code" },
      { prop: "year", label: l3("推估年", "Year", "推計年"), kind: "year" },
      PROV,
    ],
    legendNotes: [l3("Climate TRACE 2025 推估排放源 85 處（製造業 75、礦業 10；15/18 region），不是官方許可名冊；EMB 許可名冊沒有公開座標", "85 Climate TRACE 2025 modelled emission sources (75 manufacturing, 10 mining; 15 of 18 regions); not an official permit register — EMB permits have no public coordinates", "Climate TRACE 2025 推計排出源 85（製造業 75・鉱業 10、18 地方中 15）。公式の許可名簿ではない（EMB の許可名簿は座標非公開）")],
    popupNotes: [],
    sourceOrg: l3("Climate TRACE（2025 資料集）", "Climate TRACE (2025 dataset)", "Climate TRACE（2025 年データセット）"), sourceUrl: "https://climatetrace.org/", license: "CC BY 4.0", fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("排放源", "emission sources"),
  },
];

// ═════════════════════════ 第 8 波：文化與生活據點（全部 OSM） ═════════════════════════

function osmPointSpec(key: PhDataKey, id: string, file: string, layer: string, minzoom: number, color: string, count: number, cats: readonly PhCat[], fallback: L3, notes: readonly L3[], load: L3, extra: Partial<PhLayerSpec> = {}, extraFields: PhField[] = []): PhLayerSpec {
  const base = file.replace(/\.pmtiles$/, "").replace(/_/g, "-");
  return {
    key, file, sourceId: base, srcMinzoom: minzoom, srcMaxzoom: 14, color, count,
    parts: [pointPart(id, layer, minzoom, propGetter("category"))],
    cats, title: { props: ["name"], fallback },
    fields: [NAME_EN, CATEGORY(cats), ...extraFields, PROV, REGION],
    legendNotes: [OSM_NOTE, ...notes], popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT, loading: load, ...extra,
  };
}
const UNNAMED = l3("未命名", "Unnamed", "名称なし");
const WORSHIP_CATS: readonly PhCat[] = [
  cat("christian", "#a78bfa", "基督宗教", "Christian", "キリスト教"),
  cat("muslim", "#22c55e", "伊斯蘭", "Muslim", "イスラム教"),
  cat("buddhist", "#facc15", "佛教", "Buddhist", "仏教"),
  cat("taoist", "#f97316", "道教", "Taoist", "道教"),
  cat("unspecified", "#9ca3af", "未標宗教", "Religion not tagged", "宗教未記載"),
];

const W8_SPECS: PhLayerSpec[] = [
  osmPointSpec("phArtsVenues", "ph-arts-venues-circle", "ph_arts_venues.pmtiles", "arts_venues", 8, "#f472b6", 1107, [
    cat("events_venue", "#f472b6", "活動場地", "Events venue", "イベント会場"), cat("theatre", "#a78bfa", "劇場", "Theatre", "劇場"),
    cat("cinema", "#60a5fa", "電影院", "Cinema", "映画館"), cat("arts_centre", "#facc15", "藝文中心", "Arts centre", "アートセンター"),
    cat("exhibition_centre", "#2dd4bf", "展覽館", "Exhibition centre", "展示場"),
  ], UNNAMED, [l3("1,107 處；z8 起顯示", "1,107 venues; shown from z8", "1,107 か所。z8 から表示"), BARMM_SPARSE], loading("表演場館", "arts venues"), {}, [OPERATOR]),
  osmPointSpec("phPostOffices", "ph-post-offices-circle", "ph_post_offices.pmtiles", "post_offices", 7, "#ef4444", 1006, [cat("post_office", "#ef4444", "郵局、快遞據點", "Post office / courier", "郵便局・宅配拠点")],
    UNNAMED, [l3("OSM amenity=post_office 1,006 處（含 LBC、J&T 等快遞；PHLPost 沒有可下載座標版）；z7 起顯示", "1,006 OSM amenity=post_office (incl. couriers such as LBC, J&T; PHLPost has no downloadable coordinates); shown from z7", "OSM amenity=post_office 1,006（LBC・J&T など宅配を含む。PHLPost に座標版なし）。z7 から表示"), BARMM_SPARSE],
    loading("郵局", "post offices"), {}, [OPERATOR]),
  osmPointSpec("phPublicFacilities", "ph-public-facilities-circle", "ph_public_facilities.pmtiles", "public_facilities", 8, "#60a5fa", 19711, [
    cat("townhall", "#60a5fa", "市鎮、barangay 廳舍", "Town / barangay hall", "町役場・バランガイホール"), cat("toilets", "#94a3b8", "公廁", "Public toilets", "公衆トイレ"),
    cat("marketplace", "#f97316", "公有市場", "Public market", "公設市場"), cat("community_centre", "#4ade80", "社區中心", "Community centre", "コミュニティセンター"),
    cat("social_facility", "#f472b6", "社福設施", "Social facility", "社会福祉施設"), cat("library", "#facc15", "圖書館", "Library", "図書館"),
  ], UNNAMED, [l3("19,711 處；townhall 混有市鎮廳與 barangay 廳（同色）；z8 起顯示，拉遠為熱區", "19,711 facilities; townhall mixes municipal and barangay halls (same colour); shown from z8, heatmap when zoomed out", "19,711 か所。townhall は市町役場とバランガイホールが混在（同色）。z8 から表示、縮小時はヒートマップ"), BARMM_SPARSE],
    loading("公共生活設施", "public facilities"), { heat: { intensity: 0.6 } }, [OPERATOR]),
  osmPointSpec("phFinancialServices", "ph-financial-services-circle", "ph_financial_services.pmtiles", "financial_services", 9, "#22c55e", 17506, [
    cat("bank", "#22c55e", "銀行", "Bank", "銀行"), cat("pawnbroker", "#facc15", "當鋪（兼匯款）", "Pawnshop (also remittance)", "質屋（送金兼業）"),
    cat("atm", "#60a5fa", "ATM", "ATM", "ATM"), cat("money_transfer", "#f472b6", "匯款", "Money transfer", "送金"),
    cat("bureau_de_change", "#a78bfa", "外幣兌換", "Currency exchange", "両替所"),
  ], UNNAMED, [l3("17,506 處；z9 起顯示，拉遠為熱區", "17,506 points; shown from z9, heatmap when zoomed out", "17,506 か所。z9 から表示、縮小時はヒートマップ"), BARMM_SPARSE],
    loading("金融據點", "financial services"), { heat: { intensity: 0.6 } }, [OPERATOR]),
  osmPointSpec("phPlacesOfWorship", "ph-places-of-worship-circle", "ph_places_of_worship.pmtiles", "places_of_worship", 8, "#a78bfa", 18341, WORSHIP_CATS,
    UNNAMED, [l3("18,341 處；未標宗教 13% 不由名稱猜；顏色只分宗教，不代表多寡比較；z8 起顯示，拉遠為熱區", "18,341 places; the 13% with no religion tag are not guessed from names; colours show religion only, not a comparison of numbers; shown from z8, heatmap when zoomed out", "18,341 か所。宗教未記載の 13% は名称から推測しない。色は宗教の区別のみで多寡の比較ではない。z8 から表示、縮小時はヒートマップ")],
    loading("宗教場所", "places of worship"), { heat: { intensity: 0.6 }, otherColor: "#cbd5e1", otherLabel: l3("其他宗教", "Other religion", "その他の宗教") },
    [{ prop: "denomination", label: l3("教派（OSM 原文）", "Denomination (OSM tag)", "宗派（OSM 原文）"), kind: "code" }, OPERATOR]),
];

// ═════════════════════════ 第 9 波：運動、公園、墓園、漁港、養殖 ═════════════════════════

const W9_SPECS: PhLayerSpec[] = [
  osmPointSpec("phSportsVenues", "ph-sports-venues-circle", "ph_sports_venues.pmtiles", "sports_venues", 9, "#f97316", 36709, [
    cat("pitch", "#f97316", "球場", "Pitch / court", "競技場・コート"), cat("sports_hall", "#facc15", "室內場館（多為 barangay 籃球場）", "Sports hall (mostly barangay basketball courts)", "屋内体育館（多くはバランガイのバスケットコート）"),
    cat("sports_centre", "#60a5fa", "運動中心", "Sports centre", "スポーツセンター"), cat("track", "#a78bfa", "跑道", "Track", "トラック"), cat("stadium", "#ef4444", "體育場", "Stadium", "スタジアム"),
  ], UNNAMED, [l3("36,709 處（面取代表點）；有名稱只有 24%；z9 起顯示，拉遠為熱區", "36,709 venues (areas as representative points); only 24% named; shown from z9, heatmap when zoomed out", "36,709 か所（面は代表点）。名称ありは 24% のみ。z9 から表示、縮小時はヒートマップ")],
    loading("運動場館", "sports venues"), { heat: { intensity: 0.6 } }, [{ prop: "sport", label: l3("運動項目（OSM 原文）", "Sport (OSM tag)", "競技（OSM 原文）"), kind: "code" }]),
  {
    key: "phParks", file: "ph_parks.pmtiles", sourceId: "ph-parks", srcMinzoom: 9, srcMaxzoom: 15, color: "#4ade80", count: 7024, opacity: 0.75,
    parts: [
      { id: "ph-parks-fill", sourceLayer: "parks", geom: "fill", minzoom: 9, cat: propGetter("category"), fillOpacity: 0.55 },
      pointPart("ph-parks-circle", "points", 9, propGetter("category")),
    ],
    cats: [cat("park", "#4ade80", "公園", "Park", "公園"), cat("garden", "#a3e635", "庭園", "Garden", "庭園")],
    title: { props: ["name"], fallback: UNNAMED },
    fields: [NAME_EN, { prop: "category", label: l3("類別", "Category", "種別"), map: { park: l3("公園", "Park", "公園"), garden: l3("庭園", "Garden", "庭園") } }, { prop: "access", label: l3("開放（OSM 原文）", "Access (OSM tag)", "利用（OSM 原文）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [OSM_NOTE, l3("公園、庭園面 6,570＋只有點的 454；z9 起顯示", "6,570 park / garden polygons + 454 point-only; shown from z9", "公園・庭園の面 6,570＋点のみ 454。z9 から表示"), BARMM_SPARSE],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("公園", "parks"),
  },
  {
    key: "phCemeteries", file: "ph_cemeteries.pmtiles", sourceId: "ph-cemeteries", srcMinzoom: 9, srcMaxzoom: 15, color: "#a78bfa", count: 4373, opacity: 0.75,
    parts: [
      { id: "ph-cemeteries-fill", sourceLayer: "cemeteries", geom: "fill", minzoom: 9, cat: propGetter("category"), fillOpacity: 0.55 },
      pointPart("ph-cemeteries-circle", "points", 9, propGetter("category")),
    ],
    cats: [cat("cemetery", "#a78bfa", "墓園", "Cemetery", "墓地"), cat("grave_yard", "#c4b5fd", "教堂墓地", "Churchyard / graveyard", "教会墓地")],
    title: { props: ["name"], fallback: UNNAMED },
    fields: [NAME_EN, { prop: "category", label: l3("類別", "Category", "種別"), map: { cemetery: l3("墓園", "Cemetery", "墓地"), grave_yard: l3("教堂墓地", "Churchyard / graveyard", "教会墓地") } }, { prop: "religion", label: l3("宗教（OSM 原文）", "Religion (OSM tag)", "宗教（OSM 原文）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [OSM_NOTE, l3("墓區面 4,263＋只有點的 110；z9 起顯示", "4,263 cemetery polygons + 110 point-only; shown from z9", "墓地の面 4,263＋点のみ 110。z9 から表示"), l3("BARMM、NCR：OSM 稀疏", "BARMM, NCR: sparse in OSM", "BARMM・NCR：OSM が疎")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("墓園", "cemeteries"),
  },
  {
    key: "phFishPorts", file: "ph_fish_ports.pmtiles", sourceId: "ph-fish-ports", srcMinzoom: 5, srcMaxzoom: 14, color: "#22d3ee", count: 47,
    parts: [pointPart("ph-fish-ports-circle", "fish_ports", 5, propGetter("status"))],
    cats: [cat("Operational", "#22d3ee", "營運中", "Operational", "稼働中"), cat("On Going", "#f59e0b", "興建中", "Under construction", "建設中")],
    title: { props: ["name"], fallback: l3("漁港", "Fish port", "漁港") },
    fields: [
      { prop: "status", label: l3("狀態", "Status", "状態"), map: { Operational: l3("營運中", "Operational", "稼働中"), "On Going": l3("興建中", "Under construction", "建設中") } },
      { prop: "port_class", label: l3("漁港等級", "Port class", "漁港等級"), map: { "1": l3("1 級", "Class 1", "1 級"), "2": l3("2 級", "Class 2", "2 級") } },
      PROV, REGION,
    ],
    legendNotes: [l3("DA 漁港 47 處（營運 39、興建中 8；16/18 region）", "47 DA fish ports (39 operational, 8 under construction; 16 of 18 regions)", "DA 漁港 47（稼働 39・建設中 8、18 地方中 16）")],
    popupNotes: [],
    sourceOrg: "Department of Agriculture via Geoportal Philippines WMS", sourceUrl: GEOPORTAL_URL, license: l3("Geoportal 盤點表：No restriction", "Geoportal inventory: No restriction", "Geoportal 一覧表：No restriction"), fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("漁港", "fish ports"),
  },
  {
    key: "phAquaculture", file: "ph_aquaculture.pmtiles", sourceId: "ph-aquaculture", srcMinzoom: 9, srcMaxzoom: 15, color: "#22d3ee", count: 16629, opacity: 0.75,
    parts: [{ id: "ph-aquaculture-fill", sourceLayer: "aquaculture", geom: "fill", minzoom: 9, cat: propGetter("category"), fillOpacity: 0.65 }],
    cats: [cat("aquaculture", "#22d3ee", "養殖用地（未標物種）", "Aquaculture (species not tagged)", "養殖用地（種類未記載）"), cat("fish", "#0ea5e9", "魚類", "Fish", "魚類"), cat("fishpond", "#67e8f9", "魚塭（fishpond）", "Fishpond", "養魚池")],
    otherColor: "#a5f3fc", otherLabel: l3("其他（海藻、蝦等）", "Other (seaweed, shrimp…)", "その他（海藻・エビなど）"),
    title: { props: ["name"], fallback: l3("養殖", "Aquaculture", "養殖") },
    fields: [{ prop: "category", label: l3("類別（OSM 原文）", "Category (OSM tag)", "種別（OSM 原文）"), kind: "code" }, { prop: "water", label: l3("水體（OSM 原文）", "Water (OSM tag)", "水体（OSM 原文）"), kind: "code" }, OPERATOR, PROV, REGION],
    legendNotes: [OSM_NOTE, l3("OSM 養殖面 16,629 個；「未標物種」是 landuse=aquaculture 沒標種類，不要當作魚類；z9 起顯示", "16,629 OSM aquaculture polygons; 'species not tagged' is landuse=aquaculture without a species — not necessarily fish; shown from z9", "OSM の養殖面 16,629。「種類未記載」は landuse=aquaculture で種類なし（魚類とは限らない）。z9 から表示"),
      l3("IX、X、NCR、CAR、BARMM：OSM 稀疏；BFAR 魚塭普查沒有可下載向量", "IX, X, NCR, CAR, BARMM: sparse in OSM; BFAR fishpond inventory has no downloadable vectors", "IX・X・NCR・CAR・BARMM：OSM が疎。BFAR の養魚池調査はベクターの提供なし")],
    popupNotes: [],
    sourceOrg: OSM_1115, sourceUrl: OSM_URL, license: ODBL, fetchedAt: PH_WAVES_FETCHED_AT,
    loading: loading("養殖", "aquaculture"),
  },
];

/** 觀光波＋第 2–9 波規格驅動層（展開進 `PH_DATA_SPECS`）。 */
export const PH_WAVE_SPECS: readonly PhLayerSpec[] = [...TOURISM_SPECS, ...W2_SPECS, ...W3_SPECS, ...W4_SPECS, ...W5_SPECS, ...W6_SPECS, ...W7_SPECS, ...W8_SPECS, ...W9_SPECS];

// ═════════════════════════ Raster 4 層（地形、建成面積、樹冠流失） ═════════════════════════

export interface PhRasterSpec {
  key: PhRasterKey;
  file: string;
  sourceId: string;
  layerId: string;
  minzoom: number;
  maxzoom: number;
  opacity: number;
  /** 圖例色帶（由上游 color-relief ramp 抄錄）；省略＝無色階（山體陰影） */
  steps?: readonly { color: string; label: string }[];
  notes: readonly L3[];
  sourceShort: string | L3;
  loading: string;
}
const FOREST_LOSS_COLOR = (y: number) => {
  const t = (y - 1) / 23;
  const r = t < 0.7 ? 255 : Math.round(255 - (120 * (t - 0.7)) / 0.3);
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(Math.round(230 - 200 * t))}${hex(Math.round(120 - 110 * t))}`;
};
export const PH_RASTER_SPECS: readonly PhRasterSpec[] = [
  {
    key: "phTerrainHillshade", file: "ph_terrain_hillshade.pmtiles", sourceId: "ph-terrain-hillshade", layerId: "ph-terrain-hillshade-raster", minzoom: 5, maxzoom: 10, opacity: 0.5,
    notes: [l3("Copernicus DEM GLO-90（約 90 m）山體陰影；只保留菲律賓陸域，z10 以上放大沿用", "Copernicus DEM GLO-90 (about 90 m) hillshade; Philippine land only; overzoomed above z10", "Copernicus DEM GLO-90（約 90 m）陰影起伏。フィリピン陸域のみ、z10 以上は拡大表示")],
    sourceShort: "© DLR／Airbus，Copernicus DEM GLO-90（ESA／EU，AWS Open Data）", loading: "菲律賓山體陰影載入中",
  },
  {
    key: "phTerrainRelief", file: "ph_terrain_relief.pmtiles", sourceId: "ph-terrain-relief", layerId: "ph-terrain-relief-raster", minzoom: 5, maxzoom: 10, opacity: 0.6,
    steps: [
      { color: "#4c8c54", label: "0" }, { color: "#78aa60", label: "100" }, { color: "#b0c470", label: "300" }, { color: "#dece84", label: "600" },
      { color: "#caa062", label: "1,000" }, { color: "#a4764a", label: "1,500" }, { color: "#88685c", label: "2,000" }, { color: "#bebab6", label: "2,500" }, { color: "#f5f5f5", label: "2,954 m" },
    ],
    notes: [l3("色別標高（m）；≤0 m 透明；只保留菲律賓陸域", "Elevation tint (m); ≤0 m transparent; Philippine land only", "段彩標高（m）。0 m 以下は透明、フィリピン陸域のみ")],
    sourceShort: "© DLR／Airbus，Copernicus DEM GLO-90（ESA／EU，AWS Open Data）", loading: "菲律賓色別標高載入中",
  },
  {
    key: "phBuiltSurface", file: "ph_built_surface.pmtiles", sourceId: "ph-built-surface", layerId: "ph-built-surface-raster", minzoom: 5, maxzoom: 11, opacity: 0.7,
    steps: [{ color: "#ffeda0", label: "1%" }, { color: "#feb24c", label: "10%" }, { color: "#fd8d3c", label: "30%" }, { color: "#f03b20", label: "60%" }, { color: "#bd0026", label: "100%" }],
    notes: [l3("建成面積比例（100 m 格）；<1% 透明", "Built-up share of each 100 m cell; <1% transparent", "建築面積の割合（100 m 格子）。1% 未満は透明"),
      l3("JRC GHSL 2025 推估，衛星分類，不是建物普查", "JRC GHSL 2025 estimate from satellite classification, not a building census", "JRC GHSL 2025 推計（衛星分類）で、建物調査ではない")],
    sourceShort: l3("© European Commission JRC，GHS-BUILT-S E2025 R2023A（HDX 菲律賓裁切，CC BY 4.0）", "© European Commission JRC, GHS-BUILT-S E2025 R2023A (Philippines clip via HDX, CC BY 4.0)", "© European Commission JRC、GHS-BUILT-S E2025 R2023A（HDX のフィリピン切り出し、CC BY 4.0）"), loading: "菲律賓建成面積載入中",
  },
  {
    key: "phForestLoss", file: "ph_forest_loss.pmtiles", sourceId: "ph-forest-loss", layerId: "ph-forest-loss-raster", minzoom: 5, maxzoom: 12, opacity: 0.85,
    steps: [1, 6, 12, 18, 24].map((y) => ({ color: FOREST_LOSS_COLOR(y), label: String(2000 + y) })),
    notes: [l3("樹冠流失年份 2001–2024（30 m，取最大值降採樣）；樹冠流失≠毀林（含輪伐、颱風、火災）", "Year of tree-cover loss 2001–2024 (30 m, max-resampled); tree-cover loss ≠ deforestation (includes rotation, typhoons, fire)", "樹冠消失年 2001–2024（30 m、最大値でリサンプル）。樹冠消失≠森林破壊（伐期・台風・火災を含む）")],
    sourceShort: "Hansen／UMD／Google／USGS／NASA，Global Forest Change 2000–2024 v1.12（CC BY 4.0）", loading: "菲律賓樹冠流失載入中",
  },
];
export const PH_RASTER_BY_KEY = Object.fromEntries(PH_RASTER_SPECS.map((s) => [s.key, s])) as Record<PhRasterKey, PhRasterSpec>;
