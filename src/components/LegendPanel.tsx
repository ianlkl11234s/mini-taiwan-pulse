import { Fragment, useState, createContext, useContext } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS, SURFACE, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { ROAD_CONGESTION_COLORS } from "../data/roadCongestionLoader";
import type { LayerVisibility } from "../types";
import { CROP_SUITABILITY_CROPS } from "../data/cropSuitabilityCrops";
import { AGRI_POI_TYPES } from "../data/agriPOITypes";
import { MEDICAL_POI_TYPES } from "../data/medicalPOITypes";
import { AGRI_COMPANY_TYPES } from "../data/agriCompanyTypes";
import { ALERT_GROUPS, ALERT_GROUP_KEYS } from "../data/disasterAlertTypes";
import { NEWS_CATEGORIES } from "../data/newsEventTypes";
import { ECO_NETWORK_ZONE_TYPES } from "../data/ecoNetworkZoneTypes";
import { TEMPERATURE_GRID_BANDS } from "../data/temperatureGridTypes";
import { resolveMicroSensorMode, MICRO_SENSOR_NO_DATA_COLOR } from "../data/microSensorTypes";
import { FOREST_RESERVE_TYPES } from "../data/forestReserveTypes";
import { RE_PALETTES } from "../map/overlayRegistry";
import {
  WIND_FIELD_RAMP, WIND_SPEED_MAX, OCEAN_CURRENTS_RAMP, OCEAN_SPEED_MAX,
  DUST_BAKE_STOPS, rampToGradient,
} from "../map/climateRamps";
import { useClimateFrameStatus, type ClimateFrameStatusKey } from "../state/climateFrameStore";
import {
  FIRE_STATION_CATS, FIRE_HYDRANT_CATS, FIRE_EVENT_CATS, FIRE_HYDRANT_COVERAGE_NOTE,
  FIRE_ISOCHRONE_BANDS, FIRE_ISOCHRONE_NOTE,
} from "../data/fireTypes";
import { FARM_SPECIES, OTHER_SPECIES_LEGEND, SLAUGHTER_CATS, FEED_COLOR, MARKET_COLOR } from "../data/livestockTypes";
import { SPORTS_CATEGORIES } from "../data/sportsTypes";
import {
  STREET_TREE_SPECIES, STREET_TREE_OTHER_COLOR,
  STREET_TREE_DIAMETER_BANDS, STREET_TREE_HEIGHT_BANDS,
} from "../data/streetTreeColors";
import {
  PROTECTED_TREE_AGE_BANDS, PROTECTED_TREE_CITIES,
  RIVERSIDE_TREE_SPECIES, RIVERSIDE_TREE_OTHER_COLOR,
  TAIPEI_PARK_CATEGORIES, URBAN_MISSING_COLOR,
  STREET_TREE_3EPOCH_TRAJ, CANOPY_HEIGHT_RAMP,
  STREET_TREE_NATIONAL_SPECIES, STREET_TREE_NATIONAL_CITIES, TREE_PIT_TYPES,
} from "../data/urbanOpenSpaceTypes";
import { CANOPY_GIANT_DIST_BANDS } from "../data/canopyGiantsTypes";
import {
  CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES,
  ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR, PERFORMING_VENUE_COLOR,
  LIBRARY_SEATS_COLORS,
} from "../data/cultureTypes";
import {
  BUILDING_HEIGHT_BANDS, BUILDING_SRC_LABELS, BUILDINGS_GBA_ATTRIBUTION, BUILDING_NIGHT_LEGEND,
} from "../data/buildingsGbaTypes";
import {
  BUILDING_VALUE_BANDS, BUILDING_VALUE_NON_MARKET_COLOR,
  PROPERTY_VALUE_ATTRIBUTION, resolvePropertyValueScale, formatWanTwd,
} from "../data/propertyValueTypes";
import {
  URBAN_FORM_GRID_MODES, URBAN_FORM_GRID_ATTRIBUTION_GBA, URBAN_FORM_GRID_ATTRIBUTION_META,
} from "../data/urbanFormGridTypes";
import { URBAN_ZONING_CATEGORIES } from "../data/urbanZoningTypes";
import { MEDICAL_ISOCHRONE_BANDS, MEDICAL_ISOCHRONE_NOTE } from "../data/medicalIsochroneTypes";
import {
  SOIL_FERTILITY_METRICS,
  SOIL_FERTILITY_METRIC_OPTIONS,
  type SoilFertilityMetric,
} from "../data/agriSoilFertilityMetrics";
import { SATELLITE_COLORS, SATELLITE_LABELS } from "../data/satelliteTypes";
import {
  FUEL_COLORS,
  FUEL_FALLBACK_COLOR,
  RESERVE_INDICATOR_COLORS,
  RESERVE_INDICATOR_LABELS,
  CAPACITY_BREAKS,
  CAPACITY_RADIUS,
} from "../data/energyLoader";
import { LIGHTNING_TYPE_COLORS } from "../data/lightningLoader";
import {
  NUCLEAR_DOSE_THRESHOLDS,
  NUCLEAR_LEVEL_COLORS,
  type NuclearDoseLevel,
} from "../data/nuclearLoader";
import {
  ER_LEVEL_COLORS,
  ER_LEVEL_LABELS,
  ER_CONGESTION_THRESHOLDS,
  type ErCongestionLevel,
} from "../data/erCongestionTypes";
import {
  parkingAvailabilityColor, PARKING_NEUTRAL_STOPS, AVAILABILITY_NULL_COLOR,
  SOURCE_CATEGORY_META,
} from "../data/parkingLoader";
import {
  SEVERITY_BANDS, POLLUTION_MEDIUM_COLORS, POLLUTION_MEDIUM_LABELS,
  PENALTY_MEDIA, PENALTY_SEVERITY_COLORS, PENALTY_SEVERITY_LABELS,
  type PollutionMedium, type PollutionPenaltySeverity,
} from "../data/pollutionTypes";

/**
 * 右下角圖例面板 — 只顯示目前開啟的圖層對應圖例
 */

// ── Legend 文字主題色（light / dark 透過 context 分發給子圖例）──
// 只涵蓋中性文字 token 與中性底/邊框；各 layer 色票（swatch / 狀態色 / 漸層）不受影響。
interface LegendPalette {
  textStrong: string;
  textDefault: string;
  textMuted: string;
  textDim: string;
  bgSubtle: string;
  border: string;
}
const DARK_LEGEND: LegendPalette = {
  textStrong: COLORS.textStrong,
  textDefault: COLORS.textDefault,
  textMuted: COLORS.textMuted,
  textDim: COLORS.textDim,
  bgSubtle: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
};
const LIGHT_LEGEND: LegendPalette = {
  textStrong: "#111827",
  textDefault: "#1F2937",
  textMuted: "#4B5563",
  textDim: "#6B7280",
  bgSubtle: "rgba(0,0,0,0.04)",
  border: "rgba(0,0,0,0.10)",
};
const LegendThemeCtx = createContext<LegendPalette>(DARK_LEGEND);
const useLegendTheme = () => useContext(LegendThemeCtx);

// ── Earthquake depth color stops ──
const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── Road Events event_type ──
const ROAD_EVENT_TYPE_ITEMS = [
  { type: 3, color: "#ef4444", label: "事故 Accident" },
  { type: 1, color: "#eab308", label: "壅塞/事故 Congestion" },
  { type: 2, color: "#f97316", label: "施工 Construction" },
  { type: 7, color: "#a855f7", label: "活動/管制 Controlled" },
  { type: 5, color: "#dc2626", label: "災害/障礙 Disaster" },
];


// ── IoT 河川 delta 紅↔藍 ──
const IOT_RIVER_DELTA_STOPS = [
  { color: "#7e22ce", label: "-1m" },
  { color: "#a855f7", label: "-30cm" },
  { color: "#d8b4fe", label: "-10cm" },
  { color: "#94a3b8", label: "0" },
  { color: "#67e8f9", label: "+10cm" },
  { color: "#06b6d4", label: "+30cm" },
  { color: "#0e7490", label: "+1m" },
];

// ── IoT 水工結構 5 類別 ──
const IOT_STRUCTURE_TYPES = [
  { color: "#a855f7", label: "累計流量 Cumulative Flow", measure: "m³" },
  { color: "#f97316", label: "閘門 Watergate", measure: "開度 % / 水位 m" },
  { color: "#dc2626", label: "堤防安全 Dam Structure", measure: "角度 / 應力" },
  { color: "#eab308", label: "河床沖刷 Erosion", measure: "深度 m" },
  { color: "#92400e", label: "揚塵 Dust", measure: "PM10 / 風速 / 溫濕度" },
];

// ── 作物適栽 4 級 kind ──（與 agricultureLayerFactory.ts CROP_KIND_COLOR_EXPR 對齊）
const CROP_KIND_ITEMS = [
  { kind: 1, color: "#1b5e20", label: "最適 Premium" },
  { kind: 2, color: "#66bb6a", label: "適栽 Suitable" },
  { kind: 3, color: "#fff59d", label: "次適 Marginal" },
  { kind: 4, color: "#ef9a9a", label: "不適 Unsuitable" },
];

interface LegendPanelProps {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
  /** 淺色底圖時傳 false 讓面板外殼切成淺色 chrome（色票資料兩主題共用，不受影響）*/
  isDarkTheme?: boolean;
}

export interface LegendContext {
  visibility: LayerVisibility;
  overlayParams: Record<string, number>;
}

export interface LegendEntry {
  /** 任一 key 開啟即顯示此圖例（多 key = 共用同一份圖例的圖層群） */
  keys: (keyof LayerVisibility)[];
  render: (ctx: LegendContext) => React.ReactNode;
}

/**
 * Legend registry — 單一接線點：新 layer 要圖例就在這裡加一行
 * （元件寫在本檔下方）。layerConsistency 測試以本表為覆蓋依據。
 * 順序 = 面板顯示順序。
 */
export const LEGEND_REGISTRY: LegendEntry[] = [
  { keys: ["earthquakes"], render: () => <EarthquakeLegend /> },
  { keys: ["earthquakesGlobal"], render: () => <EarthquakeGlobalLegend /> },
  { keys: ["worldTrashDebris"], render: () => <WorldTrashDebrisLegend /> },
  { keys: ["typhoonTracks"], render: () => <TyphoonTrackLegend /> },
  { keys: ["windField"], render: () => <WindFieldLegend /> },
  { keys: ["oceanCurrents"], render: () => <OceanCurrentsLegend /> },
  { keys: ["dustForecast"], render: () => <DustForecastLegend /> },
  { keys: ["temperatureGrid"], render: () => <TemperatureGridLegend /> },
  { keys: ["aqiMicroSensors"], render: ({ overlayParams }) => <MicroSensorLegend modeIdx={overlayParams.aqiMicroModeIdx ?? 0} /> },
  { keys: ["lifelineAlerts", "floodAlerts", "weatherAlerts", "transitAlerts", "safetyAlerts"], render: ({ visibility }) => <DisasterAlertLegend visibility={visibility} /> },
  { keys: ["roadEvents"], render: () => <RoadEventsLegend /> },
  { keys: ["roadCongestion"], render: () => <RoadCongestionLegend /> },
  { keys: ["touristShuttleLive"], render: () => <TouristShuttleLegend /> },
  { keys: ["newsEvents"], render: () => <NewsEventsLegend /> },
  { keys: ["iotWraRiver"], render: () => <IotRiverLegend /> },
  { keys: ["iotWraStructure"], render: () => <IotStructureLegend /> },
  { keys: ["agriCropSuitability"], render: ({ overlayParams }) => <CropSuitabilityLegend cropId={overlayParams.agriCropSuitabilityCropId ?? 0} /> },
  { keys: ["agriPOI"], render: () => <AgriPOILegend /> },
  { keys: ["agriRetail", "agriProduceWholesale", "agriWholesaleMarket"], render: ({ visibility }) => <AgriCompanyLegend visibility={visibility} /> },
  { keys: ["agriSoilFertility"], render: ({ overlayParams }) => <SoilFertilityLegend metricIdx={overlayParams.agriSoilFertilityMetricIdx ?? 0} /> },
  { keys: ["fireEvents", "fireLatest"], render: () => <FireEventLegend /> },
  { keys: ["realEstateRentalGrid", "realEstateRentalPoint", "realEstateSaleGrid", "realEstateSalePoint", "realEstatePresaleGrid", "realEstatePresalePoint"], render: ({ visibility, overlayParams }) => <RealEstateLegend visibility={visibility} overlayParams={overlayParams} /> },
  { keys: ["fireStations"], render: () => <FireStationLegend /> },
  { keys: ["fireHydrants"], render: () => <FireHydrantLegend /> },
  { keys: ["fireIsochrone"], render: () => <FireIsochroneLegend /> },
  { keys: ["livestockFarmPig", "livestockFarmChicken", "livestockFarmCattle", "livestockFarmDuck", "livestockFarmGoose", "livestockFarmSheep", "livestockFarmOther"], render: () => <LivestockFarmLegend /> },
  { keys: ["livestockSlaughter", "livestockFeed", "livestockMarket"], render: () => <LivestockFacilityLegend /> },
  { keys: ["aquaculturePonds", "aquacultureZone", "aquacultureCageNet", "aquacultureWaterSatellite"], render: ({ visibility }) => <AquacultureLegend visibility={visibility} /> },
  { keys: ["aquacultureWaterSatelliteMoa"], render: () => <AquacultureWaterSatelliteMoaLegend /> },
  { keys: ["aquacultureWaterUnion"], render: () => <AquacultureWaterUnionLegend /> },
  { keys: ["aquacultureIntegrated"], render: () => <AquacultureIntegratedLegend /> },
  { keys: ["streetTreesTaipeiDiff"], render: ({ overlayParams }) => <StreetTreesTaipeiDiffLegend colorModeIdx={overlayParams.streetTreesTaipeiDiffColorModeIdx ?? 0} /> },
  { keys: ["protectedTreesNational"], render: ({ overlayParams }) => <ProtectedTreesNationalLegend colorModeIdx={overlayParams.protectedTreesNationalColorModeIdx ?? 0} /> },
  { keys: ["riversideTreesTaipei"], render: () => <RiversideTreesTaipeiLegend /> },
  { keys: ["parksTaipei"], render: () => <ParksTaipeiLegend /> },
  { keys: ["streetTreesTaipei3epoch"], render: ({ overlayParams }) => <StreetTrees3epochLegend colorModeIdx={overlayParams.streetTreesTaipei3epochColorModeIdx ?? 0} /> },
  { keys: ["streetTreesNational"], render: ({ overlayParams }) => <StreetTreesNationalLegend colorModeIdx={overlayParams.streetTreesNationalColorModeIdx ?? 0} /> },
  { keys: ["treePitsTaipei"], render: () => <TreePitsTaipeiLegend /> },
  { keys: ["buildingsGba"], render: ({ overlayParams }) => <BuildingsGbaLegend modeIdx={overlayParams.buildingsGbaModeIdx ?? 0} /> },
  { keys: ["urbanFormGrid"], render: ({ overlayParams }) => <UrbanFormGridLegend modeIdx={overlayParams.urbanFormGridModeIdx ?? 5} /> },
  { keys: ["propertyValueGrid"], render: ({ overlayParams }) => <PropertyValueGridLegend scaleIdx={overlayParams.propertyValueGridScaleIdx ?? 0} extruded={(overlayParams.propertyValueGridExtruded ?? 0) === 1} /> },
  { keys: ["urbanZoningTaipei", "urbanZoningNewTaipei"], render: () => <UrbanZoningLegend /> },
  { keys: ["canopyHeight"], render: () => <CanopyHeightLegend /> },
  { keys: ["canopyGiants"], render: () => <CanopyGiantsLegend /> },
  { keys: ["sportsSchool", "sportsPublicOther", "sportsPrivate", "sportsPark", "sportsCenter"], render: () => <SportsVenueLegend /> },
  { keys: ["culturalFacilities"], render: () => <CulturalFacilitiesLegend /> },
  { keys: ["culturalMuseums"], render: () => <CulturalMuseumsLegend /> },
  { keys: ["artsEvents"], render: () => <ArtsEventsLegend /> },
  { keys: ["performingVenues"], render: () => <PerformingVenuesLegend /> },
  { keys: ["librarySeats"], render: () => <LibrarySeatsLegend /> },
  // 🧳 觀光 Tourism — 4 個分類/雙模式圖例（其餘 8 單色/面層走 baseline）
  { keys: ["tourAttractions"], render: ({ overlayParams }) => <TourAttractionsLegend modeIdx={overlayParams.tourAttractionsModeIdx ?? 0} /> },
  { keys: ["tourHotels"], render: () => <TourHotelsLegend /> },
  { keys: ["tourHeritage"], render: () => <TourHeritageLegend /> },
  { keys: ["tourEvents"], render: () => <TourEventsLegend /> },
  { keys: ["govServiceOffices"], render: () => <GovServiceOfficeLegend /> },
  { keys: ["publicToilets"], render: () => <PublicToiletLegend /> },
  { keys: ["ecoNetworkZones"], render: () => <EcoNetworkZonesLegend /> },
  {
    keys: [
      "forestCompartments", "forestReserve", "forestRecreation", "forestRoads",
      "forestTreatmentWorks", "forestTrailSigns", "forestSignalPoints",
      "forestEducationCenters", "forestWildlife", "forestDamLakes",
      "forestFlatParks", "forestAlishanRail", "hikingTrails",
    ],
    render: ({ visibility }) => <ForestryLegend visibility={visibility} />,
  },
  { keys: ["satellitesYaogan", "satellitesJilin", "satellitesGaofen", "satellitesTJS", "satellitesBeidou", "satellitesShiyan", "satellitesTaiwan", "satellitesUSA", "satellitesJapan", "satellitesRussia", "satellitesIndia", "satellitesKorea", "satellitesFrance", "satellitesGermany", "satellitesItaly", "satellitesIsrael"], render: ({ visibility }) => <SatelliteLegend visibility={visibility} /> },
  { keys: ["waterCanals"], render: () => <WaterCanalLegend /> },
  { keys: ["lakesPondsOsm"], render: () => <LakesPondsLegend /> },
  { keys: ["medIsochrone", "medDesert"], render: () => <MedicalIsochroneLegend /> },
  { keys: ["medHospital", "medClinic", "medPharmacy", "medAED", "medLTC"], render: ({ visibility }) => <MedicalLegend visibility={visibility} /> },
  { keys: ["erHospital"], render: () => <ErCongestionLegend /> },
  { keys: ["parkingOnstreet", "parkingOffstreet"], render: ({ visibility }) => <ParkingLegend visibility={visibility} /> },
  { keys: ["floodSensor", "floodSensorIsochrone"], render: () => <FloodSensorLegend /> },
  { keys: ["powerPlants", "powerGenerationUnit"], render: () => <EnergyFuelLegend /> },
  { keys: ["powerRegionDemand", "powerStatusHud"], render: () => <EnergyReserveLegend /> },
  { keys: ["osmPowerLines", "osmPowerTowers"], render: () => <PowerGridLegend /> },
  { keys: ["powerPoles"], render: () => <PowerPolesLegend /> },
  { keys: ["aviationControl", "aviationRestricted"], render: ({ visibility }) => <AviationAirspaceLegend visibility={visibility} /> },
  { keys: ["droneNoFlyZone", "droneRestrictedZone"], render: ({ visibility }) => <DroneZonesLegend visibility={visibility} /> },
  { keys: ["osmSubstationsEhv"], render: () => <SubstationEhvLegend /> },
  { keys: ["osmSubstations"],    render: () => <SubstationLocalLegend /> },
  { keys: ["facPrimary", "facPlanned", "facHistorical", "facSecondary", "facOsmSupplement"],
    render: ({ visibility }) => <FacilityFuelLegend visibility={visibility} /> },
  { keys: ["facOffshore"], render: () => <FacOffshoreLegend /> },
  { keys: ["osmWindTurbines", "osmSolarFarms", "osmPowerPlantsStatic"], render: ({ visibility }) => <RenewablePoiLegend visibility={visibility} /> },
  { keys: ["offshoreWindZones", "islandPowerGrid", "fossilFuelInfra", "geothermalWells", "renewablePermitsTaipei"], render: ({ visibility }) => <EnergySpecialtyLegend visibility={visibility} /> },
  // 化石燃料 14 layer（Phase B）— 共用 FossilFuelLegend，按 visibility 過濾顯示行
  {
    keys: [
      "gasStationCpc", "gasStationFpcc", "gasStationTaisugar", "gasStationOther", "gasStationCanonical",
      "lpgSubpackaging", "lpgRetailers",
      "lngTerminal",
      "pipelineGas", "pipelineOilGas",
      "industrialRefinery", "industrialStorageTank", "industrialPowerPlant",
      "coalTerminal",
    ],
    render: ({ visibility }) => <FossilFuelLegend visibility={visibility} />,
  },
  // 雲林 POC 覆蓋分析 5 layer 共用 CoverageLegend，按 visibility 過濾顯示行
  {
    keys: ["gasCoverageAll", "gasCoverageCpc", "gasCoverageFpcc", "gasCoverageTaisugar", "evIsland"],
    render: ({ visibility }) => <CoverageLegend visibility={visibility} />,
  },
  { keys: ["lightning"], render: () => <LightningLegend /> },
  { keys: ["nuclearRadiation"], render: () => <NuclearLegend /> },
  // Base map：OSM 道路 highway 分級分色（其他 base layer 單色，依鐵則 2 不需圖例）
  { keys: ["osmRoadDrive"], render: () => <OsmRoadDriveLegend /> },
  { keys: ["slopeVector"], render: () => <SlopeVectorLegend /> },
  { keys: ["aspectVector"], render: () => <AspectVectorLegend /> },
  // 警察覆蓋分析 isochrone（共用 overlap_count 色階）
  {
    keys: ["policeIsoSubstation", "policeIsoPrecinct", "policeIsoCityDept"],
    render: ({ visibility }) => <PoliceIsochroneLegend visibility={visibility} />,
  },
  // 警政司法民防 17 layer — 共用 PoliceJusticeLegend，按 visibility 過濾顯示行
  {
    keys: [
      "policeStation", "womenChildWarning", "speedCamera", "speedZoneSegment",
      "court", "prosecutorsOffice", "correctionalFacility", "courtJurisdiction",
      "crimeAreaMonthly", "theftTaoyuan", "trafficAccidentYearly", "accidentTaipei",
      "a1AccidentRealtime",
      "investigationBureau", "antiCorruptionOffice", "immigrationOffice", "coastGuardStation",
      "civilDefenseShelter",
    ],
    render: ({ visibility }) => <PoliceJusticeLegend visibility={visibility} />,
  },
  // 環境污染 3 層
  { keys: ["pollutionFacility", "pollutionSite"], render: ({ visibility }) => <PollutionSeverityLegend visibility={visibility} /> },
  {
    keys: ["pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"],
    render: ({ visibility }) => <PollutionPenaltyLegend visibility={visibility} />,
  },
];

export function LegendPanel({ visibility, overlayParams, isDarkTheme = true }: LegendPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // 面板外殼 chrome（僅容器與標題文字，色票資料兩主題共用）
  const c = isDarkTheme
    ? {
        panelBg: SURFACE.strong,
        panelBorder: "rgba(100, 170, 255, 0.15)",
        headerText: COLORS.textMuted,
        shadow: "none",
      }
    : {
        panelBg: "rgba(255,255,255,0.94)",
        panelBorder: "rgba(0,0,0,0.10)",
        headerText: "#6B7280",
        shadow: "0 8px 24px rgba(0,0,0,0.15)",
      };

  // 子圖例文字主題色（透過 context 分發，色票資料兩主題共用）
  const legendPalette = isDarkTheme ? DARK_LEGEND : LIGHT_LEGEND;

  const active = LEGEND_REGISTRY.filter((e) => e.keys.some((k) => visibility[k]));
  if (active.length === 0) return null;

  return (
    <LegendThemeCtx.Provider value={legendPalette}>
    <div
      style={{
        width: 200,
        background: c.panelBg,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${c.panelBorder}`,
        borderRadius: RADIUS.xl,
        boxShadow: c.shadow,
        fontFamily: FONT_DATA,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: c.headerText,
          fontSize: FONT_SIZE.sm,
          fontFamily: FONT_DATA,
          letterSpacing: 1,
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
        <span>LEGEND</span>
      </button>

      {/* Content — registry 驅動，順序即 LEGEND_REGISTRY 順序 */}
      {expanded && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {active.map((entry, i) => (
            <Fragment key={entry.keys[0] ?? i}>
              {entry.render({ visibility, overlayParams })}
            </Fragment>
          ))}
        </div>
      )}
    </div>
    </LegendThemeCtx.Provider>
  );
}

// ── 環境污染：嚴重度（設施 + 場址共用）──
function PollutionSeverityLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const bands = visibility.pollutionSite && !visibility.pollutionFacility
    ? SEVERITY_BANDS.filter((b) => b.sev === 4)
    : SEVERITY_BANDS;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        污染嚴重度 SEVERITY
      </div>
      <FireCatRows cats={bands.map((b) => ({ color: b.color, label: b.label }))} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        列管 ≠ 污染｜設施色 = 最高嚴重度
      </div>
    </div>
  );
}

// ── 環境污染：裁處事件介質 ──
function PollutionPenaltyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const severityKeys: PollutionPenaltySeverity[] = [
    ...(visibility.pollutionPenaltyCritical ? ["critical" as const] : []),
    ...(visibility.pollutionPenaltyGeneral ? (["high", "normal"] as const) : []),
    ...(visibility.pollutionPenaltyMobile ? ["mobile" as const] : []),
  ];
  const severityCats = severityKeys.map((k) => ({
    color: PENALTY_SEVERITY_COLORS[k],
    label: PENALTY_SEVERITY_LABELS[k],
  }));
  const mediumCats = PENALTY_MEDIA.map((m: PollutionMedium) => ({
    color: POLLUTION_MEDIUM_COLORS[m],
    label: POLLUTION_MEDIUM_LABELS[m],
  }));
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        裁處分層 PENALTY
      </div>
      <FireCatRows cats={severityCats} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>
        介質 MEDIUM
      </div>
      <FireCatRows cats={mediumCats} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        重大點大小 ∝ 罰鍰｜白框 = 連續 / 停工等｜可年份播放
      </div>
    </div>
  );
}

// ── 台灣好行 Tourist Shuttle：配色模式圖例（route / speed / density 三模式）──
// 色階與 BusScene 的 SPEED_STOPS / DENSITY_STOPS 對齊
function TouristShuttleLegend() {
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        台灣好行 · 配色模式 COLOR
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{
          width: 10, height: 10, borderRadius: RADIUS.full,
          background: "linear-gradient(90deg,#4fc3f7,#f06292,#ba68c8)", display: "inline-block",
        }} />
        <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>路線 Route：依路線配色</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>速度 Speed (km/h)</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#b71c1c 0%,#e53935 12%,#ff9800 40%,#fdd835 66%,#66bb6a 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, marginBottom: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>停</span><span>慢</span><span>快</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>密度 Density (班次/hr)</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#1a237e 0%,#0097a7 33%,#fdd835 66%,#ff5722 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>冷門</span><span>幹線</span>
      </div>
    </div>
  );
}

// ── 消防圖例（火災 / 分隊 / 消防栓）──

function FireCatRows({ cats, square }: { cats: { color: string; label: string }[]; square?: boolean }) {
  const t = useLegendTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {cats.map((c) => (
        <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: square ? RADIUS.sm : RADIUS.full,
              background: c.color, opacity: 0.9, flexShrink: 0,
              border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

const OSM_ROAD_DRIVE_CATS = [
  { color: "#fb923c", label: "高速公路 Motorway" },
  { color: "#f87171", label: "快速道路 Trunk" },
  { color: "#fcd34d", label: "主要道路 Primary" },
  { color: "#9ca3af", label: "次要道路 Secondary" },
  { color: "#d4d4d4", label: "聯絡道路 Tertiary" },
  { color: "#e5e7eb", label: "其餘 (residential / service / unclassified)" },
];

function OsmRoadDriveLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        OSM 道路 ROAD
      </div>
      <FireCatRows cats={OSM_ROAD_DRIVE_CATS} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        z≥10 才顯示｜來源 OpenStreetMap｜55 萬 edges
      </div>
    </div>
  );
}

// ── 坡度 / 坡向 分級向量（PMTiles polygon）圖例 ──
const SLOPE_VECTOR_CATS = [
  { color: "#1a9850", label: "1級 <5% 平緩" },
  { color: "#66bd63", label: "2級 5-15%" },
  { color: "#d9ef8b", label: "3級 15-30%" },
  { color: "#fee08b", label: "4級 30-40%" },
  { color: "#fc8d59", label: "5級 40-55%" },
  { color: "#d73027", label: "6級 >55% 極陡" },
];

function SlopeVectorLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        坡度分級 SLOPE（建管六級坡）
      </div>
      <FireCatRows cats={SLOPE_VECTOR_CATS} square />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        建築技術規則坡度分級｜可點選查級別
      </div>
    </div>
  );
}

const ASPECT_VECTOR_CATS = [
  { color: "#e41a1c", label: "N 北" },
  { color: "#ff7f00", label: "NE 東北" },
  { color: "#ffde00", label: "E 東" },
  { color: "#a6d854", label: "SE 東南" },
  { color: "#4daf4a", label: "S 南" },
  { color: "#20b2aa", label: "SW 西南" },
  { color: "#377eb8", label: "W 西" },
  { color: "#984ea3", label: "NW 西北" },
  { color: "#bdbdbd", label: "平地" },
];

function AspectVectorLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        坡向分級 ASPECT（8 方位）
      </div>
      <FireCatRows cats={ASPECT_VECTOR_CATS} square />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        坡面朝向 8 方位｜可點選查方位
      </div>
    </div>
  );
}

const FLOOD_SENSOR_CATS = [
  { color: "#404040", label: "0 cm 無淹水" },
  { color: "#fde047", label: "<5 cm 輕度" },
  { color: "#fb923c", label: "≥5 cm 中度" },
  { color: "#ef4444", label: "≥15 cm 嚴重" },
  { color: "#7f1d1d", label: "≥30 cm 極嚴重" },
];

function FloodSensorLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        都市淹水 USWG
      </div>
      <FireCatRows cats={FLOOD_SENSOR_CATS} />
    </div>
  );
}

function FireEventLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        FIRE 火災歷史
      </div>
      <FireCatRows cats={FIRE_EVENT_CATS} />
    </div>
  );
}

function FireStationLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        消防分隊 STATIONS
      </div>
      <FireCatRows cats={FIRE_STATION_CATS} />
    </div>
  );
}

function LivestockFarmLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        畜禽飼養場 主畜種
      </div>
      <FireCatRows cats={FARM_SPECIES.filter((s) => s.key !== "其他")} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, marginBottom: 2 }}>
        其他（各物種）
      </div>
      <FireCatRows cats={OTHER_SPECIES_LEGEND} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        大小＋深淺 = 總隻數（越多越大越深；各畜種層內相對，跨畜種不可比）
      </div>
    </div>
  );
}

function LivestockFacilityLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
          屠宰場 SLAUGHTER
        </div>
        <FireCatRows cats={SLAUGHTER_CATS} />
      </div>
      <FireCatRows
        cats={[
          { color: FEED_COLOR, label: "飼料廠 Feed Factory" },
          { color: MARKET_COLOR, label: "拍賣/批發市場 Market" },
        ]}
      />
    </div>
  );
}

function GovServiceOfficeLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#8d6e63", label: "公所 District Office" },
    { color: "#7986cb", label: "戶政事務所 Household Reg." },
    { color: "#9ccc65", label: "地政事務所 Land Office" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        機關便民據點 GOV SERVICE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublicToiletLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#7e57c2", label: "特優級 Excellent" },
    { color: "#ab47bc", label: "優等級 Superior" },
    { color: "#ffb300", label: "普通級 Ordinary" },
    { color: "#e53935", label: "不合格 Failed" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        公廁清潔評鑑 TOILET GRADE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AquacultureLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = ([
    { key: "aquaculturePonds", color: "#26c6da", label: "逐口魚塭 Ponds" },
    { key: "aquacultureZone", color: "#66bb6a", label: "養殖漁業生產區 Zone" },
    { key: "aquacultureCageNet", color: "#5c6bc0", label: "海上箱網 Cage Net" },
    { key: "aquacultureWaterSatellite", color: "#26c6da", label: "確定 · 養殖/OSM" },
    { key: "aquacultureWaterSatellite", color: "#90a4ae", label: "蓄水池/農業設施" },
    { key: "aquacultureWaterSatellite", color: "#cfd8dc", label: "不確定 · 水田/其他" },
  ] as const).filter((it) => visibility[it.key]);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        養殖漁業 AQUACULTURE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AquacultureWaterSatelliteMoaLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "確認 Confirmed（NLSC 確認）" },
    { color: "#1e88e5", label: "漁電共生 Solar Symbiotic" },
    { color: "#9e9e9e", label: "其他 Other（未確認/有疑慮/疑山影）" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        魚塭·官方標籤版 MOA LABELED
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AquacultureWaterUnionLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "兩版都有 Both（最高信心）" },
    { color: "#43a047", label: "只官方 MOA Only" },
    { color: "#fb8c00", label: "只舊版 OSM Only" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        魚塭·整合對照版 UNION
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AquacultureIntegratedLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "逐口魚塭（OSM）Ponds" },
    { color: "#66bb6a", label: "衛星偵測補充 Satellite" },
    { color: "#ffa726", label: "生產區 Production" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        養殖漁業整合 INTEGRATED
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: 2, background: it.color,
                opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box", flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 行道樹變化圖例：依染色模式（0=狀態 1=樹種 2=胸徑 3=樹高）切換顯示內容。
// 色票資料 = src/data/streetTreeColors.ts（與 overlayRegistry 配色同一 SSOT）。
function StreetTreesTaipeiDiffLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();

  // 一列圓點色塊 + 標籤
  const dotRow = (color: string, label: string) => (
    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 10, height: 10, borderRadius: RADIUS.full, background: color,
          opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
          boxSizing: "border-box", flexShrink: 0,
        }}
      />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{label}</span>
    </div>
  );

  let subhead = "狀態 STATUS";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "樹種 SPECIES（前 10 大）";
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: s.name })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  } else if (colorModeIdx === 2) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = [
      { color: "#2e7d32", label: "存續 persisted" },
      { color: "#e53935", label: "消失 disappeared" },
      { color: "#9ccc65", label: "新增 appeared" },
    ];
  }

  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        行道樹變化 STREET TREE DIFF
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => dotRow(it.color, it.label))}
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
          半透明點 = 疑似重編號（非真消失/新增）
        </div>
      </div>
    </div>
  );
}

// 都市開放空間三層共用：一列圓點色塊 + 標籤（色票 SSOT = src/data/urbanOpenSpaceTypes.ts）
function UrbanDotRow({ color, label }: { color: string; label: string }) {
  const t = useLegendTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 10, height: 10, borderRadius: RADIUS.full, background: color,
          opacity: 0.9, border: "1px solid rgba(255,255,255,0.6)",
          boxSizing: "border-box", flexShrink: 0,
        }}
      />
      <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{label}</span>
    </div>
  );
}

// 受保護樹木圖例：依染色模式（0=樹齡 5 級冷→暖 1=城市 8 色）切換顯示內容。
function ProtectedTreesNationalLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  const rows = colorModeIdx === 1
    ? PROTECTED_TREE_CITIES.map((c) => ({ color: c.color, label: c.name }))
    : [
        ...PROTECTED_TREE_AGE_BANDS.map((b) => ({ color: b.color, label: b.label })),
        { color: URBAN_MISSING_COLOR, label: "樹齡未知" },
      ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        受保護樹木 PROTECTED TREES
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        {colorModeIdx === 1 ? "城市 CITY" : "推估樹齡 AGE"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
          點大小 ∝ 胸徑 dbh
        </div>
      </div>
    </div>
  );
}

// 河濱喬木圖例：樹種前 10 大 + 其他灰。
function RiversideTreesTaipeiLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        河濱喬木 RIVERSIDE TREES
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>樹種 SPECIES（前 10 大）</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RIVERSIDE_TREE_SPECIES.map((s) => <UrbanDotRow key={s.name} color={s.color} label={s.name} />)}
        <UrbanDotRow color={RIVERSIDE_TREE_OTHER_COLOR} label="其他 Other" />
      </div>
    </div>
  );
}

// 行道樹三時點圖例：依染色模式（0=軌跡 7 類 1=樹種 2=胸徑 3=樹高）切換顯示內容。
// 軌跡色票 SSOT = urbanOpenSpaceTypes.ts；樹種/胸徑/樹高沿用 streetTreeColors.ts（跨層視覺可比）。
function StreetTrees3epochLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  let subhead = "軌跡 TRAJECTORY（2022/2024/2026）";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "樹種 SPECIES（前 10 大）";
    rows = [
      ...STREET_TREE_SPECIES.map((s) => ({ color: s.color, label: s.name })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  } else if (colorModeIdx === 2) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else {
    rows = STREET_TREE_3EPOCH_TRAJ.map((c) => ({ color: c.color, label: `${c.label} (${c.code})` }));
  }
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        行道樹三時點 STREET TREE 3-EPOCH
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
      </div>
    </div>
  );
}

// 行道樹全國圖例：依染色模式（0=樹種前 10 大 1=胸徑 2=樹高 3=城市二色）切換顯示內容。
// 樹種/城市色票 SSOT = urbanOpenSpaceTypes.ts；胸徑/樹高沿用 streetTreeColors.ts（跨層視覺可比）。
function StreetTreesNationalLegend({ colorModeIdx = 0 }: { colorModeIdx?: number }) {
  const t = useLegendTheme();
  let subhead = "樹種 SPECIES（前 10 大）";
  let rows: { color: string; label: string }[];
  if (colorModeIdx === 1) {
    subhead = "胸徑 DIAMETER (cm)";
    rows = STREET_TREE_DIAMETER_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 2) {
    subhead = "樹高 HEIGHT (m)";
    rows = STREET_TREE_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  } else if (colorModeIdx === 3) {
    subhead = "城市 CITY";
    rows = STREET_TREE_NATIONAL_CITIES.map((c) => ({ color: c.color, label: c.label }));
  } else {
    rows = [
      ...STREET_TREE_NATIONAL_SPECIES.map((s) => ({ color: s.color, label: s.label })),
      { color: STREET_TREE_OTHER_COLOR, label: "其他 Other" },
    ];
  }
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        行道樹全國 STREET TREES TW
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
      </div>
    </div>
  );
}

// 人行道樹穴圖例：pit_type 二色（樹穴綠 / 花圃黃）。
function TreePitsTaipeiLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        人行道樹穴 TREE PITS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TREE_PIT_TYPES.map((p) => <UrbanDotRow key={p.name} color={p.color} label={p.name} />)}
      </div>
    </div>
  );
}

// GBA 建物輪廓圖例：依顯示模式（0=高度分級 1=資料來源 2=3D 立體沿用高度色階 3=夜景燈光
// 4=估值）切換內容 + 必掛署名。估值模式額外掛實價登錄署名 + 非市場建物灰色說明。
function BuildingsGbaLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const subhead = modeIdx === 4 ? "估值 VALUE（單棟）"
    : modeIdx === 3 ? "夜景燈光 NIGHT LIGHTS"
    : modeIdx === 1 ? "資料來源 SOURCE"
    : "高度 HEIGHT";
  const rows = modeIdx === 4
    ? BUILDING_VALUE_BANDS.map((b) => ({ color: b.color, label: b.label }))
    : modeIdx === 3
    ? BUILDING_NIGHT_LEGEND
    : modeIdx === 1
    ? BUILDING_SRC_LABELS.map((s) => ({ color: s.color, label: s.label }))
    : BUILDING_HEIGHT_BANDS.map((b) => ({ color: b.color, label: b.label }));
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        建物輪廓 BUILDINGS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{subhead}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => <UrbanDotRow key={it.label} color={it.color} label={it.label} />)}
        {modeIdx === 4 && (
          <UrbanDotRow color={BUILDING_VALUE_NON_MARKET_COLOR} label="未估值（非市場建物）" />
        )}
      </div>
      {modeIdx === 3 && (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          樓層越高光越亮 · 橘白交錯 · 建議搭深色底圖
        </div>
      )}
      {modeIdx === 4 && (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          房+地合計市值（土地價已含在實價單價內）· 全台市場合計 ≈ 204 兆 · z13+ 才可逐棟看
        </div>
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {modeIdx === 4 ? PROPERTY_VALUE_ATTRIBUTION : BUILDINGS_GBA_ATTRIBUTION}
      </div>
    </div>
  );
}

// 🏢 房地產總市值網格圖例：v_mkt 9 級 inferno 色階 + 「總量 ≠ 單價」語意說明 + 雙署名。
// 級距標籤與 3D 高度錨都**隨手動選的網格大小換**（粗格值域整體右移，共用細格斷點會全部爆頂）。
function PropertyValueGridLegend({ scaleIdx = 0, extruded = false }: { scaleIdx?: number; extruded?: boolean }) {
  const t = useLegendTheme();
  const scale = resolvePropertyValueScale(scaleIdx);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        總市值網格 PROPERTY VALUE · {scale.shortLabel}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        每 {scale.shortLabel} 格總市值（不是單價）{extruded ? " · 3D 高度同步" : ""}
      </div>
      {/* 9 級 inferno：UrbanDotRow 的 swatch 自帶 1px 白 60% 細邊框，
          前兩級深紫（#1b0c41 / #4a0c6b）在深色 panel 上才不會糊掉 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={t.textDim} label="0（格內僅非市場建物，淡出顯示）" />
        {scale.bands.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} />)}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        越亮 = 這 {scale.shortLabel} 內壓了越多錢（量體 × 單價）；深紫沉底、亮黃發光。
        想看「每 m² 多貴」請開房地產買賣熱力圖。
      </div>
      {extruded && (
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
          高度：≤ {formatWanTwd(scale.heightFloorWan)}貼地、全台最高格（{formatWanTwd(scale.heightMaxWan)}）滿格，
          不封頂 —— 極端值直接刺出來。顏色看分佈、高度看極值。
          對比 γ 調中低值高度、整體高度調滿格公尺數。
        </div>
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {PROPERTY_VALUE_ATTRIBUTION}
      </div>
    </div>
  );
}

// 都市紋理網格圖例：依顯示模式（0-5）切換該模式的分級色帶；0 值格淡出的四個模式
// （棟數/平均高度/總量體/建蔽率）額外補一行「無建物」淡色說明。雙署名必掛（GBA + Meta/WRI）。
function UrbanFormGridLegend({ modeIdx = 5 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const mode = URBAN_FORM_GRID_MODES[modeIdx] ?? URBAN_FORM_GRID_MODES[URBAN_FORM_GRID_MODES.length - 1]!;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        都市紋理網格 URBAN FORM
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{mode.label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode.zeroFade && <UrbanDotRow color={t.textDim} label="0（無建物，淡出顯示）" />}
        {mode.bands.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} />)}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        500m 網格統計，建物 centroid 歸屬 + 樹冠 ≥3m 閾值之近似值
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        {URBAN_FORM_GRID_ATTRIBUTION_GBA}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
        {URBAN_FORM_GRID_ATTRIBUTION_META}
      </div>
    </div>
  );
}

// 土地使用分區圖例（北市 + 新北共用）：zone_category 9 類統一分色（色票 SSOT = urbanZoningTypes.ts）。
function UrbanZoningLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        土地使用分區 ZONING
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {URBAN_ZONING_CATEGORIES.map((c) => <UrbanDotRow key={c.value} color={c.color} label={c.label} />)}
      </div>
    </div>
  );
}

// 樹冠高度圖例：綠色漸層條 0m → 30m+（色帶與 raster PNG 預烤 colormap 一致）。
function CanopyHeightLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        樹冠高度 CANOPY HEIGHT
      </div>
      <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(to right, ${CANOPY_HEIGHT_RAMP.join(", ")})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
        <span>0 m</span>
        <span>40 m+</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
        Meta/WRI 2024 · ~20m 解析度
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
        © Meta & WRI · Tolan et al. 2024 · CC-BY 4.0
      </div>
    </div>
  );
}

// 樹冠巨木圖例：依離最近道路/步道/林道距離 5 級（近→遠 = 黃→深紅）。
function CanopyGiantsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        樹冠巨木 CANOPY GIANTS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        離最近道路/步道/林道
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CANOPY_GIANT_DIST_BANDS.map((b) => <UrbanDotRow key={b.label} color={b.color} label={b.label} />)}
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
          ≥ 45m 樹冠 · 7,823 點
        </div>
      </div>
    </div>
  );
}

// 台北公園圖例：category 7 類。
function ParksTaipeiLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        公園 PARKS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TAIPEI_PARK_CATEGORIES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
          點大小 ∝ 面積（log）
        </div>
      </div>
    </div>
  );
}

function SportsVenueLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        運動場館 分類 CATEGORY
      </div>
      <FireCatRows cats={SPORTS_CATEGORIES} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        大小 = 面積（area_sqm log；缺值退化固定大小）
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
        隸屬 5 類：學校 / 其他公共 / 民營 / 運動公園 / 國民運動中心（各自 toggle）
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 2, lineHeight: 1.4 }}>
        ⚠️「不對外」場館半透明淡化
      </div>
    </div>
  );
}

// 文化設施圖例：facility_type 6 類。
function CulturalFacilitiesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        文化設施 CULTURAL FACILITIES
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_FACILITY_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
      </div>
    </div>
  );
}

// 地方文化館圖例：type 5 類。
function CulturalMuseumsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        地方文化館 LOCAL MUSEUMS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類型 TYPE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CULTURAL_MUSEUM_TYPES.map((c) => <UrbanDotRow key={c.name} color={c.color} label={c.name} />)}
      </div>
    </div>
  );
}

// 藝文活動圖例：進行中 / 未開始 二色（by start_date ≤ 今日）。
function ArtsEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        藝文活動 ARTS EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={ARTS_EVENT_ONGOING_COLOR} label="進行中（已開始）" />
        <UrbanDotRow color={ARTS_EVENT_UPCOMING_COLOR} label="未開始（尚未開始）" />
      </div>
    </div>
  );
}

// 表演場館圖例：單色點 + 大小語意（∝ √活動場次數）。
function PerformingVenuesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        表演場館 PERFORMING VENUES
      </div>
      <UrbanDotRow color={PERFORMING_VENUE_COLOR} label="表演場館" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <div style={{ width: 16, height: 16, borderRadius: RADIUS.full, background: PERFORMING_VENUE_COLOR, flexShrink: 0, border: "1px solid rgba(255,255,255,0.6)", boxSizing: "border-box" }} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>小 = 1 場次 · 大 = 100+ 場次</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
        點大小 ∝ √活動場次數
      </div>
    </div>
  );
}

// 北市圖即時座位圖例：空位率漸層（紅=滿→黃→綠=空位多）+ 灰=休館中。
function LibrarySeatsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        北市圖即時座位 LIBRARY SEATS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>空位率 FREE RATIO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.empty} label="滿（無空位）" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.half} label="半滿" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.full} label="空位多" />
        <UrbanDotRow color={LIBRARY_SEATS_COLORS.closed} label="休館中" />
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        6 分館聚合 · 資料 10 分鐘更新
      </div>
    </div>
  );
}

// ── 🧳 觀光 Tourism 圖例 ──

// 觀光景點：分類著色（五類）↔ 熱度著色（年遊客量 log 色帶 + 灰=無統計）雙模式。
const TOUR_ATTRACTION_CATS = [
  { color: "#2e7d32", label: "自然 Nature" },
  { color: "#6d4c41", label: "文化 Culture" },
  { color: "#ab47bc", label: "休閒藝術 Leisure & Arts" },
  { color: "#0288d1", label: "都會社區 Urban Community" },
  { color: "#9e9e9e", label: "其他 Other" },
];

function TourAttractionsLegend({ modeIdx }: { modeIdx: number }) {
  const t = useLegendTheme();
  const heat = modeIdx === 1;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        觀光景點 ATTRACTIONS
      </div>
      {heat ? (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>年遊客量（log）VISITORS</div>
          <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right, #ffe082, #ffb300, #f4511e, #b71c1c)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2 }}>
            <span>1 萬</span>
            <span>3,000 萬</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <UrbanDotRow color="#616161" label="無統計（非統計據點）" />
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>分類 CATEGORY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOUR_ATTRACTION_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
          </div>
        </>
      )}
    </div>
  );
}

// 旅宿：hotel_classes 四類分色。
const TOUR_HOTEL_CATS = [
  { color: "#d32f2f", label: "國際觀光旅館 Intl. Tourist Hotel" },
  { color: "#f57c00", label: "一般觀光旅館 Std. Tourist Hotel" },
  { color: "#1976d2", label: "旅館 Hotel" },
  { color: "#43a047", label: "民宿 B&B" },
];

function TourHotelsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        旅宿 HOTELS & B&Bs
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類別 CLASS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HOTEL_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
      </div>
    </div>
  );
}

// 文化資產：category 三值分色。
const TOUR_HERITAGE_CATS = [
  { color: "#5d4037", label: "古蹟 Monument" },
  { color: "#8d6e63", label: "歷史建築 Historic Building" },
  { color: "#a1887f", label: "文化景觀 Cultural Landscape" },
];

function TourHeritageLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        文化資產 HERITAGE
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>類別 CATEGORY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TOUR_HERITAGE_CATS.map((c) => <UrbanDotRow key={c.label} color={c.color} label={c.label} />)}
      </div>
    </div>
  );
}

// 觀光活動・節慶：進行中 / 未開始 二色（by start/end 對今日）。
function TourEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        觀光活動・節慶 EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <UrbanDotRow color="#f9a825" label="進行中 Ongoing" />
        <UrbanDotRow color="#90a4ae" label="未開始 Upcoming" />
      </div>
    </div>
  );
}

function FireHydrantLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        消防栓 HYDRANTS
      </div>
      <FireCatRows cats={FIRE_HYDRANT_CATS} square />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_HYDRANT_COVERAGE_NOTE}
      </div>
    </div>
  );
}

function FireIsochroneLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        救援等時圈 ISOCHRONE
      </div>
      <FireCatRows
        cats={FIRE_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_ISOCHRONE_NOTE}
      </div>
    </div>
  );
}

function EcoNetworkZonesLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        國土綠網分區 ECO NETWORK
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ECO_NETWORK_ZONE_TYPES.map((z) => (
          <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 9, height: 9, borderRadius: RADIUS.sm, background: z.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDefault }}>{z.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 房地產 Legend（3 類價格色帶，依開啟類別顯示；色票/domain 單一真實來源 = RE_PALETTES）──

const RE_LEGEND_ROWS: { keys: (keyof LayerVisibility)[]; label: string; palette: "rental" | "sale" | "presale" }[] = [
  { keys: ["realEstateRentalGrid", "realEstateRentalPoint"], label: "🏠 租賃 單價", palette: "rental" },
  { keys: ["realEstateSaleGrid", "realEstateSalePoint"], label: "🏢 買賣 單價", palette: "sale" },
  { keys: ["realEstatePresaleGrid", "realEstatePresalePoint"], label: "🏗️ 預售 單價", palette: "presale" },
];

function RealEstateLegend({ visibility, overlayParams }: { visibility: LayerVisibility; overlayParams: Record<string, number> }) {
  const t = useLegendTheme();
  const excl = !!overlayParams.realEstateExcludeTaipei;
  const active = RE_LEGEND_ROWS.filter((r) => r.keys.some((k) => visibility[k]));
  if (active.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        房地產 單價 (NT$/m²){excl ? " · 排除雙北" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map((r) => {
          const p = RE_PALETTES[r.palette];
          const [lo, hi] = excl ? p.domainExcl : p.domain;
          return (
            <div key={r.label}>
              <div style={{ fontSize: FONT_SIZE.xs, color: t.textDefault, marginBottom: 2 }}>{r.label}</div>
              <div style={{ height: 8, borderRadius: RADIUS.sm, background: `linear-gradient(to right, ${p.colors.join(", ")})` }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 1 }}>
                <span>{lo.toLocaleString()}</span>
                <span>{hi.toLocaleString()}{excl ? "+" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Forestry Legend (15 layer 顏色/圖示) ──

const FORESTRY_LEGEND_ROWS: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "square" | "line" }[] = [
  { key: "forestCompartments", color: "#15803D", label: "林班 Compartments", shape: "square" },
  { key: "forestReserve", color: "#0F766E", label: "保安林 Reserve", shape: "square" },
  { key: "forestRecreation", color: "#65A30D", label: "森林遊樂區 Recreation", shape: "square" },
  { key: "forestRoads", color: "#A16207", label: "林道 Forest Roads", shape: "line" },
  { key: "forestTreatmentWorks", color: "#F59E0B", label: "治理工程 Treatment", shape: "circle" },
  { key: "forestTrailSigns", color: "#84CC16", label: "步道路標 Trail Signs", shape: "circle" },
  { key: "forestSignalPoints", color: "#22C55E", label: "通訊點 Signal Points", shape: "circle" },
  { key: "forestEducationCenters", color: "#0EA5E9", label: "自然教育中心 Education", shape: "circle" },
  { key: "forestWildlife", color: "#A855F7", label: "野生動物分布 Wildlife", shape: "circle" },
  { key: "forestDamLakes", color: "#06B6D4", label: "堰塞湖 Dam Lakes", shape: "circle" },
  { key: "forestFlatParks", color: "#A3E635", label: "平地森林 Flat Parks", shape: "circle" },
  { key: "forestAlishanRail", color: "#92400E", label: "阿里山鐵路 Alishan Rail (車站)", shape: "circle" },
  { key: "hikingTrails", color: "#d62728", label: "全台步道 Hiking Trails", shape: "line" },
];

const HIKING_TRAIL_SOURCES: { color: string; label: string }[] = [
  { color: "#d62728", label: "A 林業署國家步道" },
  { color: "#1f77b4", label: "B OpenStreetMap" },
  { color: "#2ca02c", label: "C 雪霸國家公園 SHP" },
  { color: "#9467bd", label: "C 金門國家公園 KML" },
  { color: "#ff7f0e", label: "D 臺北大縱走" },
  { color: "#e377c2", label: "D 新北市觀光局" },
];

function HikingTrailsSourcesLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>步道來源 source</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {HIKING_TRAIL_SOURCES.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 2, background: it.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForestReserveTypesLegend() {
  const t = useLegendTheme();
  return (
    <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>保安林種類</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {FOREST_RESERVE_TYPES.map((it) => (
          <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: RADIUS.sm, background: it.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForestryLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = FORESTRY_LEGEND_ROWS.filter((r) => visibility[r.key]);
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        FORESTRY 林業
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: r.shape === "line" ? 14 : 10,
                height: r.shape === "line" ? 2 : 10,
                borderRadius: r.shape === "circle" ? RADIUS.full : RADIUS.sm,
                background: r.color,
                opacity: 0.9,
                flexShrink: 0,
                border: r.shape === "line" ? "none" : "1px solid rgba(255,255,255,0.4)",
                boxSizing: "border-box",
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>
      {visibility.forestReserve && <ForestReserveTypesLegend />}
      {visibility.hikingTrails && <HikingTrailsSourcesLegend />}
    </div>
  );
}

// ── Soil Fertility Legend (6 metric 可切換) ──

function SoilFertilityLegend({ metricIdx }: { metricIdx: number }) {
  const t = useLegendTheme();
  const metricId = (SOIL_FERTILITY_METRIC_OPTIONS[metricIdx]?.value ?? "health") as SoilFertilityMetric;
  const meta = SOIL_FERTILITY_METRICS[metricId];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        SOIL FERTILITY
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {meta.label}{meta.unit ? ` (${meta.unit})` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {meta.legendStops.map((s) => (
          <div key={`${s.color}-${s.label}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10, height: 10, borderRadius: RADIUS.sm,
                background: s.color, opacity: 0.9, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Agriculture POI Legend (休農場 / 田媽媽 / 特色農旅) ──

function AgriPOILegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        AGRICULTURE POI
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {AGRI_POI_TYPES.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: it.color,
                opacity: 0.9,
                border: "1px solid #fff",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicalIsochroneLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        醫療等時圈 MEDICAL ISOCHRONE
      </div>
      <FireCatRows
        cats={MEDICAL_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.7)", marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {MEDICAL_ISOCHRONE_NOTE}
      </div>
    </div>
  );
}

function MedicalLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  // 只列出目前開啟的醫療 layer
  const shown = MEDICAL_POI_TYPES.filter((it) => visibility[it.visKey]);
  if (shown.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        MEDICAL 醫療據點
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: it.color,
                opacity: 0.9,
                border: "1px solid #fff",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgriCompanyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = AGRI_COMPANY_TYPES.filter((it) => visibility[it.key]);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        農企業登記 AGRI BUSINESS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: it.color,
                opacity: 0.9,
                border: "1px solid rgba(255,255,255,0.6)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {it.labelZh}
              <span style={{ color: t.textDim, marginLeft: 4 }}>{it.labelEn}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Crop Suitability Legend (作物適栽 4 級 kind) ──

function CropSuitabilityLegend({ cropId }: { cropId: number }) {
  const t = useLegendTheme();
  const crop = CROP_SUITABILITY_CROPS.find((c) => c.id === cropId);
  const cropLabel = crop ? `${crop.nameZh} (${crop.nameEn})` : `#${cropId}`;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        CROP SUITABILITY
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 4 }}>
        {cropLabel}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {CROP_KIND_ITEMS.map((s) => (
          <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.sm,
                background: s.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earthquake Legend ──

function EarthquakeLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        EARTHQUAKE
      </div>

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          Magnitude
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[3, 5, 7].map((m) => {
            const r = m === 3 ? 4 : m === 5 ? 10 : 24;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 16),
                    height: Math.min(r, 16),
                    borderRadius: RADIUS.full,
                    background: "rgba(255, 59, 48, 0.4)",
                    border: "1px solid rgba(255, 59, 48, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── USGS Global Earthquake Legend ──

const EQ_GLOBAL_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#dc2626", label: "0" },
  { depth: 30, color: "#f97316", label: "30" },
  { depth: 70, color: "#facc15", label: "70" },
  { depth: 150, color: "#38bdf8", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

function EarthquakeGlobalLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        USGS GLOBAL · HOURLY
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_GLOBAL_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_GLOBAL_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          Magnitude (M)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[2, 4, 6, 8].map((m) => {
            const r = m === 2 ? 4 : m === 4 ? 8 : m === 6 ? 14 : 20;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 18),
                    height: Math.min(r, 18),
                    borderRadius: RADIUS.full,
                    background: "rgba(220, 38, 38, 0.4)",
                    border: "1px solid rgba(220, 38, 38, 0.85)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Typhoon Track Legend ──

function TyphoonTrackLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        TYPHOON · JMA / JTWC
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 28, height: 0, borderTop: "3px solid #a855f7", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>實際軌跡 Observed（實心紫）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 0,
              borderTop: "2px dashed #38bdf8",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>預測軌跡 Forecast（藍虛線 / 空心點）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 12, height: 12, borderRadius: RADIUS.full,
              background: "transparent", border: "2px solid #fde047", flexShrink: 0,
              boxShadow: "0 0 4px rgba(240,171,252,0.6)",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>現在位置 Current（黃圈，click 看詳情）</span>
        </div>
      </div>
    </div>
  );
}

// ── 全球氣候場 Legends（色階與 climateRamps.ts 共用，改色兩邊同步）──

function ClimateGradientBar({ gradient, labels }: { gradient: string; labels: string[] }) {
  const t = useLegendTheme();
  return (
    <>
      <div style={{ height: 8, borderRadius: RADIUS.md, background: gradient }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
        {labels.map((l) => (
          <span key={l} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{l}</span>
        ))}
      </div>
    </>
  );
}

// timeline 當前顯示幀的有效時間 + 種類（實況/預報）；無 manifest 時 hook 不寫入 → 不顯示。
function formatClimateFrameTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(/-/g, "/");
}

function ClimateFrameStamp({ statusKey }: { statusKey: ClimateFrameStatusKey }) {
  const t = useLegendTheme();
  const frame = useClimateFrameStatus(statusKey);
  if (!frame.validAt) return null;
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4 }}>
      {frame.kind === "forecast" ? "預報" : "實況"} · {formatClimateFrameTime(frame.validAt)}
    </div>
  );
}

function WindFieldLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        WIND 10M · NOAA GFS
      </div>
      <ClimateFrameStamp statusKey="windField" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        風速 Wind speed (m/s)
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(WIND_FIELD_RAMP)}
        labels={["0", "10", "20", `${WIND_SPEED_MAX}+`]}
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4 }}>
        click 地圖任一點讀風速/風向
      </div>
    </div>
  );
}

function OceanCurrentsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        OCEAN CURRENTS · CMEMS
      </div>
      <ClimateFrameStamp statusKey="oceanCurrents" />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        流速 Current speed (m/s)
      </div>
      <ClimateGradientBar
        gradient={rampToGradient(OCEAN_CURRENTS_RAMP)}
        labels={["0", "0.6", "1.2", `${OCEAN_SPEED_MAX.toFixed(1)}+`]}
      />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4 }}>
        click 海面任一點讀流速/流向
      </div>
    </div>
  );
}

function DustForecastLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        DUST AOD 550NM · CAMS
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        沙塵光學厚度（相對色階，透明 = 無沙塵）
      </div>
      <ClimateGradientBar
        gradient={`linear-gradient(to right, ${DUST_BAKE_STOPS.map((s) => `${s.color} ${(s.t * 100).toFixed(0)}%`).join(", ")})`}
        labels={["低 Low", "高 High"]}
      />
    </div>
  );
}

// 溫度網格 2D：11 級 step 色階（色票 SSOT = data/temperatureGridTypes.ts，
// 與 temperatureGridLayerFactory 的 fill-color step 表達式同源）。
function TemperatureGridLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        溫度網格 TEMPERATURE GRID
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {TEMPERATURE_GRID_BANDS.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 14, height: 9, borderRadius: 2, background: band.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 3, lineHeight: 1.4 }}>
        CWA 0.03° 逐時觀測分析格點
      </div>
    </div>
  );
}

// LASS 微型感測：三模式共用同一份圖例框，依當前顯示模式換色階列
// （色票 SSOT = data/microSensorTypes.ts，與 loader 預烤進 properties 的顏色同源；
//  溫度模式直接吃 TEMPERATURE_GRID_BANDS，與溫度網格 2D 跨圖層一致）。
function MicroSensorLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const t = useLegendTheme();
  const mode = resolveMicroSensorMode(modeIdx);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        微型感測 LASS AIRBOX
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>{mode.note}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {mode.legend.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: band.color, flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: MICRO_SENSOR_NO_DATA_COLOR, flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>無資料</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 3, lineHeight: 1.4 }}>
        LASS AirBox / 環境部微感測 · 最新 15 分鐘快照
      </div>
    </div>
  );
}

// ── Disaster Alert Legend ──

function RoadEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ROAD EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ROAD_EVENT_TYPE_ITEMS.map((item) => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: item.color,
                opacity: 0.85,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        ⚠ live_city 偏基隆；高雄缺 TDX 來源
      </div>
    </div>
  );
}

function RoadCongestionLegend() {
  const items = [
    { level: 1, label: "順暢" },
    { level: 2, label: "車多" },
    { level: 3, label: "略壅" },
    { level: 4, label: "壅塞" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        省道路況 CONGESTION
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <div key={it.level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_CONGESTION_COLORS[it.level], flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{it.level} {it.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 14, height: 4, borderRadius: 2, background: ROAD_CONGESTION_COLORS[0], flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>無資料</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        v1 僅省道 highway
      </div>
    </div>
  );
}

function DisasterAlertLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const groups = ALERT_GROUP_KEYS.filter((k) => visibility[k]);
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        NCDR 示警 ALERTS
      </div>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>
            {ALERT_GROUPS[g].label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(ALERT_GROUPS[g].types).map(([term, color]) => (
              <div key={term} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: RADIUS.sm,
                    background: color,
                    opacity: 0.8,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{term}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        填色深淺 = 嚴重度（Extreme→Minor）
      </div>
    </div>
  );
}

// ── News Events Legend (7 類分色) ──

function NewsEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        NEWS EVENTS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NEWS_CATEGORIES.map((cat) => (
          <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: RADIUS.full,
                background: cat.color,
                opacity: cat.key === "other" ? 0.4 : 0.9,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{cat.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        座標 = 鄉鎮代表點（非事件位置）
      </div>
    </div>
  );
}

// ── IoT River Legend (delta 紅↔藍) ──

function IotRiverLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        IOT 河川（補強）
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          當日水位變化
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${IOT_RIVER_DELTA_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>下降</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>持平</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>上升</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>-1m</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>0</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>+1m</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
        圈大小 = 變化幅度
      </div>
    </div>
  );
}

// ── IoT Structure Legend (5 類別 + 主要測項) ──

// ── 灌排渠道 3 色圖例 ──

const WATER_CANAL_ITEMS = [
  { color: "#2dd4bf", label: "灌溉專用渠道 Irrigation" },
  { color: "#a78bfa", label: "下游具引灌需求 Demand" },
  { color: "#94a3b8", label: "不具引灌需求/宜蘭 Other" },
];

function WaterCanalLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        灌排渠道 CANAL
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {WATER_CANAL_ITEMS.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 16, height: 3, borderRadius: RADIUS.sm,
                background: c.color, opacity: 0.9, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const LAKES_PONDS_CATS = [
  { color: "#4fc3f7", label: "埤塘 Pond" },
  { color: "#1e88e5", label: "湖泊 Lake" },
  { color: "#00acc1", label: "水塘 Reservoir (OSM 自標)" },
  { color: "#7e57c2", label: "水池 Basin" },
];

function LakesPondsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        湖泊 / 埤塘 LAKES & PONDS
      </div>
      <FireCatRows cats={LAKES_PONDS_CATS} square />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        已濾掉與魚塭圖層重疊者（39.1%）｜OSM ODbL
      </div>
    </div>
  );
}

function WorldTrashDebrisLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        全球垃圾殘骸 TRASH & DEBRIS
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: RADIUS.full,
            background: "#f59e0b",
            opacity: 0.9,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>偵測到的垃圾 / 殘骸點位</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.3 }}>
        點位密度反映 Mapillary 街景覆蓋，非真實垃圾分佈
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.3 }}>
        資料：Outerview (CC-BY-4.0)
      </div>
    </div>
  );
}

function IotStructureLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        IOT 水工結構
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {IOT_STRUCTURE_TYPES.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: RADIUS.full,
                background: s.color,
                opacity: 0.9,
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{s.label}</span>
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{s.measure}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SatelliteLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const items: { key: keyof LayerVisibility; cat: keyof typeof SATELLITE_COLORS }[] = [
    { key: "satellitesYaogan", cat: "china_yaogan" },
    { key: "satellitesJilin", cat: "china_jilin" },
    { key: "satellitesGaofen", cat: "china_gaofen" },
    { key: "satellitesTJS", cat: "china_tjs" },
    { key: "satellitesBeidou", cat: "china_beidou" },
    { key: "satellitesShiyan", cat: "china_shiyan" },
    { key: "satellitesTaiwan", cat: "taiwan" },
    { key: "satellitesUSA", cat: "usa" },
    { key: "satellitesJapan", cat: "japan" },
    { key: "satellitesRussia", cat: "russia" },
    { key: "satellitesIndia", cat: "india" },
    { key: "satellitesKorea", cat: "korea" },
    { key: "satellitesFrance", cat: "france" },
    { key: "satellitesGermany", cat: "germany" },
    { key: "satellitesItaly", cat: "italy" },
    { key: "satellitesIsrael", cat: "israel" },
  ];
  const active = items.filter((i) => visibility[i.key]);
  if (!active.length) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        衛星 SATELLITES
      </div>
      {active.map((i) => (
        <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 12, height: 12, borderRadius: RADIUS.full, background: SATELLITE_COLORS[i.cat], display: "inline-block" }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{SATELLITE_LABELS[i.cat]}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 即時點 = 子衛星正下方<br />
        ● 內圓 50 km swath（成像範圍示意）<br />
        ● 虛線外圓 1,500 km（仰角 ≥ 10° 可見 cone）<br />
        ● 軌跡 = 未來 30 分鐘地面航跡
      </div>
    </div>
  );
}

// ── Energy: fuel_type 分色 + capacity 半徑 ──

const FUEL_LEGEND_ROWS: { label: string; key: string }[] = [
  { label: "核能 Nuclear", key: "nuclear" },
  { label: "燃煤 Coal", key: "coal" },
  { label: "燃油 Oil", key: "oil" },
  { label: "天然氣 Gas", key: "natural_gas" },
  { label: "水力 Hydro", key: "hydro" },
  { label: "太陽 Solar", key: "solar" },
  { label: "風力 Wind", key: "wind" },
  { label: "地熱 Geothermal", key: "geothermal" },
  { label: "生質 Biomass/Biogas", key: "biomass" },
];

function EnergyFuelLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · FUEL
      </div>
      {FUEL_LEGEND_ROWS.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: RADIUS.full,
              background: FUEL_COLORS[row.key] ?? FUEL_FALLBACK_COLOR,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          Capacity (MW)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {[
            { label: `<${CAPACITY_BREAKS.small}`, r: CAPACITY_RADIUS.tiny },
            { label: `<${CAPACITY_BREAKS.medium}`, r: CAPACITY_RADIUS.small },
            { label: `<${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.medium },
            { label: `≥${CAPACITY_BREAKS.large}`, r: CAPACITY_RADIUS.large },
          ].map((x) => (
            <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div
                style={{
                  width: x.r * 2,
                  height: x.r * 2,
                  borderRadius: RADIUS.full,
                  background: FUEL_FALLBACK_COLOR,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 光柱（Layer 4）= 機組即時出力 / 裝置容量<br />
        ● 14 台電廠有 output；OSM/IPP 等暫無
      </div>
    </div>
  );
}

// ── Aviation: 航空器空域 eAIP ──

function AviationAirspaceLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  type Row = { key: string; label: string; color: string; dashed?: boolean };
  const controlRows: Row[] = [
    { key: "FIR", label: "FIR 飛航情報區（3）僅邊框", color: "#6495ED", dashed: true },
    { key: "TMA", label: "TMA 終端管制區（6）", color: "#4682B4" },
  ];
  const restrictedRows: Row[] = [
    { key: "CTR", label: "CTR/CONTROL/SURFACE 機場管制（20）", color: "#1E90FF" },
    { key: "RCR", label: "RCR 限航區（29）", color: "#DC3545" },
    { key: "DANGER", label: "DANGER 危險區（2）", color: "#FF5722" },
    { key: "ULZ", label: "ULZ 超輕型活動區（20）", color: "#FFC107" },
    { key: "CIRCUIT", label: "CIRCUIT 起降航線（1）", color: "#4CAF50" },
  ];
  const renderRow = (r: Row) => (
    <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <span style={r.dashed
        ? { width: 14, height: 10, border: `1.5px dashed ${r.color}`, display: "inline-block", borderRadius: 2, boxSizing: "border-box" }
        : { width: 14, height: 10, background: r.color, display: "inline-block", borderRadius: 2, opacity: 0.55 }} />
      <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        AVIATION · 航空器空域 eAIP
      </div>
      {visibility.aviationControl && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4, marginBottom: 2 }}>
            ✈️ 飛航情報 / 終端管制
          </div>
          {controlRows.map(renderRow)}
        </>
      )}
      {visibility.aviationRestricted && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
            ⛔ 機場管制 / 限航 / 危險
          </div>
          {restrictedRows.map(renderRow)}
        </>
      )}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 來源：民航局 eAIP AIRAC 01-26（2026-03-19）<br />
        ● 載人航空器適用（民航法 §43），與 🛸 無人機規則不同<br />
        ● 點 polygon 看 floor/ceiling 高度上下界
      </div>
    </div>
  );
}

// ── Aviation: 無人機禁航區 ──

function DroneZonesLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows: Array<{ key: string; label: string; color: string }> = [];
  if (visibility.droneNoFlyZone) {
    rows.push({ key: "nfz", label: "🚫 禁航區（紅+未分類 5,633）禁飛", color: "#DC3545" });
  }
  if (visibility.droneRestrictedZone) {
    rows.push({ key: "restricted", label: "⚠️ 限航區（黃 108）需申請", color: "#FFC107" });
  }
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        AVIATION · 無人機空域
      </div>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 14, height: 10, background: r.color, display: "inline-block", borderRadius: 2, opacity: 0.55 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 來源：民航局 dronegis（2026-06）<br />
        ● z &lt; 7 不顯示，避免大區塊遮蓋<br />
        ● 點 polygon 可看罰則 / 主管機關
      </div>
    </div>
  );
}

// ── Energy: 高壓電網 voltage tier + line_type ──

function PowerPolesLegend() {
  const t = useLegendTheme();
  const typeRows = [
    { label: "水泥桿（83.7%）", color: "#94a3b8" },
    { label: "水泥併桿（14.4%）", color: "#64748b" },
    { label: "木桿（1.0%）", color: "#a16207" },
    { label: "H桿（0.7%）", color: "#0ea5e9" },
    { label: "其他 8 種（0.2%）", color: "#f43f5e" },
  ];
  const heatStops = [
    { pct: "稀", color: "#38bdf8" },
    { pct: "中", color: "#22c55e" },
    { pct: "高", color: "#facc15" },
    { pct: "很高", color: "#f97316" },
    { pct: "極高", color: "#ef4444" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 全國電桿 2.96M
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
        密度（z8-12）
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
        {heatStops.map((s) => (
          <div key={s.pct} style={{ flex: 1, textAlign: "center" }}>
            <span style={{ display: "block", height: 8, background: s.color, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: t.textDim }}>{s.pct}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
        桿型（z11+）
      </div>
      {typeRows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 10, height: 10, background: r.color, display: "inline-block", borderRadius: "50%" }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 來源：台電 d077010（22 縣市，2026-06-15）<br />
        ● z8-12 看密度熱區、z13+ 看個別桿型<br />
        ● 金門 / 連江 / 澎湖無資料 → 走離島電網
      </div>
    </div>
  );
}

function PowerGridLegend() {
  const t = useLegendTheme();
  const voltageRows = [
    { kv: "345 kV", color: "#1AB6D9" },
    { kv: "161 kV", color: "#62D9AD" },
    { kv: "69 kV",  color: "#468BA6" },
    { kv: "未標／混合", color: "#DFE0DC" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 高壓電網
      </div>
      {voltageRows.map((r) => (
        <div key={r.kv} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 16, height: 3, background: r.color, display: "inline-block", borderRadius: 1 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.kv}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
        線型
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 3, background: "#62D9AD", display: "inline-block" }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>輸電（粗）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 20, height: 1.5, background: "#62D9AD", display: "inline-block", opacity: 0.55 }} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>配電（細）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              height: 2,
              backgroundImage: "linear-gradient(to right, #62D9AD 50%, transparent 0%)",
              backgroundSize: "6px 2px",
              backgroundRepeat: "repeat-x",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>地下電纜（虛線）</span>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 鐵塔需 zoom ≥ 13<br />
        ● 來源：OSM（同 openinframap），約 60% 線未標電壓
      </div>
    </div>
  );
}

// ── Energy: 變電所（超高壓）2 階（migration 235）──
function SubstationEhvLegend() {
  const t = useLegendTheme();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#ef4444", label: "超高壓開閉所 (345 kV 切換)",    sz: 9, n: 5 },
    { color: "#ffffff", label: "超高壓變電所 E/S (345→161 kV)", sz: 8, n: 33 },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 超高壓變電所
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 含圓形 halo 光暈強化全國級主幹節點
      </div>
    </div>
  );
}

// ── Energy: 變電所（區域）5 階（migration 235）──
function SubstationLocalLegend() {
  const t = useLegendTheme();
  const rows: { color: string; label: string; sz: number; n: number }[] = [
    { color: "#f97316", label: "一次變電所 P/S (161→69 kV)",       sz: 6.5, n: 129 },
    { color: "#14b8a6", label: "一次配電變電所 D/S (161→22.8 kV)", sz: 5.5, n: 90 },
    { color: "#facc15", label: "二次變電所 S/S (69→22.8 kV)",      sz: 5,   n: 199 },
    { color: "#3b82f6", label: "鐵路牽引變電所",                    sz: 4.5, n: 11 },
    { color: "#6b7280", label: "未分類",                            sz: 4,   n: 318 },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 區域變電所
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: r.sz * 2, height: r.sz * 2, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault, flex: 1 }}>{r.label}</span>
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.n}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 規則：name regex + voltage，台電 P/S / S/S 標示為準
      </div>
    </div>
  );
}

// ── Energy: Phase 8 SSOT facilities 6-layer ──
function FacilityFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const fuels: { c: string; label: string }[] = [
    { c: "#F2622E", label: "燃煤 coal" },
    { c: "#F2D64B", label: "油氣 oil_gas" },
    { c: "#d100ff", label: "核能 nuclear" },
    { c: "#3C92A6", label: "水力 hydro" },
    { c: "#F2E085", label: "光電 solar" },
    { c: "#1F4373", label: "風力 wind" },
    { c: "#8C7C4A", label: "生質 bioenergy" },
    { c: "#8C5D42", label: "地熱 geothermal" },
    { c: "#D9863D", label: "焚化 waste" },
  ];
  const showStatus = visibility.facPlanned || visibility.facHistorical;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 電廠燃料
      </div>
      {fuels.map((f) => (
        <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: f.c, display: "inline-block" }} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{f.label}</span>
        </div>
      ))}
      {showStatus && (
        <>
          <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>狀態</div>
          {visibility.facPlanned && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#9ca3af", border: "1.5px solid #fff500" }} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>興建中（電光黃框）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(156,163,175,0.55)", border: "1.5px solid #00d4ff" }} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>規劃中（電光藍框、半透明）</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(156,163,175,0.35)", border: "1.5px solid #a5b4fc" }} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>公告中（淡紫藍框）</span>
              </div>
            </>
          )}
          {visibility.facHistorical && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#525252", border: "1px solid #737373", opacity: 0.45 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>退役/擱置（深灰、退色）</span>
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 大小 ∝ log10(容量 MW)：0.5MW ~ 6GW 連續映射
      </div>
    </div>
  );
}

// ── Energy: 化石燃料 14 layer（Phase B） ──

const FOSSIL_FUEL_LEGEND: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "line" | "square" }[] = [
  { key: "gasStationCpc",         color: "#00875A", label: "加油站 中油 (1,971)",          shape: "circle" },
  { key: "gasStationFpcc",        color: "#1E40AF", label: "加油站 台塑系 (348)",          shape: "circle" },
  { key: "gasStationTaisugar",    color: "#EA580C", label: "加油站 台糖 (73)",             shape: "circle" },
  { key: "gasStationOther",       color: "#6B7280", label: "加油站 其他 (1,179)",          shape: "circle" },
  { key: "gasStationCanonical",   color: "#FAFAFA", label: "加油站 SSOT (3,053)",         shape: "circle" },
  { key: "lpgSubpackaging",       color: "#DC2626", label: "LPG 分裝/儲存 (113)",          shape: "circle" },
  { key: "lpgRetailers",          color: "#F87171", label: "LPG 加氣站/瓦斯行 (1,292)",    shape: "circle" },
  { key: "lngTerminal",           color: "#0891B2", label: "LNG 接收站 (7)",               shape: "circle" },
  { key: "pipelineGas",           color: "#FACC15", label: "天然氣主幹線 (11)",            shape: "line" },
  { key: "pipelineOilGas",        color: "#F59E0B", label: "油氣管線 OSM (10)",            shape: "line" },
  { key: "industrialRefinery",    color: "#F97316", label: "煉油/化工廠（精選）",         shape: "square" },
  { key: "industrialStorageTank", color: "#92400E", label: "油氣儲槽 (72)",                shape: "square" },
  { key: "industrialPowerPlant",  color: "#374151", label: "火力廠 polygon (26)",          shape: "square" },
  { key: "coalTerminal",          color: "#111827", label: "煤炭碼頭 (4)",                 shape: "circle" },
];

function FossilFuelLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const active = FOSSIL_FUEL_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 化石燃料
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {active.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: r.shape === "line" ? 18 : 10,
                height: r.shape === "line" ? 3 : 10,
                background: r.color,
                borderRadius: r.shape === "circle" ? RADIUS.full : r.shape === "square" ? RADIUS.sm : 0,
                border: "1px solid rgba(255,255,255,0.4)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 雲林 POC 覆蓋分析（PMTiles × OSM edge nearest distance）──
function CoverageLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const anyGas = visibility.gasCoverageAll || visibility.gasCoverageCpc
    || visibility.gasCoverageFpcc || visibility.gasCoverageTaisugar;
  const anyEv = visibility.evIsland;
  if (!anyGas && !anyEv) return null;

  const GAS_BANDS: { c: string; l: string }[] = [
    { c: "#16A34A",   l: "0–5 km" },
    { c: "#84CC16",   l: "5–10 km" },
    { c: "#F2D64B",   l: "10–20 km" },
    { c: "#F2A516",   l: "20–30 km" },
    { c: "#F23535",   l: "30 km+" },
  ];
  const EV_BANDS = GAS_BANDS;  // 跟加油站同色階

  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 全台最近距離（路網）
      </div>
      {anyGas && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>
            到最近加油站的路網距離
          </div>
          {GAS_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{ width: 18, height: 4, background: s.c, borderRadius: 1 }} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      {anyEv && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>
            到最近充電站的路網距離
          </div>
          {EV_BANDS.map((s) => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{ width: 18, height: 4, background: s.c, borderRadius: 1 }} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{s.l}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: t.textDim }}>
        osmnx + multi-source dijkstra · 每條 OSM edge 染色 · 全台主要路網
      </div>
    </div>
  );
}

function FacOffshoreLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 離岸風電場址（8 場）
      </div>
      {[
        { c: "#3C92A6", label: "運轉中", dash: false },
        { c: "#7AAEC0", label: "興建中（虛線 3,2）", dash: true },
        { c: "#7AAEC0", label: "規劃中（虛線 2,2）", dash: true },
        { c: "#A8C5D0", label: "公告中（虛線 1,3）", dash: true },
      ].map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 24, height: 8,
              background: r.dash
                ? `repeating-linear-gradient(to right, ${r.c} 0 4px, transparent 4px 7px)`
                : r.c,
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 來源：energy.power_facilities footprint（GEM polygon 配對成功 8 個）
      </div>
    </div>
  );
}

// ── Energy: OSM 風光電 POI（風機 offshore/onshore + 光電 + OSM 電廠 fuel） ──

function RenewablePoiLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · OSM 風光電
      </div>
      {visibility.osmWindTurbines && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>風機 (812)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#67e8f9", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>離岸 466</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#2dd4bf", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>陸域 / 未標 346</span>
          </div>
        </>
      )}
      {visibility.osmSolarFarms && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>光電廠 (734)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#fbbf24", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>POI 中心</span>
          </div>
        </>
      )}
      {visibility.osmPowerPlantsStatic && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>OSM 電廠 (513) by fuel</div>
          {[
            { k: "solar", c: "#fbbf24", l: "太陽" },
            { k: "wind", c: "#22d3ee", l: "風力" },
            { k: "hydro", c: "#3b82f6", l: "水力" },
            { k: "coal", c: "#374151", l: "煤" },
            { k: "gas", c: "#94a3b8", l: "天然氣" },
            { k: "nuclear", c: "#facc15", l: "核能" },
            { k: "waste", c: "#a3a300", l: "廢棄物" },
            { k: "other", c: "#9ca3af", l: "其他/未標" },
          ].map((x) => (
            <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
            ⚠ 與「電廠」(all_power_plants_v) 可能重疊
          </div>
        </>
      )}
    </div>
  );
}

// ── Energy: 特殊能源 5 layer 共用（offshore / island / fossil / geothermal / 北市再生） ──

function EnergySpecialtyLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 特殊
      </div>
      {visibility.offshoreWindZones && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4 }}>離岸風電場址 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 14, height: 10, background: "#22d3ee", opacity: 0.4, border: "1px solid #67e8f9" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>潛力場址（fill polygon）</span>
          </div>
        </>
      )}
      {visibility.islandPowerGrid && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>離島電網 (14) by fuel</div>
          {[
            { c: "#f97316", l: "柴油" },
            { c: "#94a3b8", l: "天然氣" },
            { c: "#fbbf24", l: "太陽" },
            { c: "#22d3ee", l: "風力" },
            { c: "#3b82f6", l: "水力" },
            { c: "#a78bfa", l: "其他" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.fossilFuelInfra && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>化石燃料 (9)</div>
          {[
            { c: "#22d3ee", l: "LNG 接收站" },
            { c: "#F97316", l: "煉油廠" },
            { c: "#94a3b8", l: "燃氣電廠" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block", border: "1px solid #475569" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
      {visibility.geothermalWells && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>地熱井 (36)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#ef4444", boxShadow: "0 0 6px #ef444466", display: "inline-block" }} />
            <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>井位 + 報告外連</span>
          </div>
        </>
      )}
      {visibility.renewablePermitsTaipei && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6 }}>北市再生 (438) by 類別</div>
          {[
            { c: "#fbbf24", l: "學校 164" },
            { c: "#94a3b8", l: "國有房地 149" },
            { c: "#a78bfa", l: "機關 119" },
            { c: "#ef4444", l: "焚化發電 3" },
            { c: "#a3a300", l: "沼氣發電 2" },
            { c: "#3b82f6", l: "水力發電 1" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: x.c, display: "inline-block" }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{x.l}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Energy: 燈號 G/Y/O/R ──

function EnergyReserveLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        ENERGY · 備轉燈號
      </div>
      {(["G", "Y", "O", "R"] as const).map((k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: RADIUS.full,
              background: RESERVE_INDICATOR_COLORS[k],
              boxShadow: `0 0 6px ${RESERVE_INDICATOR_COLORS[k]}99`,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>
            {k} · {RESERVE_INDICATOR_LABELS[k]}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● 4 區用電柱（Layer 3）柱高 ∝ consumption_mw<br />
        ● 柱色 = 全國燈號（共用一個值）
      </div>
    </div>
  );
}

// ── HAZARD: 落雷 / 核安 ──

function LightningLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        HAZARD · 落雷類型
      </div>
      {[
        { label: "雲對地 CG（高傷害）", color: LIGHTNING_TYPE_COLORS[0]! },
        { label: "雲中 IC", color: LIGHTNING_TYPE_COLORS[1]! },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: RADIUS.full,
              background: row.color, display: "inline-block",
              boxShadow: `0 0 5px ${row.color}aa`,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ● zoom &lt; 10 自動 cluster<br />
        ● 預設 60 min 視窗
      </div>
    </div>
  );
}

function NuclearLegend() {
  const t = useLegendTheme();
  const rows: { key: NuclearDoseLevel; label: string }[] = [
    { key: "normal", label: `正常 ≤ ${NUCLEAR_DOSE_THRESHOLDS.normal} µSv/h` },
    { key: "watch", label: `略高 ≤ ${NUCLEAR_DOSE_THRESHOLDS.watch}` },
    { key: "warning", label: `觀察 ≤ ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "alarm", label: `警戒 > ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "stale", label: "離線 stale（劑量不可信）" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        HAZARD · 核安劑量
      </div>
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: RADIUS.full,
              background: NUCLEAR_LEVEL_COLORS[row.key], display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: t.textDim }}>
        ⚠️ 高劑量 + stale = 感測器離線 ≠ 真實核災<br />
        背景值 0.039 ~ 0.072 µSv/h（自然輻射）
      </div>
    </div>
  );
}

function ParkingLegend({ visibility }: { visibility: LayerVisibility }) {
  const rateRows = [
    { rate: 1.0, label: "空位多 100%" },
    { rate: 0.5, label: "半滿 50%" },
    { rate: 0.15, label: "略滿 15%" },
    { rate: 0.0, label: "滿 0%" },
  ];
  const dot = (bg: string) => ({
    width: 10, height: 10, borderRadius: RADIUS.full,
    background: bg, display: "inline-block", flexShrink: 0,
  } as const);
  const neutralMid = PARKING_NEUTRAL_STOPS[Math.floor(PARKING_NEUTRAL_STOPS.length / 2)]?.[1] ?? "#94a3b8";
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        MOVE · 停車空位率
      </div>
      {rateRows.map((r) => (
        <div key={r.rate} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={dot(parkingAvailabilityColor(r.rate))} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{r.label}</span>
        </div>
      ))}
      {visibility.parkingOnstreet && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
          <span style={dot(neutralMid)} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim }}>
            台北路邊：僅容量（深=多），無即時空位
          </span>
        </div>
      )}
      {visibility.parkingOffstreet && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, margin: "6px 0 3px" }}>
            場外分類（外環）
          </div>
          {Object.values(SOURCE_CATEGORY_META).map((m) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{
                width: 10, height: 10, borderRadius: RADIUS.full,
                background: AVAILABILITY_NULL_COLOR, border: `2px solid ${m.ring}`,
                display: "inline-block", flexShrink: 0, boxSizing: "border-box",
              }} />
              <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{m.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: COLORS.textDim, lineHeight: 1.35 }}>
            圓越大 = 車位越多
          </div>
        </>
      )}
    </div>
  );
}

function ErCongestionLegend() {
  const rows: { key: ErCongestionLevel; label: string }[] = [
    { key: "smooth", label: `順暢 ≤ ${ER_CONGESTION_THRESHOLDS.smooth}` },
    { key: "light", label: `略壅 ${ER_CONGESTION_THRESHOLDS.smooth + 1}–${ER_CONGESTION_THRESHOLDS.light}` },
    { key: "congested", label: `壅塞 ${ER_CONGESTION_THRESHOLDS.light + 1}–${ER_CONGESTION_THRESHOLDS.congested}` },
    { key: "severe", label: `嚴重 > ${ER_CONGESTION_THRESHOLDS.congested}` },
    { key: "nodata", label: "無資料" },
  ];
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        MEDICAL · 急診壅塞（等一般病床）
      </div>
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: RADIUS.full,
              background: ER_LEVEL_COLORS[row.key], display: "inline-block",
            }}
          />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
            {ER_LEVEL_LABELS[row.key]} · {row.label}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.35, color: COLORS.textDim }}>
        ⚪ 白框 = 有加護病房 (ICU) 等待<br />
        分級依 wait_general_cnt 37 天 history 校準
      </div>
    </div>
  );
}

// ── 警政司法民防 17 layer 共用圖例 ──
const POLICE_JUSTICE_LEGEND: { key: keyof LayerVisibility; color: string; label: string; shape: "circle" | "line" | "square" }[] = [
  { key: "policeStation", color: "#1e40af", label: "警察機關", shape: "circle" },
  { key: "womenChildWarning", color: "#ec4899", label: "婦幼警示點", shape: "circle" },
  { key: "speedCamera", color: "#dc2626", label: "測速照相", shape: "circle" },
  { key: "speedZoneSegment", color: "#b91c1c", label: "區間測速路段", shape: "line" },
  { key: "court", color: "#7c3aed", label: "法院", shape: "circle" },
  { key: "prosecutorsOffice", color: "#a855f7", label: "檢察署", shape: "circle" },
  { key: "correctionalFacility", color: "#374151", label: "矯正機關", shape: "circle" },
  { key: "courtJurisdiction", color: "#c4b5fd", label: "法院管轄區（縣市）", shape: "square" },
  { key: "crimeAreaMonthly", color: "#991b1b", label: "鄉鎮犯罪 choropleth", shape: "square" },
  { key: "theftTaoyuan", color: "#f59e0b", label: "桃園竊盜", shape: "circle" },
  { key: "trafficAccidentYearly", color: "#fb7185", label: "A1 死亡事故（年度）", shape: "circle" },
  { key: "accidentTaipei", color: "#fda4af", label: "北市事故點 (A1/A2)", shape: "circle" },
  { key: "a1AccidentRealtime", color: "#ef4444", label: "A1 即時死亡事故", shape: "circle" },
  { key: "investigationBureau", color: "#0f766e", label: "調查局", shape: "circle" },
  { key: "antiCorruptionOffice", color: "#14b8a6", label: "廉政（中央/地方）", shape: "circle" },
  { key: "immigrationOffice", color: "#0ea5e9", label: "移民署服務站", shape: "circle" },
  { key: "coastGuardStation", color: "#0284c7", label: "海巡（巡防/漁港）", shape: "circle" },
  { key: "civilDefenseShelter", color: "#64748b", label: "防空避難所", shape: "circle" },
];

// ── 警察覆蓋分析 isochrone — overlap_count 色階 ──
const ISO_OVERLAP_BANDS: { c: string; l: string }[] = [
  { c: "#fee2e2", l: "1 站覆蓋" },
  { c: "#fca5a5", l: "2 站重疊" },
  { c: "#f87171", l: "3~4 站" },
  { c: "#ef4444", l: "5~7 站" },
  { c: "#dc2626", l: "8~11 站" },
  { c: "#991b1b", l: "12~19 站" },
  { c: "#7f1d1d", l: "20+ 站（市中心多重保護）" },
];

function PoliceIsochroneLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const anyOn = visibility.policeIsoSubstation || visibility.policeIsoPrecinct || visibility.policeIsoCityDept;
  if (!anyOn) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        警察覆蓋 · 重疊計數
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {ISO_OVERLAP_BANDS.map((b) => (
          <div key={b.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 10, background: b.c, borderRadius: RADIUS.sm, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{b.l}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 5, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
        每個面塊算「被幾個 station 同時覆蓋」，市中心通常 20+ 站重疊。
      </div>
    </div>
  );
}

function PoliceJusticeLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const active = POLICE_JUSTICE_LEGEND.filter((r) => visibility[r.key]);
  if (active.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        LAW & ORDER · 警政司法民防
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {active.map((r) => (
          <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: r.shape === "line" ? 18 : 10,
                height: r.shape === "line" ? 3 : 10,
                background: r.color,
                borderRadius: r.shape === "circle" ? RADIUS.full : r.shape === "square" ? RADIUS.sm : 0,
                border: "1px solid rgba(255,255,255,0.4)",
                boxSizing: "border-box",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.label}</span>
          </div>
        ))}
      </div>

      {/* 警察階層細分 — 開啟 policeStation 時顯示 */}
      {visibility.policeStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>警察階層（大小+色深）</div>
          {[
            { c: "#0a1e6b", s: 14, l: "警政署（總部）" },
            { c: "#1e3a8a", s: 11, l: "縣市警察局" },
            { c: "#1e40af", s: 9, l: "分局" },
            { c: "#3b82f6", s: 6, l: "派出所" },
            { c: "#dc2626", s: 8, l: "專業警隊（紅）" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 測速限速 — 開啟 speedCamera 時顯示 */}
      {visibility.speedCamera && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>限速越低 圈越大</div>
          {[
            { s: 14, l: "≤30 km/h（學校區）" },
            { s: 10, l: "40~50（市區）" },
            { s: 7, l: "60~80（省道）" },
            { s: 5, l: "≥90（國道）" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: "#dc2626", border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* A1 即時 30 天滾動 — 開啟 a1AccidentRealtime 時顯示 */}
      {visibility.a1AccidentRealtime && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>過去 30 天滾動</div>
          {[
            { c: "#ef4444", s: 14, l: "當天 (<24h)+漣漪" },
            { c: "#dc2626", s: 9, l: "本週 (1~7天)" },
            { c: "#7f1d1d", s: 5, l: "30 天內" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 法院階層 */}
      {visibility.court && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>法院階層</div>
          {[
            { c: "#4c1d95", s: 14, l: "最高法院 (2)" },
            { c: "#6d28d9", s: 11, l: "高等法院 (6)" },
            { c: "#7c3aed", s: 10, l: "高等行政 (3)" },
            { c: "#a855f7", s: 9, l: "智財商業 / 少家事" },
            { c: "#c4b5fd", s: 7, l: "地方法院 (22)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 檢察署階層 */}
      {visibility.prosecutorsOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>檢察署階層</div>
          {[
            { c: "#581c87", s: 13, l: "最高檢察署 (1)" },
            { c: "#7e22ce", s: 10, l: "高等檢察署 (6)" },
            { c: "#c084fc", s: 7, l: "地方檢察署 (22)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 矯正機關階層 */}
      {visibility.correctionalFacility && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>矯正機關</div>
          {[
            { c: "#111827", s: 14, l: "監獄 (29)" },
            { c: "#374151", s: 11, l: "看守所 (12)" },
            { c: "#7c3aed", s: 9, l: "戒治所 (4)" },
            { c: "#0d9488", s: 9, l: "矯正學校 (4)" },
            { c: "#0ea5e9", s: 8, l: "少年觀護所 (2)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 調查局階層 */}
      {visibility.investigationBureau && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>調查局</div>
          {[
            { c: "#064e3b", s: 11, l: "縣市調查處 (10)" },
            { c: "#0f766e", s: 7, l: "調查站 / 其他 (19)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 廉政階層 */}
      {visibility.antiCorruptionOffice && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>廉政</div>
          {[
            { c: "#134e4a", s: 10, l: "中央 central (43)" },
            { c: "#5eead4", s: 6, l: "地方 local (23)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* 海巡分類 */}
      {visibility.coastGuardStation && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 3 }}>海巡</div>
          {[
            { c: "#0c4a6e", s: 11, l: "海洋分署 (17)" },
            { c: "#38bdf8", s: 6, l: "巡防隊 (252)" },
          ].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
              <span style={{ width: r.s, height: r.s, borderRadius: RADIUS.full, background: r.c, border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0 }} />
              <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{r.l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
