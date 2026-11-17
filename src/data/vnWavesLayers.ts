/**
 * 越南觀光波與第 2–7 波（2026-11-17）圖層規格 SSOT：規格驅動 31 層（展開進 `VN_DATA_SPECS`，畫法重用 usePhDataLayer）＋ raster 4 層。
 * 資料端：taipei-gis-analytics #397（`docs/topic-research/vietnam_opendata/waves/{tourism,w02…w07}/layer-plan.md`、`HANDOFF-vn-2-7.md`）；
 * 類別與筆數以成品 GeoJSON 實際值為準（不照 layer-plan 草稿）。
 * 站主決定（2026-11-17）：
 * - T-1 規劃潛力的國家級旅遊區也算 tier1，popup 標狀態；T-2 世界遺產 popup 加越南文名（`whc_name_vi`）；T-3 美山併到聖地本體。
 * - 觀光點依類別上色；tier1 z4、tier2 z7、有名稱 z10、無名稱 z12（逐筆 minzoom 已烤進圖磚）；圖例寫「不代表遊客量」。
 * - W6-1 WDPCA：只上 raster（不可下載向量）＋署名，且站主限定；ODM 保護區照常公開、圖例標非商用。
 * - W7-1 安江省門戶資料只標位置與分區類別（養殖不輸出面積、更新時間）。
 * - W3-1 崩塌潛勢：ODM GeoServer WMS 沒有 CORS，改由 analytics 預渲染成自有 PNG PMTiles（z5–9，34 省遮罩、極低透明）。
 * GeoJSON 數值欄有字串（'137660'、'5'）：popup 一律 `kind: "num"／"year"` 轉數字。南海兩特區不畫、不歸任何省。
 */
import type { VnDataKey, VnRasterKey } from "./vnDataKeys";
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhPart, PhSizeBands } from "./phDataLayers";

type Spec = PhLayerSpec<VnDataKey>;
const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (id: string): PhCatGetter => ({ expr: ["to-string", id], js: () => id });

export const VN_WAVES_FETCHED_AT = "2026-11-17";
const ODBL = "ODbL 1.0";
const OSM_URL = "https://www.openstreetmap.org/copyright";
const OSM_SRC = "© OpenStreetMap contributors（ODbL），via Geofabrik vietnam-latest（快照 2026-11-12）";
const ODM_URL = "https://vietnam.opendevelopmentmekong.net/";
const ODM_SRC = (title: string) => `Open Development Vietnam 彙編（NGO），原始機關未載明；${title}`;

const PROV: PhField = { prop: "province_name", label: l3("省（34 省新制）", "Province (2025)", "省（2025 新制）") };
const NAME_EN: PhField = { prop: "name_en", label: l3("英文名", "English name", "英語名"), unlessSameAs: "name" };
const OPERATOR: PhField = { prop: "operator", label: l3("營運者", "Operator", "運営者") };
const NEAREST: PhNote = { text: l3("點落在省界外（岸邊、河道），省份取最近的省", "Point lies outside province polygons (shore, river); nearest province used", "点が省界の外（海岸・河道）にあり、最寄りの省を採用"), when: (p) => str(p.province_method) === "nearest" };
const OSM_NOTE = l3("OpenStreetMap 志願者繪製，非官方名冊；沒有點的地方不代表沒有", "Volunteer-mapped OpenStreetMap, not an official register; no point does not mean none", "OpenStreetMap のボランティア作図で公式名簿ではない。点がない場所に存在しないとは限らない");
const loading = (zh: string, en: string): L3 => l3(`越南${zh}載入中`, `Loading Vietnam ${en}`, `ベトナムの${zh}を読み込み中`);
/** OSM 稀疏省（每 10 萬人筆數 < 34 省中位數 × 0.33；analytics layer-plan 表）。 */
const SPARSE = (provs: string): L3 => l3(`OSM 稀疏省：${provs}`, `Sparse in OSM: ${provs}`, `OSM が疎な省：${provs}`);
const COVER = (n: number): L3 => l3(`有資料的省 ${n}／34；其他省是未涵蓋，不代表沒有`, `Data in ${n} of 34 provinces; the rest are not covered, not empty`, `データがある省は 34 中 ${n}。その他は未収録で、存在しないという意味ではない`);
const cat = (id: string, color: string, zh: string, en: string, ja: string, extra: Partial<PhCat> = {}): PhCat => ({ id, values: [id], color, label: l3(zh, en, ja), ...extra });
const catMap = (cats: readonly PhCat[]): Record<string, L3> => Object.fromEntries(cats.flatMap((c) => c.values.map((v) => [v, c.label])));
const CATEGORY = (cats: readonly PhCat[]): PhField => ({ prop: "category", label: l3("類別", "Category", "種別"), map: catMap(cats) });
const pointPart = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: getter, ...extra });
const sid = (file: string) => file.replace(/\.pmtiles$/, "").replace(/_/g, "-");

/** OSM 點層（最常見）：單一 tile layer、依 category 上色。 */
function osmPoints(key: VnDataKey, id: string, file: string, layer: string, minzoom: number, color: string, count: number, cats: readonly PhCat[],
  fallback: L3, notes: readonly L3[], load: L3, extraFields: PhField[] = [], extra: Partial<Spec> = {}): Spec {
  return {
    key, file, sourceId: sid(file), srcMinzoom: minzoom, srcMaxzoom: 14, color, count,
    parts: [pointPart(id, layer, minzoom, propGetter("category"))],
    cats, title: { props: ["name", "name_en"], fallback },
    fields: [NAME_EN, ...(cats.length > 1 ? [CATEGORY(cats)] : []), ...extraFields, PROV],
    legendNotes: [OSM_NOTE, ...notes], popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: load, ...extra,
  };
}

// ═════════════════════════ 觀光波 ═════════════════════════

const TIER_BANDS: PhSizeBands = {
  prop: "tier", title: l3("圖示大小：知名度", "Symbol size: prominence", "記号の大きさ：知名度"),
  bands: [
    { min: 0, radius: 6.5, label: "UNESCO／國家級旅遊區／保護區" },
    { min: 2, radius: 5, label: "Wikidata 熱門" },
    { min: 3, radius: 3.5, label: "一般" },
    { min: 4, radius: 2.5, label: "未命名" },
  ],
};
const TIER_MAP: Record<string, L3> = {
  1: l3("1：UNESCO／國家級旅遊區／保護區", "1: UNESCO / national tourist area / protected area", "1：UNESCO・国家観光区・保護区"),
  2: l3("2：Wikidata 熱門（sitelinks ≥5）", "2: popular on Wikidata (≥5 sitelinks)", "2：Wikidata で人気（sitelinks 5 以上）"),
  3: l3("3：有名稱", "3: named", "3：名称あり"),
  4: l3("4：未命名", "4: unnamed", "4：名称なし"),
};
const KDLQG_STATUS: Record<string, L3> = {
  recognized: l3("已認證", "Recognised", "認定済み"),
  potential: l3("規劃（潛力）", "Planned (potential)", "計画（候補）"),
};
const TIER_NOTES: readonly L3[] = [
  l3("知名度依 UNESCO、國家級旅遊區、保護區與 Wikidata 條目數分級，不代表遊客量", "Prominence from UNESCO, national tourist areas, protected areas and Wikidata sitelinks; not visitor numbers", "知名度は UNESCO・国家観光区・保護区・Wikidata の言語版数による区分で、来訪者数ではない"),
  l3("拉遠只顯示重要條目（z4 起第 1 級、z7 起 Wikidata 熱門、z10 起有名稱、z12 起未命名）", "Zoomed out shows only prominent items (tier 1 from z4, popular Wikidata items from z7, named from z10, unnamed from z12)", "縮小時は重要項目のみ（z4 から第 1 級、z7 から Wikidata 人気、z10 から名称あり、z12 から名称なし）"),
];
const TOURISM_FIELDS = (cats: readonly PhCat[]): PhField[] => [
  NAME_EN, CATEGORY(cats),
  { prop: "tier", label: l3("知名度分級", "Prominence tier", "知名度区分"), map: TIER_MAP },
  { prop: "kdlqg_status", label: l3("國家級旅遊區", "National tourist area", "国家観光区"), map: KDLQG_STATUS },
  { prop: "whc_name", label: l3("世界遺產", "World Heritage site", "世界遺産") },
  { prop: "whc_name_vi", label: l3("世界遺產（越南文）", "World Heritage site (Vietnamese)", "世界遺産（ベトナム語）") },
  { prop: "whc_inscribed", label: l3("登錄年", "Inscribed", "登録年"), kind: "year" },
  { prop: "sources", label: l3("資料來源", "Sources", "出典"), kind: "code" },
  { prop: "wd_qid", label: l3("Wikidata", "Wikidata", "Wikidata"), kind: "code" },
  PROV,
];
const TOURISM_SRC = "© OpenStreetMap contributors（ODbL，Geofabrik 2026-11-12）；UNESCO World Heritage Centre whc001（CC BY-SA 4.0）；Wikidata（CC0）";
const TOURISM_LICENSE = "ODbL 1.0（OSM）＋CC BY-SA 4.0（UNESCO）＋CC0（Wikidata）";
/** 有 whc_id 的要素一律畫世界遺產色（T-3 併回 OSM 後原類別是古蹟、保護區或景點）。 */
const attractionCat: PhCatGetter = {
  expr: ["case", ["!=", ["to-string", ["coalesce", ["get", "whc_id"], ""]], ""], "unesco_site", ["to-string", ["coalesce", ["get", "category"], ""]]],
  js: (p) => (str(p.whc_id) ? "unesco_site" : str(p.category)),
};
const ATTRACTION_CATS: readonly PhCat[] = [
  cat("unesco_site", "#fbbf24", "世界遺產", "World Heritage site", "世界遺産"),
  cat("protected", "#22c55e", "國家公園、保護區", "National park / protected area", "国立公園・保護区"),
  cat("heritage", "#a78bfa", "古蹟與寺廟", "Heritage & temples", "史跡・寺社"),
  cat("attraction", "#f472b6", "景點", "Attraction", "観光スポット"),
  cat("museum", "#60a5fa", "博物館", "Museum", "博物館"),
  cat("viewpoint", "#2dd4bf", "觀景點", "Viewpoint", "展望地"),
  cat("park", "#86efac", "公園", "Park", "公園"),
];
const NATURE_CATS: readonly PhCat[] = [
  cat("beach", "#fde68a", "海灘", "Beach", "ビーチ"),
  cat("island", "#34d399", "島", "Island", "島"),
  cat("islet", "#a7f3d0", "小島", "Islet", "小島"),
  cat("bay", "#818cf8", "海灣", "Bay", "湾"),
  cat("waterfall", "#38bdf8", "瀑布", "Waterfall", "滝"),
  cat("cave", "#a8a29e", "洞穴", "Cave", "洞窟"),
  cat("volcano", "#ef4444", "火山", "Volcano", "火山"),
  cat("hot_spring", "#f97316", "溫泉", "Hot spring", "温泉"),
  cat("dive", "#22d3ee", "潛水點", "Dive site", "ダイビングスポット"),
  cat("lake", "#60a5fa", "湖", "Lake", "湖"),
  cat("mountain", "#a3e635", "山", "Mountain", "山"),
];
const SERVICE_CATS: readonly PhCat[] = [
  cat("lodging", "#c084fc", "住宿", "Lodging", "宿泊施設"),
  cat("resort", "#f472b6", "度假村", "Resort", "リゾート"),
  cat("theme_park_zoo", "#facc15", "樂園、動物園", "Theme park / zoo", "テーマパーク・動物園"),
  cat("camp_site", "#4ade80", "露營地", "Campsite", "キャンプ場"),
  cat("visitor_centre", "#38bdf8", "遊客中心", "Visitor centre", "ビジターセンター"),
];

function tourismSpec(key: VnDataKey, id: string, file: string, layer: string, color: string, count: number, cats: readonly PhCat[], getter: PhCatGetter,
  fallback: L3, notes: readonly L3[], load: L3, extraFields: PhField[] = []): Spec {
  return {
    key, file, sourceId: sid(file), srcMinzoom: 4, srcMaxzoom: 14, color, count,
    parts: [pointPart(id, layer, 4, getter, { size: TIER_BANDS })],
    cats, sizeLegend: [TIER_BANDS],
    title: { props: ["name", "name_en"], fallback },
    fields: [...TOURISM_FIELDS(cats), ...extraFields],
    legendNotes: [...TIER_NOTES, ...notes], popupNotes: [NEAREST],
    sourceOrg: TOURISM_SRC, sourceUrl: OSM_URL, license: TOURISM_LICENSE, fetchedAt: VN_WAVES_FETCHED_AT, loading: load,
  };
}

const TOURISM_SPECS: Spec[] = [
  tourismSpec("vnTourAttractions", "vn-tour-attractions-circle", "vn_tourist_attractions.pmtiles", "tourist_attractions", "#f472b6", 2885, ATTRACTION_CATS, attractionCat,
    l3("未命名景點", "Unnamed attraction", "名称不明の観光スポット"),
    [l3("UNESCO 世界遺產 9 處（34 個構成點）：併回 OSM 時優先古蹟，美山對到聖地本體；世界遺產一律畫金色", "9 UNESCO World Heritage sites (34 components); merged into OSM features preferring heritage (Mỹ Sơn matched to the sanctuary itself); all drawn in gold", "UNESCO 世界遺産 9 件（構成資産 34）。OSM へ統合する際は史跡を優先（ミーソンは聖域本体）。世界遺産は金色"),
      l3("國家級旅遊區（含規劃潛力）5 km 內同名的要素也列第 1 級", "Features with the same name within 5 km of a national tourist area (including planned ones) are also tier 1", "国家観光区（計画候補を含む）から 5 km 以内の同名要素も第 1 級"),
      SPARSE("Thái Nguyên、Cà Mau")],
    loading("景點", "attractions")),
  tourismSpec("vnTourNature", "vn-tour-nature-circle", "vn_nature_spots.pmtiles", "nature_spots", "#38bdf8", 1967, NATURE_CATS, propGetter("category"),
    l3("未命名自然景點", "Unnamed natural site", "名称不明の自然景観"),
    [l3("潛水點併入本層；未命名海灘與小島 z12 起才出現", "Dive sites are in this layer; unnamed beaches and islets appear from z12", "ダイビングスポットを含む。名称のないビーチ・小島は z12 から"),
      SPARSE("Hà Nội、Điện Biên、Bắc Ninh、Hưng Yên、Nghệ An、Đồng Nai、Tây Ninh、Cần Thơ")],
    loading("自然景點", "natural sites")),
  tourismSpec("vnTourServices", "vn-tour-services-circle", "vn_tourism_services.pmtiles", "tourism_services", "#c084fc", 8490, SERVICE_CATS, propGetter("category"),
    l3("住宿與觀光服務", "Lodging / tourism service", "宿泊・観光サービス"),
    [l3("OSM 收錄，非官方登記旅宿；餐飲不在本層", "Collected from OSM, not the official lodging register; restaurants not included", "OSM 収録で公式の宿泊登録ではない。飲食店は含まない"), SPARSE("Hưng Yên、Nghệ An、Cà Mau")],
    loading("住宿與觀光服務", "lodging and tourism services"),
    [{ prop: "stars", label: l3("星級（OSM）", "Stars (OSM)", "星（OSM）"), kind: "num", digits: 0 }]),
  {
    key: "vnNationalTouristAreas", file: "vn_national_tourist_areas.pmtiles", sourceId: "vn-national-tourist-areas", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 63,
    parts: [pointPart("vn-national-tourist-areas-circle", "national_tourist_areas", 4, propGetter("status"), {
      hollow: { when: ["==", ["to-string", ["coalesce", ["get", "status"], ""]], "potential"], js: (p) => str(p.status) === "potential",
        label: l3("空心＝規劃（潛力）", "Hollow = planned (potential)", "白抜き＝計画（候補）") },
    })],
    cats: [
      cat("recognized", "#f59e0b", "已認證（9 處）", "Recognised (9)", "認定済み（9）", { radius: 6.5 }),
      cat("potential", "#f59e0b", "規劃潛力（54 處，空心）", "Planned / potential (54, hollow)", "計画候補（54、白抜き）", { radius: 6.5 }),
    ],
    title: { props: ["name"], fallback: l3("國家級旅遊區", "National tourist area", "国家観光区") },
    fields: [
      { prop: "status", label: l3("狀態", "Status", "状態"), map: KDLQG_STATUS },
      { prop: "province_listed", label: l3("清單所列省", "Province in the list", "一覧の省") },
      { prop: "macro_region", label: l3("區域", "Region", "地域") },
      { prop: "coord_source", label: l3("座標來源", "Coordinate source", "座標の出典"), map: { "vi.wikipedia": l3("越南文維基百科", "Vietnamese Wikipedia", "ベトナム語版ウィキペディア"), wikidata_p625: l3("Wikidata P625", "Wikidata P625", "Wikidata P625"), nominatim: l3("Nominatim（OSM）", "Nominatim (OSM)", "Nominatim（OSM）") } },
      { prop: "kdlqg_id", label: l3("清單編號", "List ID", "一覧番号"), kind: "code" },
      { prop: "wd_qid", label: l3("Wikidata", "Wikidata", "Wikidata"), kind: "code" },
      PROV,
    ],
    legendNotes: [
      l3("依維基百科整理，未對官方原文（QĐ 509/QĐ-TTg）", "Compiled from Wikipedia, not checked against the official decision (QĐ 509/QĐ-TTg)", "ウィキペディアから整理、公式原文（QĐ 509/QĐ-TTg）とは未照合"),
      l3("清單 70 處，定位 63；7 處未定位不畫（Lai Châu 2、Cao Bằng、Phú Thọ、Ninh Bình、Vĩnh Long、Cà Mau 各 1）", "70 listed, 63 located; 7 not located are not drawn (Lai Châu 2; Cao Bằng, Phú Thọ, Ninh Bình, Vĩnh Long, Cà Mau 1 each)", "一覧 70 件中 63 件を位置特定。未特定 7 件は描画しない（Lai Châu 2、Cao Bằng・Phú Thọ・Ninh Bình・Vĩnh Long・Cà Mau 各 1）"),
      l3("點是代表點，不是旅遊區範圍；不代表遊客量", "Points are representative locations, not area boundaries; not visitor numbers", "点は代表点で区域の範囲ではない。来訪者数ではない"),
      COVER(29),
    ],
    popupNotes: [NEAREST],
    sourceOrg: "Wikipedia tiếng Việt「Khu du lịch quốc gia」（CC BY-SA 4.0）；座標 vi.wikipedia／Wikidata（CC0）／Nominatim（© OpenStreetMap contributors，ODbL）",
    sourceUrl: "https://vi.wikipedia.org/wiki/Khu_du_l%E1%BB%8Bch_qu%E1%BB%91c_gia", license: "CC BY-SA 4.0＋CC0＋ODbL", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("國家級旅遊區", "national tourist areas"),
  },
];

// ═════════════════════════ 第 2 波：地名、共享運具、橋梁、停車 ═════════════════════════

const PLACE_CATS: readonly PhCat[] = [
  cat("city", "#f8fafc", "城市（city）", "City", "都市（city）", { radius: 5 }),
  cat("town", "#e5e7eb", "市鎮（town）", "Town", "町（town）", { radius: 4 }),
  cat("suburb", "#cbd5e1", "城區（suburb）", "Suburb", "市街区（suburb）", { radius: 3 }),
  cat("quarter", "#a5b4fc", "街區（quarter）", "Quarter", "街区（quarter）", { radius: 2.5 }),
  cat("neighbourhood", "#93c5fd", "鄰里（neighbourhood）", "Neighbourhood", "近隣（neighbourhood）", { radius: 2.5 }),
  cat("village", "#fcd34d", "村（village）", "Village", "村（village）", { radius: 2.5 }),
  cat("hamlet", "#fdba74", "小聚落（hamlet）", "Hamlet", "小集落（hamlet）", { radius: 2 }),
  cat("locality", "#d6d3d1", "地點（locality）", "Locality", "地点（locality）", { radius: 2 }),
];
const BRIDGE_CATS: readonly PhCat[] = [
  cat("major_road", "#f59e0b", "主要道路橋", "Major road bridge", "主要道路橋"),
  cat("minor_road", "#e5e7eb", "一般道路橋", "Minor road bridge", "一般道路橋"),
  cat("footway", "#86efac", "步道、人行橋", "Footway / path bridge", "歩道橋"),
  cat("railway", "#a78bfa", "鐵路橋", "Railway bridge", "鉄道橋"),
];

const W2_SPECS: Spec[] = [
  {
    key: "vnPlaceNames", file: "vn_place_names.pmtiles", sourceId: "vn-place-names", srcMinzoom: 5, srcMaxzoom: 14, color: "#e5e7eb", count: 22509,
    parts: [pointPart("vn-place-names-circle", "place_names", 5, propGetter("category"))],
    cats: PLACE_CATS, title: { props: ["name", "name_en"], fallback: l3("地名", "Place name", "地名") },
    fields: [NAME_EN, { prop: "name_vi", label: l3("越南文名", "Vietnamese name", "ベトナム語名"), unlessSameAs: "name" }, CATEGORY(PLACE_CATS),
      { prop: "population", label: l3("人口（OSM 標籤）", "Population (OSM tag)", "人口（OSM タグ）"), kind: "num" }, PROV],
    legendNotes: [OSM_NOTE,
      l3("依等級逐級出現：城市 z5、市鎮 z8、城區與村 z10、其餘 z12；名稱在彈窗（不畫文字標籤）", "Appears by rank: cities z5, towns z8, suburbs and villages z10, others z12; names in the popup (no text labels)", "等級ごとに表示：都市 z5、町 z8、市街区・村 z10、その他 z12。名称はポップアップ（文字ラベルなし）"),
      SPARSE("Phú Thọ、Cần Thơ")],
    popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: loading("地名", "place names"),
  },
  osmPoints("vnBicycleRental", "vn-bicycle-rental-circle", "vn_bicycle_rental.pmtiles", "bicycle_rental", 8, "#22d3ee", 177,
    [cat("bicycle_rental", "#22d3ee", "租借站", "Rental point", "レンタル拠点")], l3("自行車租借", "Bicycle rental", "レンタサイクル"),
    [l3("OSM 收錄，非營運商站點清單；多在都市", "Collected from OSM, not an operator station list; mostly in cities", "OSM 収録で事業者の拠点一覧ではない。主に都市部"), COVER(17),
      SPARSE("Cao Bằng、Điện Biên、Lai Châu、Sơn La、Thái Nguyên、Lạng Sơn、Quảng Ninh、Bắc Ninh、Phú Thọ、Hưng Yên、Thanh Hóa、Nghệ An、Hà Tĩnh、Quảng Ngãi、Tây Ninh、Đồng Tháp、Cà Mau")],
    loading("自行車租借", "bicycle rental"),
    [{ prop: "brand", label: l3("品牌", "Brand", "ブランド") }, OPERATOR, { prop: "capacity", label: l3("車位數（OSM）", "Capacity (OSM)", "台数（OSM）"), kind: "num" }]),
  {
    key: "vnBridges", file: "vn_bridges.pmtiles", sourceId: "vn-bridges", srcMinzoom: 8, srcMaxzoom: 14, color: "#f59e0b", count: 138439,
    parts: [{ id: "vn-bridges-line", sourceLayer: "bridges", geom: "line", minzoom: 8, cat: propGetter("category"),
      lineWidth: { major_road: [2.5, 4], minor_road: [1.5, 3], footway: [1, 2], railway: [2, 3.5] } }],
    cats: BRIDGE_CATS, title: { props: ["name", "bridge_name", "ref"], fallback: l3("橋梁（未命名）", "Bridge (unnamed)", "橋（名称なし）") },
    fields: [NAME_EN, CATEGORY(BRIDGE_CATS),
      { prop: "bridge", label: l3("橋型（OSM 原文）", "Bridge type (OSM tag)", "橋の種別（OSM 原文）"), kind: "code" },
      { prop: "highway", label: l3("道路等級（OSM 原文）", "Highway (OSM tag)", "道路種別（OSM 原文）"), kind: "code" },
      { prop: "railway", label: l3("鐵路（OSM 原文）", "Railway (OSM tag)", "鉄道（OSM 原文）"), kind: "code" },
      { prop: "ref", label: l3("路線編號", "Route ref", "路線番号"), kind: "code" }, PROV],
    legendNotes: [OSM_NOTE,
      l3("13.8 萬段橋梁（含高架）；主要道路與鐵路橋 z8 起、其餘 z12 起", "138,000 bridge segments (incl. viaducts); major road and railway bridges from z8, others from z12", "橋梁 13.8 万区間（高架含む）。主要道路・鉄道橋は z8 から、その他は z12 から")],
    popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: loading("橋梁", "bridges"),
  },
  osmPoints("vnParking", "vn-parking-circle", "vn_parking.pmtiles", "parking", 10, "#60a5fa", 3149,
    [cat("parking", "#60a5fa", "停車場", "Car park", "駐車場"), cat("motorcycle_parking", "#f472b6", "機車停車場", "Motorcycle parking", "バイク駐車場")],
    l3("停車場", "Car park", "駐車場"), [l3("面取代表點；74% 沒標停車型態", "Areas shown as representative points; 74% have no parking type tag", "面は代表点。74% は駐車形態のタグなし"), SPARSE("Điện Biên、Sơn La、Thái Nguyên、Tây Ninh、Đồng Tháp、Cà Mau")],
    loading("停車場", "parking"),
    [{ prop: "parking", label: l3("型態（OSM 原文）", "Type (OSM tag)", "形態（OSM 原文）"), kind: "code" },
      { prop: "access", label: l3("開放（OSM 原文）", "Access (OSM tag)", "利用（OSM 原文）"), kind: "code" },
      { prop: "fee", label: l3("收費（OSM 原文）", "Fee (OSM tag)", "料金（OSM 原文）"), kind: "code" },
      { prop: "capacity", label: l3("車位數（OSM）", "Capacity (OSM)", "台数（OSM）"), kind: "num" }, OPERATOR]),
];

// ═════════════════════════ 第 3 波：災害與水資源 ═════════════════════════

const GLIDE_CATS: readonly PhCat[] = [
  cat("flood", "#3b82f6", "洪水（FL）", "Flood (FL)", "洪水（FL）"),
  cat("flash_flood", "#06b6d4", "山洪（FF）", "Flash flood (FF)", "鉄砲水（FF）"),
  cat("tropical_cyclone", "#a855f7", "颱風（TC）", "Tropical cyclone (TC)", "台風（TC）"),
  cat("severe_storm", "#c084fc", "風暴（ST）", "Severe storm (ST)", "暴風雨（ST）"),
  cat("landslide", "#b45309", "崩塌（LS／SL）", "Landslide (LS / SL)", "土砂崩れ（LS・SL）"),
  cat("drought", "#f59e0b", "乾旱（DR）", "Drought (DR)", "干ばつ（DR）"),
  cat("epidemic", "#ef4444", "疫情（EP）", "Epidemic (EP)", "感染症（EP）"),
  cat("accident", "#94a3b8", "事故（AC）", "Accident (AC)", "事故（AC）"),
  cat("wildfire", "#f97316", "野火（WF）", "Wildfire (WF)", "山火事（WF）"),
];
const DAM_CATS: readonly PhCat[] = [
  cat("Hydroelectricity", "#60a5fa", "水力發電", "Hydropower", "水力発電", { parts: ["vn-dams-circle"] }),
  cat("Irrigation", "#4ade80", "灌溉", "Irrigation", "灌漑", { parts: ["vn-dams-circle"] }),
  cat("Flood control", "#f59e0b", "防洪", "Flood control", "治水", { parts: ["vn-dams-circle"] }),
  cat("reservoir", "#7dd3fc", "水庫面", "Reservoir", "貯水池", { parts: ["vn-reservoirs-fill"] }),
];
const RIVER_CATS: readonly PhCat[] = ["1", "2", "3", "4", "5", "6"].map((o, i) =>
  cat(o, ["#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1"][i]!, `第 ${o} 級`, `Order ${o}`, `${o} 次`));
/** 河岸侵蝕警戒等級：上游是機器英譯字串，照原字串對照。 */
const EROSION_CATS: readonly PhCat[] = [
  { id: "special_unfunded", values: ["Featuring dangerous no layout or design capital"], color: "#dc2626", label: l3("特別危險（未編列經費）", "Especially dangerous (no funding allocated)", "特に危険（予算未計上）") },
  { id: "special_planned", values: ["Featuring dangerous to plan allocating capital"], color: "#f97316", label: l3("特別危險（規劃編列經費）", "Especially dangerous (funding planned)", "特に危険（予算計画中）") },
  { id: "danger", values: ["The danger point"], color: "#facc15", label: l3("危險點", "Dangerous point", "危険箇所") },
  { id: "fast", values: ["The speed point landslide"], color: "#a855f7", label: l3("快速崩塌點", "Rapid erosion point", "急速な浸食箇所") },
  { id: "normal", values: ["The normal point"], color: "#94a3b8", label: l3("一般點", "Normal point", "一般箇所") },
  { id: "sediment", values: ["sedimentation"], color: "#60a5fa", label: l3("淤積", "Sedimentation", "堆積") },
];

const W3_SPECS: Spec[] = [
  {
    key: "vnGlideEvents", file: "vn_glide_events.pmtiles", sourceId: "vn-glide-events", srcMinzoom: 4, srcMaxzoom: 12, color: "#3b82f6", count: 181,
    parts: [pointPart("vn-glide-events-circle", "glide_events", 4, propGetter("category"))],
    cats: GLIDE_CATS, otherColor: "#cbd5e1", otherLabel: l3("其他（OT）", "Other (OT)", "その他（OT）"),
    title: { props: ["location", "glidenumber"], fallback: l3("災害事件", "Disaster event", "災害イベント") },
    fields: [
      { prop: "glidenumber", label: l3("GLIDE 編號", "GLIDE number", "GLIDE 番号"), kind: "code" },
      CATEGORY(GLIDE_CATS),
      { prop: "year", label: l3("年份", "Year", "年"), kind: "year" },
      { prop: "location", label: l3("地點（原文）", "Location (as published)", "場所（原文）") },
      { prop: "killed", label: l3("死亡", "Killed", "死者"), kind: "num" },
      { prop: "injured", label: l3("受傷", "Injured", "負傷者"), kind: "num" },
      { prop: "affected", label: l3("受影響", "Affected", "被災者"), kind: "num" },
      { prop: "comments", label: l3("說明（英文原文）", "Description (English)", "説明（英語原文）") },
      { prop: "source_url", label: l3("來源連結", "Source link", "出典リンク"), kind: "code" },
      PROV,
    ],
    legendNotes: [
      l3("省級代表點，不是淹水或受災範圍；14 筆颱風路徑面改用代表點、不畫南海", "Province-level representative points, not flood or impact extents; 14 cyclone-track polygons replaced by representative points, South China Sea not drawn", "省単位の代表点で、浸水・被災範囲ではない。台風経路の面 14 件は代表点に置換、南シナ海は描画しない"),
      l3("1990s–2026 共 181 筆；海上 30 km 外或落在鄰國的 10 筆不畫", "181 events, 1990s–2026; 10 more offshore beyond 30 km or in neighbouring countries are not drawn", "1990 年代〜2026 年の 181 件。30 km 以上沖合・隣国の 10 件は描画しない"),
      COVER(27),
    ],
    popupNotes: [NEAREST],
    sourceOrg: "GLIDEnumber（ADRC），via HDX Viet Nam - GLIDE Disaster Events", sourceUrl: "https://glidenumber.net/", license: "CC BY-IGO", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("災害事件", "disaster events"),
  },
  {
    key: "vnDams", file: "vn_dams.pmtiles", sourceId: "vn-dams", srcMinzoom: 4, srcMaxzoom: 13, color: "#60a5fa", count: 1049,
    parts: [
      { id: "vn-reservoirs-fill", sourceLayer: "reservoirs", geom: "fill", minzoom: 4, cat: constGetter("reservoir"), fillOpacity: 0.6 },
      pointPart("vn-dams-circle", "dams", 4, propGetter("main_use")),
    ],
    cats: DAM_CATS, otherColor: "#cbd5e1", otherLabel: l3("壩（用途未標）", "Dam (use not stated)", "ダム（用途未記載）"),
    title: { props: ["dam_name", "res_name"], fallback: l3("壩", "Dam", "ダム") },
    fields: [
      { prop: "res_name", label: l3("水庫名", "Reservoir", "貯水池名") },
      { prop: "river", label: l3("河川", "River", "河川") },
      { prop: "main_basin", label: l3("流域", "Basin", "流域") },
      { prop: "main_use", label: l3("主要用途", "Main use", "主な用途"), map: catMap(DAM_CATS) },
      { prop: "year_dam", label: l3("完工年", "Completed", "完成年"), kind: "year" },
      { prop: "dam_height_m", label: l3("壩高", "Dam height", "堤高"), kind: "num", unit: "m", digits: 0 },
      { prop: "dam_length_m", label: l3("壩長", "Dam length", "堤長"), kind: "num", unit: "m", digits: 0 },
      { prop: "capacity_mcm", label: l3("蓄水量", "Storage", "貯水量"), kind: "num", unit: "百萬 m³", digits: 1 },
      { prop: "power_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 0 },
      { prop: "area_km2", label: l3("水庫面積", "Reservoir area", "貯水池面積"), kind: "num", unit: "km²", digits: 1 },
      { prop: "quality", label: l3("位置品質（GDW）", "Location quality (GDW)", "位置品質（GDW）"), kind: "code" },
      PROV,
    ],
    legendNotes: [l3("壩 558 座＋水庫面 491 個；九成壩沒標用途（灰）", "558 dams plus 491 reservoir polygons; 90% of dams have no stated use (grey)", "ダム 558 基＋貯水池 491 面。9 割のダムは用途未記載（灰色）"), COVER(28)],
    popupNotes: [],
    sourceOrg: "Lehner et al. (2024) Global Dam Watch database v1.0（figshare）", sourceUrl: "https://www.globaldamwatch.org/", license: "CC BY 4.0", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("壩與水庫", "dams and reservoirs"),
  },
  {
    key: "vnRivers", file: "vn_rivers.pmtiles", sourceId: "vn-rivers", srcMinzoom: 4, srcMaxzoom: 12, color: "#38bdf8", count: 2013,
    parts: [{ id: "vn-rivers-line", sourceLayer: "rivers", geom: "line", minzoom: 4, cat: propGetter("order"),
      lineWidth: { 1: [0.8, 1.5], 2: [1, 2], 3: [1.3, 2.5], 4: [1.6, 3], 5: [2, 3.5], 6: [2.5, 4] } }],
    cats: RIVER_CATS, title: { props: ["name", "code"], fallback: l3("河川", "River", "河川") },
    fields: [
      { prop: "code", label: l3("代碼", "Code", "コード"), kind: "code" },
      { prop: "order", label: l3("河川級序", "Stream order", "河川次数"), kind: "num" },
      { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 1 },
    ],
    legendNotes: [l3("線寬依河川級序；名稱多為空", "Line width by stream order; most names are blank", "線幅は河川次数による。名称はほぼ空欄"),
      l3("ODM 彙編，資料年不明；授權未明示（ODM 標 CC BY-SA 4.0）", "Compiled by ODM, data year unknown; licence not stated (ODM lists CC BY-SA 4.0)", "ODM 編集、データ年不明。ライセンス未明示（ODM 表記は CC BY-SA 4.0）")],
    popupNotes: [],
    sourceOrg: ODM_SRC("River network of Viet Nam"), sourceUrl: ODM_URL, license: "CC BY-SA 4.0（ODM license_id；原始機關未載明）", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("河川", "rivers"),
  },
  osmPoints("vnWaterSupply", "vn-water-supply-circle", "vn_water_supply.pmtiles", "water_supply", 8, "#38bdf8", 241, [
    cat("water_works", "#38bdf8", "淨水場", "Water works", "浄水場"), cat("pumping_station", "#a78bfa", "抽水站", "Pumping station", "ポンプ場"),
    cat("water_tower", "#2dd4bf", "水塔", "Water tower", "給水塔"), cat("reservoir_covered", "#60a5fa", "配水池", "Covered reservoir", "配水池"),
  ], l3("自來水設施", "Water supply facility", "上水道施設"), [COVER(25), SPARSE("Cao Bằng、Điện Biên、Lai Châu、Sơn La、Lào Cai、Lạng Sơn、Hà Tĩnh、Quảng Ngãi、Cà Mau")],
  loading("自來水設施", "water supply facilities"), [OPERATOR]),
  osmPoints("vnWaterStructures", "vn-water-structures-circle", "vn_water_structures.pmtiles", "water_structures", 8, "#60a5fa", 1529, [
    cat("dam", "#60a5fa", "壩", "Dam", "ダム"), cat("weir", "#2dd4bf", "堰", "Weir", "堰"),
    cat("lock_gate", "#f59e0b", "船閘", "Lock gate", "閘門"), cat("sluice_gate", "#a78bfa", "水門", "Sluice gate", "水門"),
  ], l3("水利設施", "Water structure", "水利施設"), [l3("線與面取代表點", "Lines and areas shown as representative points", "線・面は代表点"),
    SPARSE("Hà Nội、Hải Phòng、Hồ Chí Minh、Tây Ninh、Đồng Tháp、Vĩnh Long、An Giang、Cần Thơ、Cà Mau")],
  loading("水利設施", "water structures"), [OPERATOR]),
  {
    key: "vnRiverbankErosion", file: "vn_riverbank_erosion.pmtiles", sourceId: "vn-riverbank-erosion", srcMinzoom: 5, srcMaxzoom: 14, color: "#f97316", count: 190,
    parts: [pointPart("vn-riverbank-erosion-circle", "riverbank_erosion", 5, propGetter("warning_level"))],
    cats: EROSION_CATS, title: { props: ["site", "locality"], fallback: l3("河岸與海岸侵蝕點", "Erosion point", "浸食箇所") },
    fields: [
      { prop: "locality", label: l3("地點（英譯）", "Locality (translated)", "場所（英訳）") },
      { prop: "warning_level", label: l3("警戒等級", "Warning level", "警戒レベル"), map: catMap(EROSION_CATS) },
      { prop: "description", label: l3("說明（機器英譯）", "Description (machine-translated)", "説明（機械英訳）") },
      PROV,
    ],
    legendNotes: [l3("約 2016–2020 舊資料、說明為機器英譯；等級名稱依英譯意譯", "Old data (about 2016–2020), descriptions machine-translated; level names interpreted from the translation", "2016〜2020 年頃の旧データで説明は機械英訳。等級名は英訳から意訳"),
      l3("授權未明示（ODM 標 CC BY-SA 4.0）", "Licence not stated (ODM lists CC BY-SA 4.0)", "ライセンス未明示（ODM 表記は CC BY-SA 4.0）"), COVER(32)],
    popupNotes: [NEAREST],
    sourceOrg: ODM_SRC("Landslide points over whole country"), sourceUrl: ODM_URL, license: "CC BY-SA 4.0（ODM license_id；原始機關未載明）", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("河岸與海岸侵蝕點", "riverbank and coastal erosion points"),
  },
];

// ═════════════════════════ 第 4 波：教育、醫療、治安 ═════════════════════════

const SCHOOL_CATS: readonly PhCat[] = [
  cat("school", "#facc15", "中小學", "School", "小中高校"), cat("college", "#fb923c", "學院、專科", "College", "カレッジ・専門学校"), cat("university", "#ef4444", "大學", "University", "大学"),
];
const CAMPUS_CATS: readonly PhCat[] = [...SCHOOL_CATS, cat("kindergarten", "#f9a8d4", "幼兒園", "Kindergarten", "幼稚園")];
const OP_TYPE: PhField = { prop: "operator_type", label: l3("設立別（OSM 原文）", "Operator type (OSM tag)", "設置者区分（OSM 原文）"), kind: "code" };

const W4_SPECS: Spec[] = [
  osmPoints("vnSchools", "vn-schools-circle", "vn_schools.pmtiles", "schools", 7, "#facc15", 9879, SCHOOL_CATS, l3("學校", "School", "学校"),
    [l3("面取代表點；幼兒園另成一層", "Areas shown as representative points; kindergartens are a separate layer", "面は代表点。幼稚園は別レイヤー"), SPARSE("Sơn La、Nghệ An")], loading("學校", "schools"),
    [{ prop: "isced_level", label: l3("ISCED 等級（OSM）", "ISCED level (OSM)", "ISCED レベル（OSM）"), kind: "code" }, OP_TYPE, OPERATOR]),
  {
    key: "vnSchoolCampuses", file: "vn_school_campuses.pmtiles", sourceId: "vn-school-campuses", srcMinzoom: 11, srcMaxzoom: 15, color: "#facc15", count: 9695, opacity: 0.7,
    parts: [
      { id: "vn-school-campuses-fill", sourceLayer: "school_campuses", geom: "fill", minzoom: 11, cat: propGetter("category"), fillOpacity: 0.5 },
      { id: "vn-school-campuses-line", sourceLayer: "school_campuses", geom: "line", minzoom: 11, cat: propGetter("category") },
    ],
    cats: CAMPUS_CATS, title: { props: ["name", "name_en"], fallback: l3("校地", "Campus", "校地") },
    fields: [NAME_EN, CATEGORY(CAMPUS_CATS), OP_TYPE, OPERATOR, PROV],
    legendNotes: [OSM_NOTE, l3("校地面 9,695 個；z11 起顯示", "9,695 campus polygons; shown from z11", "校地 9,695 面。z11 から表示"), SPARSE("Sơn La、Nghệ An")],
    popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: loading("校地", "school campuses"),
  },
  osmPoints("vnKindergartens", "vn-kindergartens-circle", "vn_kindergartens.pmtiles", "kindergartens", 9, "#f9a8d4", 1729,
    [cat("kindergarten", "#f9a8d4", "幼兒園", "Kindergarten", "幼稚園"), cat("childcare", "#c084fc", "托育", "Childcare", "保育施設")],
    l3("幼兒園", "Kindergarten", "幼稚園"), [COVER(33), SPARSE("Sơn La、Lào Cai、Nghệ An、Hà Tĩnh")], loading("幼兒園", "kindergartens"), [OP_TYPE, OPERATOR]),
  osmPoints("vnHealthFacilities", "vn-health-facilities-circle", "vn_health_facilities.pmtiles", "health_facilities", 7, "#ef4444", 6117, [
    cat("hospital", "#ef4444", "醫院", "Hospital", "病院"), cat("clinic", "#f97316", "診所", "Clinic", "診療所"), cat("pharmacy", "#4ade80", "藥局", "Pharmacy", "薬局"),
    cat("dentist", "#60a5fa", "牙科", "Dentist", "歯科"),
  ], l3("醫療院所", "Health facility", "医療機関"),
  [l3("官方醫院名冊未公開，只有 OSM", "No official hospital register is published; OSM only", "公式の病院名簿は非公開で、OSM のみ")], loading("醫療院所", "health facilities"),
  [{ prop: "healthcare", label: l3("醫療類型（OSM 原文）", "Healthcare (OSM tag)", "医療種別（OSM 原文）"), kind: "code" },
    { prop: "emergency", label: l3("急診（OSM 原文）", "Emergency (OSM tag)", "救急（OSM 原文）"), kind: "code" }, OP_TYPE, OPERATOR],
  { otherColor: "#cbd5e1", otherLabel: l3("其他（醫師、安寧等）", "Other (doctors, hospice…)", "その他（医師・ホスピスなど）") }),
  osmPoints("vnPolice", "vn-police-circle", "vn_police.pmtiles", "police", 8, "#3b82f6", 1135, [cat("police", "#3b82f6", "警察", "Police", "警察")],
    l3("警察據點", "Police", "警察拠点"), [COVER(33), SPARSE("Sơn La、Phú Thọ、Nghệ An")], loading("警察據點", "police"), [OPERATOR]),
  osmPoints("vnCourtsPrisons", "vn-courts-prisons-circle", "vn_courts_prisons.pmtiles", "courts_prisons", 7, "#a78bfa", 289,
    [cat("courthouse", "#a78bfa", "法院", "Courthouse", "裁判所"), cat("prison", "#f87171", "監所", "Prison", "刑務所")],
    l3("法院與監所", "Court / prison", "裁判所・刑務所"), [COVER(31), SPARSE("Sơn La、Lạng Sơn、Thanh Hóa、Nghệ An、Huế")], loading("法院與監所", "courts and prisons"), [OPERATOR]),
];

// ═════════════════════════ 第 5 波：公共服務與宗教 ═════════════════════════

const W5_SPECS: Spec[] = [
  osmPoints("vnPostalServices", "vn-postal-services-circle", "vn_postal_services.pmtiles", "postal_services", 9, "#f59e0b", 12081, [
    cat("post_office", "#ef4444", "郵局", "Post office", "郵便局"), cat("convenience", "#f59e0b", "便利商店", "Convenience store", "コンビニ"),
    cat("supermarket", "#4ade80", "超市", "Supermarket", "スーパー"), cat("marketplace", "#fb923c", "傳統市場", "Market", "市場"),
    cat("mall", "#c084fc", "購物中心", "Shopping mall", "ショッピングモール"), cat("townhall", "#60a5fa", "廳舍（人民委員會）", "Town hall (People's Committee)", "庁舎（人民委員会）"),
  ], l3("郵政與便民據點", "Postal & service point", "郵便・生活拠点"),
  [l3("便利商店 6,950、市場 1,723、超市 1,437、廳舍 1,055、郵局 654、購物中心 262", "6,950 convenience stores, 1,723 markets, 1,437 supermarkets, 1,055 town halls, 654 post offices, 262 malls", "コンビニ 6,950・市場 1,723・スーパー 1,437・庁舎 1,055・郵便局 654・モール 262"),
    SPARSE("Sơn La、Thanh Hóa、Nghệ An、Cà Mau")], loading("郵政與便民據點", "postal and service points"),
  [{ prop: "brand", label: l3("品牌", "Brand", "ブランド") }, OPERATOR]),
  osmPoints("vnPublicAmenities", "vn-public-amenities-circle", "vn_public_amenities.pmtiles", "public_amenities", 10, "#2dd4bf", 1316, [
    cat("toilets", "#2dd4bf", "公廁", "Toilets", "公衆トイレ"), cat("drinking_water", "#38bdf8", "飲水機", "Drinking water", "給水所"),
    cat("waste_disposal", "#a8a29e", "垃圾桶、收集點", "Waste disposal", "ごみ箱・集積所"), cat("recycling", "#4ade80", "回收點", "Recycling", "リサイクル"),
  ], l3("公共設施", "Public amenity", "公共設備"), [COVER(33), SPARSE("Sơn La、Thái Nguyên、Thanh Hóa、Nghệ An、Hà Tĩnh、Đồng Tháp、Vĩnh Long、Cà Mau")],
  loading("公共設施", "public amenities"),
  [{ prop: "fee", label: l3("收費（OSM 原文）", "Fee (OSM tag)", "料金（OSM 原文）"), kind: "code" }, { prop: "access", label: l3("開放（OSM 原文）", "Access (OSM tag)", "利用（OSM 原文）"), kind: "code" }]),
  osmPoints("vnFinancialServices", "vn-financial-services-circle", "vn_financial_services.pmtiles", "financial_services", 9, "#4ade80", 5962, [
    cat("bank", "#4ade80", "銀行", "Bank", "銀行"), cat("atm", "#a3e635", "ATM", "ATM", "ATM"), cat("bureau_de_change", "#facc15", "外幣兌換", "Currency exchange", "両替所"),
  ], l3("金融據點", "Financial service", "金融拠点"), [SPARSE("Sơn La、Phú Thọ、Thanh Hóa、Cà Mau")], loading("金融據點", "financial services"),
  [{ prop: "brand", label: l3("品牌", "Brand", "ブランド") }, OPERATOR]),
  osmPoints("vnPlacesOfWorship", "vn-places-of-worship-circle", "vn_places_of_worship.pmtiles", "places_of_worship", 8, "#fbbf24", 7449, [
    cat("buddhist", "#fbbf24", "佛教", "Buddhist", "仏教"), cat("christian", "#60a5fa", "基督宗教", "Christian", "キリスト教"),
    cat("caodaism", "#f472b6", "高台教", "Cao Đài", "カオダイ教"), cat("taoist", "#a78bfa", "道教", "Taoist", "道教"),
    cat("muslim", "#4ade80", "伊斯蘭", "Muslim", "イスラム教"), cat("hindu", "#fb923c", "印度教", "Hindu", "ヒンドゥー教"),
    cat("confucian", "#f87171", "儒教（文廟）", "Confucian", "儒教"),
    cat("other", "#d6d3d1", "民間信仰與其他（亭、廟）", "Folk religion & other", "民間信仰・その他"),
    cat("unspecified", "#94a3b8", "未標宗教", "Religion not tagged", "宗教未記載"),
  ], l3("宗教場所", "Place of worship", "宗教施設"), [l3("未標宗教不由名稱猜；面取代表點", "Untagged religion is not guessed from names; areas as representative points", "宗教未記載は名称から推測しない。面は代表点"), COVER(33),
    SPARSE("Tuyên Quang、Điện Biên、Lai Châu、Sơn La、Thanh Hóa、Nghệ An")], loading("宗教場所", "places of worship"),
  [{ prop: "religion", label: l3("宗教（OSM 原文）", "Religion (OSM tag)", "宗教（OSM 原文）"), kind: "code" }, { prop: "denomination", label: l3("宗派（OSM 原文）", "Denomination (OSM tag)", "宗派（OSM 原文）"), kind: "code" }]),
];

// ═════════════════════════ 第 6 波：公園與保護區 ═════════════════════════

const PARK_CATS: readonly PhCat[] = [
  cat("park", "#4ade80", "公園", "Park", "公園"), cat("garden", "#a3e635", "庭園", "Garden", "庭園"), cat("playground", "#fbbf24", "遊戲場", "Playground", "遊び場"),
];
const PA_CATS: readonly PhCat[] = [
  { id: "np", values: ["Vườn quốc gia"], color: "#16a34a", label: l3("國家公園", "National park", "国立公園") },
  { id: "nr", values: ["Khu bảo tồn thiên nhiên"], color: "#4ade80", label: l3("自然保護區", "Nature reserve", "自然保護区") },
  { id: "species", values: ["Khu bảo tồn loài và sinh cảnh"], color: "#2dd4bf", label: l3("物種與棲地保護區", "Species & habitat reserve", "種・生息地保護区") },
  { id: "landscape", values: ["Khu bảo vệ cảnh quan"], color: "#a3e635", label: l3("景觀保護區", "Landscape protection area", "景観保護区") },
  { id: "wetland", values: ["Vùng đất ngập nước"], color: "#38bdf8", label: l3("濕地", "Wetland", "湿地") },
  { id: "special", values: ["Rừng đặc dụng"], color: "#86efac", label: l3("特用林", "Special-use forest", "特別用途林") },
];

const W6_SPECS: Spec[] = [
  {
    key: "vnParks", file: "vn_parks.pmtiles", sourceId: "vn-parks", srcMinzoom: 9, srcMaxzoom: 15, color: "#4ade80", count: 6061, opacity: 0.75,
    parts: [
      { id: "vn-parks-fill", sourceLayer: "parks", geom: "fill", minzoom: 9, cat: propGetter("category"), fillOpacity: 0.55 },
      pointPart("vn-parks-circle", "points", 9, propGetter("category")),
    ],
    cats: PARK_CATS, title: { props: ["name", "name_en"], fallback: l3("公園", "Park", "公園") },
    fields: [NAME_EN, CATEGORY(PARK_CATS), { prop: "access", label: l3("開放（OSM 原文）", "Access (OSM tag)", "利用（OSM 原文）"), kind: "code" }, OPERATOR, PROV],
    legendNotes: [OSM_NOTE, l3("公園、庭園、遊戲場面 5,669＋只有點的 392；z9 起顯示", "5,669 park / garden / playground polygons + 392 point-only; shown from z9", "公園・庭園・遊び場の面 5,669＋点のみ 392。z9 から表示"),
      SPARSE("Tuyên Quang、Sơn La、Thái Nguyên、Lạng Sơn、Nghệ An、Cà Mau")],
    popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: loading("公園", "parks"),
  },
  {
    key: "vnProtectedAreasOdm", file: "vn_protected_areas_odm.pmtiles", sourceId: "vn-protected-areas-odm", srcMinzoom: 4, srcMaxzoom: 12, color: "#16a34a", count: 171, opacity: 0.6,
    parts: [
      { id: "vn-protected-areas-odm-fill", sourceLayer: "protected_areas", geom: "fill", minzoom: 4, cat: propGetter("pa_type"), fillOpacity: 0.5 },
      { id: "vn-protected-areas-odm-line", sourceLayer: "protected_areas", geom: "line", minzoom: 4, cat: propGetter("pa_type") },
    ],
    cats: PA_CATS, title: { props: ["name"], fallback: l3("保護區", "Protected area", "保護区") },
    fields: [
      { prop: "pa_type", label: l3("類型", "Type", "種別"), map: catMap(PA_CATS) },
      { prop: "iucn_cat_vi", label: l3("類型（越南文原文）", "Type (Vietnamese)", "種別（ベトナム語原文）") },
      { prop: "location_type", label: l3("位置", "Location", "位置"), map: { "Nằm trên đất liền": l3("陸域", "Inland", "陸域"), "Nằm dọc bờ biển": l3("沿岸", "Coastal", "沿岸"), "Nằm ngoài biển": l3("海上", "Marine", "海上") } },
      { prop: "status", label: l3("狀態", "Status", "状態"), map: { "Đã được chỉ rõ": l3("已劃定", "Designated", "指定済み"), "Đã được đề xuất": l3("提案", "Proposed", "提案") } },
      { prop: "year_proposed", label: l3("年份", "Year", "年"), kind: "year" },
      { prop: "manager", label: l3("管理機關", "Manager", "管理機関") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
    ],
    legendNotes: [
      l3("非商用（ODM 頁面使用限制）；上游 WDPA 2016（經 ADB）", "Non-commercial (ODM usage restriction); upstream WDPA 2016 (via ADB)", "非商用（ODM の利用制限）。上流は WDPA 2016（ADB 経由）"),
      l3("171 區（同名同型別合併）；國家公園 32 個名稱（官方 34）；沿岸與海上者對應海洋保護區", "171 areas (same name and type merged); 32 national-park names (34 official); coastal and marine ones are the marine protected areas", "171 区域（同名同種別を統合）。国立公園は 32 名称（公式 34）。沿岸・海上は海洋保護区に相当"),
    ],
    popupNotes: [],
    sourceOrg: "Open Development Vietnam 彙編（NGO）；上游 IUCN and UNEP-WCMC, WDPA July 2016（via ADB）", sourceUrl: ODM_URL, license: "非商用（ODM 使用限制；API license_id CC-BY-4.0 不一致，從嚴）", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("保護區（ODM）", "protected areas (ODM)"),
  },
];

// ═════════════════════════ 第 7 波：農業、土壤、礦業 ═════════════════════════

const AQUA_CATS: readonly PhCat[] = [
  { id: "LUA_TOM", values: ["LUA_TOM"], color: "#f472b6", label: l3("稻＋養蝦", "Rice + shrimp", "稲＋エビ養殖") },
  { id: "LUA_CA", values: ["LUA_CA"], color: "#a3e635", label: l3("兩季稻＋養魚", "Two rice crops + fish", "二期作＋魚養殖") },
  { id: "NTTS_TOM", values: ["NTTS_TOM"], color: "#ef4444", label: l3("專業養蝦", "Shrimp farming", "エビ専業養殖") },
  { id: "NTTS_LUA", values: ["NTTS_LUA"], color: "#fb923c", label: l3("養蝦＋種稻", "Shrimp + rice", "エビ養殖＋稲") },
  { id: "NTTS_CA", values: ["NTTS_CA"], color: "#38bdf8", label: l3("養魚", "Fish farming", "魚養殖") },
  { id: "NTTS_BIEN", values: ["NTTS_BIEN"], color: "#818cf8", label: l3("海上養殖", "Marine aquaculture", "海面養殖") },
  { id: "NTTS_OTHER", values: ["NTTS_BAIGIONG", "NTTS_NGOCTRAI"], color: "#facc15", label: l3("種苗場、珍珠養殖", "Seed beds / pearl farming", "種苗場・真珠養殖") },
];
const SOIL_CATS: readonly PhCat[] = [
  cat("A", "#d97706", "強酸性淋溶土（Acrisols，A）", "Acrisols (A)", "アクリソル（A）"),
  cat("F", "#b91c1c", "鐵鋁土（Ferralsols，F）", "Ferralsols (F)", "フェラルソル（F）"),
  cat("G", "#60a5fa", "潛育土（Gleysols，G）", "Gleysols (G)", "グライソル（G）"),
  cat("J", "#a3e635", "沖積土（Fluvisols，J）", "Fluvisols (J)", "フルビソル（J）"),
  cat("R", "#e7e5e4", "粗骨土（Regosols，R）", "Regosols (R)", "レゴソル（R）"),
  cat("I", "#a8a29e", "石質土（Lithosols，I）", "Lithosols (I)", "リソソル（I）"),
  cat("V", "#57534e", "變性土（Vertisols，V）", "Vertisols (V)", "バーティソル（V）"),
  cat("L", "#f59e0b", "淋溶土（Luvisols，L）", "Luvisols (L)", "ルビソル（L）"),
  cat("O", "#3f6212", "有機土（Histosols，O）", "Histosols (O)", "ヒストソル（O）"),
];
const TRACK_CATS: readonly PhCat[] = [
  cat("grade1", "#fbbf24", "1 級（鋪面）", "Grade 1 (paved)", "1 級（舗装）"),
  cat("grade2", "#f59e0b", "2 級（碎石）", "Grade 2 (gravel)", "2 級（砂利）"),
  cat("grade3", "#d97706", "3 級（混合）", "Grade 3 (mixed)", "3 級（混合）"),
  cat("grade4", "#b45309", "4 級（土質為主）", "Grade 4 (mostly soil)", "4 級（主に土）"),
  cat("grade5", "#92400e", "5 級（土路）", "Grade 5 (soil)", "5 級（土）"),
  cat("unspecified", "#d6d3d1", "未標等級", "Grade not tagged", "等級未記載"),
];
const COAL_CATS: readonly PhCat[] = [
  cat("Operating", "#ef4444", "運轉中", "Operating", "操業中"), cat("Proposed", "#f59e0b", "提案", "Proposed", "提案"),
  cat("Mothballed", "#a8a29e", "封存", "Mothballed", "休止"), cat("Cancelled", "#64748b", "取消", "Cancelled", "中止"),
];

const W7_SPECS: Spec[] = [
  {
    key: "vnAngiangAquaculture", file: "vn_angiang_aquaculture_v2.pmtiles", sourceId: "vn-angiang-aquaculture", srcMinzoom: 8, srcMaxzoom: 14, color: "#f472b6", count: 9504, opacity: 0.7,
    parts: [{ id: "vn-angiang-aquaculture-fill", sourceLayer: "aquaculture", geom: "fill", minzoom: 8, cat: propGetter("type_code") }],
    cats: AQUA_CATS, title: { props: ["land_use"], fallback: l3("養殖用地", "Aquaculture land", "養殖用地") },
    fields: [
      { prop: "type_code", label: l3("分區類別", "Zone type", "区分"), map: catMap(AQUA_CATS) },
      { prop: "land_use", label: l3("分區類別（越南文原文）", "Zone type (Vietnamese)", "区分（ベトナム語原文）") },
      { prop: "old_commune", label: l3("舊社（改制前）", "Former commune", "旧社（再編前）") },
      { prop: "old_district", label: l3("舊縣（改制前）", "Former district", "旧県（再編前）") },
      PROV,
    ],
    legendNotes: [
      l3("只涵蓋安江省（原堅江範圍），其他 33 省未涵蓋", "Covers An Giang only (former Kiên Giang area); the other 33 provinces are not covered", "An Giang 省（旧 Kiên Giang の範囲）のみ。他の 33 省は未収録"),
      l3("只標位置與分區類別；面積、產量等數值不顯示", "Location and zone type only; area, output and other figures are not shown", "位置と区分のみ。面積・生産量などの数値は表示しない"),
      l3("來源 安江省開放資料入口，授權未明示", "Source An Giang open data portal, licence not stated", "出典 An Giang 省オープンデータポータル、ライセンス未明示"),
    ],
    popupNotes: [],
    sourceOrg: "Sở Nông nghiệp và Môi trường tỉnh An Giang（opendata.angiang.gov.vn）", sourceUrl: "https://opendata.angiang.gov.vn/", license: "授權未明示", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("安江養殖用地", "An Giang aquaculture"),
  },
  {
    key: "vnFieldBoundaries", file: "vn_field_boundaries.pmtiles", sourceId: "vn-field-boundaries", srcMinzoom: 10, srcMaxzoom: 15, color: "#a3e635", count: 120913, opacity: 0.8,
    parts: [
      { id: "vn-field-boundaries-fill", sourceLayer: "field_boundaries", geom: "fill", minzoom: 10, cat: constGetter("field"), fillOpacity: 0.25 },
      { id: "vn-field-boundaries-line", sourceLayer: "field_boundaries", geom: "line", minzoom: 10, cat: constGetter("field"), lineWidth: { field: [0.6, 1.2] } },
    ],
    cats: [cat("field", "#a3e635", "農田邊界（AI 判讀）", "Field boundary (AI-detected)", "農地境界（AI 判読）")],
    title: { props: ["id"], fallback: l3("農田", "Field", "農地") },
    fields: [
      { prop: "area_m2", label: l3("面積", "Area", "面積"), kind: "num", unit: "m²", digits: 0 },
      { prop: "determination_datetime", label: l3("判讀影像日期", "Imagery date", "判読画像の日付"), kind: "code" },
      PROV,
    ],
    legendNotes: [
      l3("30 個樣本圖磚（約 5×5 km），非全國；12.1 萬塊田", "30 sample tiles (about 5×5 km each), not nationwide; 121,000 fields", "サンプル 30 タイル（各約 5×5 km）で全国ではない。農地 12.1 万区画"),
      l3("涵蓋省數只代表樣本落點；z10 起顯示", "Province coverage reflects sample locations only; shown from z10", "省のカバーはサンプル位置のみ。z10 から表示"),
    ],
    popupNotes: [],
    sourceOrg: "Fields of The World（Kerner Lab et al.），AI4SmallFarms Vietnam subset", sourceUrl: "https://fieldsofthe.world/", license: "CC BY 4.0", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("農田邊界樣本", "field boundary samples"),
  },
  {
    key: "vnSoil", file: "vn_soil.pmtiles", sourceId: "vn-soil", srcMinzoom: 4, srcMaxzoom: 11, color: "#d97706", count: 230, opacity: 0.6,
    parts: [{ id: "vn-soil-fill", sourceLayer: "soil", geom: "fill", minzoom: 4, cat: propGetter("fao_group") }],
    cats: SOIL_CATS, title: { props: ["soil_type_vi"], fallback: l3("土壤", "Soil", "土壌") },
    fields: [
      { prop: "fao_group", label: l3("FAO 大類", "FAO major group", "FAO 大分類"), map: catMap(SOIL_CATS) },
      { prop: "dom_soil", label: l3("主要土壤（FAO 代碼）", "Dominant soil (FAO code)", "主な土壌（FAO コード）"), kind: "code" },
      { prop: "fao_soil", label: l3("土壤單元（FAO 原文）", "Soil unit (FAO)", "土壌単位（FAO 原文）"), kind: "code" },
    ],
    legendNotes: [
      l3("小比例尺參考圖（230 面），不適合地塊判讀", "Small-scale reference map (230 polygons), not for parcel-level use", "小縮尺の参考図（230 面）で、区画単位の判読には不向き"),
      l3("授權未明示（ODM 標 CC BY-SA 4.0）", "Licence not stated (ODM lists CC BY-SA 4.0)", "ライセンス未明示（ODM 表記は CC BY-SA 4.0）"),
    ],
    popupNotes: [],
    sourceOrg: ODM_SRC("Soil types of Vietnam"), sourceUrl: ODM_URL, license: "CC BY-SA 4.0（ODM 頁面；原始機關未載明）", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("土壤", "soil"),
  },
  {
    key: "vnFarmTracks", file: "vn_farm_tracks.pmtiles", sourceId: "vn-farm-tracks", srcMinzoom: 10, srcMaxzoom: 14, color: "#d97706", count: 145862,
    parts: [{ id: "vn-farm-tracks-line", sourceLayer: "farm_tracks", geom: "line", minzoom: 10, cat: propGetter("category") }],
    cats: TRACK_CATS, otherColor: "#d6d3d1", otherLabel: l3("其他", "Other", "その他"),
    title: { props: ["name", "name_en"], fallback: l3("農林道", "Track", "農林道") },
    fields: [NAME_EN, CATEGORY(TRACK_CATS),
      { prop: "surface", label: l3("路面（OSM 原文）", "Surface (OSM tag)", "路面（OSM 原文）"), kind: "code" },
      { prop: "access", label: l3("通行（OSM 原文）", "Access (OSM tag)", "通行（OSM 原文）"), kind: "code" }, PROV],
    legendNotes: [OSM_NOTE, l3("highway=track 14.6 萬段（96% 未標等級）；z10 起顯示", "146,000 highway=track segments (96% without grade); shown from z10", "highway=track 14.6 万区間（96% は等級なし）。z10 から表示"),
      SPARSE("Thái Nguyên、Hưng Yên、Ninh Bình、Thanh Hóa、Hồ Chí Minh、Tây Ninh、Vĩnh Long、An Giang、Cần Thơ、Cà Mau")],
    popupNotes: [NEAREST],
    sourceOrg: OSM_SRC, sourceUrl: OSM_URL, license: ODBL, fetchedAt: VN_WAVES_FETCHED_AT, loading: loading("農林道", "farm tracks"),
  },
  {
    key: "vnCoalMines", file: "vn_coal_mines.pmtiles", sourceId: "vn-coal-mines", srcMinzoom: 5, srcMaxzoom: 14, color: "#ef4444", count: 32,
    parts: [pointPart("vn-coal-mines-circle", "coal_mines", 5, propGetter("status"))],
    cats: COAL_CATS, otherColor: "#cbd5e1", otherLabel: l3("狀態未標", "Status not stated", "状態未記載"),
    title: { props: ["name"], fallback: l3("煤礦", "Coal mine", "炭鉱") },
    fields: [
      { prop: "status", label: l3("狀態", "Status", "状態"), map: catMap(COAL_CATS) },
      { prop: "mine_type", label: l3("礦場類型（GEM 原文）", "Mine type (GEM)", "鉱山の種別（GEM 原文）"), kind: "code" },
      { prop: "coal_type", label: l3("煤種（GEM 原文）", "Coal type (GEM)", "炭種（GEM 原文）"), kind: "code" },
      { prop: "mining_method", label: l3("採掘方法（GEM 原文）", "Mining method (GEM)", "採掘方法（GEM 原文）"), kind: "code" },
      { prop: "capacity_mtpa", label: l3("年產能", "Capacity", "年間生産能力"), kind: "num", unit: "Mtpa", digits: 2 },
      { prop: "production_mtpa", label: l3("年產量", "Production", "年間生産量"), kind: "num", unit: "Mtpa", digits: 2 },
      { prop: "production_year", label: l3("產量年份", "Production year", "生産量の年"), kind: "year" },
      { prop: "opening_year", label: l3("開礦年", "Opened", "開山年"), kind: "year" },
      { prop: "owners", label: l3("所有者", "Owners", "所有者") },
      { prop: "coalfield", label: l3("煤田", "Coalfield", "炭田") },
      { prop: "location_accuracy", label: l3("位置精度", "Location accuracy", "位置精度"), map: { Exact: l3("精確", "Exact", "正確"), Approximate: l3("近似", "Approximate", "概略") } },
      PROV,
    ],
    legendNotes: [l3("只有 GEM 煤礦 32 處（含已關閉）；其他礦區與礦業權圖資未找到", "Only 32 GEM coal mines (including closed); no other mine or mining-right maps found", "GEM の炭鉱 32 か所のみ（閉山含む）。その他の鉱区・鉱業権の図は見つからない"), COVER(6)],
    popupNotes: [],
    sourceOrg: "Global Energy Monitor，Global Coal Mine Tracker（2026-05 release）", sourceUrl: "https://globalenergymonitor.org/projects/global-coal-mine-tracker/", license: "CC BY 4.0", fetchedAt: VN_WAVES_FETCHED_AT,
    loading: loading("煤礦", "coal mines"),
  },
];

export const VN_WAVE_SPECS: readonly Spec[] = [...TOURISM_SPECS, ...W2_SPECS, ...W3_SPECS, ...W4_SPECS, ...W5_SPECS, ...W6_SPECS, ...W7_SPECS];

// ═════════════════════════ Raster 4 層 ═════════════════════════

export interface VnRasterSpec {
  key: VnRasterKey;
  /** pmtiles＝公開 PNG PMTiles；owner＝站主限定 owner-data PNG PMTiles */
  kind: "pmtiles" | "owner";
  file: string;
  sourceId: string;
  layerId: string;
  minzoom: number;
  maxzoom: number;
  opacity: number;
  /** 色帶（steps）或分類色塊（swatches）；都省略＝山體陰影明暗漸層 */
  steps?: readonly { color: string; label: string }[];
  swatches?: readonly { color: string; label: L3; outline?: boolean }[];
  notes: readonly L3[];
  sourceShort: string;
  loading: string;
}

/** WDPCA raster 類別色（與 analytics pipelines/misc/vn/08_wdpca_raster.py 的 FILLS／OUTLINES 同步）。 */
export const VN_WDPCA_RASTER_SWATCHES: NonNullable<VnRasterSpec["swatches"]> = [
  { color: "#16a34a", label: l3("國家公園", "National park", "国立公園") },
  { color: "#4ade80", label: l3("自然保護區", "Nature reserve", "自然保護区") },
  { color: "#a3e635", label: l3("景觀與文化保護區", "Landscape / cultural protected area", "景観・文化保護区") },
  { color: "#38bdf8", label: l3("海洋保護區", "Marine protected area", "海洋保護区") },
  { color: "#2dd4bf", label: l3("Ramsar 國際重要濕地", "Ramsar wetland", "ラムサール条約湿地") },
  { color: "#94a3b8", label: l3("其他", "Other", "その他") },
  { color: "#facc15", label: l3("生物圈保留區（外框）", "Biosphere reserve (outline)", "生物圏保存地域（外枠）"), outline: true },
  { color: "#fb923c", label: l3("世界遺產（外框）", "World Heritage (outline)", "世界遺産（外枠）"), outline: true },
];

const COPERNICUS = "© DLR e.V. 2010-2014／© Airbus Defence and Space GmbH 2014-2018，Copernicus DEM GLO-90（ESA／EU）";
export const VN_RASTER_SPECS: readonly VnRasterSpec[] = [
  {
    key: "vnTerrainHillshade", kind: "pmtiles", file: "vn_terrain_hillshade.pmtiles", sourceId: "vn-terrain-hillshade", layerId: "vn-terrain-hillshade-raster", minzoom: 5, maxzoom: 10, opacity: 0.5,
    notes: [l3("Copernicus DEM GLO-90（約 90 m）山體陰影；只保留越南陸域（鄰國、海面、南海島礁透明），z10 以上放大沿用", "Copernicus DEM GLO-90 (about 90 m) hillshade; Vietnamese land only (neighbours, sea and South China Sea islands transparent); overzoomed above z10", "Copernicus DEM GLO-90（約 90 m）陰影起伏。ベトナム陸域のみ（隣国・海面・南シナ海の島は透明）、z10 以上は拡大表示")],
    sourceShort: COPERNICUS, loading: "越南山體陰影載入中",
  },
  {
    key: "vnTerrainRelief", kind: "pmtiles", file: "vn_terrain_relief.pmtiles", sourceId: "vn-terrain-relief", layerId: "vn-terrain-relief-raster", minzoom: 5, maxzoom: 10, opacity: 0.5,
    steps: [
      { color: "#4c8c54", label: "0" }, { color: "#78aa60", label: "100" }, { color: "#b0c470", label: "300" }, { color: "#dece84", label: "600" },
      { color: "#caa062", label: "1,000" }, { color: "#a4764a", label: "1,500" }, { color: "#88685c", label: "2,000" }, { color: "#bebab6", label: "2,500" }, { color: "#f5f5f5", label: "3,147 m" },
    ],
    notes: [l3("色別標高（m）；≤0 m 透明；只保留越南陸域", "Elevation tint (m); ≤0 m transparent; Vietnamese land only", "段彩標高（m）。0 m 以下は透明、ベトナム陸域のみ")],
    sourceShort: COPERNICUS, loading: "越南色別標高載入中",
  },
  {
    key: "vnLandslideSusceptibility", kind: "pmtiles", file: "vn_landslide_susceptibility.pmtiles", sourceId: "vn-landslide-susceptibility", layerId: "vn-landslide-susceptibility-raster", minzoom: 5, maxzoom: 9, opacity: 0.6,
    swatches: [
      { color: "#c3e586", label: l3("低", "Low", "低い") },
      { color: "#fdc980", label: l3("中", "Medium", "中") }, { color: "#d7191c", label: l3("高", "High", "高い") },
    ],
    notes: [
      l3("區域模型圖，只有圖、不能分析；資料年不明", "Regional model map, image only and not analysable; data year unknown", "地域モデル図で画像のみ、分析不可。データ年不明"),
      l3("原生格網約 1 km；「極低」（多為平地）不畫；只畫越南 34 省（鄰國不畫）", "Native grid about 1 km; \"very low\" (mostly flat land) not drawn; Vietnam's 34 provinces only (neighbours not drawn)", "元の格子は約 1 km。「非常に低い」（主に平地）は描画しない。ベトナム 34 省のみ（隣国は描画しない）"),
      l3("ODM GeoServer WMS 於 2026-11-17 擷取並轉成圖磚", "Rendered from the ODM GeoServer WMS on 2026-11-17", "ODM GeoServer WMS から 2026-11-17 に取得・タイル化"),
      l3("授權未明示（ODM 標 CC BY-SA 4.0）", "Licence not stated (ODM lists CC BY-SA 4.0)", "ライセンス未明示（ODM 表記は CC BY-SA 4.0）"),
    ],
    sourceShort: "Open Development Vietnam 彙編（NGO），原始機關未載明；Land slide hazard map in Vietnam（ODM GeoServer WMS，2026-11-17 渲染）", loading: "越南崩塌潛勢載入中",
  },
  {
    key: "vnWdpca", kind: "owner", file: "vn_wdpca_raster.pmtiles", sourceId: "vn-wdpca-raster", layerId: "vn-wdpca-raster", minzoom: 5, maxzoom: 12, opacity: 0.6,
    swatches: VN_WDPCA_RASTER_SWATCHES,
    notes: [
      l3("站主限定；WDPCA 條款禁止再散布與可下載的地圖，只以圖片顯示（無屬性、無彈窗）", "Owner only; WDPCA terms forbid redistribution and downloadable maps, so it is shown as an image only (no attributes or popup)", "サイト管理者限定。WDPCA 規約で再配布とダウンロード可能な地図が禁止のため画像のみ表示（属性・ポップアップなし）"),
      l3("非商用；188 面＋Ramsar 點 3（畫半徑 1.5 km 圓）", "Non-commercial; 188 polygons + 3 Ramsar points (drawn as 1.5 km circles)", "非商用。188 面＋ラムサール点 3（半径 1.5 km の円）"),
    ],
    sourceShort: "UNEP-WCMC and IUCN (2026), Protected Planet: The World Database on Protected and Conserved Areas (WDPCA), www.protectedplanet.net", loading: "越南保護區（WDPCA）載入中",
  },
];
export const VN_RASTER_BY_KEY = Object.fromEntries(VN_RASTER_SPECS.map((s) => [s.key, s])) as Record<VnRasterKey, VnRasterSpec>;
