/**
 * 印尼第 1–4 波（2026-11-23）規格驅動 19 層＋ 5 張 raster 規格（重用菲律賓規格引擎 `usePhDataLayer`）。
 * 資料、授權原句見 taipei-gis-analytics `docs/topic-research/indonesia_opendata/waves/REGISTRY_SPEC.md` 與各 `_manifest.json`。
 * 授權空白的來源（BIG／BNPB ArcGIS、BMKG 等）照常上線（使用者 2026-11-23）；來源、授權、資料日期放圖層「說明・來源」（layerSourceInfo），圖例與 popup 不重複。
 * 本檔不 import idDataLayers 的值（idDataLayers 會 spread 本檔）；只 import 型別。
 * `idProtectedAreas`（WDPA，非商用、禁再散布）等授權確認前不接。
 */
import type { IdDataKey, IdRasterKey } from "./idDataKeys";
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote, PhPart, PhSizeBands } from "./phDataLayers";

export interface IdLayerSpec extends PhLayerSpec<IdDataKey> {
  /** 類別多選的預設選取（類別 id）；省略＝全選 */
  defaultCats?: readonly string[];
  /** 這層放進「說明・來源」備註的固定說明（資料時效、涵蓋限制、DISPLAY_ONLY 等） */
  sourceNotes?: readonly L3[];
}

export const l3 = (zh: string, en: string, ja: string): L3 => ({ zh, en, ja });
export const str = (v: unknown) => (v == null ? "" : String(v));
export const propGetter = (prop: string): PhCatGetter => ({ expr: ["to-string", ["coalesce", ["get", prop], ""]], js: (p) => str(p[prop]) });
export const constGetter = (v: string): PhCatGetter => ({ expr: ["literal", v], js: () => v });
export const ID_FETCHED_AT = "2026-11-23";
export const UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
export const ODBL = "ODbL 1.0";
export const OSM_HOT = l3("© OpenStreetMap contributors（ODbL），via HOT Export Tool／HDX（非官方）", "© OpenStreetMap contributors (ODbL), via HOT Export Tool / HDX (unofficial)", "© OpenStreetMap contributors（ODbL）、HOT Export Tool／HDX 経由（非公式）");
export const OSM_URL = "https://data.humdata.org/organization/hot";
export const BNPB_URL = "https://inarisk.bnpb.go.id/";
const BIG_URL = "https://tanahair.indonesia.go.id/";
export const OVERTURE_URL = "https://overturemaps.org/";
export const PT = ["==", ["geometry-type"], "Point"] as unknown[];
export const POLY = ["==", ["geometry-type"], "Polygon"] as unknown[];

export const KAB_FIELDS: readonly PhField[] = [
  { prop: "kabkota_name", label: l3("縣市", "Regency / city", "県・市") },
  { prop: "province_name", label: l3("省", "Province", "州") },
];
export const cat = (id: string, values: readonly string[], color: string, zh: string, en: string, ja: string, extra: Partial<PhCat> = {}): PhCat =>
  ({ id, values, color, label: l3(zh, en, ja), ...extra });
export const point = (id: string, sourceLayer: string, minzoom: number, c: PhCatGetter, extra: Partial<PhPart> = {}): PhPart => ({ id, sourceLayer, geom: "point", minzoom, cat: c, ...extra });
export const NEAREST: PhNote = { text: l3("點落在縣市界外（岸邊、離島），縣市取最近者", "Point lies outside regency polygons (shore, islands); nearest used", "点が県市境の外（海岸・離島）にあり、最寄りを採用"), when: (p) => str(p.admin_method) === "nearest" };
export const REDACT_TITLE = { prop: "name_redacted", map: { true: l3("（個人名義，已遮蔽）", "(personal name, redacted)", "（個人名義、秘匿）") } } as const;

// ═════════════════════════ 地形與 InaRISK raster ═════════════════════════

export interface IdRasterSpec {
  key: IdRasterKey;
  file: string;
  sourceId: string;
  layerId: string;
  minzoom: number;
  maxzoom: number;
  opacity: number;
  steps?: readonly { color: string; label: string }[];
  /** 圖例用的色階（不是連續標高）；與 steps 擇一 */
  notes: readonly L3[];
  sourceShort: string | L3;
  sourceUrl: string;
  license: L3;
  fetchedAt: string;
  loading: string;
}
const TERRAIN_SOURCE = "© DLR／Airbus，Copernicus DEM GLO-90（ESA／EU）";
const INARISK_SOURCE = l3("BNPB InaRISK 危害指數（2026-11-23 存取）", "BNPB InaRISK hazard index (accessed 2026-11-23)", "BNPB InaRISK 危険度指数（2026-11-23 取得）");
const DISPLAY_ONLY_NOTE = l3("展示底色（DISPLAY_ONLY），不做分析；500 m 重取樣", "Display-only base colour (DISPLAY_ONLY), not for analysis; resampled to 500 m", "表示専用の下地色（DISPLAY_ONLY）。分析には使わない。500 m に再サンプリング");
export const ID_RASTER_SPECS: readonly IdRasterSpec[] = [
  {
    key: "idTerrainHillshade", file: "id_terrain_hillshade.pmtiles", sourceId: "id-terrain-hillshade", layerId: "id-terrain-hillshade-raster", minzoom: 4, maxzoom: 9, opacity: 0.5,
    notes: [
      l3("Copernicus DEM GLO-90（約 90 m）山體陰影；z9 以上沿用放大。展示底色（DISPLAY_ONLY）", "Copernicus DEM GLO-90 (about 90 m) hillshade; overzoomed above z9. Display only (DISPLAY_ONLY)", "Copernicus DEM GLO-90（約 90 m）陰影起伏。z9 以上は拡大表示。表示専用（DISPLAY_ONLY）"),
      l3("DSM（含樹冠與建物）", "DSM (includes canopy and buildings)", "DSM（樹冠・建物を含む）"),
    ],
    sourceShort: TERRAIN_SOURCE, sourceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    license: l3("Copernicus DEM（ESA／EU 免費開放，須署名）", "Copernicus DEM (free and open, attribution required)", "Copernicus DEM（ESA／EU 無償公開、出典明記が必要）"), fetchedAt: ID_FETCHED_AT,
    loading: "印尼山體陰影載入中",
  },
  {
    key: "idTerrainRelief", file: "id_terrain_relief.pmtiles", sourceId: "id-terrain-relief", layerId: "id-terrain-relief-raster", minzoom: 4, maxzoom: 9, opacity: 0.6,
    steps: [
      { color: "#4c8c54", label: "0" }, { color: "#78aa60", label: "100" }, { color: "#b0c470", label: "300" }, { color: "#dece84", label: "600" },
      { color: "#caa062", label: "1,000" }, { color: "#a4764a", label: "1,500" }, { color: "#88685c", label: "2,500" }, { color: "#f5f5f5", label: "4,500 m" },
    ],
    notes: [
      l3("色別標高（m，0–4,500）；≤0 m 與海面透明。展示底色（DISPLAY_ONLY）", "Elevation tint (m, 0–4,500); ≤0 m and sea transparent. Display only (DISPLAY_ONLY)", "段彩標高（m、0–4,500）。0 m 以下・海面は透明。表示専用（DISPLAY_ONLY）"),
      l3("DSM（含樹冠與建物），GLO-90 最大 z9", "DSM (includes canopy and buildings); GLO-90, max z9", "DSM（樹冠・建物を含む）。GLO-90、最大 z9"),
    ],
    sourceShort: TERRAIN_SOURCE, sourceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    license: l3("Copernicus DEM（ESA／EU 免費開放，須署名）", "Copernicus DEM (free and open, attribution required)", "Copernicus DEM（ESA／EU 無償公開、出典明記が必要）"), fetchedAt: ID_FETCHED_AT,
    loading: "印尼色別標高載入中",
  },
  {
    key: "idInariskLandslide", file: "id_inarisk_landslide.pmtiles", sourceId: "id-inarisk-landslide", layerId: "id-inarisk-landslide-raster", minzoom: 3, maxzoom: 9, opacity: 0.65,
    steps: [{ color: "#22c55e", label: "<0.33" }, { color: "#f59e0b", label: "0.33–0.67" }, { color: "#ef4444", label: "≥0.67" }],
    notes: [
      l3("崩塌危害指數三等分（低／中／高，展示用），非 BNPB 官方 Kelas", "Landslide hazard index in thirds (low / medium / high, for display), not BNPB's official Kelas", "地すべり危険度指数を 3 等分（低／中／高、表示用）。BNPB 公式 Kelas ではない"),
      DISPLAY_ONLY_NOTE,
    ],
    sourceShort: INARISK_SOURCE, sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT, loading: "印尼崩塌危害指數載入中",
  },
  {
    key: "idInariskFlood", file: "id_inarisk_flood.pmtiles", sourceId: "id-inarisk-flood", layerId: "id-inarisk-flood-raster", minzoom: 3, maxzoom: 9, opacity: 0.65,
    steps: [{ color: "#22c55e", label: "<0.33" }, { color: "#f59e0b", label: "0.33–0.67" }, { color: "#ef4444", label: "≥0.67" }],
    notes: [
      l3("淹水危害指數三等分（低／中／高，展示用；值域從 0.33 起），非 BNPB 官方 Kelas_Banjir", "Flood hazard index in thirds (low / medium / high, for display; values start at 0.33), not BNPB's official Kelas_Banjir", "洪水危険度指数を 3 等分（低／中／高、表示用。値域は 0.33 から）。BNPB 公式 Kelas_Banjir ではない"),
      DISPLAY_ONLY_NOTE,
    ],
    sourceShort: INARISK_SOURCE, sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT, loading: "印尼淹水危害指數載入中",
  },
  {
    key: "idInariskMulti", file: "id_inarisk_multi.pmtiles", sourceId: "id-inarisk-multi", layerId: "id-inarisk-multi-raster", minzoom: 3, maxzoom: 9, opacity: 0.6,
    steps: [{ color: "#fef08a", label: "P0–20" }, { color: "#fdba74", label: "P20–40" }, { color: "#f97316", label: "P40–60" }, { color: "#dc2626", label: "P60–80" }, { color: "#7f1d1d", label: "P80–100" }],
    notes: [
      l3("多災種危害指數 5 級分位數（相對排名，不是絕對風險）；全國大片紅色是資料本身分布（≥0.67 約佔 56%）", "Multi-hazard index in 5 quantile classes (relative rank, not absolute risk); the widespread red is the data itself (≥0.67 is about 56%)", "複合災害危険度指数を 5 分位（相対順位で絶対リスクではない）。全国に広がる赤はデータ自体の分布（≥0.67 が約 56%）"),
      DISPLAY_ONLY_NOTE,
    ],
    sourceShort: INARISK_SOURCE, sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT, loading: "印尼多災種危害指數載入中",
  },
];
export const ID_RASTER_BY_KEY = Object.fromEntries(ID_RASTER_SPECS.map((s) => [s.key, s])) as Record<IdRasterKey, IdRasterSpec>;

// ═════════════════════════ 分類 ═════════════════════════

// 電廠燃料別
const FUEL_MAP = {
  coal: ["coal", "coal;oil"], gas: ["gas", "diesel;gas"], oil: ["oil", "diesel"], hydro: ["hydro"], geothermal: ["geothermal"],
} as const;
const PLANT_CATS: readonly PhCat[] = [
  cat("coal", FUEL_MAP.coal, "#a8a29e", "燃煤", "Coal", "石炭"),
  cat("gas", FUEL_MAP.gas, "#f59e0b", "天然氣", "Gas", "天然ガス"),
  cat("oil", FUEL_MAP.oil, "#d97706", "石油、柴油", "Oil, diesel", "石油・ディーゼル"),
  cat("hydro", FUEL_MAP.hydro, "#38bdf8", "水力", "Hydro", "水力"),
  cat("geothermal", FUEL_MAP.geothermal, "#f472b6", "地熱", "Geothermal", "地熱"),
];
const CAPACITY_BANDS: PhSizeBands = {
  prop: "capacity_mw", title: l3("裝置容量（MW）", "Capacity (MW)", "設備容量（MW）"),
  bands: [{ min: 0, radius: 3, label: "<50" }, { min: 50, radius: 4.5, label: "50–200" }, { min: 200, radius: 7, label: "200–1,000" }, { min: 1000, radius: 10, label: "≥1,000" }],
};
const FUEL_FIELD_MAP = Object.fromEntries(Object.entries({
  coal: l3("燃煤", "Coal", "石炭"), "coal;oil": l3("燃煤、石油", "Coal, oil", "石炭・石油"), gas: l3("天然氣", "Gas", "天然ガス"), "diesel;gas": l3("柴油、天然氣", "Diesel, gas", "ディーゼル・ガス"),
  oil: l3("石油", "Oil", "石油"), diesel: l3("柴油", "Diesel", "ディーゼル"), hydro: l3("水力", "Hydro", "水力"), geothermal: l3("地熱", "Geothermal", "地熱"),
  biomass: l3("生質能", "Biomass", "バイオマス"), biogas: l3("沼氣", "Biogas", "バイオガス"), waste: l3("廢棄物發電", "Waste-to-energy", "廃棄物発電"),
}));
const PLANT_SOURCE_MAP = { gppd: l3("WRI GPPD 2021 版（STALE）", "WRI GPPD 2021 edition (STALE)", "WRI GPPD 2021 年版（STALE）"), osm: l3("OSM 補缺（非官方）", "OSM gap-fill (unofficial)", "OSM 補完（非公式）") };
const OSM_HOLLOW = { when: ["==", ["get", "source"], "osm"] as unknown[], js: (p: Record<string, unknown>) => str(p.source) === "osm", label: l3("空心：OSM 補缺（非官方）", "Hollow: OSM gap-fill (unofficial)", "中抜き：OSM 補完（非公式）") };

// 電網：依最大電壓分級
const KV_IDS = ["low", "k150", "k275", "k500"] as const;
const kvGetter: PhCatGetter = {
  expr: ["case", ["!", ["has", "voltage_kv_max"]], "unknown", ["step", ["to-number", ["get", "voltage_kv_max"], 0], "low", 150, "k150", 230, "k275", 500, "k500"]],
  js: (p) => {
    if (p.voltage_kv_max == null || p.voltage_kv_max === "") return "unknown";
    const n = Number(p.voltage_kv_max);
    return n >= 500 ? "k500" : n >= 230 ? "k275" : n >= 150 ? "k150" : "low";
  },
};
const KV_CATS: readonly PhCat[] = [
  cat("k500", ["k500"], "#ef4444", "≥500 kV", "≥500 kV", "≥500 kV"),
  cat("k275", ["k275"], "#f97316", "230–275 kV", "230–275 kV", "230–275 kV"),
  cat("k150", ["k150"], "#facc15", "150 kV 級（150–229）", "150 kV class (150–229)", "150 kV 級（150–229）"),
  cat("low", ["low"], "#38bdf8", "150 kV 以下（多為 70 kV）", "Below 150 kV (mostly 70 kV)", "150 kV 未満（主に 70 kV）"),
  cat("unknown", ["unknown"], "#94a3b8", "電壓未知", "Voltage unknown", "電圧不明"),
];
void KV_IDS;
const KV_WIDTH: Record<string, readonly [number, number]> = { k500: [1.8, 3], k275: [1.4, 2.4], k150: [1, 1.8], low: [0.6, 1.2], unknown: [0.6, 1.2] };

// 加油站：品牌
const BRAND_CATS: readonly PhCat[] = [
  cat("pertamina", ["Pertamina"], "#ef4444", "Pertamina（4,335）", "Pertamina (4,335)", "Pertamina（4,335）"),
  cat("shell", ["Shell"], "#facc15", "Shell（258）", "Shell (258)", "Shell（258）"),
  cat("bp", ["BP"], "#22c55e", "BP（73）", "BP (73)", "BP（73）"),
  cat("other_brand_known", ["AKR", "Total", "Petronas", "Vivo", "other"], "#a78bfa", "其他品牌（AKR、Total、Petronas…）", "Other brands (AKR, Total, Petronas…)", "その他ブランド（AKR・Total・Petronas…）"),
];

// 地名：klstpn 分群
const PLACE_CATS: readonly PhCat[] = [
  cat("edu", ["Toponim Pendidikan dan IPTEK"], "#60a5fa", "教育與科技（3,489）", "Education & science (3,489)", "教育・科学技術（3,489）", { radius: 2.4 }),
  cat("relief", ["Toponim Relief", "Toponim Perairan", "Toponim Bawah Laut"], "#34d399", "地形、水域、海底（4,361）", "Relief, waters, undersea (4,361)", "地形・水域・海底（4,361）", { radius: 2.4 }),
  cat("gov", ["Toponim Pemerintahan", "Toponim Wilayah Administrasi"], "#f472b6", "行政（2,530）", "Government & administrative (2,530)", "行政（2,530）", { radius: 2.4 }),
  cat("worship", ["Toponim Peribadatan"], "#c084fc", "宗教（803）", "Religious (803)", "宗教（803）", { radius: 2.4 }),
];

// 斷層
const FAULT_CATS: readonly PhCat[] = [
  cat("aktif", ["Aktif"], "#ef4444", "PVMBG 活動斷層", "PVMBG active fault", "PVMBG 活断層", { parts: ["id-faults-pvmbg-line"] }),
  cat("potensial", ["Potensial Aktif"], "#f97316", "PVMBG 潛在活動斷層", "PVMBG potentially active fault", "PVMBG 潜在活断層", { parts: ["id-faults-pvmbg-line"] }),
  cat("notid", ["Not Identified"], "#94a3b8", "PVMBG 活動性未判定", "PVMBG activity not identified", "PVMBG 活動性未判定", { parts: ["id-faults-pvmbg-line"] }),
  cat("pusgen", ["pusgen"], "#c084fc", "PuSGeN 2024 淺層地殼斷層", "PuSGeN 2024 shallow crustal fault", "PuSGeN 2024 浅層地殻断層", { parts: ["id-faults-pusgen-line"] }),
];

// DIBI：手動級距（0 佔 80%，不用分位數）
const DIBI_IDS = ["d0", "d1", "d2", "d3", "d4"] as const;
const DIBI_COLORS = ["#6b7280", "#fef3c7", "#fcd34d", "#f97316", "#b91c1c"] as const;
const DIBI_LABELS = ["0（無紀錄或未登錄，不是 0 次）", "1–10", "11–50", "51–200", ">200"] as const;
const DIBI_LABELS_EN = ["0 (no record or not registered, not zero events)", "1–10", "11–50", "51–200", ">200"] as const;
const dibiGetter: PhCatGetter = {
  expr: ["step", ["to-number", ["get", "total_basa"], 0], "d0", 1, "d1", 11, "d2", 51, "d3", 201, "d4"],
  js: (p) => { const n = Number(p.total_basa ?? 0); return n >= 201 ? "d4" : n >= 51 ? "d3" : n >= 11 ? "d2" : n >= 1 ? "d1" : "d0"; },
};
const DIBI_CATS: readonly PhCat[] = [
  ...DIBI_IDS.map((id, i) => cat(id, [id], DIBI_COLORS[i]!, `total_basa ${DIBI_LABELS[i]}`, `total_basa: ${DIBI_LABELS_EN[i]}`, `total_basa：${DIBI_LABELS_EN[i]}`, { parts: ["id-dibi-fill"] })),
  cat("seam", ["seam"], "#374151", "縣市界", "Regency / city boundary", "県市境", { parts: ["id-dibi-line"] }),
];

// 橋梁：道路等級分群
const bridgeGetter: PhCatGetter = {
  expr: ["match", ["to-string", ["coalesce", ["get", "road_class"], ""]], ["Jembatan Jalan Tol", "Jembatan Jalan Tol Layang"], "toll",
    ["Jembatan Kereta Api Jalur Tunggal", "Jembatan Kereta Api Jalur Ganda"], "rail", "road"],
  js: (p) => { const v = str(p.road_class); return v.startsWith("Jembatan Jalan Tol") ? "toll" : v.startsWith("Jembatan Kereta Api") ? "rail" : "road"; },
};
const BRIDGE_CATS: readonly PhCat[] = [
  cat("road", ["road"], "#fbbf24", "公路橋（國道、幹道、集散道路；12,000 餘）", "Road bridge (arterial, collector; ~12,000)", "道路橋（幹線・集散道路。約 12,000）", { radius: 2.2 }),
  cat("toll", ["toll"], "#f43f5e", "收費公路橋（含高架；約 1,700）", "Toll road bridge (incl. elevated; ~1,700)", "有料道路橋（高架含む。約 1,700）", { radius: 2.6 }),
  cat("rail", ["rail"], "#a78bfa", "鐵路橋（約 2,900）", "Railway bridge (~2,900)", "鉄道橋（約 2,900）", { radius: 2.6 }),
];
const ROAD_CLASS_MAP = {
  "Jembatan Jalan Arteri": l3("幹線道路橋（Arteri）", "Arterial road bridge", "幹線道路橋（Arteri）"),
  "Jembatan Jalan Kolektor": l3("集散道路橋（Kolektor）", "Collector road bridge", "集散道路橋（Kolektor）"),
  "Jembatan Jalan Tol": l3("收費公路橋（Tol）", "Toll road bridge", "有料道路橋（Tol）"),
  "Jembatan Jalan Tol Layang": l3("收費公路高架橋", "Elevated toll road bridge", "有料道路高架橋"),
  "Jembatan Kereta Api Jalur Tunggal": l3("鐵路橋（單線）", "Railway bridge (single track)", "鉄道橋（単線）"),
  "Jembatan Kereta Api Jalur Ganda": l3("鐵路橋（雙線）", "Railway bridge (double track)", "鉄道橋（複線）"),
  Jembatan: l3("橋梁（等級未標）", "Bridge (class not stated)", "橋（等級不明）"),
};

// 水利設施
const FACILITY_CATS: readonly PhCat[] = [
  cat("dam", ["dam"], "#ef4444", "壩（893）", "Dam (893)", "ダム（893）", { radius: 4.5 }),
  cat("weir", ["weir"], "#2dd4bf", "堰（1,793）", "Weir (1,793)", "堰（1,793）", { radius: 3 }),
  cat("floodgate", ["floodgate"], "#a78bfa", "水閘（213）", "Floodgate (213)", "水門（213）", { radius: 3.5 }),
  cat("sluice_gate", ["sluice_gate"], "#f59e0b", "泄水閘（138）", "Sluice gate (138)", "排水門（138）", { radius: 3.5 }),
  cat("lock_gate", ["lock_gate"], "#38bdf8", "船閘（147）", "Lock gate (147)", "閘門（147）", { radius: 3.5 }),
];

// 流域
const WATERSHED_CATS: readonly PhCat[] = [
  cat("keep", ["DIPERTAHANKAN"], "#34d399", "維持（Dipertahankan）", "Maintain (Dipertahankan)", "維持（Dipertahankan）", { parts: ["id-watersheds-fill", "id-watersheds-line"] }),
  cat("restore", ["DIPULIHKAN"], "#f97316", "待復育（Dipulihkan）", "To be restored (Dipulihkan)", "回復対象（Dipulihkan）", { parts: ["id-watersheds-fill", "id-watersheds-line"] }),
];

// 保育林：function_code
const FOREST_CATS: readonly PhCat[] = [
  cat("hl", ["HL"], "#22c55e", "保護林（HL）", "Protection forest (HL)", "保護林（HL）"),
  cat("hsaw", ["HSAW"], "#86efac", "受保護（補丁，HSAW）", "Protected (from patch, HSAW)", "保護（補完、HSAW）"),
  cat("kspa", ["KSPA"], "#a3e635", "國家保護區（KSPA，待確認）", "National protected area (KSPA, unverified)", "国家保護区（KSPA、要確認）"),
  cat("tn", ["TN"], "#16a34a", "國家公園（TN）", "National park (TN)", "国立公園（TN）"),
  cat("marine", ["TNL", "TWAL"], "#38bdf8", "海洋公園、海洋自然遊憩區（TNL、TWAL）", "Marine park / marine recreation area (TNL, TWAL)", "海洋公園・海洋自然レクリエーション区（TNL・TWAL）"),
  cat("reserve", ["CA", "SM"], "#f472b6", "自然保護區、野生動物保護區（CA、SM）", "Nature / wildlife reserve (CA, SM)", "自然保護区・野生生物保護区（CA・SM）"),
];
const FOREST_FN_MAP = {
  "Protection forest": l3("保護林", "Protection forest", "保護林"), "Protected (from patch)": l3("受保護（補丁）", "Protected (from patch)", "保護（補完）"),
  "National Protected Area ?": l3("國家保護區（待確認）", "National protected area (unverified)", "国家保護区（要確認）"), "National Park": l3("國家公園", "National park", "国立公園"),
  "Marine Nature Recreations Park": l3("海洋自然遊憩公園", "Marine nature recreation park", "海洋自然レクリエーション公園"), "Marine National Park": l3("海洋國家公園", "Marine national park", "海洋国立公園"),
  "Nature Reserves": l3("自然保護區", "Nature reserve", "自然保護区"), "Wildlife Reserves": l3("野生動物保護區", "Wildlife reserve", "野生生物保護区"),
  "Nature Recreation Park": l3("自然遊憩公園", "Nature recreation park", "自然レクリエーション公園"), "Games Reserves": l3("狩獵保護區", "Game reserve", "狩猟保護区"),
};

// 景點
const SPOT_CATS: readonly PhCat[] = [
  cat("attraction", ["attraction"], "#f472b6", "景點（泛稱，1,991）", "Attraction (generic, 1,991)", "名所（総称、1,991）", { radius: 2.8 }),
  cat("viewpoint", ["viewpoint"], "#38bdf8", "觀景點（1,797）", "Viewpoint (1,797)", "展望地（1,797）", { radius: 2.8 }),
  cat("picnic_site", ["picnic_site"], "#34d399", "野餐地（239）", "Picnic site (239)", "ピクニック地（239）", { radius: 3 }),
  cat("theme_park", ["theme_park"], "#f59e0b", "主題樂園（198）", "Theme park (198)", "テーマパーク（198）", { radius: 3.5 }),
  cat("zoo", ["zoo"], "#a3e635", "動物園（88）", "Zoo (88)", "動物園（88）", { radius: 3.5 }),
  cat("aquarium", ["aquarium"], "#2dd4bf", "水族館（24）", "Aquarium (24)", "水族館（24）", { radius: 3.5 }),
];
const SPOT_KIND_MAP = Object.fromEntries(SPOT_CATS.map((c) => [c.values[0]!, c.label]));

// 營地
const CAMP_CATS: readonly PhCat[] = [
  cat("camp_site", ["camp_site"], "#f59e0b", "營地（586）", "Campsite (586)", "キャンプ場（586）", { radius: 3 }),
  cat("hut", ["alpine_hut", "wilderness_hut"], "#a78bfa", "山屋（118）", "Mountain / wilderness hut (118)", "山小屋（118）", { radius: 3.5 }),
];
const CAMP_KIND_MAP = { camp_site: l3("營地", "Campsite", "キャンプ場"), alpine_hut: l3("高山山屋", "Alpine hut", "高山の山小屋"), wilderness_hut: l3("荒野山屋", "Wilderness hut", "原野の山小屋") };

// 樞紐
const HUB_CATS: readonly PhCat[] = [
  cat("airport", ["airport"], "#f472b6", "機場（OSM；無名機場不顯示）", "Airport (OSM; unnamed airports hidden)", "空港（OSM。名称なしは非表示）", { radius: 5 }),
  cat("seaport", ["seaport"], "#38bdf8", "港口", "Seaport", "港", { radius: 4.5 }),
  cat("ferry_terminal", ["ferry_terminal"], "#2dd4bf", "渡輪碼頭", "Ferry terminal", "フェリーターミナル", { radius: 3 }),
];
const HUB_KIND_MAP = { airport: l3("機場", "Airport", "空港"), seaport: l3("港口", "Seaport", "港"), ferry_terminal: l3("渡輪碼頭", "Ferry terminal", "フェリーターミナル") };

// 山域搜救
const RESCUE_CATS: readonly PhCat[] = [
  cat("lost", ["lost_in_mountain_or_forest"], "#f59e0b", "山林迷路（43）", "Lost in mountain or forest (43)", "山林で道迷い（43）", { radius: 4 }),
  cat("fall", ["fall_from_mountain"], "#ef4444", "山上墜落（12）", "Fall from mountain (12)", "山からの転落（12）", { radius: 4 }),
];

// 雅加達沉降：依年份（各年量級不同，不可比，單色）
const SUBSIDENCE_CATS: readonly PhCat[] = [
  cat("y2023", ["2023"], "#38bdf8", "2023 觀測（99）", "2023 observations (99)", "2023 年の観測（99）", { radius: 3.5 }),
  cat("y2024", ["2024"], "#38bdf8", "2024 觀測（230）", "2024 observations (230)", "2024 年の観測（230）", { radius: 3.5 }),
  cat("y2025", ["2025"], "#38bdf8", "2025 觀測（173）", "2025 observations (173)", "2025 年の観測（173）", { radius: 3.5 }),
];

// ═════════════════════════ 規格 ═════════════════════════

const fu = (zh: string, en: string, ja: string) => l3(zh, en, ja);
export const ID_WAVE_SPECS: readonly IdLayerSpec[] = [
  {
    key: "idStations", file: "id_stations.pmtiles", sourceId: "id-stations", srcMinzoom: 4, srcMaxzoom: 14, color: "#f59e0b", count: 681,
    parts: [point("id-stations-circle", "stations", 4, constGetter("station"))],
    cats: [cat("station", ["station"], "#f59e0b", "鐵道站（OSM，非官方）", "Railway station (OSM, unofficial)", "鉄道駅（OSM、非公式）", { radius: 4 })],
    title: { props: ["name", "name_en", "name_id"], fallback: l3("鐵道站", "Railway station", "鉄道駅") },
    fields: [{ prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" }, ...KAB_FIELDS],
    legendNotes: [l3("OSM 補缺（非官方，KAI 無開放站表）；681 處，涵蓋 17/38 省", "OSM gap-fill (unofficial; KAI publishes no open station list); 681 stations in 17 of 38 provinces", "OSM 補完（非公式、KAI は駅一覧を公開せず）。681 駅、38 州中 17 州")],
    popupNotes: [], sourceOrg: OSM_HOT, sourceUrl: OSM_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼鐵道站載入中", "Loading Indonesia railway stations", "インドネシアの鉄道駅を読み込み中"),
  },
  {
    key: "idRailLines", file: "id_rail_lines.pmtiles", sourceId: "id-rail-lines", srcMinzoom: 4, srcMaxzoom: 12, color: "#a78bfa", count: 14_144,
    parts: [{ id: "id-rail-lines-line", sourceLayer: "rail", geom: "line", minzoom: 4, cat: constGetter("rail"), lineWidth: { rail: [0.8, 1.8] } }],
    cats: [cat("rail", ["rail"], "#a78bfa", "鐵道線（OSM，非官方）", "Railway line (OSM, unofficial)", "鉄道線（OSM、非公式）")],
    title: { props: ["name", "name_en", "name_id"], fallback: l3("鐵道", "Railway", "鉄道") },
    fields: [{ prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" }, ...KAB_FIELDS],
    legendNotes: [l3("OSM 鐵道線 14,144 段，涵蓋 14/38 省（爪哇、蘇門答臘、南蘇拉威西）；主要道路本輪未做", "14,144 OSM rail segments in 14 of 38 provinces (Java, Sumatra, South Sulawesi); major roads not in this round", "OSM 鉄道 14,144 区間、38 州中 14 州（ジャワ・スマトラ・南スラウェシ）。主要道路は今回対象外")],
    popupNotes: [], sourceOrg: OSM_HOT, sourceUrl: OSM_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼鐵道線載入中", "Loading Indonesia railway lines", "インドネシアの鉄道線を読み込み中"),
  },
  {
    key: "idTransportHubs", file: "id_transport_hubs.pmtiles", sourceId: "id-transport-hubs", srcMinzoom: 4, srcMaxzoom: 14, color: "#38bdf8", count: 1_849,
    parts: [point("id-hubs-circle", "hubs", 4, propGetter("kind"))],
    cats: HUB_CATS,
    title: { props: ["name", "name_en", "name_id"], fallback: l3("交通樞紐", "Transport hub", "交通拠点"), fallbackBy: { prop: "kind", map: HUB_KIND_MAP } },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" },
      { prop: "kind", label: l3("類別", "Type", "種別"), map: HUB_KIND_MAP },
      { prop: "name_source", label: l3("名稱來源", "Name source", "名称の出典"), map: { osm: l3("OSM", "OSM", "OSM"), ourairports: l3("OurAirports（機場補名）", "OurAirports (airport name)", "OurAirports（空港名補完）") } },
      ...KAB_FIELDS,
    ],
    legendNotes: [l3("機場 678、港口 396、渡輪碼頭 775（OSM）；無名機場 32 處不顯示、不猜名", "678 airports, 396 seaports, 775 ferry terminals (OSM); 32 unnamed airports hidden, no guessed names", "空港 678・港 396・フェリー 775（OSM）。名称なしの空港 32 件は非表示で推測もしない")],
    popupNotes: [NEAREST], sourceOrg: l3("© OpenStreetMap contributors（ODbL），via HOT／HDX；機場補名 OurAirports（公有領域）", "© OpenStreetMap contributors (ODbL), via HOT / HDX; airport names from OurAirports (public domain)", "© OpenStreetMap contributors（ODbL）、HOT／HDX 経由。空港名は OurAirports（パブリックドメイン）"),
    sourceUrl: OSM_URL, license: l3("ODbL 1.0（OSM）；OurAirports 公有領域", "ODbL 1.0 (OSM); OurAirports public domain", "ODbL 1.0（OSM）、OurAirports パブリックドメイン"), fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼交通樞紐載入中", "Loading Indonesia transport hubs", "インドネシアの交通拠点を読み込み中"),
  },
  {
    key: "idPowerPlants", file: "id_power_plants.pmtiles", sourceId: "id-power-plants", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2622E", count: 559,
    parts: [
      point("id-power-plants-circle", "plants", 3, propGetter("fuel"), { filter: PT, size: CAPACITY_BANDS, hollow: OSM_HOLLOW }),
      { id: "id-power-plants-fill", sourceLayer: "plants", geom: "fill", minzoom: 6, cat: propGetter("fuel"), filter: POLY, fillOpacity: 0.6 },
    ],
    cats: PLANT_CATS, otherColor: "#94a3b8", otherLabel: l3("其他、未標燃料（生質、沼氣、廢棄物…）", "Other / fuel not stated (biomass, biogas, waste…)", "その他・燃料不明（バイオマス・バイオガス・廃棄物…）"),
    sizeLegend: [CAPACITY_BANDS],
    title: { props: ["name", "name_en"], fallback: l3("電廠", "Power plant", "発電所") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" },
      { prop: "fuel", label: l3("燃料", "Fuel", "燃料"), map: FUEL_FIELD_MAP },
      { prop: "capacity_mw", label: l3("裝置容量", "Capacity", "設備容量"), kind: "num", unit: "MW", digits: 1 },
      { prop: "output_text", label: l3("輸出（OSM 原文）", "Output (OSM tag)", "出力（OSM 原文）") },
      { prop: "commissioning_year", label: l3("啟用年", "Start year", "運転開始年"), kind: "year" },
      { prop: "owner", label: l3("所有者", "Owner", "所有者") },
      { prop: "source", label: l3("資料來源", "Source", "出典"), map: PLANT_SOURCE_MAP },
      ...KAB_FIELDS,
    ],
    legendNotes: [
      l3("GPPD 2021 版 178＋OSM 補缺 381（空心，非官方）；無容量值者用中等點、不補 0", "178 from GPPD (2021 edition) + 381 OSM gap-fill (hollow, unofficial); plants without capacity use a mid-size dot, not zero", "GPPD 2021 年版 178＋OSM 補完 381（中抜き、非公式）。容量不明は中サイズの点（0 にしない）"),
      l3("容量級距：圓圈大小", "Capacity bands shown as circle size", "容量区分は円の大きさ"),
    ],
    popupNotes: [{ text: l3("GPPD 2021 版（STALE）", "GPPD 2021 edition (STALE)", "GPPD 2021 年版（STALE）"), when: (p) => p.stale === true || str(p.stale) === "true" }, NEAREST],
    sourceOrg: l3("World Resources Institute Global Power Plant Database v1.3.0（2021）；© OpenStreetMap contributors（ODbL），via Overture", "World Resources Institute Global Power Plant Database v1.3.0 (2021); © OpenStreetMap contributors (ODbL), via Overture", "World Resources Institute Global Power Plant Database v1.3.0（2021）。© OpenStreetMap contributors（ODbL）、Overture 経由"),
    sourceUrl: "https://datasets.wri.org/dataset/globalpowerplantdatabase", license: l3("逐列：GPPD CC BY 4.0／OSM ODbL 1.0", "Per record: GPPD CC BY 4.0 / OSM ODbL 1.0", "レコード別：GPPD CC BY 4.0／OSM ODbL 1.0"), fetchedAt: ID_FETCHED_AT,
    sourceNotes: [l3("GPPD 為 2021 版（STALE）；GEM 追蹤器需填表單，未使用", "GPPD is the 2021 edition (STALE); the GEM tracker needs a form and was not used", "GPPD は 2021 年版（STALE）。GEM トラッカーはフォーム入力が必要で未使用")],
    loading: l3("印尼電廠載入中", "Loading Indonesia power plants", "インドネシアの発電所を読み込み中"),
  },
  {
    key: "idPowerGrid", file: "id_power_grid.pmtiles", sourceId: "id-power-grid", srcMinzoom: 4, srcMaxzoom: 14, color: "#62D9AD", count: 7_447,
    parts: [
      { id: "id-power-lines-line", sourceLayer: "lines", geom: "line", minzoom: 4, cat: kvGetter, lineWidth: KV_WIDTH },
      point("id-power-substations-circle", "substations", 5, kvGetter, { small: true, filter: PT }),
      { id: "id-power-substations-fill", sourceLayer: "substations", geom: "fill", minzoom: 8, cat: kvGetter, filter: POLY, fillOpacity: 0.6 },
    ],
    cats: KV_CATS,
    title: { props: ["name", "name_en"], fallback: l3("電力設施", "Power facility", "電力設備") },
    fields: [
      { prop: "name_en", label: l3("英文名稱", "English name", "英語名"), unlessSameAs: "name" },
      { prop: "voltage_kv_max", label: l3("電壓（最大）", "Voltage (highest)", "電圧（最大）"), kind: "num", unit: "kV", digits: 1 },
      { prop: "voltage_text", label: l3("電壓（OSM 原文，V）", "Voltage (OSM tag, V)", "電圧（OSM 原文、V）"), kind: "code" },
      { prop: "operator", label: l3("營運者", "Operator", "事業者") },
      ...KAB_FIELDS,
    ],
    legendNotes: [
      l3("OSM（非官方，完整度不均）：輸電線 4,627 段、變電所 2,820 處；電壓未知保持缺值", "OSM (unofficial, uneven completeness): 4,627 line segments, 2,820 substations; unknown voltage stays blank", "OSM（非公式、網羅性にばらつき）：送電線 4,627 区間・変電所 2,820。電圧不明は空欄のまま"),
      l3("不可當官方電網長度", "Not an official grid length", "公式の送電網延長として使えない"),
    ],
    popupNotes: [NEAREST], sourceOrg: l3("© OpenStreetMap contributors（ODbL），via Overture Maps Foundation（release 2026-11-18.0）", "© OpenStreetMap contributors (ODbL), via Overture Maps Foundation (release 2026-11-18.0)", "© OpenStreetMap contributors（ODbL）、Overture Maps Foundation 経由（release 2026-11-18.0）"),
    sourceUrl: OVERTURE_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼電網載入中", "Loading Indonesia power grid", "インドネシアの電力網を読み込み中"),
  },
  {
    key: "idRenewables", file: "id_renewables.pmtiles", sourceId: "id-renewables", srcMinzoom: 3, srcMaxzoom: 14, color: "#F2E085", count: 206, opacity: 0.8,
    parts: [
      { id: "id-solar-potential-fill", sourceLayer: "solar_potential", geom: "fill", minzoom: 3, cat: propGetter("solar_class"), fillOpacity: 0.4 },
      point("id-renewables-circle", "generators", 4, propGetter("energy"), { filter: PT, size: undefined }),
      { id: "id-renewables-fill", sourceLayer: "generators", geom: "fill", minzoom: 7, cat: propGetter("energy"), filter: POLY, fillOpacity: 0.7 },
    ],
    cats: [
      cat("s4", ["4–5 kWh/m²"], "#fde68a", "太陽能潛力 4–5 kWh/m²／日（潛力分區，不是電廠）", "Solar potential 4–5 kWh/m²/day (potential zone, not plants)", "太陽光ポテンシャル 4–5 kWh/m²／日（ポテンシャル区分で発電所ではない）", { parts: ["id-solar-potential-fill"] }),
      cat("s5", ["5–6 kWh/m²"], "#fb923c", "太陽能潛力 5–6 kWh/m²／日（潛力分區，不是電廠）", "Solar potential 5–6 kWh/m²/day (potential zone, not plants)", "太陽光ポテンシャル 5–6 kWh/m²／日（ポテンシャル区分で発電所ではない）", { parts: ["id-solar-potential-fill"] }),
      cat("solar", ["solar"], "#facc15", "太陽能發電場（OSM，135）", "Solar farm (OSM, 135)", "太陽光発電所（OSM、135）", { parts: ["id-renewables-circle", "id-renewables-fill"], radius: 3.5 }),
      cat("wind", ["wind"], "#38bdf8", "風力發電場、風機（OSM，69）", "Wind farm / turbine (OSM, 69)", "風力発電所・風車（OSM、69）", { parts: ["id-renewables-circle", "id-renewables-fill"], radius: 3.5 }),
    ],
    title: { props: ["name", "name_en"], fallback: l3("再生能源", "Renewables", "再生可能エネルギー"), fallbackBy: { prop: "kind", map: { solar_potential: l3("太陽能潛力分區", "Solar potential zone", "太陽光ポテンシャル区分"), wind_turbine: l3("風機", "Wind turbine", "風車"), plant: l3("發電場", "Power plant", "発電所") } } },
    fields: [
      { prop: "solar_class", label: l3("日射級距", "Irradiation class", "日射区分") },
      { prop: "energy", label: l3("能源", "Energy", "エネルギー"), map: { solar: l3("太陽能", "Solar", "太陽光"), wind: l3("風力", "Wind", "風力") } },
      { prop: "output_text", label: l3("輸出（OSM 原文）", "Output (OSM tag)", "出力（OSM 原文）") },
      ...KAB_FIELDS,
    ],
    legendNotes: [
      l3("潛力分區是全國 2 級粗分區（DISPLAY_ONLY），不是已建設施；發電場點為 OSM 補缺（非官方）", "Potential zones are a coarse 2-class national layer (DISPLAY_ONLY), not built capacity; farm points are OSM gap-fill (unofficial)", "ポテンシャル区分は全国 2 区分の粗い表示専用（DISPLAY_ONLY）で整備済み設備ではない。発電所の点は OSM 補完（非公式）"),
      l3("不含屋頂、單片板設施", "Rooftop and single-panel generators not included", "屋根置き・単体パネルは含まない"),
    ],
    popupNotes: [{ text: l3("潛力分區，非已建設施", "Potential zone, not built capacity", "ポテンシャル区分で、整備済み設備ではない"), when: (p) => str(p.kind) === "solar_potential" }, NEAREST],
    sourceOrg: l3("BMKG 太陽能潛力圖 2020（授權未明示，須署名）；發電場 © OpenStreetMap contributors（ODbL），via Overture", "BMKG solar potential map 2020 (license not stated; attribution required); farms © OpenStreetMap contributors (ODbL), via Overture", "BMKG 太陽光ポテンシャル図 2020（ライセンス未明示、出典明記が必要）。発電所 © OpenStreetMap contributors（ODbL）、Overture 経由"),
    sourceUrl: "https://data.bmkg.go.id/", license: l3("BMKG 授權未明示；OSM ODbL 1.0（逐筆）", "BMKG license not stated; OSM ODbL 1.0 (per record)", "BMKG ライセンス未明示。OSM ODbL 1.0（レコード別）"), fetchedAt: ID_FETCHED_AT,
    sourceNotes: [l3("太陽能潛力分區為 DISPLAY_ONLY（2 級粗分區、簡化 0.001°），不適合面積或距離分析；發電場可分析", "The solar potential zones are DISPLAY_ONLY (2 coarse classes, simplified 0.001°), unsuitable for area or distance analysis; farm points are analysable", "太陽光ポテンシャル区分は表示専用（DISPLAY_ONLY、2 区分・0.001° 簡略化）で面積・距離分析には不向き。発電所の点は分析可")],
    loading: l3("印尼再生能源載入中", "Loading Indonesia renewables", "インドネシアの再生可能エネルギーを読み込み中"),
  },
  {
    key: "idFuelStations", file: "id_fuel_stations.pmtiles", sourceId: "id-fuel-stations", srcMinzoom: 5, srcMaxzoom: 14, color: "#f59e0b", count: 5_975,
    parts: [point("id-fuel-stations-circle", "fuel", 5, propGetter("brand_group"), { small: true })],
    cats: BRAND_CATS, otherColor: "#94a3b8", otherLabel: l3("品牌未知（1,270）", "Brand unknown (1,270)", "ブランド不明（1,270）"),
    title: { props: ["name"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド"), fallbackBy: REDACT_TITLE },
    fields: [
      { prop: "brand", label: l3("品牌", "Brand", "ブランド") },
      { prop: "category", label: l3("類別", "Category", "カテゴリ"), map: { gas_station: l3("加油站", "Gas station", "ガソリンスタンド"), fueling_station: l3("加注站", "Fueling station", "給油所") } },
      { prop: "operating_status", label: l3("營業狀態", "Operating status", "営業状況"), map: { open: l3("營業中", "Open", "営業中"), temporarily_closed: l3("暫停營業", "Temporarily closed", "一時休業") } },
      ...KAB_FIELDS,
    ],
    legendNotes: [l3("Overture 補缺（非官方 SPBU 名冊）：5,975 處為登記數，可能含已歇業", "Overture gap-fill (not an official SPBU register): 5,975 registered points, may include closed stations", "Overture 補完（公式 SPBU 名簿ではない）：5,975 件は登録数で、閉業を含む可能性")],
    popupNotes: [NEAREST], sourceOrg: l3("Overture Maps Foundation places（release 2026-11-18.0）", "Overture Maps Foundation places (release 2026-11-18.0)", "Overture Maps Foundation places（release 2026-11-18.0）"),
    sourceUrl: OVERTURE_URL, license: "CDLA-Permissive-2.0", fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼加油站載入中", "Loading Indonesia fuel stations", "インドネシアのガソリンスタンドを読み込み中"),
  },
  {
    key: "idPlaceNames", file: "id_place_names.pmtiles", sourceId: "id-place-names", srcMinzoom: 6, srcMaxzoom: 14, color: "#e5e7eb", count: 12_554,
    parts: [point("id-place-names-circle", "places", 6, propGetter("klstpn"), { small: true })],
    cats: PLACE_CATS, otherColor: "#94a3b8", otherLabel: l3("其他（醫療、經貿、交通、旅遊…）", "Other (health, commerce, transport, tourism…)", "その他（保健・商業・交通・観光…）"),
    heat: { intensity: 1.2 },
    title: { props: ["name", "name_special"], fallback: l3("地名", "Place name", "地名") },
    fields: [
      { prop: "ftype", label: l3("類型", "Feature type", "種別") },
      { prop: "klstpn", label: l3("分類", "Category", "分類") },
      { prop: "meaning", label: l3("涵義", "Meaning", "意味") },
      { prop: "origin_lang", label: l3("語源", "Origin language", "語源") },
      { prop: "alt_name", label: l3("別名", "Alternative name", "別名") },
      { prop: "prev_name", label: l3("舊名", "Previous name", "旧名") },
      ...KAB_FIELDS,
    ],
    legendNotes: [
      l3("放大至 z6 才顯示；BIG Gasetir 2023 已公布批次 12,554 筆，非全國全部地名", "Shown from z6; 12,554 names from the published BIG Gasetir 2023 batches, not every name in Indonesia", "z6 以上で表示。BIG Gasetir 2023 公表分 12,554 件で、全国の全地名ではない"),
      l3("含學校、村辦公室等設施型地名，不是純自然地名", "Includes facility-type names such as schools and village offices, not only natural names", "学校・村役場などの施設名を含み、自然地名だけではない"),
    ],
    popupNotes: [NEAREST], sourceOrg: l3("Badan Informasi Geospasial（BIG）Gasetir RI 2023，存取 2026-11-23", "Badan Informasi Geospasial (BIG), Gasetir RI 2023, accessed 2026-11-23", "Badan Informasi Geospasial（BIG）Gasetir RI 2023、2026-11-23 取得"),
    sourceUrl: BIG_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼地名載入中", "Loading Indonesia place names", "インドネシアの地名を読み込み中"),
  },
  {
    key: "idOuterIslands", file: "id_outer_islands.pmtiles", sourceId: "id-outer-islands", srcMinzoom: 3, srcMaxzoom: 14, color: "#38bdf8", count: 111,
    parts: [point("id-outer-islands-circle", "islands", 3, constGetter("island"))],
    cats: [cat("island", ["island"], "#38bdf8", "外圍小島（Keppres 6/2017，只畫島點）", "Outer small island (Keppres 6/2017; island points only)", "外縁小島（Keppres 6/2017、島の点のみ）", { radius: 4.5 })],
    title: { props: ["name"], fallback: l3("外圍小島", "Outer small island", "外縁小島") },
    fields: [
      { prop: "kabkota_big", label: l3("所屬縣（BIG 屬性）", "Regency (BIG attribute)", "所属県（BIG 属性）") },
      { prop: "province_big", label: l3("所屬省（BIG 屬性）", "Province (BIG attribute)", "所属州（BIG 属性）") },
      { prop: "remark", label: l3("備註（有無居民，原文）", "Remark (inhabited or not, original)", "備考（居住の有無、原文）") },
    ],
    legendNotes: [l3("只畫島點，不畫任何海上主張線；111 處", "Island points only, no maritime claim lines; 111 islands", "島の点のみで海上の主張線は描かない。111 島")],
    popupNotes: [], sourceOrg: l3("Badan Informasi Geospasial（BIG）PPKT 外圍小島 2024，存取 2026-11-23", "Badan Informasi Geospasial (BIG), PPKT outer small islands 2024, accessed 2026-11-23", "Badan Informasi Geospasial（BIG）PPKT 外縁小島 2024、2026-11-23 取得"),
    sourceUrl: BIG_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼外圍小島載入中", "Loading Indonesia outer islands", "インドネシアの外縁小島を読み込み中"),
  },
  {
    key: "idFaults", file: "id_faults.pmtiles", sourceId: "id-faults", srcMinzoom: 3, srcMaxzoom: 12, color: "#ef4444", count: 1_415,
    parts: [
      { id: "id-faults-pvmbg-line", sourceLayer: "pvmbg", geom: "line", minzoom: 3, cat: propGetter("activity_class"), lineWidth: { Aktif: [1.2, 2.4], "Potensial Aktif": [1, 2], "Not Identified": [0.8, 1.6] } },
      { id: "id-faults-pusgen-line", sourceLayer: "pusgen", geom: "line", minzoom: 3, cat: constGetter("pusgen"), lineWidth: { pusgen: [1, 2] } },
    ],
    cats: FAULT_CATS,
    title: { props: ["name", "segment"], fallback: l3("斷層", "Fault", "断層") },
    fields: [
      { prop: "activity_class", label: l3("活動性", "Activity", "活動性"), map: { Aktif: l3("活動", "Active", "活動"), "Potensial Aktif": l3("潛在活動", "Potentially active", "潜在活動"), "Not Identified": l3("未判定", "Not identified", "未判定") } },
      { prop: "mmax", label: l3("最大規模 Mmax", "Maximum magnitude Mmax", "最大規模 Mmax"), kind: "num", digits: 1 },
      { prop: "length_km", label: l3("長度", "Length", "長さ"), kind: "num", unit: "km", digits: 1 },
      { prop: "region", label: l3("區域", "Region", "地域") },
      { prop: "location", label: l3("位置", "Location", "位置") },
    ],
    legendNotes: [l3("兩來源比例尺不同，疊合會重複；離岸斷層保留", "The two sources differ in scale and overlap; offshore faults kept", "2 つの出典は縮尺が異なり重なると重複する。沖合の断層も保持")],
    popupNotes: [], sourceOrg: l3("BNPB（InaRISK）；原資料 PVMBG（Badan Geologi）、PuSGeN 2024，存取 2026-11-23", "BNPB (InaRISK); original data PVMBG (Badan Geologi), PuSGeN 2024, accessed 2026-11-23", "BNPB（InaRISK）。原データ PVMBG（Badan Geologi）、PuSGeN 2024、2026-11-23 取得"),
    sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼斷層載入中", "Loading Indonesia faults", "インドネシアの断層を読み込み中"),
  },
  {
    key: "idMountainRescue", file: "id_mountain_rescue.pmtiles", sourceId: "id-mountain-rescue", srcMinzoom: 5, srcMaxzoom: 14, color: "#f59e0b", count: 55,
    parts: [point("id-mountain-rescue-circle", "events", 5, propGetter("category"))],
    cats: RESCUE_CATS,
    title: { props: [], fallback: l3("山域搜救事件", "Mountain search-and-rescue event", "山岳捜索救助事案") },
    fields: [
      { prop: "event_date", label: l3("日期", "Date", "日付") },
      { prop: "category", label: l3("類別", "Type", "種別"), map: { lost_in_mountain_or_forest: l3("山林迷路", "Lost in mountain or forest", "山林で道迷い"), fall_from_mountain: l3("山上墜落", "Fall from mountain", "山からの転落") } },
      { prop: "survivors", label: l3("獲救", "Rescued", "救助"), kind: "num" },
      { prop: "deaths", label: l3("死亡", "Deaths", "死亡"), kind: "num" },
      { prop: "missing", label: l3("失蹤", "Missing", "行方不明"), kind: "num" },
      ...KAB_FIELDS,
    ],
    legendNotes: [l3("Basarnas 2022 單年 55 筆；不含案件敘述與姓名", "Basarnas 2022, a single year, 55 events; no case narratives or names", "Basarnas 2022 年の単年 55 件。事案の記述・氏名は含まない")],
    popupNotes: [], sourceOrg: l3("Badan Nasional Pencarian dan Pertolongan（Basarnas）2022，存取 2026-11-23", "Badan Nasional Pencarian dan Pertolongan (Basarnas), 2022, accessed 2026-11-23", "Badan Nasional Pencarian dan Pertolongan（Basarnas）2022、2026-11-23 取得"),
    sourceUrl: "https://basarnas.go.id/", license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼山域搜救載入中", "Loading Indonesia mountain rescue", "インドネシアの山岳救助を読み込み中"),
  },
  {
    key: "idDibiHydromet", file: "id_dibi_hydromet.pmtiles", sourceId: "id-dibi-hydromet", srcMinzoom: 4, srcMaxzoom: 12, color: "#f97316", count: 514, opacity: 0.7,
    parts: [
      { id: "id-dibi-fill", sourceLayer: "kabkota", geom: "fill", minzoom: 4, cat: dibiGetter },
      { id: "id-dibi-line", sourceLayer: "kabkota", geom: "line", minzoom: 4, cat: constGetter("seam"), lineWidth: { seam: [0.4, 0.8] } },
    ],
    cats: DIBI_CATS,
    title: { props: ["kabkota_name"], fallback: l3("縣市", "Regency / city", "県・市") },
    fields: [
      { prop: "total_basa", label: l3("total_basa", "total_basa", "total_basa"), kind: "num" },
      { prop: "total_ba_1", label: l3("total_ba_1", "total_ba_1", "total_ba_1"), kind: "num" },
      { prop: "total_keri", label: l3("total_keri", "total_keri", "total_keri"), kind: "num" },
      { prop: "period", label: l3("期間", "Period", "期間") },
      { prop: "province_name", label: l3("省", "Province", "州") },
    ],
    legendNotes: [
      l3("DIBI 水文氣象災害 2015–2024（DISPLAY_ONLY）：顏色依 total_basa（來源未說明欄位意義）；約 80% 縣市為 0，無法區分無紀錄與未登錄；不做排名或風險比較", "DIBI hydrometeorological disasters 2015–2024 (DISPLAY_ONLY): colour follows total_basa (the source does not explain the field); ~80% of regencies are 0 and cannot be told apart from unregistered; no ranking or risk comparison", "DIBI 水文気象災害 2015–2024（表示専用 DISPLAY_ONLY）：色は total_basa（出典は欄の意味を説明していない）。約 80% の県市が 0 で、記録なしと未登録を区別できない。順位付け・リスク比較はしない"),
    ],
    popupNotes: [{ text: l3("來源未說明欄位意義（三個欄位為來源原始欄名，數值是紀錄次數）", "The source does not explain what these fields mean (original field names; values are recorded counts)", "出典は欄の意味を説明していない（出典の元の欄名で、値は記録件数）"), when: () => true }], sourceOrg: l3("BNPB DIBI 水文氣象 2015–2024，存取 2026-11-23", "BNPB DIBI hydrometeorological 2015–2024, accessed 2026-11-23", "BNPB DIBI 水文気象 2015–2024、2026-11-23 取得"),
    sourceUrl: "https://dibi.bnpb.go.id/", license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    sourceNotes: [l3("DISPLAY_ONLY：0 值佔 80%、欄位語意未說明，不做排名、風險比較", "DISPLAY_ONLY: 80% zeros and undocumented field meaning; no ranking or risk comparison", "表示専用（DISPLAY_ONLY）：0 が 80% で欄の意味も不明。順位付け・リスク比較はしない")],
    loading: l3("印尼水文氣象災害載入中", "Loading Indonesia hydrometeorological disasters", "インドネシアの水文気象災害を読み込み中"),
  },
  {
    key: "idBridges", file: "id_bridges.pmtiles", sourceId: "id-bridges", srcMinzoom: 7, srcMaxzoom: 14, color: "#fbbf24", count: 16_208,
    parts: [point("id-bridges-circle", "bridges", 7, bridgeGetter, { small: true })],
    cats: BRIDGE_CATS, heat: { intensity: 1.2 },
    title: { props: ["name"], fallback: l3("橋梁", "Bridge", "橋") },
    fields: [{ prop: "road_class", label: l3("道路等級", "Road class", "道路等級"), map: ROAD_CLASS_MAP }, ...KAB_FIELDS],
    legendNotes: [l3("放大至 z7 才顯示；BNPB 轉存基本地形圖，只有位置與道路等級，結構屬性未填", "Shown from z7; BNPB-hosted base topographic map with location and road class only, no structural attributes", "z7 以上で表示。BNPB 転載の基本地形図で位置と道路等級のみ、構造属性なし")],
    popupNotes: [NEAREST], sourceOrg: l3("BNPB Basemap／Jembatan，存取 2026-11-23", "BNPB Basemap / Jembatan, accessed 2026-11-23", "BNPB Basemap／Jembatan、2026-11-23 取得"),
    sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼橋梁載入中", "Loading Indonesia bridges", "インドネシアの橋を読み込み中"),
  },
  {
    key: "idWaterFacilities", file: "id_water_facilities.pmtiles", sourceId: "id-water-facilities", srcMinzoom: 5, srcMaxzoom: 14, color: "#2dd4bf", count: 3_184,
    parts: [point("id-water-facilities-circle", "facilities", 5, propGetter("kind"))],
    cats: FACILITY_CATS,
    title: { props: ["name", "name_en", "name_id"], fallback: l3("水利設施", "Water facility", "水利施設"), fallbackBy: REDACT_TITLE },
    fields: [
      { prop: "kind", label: l3("類別", "Type", "種別"), map: Object.fromEntries(FACILITY_CATS.map((c) => [c.values[0]!, c.label])) },
      ...KAB_FIELDS,
    ],
    legendNotes: [l3("OSM（非官方）：筆數是 OSM 物件數，不是壩座數；點線面並存不去重", "OSM (unofficial): counts are OSM objects, not dam counts; points, lines and polygons not de-duplicated", "OSM（非公式）：件数は OSM オブジェクト数でダムの数ではない。点・線・面は重複排除しない")],
    popupNotes: [NEAREST], sourceOrg: OSM_HOT, sourceUrl: OSM_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼水壩、堰與閘載入中", "Loading Indonesia dams, weirs and gates", "インドネシアのダム・堰・水門を読み込み中"),
  },
  {
    key: "idWatersheds", file: "id_watersheds.pmtiles", sourceId: "id-watersheds", srcMinzoom: 5, srcMaxzoom: 12, color: "#34d399", count: 42_210, opacity: 0.5,
    parts: [
      // 低縮放只畫細外框，z8 起才填色（泰國經驗：42,210 面鋪滿全國）
      { id: "id-watersheds-line", sourceLayer: "watersheds", geom: "line", minzoom: 5, cat: propGetter("criteria"), lineWidth: { DIPERTAHANKAN: [0.3, 0.8], DIPULIHKAN: [0.4, 1] } },
      { id: "id-watersheds-fill", sourceLayer: "watersheds", geom: "fill", minzoom: 8, cat: propGetter("criteria") },
    ],
    cats: WATERSHED_CATS,
    title: { props: ["name"], fallback: l3("流域", "Watershed", "流域") },
    fields: [
      { prop: "criteria_zh", label: l3("分級", "Class", "区分") },
      { prop: "bpdas", label: l3("管理機關（BPDAS）", "Managing office (BPDAS)", "管理機関（BPDAS）") },
      { prop: "area_ha", label: l3("面積", "Area", "面積"), kind: "num", unit: l3("公頃", "ha", "ha"), digits: 0 },
      ...KAB_FIELDS,
    ],
    legendNotes: [l3("42,210 個細流域；z8 以下只畫外框，z8 起填色；伺服端簡化約 30 m，面積以面積欄為準", "42,210 sub-watersheds; outlines only below z8, filled from z8; simplified ~30 m, use the area field for areas", "42,210 の細流域。z8 未満は外枠のみ、z8 以上で塗りつぶし。約 30 m に簡略化、面積は面積欄を使う")],
    popupNotes: [], sourceOrg: l3("BNPB（原資料 KLHK Klasifikasi DAS），存取 2026-11-23", "BNPB (original data KLHK Klasifikasi DAS), accessed 2026-11-23", "BNPB（原データ KLHK Klasifikasi DAS）、2026-11-23 取得"),
    sourceUrl: BNPB_URL, license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼流域載入中", "Loading Indonesia watersheds", "インドネシアの流域を読み込み中"),
  },
  {
    key: "idSubsidence", file: "id_subsidence.pmtiles", sourceId: "id-subsidence", srcMinzoom: 8, srcMaxzoom: 14, color: "#38bdf8", count: 502,
    parts: [point("id-subsidence-circle", "stations", 8, propGetter("year"))],
    cats: SUBSIDENCE_CATS, defaultCats: ["y2025"],
    title: { props: ["location"], fallback: l3("沉降觀測點", "Subsidence monitoring point", "地盤沈下観測点") },
    fields: [
      { prop: "year", label: l3("年份", "Year", "年"), kind: "year" },
      { prop: "rate_per_year_raw", label: l3("沉降速率（原值，單位未標）", "Subsidence rate (raw, unit not stated)", "沈下速度（原値、単位不明）"), kind: "num", digits: 3 },
      { prop: "kabkota_name", label: l3("縣市", "Regency / city", "県・市") },
    ],
    popupNotes: [{ text: l3("單位未標，各年量級不同，不可互比", "Unit not stated; magnitudes differ by year, not comparable", "単位不明で年ごとに桁が異なり、比較できない"), when: () => true }],
    legendNotes: [
      l3("各年速率不可互比（2023–24 量級 0.01–0.09、2025 量級 1–8，單位未標）；不分級著色，依年份篩選；預設只顯示 2025", "Rates are not comparable across years (2023–24 about 0.01–0.09, 2025 about 1–8, unit not stated); not graded by colour, filter by year; 2025 only by default", "年ごとの速度は比較不可（2023–24 は 0.01–0.09、2025 は 1–8 程度、単位不明）。色分けはせず年で絞り込み。既定は 2025 のみ"),
      l3("僅雅加達（502 筆、230 站）；開啟時飛到雅加達", "Jakarta only (502 records, 230 stations); the map flies to Jakarta when switched on", "ジャカルタのみ（502 件・230 観測点）。オンにするとジャカルタへ移動"),
    ],
    sourceOrg: l3("Pemprov DKI Jakarta，Satu Data Jakarta，存取 2026-11-23", "Jakarta provincial government, Satu Data Jakarta, accessed 2026-11-23", "ジャカルタ特別州政府 Satu Data Jakarta、2026-11-23 取得"),
    sourceUrl: "https://satudata.jakarta.go.id/", license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    loading: l3("雅加達地層下陷載入中", "Loading Jakarta land subsidence", "ジャカルタの地盤沈下を読み込み中"),
  },
  {
    key: "idNatureSpots", file: "id_nature_spots.pmtiles", sourceId: "id-nature-spots", srcMinzoom: 6, srcMaxzoom: 14, color: "#f472b6", count: 4_337,
    parts: [point("id-nature-spots-circle", "spots", 6, propGetter("kind"))],
    cats: SPOT_CATS,
    title: { props: ["name", "name_en", "name_id"], fallback: l3("景點", "Attraction", "名所"), fallbackBy: { prop: "kind", map: SPOT_KIND_MAP } },
    fields: [{ prop: "kind", label: l3("類別", "Type", "種別"), map: SPOT_KIND_MAP }, ...KAB_FIELDS],
    legendNotes: [l3("放大至 z6 才顯示；OSM（非官方），attraction 為泛稱、含人文景點", "Shown from z6; OSM (unofficial), 'attraction' is generic and includes cultural sites", "z6 以上で表示。OSM（非公式）。attraction は総称で人文系名所を含む")],
    popupNotes: [NEAREST], sourceOrg: OSM_HOT, sourceUrl: OSM_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼景點載入中", "Loading Indonesia attractions", "インドネシアの名所を読み込み中"),
  },
  {
    key: "idConservationForest", file: "id_conservation_forest.pmtiles", sourceId: "id-conservation-forest", srcMinzoom: 4, srcMaxzoom: 12, color: "#22c55e", count: 15_792, opacity: 0.5,
    parts: [
      // 低縮放只畫細外框，z7 起填色
      { id: "id-forest-line", sourceLayer: "zones", geom: "line", minzoom: 4, cat: propGetter("function_code"), lineWidth: Object.fromEntries(["HL", "HSAW", "KSPA", "TN", "TNL", "TWAL", "CA", "SM", "TWA", "TWA/HW", "TAHURA", "TB"].map((k) => [k, [0.3, 0.8] as const])) },
      { id: "id-forest-fill", sourceLayer: "zones", geom: "fill", minzoom: 7, cat: propGetter("function_code") },
    ],
    cats: FOREST_CATS, otherColor: "#94a3b8", otherLabel: l3("其他功能分區", "Other functions", "その他の機能区分"),
    title: { props: [], fallback: l3("保護與保育林分區", "Protection / conservation forest zone", "保護林・保全林区分") },
    fields: [
      { prop: "function_en", label: l3("功能分區", "Function", "機能区分"), map: FOREST_FN_MAP },
      { prop: "area_km2", label: l3("面積", "Area", "面積"), kind: "num", unit: "km²", digits: 1 },
      ...KAB_FIELDS,
    ],
    popupNotes: [{ text: l3("舊版資料（STALE）", "Legacy data (STALE)", "旧版データ（STALE）"), when: (p) => p.stale === true || str(p.stale) === "true" }, NEAREST],
    legendNotes: [l3("舊版（STALE）：只有保護、保育類，無生產林；z7 以下只畫外框", "Legacy (STALE): protection and conservation classes only, no production forest; outlines only below z7", "旧版（STALE）：保護・保全区分のみで生産林なし。z7 未満は外枠のみ")],
    sourceOrg: l3("BNPB（原資料 WRI／Global Forest Watch 舊版），存取 2026-11-23", "BNPB (original data WRI / Global Forest Watch, legacy), accessed 2026-11-23", "BNPB（原データ WRI／Global Forest Watch 旧版）、2026-11-23 取得"),
    sourceUrl: "https://data.globalforestwatch.org/", license: UNSTATED, fetchedAt: ID_FETCHED_AT,
    sourceNotes: [l3("舊版資料（年份未標，STALE）；服務描述稱限 Kalimantan，實測涵蓋 38/38 省，以實測為準", "Legacy data (year not stated, STALE); the service description says Kalimantan only but 38/38 provinces were measured", "旧版データ（年不明、STALE）。サービス説明は Kalimantan 限定だが実測では 38/38 州")],
    loading: l3("印尼保育林載入中", "Loading Indonesia conservation forest", "インドネシアの保全林を読み込み中"),
  },
  {
    key: "idCamps", file: "id_camps.pmtiles", sourceId: "id-camps", srcMinzoom: 6, srcMaxzoom: 14, color: "#f59e0b", count: 704,
    parts: [point("id-camps-circle", "camps", 6, propGetter("kind"))],
    cats: CAMP_CATS,
    title: { props: ["name", "name_en", "name_id"], fallback: l3("營地", "Camp", "キャンプ場"), fallbackBy: { prop: "kind", map: CAMP_KIND_MAP } },
    fields: [{ prop: "kind", label: l3("類別", "Type", "種別"), map: CAMP_KIND_MAP }, ...KAB_FIELDS],
    legendNotes: [l3("放大至 z6 才顯示；OSM（非官方）；營地 586、山屋 118（印尼山屋極稀）", "Shown from z6; OSM (unofficial); 586 campsites, 118 huts (huts are rare in Indonesia)", "z6 以上で表示。OSM（非公式）。キャンプ場 586・山小屋 118（インドネシアでは稀）")],
    popupNotes: [NEAREST], sourceOrg: OSM_HOT, sourceUrl: OSM_URL, license: ODBL, fetchedAt: ID_FETCHED_AT,
    loading: l3("印尼營地載入中", "Loading Indonesia camps", "インドネシアのキャンプ場を読み込み中"),
  },
];
void fu;
