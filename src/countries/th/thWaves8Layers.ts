/**
 * 泰國第 8–9 波（2026-11-23）13 個向量層規格＋2 個土壤 raster（規格驅動，重用菲律賓引擎 `usePhDataLayer`）。
 * 資料、授權原句見 taipei-gis-analytics `docs/topic-research/thailand_opendata/waves/w08/FRONTEND_SPEC.md` 與各 `_manifest.json`。
 * 空品、氣象、海平面三層「只有測站位置、沒有任何觀測值」：名稱與圖例寫「測站位置」，不用數值配色，不暗示即時資料。
 * 運動、公園、農會市集、獸醫、住宿補缺（Overture／OSM）用空心點；授權空白來源照常上線並標示。
 * 本檔只 import 型別（thDataLayers 會 spread 本檔）。
 */
import type { ThLayerSpec } from "./thDataLayers";
import type { ThRasterSpec } from "./thWavesLayers";
import type { L3, PhCat, PhCatGetter, PhField, PhNote, PhPart } from "../../data/intlLayerShared";

const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
const str = (v: unknown) => (v == null ? "" : String(v));
const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
const constGetter = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
const FETCHED = "2026-11-23";
const UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
const OVERTURE_ORG = l3("Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0；上游 Meta 等）", "Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0; upstream Meta etc.)", "Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0、上流 Meta など）");
const REDACTED_TITLE = { prop: "name_redacted", map: { true: l3("（個人名義，已遮蔽）", "(personal name, redacted)", "（個人名義、秘匿）") } } as const;
const REDACT_NOTE: PhNote = { text: l3("個人名義，名稱已遮蔽", "Personal name, redacted", "個人名義のため名称を秘匿"), when: (p) => p.name_redacted === true || str(p.name_redacted) === "true" };
const NEAREST_NOTE: PhNote = { text: l3("點落在府界外（岸邊、河道），府取最近者", "Point lies outside province polygons (shore, river); nearest province used", "点が県境の外（海岸・河道）にあり、最寄りの県を採用"), when: (p) => str(p.province_method) === "nearest" };
const PROVINCE_FIELDS: readonly PhField[] = [
  { prop: "province_th", label: l3("府（泰文）", "Province (Thai)", "県（タイ語）") },
  { prop: "province_en", label: l3("府（英文）", "Province (English)", "県（英語）") },
];
const OVERTURE_FIELDS: readonly PhField[] = [
  { prop: "category", label: l3("類別（Overture）", "Category (Overture)", "カテゴリ（Overture）"), kind: "code" },
  { prop: "brand", label: l3("品牌（Overture）", "Brand (Overture)", "ブランド（Overture）") },
  { prop: "locality", label: l3("地區", "Locality", "地域") },
  { prop: "confidence", label: l3("Overture 信心值", "Overture confidence", "Overture 信頼度"), kind: "num", digits: 2 },
  { prop: "datasets", label: l3("上游資料集", "Upstream datasets", "上流データセット") },
];
const OVERTURE_NOTE = l3("Overture 補缺（非官方、空心）：完整度未經官方核對，筆數為登記數、可能含歇業", "Overture gap-fill (unofficial, hollow): completeness not officially verified; counts are registrations and may include closed sites", "Overture 補完（非公式・中抜き）：網羅性は公式に未確認で、件数は登録数（閉業を含む可能性）");
const HOLLOW = (zh: string, en: string, ja: string) => ({ label: l3(zh, en, ja) });
const cat = (id: string, values: readonly string[], color: string, zh: string, en: string, ja: string, o: { parts?: readonly string[]; radius?: number } = {}): PhCat => ({ id, values, color, label: l3(zh, en, ja), ...o });
const pt = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: getter, ...extra });
const fillPart = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, fillOpacity = 0.3): PhPart => ({ id, sourceLayer, geom: "fill", minzoom, cat: getter, fillOpacity });
const linePart = (id: string, sourceLayer: string, minzoom: number, getter: PhCatGetter, widths: Readonly<Record<string, readonly [number, number]>>, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "line", minzoom, cat: getter, lineWidth: widths, ...extra });
const loading = (zh: string, en: string, ja: string) => l3(`泰國${zh}載入中`, `Loading Thailand ${en}`, `タイの${ja}を読み込み中`);
const NO_VALUE_NOTE = l3("只有測站位置，沒有任何觀測值（不是即時資料，也沒有讀值配色）", "Station locations only — no observed values (not live data, no value-based colors)", "観測局の位置のみで観測値はない（リアルタイムデータではなく、値による色分けもない）");

// ═════════════════════════ 土壤 raster（C119，SoilGrids 2.0） ═════════════════════════

export const TH_SOIL_RASTER_SPECS: readonly ThRasterSpec[] = [
  {
    key: "thSoilPh", file: "th_soils_ph.pmtiles", sourceId: "th-soil-ph", layerId: "th-soil-ph-raster", minzoom: 4, maxzoom: 7, opacity: 0.65,
    steps: [{ color: "#c0392b", label: "4.0" }, { color: "#e67e22", label: "5.0" }, { color: "#f1c40f", label: "6.0" }, { color: "#a3cb47", label: "6.5" }, { color: "#2ea043", label: "7.0" }, { color: "#16a0a0", label: "7.5" }, { color: "#2962be", label: "8.5" }],
    notes: [
      l3("表土（0–5 cm）pH；解析度約 1 km（約 0.01°），最大 z7，放大後只是放大像元", "Topsoil (0–5 cm) pH; resolution about 1 km (~0.01°), max z7, zooming in only enlarges the pixels", "表土（0–5 cm）pH。解像度約 1 km（約 0.01°）、最大 z7、拡大しても画素が大きくなるだけ"),
      l3("SoilGrids 模型預測（2021），不是實測，也不是 LDD 土壤分類；0 值（海面、鄰國）透明", "SoilGrids model prediction (2021), not measured and not the LDD soil classification; zero values (sea, neighbours) transparent", "SoilGrids のモデル予測（2021）で実測ではなく、LDD 土壌分類でもない。0 値（海面・隣国）は透明"),
    ],
    sourceShort: l3("Poggio et al. 2021, SoilGrids 2.0（ISRIC），CC BY 4.0（推定，條款未逐字核對）", "Poggio et al. 2021, SoilGrids 2.0 (ISRIC), CC BY 4.0 (presumed, terms not verified verbatim)", "Poggio et al. 2021, SoilGrids 2.0（ISRIC）、CC BY 4.0（推定、条項は逐語未確認）"), loading: "泰國土壤酸鹼值載入中",
  },
  {
    key: "thSoilOrganicCarbon", file: "th_soils_soc.pmtiles", sourceId: "th-soil-soc", layerId: "th-soil-soc-raster", minzoom: 4, maxzoom: 7, opacity: 0.65,
    steps: [{ color: "#fff7bc", label: "0.2" }, { color: "#fed976", label: "5" }, { color: "#fe9929", label: "10" }, { color: "#d95f0e", label: "20" }, { color: "#993404", label: "40" }, { color: "#662506", label: "80 g/kg" }],
    notes: [
      l3("表土（0–5 cm）有機碳（g/kg）；解析度約 1 km，最大 z7", "Topsoil (0–5 cm) organic carbon (g/kg); resolution about 1 km, max z7", "表土（0–5 cm）有機炭素（g/kg）。解像度約 1 km、最大 z7"),
      l3("SoilGrids 模型預測（2021），不是實測，也不是 LDD 土壤分類；0 值透明", "SoilGrids model prediction (2021), not measured and not the LDD soil classification; zero values transparent", "SoilGrids のモデル予測（2021）で実測ではなく、LDD 土壌分類でもない。0 値は透明"),
    ],
    sourceShort: l3("Poggio et al. 2021, SoilGrids 2.0（ISRIC），CC BY 4.0（推定，條款未逐字核對）", "Poggio et al. 2021, SoilGrids 2.0 (ISRIC), CC BY 4.0 (presumed, terms not verified verbatim)", "Poggio et al. 2021, SoilGrids 2.0（ISRIC）、CC BY 4.0（推定、条項は逐語未確認）"), loading: "泰國土壤有機碳載入中",
  },
];

// ═════════════════════════ 向量層 ═════════════════════════

const CROP_CATS: readonly PhCat[] = [
  cat("rice", ["rice"], "#a3e635", "稻米（434,798 塊，z6 起）", "Rice (434,798 polygons, from z6)", "稲（434,798 区画、z6 以上）", { parts: ["th-crops-rice-fill"] }),
  cat("cassava", ["cassava"], "#f59e0b", "木薯（178,703，z6 起）", "Cassava (178,703, from z6)", "キャッサバ（178,703、z6 以上）", { parts: ["th-crops-cassava-fill"] }),
  cat("maize", ["maize"], "#fde047", "玉米（30,827，z6 起）", "Maize (30,827, from z6)", "トウモロコシ（30,827、z6 以上）", { parts: ["th-crops-maize-fill"] }),
  cat("sugarcane", ["sugarcane"], "#2dd4bf", "甘蔗（10,238，z6 起）", "Sugarcane (10,238, from z6)", "サトウキビ（10,238、z6 以上）", { parts: ["th-crops-sugarcane-fill"] }),
  cat("rubber", ["rubber"], "#16a34a", "橡膠（7,255，z9 起）", "Rubber (7,255, from z9)", "ゴム（7,255、z9 以上）", { parts: ["th-crops-rubber-fill"] }),
  cat("palm", ["palm"], "#c2410c", "油棕（4,080，z9 起）", "Oil palm (4,080, from z9)", "アブラヤシ（4,080、z9 以上）", { parts: ["th-crops-palm-fill"] }),
];
const CROP_FIELDS: readonly PhField[] = [
  { prop: "crop_type", label: l3("作物類型（來源原文）", "Crop type (source)", "作物種別（出典）"), kind: "code" },
  { prop: "rai", label: l3("面積（rai，1 rai ≈ 0.16 ha；單位來源未標）", "Area (rai, 1 rai ≈ 0.16 ha; unit not stated)", "面積（rai、1 rai ≈ 0.16 ha、単位は出典に記載なし）"), kind: "num" },
  { prop: "product_src", label: l3("產量（單位來源未標）", "Production (unit not stated)", "生産量（単位は出典に記載なし）"), kind: "num" },
  { prop: "yield_src", label: l3("單位產量（單位來源未標）", "Yield (unit not stated)", "単収（単位は出典に記載なし）"), kind: "num" },
  { prop: "start_name_th", label: l3("播種期（泰文，含佛曆年）", "Planting period (Thai, BE year)", "作付期（タイ語、仏暦）") },
  { prop: "harv_name_th", label: l3("收穫期（泰文，含佛曆年）", "Harvest period (Thai, BE year)", "収穫期（タイ語、仏暦）") },
  { prop: "data_date", label: l3("資料日期", "Data date", "データ日付"), kind: "code" },
  { prop: "up_date", label: l3("更新日期", "Updated", "更新日"), kind: "code" },
  { prop: "tambon_th_src", label: l3("區（泰文，來源表）", "Sub-district (Thai, source)", "区（タイ語、出典表）") },
  { prop: "province_code", label: l3("府碼", "Province code", "県コード"), kind: "code" },
];

export const TH_WAVE8_SPECS: readonly ThLayerSpec[] = [
  // ───────────── 環境氣候（測站位置） ─────────────
  {
    key: "thAirQualityStations", file: "th_air_quality_stations.pmtiles", sourceId: "th-air-quality-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#38bdf8", count: 267,
    parts: [pt("th-air4thai-circle", "air4thai", 4, propGetter("station_type"), { hollow: { when: ["==", ["get", "is_mobile"], true], js: (p) => p.is_mobile === true || str(p.is_mobile) === "true", label: l3("空心：移動站（座標會變）", "Hollow: mobile station (position changes)", "中抜き：移動局（位置が変わる）") } }), pt("th-pcd-stations-circle", "gistda_station_pcd", 5, constGetter("pcd"))],
    cats: [
      cat("GROUND", ["GROUND"], "#38bdf8", "測站位置：Air4Thai 地面站（104）", "Station location: Air4Thai ground station (104)", "観測局位置：Air4Thai 地上局（104）", { parts: ["th-air4thai-circle"], radius: 4 }),
      cat("BKK", ["BKK"], "#60a5fa", "測站位置：Air4Thai 曼谷市站（68）", "Station location: Air4Thai Bangkok city station (68)", "観測局位置：Air4Thai バンコク市局（68）", { parts: ["th-air4thai-circle"], radius: 4 }),
      cat("MOBILE", ["MOBILE"], "#f59e0b", "測站位置：Air4Thai 移動站（8，空心）", "Station location: Air4Thai mobile station (8, hollow)", "観測局位置：Air4Thai 移動局（8、中抜き）", { parts: ["th-air4thai-circle"], radius: 4 }),
      cat("pcd", ["pcd"], "#94a3b8", "測站位置：GISTDA PCD 站（87，授權未明示）", "Station location: GISTDA PCD station (87, license not stated)", "観測局位置：GISTDA PCD 局（87、ライセンス未明示）", { parts: ["th-pcd-stations-circle"], radius: 3.5 }),
    ],
    title: { props: ["name_th", "name_en"], fallback: l3("空氣品質測站位置", "Air quality station location", "大気観測局の位置") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "station_id", label: l3("測站代碼", "Station id", "観測局コード"), kind: "code" },
      { prop: "station_type", label: l3("測站類型", "Station type", "観測局の種別"), map: { GROUND: l3("地面站", "Ground", "地上局"), BKK: l3("曼谷市站", "Bangkok city", "バンコク市局"), MOBILE: l3("移動站", "Mobile", "移動局") } },
      { prop: "area_th_src", label: l3("地區（泰文，來源表）", "Area (Thai, source)", "地区（タイ語、出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      NO_VALUE_NOTE,
      l3("Air4Thai（PCD）180 站（74/77 府）＋GISTDA PCD 站 87（56/77 府）；移動站 8 個座標會變，以空心標示", "180 Air4Thai (PCD) stations (74/77 provinces) + 87 GISTDA PCD stations (56/77); the 8 mobile stations change position and are hollow", "Air4Thai（PCD）180 局（74/77 県）＋GISTDA PCD 局 87（56/77 県）。移動局 8 は位置が変わるため中抜き"),
    ],
    popupNotes: [{ text: NO_VALUE_NOTE, when: () => true }, NEAREST_NOTE],
    sourceOrg: l3("Air4Thai（กรมควบคุมมลพิษ，PCD）測站清單；GISTDA Hosted station_pcd（授權未明示，存取 2026-11-23）", "Air4Thai (Pollution Control Department, PCD) station list; GISTDA Hosted station_pcd (license not stated, accessed 2026-11-23)", "Air4Thai（汚染管理局 PCD）観測局一覧、GISTDA Hosted station_pcd（ライセンス未明示、2026-11-23 取得）"),
    sourceUrl: "http://air4thai.pcd.go.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("空氣品質測站位置", "air quality station locations", "大気観測局の位置"),
  },
  {
    key: "thWeatherStations", file: "th_weather_stations.pmtiles", sourceId: "th-weather-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 294,
    parts: [
      pt("th-noaa-stations-circle", "noaa_isd", 4, constGetter("noaa"), { hollow: { when: ["!=", ["get", "active_2025"], true], js: (p) => !(p.active_2025 === true || str(p.active_2025) === "true"), label: l3("空心：2025 年已無資料的測站", "Hollow: station with no data in 2025", "中抜き：2025 年にデータのない観測局") } }),
      pt("th-tmd-stations-circle", "gistda_station_tmd", 4, constGetter("tmd")),
    ],
    cats: [
      cat("noaa", ["noaa"], "#f59e0b", "測站位置：NOAA ISD（170；131 站 2025 年仍有資料）", "Station location: NOAA ISD (170; 131 with data in 2025)", "観測局位置：NOAA ISD（170、2025 年もデータがあるのは 131）", { parts: ["th-noaa-stations-circle"], radius: 4 }),
      cat("tmd", ["tmd"], "#fb923c", "測站位置：GISTDA 氣象站（124，授權未明示）", "Station location: GISTDA meteorological station (124, license not stated)", "観測局位置：GISTDA 気象観測局（124、ライセンス未明示）", { parts: ["th-tmd-stations-circle"], radius: 3.5 }),
    ],
    title: { props: ["name", "name_th"], fallback: l3("氣象測站位置", "Weather station location", "気象観測局の位置") },
    fields: [
      { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
      { prop: "elev_m", label: l3("標高", "Elevation", "標高"), kind: "num", unit: "m" },
      { prop: "begin", label: l3("資料起始", "Record begins", "記録開始"), kind: "code" }, { prop: "end", label: l3("資料終止", "Record ends", "記録終了"), kind: "code" },
      { prop: "active_2025", label: l3("2025 年有資料", "Active in 2025", "2025 年に稼働"), map: { true: l3("是", "Yes", "はい"), false: l3("否", "No", "いいえ") } },
      { prop: "part", label: l3("分區代碼（GISTDA）", "Part code (GISTDA)", "区分コード（GISTDA）"), kind: "code" },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      NO_VALUE_NOTE,
      l3("NOAA ISD 清單（停在 2025-08）170 站＋GISTDA 氣象站 124 站；不含任何觀測；TMD 官方站（含雨量站）未涵蓋；TMD API 完全未使用", "NOAA ISD list (frozen at 2025-08), 170 stations + 124 GISTDA stations; no observations; official TMD stations (incl. rain gauges) not covered; the TMD API is not used at all", "NOAA ISD 一覧（2025-08 で停止）170 局＋GISTDA 気象観測局 124。観測値なし。TMD 公式局（雨量局を含む）は未収録。TMD API は未使用"),
    ],
    popupNotes: [{ text: NO_VALUE_NOTE, when: () => true }, NEAREST_NOTE],
    sourceOrg: l3("NOAA ISD 測站清單（公開）；GISTDA Hosted station_tmd（授權未明示，存取 2026-11-23）", "NOAA ISD station list (public); GISTDA Hosted station_tmd (license not stated, accessed 2026-11-23)", "NOAA ISD 観測局一覧（公開）、GISTDA Hosted station_tmd（ライセンス未明示、2026-11-23 取得）"),
    sourceUrl: "https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database", license: l3("NOAA 公開；GISTDA 授權未明示", "NOAA public; GISTDA license not stated", "NOAA 公開、GISTDA ライセンス未明示"), fetchedAt: FETCHED,
    loading: loading("氣象測站位置", "weather station locations", "気象観測局の位置"),
  },
  // ───────────── 海洋 ─────────────
  {
    key: "thMarineHabitats", file: "th_marine_habitats.pmtiles", sourceId: "th-marine-habitats", srcMinzoom: 5, srcMaxzoom: 13, color: "#f472b6", count: 2_491, opacity: 0.65,
    parts: [
      fillPart("th-habitat-mangrove-fill", "mangrove", 5, constGetter("mangrove"), 0.4), fillPart("th-habitat-seagrass-fill", "seagrass", 5, constGetter("seagrass"), 0.4), fillPart("th-habitat-coral-fill", "coral", 5, constGetter("coral"), 0.45),
      linePart("th-habitat-mangrove-line", "mangrove", 5, constGetter("mangrove"), { mangrove: [0.5, 1] }), linePart("th-habitat-seagrass-line", "seagrass", 5, constGetter("seagrass"), { seagrass: [0.5, 1] }), linePart("th-habitat-coral-line", "coral", 5, constGetter("coral"), { coral: [0.6, 1.2] }),
    ],
    cats: [
      cat("mangrove", ["mangrove"], "#a16207", "紅樹林（1,969 塊，23 府）", "Mangrove (1,969 polygons, 23 provinces)", "マングローブ（1,969 区画、23 県）", { parts: ["th-habitat-mangrove-fill", "th-habitat-mangrove-line"] }),
      cat("seagrass", ["seagrass"], "#22c55e", "海草床（130，12 府）", "Seagrass (130, 12 provinces)", "海草藻場（130、12 県）", { parts: ["th-habitat-seagrass-fill", "th-habitat-seagrass-line"] }),
      cat("coral", ["coral"], "#f472b6", "珊瑚礁（392，13 府）", "Coral reef (392, 13 provinces)", "サンゴ礁（392、13 県）", { parts: ["th-habitat-coral-fill", "th-habitat-coral-line"] }),
    ],
    title: { props: ["name_th"], fallback: l3("海洋棲地", "Marine habitat", "海洋生息地"), fallbackBy: { prop: "habitat", map: { coral: l3("珊瑚礁", "Coral reef", "サンゴ礁"), seagrass: l3("海草床", "Seagrass bed", "海草藻場"), mangrove: l3("紅樹林", "Mangrove", "マングローブ") } } },
    fields: [
      { prop: "habitat", label: l3("棲地類型", "Habitat", "生息地の種別"), map: { coral: l3("珊瑚礁", "Coral reef", "サンゴ礁"), seagrass: l3("海草床", "Seagrass bed", "海草藻場"), mangrove: l3("紅樹林", "Mangrove", "マングローブ") } },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 2 },
      { prop: "sea_loc", label: l3("海域位置（泰文）", "Sea location (Thai)", "海域位置（タイ語）") },
      { prop: "fr_id", label: l3("紅樹林編號（來源）", "Mangrove id (source)", "マングローブ番号（出典）"), kind: "code" },
      { prop: "tambon_th_src", label: l3("區（泰文，來源表）", "Sub-district (Thai, source)", "区（タイ語、出典表）") },
      { prop: "province_th_src", label: l3("府（來源表）", "Province (source)", "県（出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("珊瑚 13 府、海草 12 府、紅樹林 23 府有資料（年份不詳）；不能稱全國完整，沒有資料的府是未涵蓋", "Coral in 13 provinces, seagrass in 12, mangrove in 23 (survey years unknown); not nationally complete — provinces without data are not covered", "サンゴ 13 県・海草 12 県・マングローブ 23 県（調査年不明）。全国網羅ではなく、データのない県は未収録"),
      l3("不畫任何海域主張線；DMCR CSV 與 PCD 海水水質來源主機不通，未涵蓋", "No maritime claim lines are drawn; DMCR CSVs and PCD sea-water quality were unreachable and are not covered", "海域の主張線は描画しない。DMCR CSV と PCD 海水水質は接続できず未収録"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("GISTDA Hosted 海洋棲地（珊瑚、海草）與紅樹林圖層（來源 DMCR／RFD；授權未明示，存取 2026-11-23）", "GISTDA Hosted marine habitat layers (coral, seagrass) and mangrove layer (sources DMCR / RFD; license not stated, accessed 2026-11-23)", "GISTDA Hosted 海洋生息地（サンゴ・海草）とマングローブ（出典 DMCR／RFD、ライセンス未明示、2026-11-23 取得）"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("海洋棲地", "marine habitats", "海洋生息地"),
  },
  {
    key: "thMarineProtectedAreas", file: "th_marine_protected_areas.pmtiles", sourceId: "th-marine-protected-areas", srcMinzoom: 5, srcMaxzoom: 12, color: "#38bdf8", count: 154, opacity: 0.6,
    parts: [fillPart("th-mpa-fill", "protected_marine", 5, constGetter("mpa"), 0.25), linePart("th-mpa-line", "protected_marine", 5, constGetter("mpa"), { mpa: [0.8, 1.6] }, { dashed: true })],
    cats: [cat("mpa", ["mpa"], "#38bdf8", "海洋保護區（2010 年資料，較舊，154 塊）", "Marine protected area (2010 data, outdated, 154 polygons)", "海洋保護区（2010 年データ、古い、154 区画）")],
    title: { props: ["name_th"], fallback: l3("海洋保護區（2010）", "Marine protected area (2010)", "海洋保護区（2010）") },
    fields: [
      { prop: "announcement_th", label: l3("公告（泰文）", "Announcement (Thai)", "告示（タイ語）") },
      { prop: "announce_year_ce", label: l3("公告年（西元）", "Announcement year (CE)", "告示年（西暦）"), kind: "year" },
      { prop: "issuer_th", label: l3("公告機關（泰文）", "Issuer (Thai)", "告示機関（タイ語）") },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
      { prop: "tambon_th_src", label: l3("區（泰文，來源表）", "Sub-district (Thai, source)", "区（タイ語、出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("只涵蓋 9 個沿海府", "Only 9 coastal provinces covered", "沿岸 9 県のみ"),
      l3("不畫任何海域主張線；虛線外框＝保護區邊界", "No maritime claim lines drawn; the dashed outline is the protected-area boundary", "海域の主張線は描画しない。破線の外枠＝保護区の境界"),
    ],
    popupNotes: [{ text: l3("2010 年版，資料較舊", "2010 edition, outdated data", "2010 年版で、データが古い"), when: () => true }, NEAREST_NOTE],
    sourceOrg: l3("GISTDA Hosted 海洋保護區（2010 版；授權未明示，存取 2026-11-23）", "GISTDA Hosted marine protected areas (2010 edition; license not stated, accessed 2026-11-23)", "GISTDA Hosted 海洋保護区（2010 年版、ライセンス未明示、2026-11-23 取得）"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("海洋保護區", "marine protected areas", "海洋保護区"),
  },
  {
    key: "thSeaLevelStations", file: "th_sea_level_stations.pmtiles", sourceId: "th-sea-level-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#2dd4bf", count: 7,
    parts: [pt("th-sea-level-circle", "stations", 4, constGetter("tide"), { hollow: { when: ["==", ["get", "coord_quality"], "low"], js: (p) => str(p.coord_quality) === "low", label: l3("空心：座標品質低，位置僅示意", "Hollow: low coordinate quality, position indicative only", "中抜き：座標品質が低く位置は概略") } })],
    cats: [cat("tide", ["tide"], "#2dd4bf", "潮位站位置（7）", "Tide-gauge station location (7)", "潮位観測所の位置（7）", { radius: 5.5 })],
    title: { props: ["name_th"], fallback: l3("潮位站位置", "Tide-gauge station location", "潮位観測所の位置") },
    fields: [
      { prop: "station_id", label: l3("測站代碼", "Station id", "観測所コード"), kind: "code" },
      { prop: "coord_quality", label: l3("座標品質", "Coordinate quality", "座標品質"), map: { ok: l3("正常", "OK", "良好"), low: l3("低（位置僅示意）", "Low (position indicative only)", "低（位置は概略）") } },
      { prop: "coord_discrepancy_km", label: l3("兩組座標差距", "Discrepancy between coordinate sets", "座標の食い違い"), kind: "num", unit: "km", digits: 0 },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      NO_VALUE_NOTE,
      l3("DMR 潮位站 7 站；東岸 Rayong（2287）與 Laem Ngop（3070）兩組座標互相不一致（36／16 km），位置僅示意（空心）", "7 DMR tide-gauge stations; on the east coast Rayong (2287) and Laem Ngop (3070) have two coordinate sets that disagree (36 / 16 km), so positions are indicative only (hollow)", "DMR 潮位観測所 7 局。東岸の Rayong（2287）と Laem Ngop（3070）は 2 つの座標が食い違い（36／16 km）、位置は概略（中抜き）"),
      l3("潮位時序（Phuket 2013–2024）本輪不取", "Tide time series (Phuket 2013–2024) not included in this round", "潮位の時系列（Phuket 2013–2024）は今回対象外"),
    ],
    popupNotes: [{ text: NO_VALUE_NOTE, when: () => true }, { text: l3("座標品質低：位置僅示意", "Low coordinate quality: position indicative only", "座標品質が低く、位置は概略"), when: (p) => str(p.coord_quality) === "low" }],
    sourceOrg: l3("กรมทรัพยากรธรณี（DMR）潮位站清單（CC BY，版本未標；存取 2026-11-23）", "Department of Mineral Resources (DMR) tide-gauge station list (CC BY, version not stated; accessed 2026-11-23)", "鉱物資源局（DMR）潮位観測所一覧（CC BY、バージョン不明、2026-11-23 取得）"),
    sourceUrl: "https://www.dmr.go.th/", license: l3("CC BY（版本未標）", "CC BY (version not stated)", "CC BY（バージョン不明）"), fetchedAt: FETCHED,
    loading: loading("潮位站位置", "tide-gauge station locations", "潮位観測所の位置"),
  },
  {
    key: "thCoastalChange", file: "th_coastal_change.pmtiles", sourceId: "th-coastal-change", srcMinzoom: 5, srcMaxzoom: 14, color: "#fb923c", count: 460,
    parts: [linePart("th-coastal-change-line", "coastal_change", 5, propGetter("status_class"), { accretion: [1.5, 3], stable: [1.2, 2.4], erosion_moderate: [1.8, 3.2], erosion_severe: [2.2, 4] })],
    cats: [
      cat("accretion", ["accretion"], "#38bdf8", "淤積（212 段）", "Accretion (212 segments)", "堆積（212 区間）"),
      cat("stable", ["stable"], "#a3a3a3", "穩定（156）", "Stable (156)", "安定（156）"),
      cat("erosion_moderate", ["erosion_moderate"], "#fb923c", "中度侵蝕（63）", "Moderate erosion (63)", "中程度の侵食（63）"),
      cat("erosion_severe", ["erosion_severe"], "#ef4444", "嚴重侵蝕（29）", "Severe erosion (29)", "深刻な侵食（29）"),
    ],
    title: { props: ["beach_name_th"], fallback: l3("海岸線段", "Coastline segment", "海岸線区間") },
    fields: [
      { prop: "status_class", label: l3("變遷類別", "Change class", "変化区分"), map: { accretion: l3("淤積", "Accretion", "堆積"), stable: l3("穩定", "Stable", "安定"), erosion_moderate: l3("中度侵蝕", "Moderate erosion", "中程度の侵食"), erosion_severe: l3("嚴重侵蝕", "Severe erosion", "深刻な侵食") } },
      { prop: "status_th", label: l3("狀態（泰文原文）", "Status (Thai)", "状態（タイ語）") },
      { prop: "year_compiled", label: l3("彙編年（各段不同）", "Compilation year (varies by segment)", "集成年（区間ごとに異なる）"), kind: "year" },
      { prop: "compare_periods", label: l3("比較期間", "Compared periods", "比較期間"), kind: "code" },
      { prop: "length_m", label: l3("長度", "Length", "長さ"), kind: "num", unit: "m", digits: 0 },
      { prop: "major_unit_th", label: l3("海岸單元（泰文）", "Coastal unit (Thai)", "海岸ユニット（タイ語）") },
      { prop: "tambon_th_src", label: l3("區（泰文，來源表）", "Sub-district (Thai, source)", "区（タイ語、出典表）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("DMR 海岸線變遷 460 段（只涵蓋 7 個沿海府）；彙編年 2013–2023，各段不同年，不是同一時點的比較", "460 DMR coastline-change segments (7 coastal provinces only); compilation years 2013–2023 differ by segment, so this is not a same-date comparison", "DMR 海岸線変化 460 区間（沿岸 7 県のみ）。集成年は 2013–2023 で区間ごとに異なり、同一時点の比較ではない"),
      l3("不畫任何海域主張線；沒有線的府是未涵蓋，不代表沒有侵蝕", "No maritime claim lines drawn; provinces without lines are not covered, not erosion-free", "海域の主張線は描画しない。線のない県は未収録で、侵食がないという意味ではない"),
    ],
    popupNotes: [NEAREST_NOTE],
    sourceOrg: l3("กรมทรัพยากรธรณี（DMR）海岸線變遷（CC BY，版本未標；存取 2026-11-23）", "Department of Mineral Resources (DMR) coastline change (CC BY, version not stated; accessed 2026-11-23)", "鉱物資源局（DMR）海岸線変化（CC BY、バージョン不明、2026-11-23 取得）"),
    sourceUrl: "https://www.dmr.go.th/", license: l3("CC BY（版本未標）", "CC BY (version not stated)", "CC BY（バージョン不明）"), fetchedAt: FETCHED,
    loading: loading("海岸線變遷", "coastal change", "海岸線変化"),
  },
  // ───────────── 運動、公園 ─────────────
  {
    key: "thSportsVenues", file: "th_sports_venues.pmtiles", sourceId: "th-sports-venues", srcMinzoom: 7, srcMaxzoom: 14, color: "#22c55e", count: 11_377,
    parts: [
      pt("th-sports-venues-circle", "venues", 7, propGetter("venue_group"), { small: true, hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") }),
      pt("th-sports-general-circle", "general", 9, constGetter("general"), { small: true, hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") }),
    ],
    cats: [
      cat("stadium", ["stadium"], "#22c55e", "體育場、運動場（4,221）", "Stadium / arena (4,221)", "スタジアム・競技場（4,221）", { parts: ["th-sports-venues-circle"] }),
      cat("pool", ["pool"], "#38bdf8", "游泳池（1,120）", "Swimming pool (1,120)", "プール（1,120）", { parts: ["th-sports-venues-circle"] }),
      cat("field", ["field"], "#a3e635", "足球場（995）", "Soccer field (995)", "サッカー場（995）", { parts: ["th-sports-venues-circle"] }),
      cat("court", ["court"], "#f59e0b", "球場（羽球、網球、籃球、排球，925）", "Courts (badminton, tennis, basketball, volleyball, 925)", "コート（バドミントン・テニス・バスケ・バレー、925）", { parts: ["th-sports-venues-circle"] }),
      cat("golf", ["golf"], "#16a34a", "高爾夫球場（327）", "Golf course (327)", "ゴルフ場（327）", { parts: ["th-sports-venues-circle"] }),
      cat("general", ["general"], "#94a3b8", "一般運動休閒（最模糊，3,789；z9 起，預設關）", "General sports & recreation (vaguest, 3,789; from z9, off by default)", "一般スポーツ・レクリエーション（最も曖昧、3,789、z9 以上、既定は非表示）", { parts: ["th-sports-general-circle"] }),
    ],
    defaultCats: ["stadium", "pool", "field", "court", "golf"],
    heat: { intensity: 2 },
    title: { props: ["name"], fallback: l3("運動場地", "Sports venue", "スポーツ施設"), fallbackBy: REDACTED_TITLE },
    fields: [{ prop: "venue_group", label: l3("場地分組", "Venue group", "施設グループ"), kind: "code" }, ...OVERTURE_FIELDS, ...PROVINCE_FIELDS],
    legendNotes: [
      l3("Overture 補缺 11,377 處（非官方；DPE 官方名冊授權為非商用，未取）；低縮放為熱區，放大到 z7 顯示個別點（一般運動休閒 z9）", "11,377 Overture gap-fill venues (unofficial; the DPE official register is non-commercial and not used); heat at low zoom, individual points from z7 (general from z9)", "Overture 補完 11,377 件（非公式。DPE 公式名簿は非商用のため不使用）。低ズームはヒート、z7 以上で個別点（一般は z9 以上）"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: OVERTURE_ORG, sourceUrl: "https://overturemaps.org/", license: "CDLA-Permissive-2.0", fetchedAt: FETCHED,
    loading: loading("運動場地", "sports venues", "スポーツ施設"),
  },
  {
    key: "thParks", file: "th_parks.pmtiles", sourceId: "th-parks", srcMinzoom: 7, srcMaxzoom: 14, color: "#22c55e", count: 7_495,
    parts: [
      pt("th-parks-circle", "parks", 7, constGetter("park"), { small: true, hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") }),
      pt("th-parks-other-circle", "other", 8, propGetter("kind"), { small: true, hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") }),
    ],
    cats: [
      cat("park", ["park"], "#22c55e", "公園（6,784）", "Park (6,784)", "公園（6,784）", { parts: ["th-parks-circle"] }),
      cat("botanical_garden", ["botanical_garden"], "#a3e635", "植物園（278）", "Botanical garden (278)", "植物園（278）", { parts: ["th-parks-other-circle"] }),
      cat("playground", ["playground"], "#f472b6", "遊戲場（157）", "Playground (157)", "遊び場（157）", { parts: ["th-parks-other-circle"] }),
      cat("skate_park", ["skate_park"], "#38bdf8", "滑板公園（221）", "Skate park (221)", "スケートパーク（221）", { parts: ["th-parks-other-circle"] }),
      cat("dog_park", ["dog_park"], "#f59e0b", "狗公園（55）", "Dog park (55)", "ドッグパーク（55）", { parts: ["th-parks-other-circle"] }),
    ],
    title: { props: ["name"], fallback: l3("公園", "Park", "公園"), fallbackBy: REDACTED_TITLE },
    fields: [{ prop: "kind", label: l3("類型", "Kind", "種別"), kind: "code" }, ...OVERTURE_FIELDS, ...PROVINCE_FIELDS],
    legendNotes: [
      l3("Overture 補缺 7,495 處：只有點，沒有面積；放大到 z7 顯示（其他類型 z8）；BMA 綠地名冊未取", "7,495 Overture gap-fill parks: points only, no area; shown from z7 (other kinds z8); the BMA green-space register was not obtained", "Overture 補完 7,495 件：点のみで面積なし。z7 以上で表示（その他は z8）。BMA 緑地名簿は未取得"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: OVERTURE_ORG, sourceUrl: "https://overturemaps.org/", license: "CDLA-Permissive-2.0", fetchedAt: FETCHED,
    loading: loading("公園", "parks", "公園"),
  },
  // ───────────── 工業 ─────────────
  {
    key: "thFactories", file: "th_factories.pmtiles", sourceId: "th-factories", srcMinzoom: 6, srcMaxzoom: 14, color: "#f97316", count: 21_320,
    parts: [
      pt("th-factories-operating-circle", "operating", 6, constGetter("operating"), { small: true }),
      pt("th-factories-inactive-circle", "inactive", 9, propGetter("status_class"), { small: true, hollow: HOLLOW("空心：已註銷、停業等（非營運中）", "Hollow: deregistered, suspended etc. (not operating)", "中抜き：登録抹消・休業など（稼働中ではない）") }),
    ],
    cats: [
      cat("operating", ["operating"], "#f97316", "營運中工廠（僅含有座標者，7,769）", "Operating factory (records with coordinates only, 7,769)", "稼働中の工場（座標ありのみ、7,769）", { parts: ["th-factories-operating-circle"] }),
      cat("deregistered", ["deregistered"], "#94a3b8", "已註銷（12,591；z9 起，預設關）", "Deregistered (12,591; from z9, off by default)", "登録抹消（12,591、z9 以上、既定は非表示）", { parts: ["th-factories-inactive-circle"] }),
      cat("suspended", ["suspended"], "#fbbf24", "停業（552）", "Suspended (552)", "休業（552）", { parts: ["th-factories-inactive-circle"] }),
      cat("other_status", ["other"], "#a8a29e", "其他狀態（408）", "Other status (408)", "その他の状態（408）", { parts: ["th-factories-inactive-circle"] }),
    ],
    defaultCats: ["operating"],
    heat: { intensity: 2 },
    title: { props: ["name_th"], fallback: l3("工廠", "Factory", "工場"), fallbackBy: REDACTED_TITLE },
    fields: [
      { prop: "business_th", label: l3("營業項目（泰文原文）", "Business (Thai)", "事業内容（タイ語）") },
      { prop: "status_class", label: l3("狀態分類", "Status class", "状態区分"), map: { operating: l3("營運中", "Operating", "稼働中"), deregistered: l3("已註銷", "Deregistered", "登録抹消"), suspended: l3("停業", "Suspended", "休業"), other: l3("其他", "Other", "その他") } },
      { prop: "status_th", label: l3("狀態（泰文原文）", "Status (Thai)", "状態（タイ語）") },
      { prop: "reg_no", label: l3("登記編號", "Registration no.", "登録番号"), kind: "code" },
      { prop: "last_update", label: l3("最後更新", "Last updated", "最終更新"), kind: "code" },
      { prop: "tambon_th_src", label: l3("區（泰文）", "Sub-district (Thai)", "区（タイ語）") },
      { prop: "amphoe_th_src", label: l3("縣（泰文）", "District (Thai)", "郡（タイ語）") },
      ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("僅含有座標者：DIW 全名冊 116,050 筆中只有約 2.1 萬筆有座標（營運中 11,470 筆僅 7,769 有座標，3,695 無座標不 geocode）；預設只顯示營運中", "Only records with coordinates: of 116,050 DIW register rows only about 21,000 have coordinates (11,470 operating, 7,769 with coordinates; 3,695 not geocoded); operating only by default", "座標のあるもののみ：DIW 名簿 116,050 行のうち座標があるのは約 2.1 万（稼働中 11,470 のうち座標ありは 7,769、3,695 は未ジオコード）。既定は稼働中のみ"),
      l3("負責人與地址不輸出；來源沒有電話欄；225 筆個人稱謂名稱已遮蔽；放大到 z6 顯示（已註銷等 z9）", "Owner and address are not output; the source has no phone column; 225 personal-name records redacted; shown from z6 (deregistered etc. from z9)", "責任者・住所は出力しない。出典に電話欄なし。個人名義 225 件は名称を秘匿。z6 以上で表示（登録抹消などは z9 以上）"),
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("กรมโรงงานอุตสาหกรรม（DIW）工廠名冊（Open Data Common，存取 2026-11-23）", "Department of Industrial Works (DIW) factory register (Open Data Common, accessed 2026-11-23)", "工業事業局（DIW）工場名簿（Open Data Common、2026-11-23 取得）"),
    sourceUrl: "https://data.go.th/", license: l3("Open Data Common", "Open Data Common", "Open Data Common"), fetchedAt: FETCHED,
    loading: loading("工廠", "factories", "工場"),
  },
  // ───────────── 農業 ─────────────
  {
    key: "thFarmMarkets", file: "th_farm_markets.pmtiles", sourceId: "th-farm-markets", srcMinzoom: 6, srcMaxzoom: 14, color: "#22c55e", count: 2_137,
    parts: [pt("th-farm-markets-circle", "farm_markets", 6, propGetter("category"), { hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [
      cat("agricultural_cooperative", ["agricultural_cooperative"], "#22c55e", "農會、農業合作社（791）", "Agricultural cooperative (791)", "農業協同組合（791）", { radius: 3.5 }),
      cat("farmers_market", ["farmers_market"], "#f59e0b", "農夫市集（1,346）", "Farmers' market (1,346)", "ファーマーズマーケット（1,346）", { radius: 3.5 }),
    ],
    title: { props: ["name"], fallback: l3("農會、市集", "Cooperative / market", "農協・市場"), fallbackBy: REDACTED_TITLE },
    fields: [...OVERTURE_FIELDS, ...PROVINCE_FIELDS],
    legendNotes: [
      l3("Overture 補缺 2,137 處（非官方；77/77 府）；DOAE 社區企業名冊含個人欄，未取", "2,137 Overture gap-fill sites (unofficial; 77/77 provinces); the DOAE community-enterprise register contains personal fields and was not used", "Overture 補完 2,137 件（非公式、77/77 県）。DOAE のコミュニティ企業名簿は個人欄を含むため不使用"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: OVERTURE_ORG, sourceUrl: "https://overturemaps.org/", license: "CDLA-Permissive-2.0", fetchedAt: FETCHED,
    loading: loading("農會與市集", "farm markets", "農協と市場"),
  },
  {
    key: "thCrops", file: "th_crops.pmtiles", sourceId: "th-crops", srcMinzoom: 6, srcMaxzoom: 13, color: "#a3e635", count: 665_901, opacity: 0.55,
    parts: [
      fillPart("th-crops-rice-fill", "rice", 6, constGetter("rice"), 0.8), fillPart("th-crops-cassava-fill", "cassava", 6, constGetter("cassava"), 0.8), fillPart("th-crops-maize-fill", "maize", 6, constGetter("maize"), 0.8),
      fillPart("th-crops-sugarcane-fill", "sugarcane", 6, constGetter("sugarcane"), 0.8), fillPart("th-crops-rubber-fill", "rubber", 9, constGetter("rubber"), 0.8), fillPart("th-crops-palm-fill", "palm", 9, constGetter("palm"), 0.8),
    ],
    cats: CROP_CATS,
    title: { props: [], fallback: l3("作物範圍（一般化）", "Crop extent (generalized)", "作物の範囲（一般化）") },
    fields: CROP_FIELDS,
    legendNotes: [
      l3("一般化的低解析版，不可用於面積計算：稻、木薯、玉米、甘蔗簡化約 330 m 並丟棄 <1.2 km² 碎片；橡膠、油棕簡化約 100 m", "Generalized low-resolution version, not for area calculation: rice, cassava, maize and sugarcane simplified to about 330 m with fragments <1.2 km² dropped; rubber and oil palm simplified to about 100 m", "一般化した低解像度版で、面積計算には使えない：稲・キャッサバ・トウモロコシ・サトウキビは約 330 m に簡略化し 1.2 km² 未満の断片を除去。ゴム・アブラヤシは約 100 m"),
      l3("疑為依行政區聚合的多邊形；稻、木薯等屬性（rai、產量、單位產量）單位來源未標；稻等 z6 起、橡膠與油棕 z9 起", "Possibly polygons aggregated by administrative unit; the attribute units (rai, production, yield) are not stated; rice etc. from z6, rubber and oil palm from z9", "行政区単位で集計されたポリゴンの可能性。属性（rai・生産量・単収）の単位は出典に記載なし。稲など z6 以上、ゴム・アブラヤシ z9 以上"),
      l3("覆蓋 69／75／65／44／55／41 府（稻／木薯／玉米／甘蔗／橡膠／油棕）；其他府是未涵蓋", "Provinces covered: 69 / 75 / 65 / 44 / 55 / 41 (rice / cassava / maize / sugarcane / rubber / oil palm); the rest are not covered", "対象県数：69／75／65／44／55／41（稲／キャッサバ／トウモロコシ／サトウキビ／ゴム／アブラヤシ）。他は未収録"),
    ],
    popupNotes: [{ text: l3("一般化的低解析範圍，不可用於面積計算", "Generalized low-resolution extent, not for area calculation", "一般化した低解像度の範囲で、面積計算には使えない"), when: () => true }],
    sourceOrg: l3("GISTDA Hosted 作物範圍（稻、木薯、玉米、甘蔗、橡膠、油棕；授權未明示，存取 2026-11-23）；本站簡化為低解析版", "GISTDA Hosted crop extents (rice, cassava, maize, sugarcane, rubber, oil palm; license not stated, accessed 2026-11-23); simplified here to a low-resolution version", "GISTDA Hosted 作物範囲（稲・キャッサバ・トウモロコシ・サトウキビ・ゴム・アブラヤシ、ライセンス未明示、2026-11-23 取得）。本サイトで低解像度に簡略化"),
    sourceUrl: "https://gistdaportal.gistda.or.th/", license: UNSTATED, fetchedAt: FETCHED,
    loading: loading("作物範圍", "crop extents", "作物の範囲"),
  },
  {
    key: "thVeterinary", file: "th_veterinary.pmtiles", sourceId: "th-veterinary", srcMinzoom: 6, srcMaxzoom: 14, color: "#f472b6", count: 3_642,
    parts: [pt("th-vet-gistda-circle", "gistda", 6, constGetter("gistda")), pt("th-vet-overture-circle", "overture", 6, constGetter("overture"), { hollow: HOLLOW("空心：Overture 補缺", "Hollow: Overture gap-fill", "中抜き：Overture 補完") })],
    cats: [
      cat("gistda", ["gistda"], "#f472b6", "獸醫、動物診所（GISTDA，292，16 府）", "Veterinary / animal clinic (GISTDA, 292, 16 provinces)", "獣医・動物病院（GISTDA、292、16 県）", { parts: ["th-vet-gistda-circle"], radius: 4 }),
      cat("overture", ["overture"], "#fb7185", "獸醫（Overture 補缺，空心，3,350）", "Veterinarian (Overture gap-fill, hollow, 3,350)", "獣医（Overture 補完、中抜き、3,350）", { parts: ["th-vet-overture-circle"], radius: 3.5 }),
    ],
    title: { props: ["name_th", "name", "name_en"], fallback: l3("獸醫", "Veterinary", "獣医"), fallbackBy: REDACTED_TITLE },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name_th" },
      { prop: "branch_th", label: l3("分支（泰文，GISTDA）", "Branch (Thai, GISTDA)", "支所（タイ語、GISTDA）") },
      { prop: "location_th", label: l3("位置（泰文，GISTDA）", "Location (Thai, GISTDA)", "所在（タイ語、GISTDA）") },
      ...OVERTURE_FIELDS.filter((f) => f.prop !== "category"), ...PROVINCE_FIELDS,
    ],
    legendNotes: [
      l3("商業 POI、不分公私立：Overture 補缺 3,350（77/77 府）＋GISTDA 292（16/77 府）；官方獸醫名冊無", "Commercial POIs, public and private not distinguished: 3,350 Overture gap-fill (77/77 provinces) + 292 GISTDA (16/77); no official veterinary register", "商用 POI で公私の区別なし：Overture 補完 3,350（77/77 県）＋GISTDA 292（16/77 県）。公式の獣医名簿なし"),
      OVERTURE_NOTE,
    ],
    popupNotes: [REDACT_NOTE, NEAREST_NOTE],
    sourceOrg: l3("Overture Maps Foundation（release 2026-11-18.0，CDLA-Permissive-2.0）補缺；GISTDA Hosted（授權未明示，存取 2026-11-23）", "Overture Maps Foundation (release 2026-11-18.0, CDLA-Permissive-2.0) gap-fill; GISTDA Hosted (license not stated, accessed 2026-11-23)", "Overture Maps Foundation（release 2026-11-18.0、CDLA-Permissive-2.0）補完、GISTDA Hosted（ライセンス未明示、2026-11-23 取得）"),
    sourceUrl: "https://overturemaps.org/", license: l3("Overture CDLA-Permissive-2.0；GISTDA 授權未明示", "Overture CDLA-Permissive-2.0; GISTDA license not stated", "Overture CDLA-Permissive-2.0、GISTDA ライセンス未明示"), fetchedAt: FETCHED,
    loading: loading("獸醫", "veterinary clinics", "獣医"),
  },
];
