/**
 * map-layers.md §3.8 V-5（2026-10-31）台灣＋日本面層的「點／面」切換：代表點檔登記表。
 *
 * analytics #271 的 `<原檔名>_points.pmtiles`（每個面一個落在面內的代表點，z4–10，高縮放 overzoom）。
 * 這張表是唯一的真值，下面這些地方都從它派生：
 *   - `layerParamsSpec`：每層加「樣式（點位／面）」選單、≥ 1 萬點加「熱區顏色」、加「大小」滑桿；
 *   - `map/repPointOverlays`：registry 圖層（`family: "registry"`）自動產生第二個 config（同 id、代表點 source）；
 *   - `gisClickRegistry`：代表點 circle 的點擊彈窗沿用面層的 FeatureInfo 類型；
 *   - 日本／農業的 hook 與 factory（`family: "jpHook" | "jpTourism" | "agri"`）讀這張表取檔案與預設。
 *
 * 切換語意（與 `jpAirports`、英國 `gbDisplayModeFromIdx` 一致）：select 的 encode 順序 `[point, polygon]`，
 * 0＝點、1＝面。預設：小而零散的面（墓區、湖泊埤塘、樹穴、保護區類、產業園區…）點，大範圍面（分區、淹水、土壤、作物…）面。
 */
export type RepPointDisplayMode = "point" | "polygon";
export type RepPointFamily = "registry" | "agri" | "jpHook" | "jpTourism" | "jpGeojson";

export interface RepPointLayer {
  /** 圖層 key（LayerVisibility） */
  key: string;
  family: RepPointFamily;
  /**
   * GeoJSON 面層（沒有代表點檔）：前端用 `map/interiorPoint.ts` 算保證落在面內的代表點；`file`／`sourceLayer` 留空。
   * registry 家族自動產生 `geojsonTransform: "interior"` 的第二個 config；日本 GeoJSON hook 自己用同一支工具。
   */
  geojson?: boolean;
  /** 代表點檔，相對 `public/`（例 `funeral/cemetery_osm_points.pmtiles`） */
  file: string;
  /** 代表點檔的 tile layer 名（原名 + `_points`；淹水統一 `flood_scenario_points`） */
  sourceLayer: string;
  /** 代表點數（tilestats；≥ 1 萬畫熱區，P-4） */
  count: number;
  /** 預設樣式 */
  def: RepPointDisplayMode;
  /** 沒有點／面切換（只補熱區）：代表點檔不夠高縮放接手時用（土砂警戒） */
  modeless?: boolean;
  /** 代表點檔實際 maxzoom（landslide 只到 z7，其餘 z10） */
  maxzoom?: number;
  /** 熱區強度（z12 值，每拉遠一級減半；每層目視校正）。省略＝依點數估 */
  heatIntensity?: number;
  /**
   * 代表點檔低縮放有抽稀（每降一級約剩 1/N）時，用隨縮放放大的 heatmap-weight 補回密度。
   * 值＝每級倍數 N（例 2.5）；省略＝不補。
   */
  thinned?: number;
  /** registry 家族：面層 config 的 `sourceId`（同 key 有多個 config 時用來指定是哪一個） */
  sourceId?: string;
  /** 透明度滑桿參數名（省略＝`${key}Opacity`） */
  opacityParam?: string;
  /** 代表點 circle 色；省略＝取面層 fill-color（registry）。 */
  color?: unknown;
}

const R = (l: Omit<RepPointLayer, "family">): RepPointLayer => ({ family: "registry", ...l });
const G = (l: { key: string; sourceId: string; count: number; def: RepPointDisplayMode }): RepPointLayer =>
  ({ family: "registry", geojson: true, file: "", sourceLayer: "", ...l });

export const REP_POINT_LAYERS: readonly RepPointLayer[] = [
  // ── 台灣：registry 圖層 ──
  R({ key: "cemeteryOsm", sourceId: "cemetery-osm", file: "funeral/cemetery_osm_points.pmtiles", sourceLayer: "cemetery_osm_points", count: 3229, def: "point" }),
  R({ key: "lakesPondsOsm", sourceId: "lakes-ponds-osm", file: "water_resources/lakes_ponds_osm_points.pmtiles", sourceLayer: "lakes_ponds_osm_points", count: 52314, def: "point" }),
  R({ key: "aquacultureWaterSatellite", sourceId: "aquaculture-water-satellite", file: "fishery/aquaculture_water_satellite_points.pmtiles", sourceLayer: "aquaculture_water_satellite_points", count: 10450, def: "point", heatIntensity: 0.3 }),
  R({ key: "aquacultureWaterSatelliteMoa", sourceId: "aquaculture-water-satellite-moa", file: "fishery/aquaculture_water_satellite_moa_points.pmtiles", sourceLayer: "aquaculture_water_satellite_moa_points", count: 27205, def: "point", heatIntensity: 0.3 }),
  R({ key: "aquacultureWaterUnion", sourceId: "aquaculture-water-satellite-union", file: "fishery/aquaculture_water_sat_union_points.pmtiles", sourceLayer: "aquaculture_water_satellite_union_points", count: 6870, def: "point" }),
  R({ key: "aquacultureIntegrated", sourceId: "aquaculture-integrated", file: "fishery/aquaculture_integrated_points.pmtiles", sourceLayer: "aquaculture_integrated_points", count: 20212, def: "point", heatIntensity: 0.3 }),
  R({ key: "treePitsTaipei", sourceId: "tree-pits-taipei", file: "urban/tree_pits_taipei_points.pmtiles", sourceLayer: "tree_pits_taipei_points", count: 56720, def: "point", heatIntensity: 0.03 }),
  R({ key: "urbanZoningTaipei", sourceId: "urban-zoning-taipei", file: "urban/urban_zoning_taipei_points.pmtiles", sourceLayer: "urban_zoning_taipei_points", count: 15518, def: "polygon", heatIntensity: 0.12 }),
  R({ key: "urbanZoningNewTaipei", sourceId: "urban-zoning-newtaipei", file: "urban/urban_zoning_newtaipei_points.pmtiles", sourceLayer: "urban_zoning_newtaipei_points", count: 34190, def: "polygon", heatIntensity: 0.06 }),
  R({ key: "nonUrbanZoning", sourceId: "non-urban-zoning", file: "urban/non_urban_zoning_points.pmtiles", sourceLayer: "non_urban_zoning_points", count: 68220, def: "polygon" }),
  R({ key: "ecoNetworkZones", sourceId: "eco-network-zones", file: "agriculture/eco_network_zones_points.pmtiles", sourceLayer: "eco_network_zones_points", count: 12, def: "polygon" }),
  R({ key: "forestCompartments", sourceId: "forest-compartments", file: "forestry/national_forest_compartments_points.pmtiles", sourceLayer: "national_forest_compartments_points", count: 3700, def: "polygon" }),
  R({ key: "forestReserve", sourceId: "forest-reserve", file: "forestry/forest_reserve_points.pmtiles", sourceLayer: "forest_reserve_points", count: 522, def: "point" }),
  R({ key: "eduCampusPolygon", sourceId: "edu-campus", file: "education/campus_polygon_points.pmtiles", sourceLayer: "campus_polygon_points", count: 4336, def: "point" }),
  R({ key: "nationalParks", sourceId: "national-parks", file: "public_life/national_parks_points.pmtiles", sourceLayer: "national_parks_points", count: 10, def: "polygon" }),
  R({ key: "agriRuralCommunityVillages", sourceId: "agri-rural-community-villages", file: "indigenous_rural/rural_community_villages_points.pmtiles", sourceLayer: "rural_community_villages_points", count: 4208, def: "point" }),
  R({ key: "coastalAreaExtents", sourceId: "coastal-area-extents", file: "marine/coastal_area_extents_points.pmtiles", sourceLayer: "coastal_area_extents_points", count: 343, def: "polygon" }),
  R({ key: "industrialParkBoundaries", sourceId: "industrial-zone-park-boundaries", file: "industrial_zone/industrial_park_boundaries_20260818_points.pmtiles", sourceLayer: "industrial_park_boundaries_points", count: 215, def: "point" }),
  R({ key: "industrialParkComparison", sourceId: "business-registry-industrial-park-comparison", file: "business_registry/industrial_park_comparison_20260818_points.pmtiles", sourceLayer: "industrial_park_comparison_points", count: 215, def: "point" }),
  // 淹水：10 情境一個情境一支（切情境換 source，同 `sourceUrlByParam`），tile layer 統一 flood_scenario_points
  R({ key: "waterFloodExtreme", sourceId: "water-flood-extreme", file: "geo/water_flood_650mm_24hr_points.pmtiles", sourceLayer: "flood_scenario_points", count: 2356, def: "polygon", opacityParam: "waterFloodOpacity" }),
  // ── 台灣：GeoJSON registry 圖層（前端算代表點；小而零散／保護區類預設點，大範圍面預設面） ──
  G({ key: "importantWetlands", sourceId: "important-wetlands", count: 89, def: "point" }),
  G({ key: "cemeteryZoning", sourceId: "cemetery-zoning", count: 114, def: "point" }),
  G({ key: "waterRecreationRestrictedAreas", sourceId: "water-recreation-restricted-areas", count: 33, def: "point" }),
  G({ key: "tourHotSpringZones", sourceId: "tour-hot-spring-zones", count: 16, def: "point" }),
  G({ key: "forestRecreation", sourceId: "forest-recreation", count: 23, def: "point" }),
  G({ key: "landslideDodAreas", sourceId: "landslide-dod-areas", count: 322, def: "point" }),
  G({ key: "landslideDodImpact", sourceId: "landslide-dod-impact", count: 322, def: "point" }),
  G({ key: "freewayEcoSensitive", sourceId: "freeway-eco-sensitive", count: 200, def: "point" }),
  G({ key: "taipeiWaterloggingHistory", sourceId: "taipei-waterlogging-history", count: 739, def: "point" }),
  G({ key: "natureReserves", sourceId: "nature-reserves", count: 24, def: "point" }),
  G({ key: "wildlifeProtectedAreas", sourceId: "wildlife-protected-areas", count: 32, def: "point" }),
  G({ key: "marineWildlifeAreas", sourceId: "marine-wildlife-areas", count: 6, def: "point" }),
  G({ key: "setNetFishingAreas", sourceId: "set-net-fishing-areas", count: 65, def: "point" }),
  G({ key: "exclusiveFisheryRightAreas", sourceId: "exclusive-fishery-right-areas", count: 19, def: "point" }),
  G({ key: "seawallZones", sourceId: "seawall-zones", count: 239, def: "point" }),
  G({ key: "aquacultureCageNet", sourceId: "aquaculture-cage-net", count: 42, def: "point" }),
  G({ key: "serviceAreaPolygon", sourceId: "service-area-polygon", count: 19, def: "point" }),
  G({ key: "firingNoticeAreas", sourceId: "firing-notice-areas", count: 187, def: "polygon" }),
  G({ key: "tourScenicAreas", sourceId: "tour-scenic-areas", count: 12, def: "polygon" }),
  G({ key: "indigenousRegions", sourceId: "indigenous-regions", count: 55, def: "polygon" }),
  G({ key: "indigenousLanguageDialects", sourceId: "indigenous-language-dialects", count: 59, def: "polygon" }),
  G({ key: "hakkaCulturalZones", sourceId: "hakka-cultural-zones", count: 70, def: "polygon" }),
  G({ key: "wraCentralDrainage", sourceId: "wra-central-drainage", count: 33, def: "polygon" }),
  G({ key: "drinkingWaterProtectionZones", sourceId: "drinking-water-protection-zones", count: 134, def: "polygon" }),
  G({ key: "waterProtectionZones", sourceId: "water-protection-zones", count: 128, def: "polygon" }),
  G({ key: "aquacultureZone", sourceId: "aquaculture-zone", count: 62, def: "polygon" }),
  // ── 台灣：農業（agricultureLayerFactory 自建 source，由 factory 讀本表） ──
  { key: "agriCropSuitability", family: "agri", file: "agriculture/crop_suitability_132_points.pmtiles", sourceLayer: "crop_suitability_points", count: 833_086, def: "polygon", heatIntensity: 0.06 },
  { key: "agriculture", family: "agri", file: "agriculture/ftw_fields_2025_points.pmtiles", sourceLayer: "fields_points", count: 386_829, def: "polygon" },
  { key: "agriLeisureFarmZones", family: "agri", file: "agriculture/leisure_farm_zones_2025_points.pmtiles", sourceLayer: "leisure_farm_zones_points", count: 109, def: "point" },
  { key: "agriRuralRegen", family: "agri", file: "agriculture/rural_regen_communities_2025_points.pmtiles", sourceLayer: "rural_regen_communities_points", count: 1109, def: "point" },
  { key: "agriSoil", family: "agri", file: "agriculture/soil_map_national_points.pmtiles", sourceLayer: "soil_points", count: 57_646, def: "polygon", heatIntensity: 0.04 },
  // ── 日本：自建 hook ──
  { key: "jpInlandFloodAreas", family: "jpHook", file: "jp_inland_flood_areas_points.pmtiles", sourceLayer: "jp_inland_flood_areas_points", count: 202_357, def: "polygon", heatIntensity: 0.012 },
  // 土砂警戒：代表點檔只有 z4–7（z8 起由面接手），點模式在 z8 起仍畫面
  { key: "jpLandslideWarningAreas", family: "jpHook", file: "jp_landslide_warning_areas_points.pmtiles", sourceLayer: "jp_landslide_warning_areas_points", count: 1_793_171, def: "polygon", maxzoom: 7, modeless: true },
  { key: "jpNationalForests", family: "jpHook", file: "jp_national_forests_points.pmtiles", sourceLayer: "jp_national_forests_points", count: 116_747, def: "polygon", heatIntensity: 0.25 },
  { key: "jpZoningUseDistricts", family: "jpHook", file: "jp_zoning_use_districts_points.pmtiles", sourceLayer: "jp_zoning_use_districts_points", count: 102_244, def: "polygon" },
  // ── 日本：GeoJSON 面（觀光 loader／水 loader 自建，前端算代表點） ──
  { key: "jpWaterLakes", family: "jpGeojson", geojson: true, file: "", sourceLayer: "", count: 556, def: "point" },
  { key: "jpWorldNaturalHeritageHistorical", family: "jpGeojson", geojson: true, file: "", sourceLayer: "", count: 5, def: "polygon" },
  // ── 日本：觀光 loader（三組 × 3 個 key 共用一支檔，以 filter_layer_id 分層；EBSA 單層） ──
  { key: "jpNaturalParksNational", family: "jpTourism", file: "jp_natural_parks_ksj_2010_points.pmtiles", sourceLayer: "jp_natural_parks_ksj_2010_points", count: 1920, def: "polygon" },
  { key: "jpNaturalParksQuasiNational", family: "jpTourism", file: "jp_natural_parks_ksj_2010_points.pmtiles", sourceLayer: "jp_natural_parks_ksj_2010_points", count: 1920, def: "polygon" },
  { key: "jpNaturalParksPrefectural", family: "jpTourism", file: "jp_natural_parks_ksj_2010_points.pmtiles", sourceLayer: "jp_natural_parks_ksj_2010_points", count: 1920, def: "polygon" },
  { key: "jpNatureConservationArea", family: "jpTourism", file: "jp_nature_conservation_ksj_2015_points.pmtiles", sourceLayer: "jp_nature_conservation_ksj_2015_points", count: 1054, def: "point" },
  { key: "jpNatureConservationSpecialDistrict", family: "jpTourism", file: "jp_nature_conservation_ksj_2015_points.pmtiles", sourceLayer: "jp_nature_conservation_ksj_2015_points", count: 1054, def: "point" },
  { key: "jpPrimitiveNatureEnvironmentArea", family: "jpTourism", file: "jp_nature_conservation_ksj_2015_points.pmtiles", sourceLayer: "jp_nature_conservation_ksj_2015_points", count: 1054, def: "point" },
  { key: "jpWildlifeProtectionNational", family: "jpTourism", file: "jp_wildlife_protection_moe_202504_points.pmtiles", sourceLayer: "jp_wildlife_protection_moe_202504_points", count: 347, def: "point" },
  { key: "jpWildlifeSpecialProtectionDesignatedArea", family: "jpTourism", file: "jp_wildlife_protection_moe_202504_points.pmtiles", sourceLayer: "jp_wildlife_protection_moe_202504_points", count: 347, def: "point" },
  { key: "jpWildlifeSpecialProtectionDistrict", family: "jpTourism", file: "jp_wildlife_protection_moe_202504_points.pmtiles", sourceLayer: "jp_wildlife_protection_moe_202504_points", count: 347, def: "point" },
  { key: "jpMarineEbsaCoastal", family: "jpTourism", file: "jp_marine_ebsa_moe_coastal_20150101_points.pmtiles", sourceLayer: "jp_marine_ebsa_coastal_points", count: 270, def: "point" },
];

const BY_KEY = new Map(REP_POINT_LAYERS.map((l) => [l.key, l]));

export const repPointLayer = (key: string): RepPointLayer | undefined => BY_KEY.get(key);

/** 熱區（P-4）：≥ 1 萬點的代表點才畫熱區 */
export const repPointDense = (l: Pick<RepPointLayer, "count">) => l.count >= 10_000;

/** select 的 encode 順序是 [point, polygon]：0＝點、1＝面 */
export function repPointModeFromIdx(idx: number | undefined, fallback: RepPointDisplayMode): RepPointDisplayMode {
  return idx === 0 ? "point" : idx === 1 ? "polygon" : fallback;
}

/** 代表點檔 public 路徑（`./` 起頭，registry sourceUrl 用） */
export const repPointUrl = (l: Pick<RepPointLayer, "file">) => `./${l.file}`;

/**
 * 熱區預設強度：z12 值、每拉遠一級減半，估法＝點數愈多愈小。真值逐層目視校正後寫在 `heatIntensity`。
 */
export function repPointHeatIntensity(l: RepPointLayer): number {
  if (l.heatIntensity != null) return l.heatIntensity;
  return Math.max(0.02, Math.min(5, 12_000 / l.count));
}

/** 低縮放抽稀補償：2.5 ** (10 - z) 的 interpolate（與英國 `GB_THINNED_POINTS_WEIGHT` 同形）。 */
export function repPointThinnedWeight(n: number): unknown[] {
  return ["interpolate", ["exponential", n], ["zoom"], 4, n ** 6, 10, 1];
}
