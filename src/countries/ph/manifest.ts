// 菲律賓國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { PhLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { type PhDataKey } from "./keys";
import { PH_DATA_SPECS } from "./phDataLayers";
import { PH_RASTER_SPECS } from "./phWavesLayers";
import { PH_WAVE_ENTRY_META } from "./phWavesMeta";
import { Building2, Bus, Factory, Fuel, type LucideIcon, Map, Milestone, Mountain, Plane, Route, Spline, Sun, TrainFront, TrainTrack, Trees, Users, Wind, Zap } from "lucide-react";

/** 菲律賓第 1 波規格驅動 8 層（規格 SSOT 在 phDataLayers.ts；畫法 usePhDataLayer；主題與群組比照加拿大、愛爾蘭）。 */
const PH_DATA_ENTRY_META: Record<PhDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  // 觀光波與第 2–9 波（2026-11-16）：中介資料在 phWavesMeta.ts
  ...PH_WAVE_ENTRY_META,
  phTransportHubs: { theme: "交通", group: "樞紐節點", zh: "機場與港口", alt: "Airports & Ports", icon: Plane, dataset: "ph_transport_hubs", topics: ["菲律賓", "交通", "機場", "港口", "DOTr", "PPA", "OSM"],
    description: "菲律賓機場與港口 580 處（DOTr 機場、PPA 港口與港務管理處；OpenStreetMap 補缺另色）", processing: "Geoportal Philippines（NAMRIA）WMS GetFeatureInfo 取 DOTr／PPA 圖層 → 4326；HOT／HDX OSM 補缺；PMTiles hubs z4–14；卡拉延群島 1 處不畫；v2 排除 Region VII 填海工業用地 1 處（analytics #393）", note: "Geoportal 未附授權條文（標來源）＋OSM ODbL；官方機場座標多為城鎮近似位置" },
  phStations: { theme: "交通", group: "場站", zh: "鐵路車站與渡輪碼頭", alt: "Rail Stations & Ferry Terminals", icon: TrainFront, dataset: "ph_stations", topics: ["菲律賓", "交通", "車站", "鐵路", "PNR", "LRT", "MRT", "渡輪", "OSM"],
    description: "菲律賓鐵路車站與渡輪碼頭 476 處（官方 PNR 站；其他鐵路站與渡輪碼頭由 OpenStreetMap 補缺；標示營運狀態，PNR 都會段與 Alabang–Calamba 停駛 32 站；LRT／MRT 車站改由 LRT／MRT 層提供；鐵路站涵蓋 3/18 region）", processing: "Geoportal Philippines WMS 取 PNR 車站 → 4326；HOT／HDX OSM 補缺；PMTiles stations z4–14；v2（analytics #393）加 status／status_basis，排除未通車 37 站與誤標 Mapaya；前端濾掉與第 2 波 LRT／MRT 車站重複的 OSM 鐵路站 48 處", note: "Geoportal 未附授權條文＋OSM ODbL；公車站另見公車站層" },
  phMajorRoads: { theme: "交通", group: "路網", zh: "主要道路與鐵道", alt: "Major Roads & Railways", icon: Route, dataset: "ph_major_roads", topics: ["菲律賓", "交通", "道路", "高速公路", "鐵道", "OSM"],
    description: "菲律賓主要道路 46,794 段（motorway／trunk／primary）＋鐵道 635 段（OpenStreetMap）", processing: "HOT Export Tool／HDX OSM 道路與鐵道分類檔 → 4326；_link 併入同級；PMTiles roads、rail z4–13", note: "ODbL 1.0；LRT／MRT 路線不在、DPWH 官方高速公路未出圖" },
  phPowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠", alt: "Power Plants", icon: Factory, dataset: "ph_power_plants", topics: ["菲律賓", "能源", "電廠", "發電", "燃煤", "地熱", "GEM", "Climate TRACE"],
    description: "菲律賓電廠 1,051 處（Global Energy Monitor 9 種技術，Climate TRACE 補缺；預設只顯示運轉中＋興建中）", processing: "GEM 各 tracker xlsx 濾菲律賓 → 依技術合併；Climate TRACE（HDX）補缺；PMTiles plants z3–14", note: "CC BY 4.0（GEM）；6 筆光電來自 TransitionZero（CC BY-NC 4.0，非商業授權，popup 標示）" },
  phPowerGrid: { theme: "能源", group: "電力 · 電網", zh: "輸電線與變電所", alt: "Power Lines & Substations", icon: Zap, dataset: "ph_power_grid", topics: ["菲律賓", "能源", "電網", "輸電線", "變電所", "海底電纜", "OSM"],
    description: "菲律賓輸電線 5,693 段（依電壓分級，地下與海底電纜虛線）＋變電所 904 處（OpenStreetMap）", processing: "Overture Maps（OSM 衍生）infrastructure power line／cable／substation → 4326；依 voltage 分 kv_class；PMTiles lines、substations z4–14", note: "ODbL 1.0；OSM 覆蓋不均，非官方電網圖" },
  phRenewables: { theme: "能源", group: "再生能源", zh: "家用太陽能補助與離網微電網", alt: "Solar Home System Subsidies & Off-grid Microgrids", icon: Sun, dataset: "ph_renewables", topics: ["菲律賓", "能源", "再生能源", "太陽能", "微電網", "離網", "DOE"],
    description: "菲律賓 DOE 家用太陽能系統補助安裝地點 708 處（PVM，依鄉鎮彙整）＋離網微電網 96 處；補助安裝地點，非全國光電", processing: "Department of Energy Open Data API → 4326；PVM 依鄉鎮合併筆數與台數；PMTiles renewables z4–14", note: "DOE 公有領域；沒有點的省份是未涵蓋，不是沒有太陽能" },
  phFuelStations: { theme: "能源", group: "石化 · 加油站", zh: "加油站", alt: "Fuel Stations", icon: Fuel, dataset: "ph_fuel_stations", topics: ["菲律賓", "能源", "加油站", "OSM", "Petron", "Shell", "Caltex"],
    description: "菲律賓加油站 10,100 處（OpenStreetMap；依品牌 8 色，其餘併「其他／未知品牌」）", processing: "HOT Export Tool／HDX OSM amenity=fuel → 代表點；品牌正規化；PMTiles fuel z5–14", note: "ODbL 1.0；OSM 覆蓋不均" },
  phPipelines: { theme: "能源", group: "管線與儲槽", zh: "管線與儲槽", alt: "Pipelines & Storage Tanks", icon: Spline, dataset: "ph_pipelines", topics: ["菲律賓", "能源", "管線", "儲槽", "油氣", "地熱", "OSM"],
    description: "菲律賓管線 825 段＋儲槽 2,241 處（OpenStreetMap；依內容物分油氣、水、污水、地熱蒸汽、其他、未標示）", processing: "Overture Maps（OSM 衍生）man_made=pipeline／storage_tank → 4326；依 substance／content 分 content_group；PMTiles pipelines、tanks z5–14", note: "ODbL 1.0；多數未標示內容物，不是油氣管線全圖" },
  // 第 2 波補充（2026-11-14）：Geofabrik philippines-261113 快照
  phBusStops: { theme: "交通", group: "場站", zh: "公車站", alt: "Bus Stops", icon: Bus, dataset: "ph_bus_stops", topics: ["菲律賓", "交通", "公車", "巴士", "公車站", "OSM"],
    description: "菲律賓 OpenStreetMap 標註的公車站 9,313 處（涵蓋不均，82 省中 9 省未涵蓋；近 4 成在馬尼拉都會區）", processing: "Geofabrik philippines-261113.osm.pbf（GDAL OSM driver）取 highway=bus_stop 或 public_transport=platform＋bus=yes；面與線取代表點；同名 ≤5 m 等明顯重複去除 108 筆；PMTiles bus_stops z4–14", note: "ODbL 1.0；OSM 志願者標註，涵蓋不均；吉普尼多無固定站牌" },
  phUrbanRail: { theme: "交通", group: "路網", zh: "LRT／MRT 軌道與車站", alt: "LRT / MRT Lines & Stations", icon: TrainTrack, dataset: "ph_urban_rail", topics: ["菲律賓", "交通", "軌道", "捷運", "LRT", "MRT", "馬尼拉", "OSM"],
    description: "馬尼拉營運中的 LRT-1、LRT-2、MRT-3：軌道 523 段（機廠軌不畫）＋車站 51 站（依線別分色；MRT-7 與 Metro Manila Subway 尚未通車、未納入）", processing: "Geofabrik philippines-261113.osm.pbf 取 railway=light_rail／subway 與 LRT／MRT 車站（顯式 tag＋60 m 內同類型營運軌道）；依官方狀態排除未通車的 MRT-7、Subway；PMTiles tracks、routes、stations z4–14（前端不畫 routes 與 service=yard）", note: "ODbL 1.0；未通車線 2026-11-14 依 DOTr 公開資訊查證" },
  phExpressways: { theme: "交通", group: "路網", zh: "高速公路與收費道路", alt: "Expressways & Toll Roads", icon: Milestone, dataset: "ph_expressways", topics: ["菲律賓", "交通", "道路", "高速公路", "收費道路", "NLEX", "SLEX", "OSM"],
    description: "菲律賓高速公路與收費道路 5,550 段、1,417 km（依收費分色，彈窗列路線編號 E1–E6；toll 未標不等於免費）", processing: "Geofabrik philippines-261113.osm.pbf 取 highway=motorway／motorway_link 全部，加上 toll=yes 的現役道路（排除 proposed、construction）；PMTiles expressways z4–14", note: "ODbL 1.0；與主要道路層的高速公路約 98% 重疊；僅 5／18 region 有路段" },
};

const PH_DATA_MANIFEST_ENTRIES = Object.fromEntries(PH_DATA_SPECS.map((spec) => {
  const m = PH_DATA_ENTRY_META[spec.key];
  const hasPoint = spec.parts.some((x) => x.geom === "point");
  const layers = spec.parts.map((x) => `${x.sourceLayer}`).join("／");
  const kinds = ["multiSelect", ...(spec.key === "phPowerPlants" ? ["multiSelect"] : []), ...(spec.heat ? ["palette"] : []), "slider", ...(hasPoint ? ["slider"] : [])] as ("multiSelect" | "palette" | "slider")[];
  return [spec.key, {
    key: spec.key,
    country: "PH", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `usePhDataLayer 自建 mapbox-pmtiles source；source-layer=${layers}，source z${spec.srcMinzoom}–${spec.srcMaxzoom}${spec.extraFiles ? `；依緯度分 ${spec.extraFiles.length + 1} 檔` : ""}`,
      staticAssets: [`./world/${spec.file}`, ...(spec.extraFiles ?? []).map((f) => `./world/${f.file}`)] },
    legend: spec.key,
    popup: spec.key,
    params: { count: kinds.length, kinds },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<PhDataKey, LayerManifestEntry>;

/** 菲律賓 raster 4 層（2026-11-16 第 2、6 波）：PNG PMTiles，無 feature 屬性與 popup（同 caHillshade）。 */
const PH_RASTER_META: Record<string, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  phTerrainHillshade: { theme: "底圖", group: "地形", zh: "山體陰影", alt: "Hillshade", icon: Mountain, dataset: "ph_terrain", topics: ["菲律賓", "底圖", "地形", "陰影", "Copernicus DEM"],
    description: "菲律賓山體陰影（Copernicus DEM GLO-90，約 90 m；只保留陸域）", processing: "Copernicus DEM GLO-90（AWS Open Data，109 格）→ gdaldem hillshade（-z 2 -az 315 -alt 45）→ 18 region 陸域遮罩、扣卡拉延 → PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；22.4 MB 走 deploy-assets；沒有 feature 屬性與 popup" },
  phTerrainRelief: { theme: "底圖", group: "地形", zh: "色別標高", alt: "Elevation Tint", icon: Mountain, dataset: "ph_terrain", topics: ["菲律賓", "底圖", "地形", "標高", "Copernicus DEM"],
    description: "菲律賓色別標高（0–2,954 m 九段色帶，≤0 m 透明）", processing: "Copernicus DEM GLO-90 → gdaldem color-relief（≤0 m 透明）→ 陸域遮罩 → PNG raster PMTiles z5–10", note: "Copernicus DEM（免費、要署名）；沒有 feature 屬性與 popup" },
  phBuiltSurface: { theme: "都市分析", group: "都市紋理", zh: "建成面積比例", alt: "Built-up Surface", icon: Building2, dataset: "ph_built_surface", topics: ["菲律賓", "都市", "建成區", "GHSL"],
    description: "菲律賓建成面積比例（JRC GHSL 2025 推估，100 m；<1% 透明）", processing: "GHS-BUILT-S E2025 R2023A（HDX 菲律賓裁切）Mollweide → 4326 → 3857；color-relief → PNG raster PMTiles z5–11", note: "CC BY 4.0；衛星分類推估，不是建物普查；30.4 MB 走 deploy-assets" },
  phForestLoss: { theme: "自然保育", group: "森林保育", zh: "樹冠流失年份", alt: "Tree Cover Loss Year", icon: Trees, dataset: "ph_forest_loss", topics: ["菲律賓", "自然保育", "森林", "毀林", "Hansen"],
    description: "菲律賓樹冠流失年份 2001–2024（Hansen GFC，30 m；淡黃→深紅）", processing: "Hansen GFC v1.12 lossyear 菲律賓圖幅 → -r max 降採樣 → color-relief（0 透明）→ PNG raster PMTiles z5–12", note: "CC BY 4.0；樹冠流失≠毀林；59.8 MB 走 deploy-assets" },
};

const PH_RASTER_MANIFEST_ENTRIES = Object.fromEntries(PH_RASTER_SPECS.map((spec) => {
  const m = PH_RASTER_META[spec.key]!;
  return [spec.key, {
    key: spec.key,
    country: "PH", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.steps?.[spec.steps.length - 1]?.color ?? "#9ca3af",
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: m.note },
    dataClass: "D",
    source: { kind: "custom", note: `usePhRasterLayer 自建 mapbox-pmtiles raster source（pmtilesRasterCustomSource）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}，插在底圖第一個 symbol 下`, staticAssets: [`./world/${spec.file}`] },
    legend: spec.key,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: m.description,
    topics: m.topics,
  }];
})) as Record<(typeof PH_RASTER_SPECS)[number]["key"], LayerManifestEntry>;


export const PH_PACK_MANIFEST = {
  ...PH_DATA_MANIFEST_ENTRIES,
  ...PH_RASTER_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇵🇭 菲律賓 Philippines（2026-11-13 第 0–1 波：C001 行政邊界、C023 人口；其餘 8 層由 PH_DATA_MANIFEST_ENTRIES 派生）
  // ══════════════════════════════════════════════════════════════
  phAdminBoundaries: {
    key: "phAdminBoundaries",
    country: "PH", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ph_admin_boundaries", confidence: "HIGH" }],
      processing: "OCHA／PSA／NAMRIA COD-AB（HDX）region 18、province 級 88（82 省＋NCR 4 district、Isabela 市、BARMM 特別地理區）、municipality 1,642、barangay 42,048 → 4326；PMTiles tile layer region z3–10／province z4–11／municipality z6–12／barangay z9–13；卡拉延群島（Kalayaan）市鎮與 barangay 不畫",
      note: "CC BY-IGO 3.0（© OCHA、PSA、NAMRIA）；不畫海域主張線；region、province 面含卡拉延群島碎片（來源合併，無法分開）；邊界依 OCHA 資料，不代表任何立場",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "usePhAdminLayers 自建 mapbox-pmtiles source；source-layer=region／province／municipality／barangay（select 擇一）",
      staticAssets: ["./world/ph_admin_boundaries.pmtiles"],
    },
    legend: "phAdminBoundaries",
    popup: "phAdminBoundaries",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "菲律賓行政區界（區域 18、省 88、市鎮 1,642、barangay 42,048；OCHA／PSA／NAMRIA COD-AB）",
    topics: ["菲律賓", "行政區", "邊界", "barangay", "PSGC"],
  },
  phPopulation: {
    key: "phPopulation",
    country: "PH", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口密度", alt: "Population Density", qualifier: "2024 Census" }),
    expandable: true,
    color: "#f59e0b",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "ph_population", confidence: "HIGH" }],
      processing: "PSA 2024 Census of Population（OpenSTAT 0231A6DPUP0）依 PSGC 接 COD-AB 四層級面 → 人口密度（人／km²）；市鎮以上缺值以 barangay 加總；PMTiles 同行政區界四層",
      note: "PSA OpenSTAT 未附授權條文（註明發布機關）；未對上的 barangay 等標「未涵蓋」畫灰，不是 0",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "usePhPopulationLayers 自建 mapbox-pmtiles source；source-layer=region／province／municipality／barangay（select 擇一）",
      staticAssets: ["./world/ph_population.pmtiles"],
    },
    legend: "phPopulation",
    popup: "phPopulation",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "菲律賓 2024 普查人口與人口密度（區域、省、市鎮、barangay 四層級；未涵蓋畫灰）",
    topics: ["菲律賓", "人口", "人口密度", "普查", "PSA", "barangay"],
  },
  phOpenaqAir: {
    key: "phOpenaqAir",
    country: "PH", section: { theme: "環境氣候", group: "空品" },
    ...layerName({ zh: "即時空品（低價感測器為主）", alt: "Air Quality Sensors", qualifier: "OpenAQ" }),
    expandable: true,
    color: "#7e57c2", // 同 LASS 微型感測（aqiMicroSensors）
    icon: Wind,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "openaq_ph", confidence: "HIGH" }],
      processing: "data-collectors collector openaq（pulse-host，每 60 分）→ live.openaq_locations／live.openaq_measurements（gis-platform mig 561，量測留 37 天，S3 openaq/archives/ 永久）→ RPC get_openaq_latest（mig 563，每站一列、48 小時內各參數最新值）；前端隱藏近 30 天無資料的站、量測超過 3 小時標過舊",
      note: "每站授權不同（CC0 1.0／CC BY 4.0／US Public Domain；部分站 OpenAQ 未提供授權資訊），popup 依每站 attribution_name 署名並註明 via OpenAQ。116 站中 114 站是低價感測器（Clarity、AirGradient），非官方測站；2 個官方站（AirNow、Spartan）2026-02 起停更、目前不顯示",
    },
    dataClass: "D",
    source: {
      kind: "custom",
      note: "usePhOpenaqAirLayer：Supabase RPC get_openaq_latest（10 分鐘輪詢）→ 自建 GeoJSON source ph-openaq-air＋circle ph-openaq-air-circle（非 OVERLAY_REGISTRY）；快照錨在掛鐘現在、不跟時間軸；popup 走勢 RPC get_openaq_location_series",
    },
    legend: "phOpenaqAir",
    popup: "phOpenaqAir",
    params: { count: 2, kinds: ["slider", "slider"] },
    description: "菲律賓 OpenAQ 空品測站即時 PM2.5（多為低價感測器、非官方測站；每小時更新，過舊與無資料另外標示）",
    topics: ["菲律賓", "空品", "PM2.5", "即時", "OpenAQ", "低價感測器"],
  },
  // <codemod:append PH_PACK_MANIFEST>
} satisfies Record<PhLayerKey, LayerManifestEntry>;
