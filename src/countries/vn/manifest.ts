// 越南國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { VnLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { type VnDataKey } from "./keys";
import { VN_DATA_SPECS } from "./vnDataLayers";
import { VN_RASTER_SPECS } from "./vnWavesLayers";
import { VN_RASTER_META, VN_WAVE_ENTRY_META } from "./vnWavesMeta";
import { Activity, Building2, Factory, Fuel, type LucideIcon, Map, Plane, Route, Spline, Sun, TrainFront, Users, Zap } from "lucide-react";

/** 越南第 1 波規格驅動 10 層（規格 SSOT 在 vnDataLayers.ts；畫法重用 usePhDataLayer；主題與群組比照菲律賓、愛爾蘭）。 */
const VN_DATA_ENTRY_META: Record<VnDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  // 觀光波與第 2–7 波（2026-11-17）：中介資料在 vnWavesMeta.ts
  ...VN_WAVE_ENTRY_META,
  vnStations: { theme: "交通", group: "場站", zh: "車站（鐵路、捷運、公車總站）", alt: "Rail, Metro & Bus Stations", icon: TrainFront, dataset: "vn_stations", topics: ["越南", "交通", "車站", "鐵路", "捷運", "公車", "OSM"],
    description: "越南車站 989 處（鐵路站 293、捷運站 166、公車總站 530；OpenStreetMap 補缺，官方無全國站名冊）", processing: "Geofabrik vietnam-latest.osm.pbf 抽 railway=station／public_transport=station 等 → 代表點；34 省空間判定；PMTiles stations z4–14", note: "ODbL 1.0；官方無全國站名冊" },
  vnTransportHubs: { theme: "交通", group: "樞紐節點", zh: "機場與港口", alt: "Airports & Ports", icon: Plane, dataset: "vn_transport_hubs", topics: ["越南", "交通", "機場", "港口", "ODM", "OSM"],
    description: "越南機場 25、港口 54（Open Development Vietnam 2019／2021）＋OSM 補缺機場 19（另色）", processing: "ODM CKAN 機場、港口 → 4326；OSM 補缺機場與 ODM 距離 >5 km 者；ODM 與 OSM 分兩支 PMTiles（airports、ports／airports_osm z3–14）", note: "ODM 標 CC BY-SA 4.0 但 copyright To be determined（授權未明示）；OSM ODbL；資料年 2019／2021" },
  vnMajorRoads: { theme: "交通", group: "路網", zh: "主要道路與鐵道", alt: "Major Roads & Railways", icon: Route, dataset: "vn_major_roads", topics: ["越南", "交通", "道路", "高速公路", "國道", "鐵道", "OSM"],
    description: "越南主要道路 49,830 段（motorway／trunk／primary）＋鐵道 2,442 段（興建中虛線；OpenStreetMap）", processing: "Geofabrik PBF 抽 highway motorway／trunk／primary（_link 併入同級）與 railway → 4326；PMTiles roads、rail z4–13", note: "ODbL 1.0；道路等級是 OSM 類別，不是法定分級" },
  vnPowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠", alt: "Power Plants", icon: Factory, dataset: "vn_power_plants", topics: ["越南", "能源", "電廠", "發電", "水力", "燃煤", "GEM"],
    description: "越南電廠 253 處（Global Energy Monitor：水力、燃煤、燃氣、生質、核能、地熱；預設只顯示運轉中＋興建中；風光在再生能源層）", processing: "GEM 各 tracker xlsx 濾越南 → 依技術、狀態合併；34 省空間判定；PMTiles plants z3–14", note: "CC BY 4.0（GEM）；風電與太陽能不在本層，兩層不要合計" },
  vnRenewables: { theme: "能源", group: "再生能源", zh: "風電、太陽能與充電站", alt: "Wind, Solar & EV Charging", icon: Sun, dataset: "vn_renewables", topics: ["越南", "能源", "再生能源", "風電", "太陽能", "充電站", "GEM", "TransitionZero", "OSM"],
    description: "越南風電與太陽能 842 處（GEM）＋TransitionZero 光電 1,017 處（CC BY-NC，非商用）＋電動車充電站 376 處（OSM）", processing: "GEM Wind／Solar tracker 濾越南；Solar 的 TransitionZero 子集另成 solar_tz 子圖層；OSM amenity=charging_station；GEM 與 OSM 分兩支 PMTiles", note: "CC BY 4.0（GEM）；solar_tz CC BY-NC 4.0（非商用，popup 逐筆標示）；OSM ODbL" },
  vnPowerGrid: { theme: "能源", group: "電力 · 電網", zh: "輸電線與變電所", alt: "Power Lines & Substations", icon: Zap, dataset: "vn_power_grid", topics: ["越南", "能源", "電網", "輸電線", "變電所", "OSM"],
    description: "越南輸電線 11,656 段（依電壓分級，電纜虛線）＋變電所 1,431 處（OpenStreetMap）", processing: "Geofabrik PBF 抽 power=line／cable／substation → 4326；依 voltage 最大值分 kv_class；PMTiles lines、substations z4–14", note: "ODbL 1.0；OSM 覆蓋不均，非官方電網圖" },
  vnFuelStations: { theme: "能源", group: "石化 · 加油站", zh: "加油站", alt: "Fuel Stations", icon: Fuel, dataset: "vn_fuel_stations", topics: ["越南", "能源", "加油站", "OSM", "Petrolimex", "PVOIL"],
    description: "越南加油站 4,902 處（OpenStreetMap；Petrolimex、PVOIL 等品牌分色）", processing: "Geofabrik PBF 抽 amenity=fuel → 代表點；品牌正規化；PMTiles fuel z5–14", note: "ODbL 1.0；品牌未知 2,040 站" },
  vnOilGas: { theme: "能源", group: "石化 · 油氣", zh: "油氣設施", alt: "Oil & Gas Facilities", icon: Spline, dataset: "vn_oil_gas", topics: ["越南", "能源", "油氣", "LNG", "管線", "煉油廠", "儲槽", "GEM", "OSM"],
    description: "越南 LNG 接收站 33、煤炭碼頭 5、油氣管線 12（GEM，含提案與取消）＋煉油廠 2、儲槽 75、天然氣管線 65（OSM）", processing: "GEM GGIT／GOIT／Coal Terminals 濾越南；OSM 煉油廠、儲槽、管線；GEM 與 OSM 分兩支 PMTiles", note: "CC BY 4.0（GEM）；OSM ODbL；GEM 狀態含提案、取消（狀態篩選）" },
  vnEnvisoftStations: { theme: "環境氣候", group: "環境監測站", zh: "環境自動監測站位置", alt: "Environmental Monitoring Stations", icon: Activity, dataset: "vn_envisoft_stations", topics: ["越南", "環境", "空氣品質", "水質", "排放", "監測站", "envisoft"],
    description: "越南環境自動監測站 2,176 處（envisoft：空品、地面水、海水、廢水排放口、煙道；只有位置、沒有數值）", processing: "envisoft.gov.vn 站點清單 → 4326；站名後綴判定類型；34 省空間判定；PMTiles stations z4–14", note: "來源 envisoft.gov.vn，授權未明示；只上位置、不上數值（使用者 2026-11-10）" },
  vnAngiangDemo: { theme: "工商登記", group: "安江示範", zh: "安江工業群與避洪居民點", alt: "An Giang Industrial Clusters & Flood Resettlement", icon: Building2, dataset: "vn_angiang_demo", topics: ["越南", "安江", "工業群", "避洪", "示範"],
    description: "越南安江省工業群 13 處（面）＋避洪居民點 59 處（只涵蓋安江省，原堅江範圍）", processing: "安江省開放資料入口 GIS 圖層 → 4326；行政代碼為舊制、不換算新社；PMTiles industrial_clusters、flood_resettlement z6–14", note: "授權未明示；只涵蓋安江省，其他 33 省是未涵蓋" },
};

const VN_DATA_MANIFEST_ENTRIES = Object.fromEntries(VN_DATA_SPECS.map((spec) => {
  const m = VN_DATA_ENTRY_META[spec.key];
  const parts = [...spec.parts, ...(spec.more?.parts ?? [])];
  const hasPoint = parts.some((x) => x.geom === "point");
  const layers = parts.map((x) => `${x.sourceLayer}`).join("／");
  const files = [spec.file, ...(spec.more ? [spec.more.file] : [])];
  const kinds = ["multiSelect", ...(spec.statusDefault ? ["multiSelect"] : []), "slider", ...(hasPoint ? ["slider"] : [])] as ("multiSelect" | "slider")[];
  return [spec.key, {
    key: spec.key,
    country: "VN", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `usePhDataLayer（越南規格）自建 mapbox-pmtiles source；source-layer=${layers}`, staticAssets: files.map((f) => `./world/${f}`) },
    legend: spec.key,
    popup: spec.key,
    params: { count: kinds.length, kinds },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<VnDataKey, LayerManifestEntry>;

/** 越南 raster 4 層（2026-11-17 第 2、3、6 波）：PNG PMTiles，無 feature 屬性與 popup（同 caHillshade）。WDPCA 站主限定（OWNER_ONLY，圖磚走私有 owner-data）。 */
const VN_RASTER_MANIFEST_ENTRIES = Object.fromEntries(VN_RASTER_SPECS.map((spec) => {
  const m = VN_RASTER_META[spec.key];
  const sourceNote = spec.kind === "owner"
    ? `useVnRasterLayer 自建 mapbox-pmtiles raster source（站主限定：useOwnerPmtilesSource 取私有 owner-data 簽名網址，無公開 fallback）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}`
    : `useVnRasterLayer 自建 mapbox-pmtiles raster source（pmtilesRasterCustomSource）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}，插在底圖第一個 symbol 下`;
  return [spec.key, {
    key: spec.key,
    country: "VN", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.steps?.[spec.steps.length - 1]?.color ?? spec.swatches?.[0]?.color ?? "#9ca3af",
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: sourceNote, staticAssets: spec.kind === "pmtiles" ? [`./world/${spec.file}`] : [`PRIVATE_OWNER_ONLY: ${spec.file}`] },
    legend: spec.key,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: m.description,
    topics: spec.kind === "owner" ? [...m.topics, "OWNER_ONLY"] : m.topics,
  }];
})) as Record<(typeof VN_RASTER_SPECS)[number]["key"], LayerManifestEntry>;


export const VN_PACK_MANIFEST = {
  ...VN_DATA_MANIFEST_ENTRIES,
  ...VN_RASTER_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇻🇳 越南 Vietnam（2026-11-13 第 0–1 波：C001 行政邊界、C023 人口；其餘 10 層由 VN_DATA_MANIFEST_ENTRIES 派生）
  // ══════════════════════════════════════════════════════════════
  vnAdminBoundaries: {
    key: "vnAdminBoundaries",
    country: "VN", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "vn_admin_boundaries", confidence: "HIGH" }],
      processing: "OCHA COD-AB Viet Nam v02（HDX）2025-07 新制 34 省面＋NSO 3,321 社代碼表（沒有社界幾何）→ 4326；移除 Hoàng Sa／Trường Sa 特區 part；PMTiles province、province_label z3–12",
      note: "CC BY-IGO 3.0（面）；NSO 代碼表授權未明示；不畫海上界線、西沙南沙；邊界依 OCHA 資料，不代表任何立場",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useVnAdminLayers 自建 mapbox-pmtiles source；source-layer=province（線＋點擊面）／province_label（省名）",
      staticAssets: ["./world/vn_admin_boundaries.pmtiles"],
    },
    legend: "vnAdminBoundaries",
    popup: "vnAdminBoundaries",
    params: { count: 1, kinds: ["slider"] },
    description: "越南行政區界（2025-07 新制 34 省；3,321 社只有代碼表、沒有社界；OCHA COD-AB v02）",
    topics: ["越南", "行政區", "邊界", "34 省", "COD-AB"],
  },
  vnPopulation: {
    key: "vnPopulation",
    country: "VN", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口密度", alt: "Population Density", qualifier: "2025" }),
    expandable: true,
    color: "#f59e0b",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "vn_population", confidence: "HIGH" }],
      processing: "NSO PL.V02.01（2025，34 省）人口與密度；2011–2024 由 V02.01 舊 63 省加總成新省（Tiền Giang 整省計入 Đồng Tháp）；接 COD-AB 34 省面；PMTiles province z3–10",
      note: "Cục Thống kê（NSO）授權未明示；邊界依 OCHA 資料，不代表任何立場",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "useVnPopulationLayers 自建 mapbox-pmtiles source；source-layer=province",
      staticAssets: ["./world/vn_population.pmtiles"],
    },
    legend: "vnPopulation",
    popup: "vnPopulation",
    params: { count: 1, kinds: ["slider"] },
    description: "越南 2025 年人口與人口密度（34 省；2011–2025 歷年人口折線）",
    topics: ["越南", "人口", "人口密度", "NSO", "34 省"],
  },
  // <codemod:append VN_PACK_MANIFEST>
} satisfies Record<VnLayerKey, LayerManifestEntry>;
