// 日本國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { JpLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { GIBS_SNOW_PRODUCTS } from "../../data/gibsSnowTypes";
import { JMA_AUTUMN_PHENOMENA, JMA_SAKURA_PHENOMENA } from "../../data/jmaPointTypes";
import { JMA_AMEDAS_MODES, JMA_FLOOD_OPACITY, JMA_WARNING_KINDS } from "../../data/jmaTypes";
import { JP_EVACUATION_FILTERS } from "../../data/jpEvacuationSiteTypes";
import { JP_BUILDING_HEIGHT_MODES } from "../../data/jpHeightTypes";
import { JP_LANDSLIDE_PHENOMENA } from "../../data/jpLandslideWarningTypes";
import { JP_POLICE_FACILITY_TYPES } from "../../data/jpPoliceFacilityTypes";
import { JP_POPULATION_MESH_MODES } from "../../data/jpPopulationMeshModes";
import { JP_PUBLIC_OFFICE_CLASSES } from "../../data/jpPublicOfficeTypes";
import { JP_EXPRESSWAY_CATEGORIES, JP_ROAD_FILTER_OPTIONS } from "../../data/jpRoadTypes";
import { JP_STATION_COLOR_MODES } from "../../data/jpStationTypes";
import { JP_RAMSAR_GEOMETRY_FILTERS } from "../../data/jpTourismTypes";
import { JP_WELFARE_ACCURACY_OPTIONS, JP_WELFARE_POINT_COUNT, jpWelfareCategoriesOf, jpWelfareGroupsOf, type JpWelfareMajor } from "../../data/jpWelfareFacilityTypes";
import { JP_ZONING_CLASSES, JP_ZONING_GROUPS } from "../../data/jpZoningUseDistrictTypes";
import { gridPalette, heatmapPalette, opacitySlider, scaleSlider } from "../../data/layerParamsSpec";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";
import { JP_DID_DEFAULT_YEAR, JP_DID_YEARS } from "./jpNatureR2Types";

/** 福祉類別 select：全部 → 該層色組 → 中分類單選（順序須與 jpWelfareFilter 一致）。 */
function jpWelfareSelectOptions(major: JpWelfareMajor): { value: string; label: string }[] {
  return [
    { value: "all", label: "全部" },
    ...jpWelfareGroupsOf(major).map(g => ({ value: `group:${g.value}`, label: `${g.label}（類組）` })),
    ...jpWelfareCategoriesOf(major).map(c => ({ value: c.code, label: c.label })),
  ];
}


export const JP_PACK_PARAMS = {
  jpMedicalHospitals: [gridPalette("jpMedicalGridPalette", "viridis", { sharedGroup: "jpMedicalGridPalette" }), opacitySlider("jpMedicalHospitalsOpacity", densePointOpacity(7_447))],
  jpMedicalClinics: [gridPalette("jpMedicalGridPalette", "viridis", { sharedGroup: "jpMedicalGridPalette" }), opacitySlider("jpMedicalClinicsOpacity", 0.8)],
  jpMedicalDental: [gridPalette("jpMedicalGridPalette", "viridis", { sharedGroup: "jpMedicalGridPalette" }), opacitySlider("jpMedicalDentalOpacity", 0.8)],
  jpMedicalMaternity: [gridPalette("jpMedicalGridPalette", "viridis", { sharedGroup: "jpMedicalGridPalette" }), opacitySlider("jpMedicalMaternityOpacity", densePointOpacity(1_684))],
  jpMedicalPharmacies: [gridPalette("jpMedicalGridPalette", "viridis", { sharedGroup: "jpMedicalGridPalette" }), opacitySlider("jpMedicalPharmaciesOpacity", 0.8)],
  jpCarePlanning: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCarePlanningOpacity", 0.75)],
  jpCareHomeVisit: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCareHomeVisitOpacity", 0.75)],
  jpCareDayServices: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCareDayServicesOpacity", 0.75)],
  jpCareResidential: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCareResidentialOpacity", 0.75)],
  jpCareCombined: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCareCombinedOpacity", densePointOpacity(6_513))],
  jpCareEquipment: [gridPalette("jpCareGridPalette", "viridis", { sharedGroup: "jpCareGridPalette" }), opacitySlider("jpCareEquipmentOpacity", 0.75)],
  jpMedicalAreasPrimary: [opacitySlider("jpMedicalAreasPrimaryOpacity", 0.2)],
  jpMedicalAreasSecondary: [opacitySlider("jpMedicalAreasSecondaryOpacity", 0.2)],
  jpMedicalAreasTertiary: [opacitySlider("jpMedicalAreasTertiaryOpacity", 0.2)],
  jpWaterLakes: [opacitySlider("jpWaterLakesOpacity", 0.35)],
  jpWaterDams: [opacitySlider("jpWaterDamsOpacity", densePointOpacity(2_749))],
  jpWaterRivers: [opacitySlider("jpWaterRiversOpacity", 0.75)],
  jpWaterSupplyFacilities: [opacitySlider("jpWaterSupplyFacilitiesOpacity", densePointOpacity(9_976))],
  jpWaterSupplyAreas: [opacitySlider("jpWaterSupplyAreasOpacity", 0.18)],
  jpWaterSewerFacilities: [opacitySlider("jpWaterSewerFacilitiesOpacity", densePointOpacity(5_724))],
  jpWaterGroundwaterSites: [opacitySlider("jpWaterGroundwaterSitesOpacity", densePointOpacity(1_293))],
  jpWaterNilimDams: [opacitySlider("jpWaterNilimDamsOpacity", 0.82)],
  jpWaterAgriculturalPonds: [heatmapPalette("jpWaterAgriculturalPonds"), opacitySlider("jpWaterAgriculturalPondsOpacity", densePointOpacity(161_778))],
  jpWaterFloodHazard: [{ kind: "slider", name: "jpWaterFloodHazardOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  jpWaterLocalFacilities: [opacitySlider("jpWaterLocalFacilitiesOpacity", 0.85)],
  jpWaterQualityStations: [opacitySlider("jpWaterQualityStationsOpacity", densePointOpacity(9_831))],
  jpWaterLevelStations: [opacitySlider("jpWaterLevelStationsOpacity", 0.85)],
  jpReligionGsi: [
    heatmapPalette("jpReligionGsi"),
    { kind: "slider", name: "jpReligionGsiOpacity", labelPrefix: "透明度", digits: 2, default: 0.6, min: 0, max: 1, step: 0.05 },
    scaleSlider("jpReligionGsiScale", 1),
  ],
  jpReligionOsm: [
    heatmapPalette("jpReligionOsm"),
    { kind: "slider", name: "jpReligionOsmOpacity", labelPrefix: "透明度", digits: 2, default: densePointOpacity(71_040), min: 0, max: 1, step: 0.05 },
    scaleSlider("jpReligionOsmScale", 1),
  ],
  jpReligionWikidata: [
    heatmapPalette("jpReligionWikidata"),
    { kind: "slider", name: "jpReligionWikidataOpacity", labelPrefix: "透明度", digits: 2, default: densePointOpacity(37_154), min: 0, max: 1, step: 0.05 },
    scaleSlider("jpReligionWikidataScale", 1),
  ],
  jpAccommodationCanonical: [
    heatmapPalette("jpAccommodationCanonical"),
    opacitySlider("jpAccommodationCanonicalOpacity", densePointOpacity(25_459)),
    scaleSlider("jpAccommodationCanonicalScale", 1),
  ],
  jpAccommodationJta: [
    opacitySlider("jpAccommodationJtaOpacity", densePointOpacity(2_242)),
    scaleSlider("jpAccommodationJtaScale", 1),
  ],
  jpAccommodationLocal: [
    opacitySlider("jpAccommodationLocalOpacity", densePointOpacity(3_948)),
    scaleSlider("jpAccommodationLocalScale", 1),
  ],
  jpAccommodationOsm: [
    heatmapPalette("jpAccommodationOsm"),
    opacitySlider("jpAccommodationOsmOpacity", densePointOpacity(20_502)),
    scaleSlider("jpAccommodationOsmScale", 1),
  ],
  jpNaturalParksNational: [opacitySlider("jpNaturalParksNationalOpacity", 0.28)],
  jpNaturalParksQuasiNational: [opacitySlider("jpNaturalParksQuasiNationalOpacity", 0.25)],
  jpNaturalParksPrefectural: [opacitySlider("jpNaturalParksPrefecturalOpacity", 0.22)],
  jpNatureConservationArea: [opacitySlider("jpNatureConservationAreaOpacity", 0.25)],
  jpPrimitiveNatureEnvironmentArea: [opacitySlider("jpPrimitiveNatureEnvironmentAreaOpacity", 0.3)],
  jpNatureConservationSpecialDistrict: [opacitySlider("jpNatureConservationSpecialDistrictOpacity", 0.28)],
  jpWildlifeProtectionNational: [opacitySlider("jpWildlifeProtectionNationalOpacity", 0.25)],
  jpWildlifeSpecialProtectionDistrict: [opacitySlider("jpWildlifeSpecialProtectionDistrictOpacity", 0.28)],
  jpWildlifeSpecialProtectionDesignatedArea: [opacitySlider("jpWildlifeSpecialProtectionDesignatedAreaOpacity", 0.32)],
  jpWorldHeritageCultural: [
    opacitySlider("jpWorldHeritageCulturalOpacity", 0.9),
    scaleSlider("jpWorldHeritageCulturalScale", 1),
  ],
  jpWorldHeritageNatural: [
    opacitySlider("jpWorldHeritageNaturalOpacity", 0.9),
    scaleSlider("jpWorldHeritageNaturalScale", 1),
  ],
  jpWorldNaturalHeritageHistorical: [opacitySlider("jpWorldNaturalHeritageHistoricalOpacity", 0.25)],
  jpRamsarSites: [
    {
      kind: "select", name: "jpRamsarGeometry", label: "位置精度", default: "name_match",
      options: [...JP_RAMSAR_GEOMETRY_FILTERS], out: "jpRamsarGeometryIdx",
      encode: JP_RAMSAR_GEOMETRY_FILTERS.map((option) => option.value),
    },
    opacitySlider("jpRamsarSitesOpacity", 0.9),
    scaleSlider("jpRamsarSitesScale", 1),
  ],
  jpMarineEbsaCoastal: [opacitySlider("jpMarineEbsaCoastalOpacity", 0.22)],
  jpAdminPrefecture: [opacitySlider("jpAdminPrefectureOpacity", 0.2)],
  jpAdminBoundaries: [opacitySlider("jpAdminBoundariesOpacity", 0.15)],
  jpStations: [
    opacitySlider("jpStationsOpacity", densePointOpacity(9_046)),
    scaleSlider("jpStationsScale", 1),
    {
      kind: "select", name: "jpStationsColorMode", label: "上色", default: "type",
      options: JP_STATION_COLOR_MODES.map((m) => ({ label: m.label, value: m.value })),
      out: "jpStationsColorModeIdx", encode: JP_STATION_COLOR_MODES.map((m) => m.value),
    },
  ],
  jpAirports: [
    opacitySlider("jpAirportsOpacity", 0.5),
    {
      kind: "select", name: "jpAirportsDisplayMode", label: "樣式", default: "point",
      options: [{ label: "點位", value: "point" }, { label: "面", value: "polygon" }],
      out: "jpAirportsDisplayModeIdx", encode: ["point", "polygon"],
    },
  ],
  jpRailways: [opacitySlider("jpRailwaysOpacity", 0.9)],
  jpHistoricalFlightTrails: [
    opacitySlider("jpHistoricalFlightTrailsOpacity", 0.28),
    { kind: "slider", name: "jpHistoricalFlightTrailsAltitudeScale", labelPrefix: "高度倍率", digits: 1, default: 3, min: 1, max: 10, step: 0.5 },
    { kind: "slider", name: "jpHistoricalFlightTrailsWidth", labelPrefix: "線條強度", digits: 2, default: 0.75, min: 0.25, max: 1, step: 0.05 },
    { kind: "select", name: "jpHistoricalFlightTrailsDirectionIdx", label: "方向 全部", default: "0", options: [{ label: "全部", value: "0" }, { label: "離場", value: "1" }, { label: "到場", value: "2" }], out: "jpHistoricalFlightTrailsDirectionIdx", encodeNumeric: true },
    { kind: "select", name: "jpHistoricalFlightTrailsRouteScopeIdx", label: "航線範圍 全部", default: "0", options: [{ label: "全部", value: "0" }, { label: "國內", value: "1" }, { label: "跨境", value: "2" }, { label: "未提供", value: "3" }], out: "jpHistoricalFlightTrailsRouteScopeIdx", encodeNumeric: true },
  ],
  jpPoliceFacilities: [
    heatmapPalette("jpPoliceFacilities"),
    opacitySlider("jpPoliceFacilitiesOpacity", densePointOpacity(13_195)), scaleSlider("jpPoliceFacilitiesScale", 1),
    { kind: "select", name: "jpPoliceFacilitiesType", label: "設施類型", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_POLICE_FACILITY_TYPES],
      out: "jpPoliceFacilitiesTypeIdx", encode: ["all", ...JP_POLICE_FACILITY_TYPES.map(t => t.value)] },
  ],
  jpEvacuationSites: [
    heatmapPalette("jpEvacuationSites"),
    opacitySlider("jpEvacuationSitesOpacity", densePointOpacity(199_346)), scaleSlider("jpEvacuationSitesScale", 1),
    // 災害種別只有緊急避難場所有、福祉避難所只有指定避難所有，互斥 → 合成單一 select 避免選到空集合
    { kind: "select", category: "data", name: "jpEvacuationSitesFilter", label: "災害種別", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_EVACUATION_FILTERS],
      out: "jpEvacuationSitesFilterIdx", encode: ["all", ...JP_EVACUATION_FILTERS.map(f => f.value)] },
  ],
  jpPublicOffices: [
    heatmapPalette("jpPublicOffices"),
    opacitySlider("jpPublicOfficesOpacity", densePointOpacity(79_532)), scaleSlider("jpPublicOfficesScale", 1),
    // 集會施設佔 62%，預設隱藏；idx 0=預設、1=全部、2–6=單一分類
    { kind: "select", category: "data", name: "jpPublicOfficesClass", label: "設施分類", default: "default",
      options: [{ value: "default", label: "預設（不含集會施設）" }, { value: "all", label: "全部" }, ...JP_PUBLIC_OFFICE_CLASSES],
      out: "jpPublicOfficesClassIdx", encode: ["default", "all", ...JP_PUBLIC_OFFICE_CLASSES.map(c => c.value)] },
  ],
  jpLandslideWarningAreas: [
    opacitySlider("jpLandslideWarningAreasOpacity", 0.7),
    // 紅區在黃區之內（不是挖洞）：兩種面各自獨立，篩選只決定畫哪一種
    { kind: "select", category: "data", name: "jpLandslideWarningAreasZone", label: "區域種別", default: "all",
      options: [{ value: "all", label: "全部" }, { value: "red", label: "只看特別警戒（紅）" }, { value: "yellow", label: "只看警戒（黃）" }],
      out: "jpLandslideWarningAreasZoneIdx", encode: ["all", "red", "yellow"] },
    { kind: "select", category: "data", name: "jpLandslideWarningAreasPhenomenon", label: "現象", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_LANDSLIDE_PHENOMENA],
      out: "jpLandslideWarningAreasPhenomenonIdx", encode: ["all", ...JP_LANDSLIDE_PHENOMENA.map(p => p.value)] },
  ],
  jpZoningUseDistricts: [
    opacitySlider("jpZoningUseDistrictsOpacity", 0.7),
    // 0=全部、1–3=住居／商業／工業系、4–16=13 類單選（encode 順序同 jpZoningFilter）
    { kind: "select", category: "data", name: "jpZoningUseDistrictsClass", label: "用途分類", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_ZONING_GROUPS.map(g => ({ value: g.value, label: g.label })), ...JP_ZONING_CLASSES.map(c => ({ value: String(c.code), label: c.label }))],
      out: "jpZoningUseDistrictsClassIdx", encode: ["all", ...JP_ZONING_GROUPS.map(g => g.value), ...JP_ZONING_CLASSES.map(c => String(c.code))] },
  ],
  jpNationalForests: [opacitySlider("jpNationalForestsOpacity", 0.7)],
  // 日本第二輪（2026-11-06）：類別多選由 CATEGORY_FILTERS 自動補，點／面切換由 repPointLayers 自動補
  jpNaturalParkAreas2015: [opacitySlider("jpNaturalParkAreas2015Opacity", 0.35)],
  jpNationalParksMoe: [opacitySlider("jpNationalParksMoeOpacity", 0.35)],
  jpWildlifeProtectionMoe: [opacitySlider("jpWildlifeProtectionMoeOpacity", 0.35)],
  jpDid: [
    opacitySlider("jpDidOpacity", 0.55),
    {
      // 國勢調查年份：一期一支 PMTiles，overlayRegistry 依 jpDidYearIdx 換 source url（同淹水情境）
      kind: "select", name: "jpDidYear", label: "國勢調查年", default: JP_DID_DEFAULT_YEAR, category: "data",
      options: JP_DID_YEARS.map((y) => ({ label: `${y} 年`, value: y })),
      out: "jpDidYearIdx", encode: [...JP_DID_YEARS],
    },
  ],
  // 福祉兩層共用 PMTiles：類別 select 0=全部、色組、中分類單選（encode 順序同 jpWelfareFilter）；定位精度 0=1–3（預設）、1=全部
  jpWelfareDisability: [
    heatmapPalette("jpWelfareDisability"),
    opacitySlider("jpWelfareDisabilityOpacity", densePointOpacity(JP_WELFARE_POINT_COUNT.jpWelfareDisability)), scaleSlider("jpWelfareDisabilityScale", 1),
    { kind: "select", category: "data", name: "jpWelfareDisabilityCategory", label: "設施類別", default: "all",
      options: jpWelfareSelectOptions("disability"),
      out: "jpWelfareDisabilityCategoryIdx", encode: jpWelfareSelectOptions("disability").map(o => o.value) },
    { kind: "select", category: "data", name: "jpWelfareDisabilityAccuracy", label: "定位精度", default: "precise",
      options: [...JP_WELFARE_ACCURACY_OPTIONS],
      out: "jpWelfareDisabilityAccuracyIdx", encode: JP_WELFARE_ACCURACY_OPTIONS.map(o => o.value) },
  ],
  jpWelfareChild: [
    heatmapPalette("jpWelfareChild"),
    opacitySlider("jpWelfareChildOpacity", densePointOpacity(JP_WELFARE_POINT_COUNT.jpWelfareChild)), scaleSlider("jpWelfareChildScale", 1),
    { kind: "select", category: "data", name: "jpWelfareChildCategory", label: "設施類別", default: "all",
      options: jpWelfareSelectOptions("child"),
      out: "jpWelfareChildCategoryIdx", encode: jpWelfareSelectOptions("child").map(o => o.value) },
    { kind: "select", category: "data", name: "jpWelfareChildAccuracy", label: "定位精度", default: "precise",
      options: [...JP_WELFARE_ACCURACY_OPTIONS],
      out: "jpWelfareChildAccuracyIdx", encode: JP_WELFARE_ACCURACY_OPTIONS.map(o => o.value) },
  ],
  // 主要道路：0=全部、1–3=高速／國道／都道府縣道、4=只看有料（encode 順序同 jpRoadFilter）
  jpMajorRoads: [
    opacitySlider("jpMajorRoadsOpacity", 0.85),
    { kind: "select", category: "data", name: "jpMajorRoadsClass", label: "道路分類", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_ROAD_FILTER_OPTIONS],
      out: "jpMajorRoadsClassIdx", encode: ["all", ...JP_ROAD_FILTER_OPTIONS.map(o => o.value)] },
  ],
  // 市町村道：單一類別，只有透明度
  jpMunicipalRoads: [
    opacitySlider("jpMunicipalRoadsOpacity", 0.85),
  ],
  // 高速道路：0=全部、1–5=路線種別（只篩線，IC 點不受影響）
  jpExpressways: [
    opacitySlider("jpExpresswaysOpacity", 0.85),
    { kind: "select", category: "data", name: "jpExpresswaysCategory", label: "路線種別", default: "all",
      options: [{ value: "all", label: "全部" }, ...JP_EXPRESSWAY_CATEGORIES.map(c => ({ value: c.value, label: c.label }))],
      out: "jpExpresswaysCategoryIdx", encode: ["all", ...JP_EXPRESSWAY_CATEGORIES.map(c => c.value)] },
  ],
  jpGsiHillshade: [{ kind: "slider", name: "jpGsiHillshadeOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  jpGsiRelief: [{ kind: "slider", name: "jpGsiReliefOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  jpInlandFloodAreas: [
    gridPalette("jpInlandFloodAreasPalette", "PuBu"),
    opacitySlider("jpInlandFloodAreasOpacity", 0.7),
  ],
  jpBusStops: [heatmapPalette("jpBusStops"), opacitySlider("jpBusStopsOpacity", densePointOpacity(278_515)), scaleSlider("jpBusStopsScale", 1)],
  jpSchools: [heatmapPalette("jpSchools"), opacitySlider("jpSchoolsOpacity", densePointOpacity(56_807)), scaleSlider("jpSchoolsScale", 1)],
  // 9 個模式攤平成單一 select（pop×5 年 + ratio65×4 年）：option value 是 PMTiles 屬性名
  // （非數值字串）⇒ 走 encode 存索引，overlayParams.jpPopulationMeshModeIdx 是 index。
  jpPopulationMesh1km: [
    gridPalette("jpPopulationMeshPalette", "YlOrBr"),
    opacitySlider("jpPopulationMeshOpacity", 0.55),
    {
      kind: "select", name: "jpPopulationMeshMode", label: "指標",
      default: JP_POPULATION_MESH_MODES[0]?.field ?? "pop_2020",
      options: JP_POPULATION_MESH_MODES.map((m) => ({ label: m.label, value: m.field })),
      out: "jpPopulationMeshModeIdx", encode: JP_POPULATION_MESH_MODES.map((m) => m.field),
    },
  ],
  jpBuildingHeight: [
    { kind: "select", name: "jpBuildingHeightModeIdx", label: "呈現", default: "0", options: [...JP_BUILDING_HEIGHT_MODES], out: "jpBuildingHeightModeIdx", encode: JP_BUILDING_HEIGHT_MODES.map((mode) => mode.value) },
    { kind: "slider", name: "jpBuildingHeightOpacity", labelPrefix: "透明度", digits: 2, default: 0.75, min: 0.3, max: 1, step: 0.05 },
  ],
  jpCanopyHeight: [
    { kind: "slider", name: "jpCanopyHeightOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 },
  ],
  // ── 日本氣象廳即時 4 層：點層透明度＋大小；AMeDAS 可切觀測項目（積雪只畫有積雪計的站 → filter 需重建）──
  jmaAmedas: [
    opacitySlider("jmaAmedasOpacity", 0.9), scaleSlider("jmaAmedasScale", 1),
    {
      kind: "select", name: "jmaAmedasMode", label: "指標", default: "temp",
      options: JMA_AMEDAS_MODES.map(({ label, value }) => ({ label, value })),
      out: "jmaAmedasModeIdx", encode: JMA_AMEDAS_MODES.map((mode) => mode.value),
    },
  ],
  jmaWarnings: [
    opacitySlider("jmaWarningsOpacity", 0.55),
    {
      kind: "select", name: "jmaWarningsKind", label: "種類", default: "all",
      options: JMA_WARNING_KINDS.map(({ label, value }) => ({ label, value })),
      out: "jmaWarningsKindIdx", encode: JMA_WARNING_KINDS.map((k) => k.value),
    },
  ],
  jmaQuakes: [opacitySlider("jmaQuakesOpacity", 0.85), scaleSlider("jmaQuakesScale", 1)],
  jmaVolcanoes: [opacitySlider("jmaVolcanoesOpacity", 0.9), scaleSlider("jmaVolcanoesScale", 1)],
  // ── JMA／環境省 時間軸點位與區域（P4）：落雷沿用台灣落雷控件；物候可切現象（filter 需重建）──
  jmaLightning: [
    { kind: "slider", name: "jmaLightningMinutes", labelPrefix: "保留", digits: 0, labelSuffix: " min", default: 10, min: 5, max: 360, step: 5 },
    opacitySlider("jmaLightningOpacity", 0.85),
    scaleSlider("jmaLightningScale", 1),
  ],
  jmaWbgt: [opacitySlider("jmaWbgtOpacity", 0.9), scaleSlider("jmaWbgtScale", 1)],
  jmaSnowcap: [opacitySlider("jmaSnowcapOpacity", 0.95), scaleSlider("jmaSnowcapScale", 1)],
  jmaAutumnLeaves: [
    {
      kind: "select", name: "jmaAutumnLeavesPhenomenon", label: "現象", default: "015",
      options: JMA_AUTUMN_PHENOMENA.map(({ label, value }) => ({ label, value })),
      out: "jmaAutumnLeavesPhenomenonIdx", encode: JMA_AUTUMN_PHENOMENA.map((p) => p.value),
    },
    opacitySlider("jmaAutumnLeavesOpacity", 0.9), scaleSlider("jmaAutumnLeavesScale", 1),
  ],
  jmaSakura: [
    {
      kind: "select", name: "jmaSakuraPhenomenon", label: "現象", default: "004",
      options: JMA_SAKURA_PHENOMENA.map(({ label, value }) => ({ label, value })),
      out: "jmaSakuraPhenomenonIdx", encode: JMA_SAKURA_PHENOMENA.map((p) => p.value),
    },
    opacitySlider("jmaSakuraOpacity", 0.9), scaleSlider("jmaSakuraScale", 1),
  ],
  jmaRainySeason: [opacitySlider("jmaRainySeasonOpacity", 0.55)],
  // JMA 發布幀影像（image source＋raster-color）：raster 透明度 SSOT；走 overlayParams（host 用 useKeyOverlayParams 讀）
  jmaSnowDepth: [
    {
      kind: "slider", name: "jmaSnowDepthOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaRadar: [
    {
      kind: "slider", name: "jmaRadarOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaRasrf: [
    {
      kind: "slider", name: "jmaRasrfOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaRiskLand: [
    {
      kind: "slider", name: "jmaRiskLandOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaRiskInund: [
    {
      kind: "slider", name: "jmaRiskInundOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaUvIndex: [
    {
      kind: "slider", name: "jmaUvIndexOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaSst: [
    {
      kind: "slider", name: "jmaSstOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaSeaIce: [
    {
      kind: "slider", name: "jmaSeaIceOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaHimawari: [
    {
      kind: "slider", name: "jmaHimawariOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaAnaSnowFirst: [
    {
      kind: "slider", name: "jmaAnaSnowFirstOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaAnaSnowDays: [
    {
      kind: "slider", name: "jmaAnaSnowDaysOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaAnaRainDays: [
    {
      kind: "slider", name: "jmaAnaRainDaysOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaAnaRiskLandHours: [
    {
      kind: "slider", name: "jmaAnaRiskLandHoursOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  jmaAnaRiskInundHours: [
    {
      kind: "slider", name: "jmaAnaRiskInundHoursOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
  ],
  // 上游直連（P5）：GIBS 衛星雪覆蓋 raster＋產品切換；洪水キキクル line。黃砂是圖片面板，無控件。
  gibsSnowCover: [
    {
      kind: "slider", name: "gibsSnowCoverOpacity", labelPrefix: "透明度", digits: 2,
      default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05,
    },
    {
      kind: "select", name: "gibsSnowCoverProduct", label: "資料源", default: "modis_terra",
      options: GIBS_SNOW_PRODUCTS.map(({ label, value }) => ({ label, value })),
      out: "gibsSnowCoverProductIdx", encode: GIBS_SNOW_PRODUCTS.map((p) => p.value),
    },
  ],
  jmaRiskFlood: [opacitySlider("jmaRiskFloodOpacity", JMA_FLOOD_OPACITY)],
  // <codemod:append JP_PACK_PARAMS>
} satisfies Partial<Record<JpLayerKey, LayerParamSpec[]>>;
