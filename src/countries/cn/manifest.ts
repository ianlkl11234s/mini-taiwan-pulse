// 中國國家包：manifest.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnLayerKey } from "./keys";
import type { LayerManifestEntry } from "../../data/layerManifest";
import { layerName } from "../../data/layerManifest";
import { CN_DATA_SPECS, CN_OWNER_ASSETS, CN_RASTER_SPECS } from "./cnDataLayers";
import { type CnDataKey, type CnRasterKey } from "./keys";
import { Activity, Anchor, Bus, Construction, Droplets, Factory, Fish, GraduationCap, Grid3x3, Leaf, type LucideIcon, Map, MapPin, Mountain, Plane, Radiation, Route, Spline, Sprout, Stethoscope, TreePine, Users, Waves, Zap } from "lucide-react";

/**
 * 中國第 0–1 波（2026-11-13）：9 層全部站主限定（使用者 2026-11-10；topics OWNER_ONLY，gis-platform public.gated_layers 同名單）。
 * 圖磚只在私人 owner-data（同源 `/api/private-research/owner-data/<asset>`），不進公開 CDN；pulse-data 標 DISPLAY_ONLY、不入倉。
 */
const CN_OWNER_NOTE = "OWNER_ONLY：使用者 2026-11-10 決定中國圖層先鎖站主限定，公開與否之後再議；不入分析倉庫（DISPLAY_ONLY）";

const cnPrivateSource = (asset: keyof typeof CN_OWNER_ASSETS, note: string) => ({
  kind: "custom" as const,
  note: `Owner-only same-origin Range API /api/private-research/owner-data/${asset}（coral-private sidecar 驗站主 JWT）；${note}`,
  staticAssets: [`PRIVATE_OWNER_ONLY: ${CN_OWNER_ASSETS[asset]}`],
});

const CN_DATA_ENTRY_META: Record<CnDataKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  cnBusStops: { theme: "交通", group: "場站", zh: "公交站", alt: "Bus Stops", icon: Bus, dataset: "cn_bus_stops", topics: ["中國", "交通", "公車", "公交站"],
    description: "中國 299 個城市公交站 859,061 處（2024；大小依經過路線數；自治州、盟、地區未涵蓋）", processing: "figshare 28323971（Wang et al. 2024）simplified net stop 檔去重 → 4326；台港澳排除；PMTiles bus_stops z6–11（瘦身：只留 n_lines、prefecture_code）", note: "CC BY 4.0（figshare）；上游為高德／百度地圖 API，條款未查證；地級 291/333" },
  cnTransportHubs: { theme: "交通", group: "樞紐節點", zh: "機場與港口", alt: "Airports & Ports", icon: Plane, dataset: "cn_transport_hubs", topics: ["中國", "交通", "機場", "港口", "OurAirports", "OSM"],
    description: "中國機場 709（OurAirports，有定期航班白框）＋港口 765（OSM 港區、港灣）", processing: "OurAirports CSV 濾 CN、OSM landuse=port／harbour 代表點；南沙島礁 9 處不上圖；PMTiles airports、ports z3–13", note: "Public Domain（機場）＋ODbL 1.0（港口）；內蒙古、青海、寧夏內陸無港口" },
  cnMajorRoads: { theme: "交通", group: "路網", zh: "主要道路與鐵路", alt: "Major Roads & Railways", icon: Route, dataset: "cn_major_roads", topics: ["中國", "交通", "道路", "高速公路", "鐵路", "高鐵", "OSM"],
    description: "中國高速公路與國道級幹道 697,980 段＋鐵路 256,080 段（含高鐵、地鐵、輕軌；OpenStreetMap）", processing: "Geofabrik china-261112.osm.pbf 抽 motorway／trunk 與 railway → 台港澳與鄰國裁切；PMTiles roads z4–10、rail z3–10（瘦身：同屬性線段合併、降 maxzoom）", note: "ODbL 1.0；OSM 非官方里程，河南、貴州、雲南稀疏" },
  cnPowerPlants: { theme: "能源", group: "電力 · 廠", zh: "電廠", alt: "Power Plants", icon: Factory, dataset: "cn_power_plants", topics: ["中國", "能源", "電廠", "發電", "燃煤", "太陽能", "風電", "GEM"],
    description: "中國電廠 31,700 處（Global Energy Monitor 9 種技術；預設運轉中＋興建中；可切只看再生能源 C090 子集）", processing: "GEM 各 tracker xlsx 濾中國 → 依廠合併機組；PMTiles plants z3–9（瘦身：精簡屬性、降 maxzoom，31,700 廠全留）", note: "CC BY 4.0（GEM）；63 筆 TransitionZero 光電 CC BY-NC 4.0（非商用，popup 標示）" },
  cnPowerGrid: { theme: "能源", group: "電力 · 電網", zh: "輸電線與變電所", alt: "Power Lines & Substations", icon: Zap, dataset: "cn_power_grid", topics: ["中國", "能源", "電網", "輸電線", "變電所", "特高壓", "OSM"],
    description: "中國輸電線 216,960 段（依電壓 7 級，含特高壓）＋變電所 38,753 處（OpenStreetMap；完整度有限、非官方）", processing: "Geofabrik china-261112.osm.pbf 抽 power=line／cable／substation → 依 voltage 分 kv_class；PMTiles lines z3–10、substations z6–11（瘦身）", note: "ODbL 1.0；電壓未知：線約 29%、變電所約 51%" },
  cnPipelines: { theme: "能源", group: "石化 · 油氣", zh: "油氣管線與 LNG 接收站", alt: "Oil & Gas Pipelines & LNG Terminals", icon: Spline, dataset: "cn_pipelines", topics: ["中國", "能源", "管線", "天然氣", "石油", "LNG", "GEM"],
    description: "中國油氣管線 1,124 條（天然氣、石油、NGL；運轉中實線、其他虛線）＋LNG 接收站 152 處（GEM）", processing: "GEM GGIT／GOIT 管線與 LNG terminal 濾中國 → 4326；PMTiles pipelines、lng_terminals z3–10", note: "CC BY 4.0；路線精度低者為示意路線（淡化）" },
  // 第 2–5 波（2026-11-16，analytics #395）
  cnEez: { theme: "底圖", group: "海域", zh: "專屬經濟區", alt: "Exclusive Economic Zone", icon: Anchor, dataset: "cn_eez", topics: ["中國", "海域", "EEZ", "Marine Regions"],
    description: "中國 200 浬專屬經濟區（Marine Regions MRGID 8486；重疊與聯合主張區不畫，不畫九段線）", processing: "Marine Regions EEZ v12 取 MRGID 8486 → 切除金門、馬祖周邊與港澳水域；PMTiles eez z2–8", note: "CC BY 4.0（請勿轉載原始檔）；8321、48954、49003 不畫；12／24 浬未做" },
  cnPlaceNames: { theme: "底圖", group: "地名", zh: "地名", alt: "Place Names", icon: MapPin, dataset: "cn_place_names", topics: ["中國", "地名", "聚落", "山", "湖", "GeoNames"],
    description: "中國地名 25,978 點（GeoNames：聚落、地形、水文；依重要性分縮放出現）", processing: "GeoNames CN.zip＋alternateNames 取中文名 → 31 省判定、台港澳排除；PMTiles places z3–9（逐筆 minzoom）", note: "CC BY 4.0；人口欄為 GeoNames 登錄值" },
  cnEthnicAutonomy: { theme: "人口社經", group: "民族自治地方", zh: "民族自治地方", alt: "Ethnic Autonomous Areas", icon: Users, dataset: "cn_ethnic_autonomy", topics: ["中國", "民族", "自治區", "自治州", "自治縣"],
    description: "中國民族自治地方 155 個（自治區 5、自治州 30、自治縣 117、自治旗 3）", processing: "民政部 2024 代碼表篩自治地方 → 區、州接 OCHA 面，縣、旗接 geoBoundaries CHN ADM3 2017（地級＋民族組合配對）；PMTiles units z2–9", note: "CC BY-IGO 3.0＋ODbL 1.0；縣級幾何為 2017 概化面" },
  cnDams: { theme: "水資源", group: "水庫 · 壩", zh: "壩與水庫", alt: "Dams & Reservoirs", icon: Waves, dataset: "cn_dams", topics: ["中國", "水資源", "水庫", "壩", "水力發電", "Global Dam Watch"],
    description: "中國壩 8,238 座（大小依壩高）＋水庫水面 6,540（Global Dam Watch）", processing: "GDW v1.0 壩點與水庫面濾 31 省 → 台港澳排除；PMTiles dams、reservoirs z3–10", note: "CC BY 4.0；學術整合資料，非水利部名冊；上海無" },
  cnRivers: { theme: "水資源", group: "河川", zh: "主要河川", alt: "Major Rivers", icon: Droplets, dataset: "cn_rivers", topics: ["中國", "水資源", "河川", "HydroSHEDS"],
    description: "中國主要河川 51,444 段（HydroRIVERS 流量等級 2–5；模型河網，無河名）", processing: "HydroRIVERS v1.0 亞洲檔 ORD_FLOW≤5 → 31 省裁切；PMTiles rivers z3–8", note: "HydroSHEDS License Agreement（只准以衍生作品散布）" },
  cnActiveFaults: { theme: "災害", group: "活動斷層", zh: "活動斷層", alt: "Active Faults", icon: Activity, dataset: "cn_active_faults", topics: ["中國", "災害", "斷層", "地震", "GEM"],
    description: "中國活動斷層 671 條（GEM 全球活動斷層；依錯動型態分色；華東、華北幾乎沒有）", processing: "GEM gem_active_faults_harmonized.geojson → 31 省裁切；PMTiles faults z3–10", note: "CC BY-SA 4.0；非中國官方斷層圖，16/31" },
  cnNatureReserves: { theme: "環境氣候", group: "保護區", zh: "國家級自然保護區", alt: "National Nature Reserves", icon: TreePine, dataset: "cn_nature_reserves", topics: ["中國", "環境", "自然保護區", "生態"],
    description: "中國國家級自然保護區 351 處（分區面 1,225：核心、緩衝、實驗區）", processing: "Zenodo 18226534 分區面 → 31 省判定；PMTiles reserves z3–10", note: "CC BY 4.0；名稱為作者英譯；北京、天津無" },
  cnWdpa: { theme: "環境氣候", group: "保護區", zh: "國際保護區（WDPA）", alt: "Protected Areas (WDPA)", icon: Leaf, dataset: "cn_wdpa", topics: ["中國", "環境", "保護區", "濕地", "世界遺產", "WDPA"],
    description: "中國 WDPA 公開版保護區 149 處（Ramsar 濕地、生物圈保護區、世界遺產、風景名勝區）", processing: "WDPA Nov 2026 公開版 CHN 面與點 → 台港澳排除；PMTiles areas、points z3–10", note: "WDPA Terms of Use：禁止商業使用（含衍生品）；公開版沒有中國海洋保護區面" },
  cnBridgesTunnels: { theme: "交通", group: "橋梁隧道", zh: "長橋與長隧道", alt: "Long Bridges & Tunnels", icon: Construction, dataset: "cn_bridges_tunnels", topics: ["中國", "交通", "橋梁", "隧道", "高架", "OSM"],
    description: "中國主要道路與鐵路上單段 ≥500 m 的橋隧 108,778 處（OSM；中點表示，大小依長度）", processing: "Geofabrik china-261112.osm.pbf 抽 motorway／trunk／primary 與鐵道的 bridge、tunnel → 單段 ≥500 m 取中點；PMTiles structures z5–10（逐筆 minzoom）", note: "ODbL 1.0；同一座橋上下行各一點；河南、貴州、雲南稀疏" },
  cnSchools: { theme: "教育", group: "學校", zh: "學校", alt: "Schools", icon: GraduationCap, dataset: "cn_schools", topics: ["中國", "教育", "學校", "大學", "幼兒園", "OSM"],
    description: "中國學校 89,109 處（OSM：中小學、幼兒園、專科、大學）", processing: "Geofabrik china-261112.osm.pbf 抽 amenity school／kindergarten／college／university（面取代表點）→ 台港澳排除；PMTiles schools z6–10（低縮放抽稀）", note: "ODbL 1.0；官方名冊無座標；河南、貴州、雲南稀疏" },
  cnMedical: { theme: "醫療", group: "醫療院所", zh: "醫療院所", alt: "Health Facilities", icon: Stethoscope, dataset: "cn_medical", topics: ["中國", "醫療", "醫院", "診所", "藥局", "OSM"],
    description: "中國醫療院所 20,015 處（OSM：醫院、診所、藥局）", processing: "Geofabrik china-261112.osm.pbf 抽 amenity／healthcare hospital、clinic、doctors、pharmacy（面取代表點）→ 台港澳排除；PMTiles medical z6–10", note: "ODbL 1.0；藥局、診所少收；河南、貴州、雲南稀疏" },
  cnNuclearPlants: { theme: "災害", group: "核安", zh: "核電廠", alt: "Nuclear Power Plants", icon: Radiation, dataset: "cn_nuclear_plants", topics: ["中國", "核安", "核電", "能源", "OSM"],
    description: "中國核電廠 27 處＋機組 39 個（OSM；未區分運轉、興建、規劃）", processing: "Geofabrik china-261112.osm.pbf 抽 power=plant＋plant:source=nuclear（面取代表點）與 generator:source=nuclear；PMTiles plants、reactors z3–12", note: "ODbL 1.0；輻射監測站無公開 API 未做" },
};

const CN_DATA_MANIFEST_ENTRIES = Object.fromEntries(CN_DATA_SPECS.map((spec) => {
  const m = CN_DATA_ENTRY_META[spec.key];
  const hasPoint = spec.parts.some((x) => x.geom === "point");
  const layers = [...new Set(spec.parts.map((x) => x.sourceLayer))].join("／");
  const kinds = [...(spec.cats.length >= 2 ? ["multiSelect"] : []), ...(spec.key === "cnPowerPlants" ? ["multiSelect", "select"] : []), ...(spec.heat ? ["palette"] : []), "slider", ...(hasPoint ? ["slider"] : [])] as ("multiSelect" | "select" | "palette" | "slider")[];
  return [spec.key, {
    key: spec.key,
    country: "CN", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: `${m.note}；${CN_OWNER_NOTE}` },
    dataClass: "D",
    source: cnPrivateSource(spec.asset, `useCnDataLayer；source-layer=${layers}，source z${spec.srcMinzoom}–${spec.srcMaxzoom}`),
    legend: spec.key,
    popup: spec.key,
    params: { count: kinds.length, kinds },
    description: m.description,
    topics: [...m.topics, "OWNER_ONLY"],
  }];
})) as Record<CnDataKey, LayerManifestEntry>;

/** 中國第 2–5 波 raster（地形、養殖、土壤）：已上色 PNG，沒有 popup，只有透明度。 */
const CN_RASTER_ENTRY_META: Record<CnRasterKey, { theme: string; group: string; zh: string; alt: string; icon: LucideIcon; dataset: string; description: string; topics: string[]; processing: string; note: string }> = {
  cnTerrain: { theme: "底圖", group: "地形", zh: "地形山影", alt: "Hillshade", icon: Mountain, dataset: "cn_terrain", topics: ["中國", "地形", "山影", "高程"],
    description: "中國地形山影（AWS Terrain Tiles z7 高程推算，約 1 km；只看大地形）", processing: "AWS Terrain Tiles terrarium z7 391 張 → 高斯平滑、z-factor 4 山影 → 平地透明（背光坡黑、向光坡白，alpha 依偏離平地程度）、31 省面外透明的灰階＋alpha PNG raster PMTiles z2–7", note: "公有領域來源＋署名（SRTM、GMTED2010、ETOPO1 等）；GLO-30 為 GB 級未用" },
  cnAquaculture: { theme: "農業", group: "養殖", zh: "養殖區", alt: "Aquaculture Areas", icon: Fish, dataset: "cn_aquaculture", topics: ["中國", "農業", "養殖", "漁業", "遙測"],
    description: "中國沿海 2024 年養殖區（衛星判釋：陸上魚塭、海上筏式網箱）", processing: "Zenodo 19418704 以 HTTP Range 只取 Land2024／MarineAqua2024 → 兩色 PNG8 raster PMTiles z2–10（z2–6 粗格有養殖即上色並外擴 1 像素，拉遠看得到沿海分布）", note: "Apache-2.0；沿海 11 省；遙測分類，非登記資料" },
  cnSoil: { theme: "農業", group: "土壤", zh: "土壤類型", alt: "Soil Types", icon: Sprout, dataset: "cn_soil", topics: ["中國", "農業", "土壤", "SoilGrids", "WRB"],
    description: "中國土壤類型（SoilGrids 2.0 WRB 最可能土類，約 1 km；模型預測）", processing: "SoilGrids wrb/MostProbable.vrt.ovr 第一層 overview（約 1 km）→ 31 省面內 ISRIC 調色盤 PNG8 raster PMTiles z2–8", note: "CC BY 4.0；機器學習預測，非土壤調查圖" },
};

const CN_RASTER_MANIFEST_ENTRIES = Object.fromEntries(CN_RASTER_SPECS.map((spec) => {
  const m = CN_RASTER_ENTRY_META[spec.key];
  return [spec.key, {
    key: spec.key,
    country: "CN", section: { theme: m.theme, group: m.group },
    ...layerName({ zh: m.zh, alt: m.alt }),
    expandable: true,
    color: spec.color,
    icon: m.icon,
    upstream: { status: "verified", datasets: [{ datasetId: m.dataset, confidence: "HIGH" }], processing: m.processing, note: `${m.note}；${CN_OWNER_NOTE}` },
    dataClass: "D",
    source: cnPrivateSource(spec.asset, `useCnRasterLayer（pmtilesRasterCustomSource＋私人 Range 讀取）；minzoom=${spec.minzoom} maxzoom=${spec.maxzoom}`),
    legend: spec.key,
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: m.description,
    topics: [...m.topics, "OWNER_ONLY"],
  }];
})) as Record<CnRasterKey, LayerManifestEntry>;


export const CN_PACK_MANIFEST = {
  ...CN_DATA_MANIFEST_ENTRIES,
  ...CN_RASTER_MANIFEST_ENTRIES,
  // ══════════════════════════════════════════════════════════════
  // 🇨🇳 中國 China（2026-11-13 第 0–1 波，站主限定：C001 行政邊界、C023 人口＋人口網格；其餘 6 層由 CN_DATA_MANIFEST_ENTRIES 派生）
  // ══════════════════════════════════════════════════════════════
  cnAdminBoundaries: {
    key: "cnAdminBoundaries",
    country: "CN", section: { theme: "底圖", group: "行政邊界" },
    ...layerName({ zh: "行政區界", alt: "Administrative Boundaries" }),
    expandable: true,
    color: "#9ca3af",
    icon: Map,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cn_admin_boundaries", confidence: "HIGH" }],
      processing: "OCHA COD-AB China 2020（HDX）省 31、地級 357（332 地級＋4 直轄市＋21 省直轄縣級）接民政部 2024 代碼 → 4326；台港澳面移除，金門、馬祖、澎湖、東沙、太平島、烏坵、大膽二膽依實際管轄屬台灣；PMTiles province z2–10、prefecture z4–11",
      note: `CC BY-IGO 3.0（幾何，unofficial）；邊界依 OCHA 資料，不代表任何立場；不畫九段線或海域主張線；三沙市無幾何；${CN_OWNER_NOTE}`,
    },
    dataClass: "D",
    source: cnPrivateSource("cn-admin-boundaries", "useCnAdminLayers；source-layer=province／prefecture（select 擇一）"),
    legend: "cnAdminBoundaries",
    popup: "cnAdminBoundaries",
    params: { count: 2, kinds: ["slider", "select"] },
    description: "中國行政區界（省 31、地級 357；OCHA COD-AB，邊界不代表任何立場）",
    topics: ["中國", "行政區", "邊界", "OWNER_ONLY"],
  },
  cnPopulation: {
    key: "cnPopulation",
    country: "CN", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口密度", alt: "Population Density", qualifier: "2020 Census／GHS 2025" }),
    expandable: true,
    color: "#f59e0b",
    icon: Users,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cn_population", confidence: "HIGH" }],
      processing: "國家統計局第七次普查年鉴表 1-1（省 31）＋GHS-POP R2023A E2025 依地級面加總（模型值）→ 人口密度（人／km²）；PMTiles province z2–9、prefecture z4–10",
      note: `普查：國家統計局網站條款（註明出處）；GHS-POP CC BY 4.0；地級值為模型推估、非統計，縣級未涵蓋；${CN_OWNER_NOTE}`,
    },
    dataClass: "D",
    source: cnPrivateSource("cn-population", "useCnPopulationLayers；source-layer=province／prefecture（select 擇一）"),
    legend: "cnPopulation",
    popup: "cnPopulation",
    params: { count: 2, kinds: ["select", "slider"] },
    description: "中國人口密度（省級 2020 普查、地級 GHS 2025 模型值；未涵蓋畫灰）",
    topics: ["中國", "人口", "人口密度", "普查", "GHS-POP", "OWNER_ONLY"],
  },
  cnPopulationGrid: {
    key: "cnPopulationGrid",
    country: "CN", section: { theme: "人口社經", group: "人口分布" },
    ...layerName({ zh: "人口網格", alt: "Population Grid", qualifier: "GHS-POP 2025" }),
    expandable: true,
    color: "#e6550d",
    icon: Grid3x3,
    upstream: {
      status: "verified",
      datasets: [{ datasetId: "cn_population", confidence: "HIGH" }],
      processing: "GHS-POP R2023A E2025 30 arc-sec（約 1 km）裁到 31 省面 → 7 級上色 PNG raster PMTiles z2–8（<1 人／km² 透明）",
      note: `CC BY 4.0（© European Union，JRC）；模型值，不是普查；沒有 feature 屬性與 popup；${CN_OWNER_NOTE}`,
    },
    dataClass: "D",
    source: cnPrivateSource("cn-population-grid", "useCnPopulationGridLayer（pmtilesRasterCustomSource＋私人 Range 讀取）；minzoom=2 maxzoom=8，插在底圖第一個 symbol 下"),
    legend: "cnPopulationGrid",
    popup: null,
    params: { count: 1, kinds: ["slider"] },
    description: "中國人口網格（GHS-POP 2025 模型值，約 1 km；7 級人口密度）",
    topics: ["中國", "人口", "人口密度", "網格", "GHS-POP", "OWNER_ONLY"],
  },
  // <codemod:append CN_PACK_MANIFEST>
} satisfies Record<CnLayerKey, LayerManifestEntry>;
