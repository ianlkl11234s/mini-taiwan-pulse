// 英國圖層 popup（2026-10-29 第 0b 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import {
  GB_ADMIN_FETCHED_AT, GB_ADMIN_LAD_COLOR, GB_LAD_ATTRIBUTION, GB_LAD_SOURCE_URL, GB_LAD_VERSION, GB_LICENSE,
  GB_SMALL_AREA_COLOR, gbSmallAreaType,
} from "../../data/gbAdminTypes";
import {
  GB_MARITIME_ATTRIBUTION, GB_MARITIME_FETCHED_AT, GB_MARITIME_LAYER_COLOR, GB_MARITIME_LICENSE, GB_MARITIME_SOURCE_DATE, GB_MARITIME_SOURCE_URL,
  gbMaritimeLimitColor, gbMaritimeLimitType, type GbMaritimeLimitKind,
} from "../../data/gbMaritimeLimitTypes";
import {
  GB_BUILT_UP_COLOR, GB_BUILT_UP_SOURCE_URL, GB_GREENSPACE_CATEGORIES, GB_GREENSPACE_SOURCE_URL, GB_OS_ATTRIBUTION, GB_OS_FETCHED_AT, GB_OS_LICENSE,
  gbGreenspaceFunction, type GbGreenspaceFunctionId, type GbGreenspaceKey,
} from "../../data/gbOpenSpaceTypes";
import {
  GB_BATHING_COLOR, GB_BATHING_NO_CLASS_STROKE, GB_BATHING_SOURCES, GB_COASTAL_EROSION_COLOR, GB_EROSION_RISKS, GB_EROSION_SOURCES, GB_FLOOD_DEFENCE_COLOR,
  GB_FLOOD_DEFENCE_DC_ATTRIBUTION, GB_FLOOD_DEFENCE_DC_URL, GB_FLOOD_DEFENCE_EA_ATTRIBUTION, GB_FLOOD_DEFENCE_EA_URL,
  GB_FLOOD_DEFENCE_NRW_ATTRIBUTION, GB_FLOOD_DEFENCE_NRW_URL, GB_HYDRO_COLOR, GB_HYDRO_EA_ATTRIBUTION, GB_HYDRO_EA_URL,
  GB_HYDRO_GRID_PRECISION, GB_HYDRO_KINDS, GB_HYDRO_SEPA_ATTRIBUTION, GB_HYDRO_SEPA_URL, GB_OGL_V3, GB_RIVERS_COLOR,
  GB_RIVERS_NI_ATTRIBUTION, GB_RIVERS_NI_URL, GB_RIVERS_OS_ATTRIBUTION, GB_RIVERS_OS_URL, GB_WATER_FETCHED_AT,
  gbBathingClass, gbErosionZoneDef, gbFloodDefenceClass, type GbBathingClass, type GbFloodDefenceClass, type GbHydroKind,
  type GbNation, type GbRiverForm,
} from "../../data/gbWaterTypes";
import {
  GB_BIKEPOINT_COLOR, GB_CHARGING_ZONE_COLOR, GB_HUB_FALLBACK_COLOR, GB_HUBS_ATTRIBUTION, GB_HUBS_NAPTAN_URL, GB_HUBS_TRANSLINK_URL,
  GB_JAMCAM_COLOR, GB_JAMCAM_OFFLINE_COLOR, GB_LONDON_RAIL_FALLBACK_COLOR, GB_LONDON_STATION_COLOR, GB_ORR_LICENSE_PDF_URL, GB_ORR_PERIOD,
  GB_TFL_BIKEPOINT_URL, GB_TFL_JAMCAM_URL, GB_TFL_LICENSE, GB_TFL_LINES_URL, GB_TFL_MAP_ATTRIBUTION,
  GB_TFL_OPEN_DATA_URL, GB_TRANSPORT_FETCHED_AT, GB_TRANSPORT_OGL_V3, gbChargingZone, gbHubType, gbLondonRailMode,
  gbLondonStationIsInterchange, type GbChargingZone, type GbHubType, type GbLondonRailMode,
  GB_AADF_COLOR, GB_AADF_YEAR, GB_DFT_ROAD_TRAFFIC_ATTRIBUTION, GB_DFT_ROAD_TRAFFIC_URL, GB_MAJOR_ROADS_COLOR, GB_ROADS_ODBL,
  GB_ROADS_OSM_ATTRIBUTION, GB_ROADS_OSM_URL, gbAadfBucketColor, gbRoadClass, type GbRoadCategory, type GbRoadClass,
} from "../../data/gbTransportTypes";
import {
  GB_ACCESS_TYPES, GB_AW_STATUS, GB_MPA_COLOR, GB_MPA_DRMPA_URL, GB_MPA_SOURCES, GB_MPA_TYPES, GB_NATIONAL_TRAIL_COLOR, GB_NATURE_FETCHED_AT,
  GB_NATURE_OGL_V3, GB_OPEN_ACCESS_COLOR, GB_OPEN_ACCESS_NRW_COMMON_URL, GB_OPEN_ACCESS_SOURCES, GB_PROTECTED_AREAS_COLOR,
  GB_PROTECTED_SOURCE_URLS, GB_PROTECTED_SOURCES, GB_RECREATION_CATEGORIES, GB_RECREATION_SOURCES, GB_RECREATION_UNCLASSIFIED_COLOR,
  GB_TPO_TREE_URL, GB_TRAIL_FLAG_STATUSES, GB_TRAIL_UNCLASSIFIED_COLOR, GB_TREE_CATEGORIES, GB_TREE_PROTECTION_COLOR, GB_TREE_SOURCES,
  GB_WOODLAND_COLOR, GB_WOODLAND_FC_ATTRIBUTION, GB_WOODLAND_FC_URL, GB_WOODLAND_NI_ATTRIBUTION, GB_WOODLAND_NI_COLOR, GB_WOODLAND_NI_KIND,
  GB_WOODLAND_NI_URL, gbDesignation, gbTrailCategory, gbTrailSource, gbWoodlandGroup, type GbAncientWoodlandStatus,
} from "../../data/gbNatureTypes";
import {
  GB_ACCESS_TYPE_KEYS, GB_DESIGNATION_KEYS, GB_MPA_TYPE_KEYS, GB_RECREATION_KEYS, GB_TRAIL_CATEGORY_KEYS, GB_TREE_CATEGORY_KEYS, GB_WOODLAND_GROUP_KEYS,
} from "../legend/gbNatureLegends";
import {
  GB_ENERGY_FETCHED_AT, GB_ENERGY_ODBL, GB_ENERGY_OGL_V3, GB_FIELD_TYPES, GB_FUEL_STATION_COLOR, GB_FUEL_TYPES, GB_NSTA_ATTRIBUTION, GB_NSTA_LICENSE,
  GB_NSTA_URL, GB_OIL_GAS_COLOR, GB_OSM_ATTRIBUTION, GB_OSM_URL, GB_POWER_LINES_COLOR, GB_POWER_PLANTS_ATTRIBUTION, GB_POWER_PLANTS_COLOR,
  GB_POWER_PLANTS_URL, GB_RENEWABLES_ATTRIBUTION, GB_RENEWABLES_COLOR, GB_RENEWABLES_URL, GB_SUBSTATIONS_COLOR, gbEnergyText, gbFieldYear,
  gbFuelGroup, gbTechGroup, gbVoltageClass, type GbFuelType, type GbStatusGroup,
} from "../../data/gbEnergyTypes";
import { GB_FIELD_TYPE_KEYS, GB_FUEL_GROUP_KEYS, GB_STATUS_GROUP_KEYS, GB_TECH_GROUP_KEYS, GB_VOLTAGE_KEYS } from "../legend/gbEnergyLegends";
import {
  GB_CARE_CI_ATTRIBUTION, GB_CARE_CI_URL, GB_CARE_CQC_ATTRIBUTION, GB_CARE_CQC_URL, GB_CARE_HOMES_COLOR, GB_CARE_OFFICE_ADDRESS_KINDS,
  GB_CARE_SERVICES_COLOR, GB_CIVIC_FETCHED_AT, GB_CIVIC_OGL_V3, GB_COURTS_ATTRIBUTION, GB_COURTS_COLOR, GB_COURTS_URL, GB_FIRE_COLOR,
  GB_FIRE_MHCLG_ATTRIBUTION, GB_FIRE_MHCLG_URL, GB_HEALTH_COLOR, GB_HEALTH_ODS_ATTRIBUTION, GB_HEALTH_ODS_URL, GB_HEALTH_PHS_ATTRIBUTION,
  GB_HEALTH_PHS_URL, GB_ONSPD_ATTRIBUTION, GB_SCHOOLS_ATTRIBUTION, GB_SCHOOLS_COLOR, GB_SCHOOLS_URL,
  gbCareKind, gbCivicText, gbCourtKind, gbHealthColor, gbHealthKind, gbIsPostcodeCentroid, gbSchoolCategory,
} from "../../data/gbCivicTypes";
import { GB_CARE_KIND_KEYS, GB_COURT_KIND_KEYS, GB_HEALTH_KIND_KEYS, GB_SCHOOL_CATEGORY_KEYS } from "../legend/gbCivicLegends";
import {
  GB_ARTS_COLOR, GB_CULTURAL_COLOR, GB_CULTURE_FETCHED_AT, GB_CULTURE_ODBL, GB_CULTURE_OGL_V3, GB_CULTURE_RESTRICTED_ACCESS,
  GB_LIBRARIES_NI_ATTRIBUTION, GB_LIBRARIES_NI_URL, GB_VISITOR_COLOR, gbArtsKind, gbCultureText, gbCulturalKind, gbVisitorKind,
} from "../../data/gbCultureTypes";
import { GB_ARTS_KIND_KEYS, GB_CULTURAL_KIND_KEYS, GB_VISITOR_KIND_KEYS } from "../legend/gbCultureLegends";
import { LIGHT_FEATURE, useFeatureTheme } from "./featureTheme";
import { LinkRow } from "./atlasPanels";
import {
  GB_SURPLUS_ATTRIBUTION, GB_SURPLUS_COLOR, GB_SURPLUS_FETCHED_AT, GB_SURPLUS_LICENSE, GB_SURPLUS_POSTCODE_PRECISION, GB_SURPLUS_SECTORS,
  GB_SURPLUS_SOURCE_DATE, GB_SURPLUS_SOURCE_URL, gbSurplusStatus, type GbSurplusSector, type GbSurplusStatus,
} from "../../data/gbLandTypes";
import {
  GB_BGS_OGL, GB_DESNZ_OGL_V3, GB_GAMMA_ATTRIBUTION, GB_GAMMA_COLOR, GB_GAMMA_UNIT, GB_GAMMA_URL, GB_GEOSURE_ATTRIBUTION, GB_GEOSURE_COLOR,
  GB_GEOSURE_URL, GB_HAZARD_FETCHED_AT, GB_LANDSLIDE_ATTRIBUTION, GB_LANDSLIDE_COLOR, GB_LANDSLIDE_URL, GB_QUAKE_ATTRIBUTION, GB_QUAKE_COLOR,
  GB_QUAKE_DATA_END, GB_QUAKE_URL, GB_RADON_ATTRIBUTION, GB_RADON_COLOR, GB_RADON_URL, gbGammaColor, gbGeoHazard, gbRadonClass, gbSusceptibility,
} from "../../data/gbHazardTypes";
import { GB_GEO_HAZARD_KEYS, GB_SUSCEPTIBILITY_KEYS } from "../legend/gbHazardLegends";
import {
  GB_BROWNFIELD_ATTRIBUTION, GB_BROWNFIELD_COLOR, GB_BROWNFIELD_OWNERSHIP, GB_BROWNFIELD_URL, GB_ENV_FETCHED_AT, GB_ENV_ODBL, GB_ENV_OGL_V3,
  GB_NOISE_COLOR, GB_NOISE_SOURCES, GB_PLANNING_COLOR, GB_PLANNING_SOURCE_URLS, GB_PLANNING_SOURCES, GB_POLLUTION_ATTRIBUTION,
  GB_POLLUTION_COLOR, GB_POLLUTION_LICENSE, GB_POLLUTION_URL, GB_RECYCLING_ATTRIBUTION, GB_RECYCLING_COLOR, GB_RECYCLING_URL,
  GB_WASTE_ISSUED_PLACEHOLDER, GB_WASTE_PERMITS_COLOR, gbBrownfieldStatus, gbNoiseBand, gbPlanningConstraint, gbRecyclingKind,
  gbWasteAuthority, type GbBrownfieldOwnership,
} from "../../data/gbEnvPlanningTypes";
import { GB_BROWNFIELD_STATUS_KEYS, GB_PLANNING_CONSTRAINT_KEYS, GB_RECYCLING_KIND_KEYS } from "../legend/gbEnvPlanningLegends";
import {
  GB_AQUACULTURE_ATTRIBUTION, GB_AQUACULTURE_COLOR, GB_AQUACULTURE_SOURCES, GB_COMPANIES_AGENT_SHARE, GB_COMPANIES_ATTRIBUTION,
  GB_COMPANIES_COLOR, GB_COMPANIES_LICENSE, GB_COMPANIES_URL, GB_FUNERAL_ATTRIBUTION, GB_FUNERAL_COLOR, GB_FUNERAL_URL,
  GB_MANUFACTURING_COLOR, GB_SOIL_ATTRIBUTION, GB_SOIL_COLOR, GB_SOIL_URL, GB_W12_FETCHED_AT, GB_W12_ODBL, GB_W12_OGL_V3,
  gbAquacultureKind, gbAquacultureStatus, gbFuneralKind, gbSoilDepthColors, gbSoilDepthIndex, gbSplitList, gbTopSicSections,
} from "../../data/gbBusinessAgriTypes";
import { GB_AQUACULTURE_KIND_KEYS, GB_AQUACULTURE_STATUS_KEYS, GB_FUNERAL_KIND_KEYS, GB_SIC_SECTION_KEYS, GB_SOIL_DEPTH_KEYS } from "../legend/gbBusinessAgriLegends";
import type { MessageKey } from "../../i18n/keys";

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const NATION_KEYS = {
  England: "popup.baseMap.gbNationEngland",
  Scotland: "popup.baseMap.gbNationScotland",
  Wales: "popup.baseMap.gbNationWales",
  "Northern Ireland": "popup.baseMap.gbNationNorthernIreland",
} as const;

const AREA_TYPE_KEYS = {
  LSOA21: "popup.baseMap.gbAreaTypeLSOA21",
  DZ22: "popup.baseMap.gbAreaTypeDZ22",
  DZ21: "popup.baseMap.gbAreaTypeDZ21",
  SDZ21: "popup.baseMap.gbAreaTypeSDZ21",
} as const;

function useNationLabel() {
  const { t } = useLocale();
  return (value: unknown) => {
    const nation = text(value);
    return nation in NATION_KEYS ? t(NATION_KEYS[nation as keyof typeof NATION_KEYS]) : nation;
  };
}

/** 英國地方政府區 LAD（ONS May 2026，361 區）：名稱（威爾斯並列威爾斯語）、GSS 代碼、所屬地區。 */
export function GbAdminBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const name = text(props.lad_name);
  const nameCy = text(props.lad_name_cy);
  return <>
    <Title color={GB_ADMIN_LAD_COLOR}>{name || t("popup.baseMap.gbLad")}</Title>
    {nameCy && nameCy !== name ? <Row label={t("popup.baseMap.gbNameWelsh")} value={nameCy} /> : null}
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.lad_code)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbDataVersion")} value={GB_LAD_VERSION} />
    <SourceFooter props={{ source_org: GB_LAD_ATTRIBUTION, source_url: GB_LAD_SOURCE_URL, license: GB_LICENSE, fetched_at: GB_ADMIN_FETCHED_AT }} />
  </>;
}

/** 英國統計小區（LSOA21／DZ22／DZ21／SDZ21）：名稱、代碼、類型、所屬 LAD、所屬地區。 */
export function GbSmallAreaBoundariesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const type = gbSmallAreaType(props.area_type);
  const name = text(props.name);
  const nameCy = text(props.name_cy);
  const lad = [text(props.lad_name), text(props.lad_code)].filter(Boolean);
  return <>
    <Title color={GB_SMALL_AREA_COLOR}>{name || text(props.code) || t("popup.baseMap.gbSmallArea")}</Title>
    {nameCy && nameCy !== name ? <Row label={t("popup.baseMap.gbNameWelsh")} value={nameCy} /> : null}
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.code)} />
    <Row label={t("popup.baseMap.gbAreaType")} value={type ? t(AREA_TYPE_KEYS[type.value]) : text(props.area_type)} />
    <Row label={t("popup.baseMap.gbLad")} value={lad.join(" · ")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.baseMap.gbSmallAreaNote")} />
    {type ? <SourceFooter props={{ source_org: type.attribution, source_url: type.sourceUrl, license: GB_LICENSE, fetched_at: GB_ADMIN_FETCHED_AT }} /> : null}
  </>;
}

/** 切片 `neighbour` 實際出現的 9 個值（tilestats）；其他值原樣顯示。 */
const GB_NEIGHBOUR_KEYS: Partial<Record<string, MessageKey>> = {
  Belgium: "popup.baseMap.gbNeighbourBelgium", Denmark: "popup.baseMap.gbNeighbourDenmark", "Faroe Islands": "popup.baseMap.gbNeighbourFaroeIslands",
  France: "popup.baseMap.gbNeighbourFrance", Germany: "popup.baseMap.gbNeighbourGermany", Ireland: "popup.baseMap.gbNeighbourIreland",
  "Isle of Man": "popup.baseMap.gbNeighbourIsleofMan", Netherlands: "popup.baseMap.gbNeighbourNetherlands", Norway: "popup.baseMap.gbNeighbourNorway",
};

const GB_GREENSPACE_POPUP_FN_KEYS: Record<GbGreenspaceFunctionId, MessageKey> = {
  Park: "popup.baseMap.gbFnPark", Play: "popup.baseMap.gbFnPlay", Allotment: "popup.baseMap.gbFnAllotment",
  PlayingField: "popup.baseMap.gbFnPlayingField", OtherSports: "popup.baseMap.gbFnOtherSports", Tennis: "popup.baseMap.gbFnTennis",
  Bowling: "popup.baseMap.gbFnBowling", Golf: "popup.baseMap.gbFnGolf", Cemetery: "popup.baseMap.gbFnCemetery", Religious: "popup.baseMap.gbFnReligious",
};

const GB_MARITIME_POPUP_KEYS: Record<GbMaritimeLimitKind, MessageKey> = {
  baseline: "popup.baseMap.gbMaritimeBaseline",
  closing_line: "popup.baseMap.gbMaritimeClosingLine",
  six_nm: "popup.baseMap.gbMaritimeSixNm",
  territorial_sea: "popup.baseMap.gbMaritimeTerritorialSea",
  eez: "popup.baseMap.gbMaritimeEez",
  continental_shelf: "popup.baseMap.gbMaritimeContinentalShelf",
  boundary: "popup.baseMap.gbMaritimeBoundary",
  median_line: "popup.baseMap.gbMaritimeMedianLine",
  national_limit: "popup.baseMap.gbMaritimeNationalLimit",
};

/** 英國海域界線（UKHO）：界線類型、所屬、分界對象、資料日期、不可用於航行。 */
export function GbMaritimeLimitsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const type = gbMaritimeLimitType(props.limit_type);
  const state = text(props.state);
  const neighbour = text(props.neighbour);
  return <>
    <Title color={type ? gbMaritimeLimitColor(type, true) : GB_MARITIME_LAYER_COLOR}>{type ? t(GB_MARITIME_POPUP_KEYS[type.value]) : text(props.feature) || t("popup.baseMap.gbMaritimeLimit")}</Title>
    <Row label={t("popup.baseMap.gbMaritimeState")} value={state === "United Kingdom" ? t("popup.baseMap.gbUnitedKingdom") : nation(state)} />
    {neighbour ? <Row label={t("popup.baseMap.gbMaritimeNeighbour")} value={GB_NEIGHBOUR_KEYS[neighbour] ? t(GB_NEIGHBOUR_KEYS[neighbour]!) : neighbour} /> : null}
    <Row label={t("popup.baseMap.gbDataVersion")} value={`UKHO ${GB_MARITIME_SOURCE_DATE}`} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.baseMap.gbMaritimeIllustrative")} />
    <SourceFooter props={{ source_org: GB_MARITIME_ATTRIBUTION, source_url: GB_MARITIME_SOURCE_URL, license: GB_MARITIME_LICENSE, fetched_at: GB_MARITIME_FETCHED_AT }} />
  </>;
}

/** 英國建成區（OS Open Built Up Areas）：名稱（威爾斯語／蓋爾語並列英文）、面積、所屬 LAD、地區、GSS。 */
export function GbBuiltUpAreasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  const area = Number(props.area_ha);
  const lad = [text(props.lad_name), text(props.lad_code)].filter(Boolean);
  return <>
    <Title color={GB_BUILT_UP_COLOR}>{name || t("popup.baseMap.gbBuiltUp")}</Title>
    {nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameEnglish")} value={nameAlt} /> : null}
    {props.area_ha != null && Number.isFinite(area) ? <Row label={t("popup.baseMap.gbBuiltUpArea")} value={t("popup.baseMap.gbHectares", { value: area.toLocaleString(undefined, { maximumFractionDigits: 1 }) })} /> : null}
    <Row label={t("popup.baseMap.gbLad")} value={lad.join(" · ")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbGssCode")} value={text(props.gss_code)} />
    <SourceFooter props={{ source_org: GB_OS_ATTRIBUTION, source_url: GB_BUILT_UP_SOURCE_URL, license: GB_OS_LICENSE, fetched_at: GB_OS_FETCHED_AT }} />
  </>;
}

/** 英國綠地三層共用（OS Open Greenspace）：名稱（無名顯示類型）、類型、地區、LAD 代碼。 */
function GbGreenspacePanelBase({ props, layerKey }: { props: Record<string, unknown>; layerKey: GbGreenspaceKey }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const fn = gbGreenspaceFunction(props.function);
  const typeLabel = fn ? t(GB_GREENSPACE_POPUP_FN_KEYS[fn.id]) : text(props.function);
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  return <>
    <Title color={fn?.color ?? GB_GREENSPACE_CATEGORIES[layerKey].layerColor}>{name || typeLabel}</Title>
    {nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameAlt")} value={nameAlt} /> : null}
    <Row label={t("popup.baseMap.gbGreenspaceType")} value={typeLabel} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbLadCode")} value={text(props.lad_code)} />
    <SourceFooter props={{ source_org: GB_OS_ATTRIBUTION, source_url: GB_GREENSPACE_SOURCE_URL, license: GB_OS_LICENSE, fetched_at: GB_OS_FETCHED_AT }} />
  </>;
}

export const GbGreenspacePanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbGreenspace" />;
export const GbSportsFacilitiesPanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbSportsFacilities" />;
export const GbCemeteriesPanel = ({ props }: { props: Record<string, unknown> }) => <GbGreenspacePanelBase props={props} layerKey="gbCemeteries" />;

// ─────────────────────────── 英國第 3 波：水資源／海岸 ───────────────────────────

const GB_RIVER_FORM_KEYS: Record<GbRiverForm, MessageKey> = {
  inlandRiver: "popup.water.gbRiverFormInland", tidalRiver: "popup.water.gbRiverFormTidal",
  lake: "popup.water.gbRiverFormLake", canal: "popup.water.gbRiverFormCanal",
};

/** 英國河川：GB 河名（並列威爾斯語／蓋爾語）、類型；北愛無河名，顯示 Strahler 級數。 */
export function GbRiversPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ni = props.source === "daera_strahler";
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  const form = text(props.form) as GbRiverForm;
  const lad = text(props.lad_code);
  return <>
    <Title color={GB_RIVERS_COLOR}>{ni ? t("popup.water.gbRiverNoName") : name || t("popup.water.gbRiverUnnamed")}</Title>
    {!ni && nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameAlt")} value={nameAlt} /> : null}
    {!ni && form in GB_RIVER_FORM_KEYS ? <Row label={t("popup.water.gbRiverForm")} value={t(GB_RIVER_FORM_KEYS[form])} /> : null}
    {ni && props.strahler != null ? <Row label={t("popup.water.gbRiverStrahler")} value={text(props.strahler)} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {lad ? <Row label={t("popup.baseMap.gbLadCode")} value={lad} /> : null}
    <SourceFooter props={ni
      ? { source_org: GB_RIVERS_NI_ATTRIBUTION, source_url: GB_RIVERS_NI_URL, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }
      : { source_org: GB_RIVERS_OS_ATTRIBUTION, source_url: GB_RIVERS_OS_URL, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }} />
  </>;
}

const GB_HYDRO_KIND_KEYS: Record<GbHydroKind, MessageKey> = {
  level: "popup.water.gbHydroLevel", rainfall: "popup.water.gbHydroRainfall", flow: "popup.water.gbHydroFlow", other: "popup.water.gbHydroOther",
};

/** 英國水文測站：站名、類型、河名／集水區、觀測參數、機關、狀態（null 不顯示）、位置精度。 */
export function GbHydroStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const kind = GB_HYDRO_KINDS.find((k) => k.value === props.kind);
  const sepa = props.agency === "SEPA";
  const river = [text(props.river), text(props.catchment)].filter(Boolean);
  return <>
    <Title color={kind?.color ?? GB_HYDRO_COLOR}>{text(props.name) || text(props.station_id) || t("popup.water.gbHydroStation")}</Title>
    <Row label={t("popup.water.gbHydroKind")} value={kind ? t(GB_HYDRO_KIND_KEYS[kind.value]) : t("popup.water.gbHydroUntagged")} />
    <Row label={t("popup.water.gbHydroRiver")} value={[...new Set(river)].join(" · ")} />
    <Row label={t("popup.water.gbHydroParameters")} value={text(props.parameters)} />
    <Row label={t("popup.water.gbAgency")} value={text(props.agency)} />
    <Row label={t("popup.water.gbHydroStatus")} value={text(props.status)} />
    <Row label={t("popup.water.gbHydroStationId")} value={text(props.station_id)} mono />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {props.precision === GB_HYDRO_GRID_PRECISION ? <Row label={t("popup.water.gbPrecision")} value={t("popup.water.gbHydroGridPrecision")} /> : null}
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.water.gbHydroNoReadings")} />
    <SourceFooter props={sepa
      ? { source_org: GB_HYDRO_SEPA_ATTRIBUTION, source_url: GB_HYDRO_SEPA_URL, license: "Open Government Licence", fetched_at: GB_WATER_FETCHED_AT }
      : { source_org: GB_HYDRO_EA_ATTRIBUTION, source_url: GB_HYDRO_EA_URL, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }} />
  </>;
}

const GB_FLOOD_CLASS_KEYS: Record<GbFloodDefenceClass, MessageKey> = {
  embankment: "popup.water.gbFloodEmbankment", wall: "popup.water.gbFloodWall", gate: "popup.water.gbFloodGate",
  coastal: "popup.water.gbFloodCoastal", natural: "popup.water.gbFloodNatural", other: "popup.water.gbFloodOther",
};
const GB_FLOOD_PROTECTION_KEYS: Partial<Record<string, MessageKey>> = {
  Fluvial: "popup.water.gbProtectionFluvial", Tidal: "popup.water.gbProtectionTidal", "Fluvial/Tidal": "popup.water.gbProtectionFluvialTidal",
  fluvial_tidal: "popup.water.gbProtectionFluvialTidal", Coastal: "popup.water.gbProtectionCoastal", Pluvial: "popup.water.gbProtectionPluvial",
  "Surface Water": "popup.water.gbProtectionSurfaceWater",
};

/** 英國防洪設施：類型（原文並列）、防護對象、狀況（null＝未評）、維護者類別、河名、機關；蘇格蘭加註不可用於單一房產評估。 */
export function GbFloodDefenceAssetsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const cls = gbFloodDefenceClass(props);
  const rawType = text(props.defence_type);
  const protection = text(props.protection);
  const condition = Number(props.condition);
  const dc = props.agency === "Dynamic Coast";
  const footer = dc
    ? { source_org: GB_FLOOD_DEFENCE_DC_ATTRIBUTION, source_url: GB_FLOOD_DEFENCE_DC_URL }
    : props.agency === "NRW"
      ? { source_org: GB_FLOOD_DEFENCE_NRW_ATTRIBUTION, source_url: GB_FLOOD_DEFENCE_NRW_URL }
      : { source_org: GB_FLOOD_DEFENCE_EA_ATTRIBUTION, source_url: GB_FLOOD_DEFENCE_EA_URL };
  return <>
    <Title color={cls?.color ?? GB_FLOOD_DEFENCE_COLOR}>{text(props.name) || (cls ? t(GB_FLOOD_CLASS_KEYS[cls.value]) : rawType) || t("popup.water.gbFloodDefence")}</Title>
    <Row label={t("popup.water.gbFloodType")} value={[cls ? t(GB_FLOOD_CLASS_KEYS[cls.value]) : "", rawType].filter(Boolean).join(" · ")} />
    <Row label={t("popup.water.gbFloodProtection")} value={GB_FLOOD_PROTECTION_KEYS[protection] ? t(GB_FLOOD_PROTECTION_KEYS[protection]!) : protection} />
    <Row label={t("popup.water.gbFloodCondition")} value={props.condition != null && Number.isFinite(condition) ? t("popup.water.gbFloodConditionValue", { value: condition }) : t("popup.water.gbFloodConditionNone")} />
    <Row label={t("popup.water.gbFloodPurpose")} value={text(props.purpose)} />
    <Row label={t("popup.water.gbFloodMaintainer")} value={text(props.maintainer_type)} />
    <Row label={t("popup.water.gbRiverName")} value={text(props.river)} />
    <Row label={t("popup.water.gbAgency")} value={text(props.agency)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {dc ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.water.gbDynamicCoastNote")} /> : null}
    <SourceFooter props={{ ...footer, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }} />
  </>;
}

const GB_SMP_POLICY_KEYS: Partial<Record<string, MessageKey>> = {
  "Hold The Line": "popup.water.gbSmpHoldTheLine", "No Active Intervention": "popup.water.gbSmpNai", "Managed Realignment": "popup.water.gbSmpMr",
};
/** 上游 `scenario` 欄是中文說明字串；popup 依地區改用 i18n 文案，不直接印。 */
const GB_EROSION_SCENARIO_KEYS: Partial<Record<GbNation, MessageKey>> = {
  England: "popup.water.gbErosionScenarioEngland", Wales: "popup.water.gbErosionScenarioWales", Scotland: "popup.water.gbErosionScenarioScotland",
};
const GB_RISK_KEYS: Record<string, MessageKey> = { High: "popup.water.gbRiskHigh", Moderate: "popup.water.gbRiskModerate", Low: "popup.water.gbRiskLow" };

/** 英國海岸侵蝕：四地方法不同，各自顯示自己有的欄位；蘇格蘭必顯示不可用於單一房產評估；北愛為非投影的風險等級。 */
export function GbCoastalErosionRiskPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const nationKey = text(props.nation) as GbNation;
  const src = GB_EROSION_SOURCES[nationKey];
  const ni = props.kind === "risk_appraisal";
  const zone = gbErosionZoneDef(props);
  const risk = GB_EROSION_RISKS.find((r) => r.value === props.risk);
  const erosionM = Number(props.erosion_m);
  const policy = text(props.smp_policy);
  const period = zone ? t(zone.period === "short" ? "popup.water.gbErosionShort" : "popup.water.gbErosionLong", { year: zone.year }) : text(props.horizon_year);
  return <>
    <Title color={ni ? risk?.color ?? GB_COASTAL_EROSION_COLOR : zone?.color ?? GB_COASTAL_EROSION_COLOR}>
      {ni ? t("popup.water.gbErosionRiskTitle") : t("popup.water.gbErosionZoneTitle")}
    </Title>
    {ni ? <>
      <Row label={t("popup.water.gbErosionRisk")} value={GB_RISK_KEYS[text(props.risk)] ? t(GB_RISK_KEYS[text(props.risk)]!) : text(props.risk)} />
      <Row label={t("popup.baseMap.gbNotes")} value={t("popup.water.gbErosionNiNote")} />
    </> : <>
      <Row label={t("popup.water.gbErosionPeriod")} value={period} />
      {nationKey === "England" && props.erosion_m != null && Number.isFinite(erosionM) ? <Row label={t("popup.water.gbErosionDistance")} value={t("popup.water.gbMeters", { value: erosionM.toLocaleString(undefined, { maximumFractionDigits: 1 }) })} /> : null}
      {nationKey === "Wales" ? <Row label={t("popup.water.gbErosionRange")} value={text(props.erosion_range)} /> : null}
      {nationKey !== "Scotland" ? <Row label={t("popup.water.gbSmpPolicy")} value={GB_SMP_POLICY_KEYS[policy] ? t("popup.water.gbWithOriginal", { label: t(GB_SMP_POLICY_KEYS[policy]!), original: policy }) : policy} /> : null}
      {nationKey === "England" ? <Row label={t("popup.water.gbErosionDefence")} value={text(props.defence_type)} /> : null}
      {nationKey !== "Scotland" ? <Row label={t("popup.water.gbSmpName")} value={text(props.smp_name)} /> : null}
      <Row label={t("popup.water.gbErosionScenario")} value={t(GB_EROSION_SCENARIO_KEYS[nationKey] ?? "popup.water.gbErosionScenarioEngland")} />
    </>}
    <Row label={t("popup.water.gbAgency")} value={text(props.agency)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {props.agency === "Dynamic Coast" ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.water.gbDynamicCoastNote")} /> : null}
    {!ni ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.water.gbErosionNotComparable")} /> : null}
    {src ? <SourceFooter props={{ source_org: src.attribution, source_url: src.url, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }} /> : null}
  </>;
}

const GB_BATHING_CLASS_KEYS: Record<GbBathingClass, MessageKey> = {
  Excellent: "popup.water.gbBathingExcellent", Good: "popup.water.gbBathingGood", Sufficient: "popup.water.gbBathingSufficient",
  Poor: "popup.water.gbBathingPoor", unassessed: "popup.water.gbBathingUnassessed",
};
const GB_WATER_TYPE_KEYS: Partial<Record<string, MessageKey>> = {
  Coastal: "popup.water.gbWaterCoastal", Lake: "popup.water.gbWaterLake", River: "popup.water.gbWaterRiver", Transitional: "popup.water.gbWaterTransitional",
};

/** 英國浴場：名稱（威語並列）、水質分級（北愛 null＝無分級資料；年度有值才顯示）、類型、指定年份、風險註記、機關。 */
export function GbBathingWatersPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const cls = gbBathingClass(props.classification);
  const name = text(props.name);
  const nameAlt = text(props.name_alt);
  const year = text(props.class_year);
  const waterType = text(props.water_type);
  const src = GB_BATHING_SOURCES[text(props.agency)];
  const classLabel = props.classification == null
    ? t("popup.water.gbBathingNoClass")
    : cls ? t(GB_BATHING_CLASS_KEYS[cls.value]) : text(props.classification);
  return <>
    <Title color={cls?.color ?? (props.classification == null ? GB_BATHING_NO_CLASS_STROKE : GB_BATHING_COLOR)}>{name || t("popup.water.gbBathingWater")}</Title>
    {nameAlt && nameAlt !== name ? <Row label={t("popup.baseMap.gbNameWelsh")} value={nameAlt} /> : null}
    <Row label={t("popup.water.gbBathingClass")} value={year && props.classification != null ? t("popup.water.gbWithOriginal", { label: classLabel, original: year }) : classLabel} />
    <Row label={t("popup.water.gbBathingWaterType")} value={GB_WATER_TYPE_KEYS[waterType] ? t(GB_WATER_TYPE_KEYS[waterType]!) : waterType} />
    <Row label={t("popup.water.gbBathingDesignated")} value={text(props.year_designated)} />
    <Row label={t("popup.water.gbBathingStatusNote")} value={text(props.status_note)} />
    <Row label={t("popup.water.gbAgency")} value={text(props.agency)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {props.precision === "polygon_centroid" ? <Row label={t("popup.water.gbPrecision")} value={t("popup.water.gbBathingCentroid")} /> : null}
    {src ? <SourceFooter props={{ source_org: src.attribution, source_url: text(props.url) || src.url, license: GB_OGL_V3, fetched_at: GB_WATER_FETCHED_AT }} /> : null}
  </>;
}

// ─────────────────────────── 英國第 4 波：交通 ───────────────────────────

const num = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const GB_HUB_TYPE_KEYS: Record<GbHubType, MessageKey> = {
  rail: "popup.transport.gbHubRail", airport: "popup.transport.gbHubAirport", ferry: "popup.transport.gbHubFerry",
  bus_station: "popup.transport.gbHubBusStation", interchange: "popup.transport.gbHubInterchange",
};

/** TfL 四層共用 footer：三句署名（逐字）＋條款頁；另列「倫敦限定」涵蓋。 */
function TflFooter({ url }: { url: string }) {
  const { t } = useLocale();
  return <>
    <Row label={t("popup.transport.gbCoverage")} value={t("popup.transport.gbLondonOnly")} />
    <SourceFooter props={{ source_org: GB_TFL_MAP_ATTRIBUTION, source_url: url, license: GB_TFL_LICENSE, fetched_at: GB_TRANSPORT_FETCHED_AT }} />
  </>;
}

/** 英國交通樞紐（NaPTAN＋Translink）；鐵路站附 ORR 2024-25 客流。null 顯示「無 ORR 統計」，北愛顯示「ORR 未涵蓋」，不顯示 0。 */
export function GbTransportHubsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const nation = useNationLabel();
  const type = gbHubType(props.hub_type);
  const isRail = props.hub_type === "rail";
  const isNi = props.nation === "Northern Ireland";
  const entries = num(props.entries_exits);
  const rank = num(props.usage_rank);
  const interchanges = num(props.interchanges);
  const usage = isNi ? t("popup.transport.gbUsageNiNotCovered")
    : entries == null ? t("popup.transport.gbUsageNoOrr")
      : t("popup.transport.gbEntriesExitsValue", { n: i18n.formatNumber(entries), period: GB_ORR_PERIOD });
  const ferryClass = props.ferry_class === "terminal" ? t("popup.transport.gbFerryTerminal")
    : props.ferry_class === "landing" ? t("popup.transport.gbFerryLanding") : "";
  return <>
    <Title color={type?.color ?? GB_HUB_FALLBACK_COLOR}>{text(props.name) || t("popup.transport.gbHub")}</Title>
    <Row label={t("popup.transport.gbHubType")} value={type ? t(GB_HUB_TYPE_KEYS[type.value]) : text(props.hub_type)} />
    {ferryClass ? <Row label={t("popup.transport.gbFerryClass")} value={ferryClass} /> : null}
    <Row label={t("popup.transport.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.transport.gbLad")} value={text(props.lad_name)} />
    {isRail ? <>
      <Row label={t("popup.transport.gbCrs")} value={text(props.crs)} mono />
      <Row label={t("popup.transport.gbEntriesExits")} value={usage} />
      {entries != null && rank != null ? <Row label={t("popup.transport.gbUsageRank")} value={t("popup.transport.gbUsageRankValue", { n: i18n.formatNumber(rank) })} /> : null}
      {entries != null && interchanges != null ? <Row label={t("popup.transport.gbInterchanges")} value={i18n.formatNumber(interchanges)} /> : null}
      <Row label={t("popup.transport.gbMainOd")} value={text(props.main_od_station)} />
      <Row label={t("popup.transport.gbFacilityOwner")} value={text(props.facility_owner)} />
      <Row label={t("popup.transport.gbUsageNote")} value={text(props.usage_note)} />
      {!isNi ? <>
        <Row label={t("popup.transport.gbOrrLicense")} value={t("popup.transport.gbOrrLicenseNote")} />
        <LinkRow label={t("popup.transport.gbOrrLicensePdf")} url={GB_ORR_LICENSE_PDF_URL} />
      </> : null}
    </> : null}
    <SourceFooter props={{ source_org: GB_HUBS_ATTRIBUTION, source_url: props.source === "translink" ? GB_HUBS_TRANSLINK_URL : GB_HUBS_NAPTAN_URL, license: GB_TRANSPORT_OGL_V3, fetched_at: GB_TRANSPORT_FETCHED_AT }} />
  </>;
}

/** 車站年進出人次：與樞紐同一份資料、同一個 popup。 */
export const GbStationUsagePanel = GbTransportHubsPanel;

const GB_RAIL_MODE_KEYS: Record<GbLondonRailMode, MessageKey> = {
  tube: "popup.transport.gbModeTube", overground: "popup.transport.gbModeOverground", "elizabeth-line": "popup.transport.gbModeElizabeth",
  dlr: "popup.transport.gbModeDlr", tram: "popup.transport.gbModeTram",
};

/** 倫敦軌道路線（TfL）：線名、運具。線色依運具，非官方線色。 */
export function GbLondonRailLinesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const mode = gbLondonRailMode(props.mode);
  return <>
    <Title color={mode?.color ?? GB_LONDON_RAIL_FALLBACK_COLOR}>{text(props.line_name) || t("popup.transport.gbRailMode")}</Title>
    <Row label={t("popup.transport.gbRailMode")} value={mode ? t(GB_RAIL_MODE_KEYS[mode.value]) : text(props.mode)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.transport.gbRailColorNote")} />
    <TflFooter url={GB_TFL_LINES_URL} />
  </>;
}

/** 倫敦軌道車站（TfL）：站名、經過路線、票價區、轉乘站。 */
export function GbLondonStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return <>
    <Title color={GB_LONDON_STATION_COLOR}>{text(props.name) || t("popup.transport.gbStation")}</Title>
    <Row label={t("popup.transport.gbStationLines")} value={text(props.line_names)} />
    <Row label={t("popup.transport.gbFareZone")} value={text(props.zone)} />
    {gbLondonStationIsInterchange(props) ? <Row label={t("popup.transport.gbInterchangeStation")} value={t("popup.transport.gbYes")} /> : null}
    <TflFooter url={GB_TFL_LINES_URL} />
  </>;
}

/** 倫敦 Santander Cycles 站（TfL BikePoint）：樁數、啟用日、臨時站；不含即時空位。 */
export function GbLondonBikePointsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const docks = num(props.docks);
  return <>
    <Title color={GB_BIKEPOINT_COLOR}>{text(props.name) || t("legend.transport.gbBikePoint")}</Title>
    <Row label={t("popup.transport.gbDocks")} value={docks == null ? "" : i18n.formatNumber(docks)} />
    <Row label={t("popup.transport.gbInstallDate")} value={text(props.install_date)} />
    {props.temporary === true ? <Row label={t("popup.transport.gbTemporary")} value={t("popup.transport.gbYes")} /> : null}
    <Row label={t("popup.transport.gbLiveAvailability")} value={t("popup.transport.gbNotYetProvided")} />
    <TflFooter url={GB_TFL_BIKEPOINT_URL} />
  </>;
}

/** 倫敦道路攝影機（TfL JamCams）：路口、朝向、取得時狀態（非即時）、外連影像（不嵌入、不代理）。 */
export function GbLondonJamCamsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const offline = props.available_at_fetch === false;
  return <>
    <Title color={offline ? GB_JAMCAM_OFFLINE_COLOR : GB_JAMCAM_COLOR}>{text(props.name) || t("legend.transport.gbJamCam")}</Title>
    <Row label={t("popup.transport.gbCameraView")} value={text(props.view)} />
    <Row label={t("popup.transport.gbCameraStatus")} value={t(offline ? "popup.transport.gbCameraOfflineAtFetch" : "popup.transport.gbCameraOnlineAtFetch", { date: GB_TRANSPORT_FETCHED_AT })} />
    <LinkRow label={t("popup.transport.gbCameraImage")} url={text(props.image_url)} />
    <LinkRow label={t("popup.transport.gbCameraVideo")} url={text(props.video_url)} />
    <TflFooter url={GB_TFL_JAMCAM_URL} />
  </>;
}

const GB_ZONE_KEYS: Record<GbChargingZone, MessageKey> = {
  congestion_charge: "popup.transport.gbZoneCongestion", ulez_lez: "popup.transport.gbZoneUlezLez",
};

/** 倫敦收費區（TfL）：區名（i18n，不用來源混語 name）、面積、邊界版本。 */
export function GbLondonChargingZonesPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const zone = gbChargingZone(props.zone);
  const area = num(props.area_km2);
  return <>
    <Title color={zone?.color ?? GB_CHARGING_ZONE_COLOR}>{zone ? t(GB_ZONE_KEYS[zone.value]) : text(props.zone)}</Title>
    <Row label={t("popup.transport.gbZoneArea")} value={area == null ? "" : t("popup.transport.gbZoneAreaValue", { n: i18n.formatNumber(area, { maximumFractionDigits: 2 }) })} />
    {/* 來源字串可能帶中文括號註記（ULEZ「內容＝LEZ 邊界」），只顯示版本代碼；同一邊界已在區名與圖例說明 */}
    <Row label={t("popup.transport.gbBoundaryVersion")} value={text(props.boundary_version).split("（")[0]!.trim()} mono />
    <Row label="" value={t("popup.transport.gbZoneTfLNote")} />
    <TflFooter url={GB_TFL_OPEN_DATA_URL} />
  </>;
}

// ─────────────────────────── 英國第 10 波：主要路網、AADF 交通計數點 ───────────────────────────

const GB_ROAD_CLASS_KEYS: Record<GbRoadClass, MessageKey> = {
  motorway: "popup.transport.gbRoadClassMotorway", a_road: "popup.transport.gbRoadClassA", b_road: "popup.transport.gbRoadClassB",
};
const GB_ROAD_CATEGORY_KEYS: Record<GbRoadCategory, MessageKey> = {
  TM: "popup.transport.gbRoadCatTM", PM: "popup.transport.gbRoadCatPM", TA: "popup.transport.gbRoadCatTA",
  PA: "popup.transport.gbRoadCatPA", MB: "popup.transport.gbRoadCatMB", MCU: "popup.transport.gbRoadCatMCU",
};
function useRoadCategoryLabel() {
  const { t } = useLocale();
  return (value: unknown) => {
    const code = text(value);
    return code in GB_ROAD_CATEGORY_KEYS ? `${t(GB_ROAD_CATEGORY_KEYS[code as GbRoadCategory])} (${code})` : code;
  };
}

/** 英國主要路網：編號、名稱、等級、DfT 類別、2025 AADF（估算要標；null＝無計數）、速限／車道（OSM）、長度、地區、來源。 */
export function GbMajorRoadsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const nation = useNationLabel();
  const category = useRoadCategoryLabel();
  const cls = gbRoadClass(props.road_class);
  const isOsm = props.source === "osm";
  const aadf = num(props.aadf_all_motor_vehicles);
  const aadfText = aadf == null
    ? t(props.nation === "Northern Ireland" ? "popup.transport.gbAadfNoCountNi" : "popup.transport.gbAadfNoCount")
    : t(props.aadf_estimation_method === "Counted" ? "popup.transport.gbAadfCountedValue" : "popup.transport.gbAadfEstimatedValue", { n: i18n.formatNumber(aadf) });
  const length = num(props.length_km);
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={cls?.color ?? GB_MAJOR_ROADS_COLOR}>{[text(props.ref), text(props.name)].filter(Boolean).join(" ") || (cls ? t(GB_ROAD_CLASS_KEYS[cls.value]) : t("popup.transport.gbRoadClass"))}</Title>
    <Row label={t("popup.transport.gbRoadRef")} value={text(props.ref)} mono />
    <Row label={t("popup.transport.gbRoadName")} value={text(props.name)} />
    <Row label={t("popup.transport.gbRoadClass")} value={cls ? t(GB_ROAD_CLASS_KEYS[cls.value]) : text(props.road_class)} />
    <Row label={t("popup.transport.gbRoadCategory")} value={category(props.road_category)} />
    <Row label={t("popup.transport.gbAadf")} value={aadfText} />
    <Row label={t("popup.transport.gbMaxspeed")} value={text(props.maxspeed)} />
    <Row label={t("popup.transport.gbLanes")} value={text(props.lanes)} />
    <Row label={t("popup.transport.gbSegmentLength")} value={length == null ? "" : t("popup.transport.gbKmValue", { n: i18n.formatNumber(length, { maximumFractionDigits: 2 }) })} />
    <Row label={t("popup.transport.gbNation")} value={place} />
    <Row label={t("popup.transport.gbRoadSource")} value={t(isOsm ? "popup.transport.gbRoadSourceOsm" : "popup.transport.gbRoadSourceMrdb")} />
    {!isOsm ? <Row label="" value={t("popup.transport.gbRoadMrdbNote")} /> : null}
    <Row label={t("popup.transport.gbCoverage")} value={t("popup.transport.gbRoadBNotCovered")} />
    {isOsm
      ? <SourceFooter props={{ source_org: GB_ROADS_OSM_ATTRIBUTION, source_url: GB_ROADS_OSM_URL, license: GB_ROADS_ODBL, fetched_at: GB_TRANSPORT_FETCHED_AT }} />
      : <SourceFooter props={{ source_org: GB_DFT_ROAD_TRAFFIC_ATTRIBUTION, source_url: GB_DFT_ROAD_TRAFFIC_URL, license: GB_TRANSPORT_OGL_V3, fetched_at: GB_TRANSPORT_FETCHED_AT }} />}
  </>;
}

/** AADF 交通計數點（DfT 2025）：道路、類別、路段起訖、合計與分車種、資料方式（估算明寫非當年實測）。 */
export function GbTrafficCountsAadfPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const nation = useNationLabel();
  const category = useRoadCategoryLabel();
  const all = num(props.all_motor_vehicles);
  const veh = (value: unknown) => {
    const n = num(value);
    return n == null ? t("popup.transport.gbAadfNoCount") : t("popup.transport.gbVehPerDay", { n: i18n.formatNumber(n) });
  };
  const counted = props.estimation_method === "Counted";
  const estimated = props.estimation_method === "Estimated";
  const from = text(props.start_junction_road_name);
  const to = text(props.end_junction_road_name);
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={gbAadfBucketColor(all) ?? GB_AADF_COLOR}>{text(props.road_name) || t("popup.transport.gbCountPoint")}</Title>
    <Row label={t("popup.transport.gbRoadCategory")} value={category(props.road_category)} />
    {from && to ? <Row label={t("popup.transport.gbAadfLink")} value={t("popup.transport.gbAadfLinkValue", { from, to })} /> : null}
    <Row label={t("popup.transport.gbAadfAll")} value={veh(props.all_motor_vehicles)} />
    <Row label={t("popup.transport.gbAadfCars")} value={veh(props.cars_and_taxis)} />
    <Row label={t("popup.transport.gbAadfLgv")} value={veh(props.LGVs)} />
    <Row label={t("popup.transport.gbAadfHgv")} value={veh(props.all_HGVs)} />
    <Row label={t("popup.transport.gbAadfBus")} value={veh(props.buses_and_coaches)} />
    <Row label={t("popup.transport.gbAadfMoto")} value={veh(props.two_wheeled_motor_vehicles)} />
    <Row label={t("popup.transport.gbAadfCycle")} value={veh(props.pedal_cycles)} />
    <Row label={t("popup.transport.gbAadfMethod")} value={counted ? t("popup.transport.gbAadfMethodCounted") : estimated ? t("popup.transport.gbAadfMethodEstimated") : text(props.estimation_method)} />
    <Row label={t("popup.transport.gbAadfMethodDetail")} value={text(props.estimation_method_detailed)} />
    <Row label={t("popup.transport.gbAadfYear")} value={text(props.year) || String(GB_AADF_YEAR)} mono />
    <Row label={t("popup.transport.gbCountPointId")} value={text(props.count_point_id)} mono />
    <Row label={t("popup.transport.gbNation")} value={place} />
    <Row label={t("popup.transport.gbCoverage")} value={t("legend.transport.gbAadfNi")} />
    <SourceFooter props={{ source_org: GB_DFT_ROAD_TRAFFIC_ATTRIBUTION, source_url: GB_DFT_ROAD_TRAFFIC_URL, license: GB_TRANSPORT_OGL_V3, fetched_at: GB_TRANSPORT_FETCHED_AT }} />
  </>;
}

// ─────────────────────────── 英國第 5 波：自然與林業 ───────────────────────────

/** 圖例字串尾端的括號補充（zoom、例子）在 popup 不顯示。 */
const STRIP_PAREN = /\s*[（(][^（(]*[）)]$/;
function useHectares() {
  const { t } = useLocale();
  return (value: unknown) => {
    const n = num(value);
    return n != null ? t("popup.baseMap.gbHectares", { value: n.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : "";
  };
}
const natureFooter = (src: { attribution: string; url: string } | undefined) =>
  src ? <SourceFooter props={{ source_org: src.attribution, source_url: src.url, license: GB_NATURE_OGL_V3, fetched_at: GB_NATURE_FETCHED_AT }} /> : null;

/** 英國保護區：名稱、類別（中文＋當地名稱）、地區、面積、代碼、來源機關。 */
export function GbProtectedAreasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ha = useHectares();
  const d = gbDesignation(props.designation);
  const local = text(props.designation_local);
  const source = text(props.source);
  const attribution = GB_PROTECTED_SOURCES[source];
  const url = GB_PROTECTED_SOURCE_URLS[`${text(props.nation)}:${text(props.designation)}`] ?? "";
  return <>
    <Title color={d?.color ?? GB_PROTECTED_AREAS_COLOR}>{text(props.name) || t("popup.environmentLayer.gbPaTitle")}</Title>
    <Row label={t("popup.environmentLayer.gbPaDesignation")} value={d ? t(GB_DESIGNATION_KEYS[d.value]) : text(props.designation)} />
    {local ? <Row label={t("popup.environmentLayer.gbPaLocalName")} value={local.replace(/_/g, " ")} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.environmentLayer.gbPaArea")} value={ha(props.area_ha)} />
    <Row label={t("popup.environmentLayer.gbPaSiteCode")} value={text(props.site_code)} mono />
    <Row label={t("popup.environmentLayer.gbPaSourceOrg")} value={source} />
    {attribution ? <SourceFooter props={{ source_org: attribution, source_url: url, license: GB_NATURE_OGL_V3, fetched_at: GB_NATURE_FETCHED_AT }} /> : null}
  </>;
}

/** 英國海洋保護區：名稱、類型、主管機關（null 不顯示）、面積、狀態、地區；不可用於航行。 */
export function GbMarineProtectedAreasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ha = useHectares();
  const type = GB_MPA_TYPES.find((m) => m.value === props.mpa_type);
  const src = GB_MPA_SOURCES[text(props.source)];
  const footer = src && props.mpa_type === "drmpa" ? { ...src, url: GB_MPA_DRMPA_URL } : src;
  return <>
    <Title color={type?.color ?? GB_MPA_COLOR}>{text(props.name) || t("popup.marine.gbMpaTitle")}</Title>
    <Row label={t("popup.marine.gbMpaType")} value={type ? t(GB_MPA_TYPE_KEYS[type.value]) : text(props.mpa_type)} />
    <Row label={t("popup.marine.gbMpaLead")} value={text(props.lead).replace(/_/g, " ")} />
    <Row label={t("popup.marine.gbMpaArea")} value={ha(props.area_ha)} />
    <Row label={t("popup.marine.gbMpaStatus")} value={text(props.status)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.marine.gbMpaNav")} />
    {natureFooter(footer)}
  </>;
}

/** 英國林地：林型（中文＋原文）、地區、來源；北愛為優先棲地林地（非 NFI）。tiles 無面積欄。 */
export function GbWoodlandPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ni = props.kind === GB_WOODLAND_NI_KIND;
  const group = gbWoodlandGroup(props.forest_type);
  const raw = text(props.forest_type);
  return <>
    <Title color={ni ? GB_WOODLAND_NI_COLOR : group?.color ?? GB_WOODLAND_COLOR}>{ni ? t("legend.environment.gbWoodNi") : t("popup.forestry.gbWoodTitle")}</Title>
    {!ni ? <Row label={t("popup.forestry.gbWoodType")} value={[group ? t(GB_WOODLAND_GROUP_KEYS[group.value]).replace(STRIP_PAREN, "") : "", raw].filter(Boolean).join(" · ")} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.forestry.gbWoodSource")} value={t(ni ? "popup.forestry.gbWoodNiSource" : "popup.forestry.gbWoodNfi")} />
    <SourceFooter props={ni
      ? { source_org: GB_WOODLAND_NI_ATTRIBUTION, source_url: GB_WOODLAND_NI_URL, license: GB_NATURE_OGL_V3, fetched_at: GB_NATURE_FETCHED_AT }
      : { source_org: GB_WOODLAND_FC_ATTRIBUTION, source_url: GB_WOODLAND_FC_URL, license: GB_NATURE_OGL_V3, fetched_at: GB_NATURE_FETCHED_AT }} />
  </>;
}

/** 英國森林遊憩設施：名稱（null＝未命名）、類別、設施型、設置日期、森林區；威爾斯只有 NRW 代碼。 */
export function GbForestRecreationPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const cat = GB_RECREATION_CATEGORIES.find((c) => c.value === props.category);
  const wales = props.source === "Natural Resources Wales";
  const asset = text(props.asset_type);
  return <>
    <Title color={cat?.color ?? GB_RECREATION_UNCLASSIFIED_COLOR}>{text(props.name) || t("popup.forestry.gbRecUnnamed")}</Title>
    <Row label={t("popup.forestry.gbRecCategory")} value={cat
      ? t(GB_RECREATION_KEYS[cat.value]).replace(STRIP_PAREN, "")
      : wales ? t("popup.forestry.gbRecNrwCode", { code: text(props.type_code) || "—" }) : ""} />
    {!wales && asset ? <Row label={t("popup.forestry.gbRecAssetType")} value={asset} /> : null}
    <Row label={t("popup.forestry.gbRecInstall")} value={/^(NaT|nan|None)$/i.test(text(props.install_date)) ? "" : text(props.install_date)} mono />
    <Row label={t("popup.forestry.gbRecDistrict")} value={text(props.district)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {natureFooter(GB_RECREATION_SOURCES[text(props.source)])}
  </>;
}

/** 英國步道：路線名、類別、型態、難度、狀態（非官方／臨時要標）、長度（依圖形量測者加註）。 */
export function GbTrailsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const national = props.route_class === "national_trail";
  const cat = gbTrailCategory(props.category);
  const status = text(props.status);
  const km = num(props.length_km);
  const measured = props.length_km_measured === true || props.length_km_measured === "true" || props.length_km_measured === "True";
  const kmText = km != null ? t(measured ? "popup.forestry.gbTrailKmMeasured" : "popup.forestry.gbTrailKm", { value: km.toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : "";
  const classLabel = national
    ? t("legend.environment.gbTrailNational").replace(STRIP_PAREN, "")
    : [t("legend.environment.gbTrailForestHeading").replace(STRIP_PAREN, ""), cat ? t(GB_TRAIL_CATEGORY_KEYS[cat.value]).replace(STRIP_PAREN, "") : ""].filter(Boolean).join(" · ");
  return <>
    <Title color={national ? GB_NATIONAL_TRAIL_COLOR : cat?.color ?? GB_TRAIL_UNCLASSIFIED_COLOR}>{text(props.name) || t("popup.forestry.gbTrailUnnamed")}</Title>
    <Row label={t("popup.forestry.gbTrailClass")} value={classLabel} />
    <Row label={t("popup.forestry.gbTrailType")} value={text(props.route_type)} />
    <Row label={t("popup.forestry.gbTrailGrade")} value={text(props.grade)} />
    <Row label={t("popup.forestry.gbTrailStatus")} value={status ? (GB_TRAIL_FLAG_STATUSES.includes(status) ? `${status} · ${t("popup.forestry.gbTrailUnofficial")}` : status) : ""} />
    <Row label={t("popup.forestry.gbTrailLength")} value={kmText} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {natureFooter(gbTrailSource(props))}
  </>;
}

/** 英國開放進入地：類別、同時屬於的其他類（旗標）、面積、地區；固定說明可徒步自由進入。 */
export function GbOpenAccessLandPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ha = useHectares();
  const type = GB_ACCESS_TYPES.find((a) => a.value === props.access_type);
  const isTrue = (v: unknown) => v === true || v === "True" || v === "true";
  const flags = GB_ACCESS_TYPES.filter((a) => a.value !== type?.value && isTrue(props[a.flag])).map((a) => t(GB_ACCESS_TYPE_KEYS[a.value]).replace(STRIP_PAREN, ""));
  const nrwCommon = props.source === "Natural Resources Wales" && props.access_type === "common_land";
  const src = GB_OPEN_ACCESS_SOURCES[text(props.source)];
  return <>
    <Title color={type?.color ?? GB_OPEN_ACCESS_COLOR}>{t("popup.forestry.gbOaTitle")}</Title>
    <Row label={t("popup.forestry.gbOaType")} value={type ? t(GB_ACCESS_TYPE_KEYS[type.value]) : text(props.access_type)} />
    {flags.length ? <Row label={t("popup.forestry.gbOaFlags")} value={flags.join("、")} /> : null}
    <Row label={t("popup.forestry.gbOaArea")} value={ha(props.area_ha)} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.environment.gbOaNote")} />
    {natureFooter(src && nrwCommon ? { ...src, url: GB_OPEN_ACCESS_NRW_COMMON_URL } : src)}
  </>;
}

const GB_AW_STATUS_KEYS: Record<GbAncientWoodlandStatus, MessageKey> = {
  asnw: "popup.environmentLayer.gbAwAsnw", paws: "popup.environmentLayer.gbAwPaws", restored: "popup.environmentLayer.gbAwRestored",
  unknown: "popup.environmentLayer.gbAwUnknown", longEstablished: "popup.environmentLayer.gbAwLongEstablished",
  otherRoy: "popup.environmentLayer.gbAwOtherRoy", deleted: "popup.environmentLayer.gbAwDeleted",
};

/** 英國樹木保護：TPO → 編號、地方政府（加註只含試辦機關）；古老林地 → 類別（中文＋原文）、名稱、面積。 */
export function GbTreeProtectionPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const ha = useHectares();
  const cat = GB_TREE_CATEGORIES.find((c) => c.value === props.category);
  const tpo = props.category === "tpo_zone" || props.category === "tpo_tree";
  const aw = text(props.aw_status);
  const awKey = GB_AW_STATUS[aw];
  const src = GB_TREE_SOURCES[text(props.source)];
  const footer = src && props.category === "tpo_tree" ? { ...src, url: GB_TPO_TREE_URL } : src;
  return <>
    <Title color={cat?.color ?? GB_TREE_PROTECTION_COLOR}>{tpo ? t(GB_TREE_CATEGORY_KEYS[cat!.value]) : text(props.name) || (cat ? t(GB_TREE_CATEGORY_KEYS[cat.value]) : t("popup.environmentLayer.gbTreeTitle"))}</Title>
    <Row label={t("popup.environmentLayer.gbTreeCategory")} value={cat ? t(GB_TREE_CATEGORY_KEYS[cat.value]) : text(props.category)} />
    {tpo ? <>
      <Row label={t("popup.environmentLayer.gbTpoRef")} value={text(props.tpo_ref)} mono />
      <Row label={t("popup.environmentLayer.gbTpoOrg")} value={text(props.organisation)} />
      <Row label={t("popup.baseMap.gbNotes")} value={t("popup.environmentLayer.gbTpoNote")} />
    </> : <>
      <Row label={t("popup.environmentLayer.gbAwStatus")} value={awKey ? `${t(GB_AW_STATUS_KEYS[awKey])} · ${aw}` : aw} />
      <Row label={t("popup.environmentLayer.gbPaArea")} value={ha(props.area_ha)} />
    </>}
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    {natureFooter(footer)}
  </>;
}

// ─────────────────────────── 英國第 6 波：能源 ───────────────────────────

const STATUS_GROUPS: readonly GbStatusGroup[] = ["operational", "construction", "consented", "in_planning", "not_proceeding", "decommissioned"];
function useMw() {
  const { t } = useLocale();
  return (value: unknown) => {
    const n = num(value);
    return n != null ? t("popup.energy.gbMw", { value: n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : "";
  };
}
/** 地區：四地＋地方政府；nation 為 null（離岸電纜、海上平台）顯示「離岸，未歸四地」。 */
function usePlaceLabel() {
  const { t } = useLocale();
  const nation = useNationLabel();
  return (props: Record<string, unknown>) => {
    const n = gbEnergyText(props.nation);
    if (!n) return t("popup.energy.gbOffshoreNation");
    return [nation(n), gbEnergyText(props.lad_name)].filter(Boolean).join(" · ");
  };
}
const energyFooter = (org: string, url: string, license: string) =>
  <SourceFooter props={{ source_org: org, source_url: url, license, fetched_at: GB_ENERGY_FETCHED_AT }} />;

/** 英國電廠（DUKES 5.11）：名稱、公司、燃料、容量、啟用年、併網等級、地區；null 顯示「未載明」。 */
export function GbPowerPlantsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const mw = useMw();
  const place = usePlaceLabel();
  const g = gbFuelGroup(props.fuel_group);
  const unstated = t("popup.energy.gbUnstated");
  const grid = gbEnergyText(props.grid_connection);
  const fuelRaw = [gbEnergyText(props.primary_fuel), gbEnergyText(props.type)].filter(Boolean).join(" · ");
  return <>
    <Title color={g?.color ?? GB_POWER_PLANTS_COLOR}>{gbEnergyText(props.site_name) || t("popup.energy.gbPlantTitle")}</Title>
    <Row label={t("popup.energy.gbCompany")} value={gbEnergyText(props.company) || unstated} />
    <Row label={t("popup.energy.gbFuel")} value={[g ? t(GB_FUEL_GROUP_KEYS[g.value]) : "", fuelRaw].filter(Boolean).join(" · ") || unstated} />
    <Row label={t("popup.energy.gbCapacity")} value={mw(props.capacity_mw) || unstated} />
    <Row label={t("popup.energy.gbCommissioned")} value={gbEnergyText(props.year_commissioned) || unstated} mono />
    <Row label={t("popup.energy.gbGridConnection")} value={grid === "HV" ? t("popup.energy.gbGridHv") : grid === "LV" ? t("popup.energy.gbGridLv") : unstated} />
    {gbEnergyText(props.chp) === "Yes" ? <Row label={t("popup.energy.gbChp")} value={t("popup.energy.gbYes")} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {energyFooter(GB_POWER_PLANTS_ATTRIBUTION, GB_POWER_PLANTS_URL, GB_ENERGY_OGL_V3)}
  </>;
}

/** 英國再生能源專案（REPD）：案場名、技術、容量、審查階段、運轉日或核准日、審查機關、風機（風電才顯示）、地區。 */
export function GbRenewablesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const mw = useMw();
  const place = usePlaceLabel();
  const g = gbTechGroup(props.tech_group);
  const status = STATUS_GROUPS.find((s) => s === props.status_group);
  const rawStatus = gbEnergyText(props.status);
  const operational = gbEnergyText(props.date_operational);
  const granted = gbEnergyText(props.date_granted);
  const wind = props.tech_group === "wind_onshore" || props.tech_group === "wind_offshore";
  const turbines = gbEnergyText(props.turbines);
  const height = num(props.turbine_height_m);
  return <>
    <Title color={g?.color ?? GB_RENEWABLES_COLOR}>{gbEnergyText(props.site_name) || t("popup.energy.gbRenewTitle")}</Title>
    <Row label={t("popup.energy.gbTechnology")} value={[g ? t(GB_TECH_GROUP_KEYS[g.value]) : "", gbEnergyText(props.technology)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.energy.gbStorageType")} value={gbEnergyText(props.storage_type)} />
    <Row label={t("popup.energy.gbCapacity")} value={mw(props.capacity_mw)} />
    {/* 分組標籤與原字只差大小寫（英文介面）時只顯示一次 */}
    <Row label={t("popup.energy.gbStatus")} value={(() => { const label = status ? t(GB_STATUS_GROUP_KEYS[status]) : ""; return label.toLowerCase() === rawStatus.toLowerCase() ? label : [label, rawStatus].filter(Boolean).join(" · "); })()} />
    {operational
      ? <Row label={t("popup.energy.gbDateOperational")} value={operational.slice(0, 10)} mono />
      : <Row label={t("popup.energy.gbDateGranted")} value={granted.slice(0, 10)} mono />}
    <Row label={t("popup.energy.gbPlanningAuthority")} value={gbEnergyText(props.planning_authority)} />
    {wind && turbines ? <Row label={t("popup.energy.gbTurbines")} value={height != null ? t("popup.energy.gbTurbinesHeight", { n: turbines, height: height.toLocaleString() }) : turbines} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {energyFooter(GB_RENEWABLES_ATTRIBUTION, GB_RENEWABLES_URL, GB_ENERGY_OGL_V3)}
  </>;
}

const LOCATION_CABLE = new Set(["underground", "underwater", "tunnel"]);
function useKv() {
  const { t } = useLocale();
  return (props: Record<string, unknown>) => {
    const raw = gbEnergyText(props.voltage);
    if (!raw) return t("popup.energy.gbVoltageUntagged");
    const kv = raw.split(";").map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0).map((n) => (n / 1000).toLocaleString());
    const value = kv.length ? `${kv.join(" / ")} kV` : raw;
    // 只有「輸電」「配電」兩級的圖例名多帶資訊；其餘（132、33–66 kV）與數值重複不再附
    const v = gbVoltageClass(props.voltage_class);
    return v && VOLTAGE_NAMED.has(v.value) ? `${value} · ${t(GB_VOLTAGE_KEYS[v.value])}` : value;
  };
}
const VOLTAGE_NAMED = new Set(["transmission_275_400", "distribution_lt33"]);

/** 英國電網線（OSM）：名稱或編號、電壓、類型（架空線／地下或海底電纜）、營運者、線長、地區。 */
export function GbPowerLinesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const place = usePlaceLabel();
  const kv = useKv();
  const v = gbVoltageClass(props.voltage_class);
  const cable = props.kind === "cable";
  const loc = gbEnergyText(props.location);
  const km = num(props.length_km);
  return <>
    <Title color={v?.color ?? GB_POWER_LINES_COLOR}>{gbEnergyText(props.name) || gbEnergyText(props.ref) || t("popup.energy.gbLineUnnamed")}</Title>
    <Row label={t("popup.energy.gbVoltage")} value={kv(props)} />
    <Row label={t("popup.energy.gbLineKind")} value={cable ? t(loc === "underwater" ? "popup.energy.gbCableSubsea" : "popup.energy.gbCableUnderground") : LOCATION_CABLE.has(loc) ? t("popup.energy.gbCableUnderground") : t("popup.energy.gbOverhead")} />
    {gbEnergyText(props.ref) && gbEnergyText(props.name) ? <Row label={t("popup.energy.gbRef")} value={gbEnergyText(props.ref)} mono /> : null}
    <Row label={t("popup.energy.gbOperator")} value={gbEnergyText(props.operator)} />
    <Row label={t("popup.energy.gbLength")} value={km != null ? (km < 0.1 ? t("popup.energy.gbKmUnder") : t("popup.energy.gbKm", { value: km.toLocaleString(undefined, { maximumFractionDigits: 1 }) })) : ""} />
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {energyFooter(GB_OSM_ATTRIBUTION, GB_OSM_URL, GB_ENERGY_ODBL)}
  </>;
}

/** 英國變電所（OSM）：名稱、電壓、類型（transmission／distribution…原值）、營運者、地區。 */
/** OSM substation=* 常見值的中文；外文走 enum.gbSubstationType，少見或拼錯的值原樣顯示。 */
const GB_SUBSTATION_TYPE_ZH: Record<string, string> = { minor_distribution: "小型配電", distribution: "配電", transmission: "輸電", traction: "鐵路牽引供電", transition: "架空與地下纜線轉接", generation: "發電廠併網", industrial: "工業專用", converter: "換流站", compensation: "無效功率補償", switching: "開閉所", measurement: "計量", transformer: "變壓器" };

export function GbSubstationsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const subType = gbEnergyText(props.substation);
  const place = usePlaceLabel();
  const kv = useKv();
  const v = gbVoltageClass(props.voltage_class);
  return <>
    <Title color={v?.color ?? GB_SUBSTATIONS_COLOR}>{gbEnergyText(props.name) || gbEnergyText(props.ref) || t("popup.energy.gbSubstationUnnamed")}</Title>
    <Row label={t("popup.energy.gbVoltage")} value={kv(props)} />
    {/* OSM substation=yes 只表示「是變電所」，沒有類型資訊，不顯示 */}
    <Row label={t("popup.energy.gbSubstationType")} value={/^yes$/i.test(subType) ? "" : enumLabel("gbSubstationType", subType, GB_SUBSTATION_TYPE_ZH[subType] ?? subType.replace(/_/g, " "), i18n)} />
    <Row label={t("popup.energy.gbOperator")} value={gbEnergyText(props.operator)} />
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {energyFooter(GB_OSM_ATTRIBUTION, GB_OSM_URL, GB_ENERGY_ODBL)}
  </>;
}

const GB_FUEL_TYPE_KEYS: Record<GbFuelType, MessageKey> = {
  fuel_diesel: "popup.energy.gbFuelDiesel", fuel_octane_95: "popup.energy.gbFuelOctane95", fuel_octane_98: "popup.energy.gbFuelOctane98",
  fuel_e10: "popup.energy.gbFuelE10", fuel_lpg: "popup.energy.gbFuelLpg", fuel_hgv_diesel: "popup.energy.gbFuelHgvDiesel",
  fuel_adblue: "popup.energy.gbFuelAdblue", fuel_cng: "popup.energy.gbFuelCng", fuel_hydrogen: "popup.energy.gbFuelHydrogen",
};
const PUBLIC_ACCESS = new Set(["", "yes", "permissive"]);

/** 英國加油站（OSM）：站名（null 用品牌）、品牌、營業時間、有標的油品（只列 yes；全未標寫「OSM 未標油品」）、非公眾開放標示。 */
export function GbFuelStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const place = usePlaceLabel();
  const brand = gbEnergyText(props.brand);
  const fuels = GB_FUEL_TYPES.filter((f) => gbEnergyText(props[f]).toLowerCase() === "yes").map((f) => t(GB_FUEL_TYPE_KEYS[f]));
  const access = gbEnergyText(props.access).toLowerCase();
  return <>
    <Title color={GB_FUEL_STATION_COLOR}>{gbEnergyText(props.name) || brand || t("popup.energy.gbFuelStationTitle")}</Title>
    <Row label={t("popup.energy.gbBrand")} value={brand} />
    <Row label={t("popup.energy.gbOpeningHours")} value={gbEnergyText(props.opening_hours)} mono />
    <Row label={t("popup.energy.gbFuels")} value={fuels.length ? fuels.join("、") : t("popup.energy.gbFuelsUntagged")} />
    {!PUBLIC_ACCESS.has(access) ? <Row label={t("popup.energy.gbAccess")} value={t("popup.energy.gbAccessRestricted", { value: access })} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {energyFooter(GB_OSM_ATTRIBUTION, GB_OSM_URL, GB_ENERGY_ODBL)}
  </>;
}

/** 英國離岸油氣田（NSTA）：名稱、類型、狀態、發現年、投產年、水深、作業者；範圍為英國大陸棚、不歸四地；非商用授權。 */
export function GbOilGasFieldsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const type = GB_FIELD_TYPES.find((f) => f.value === props.field_type);
  const depth = num(props.depth_m);
  return <>
    <Title color={type?.color ?? GB_OIL_GAS_COLOR}>{gbEnergyText(props.field_name) || t("popup.energy.gbFieldTitle")}</Title>
    <Row label={t("popup.energy.gbFieldType")} value={type ? t(GB_FIELD_TYPE_KEYS[type.value]) : gbEnergyText(props.field_type)} />
    <Row label={t("popup.energy.gbStatus")} value={gbEnergyText(props.status)} />
    <Row label={t("popup.energy.gbDiscovered")} value={gbFieldYear(props.discovery_date)} mono />
    <Row label={t("popup.energy.gbProduction")} value={gbFieldYear(props.production_date)} mono />
    <Row label={t("popup.energy.gbDepth")} value={depth != null ? t("popup.energy.gbMeters", { value: depth.toLocaleString(undefined, { maximumFractionDigits: 0 }) }) : ""} />
    <Row label={t("popup.energy.gbOperator")} value={gbEnergyText(props.operator)} />
    <Row label={t("popup.baseMap.gbNation")} value={t("popup.energy.gbUkcs")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("legend.energy.gbNstaLicense")} />
    {energyFooter(GB_NSTA_ATTRIBUTION, GB_NSTA_URL, `${GB_NSTA_LICENSE} · ${t("popup.energy.gbNonCommercial")}`)}
  </>;
}

// ─────────────────────────── 英國第 7 波：公共服務 ───────────────────────────

const ONSPD_ORG = GB_ONSPD_ATTRIBUTION.join(" · ");
/** 來源 footer：郵遞區號定位的點附 ONSPD 三段署名。 */
function civicFooter(org: string, url: string, props: Record<string, unknown>, license = GB_CIVIC_OGL_V3) {
  const onspd = gbIsPostcodeCentroid(props.precision);
  return <SourceFooter props={{ source_org: onspd ? `${org} · ${ONSPD_ORG}` : org, source_url: url, license, fetched_at: GB_CIVIC_FETCHED_AT }} />;
}
/** 地區：四地＋地方政府。 */
function useCivicPlace() {
  const nation = useNationLabel();
  return (props: Record<string, unknown>) => [nation(gbCivicText(props.nation)), gbCivicText(props.lad_name)].filter(Boolean).join(" · ");
}
/** 郵遞區號中心定位的位置註（非建物位置）。 */
function PostcodeRow({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  if (!gbIsPostcodeCentroid(props.precision)) return null;
  return <Row label={t("popup.publicLife.gbLocation")} value={t(props.precision === "postcode_centroid_terminated" ? "popup.publicLife.gbPostcodeTerminated" : "popup.publicLife.gbPostcodeCentroid")} />;
}
const withHttp = (url: string) => (!url ? "" : /^https?:\/\//i.test(url) ? url : `https://${url}`);

const GB_SCHOOL_SOURCES: Record<string, { org: string; url: string }> = {
  GIAS: { org: "DfE Get Information about Schools", url: GB_SCHOOLS_URL },
  "gov.scot": { org: "Scottish Government School contact details", url: "https://www.gov.scot/publications/school-contact-details/" },
  "gov.wales": { org: "Welsh Government Address list of schools", url: "https://gov.wales/addresses-and-phone-numbers-schools-and-pupil-referral-units" },
  "DE NI": { org: "Department of Education NI Locate a school (2016)", url: "https://admin.opendatani.gov.uk/dataset/locate-a-school" },
};

/** 英國學校：校名、學段（＋來源類型原文）、年齡、學生數、容量、宗教性質、公費／獨立、網站、地區；北愛 2016 名冊註記。 */
export function GbSchoolsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const place = useCivicPlace();
  const c = gbSchoolCategory(props.category);
  const type = gbCivicText(props.type);
  const pupils = num(props.pupils);
  const capacity = num(props.capacity);
  const sector = gbCivicText(props.sector);
  const statusNote = gbCivicText(props.status_note);
  const isNi2016 = props.source === "DE NI" || statusNote.includes("2016");
  const src = GB_SCHOOL_SOURCES[gbCivicText(props.source)];
  const categoryLabel = c && c.value !== "other" ? t(GB_SCHOOL_CATEGORY_KEYS[c.value]) : t("popup.publicLife.gbSchoolPhaseUnstated");
  return <>
    <Title color={c?.color ?? GB_SCHOOLS_COLOR}>{gbCivicText(props.name) || t("popup.publicLife.gbSchoolTitle")}</Title>
    <Row label={t("popup.publicLife.gbSchoolPhase")} value={[categoryLabel, type].filter(Boolean).join(" · ")} />
    <Row label={t("popup.publicLife.gbSchoolAge")} value={gbCivicText(props.age_range)} mono />
    <Row label={t("popup.publicLife.gbSchoolPupils")} value={pupils != null ? pupils.toLocaleString() : ""} mono />
    <Row label={t("popup.publicLife.gbSchoolCapacity")} value={capacity != null ? capacity.toLocaleString() : ""} mono />
    <Row label={t("popup.publicLife.gbSchoolSector")} value={sector === "state_funded" ? t("popup.publicLife.gbSchoolStateFunded") : sector === "independent" ? t("popup.publicLife.gbSchoolIndependent") : ""} />
    <Row label={t("popup.publicLife.gbSchoolManagement")} value={gbCivicText(props.management)} />
    <Row label={t("popup.publicLife.gbSchoolReligion")} value={gbCivicText(props.religious_character)} />
    <Row label={t("popup.publicLife.gbSchoolWelshMedium")} value={gbCivicText(props.welsh_medium)} />
    <LinkRow label={t("popup.publicLife.gbWebsite")} url={withHttp(gbCivicText(props.website))} />
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {isNi2016 ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.publicLife.gbSchoolNi2016")} /> : null}
    {statusNote === "proposed_to_close" ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.publicLife.gbSchoolProposedToClose")} /> : null}
    <PostcodeRow props={props} />
    {civicFooter(src?.org ?? GB_SCHOOLS_ATTRIBUTION, src?.url ?? GB_SCHOOLS_URL, props)}
  </>;
}

/** 英國醫療：名稱、類別、ODS／PHS 代碼、所屬、GP 名冊人數（蘇格蘭）、合併院址數、地區；醫院名稱比對註記；全部為郵遞區號中心。 */
export function GbHealthFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const isDark = useFeatureTheme() !== LIGHT_FEATURE;
  const place = useCivicPlace();
  const k = gbHealthKind(props.kind);
  const listSize = num(props.list_size);
  const sites = num(props.site_codes_n);
  const phs = gbCivicText(props.source).startsWith("PHS");
  return <>
    <Title color={k ? gbHealthColor(k.value, isDark) : GB_HEALTH_COLOR}>{gbCivicText(props.name) || t("popup.publicLife.gbHealthTitle")}</Title>
    <Row label={t("popup.publicLife.gbHealthKind")} value={k ? t(GB_HEALTH_KIND_KEYS[k.value]) : gbCivicText(props.kind)} />
    <Row label={t("popup.publicLife.gbHealthCode")} value={gbCivicText(props.org_code)} mono />
    <Row label={t("popup.publicLife.gbHealthParent")} value={gbCivicText(props.parent_code)} mono />
    <Row label={t("popup.publicLife.gbHealthListSize")} value={listSize != null ? listSize.toLocaleString() : ""} mono />
    {sites != null && sites > 1 ? <Row label={t("popup.publicLife.gbHealthSites")} value={t("popup.publicLife.gbHealthSitesValue", { n: sites })} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {props.hospital_basis === "name_match" ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.publicLife.gbHealthNameMatch")} /> : null}
    <PostcodeRow props={props} />
    {civicFooter(phs ? GB_HEALTH_PHS_ATTRIBUTION : GB_HEALTH_ODS_ATTRIBUTION, phs ? GB_HEALTH_PHS_URL : GB_HEALTH_ODS_URL, props)}
  </>;
}

/** 英國照護（照護之家與長照服務共用）：名稱、類型、床數、服務對象、評等、經營者、CQC 頁面、地區；居家照顧等為機構登記地址。 */
function GbCarePanel({ props, fallbackColor }: { props: Record<string, unknown>; fallbackColor: string }) {
  const { t } = useLocale();
  const place = useCivicPlace();
  const k = gbCareKind(props.care_kind);
  const beds = num(props.beds);
  const ci = props.source === "Care Inspectorate";
  const rating = gbCivicText(props.rating);
  const ciGrade = /^min grade (\d)$/.exec(rating);
  return <>
    <Title color={k?.color ?? fallbackColor}>{gbCivicText(props.name) || t("popup.publicLife.gbCareTitle")}</Title>
    <Row label={t("popup.publicLife.gbCareKind")} value={k ? t(GB_CARE_KIND_KEYS[k.value]) : gbCivicText(props.care_kind)} />
    <Row label={t("popup.publicLife.gbCareBeds")} value={beds != null && beds > 0 ? beds.toLocaleString() : ""} mono />
    <Row label={t("popup.publicLife.gbCareUsers")} value={gbCivicText(props.user_bands).split(",").map((v) => v.trim()).filter(Boolean).join(", ")} />
    <Row label={ci ? t("popup.publicLife.gbCareRatingCi") : t("popup.publicLife.gbCareRatingCqc")} value={ciGrade ? t("popup.publicLife.gbCareCiGrade", { n: ciGrade[1]! }) : rating} />
    <Row label={t("popup.publicLife.gbCareProvider")} value={gbCivicText(props.provider)} />
    <Row label={t("popup.publicLife.gbCareProviderSector")} value={gbCivicText(props.provider_sector)} />
    <LinkRow label={t("popup.publicLife.gbCareCqcPage")} url={gbCivicText(props.url)} />
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {GB_CARE_OFFICE_ADDRESS_KINDS.has(gbCivicText(props.care_kind)) ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.publicLife.gbCareOfficeAddress")} /> : null}
    <PostcodeRow props={props} />
    {civicFooter(ci ? GB_CARE_CI_ATTRIBUTION : GB_CARE_CQC_ATTRIBUTION, ci ? GB_CARE_CI_URL : GB_CARE_CQC_URL, props)}
  </>;
}
export function GbCareHomesPanel({ props }: { props: Record<string, unknown> }) {
  return <GbCarePanel props={props} fallbackColor={GB_CARE_HOMES_COLOR} />;
}
export function GbCareServicesPanel({ props }: { props: Record<string, unknown> }) {
  return <GbCarePanel props={props} fallbackColor={GB_CARE_SERVICES_COLOR} />;
}

const GB_FIRE_STATION_TYPE_KEYS: Record<string, MessageKey> = {
  main_station: "popup.publicLife.gbFireTypeMain", voluntary: "popup.publicLife.gbFireTypeVoluntary",
  airport: "popup.publicLife.gbFireTypeAirport", airport2: "popup.publicLife.gbFireTypeAirport",
};

/** 英國消防站：站名、所屬消防局、站型（OSM）、來源（官方／OSM，附 OSM 連結）、座標檢核註記、地區。 */
export function GbFireStationsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const place = useCivicPlace();
  const osm = props.source === "osm";
  const osmId = gbCivicText(props.osm_id);
  const stationType = gbCivicText(props.station_type);
  const coordNote = gbCivicText(props.coord_note);
  return <>
    <Title color={GB_FIRE_COLOR}>{gbCivicText(props.name) || t("popup.publicLife.gbFireTitle")}</Title>
    <Row label={t("popup.publicLife.gbFireOperator")} value={gbCivicText(props.operator) || t("popup.publicLife.gbUnstated")} />
    <Row label={t("popup.publicLife.gbFireType")} value={stationType ? (GB_FIRE_STATION_TYPE_KEYS[stationType] ? t(GB_FIRE_STATION_TYPE_KEYS[stationType]!) : stationType) : ""} />
    <Row label={t("popup.publicLife.gbFireSource")} value={osm ? t("popup.publicLife.gbFireSourceOsm") : t("popup.publicLife.gbFireSourceOfficial")} />
    {osm && osmId ? <LinkRow label={t("popup.publicLife.gbFireOsmLink")} url={`https://www.openstreetmap.org/${osmId}`} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    {coordNote ? <Row label={t("popup.publicLife.gbFireCoordNote")} value={coordNote.includes("未核對") ? t("popup.publicLife.gbFireCoordUnverified") : coordNote.includes("郵遞區號中心") ? t("popup.publicLife.gbFireCoordPostcode") : coordNote} /> : null}
    <PostcodeRow props={props} />
    {osm
      ? civicFooter(GB_OSM_ATTRIBUTION, GB_OSM_URL, props, "ODbL 1.0")
      : civicFooter(GB_FIRE_MHCLG_ATTRIBUTION, GB_FIRE_MHCLG_URL, props)}
  </>;
}

/** 英國法院：名稱、類別、類型原文、法律領域、FaCT 連結、地區。 */
export function GbCourtsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const place = useCivicPlace();
  const k = gbCourtKind(props.court_kind);
  return <>
    <Title color={k?.color ?? GB_COURTS_COLOR}>{gbCivicText(props.name) || t("popup.publicLife.gbCourtTitle")}</Title>
    <Row label={t("popup.publicLife.gbCourtKind")} value={k ? t(GB_COURT_KIND_KEYS[k.value]) : gbCivicText(props.court_kind)} />
    <Row label={t("popup.publicLife.gbCourtTypes")} value={gbCivicText(props.types)} />
    <Row label={t("popup.publicLife.gbCourtAreasOfLaw")} value={gbCivicText(props.areas_of_law).split("|").map((v) => v.trim()).filter(Boolean).join(", ")} />
    <LinkRow label={t("popup.publicLife.gbCourtFact")} url={gbCivicText(props.url)} />
    <Row label={t("popup.baseMap.gbNation")} value={place(props)} />
    <PostcodeRow props={props} />
    {civicFooter(GB_COURTS_ATTRIBUTION, GB_COURTS_URL, props)}
  </>;
}

// ─────────────────────────── 英國第 8 波：文化與觀光 ───────────────────────────

/** OSM 細類（subtype）對照；未對照的顯示原值。 */
const GB_CULTURE_SUBTYPE_KEYS: Readonly<Record<string, MessageKey>> = {
  history: "popup.culture.gbSubHistory", local: "popup.culture.gbSubLocal", local_history: "popup.culture.gbSubLocalHistory",
  transport: "popup.culture.gbSubTransport", railway: "popup.culture.gbSubRailway", military: "popup.culture.gbSubMilitary",
  war: "popup.culture.gbSubMilitary", art: "popup.culture.gbSubArt", technology: "popup.culture.gbSubTechnology",
  science: "popup.culture.gbSubScience", nature: "popup.culture.gbSubNature", person: "popup.culture.gbSubPerson",
  aerospace: "popup.culture.gbSubAviation", aviation: "popup.culture.gbSubAviation", archaeological: "popup.culture.gbSubArchaeological",
  maritime: "popup.culture.gbSubMaritime", living_history: "popup.culture.gbSubLivingHistory", open_air: "popup.culture.gbSubOpenAir",
  agriculture: "popup.culture.gbSubAgriculture", children: "popup.culture.gbSubChildren", public: "popup.culture.gbSubPublic",
  amphi: "popup.culture.gbSubAmphi", petting_zoo: "popup.culture.gbSubPettingZoo", wildlife_park: "popup.culture.gbSubWildlifePark",
  safari_park: "popup.culture.gbSubSafariPark", falconry: "popup.culture.gbSubFalconry", aviary: "popup.culture.gbSubAviary",
  birds: "popup.culture.gbSubAviary", farm_park: "popup.culture.gbSubFarmPark", enclosure: "popup.culture.gbSubEnclosure",
  maze: "popup.culture.gbSubMaze", garden: "popup.culture.gbSubGarden", formal_garden: "popup.culture.gbSubGarden",
};
const GB_CULTURE_FEE_KEYS: Readonly<Record<string, MessageKey>> = {
  yes: "popup.culture.gbFeeYes", no: "popup.culture.gbFeeNo", donation: "popup.culture.gbFeeDonation",
};
const GB_CULTURE_WHEELCHAIR_KEYS: Readonly<Record<string, MessageKey>> = {
  yes: "popup.culture.gbWheelchairYes", designated: "popup.culture.gbWheelchairYes", limited: "popup.culture.gbWheelchairLimited",
  no: "popup.culture.gbWheelchairNo", bad: "popup.culture.gbWheelchairNo",
};

/** 三層共用：開放時間、收費、無障礙（null＝未標示，不等於沒有）、開放對象、郵遞區號、地區、OSM／Wikidata 連結、來源。 */
function GbCultureCommonRows({ props, fee = true, postcode = true }: { props: Record<string, unknown>; fee?: boolean; postcode?: boolean }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const unmarked = t("popup.culture.gbUnmarked");
  const mapped = (raw: string, keys: Readonly<Record<string, MessageKey>>) => (!raw ? unmarked : keys[raw] ? t(keys[raw]!) : raw);
  const access = gbCultureText(props.access);
  const osm = props.source === "osm";
  const osmId = gbCultureText(props.osm_id);
  const wikidata = gbCultureText(props.wikidata);
  const nationText = gbCultureText(props.nation);
  const place = nationText ? [nation(nationText), gbCultureText(props.lad_name)].filter(Boolean).join(" · ") : t("popup.culture.gbNationUnstated");
  return <>
    <Row label={t("popup.culture.gbOpeningHours")} value={gbCultureText(props.opening_hours) || unmarked} />
    {fee ? <Row label={t("popup.culture.gbFee")} value={mapped(gbCultureText(props.fee), GB_CULTURE_FEE_KEYS)} /> : null}
    <Row label={t("popup.culture.gbWheelchair")} value={mapped(gbCultureText(props.wheelchair), GB_CULTURE_WHEELCHAIR_KEYS)} />
    {GB_CULTURE_RESTRICTED_ACCESS.has(access) ? <Row label={t("popup.culture.gbAccess")} value={t("popup.culture.gbAccessRestricted", { v: access })} /> : null}
    {postcode ? <Row label={t("popup.culture.gbPostcode")} value={gbCultureText(props.postcode) || unmarked} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    <Row label={t("popup.culture.gbSource")} value={osm ? t("popup.culture.gbSourceOsm") : t("popup.culture.gbSourceLni")} />
    {osm && osmId ? <LinkRow label="OSM" url={`https://www.openstreetmap.org/${osmId.replace(/^n/, "node/").replace(/^w/, "way/").replace(/^r/, "relation/")}`} /> : null}
    {wikidata ? <LinkRow label="Wikidata" url={`https://www.wikidata.org/wiki/${wikidata}`} /> : null}
    {osm
      ? <SourceFooter props={{ source_org: GB_OSM_ATTRIBUTION, source_url: GB_OSM_URL, license: GB_CULTURE_ODBL, fetched_at: GB_CULTURE_FETCHED_AT }} />
      : <SourceFooter props={{ source_org: GB_LIBRARIES_NI_ATTRIBUTION, source_url: GB_LIBRARIES_NI_URL, license: GB_CULTURE_OGL_V3, fetched_at: GB_CULTURE_FETCHED_AT }} />}
  </>;
}
function useCultureTitle() {
  const { t } = useLocale();
  return (props: Record<string, unknown>, kindLabel: string) => gbCultureText(props.name) || t("popup.culture.gbUnnamed", { kind: kindLabel });
}
function useSubtype() {
  const { t } = useLocale();
  return (props: Record<string, unknown>) => {
    const raw = gbCultureText(props.subtype);
    return raw.split(";").map((v) => v.trim()).filter(Boolean).map((v) => (GB_CULTURE_SUBTYPE_KEYS[v] ? t(GB_CULTURE_SUBTYPE_KEYS[v]!) : v)).join(", ");
  };
}

/** 英國文化設施：名稱、類別、細類（博物館）、共用列；北愛官方圖書館來源 Libraries NI。 */
export function GbCulturalFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const title = useCultureTitle();
  const subtype = useSubtype();
  const k = gbCulturalKind(props.kind);
  const kindLabel = k ? t(GB_CULTURAL_KIND_KEYS[k.value]) : gbCultureText(props.kind);
  return <>
    <Title color={k?.color ?? GB_CULTURAL_COLOR}>{title(props, kindLabel)}</Title>
    <Row label={t("popup.culture.gbKind")} value={kindLabel} />
    {props.source === "osm" ? <Row label={t("popup.culture.gbSubtype")} value={subtype(props)} /> : null}
    <GbCultureCommonRows props={props} />
  </>;
}

/** 英國藝文場館：名稱、類別、劇場型式（劇院）、共用列（不列收費：本層 99% 未標示）。 */
export function GbArtsVenuesPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const title = useCultureTitle();
  const subtype = useSubtype();
  const k = gbArtsKind(props.kind);
  const kindLabel = k ? t(GB_ARTS_KIND_KEYS[k.value]) : gbCultureText(props.kind);
  const form = props.kind === "theatre" ? subtype(props) : "";
  return <>
    <Title color={k?.color ?? GB_ARTS_COLOR}>{title(props, kindLabel)}</Title>
    <Row label={t("popup.culture.gbKind")} value={kindLabel} />
    <Row label={t("popup.culture.gbTheatreForm")} value={form} />
    <GbCultureCommonRows props={props} fee={false} />
  </>;
}

/** 英國觀光體驗：名稱、類別、細類（遊客中心不列）、共用列；nation 缺值（海上）顯示未載明。 */
export function GbVisitorExperiencePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const title = useCultureTitle();
  const subtype = useSubtype();
  const k = gbVisitorKind(props.kind);
  const kindLabel = k ? t(GB_VISITOR_KIND_KEYS[k.value]) : gbCultureText(props.kind);
  return <>
    <Title color={k?.color ?? GB_VISITOR_COLOR}>{title(props, kindLabel)}</Title>
    <Row label={t("popup.culture.gbKind")} value={kindLabel} />
    {props.kind !== "visitor_centre" ? <Row label={t("popup.culture.gbSubtype")} value={subtype(props)} /> : null}
    <GbCultureCommonRows props={props} postcode={false} />
  </>;
}

// ─────────────────────────── C028 公有地標售 gbSurplusLand ───────────────────────────

const GB_SURPLUS_STATUS_POPUP_KEYS: Record<GbSurplusStatus, MessageKey> = {
  not_on_market: "popup.baseMap.gbSurplusNotOnMarket", under_offer: "popup.baseMap.gbSurplusUnderOffer", on_market: "popup.baseMap.gbSurplusOnMarket",
};
const GB_SURPLUS_SECTOR_KEYS: Record<GbSurplusSector, MessageKey> = {
  nhs: "popup.baseMap.gbSurplusSectorNhs", wales_public: "popup.baseMap.gbSurplusSectorWales", central_civil: "popup.baseMap.gbSurplusSectorCentral",
  mod: "popup.baseMap.gbSurplusSectorMod", scottish_gov: "popup.baseMap.gbSurplusSectorScotland",
};
/** 數值欄 null／非數值不顯示（不寫 0）。 */
const surplusNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** 英國公有地標售：名稱、地址、標售進度、持有機關、用途、面積（null 不顯示）、產權編號、定位精度與來源。 */
export function GbSurplusLandPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const status = gbSurplusStatus(props.sale_status);
  const statusLabel = status ? t(GB_SURPLUS_STATUS_POPUP_KEYS[status.value]) : text(props.sale_status);
  const sector = text(props.sector) as GbSurplusSector;
  const sectorLabel = GB_SURPLUS_SECTORS.includes(sector) ? t(GB_SURPLUS_SECTOR_KEYS[sector]) : text(props.sector);
  const org = [text(props.parent_org), text(props.organisation)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  const address = [text(props.address), text(props.postcode)].filter(Boolean).join(" ");
  const land = surplusNumber(props.land_area_ha);
  const floor = surplusNumber(props.floor_area_m2);
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={GB_SURPLUS_COLOR}>{text(props.name) || t("popup.baseMap.gbSurplusUnnamed")}</Title>
    <Row label={t("popup.baseMap.gbSurplusAddress")} value={address} />
    <Row label={t("popup.baseMap.gbSurplusStatus")} value={statusLabel} />
    <Row label={t("popup.baseMap.gbSurplusSector")} value={sectorLabel} />
    <Row label={t("popup.baseMap.gbSurplusOrg")} value={org} />
    <Row label={t("popup.baseMap.gbSurplusUsage")} value={text(props.land_usage)} />
    <Row label={t("popup.baseMap.gbSurplusLandArea")} value={land == null ? "" : `${formatNumber(land, { maximumFractionDigits: 2 })} ${t("popup.baseMap.gbSurplusHa")}`} />
    <Row label={t("popup.baseMap.gbSurplusFloorArea")} value={floor == null ? "" : `${formatNumber(floor, { maximumFractionDigits: 0 })} m²`} />
    {land != null || floor != null ? <Row label="" value={t("popup.baseMap.gbSurplusUnitNote")} /> : null}
    <Row label={t("popup.baseMap.gbSurplusTitleNo")} value={text(props.lr_title_no)} />
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    {props.precision === GB_SURPLUS_POSTCODE_PRECISION ? <Row label="" value={t("popup.baseMap.gbSurplusPostcodeNote")} /> : null}
    {sector === "mod" ? <Row label="" value={t("popup.baseMap.gbSurplusModNote")} /> : null}
    <Row label={t("popup.baseMap.gbSurplusSourceDate")} value={GB_SURPLUS_SOURCE_DATE} />
    <SourceFooter props={{ source_org: `${GB_SURPLUS_ATTRIBUTION} · ${ONSPD_ORG}`, source_url: GB_SURPLUS_SOURCE_URL, license: GB_SURPLUS_LICENSE, fetched_at: GB_SURPLUS_FETCHED_AT }} />
  </>;
}

// ─────────────────────────── 第 9 波災害地質 ───────────────────────────

/** 數值欄 null／非數值 → null（不寫 0）。 */
const hazardNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** GeoSure 地質災害易發性：災害、易發性（中文＋原文）、advisory、國家尺度提醒。 */
export function GbGroundStabilityPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const hazard = gbGeoHazard(props.hazard);
  const susc = gbSusceptibility(props.susceptibility);
  const suscText = susc ? t(GB_SUSCEPTIBILITY_KEYS[susc.value]) : "";
  // 英文介面的中文標籤與原文相同時不重複括號
  const suscLabel = !susc ? text(props.susceptibility) || t("popup.hazard.gbNoData")
    : suscText === susc.value ? suscText : t("popup.hazard.gbWithOriginal", { label: suscText, original: susc.value });
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={susc?.color ?? GB_GEOSURE_COLOR}>{t("popup.hazard.gbGeoSureTitle")}</Title>
    <Row label={t("popup.hazard.gbGeoHazard")} value={hazard ? t(GB_GEO_HAZARD_KEYS[hazard.value]) : text(props.hazard_zh) || text(props.hazard)} />
    <Row label={t("popup.hazard.gbSusceptibility")} value={suscLabel} />
    {/* advisory：整格分級較低但格內局部有顯著；整格已是顯著時不重複 */}
    {text(props.advisory) && susc?.value !== "Significant" ? <Row label="" value={t("popup.hazard.gbAdvisory")} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.hazard.gbGeoSureNotice")} />
    <SourceFooter props={{ source_org: GB_GEOSURE_ATTRIBUTION, source_url: GB_GEOSURE_URL, license: GB_BGS_OGL, fetched_at: GB_HAZARD_FETCHED_AT }} />
  </>;
}

const GB_LANDSLIDE_CHECK_KEYS: Record<string, MessageKey> = {
  Y: "popup.hazard.gbCheckedY", N: "popup.hazard.gbCheckedN", U: "popup.hazard.gbCheckedU",
};

/** 山崩紀錄：名稱、地點、位置精度、BGS 複核、首次／最後已知年份（null＝未知）。 */
export function GbLandslidePanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const acc = hazardNumber(props.location_accuracy_m);
  const check = text(props.grid_checked_by_bgs);
  const year = (v: unknown) => text(v) || t("popup.hazard.gbUnknown");
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ") || t("popup.hazard.gbNoData");
  return <>
    <Title color={GB_LANDSLIDE_COLOR}>{text(props.name) || t("popup.hazard.gbLandslideUnnamed")}</Title>
    <Row label={t("popup.hazard.gbLocality")} value={text(props.locality).replace(/^[,\s]+/, "")} />
    <Row label={t("popup.hazard.gbAccuracy")} value={acc == null ? t("popup.hazard.gbNoData") : t("popup.hazard.gbAccuracyValue", { m: formatNumber(acc) })} />
    <Row label={t("popup.hazard.gbChecked")} value={GB_LANDSLIDE_CHECK_KEYS[check] ? t(GB_LANDSLIDE_CHECK_KEYS[check]!) : t("popup.hazard.gbNoData")} />
    <Row label={t("popup.hazard.gbFirstYear")} value={year(props.first_known_year)} />
    <Row label={t("popup.hazard.gbLastYear")} value={year(props.last_known_year)} />
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.hazard.gbRecordNote")} />
    <SourceFooter props={{ source_org: GB_LANDSLIDE_ATTRIBUTION, source_url: GB_LANDSLIDE_URL, license: GB_BGS_OGL, fetched_at: GB_HAZARD_FETCHED_AT }} />
  </>;
}

/** 氡氣指示圖：格網代碼、分級與比例區間、指示性提醒。 */
export function GbRadonPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const cls = gbRadonClass(props.radon_class);
  return <>
    <Title color={GB_RADON_COLOR}>{t("popup.hazard.gbRadonTitle")}</Title>
    <Row label={t("popup.hazard.gbGridTile")} value={text(props.tile)} />
    <Row label={t("popup.hazard.gbRadonBand")} value={cls ? t("popup.hazard.gbRadonClassValue", { c: cls.value, band: cls.band }) : t("popup.hazard.gbNoData")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.hazard.gbRadonNote")} />
    <SourceFooter props={{ source_org: GB_RADON_ATTRIBUTION, source_url: GB_RADON_URL, license: GB_BGS_OGL, fetched_at: GB_HAZARD_FETCHED_AT }} />
  </>;
}

/** 加馬劑量率固定站：站名、月平均（最小／最大）、讀數筆數、期間；缺值寫「未標示／無資料」。 */
export function GbRadiationPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const mean = hazardNumber(props.dose_mean);
  const min = hazardNumber(props.dose_min);
  const max = hazardNumber(props.dose_max);
  const n = hazardNumber(props.readings_n);
  const f = (v: number | null) => (v == null ? "—" : formatNumber(v, { maximumFractionDigits: 4 }));
  const unit = text(props.units) || GB_GAMMA_UNIT;
  const range = [text(props.first_reading), text(props.last_reading)].filter(Boolean).map((v) => v.replace("T", " ")).join(" – ");
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={gbGammaColor(mean) ?? GB_GAMMA_COLOR}>{text(props.monitor_location) || text(props.station_id)}</Title>
    <Row label={t("popup.hazard.gbGammaMean")} value={mean == null ? t("popup.hazard.gbNoData") : t("popup.hazard.gbGammaMeanValue", { mean: f(mean), min: f(min), max: f(max), unit })} />
    <Row label={t("popup.hazard.gbGammaReadings")} value={n == null ? t("popup.hazard.gbNoData") : formatNumber(n)} />
    <Row label={t("popup.hazard.gbGammaPeriod")} value={range || text(props.period)} />
    <Row label={t("popup.hazard.gbGammaNetwork")} value={text(props.network)} />
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.hazard.gbGammaNote")} />
    <SourceFooter props={{ source_org: GB_GAMMA_ATTRIBUTION, source_url: GB_GAMMA_URL, license: GB_DESNZ_OGL_V3, fetched_at: GB_HAZARD_FETCHED_AT }} />
  </>;
}

/** 地震目錄：時間（儀器記錄到分、歷史地震只到日、原字串）、規模＋類型、深度、震度、地點、海上／陸上。 */
export function GbEarthquakesPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const historical = props.catalogue === "historical";
  const mag = hazardNumber(props.magnitude);
  const depth = hazardNumber(props.depth_km);
  const when = historical ? text(props.date) : text(props.datetime_utc).replace("T", " ").replace(/Z$/, " UTC");
  const offshore = props.setting === "offshore";
  // 上游把歷史地震的 BGS 綜合規模寫成「BGS MAG（綜合）」中文字串 → 顯示層依語系翻
  const magType = text(props.mag_type).startsWith("BGS MAG") ? t("popup.hazard.gbMagTypeBgs") : text(props.mag_type);
  const place = offshore ? t("popup.hazard.gbOffshore") : [t("popup.hazard.gbOnshore"), nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={GB_QUAKE_COLOR}>{t(historical ? "popup.hazard.gbQuakeTitleHistorical" : "popup.hazard.gbQuakeTitleInstrumental")}</Title>
    <Row label={t(historical ? "popup.hazard.gbQuakeDate" : "popup.hazard.gbQuakeTime")} value={when || t("popup.hazard.gbNoData")} />
    <Row label={t("popup.hazard.gbQuakeMag")} value={mag == null ? t("popup.hazard.gbQuakeMagUnknown") : `${formatNumber(mag, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${magType ? ` (${magType})` : ""}`} />
    <Row label={t("popup.hazard.gbQuakeDepth")} value={depth == null ? t("popup.hazard.gbNoData") : t("popup.hazard.gbQuakeDepthValue", { km: formatNumber(depth, { maximumFractionDigits: 1 }) })} />
    {historical ? <Row label={t("popup.hazard.gbQuakeIntensity")} value={text(props.intensity)} /> : null}
    {historical ? <Row label={t("popup.hazard.gbLocality")} value={text(props.locality)} /> : null}
    <Row label={t("popup.hazard.gbQuakeSetting")} value={place} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.hazard.gbQuakeDataEnd", { date: GB_QUAKE_DATA_END })} />
    <SourceFooter props={{ source_org: GB_QUAKE_ATTRIBUTION, source_url: GB_QUAKE_URL, license: GB_BGS_OGL, fetched_at: GB_HAZARD_FETCHED_AT }} />
  </>;
}

// ─────────────────────────── 第 11 波環境與規劃 ───────────────────────────

/** 數值欄 null／非數值 → null（不寫 0）。 */
const envNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
/** 日期欄只取 YYYY-MM-DD。 */
/** 上游 pandas 缺值字串（NaT／NaN／None）當成未載明，不顯示原字。 */
const envDate = (value: unknown) => (/^(NaT|NaN|None)$/i.test(text(value)) ? "" : text(value).slice(0, 10));

/** 規劃限制區：名稱、類別、指定機關、指定日（null「未載明」）、綠帶核心區、編號。 */
export function GbPlanningConstraintsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const c = gbPlanningConstraint(props.constraint);
  const src = GB_PLANNING_SOURCES[text(props.source) as keyof typeof GB_PLANNING_SOURCES];
  const url = props.source === "planning_data" && c ? GB_PLANNING_SOURCE_URLS[c.value] : src?.url ?? "";
  const place = [nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ");
  return <>
    <Title color={c?.color ?? GB_PLANNING_COLOR}>{text(props.name) || t("popup.environmentLayer.gbUnnamed")}</Title>
    <Row label={t("popup.environmentLayer.gbPlanCategory")} value={c ? t(GB_PLANNING_CONSTRAINT_KEYS[c.value]) : text(props.constraint)} />
    <Row label={t("popup.environmentLayer.gbPlanOrg")} value={text(props.organisation) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbPlanStart")} value={envDate(props.start_date) || t("popup.environmentLayer.gbNotStated")} />
    {c?.value === "green_belt" ? <Row label={t("popup.environmentLayer.gbPlanGreenBeltCore")} value={text(props.green_belt_core) || t("popup.environmentLayer.gbNotStated")} /> : null}
    <Row label={t("popup.environmentLayer.gbReference")} value={text(props.reference)} />
    <Row label={t("popup.baseMap.gbNation")} value={place} />
    <SourceFooter props={{ source_org: src?.org ?? "", source_url: url, license: GB_ENV_OGL_V3, fetched_at: GB_ENV_FETCHED_AT }} />
  </>;
}

const GB_OWNERSHIP_KEYS: Record<GbBrownfieldOwnership, MessageKey> = {
  public: "popup.environmentLayer.gbBfOwnPublic",
  not_public: "popup.environmentLayer.gbBfOwnNotPublic",
  mixed: "popup.environmentLayer.gbBfOwnMixed",
  unknown: "popup.environmentLayer.gbBfOwnUnknown",
};

/** 棕地登記冊：場址、地址、面積、可建戶數、所有權、許可狀態與類型、LPA；固定註明面積為 LPA 原填值。 */
export function GbBrownfieldPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const status = gbBrownfieldStatus(props.permission_status);
  const ha = envNumber(props.hectares);
  const min = envNumber(props.min_net_dwellings);
  const max = envNumber(props.max_net_dwellings);
  const f = (v: number) => formatNumber(v, { maximumFractionDigits: 0 });
  const dwellings = min == null && max == null ? t("popup.environmentLayer.gbNotStated")
    : min != null && max != null && min !== max ? t("popup.environmentLayer.gbBfDwellingsRange", { min: f(min), max: f(max) })
      : t("popup.environmentLayer.gbBfDwellingsValue", { n: f((min ?? max)!) });
  const own = text(props.ownership) as GbBrownfieldOwnership;
  const ownLabel = GB_BROWNFIELD_OWNERSHIP.includes(own) ? t(GB_OWNERSHIP_KEYS[own]) : t("popup.environmentLayer.gbNotStated");
  const permission = [t(GB_BROWNFIELD_STATUS_KEYS[status.value]), text(props.permission_type)].filter(Boolean).join(" · ");
  return <>
    <Title color={GB_BROWNFIELD_COLOR}>{text(props.site_address) || text(props.name) || t("popup.environmentLayer.gbUnnamed")}</Title>
    <Row label={t("popup.environmentLayer.gbReference")} value={text(props.reference) || text(props.name)} />
    <Row label={t("popup.environmentLayer.gbBfArea")} value={ha == null ? t("popup.environmentLayer.gbNotStated") : t("popup.environmentLayer.gbBfHa", { v: formatNumber(ha, { maximumFractionDigits: 2 }) })} />
    <Row label={t("popup.environmentLayer.gbBfDwellings")} value={dwellings} />
    <Row label={t("popup.environmentLayer.gbBfOwnership")} value={ownLabel} />
    <Row label={t("popup.environmentLayer.gbBfStatus")} value={permission} />
    <Row label={t("popup.environmentLayer.gbBfDate")} value={envDate(props.permission_date) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbBfLpa")} value={text(props.organisation)} />
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.environmentLayer.gbBfHectaresNote")} />
    <SourceFooter props={{ source_org: GB_BROWNFIELD_ATTRIBUTION, source_url: GB_BROWNFIELD_URL, license: GB_ENV_OGL_V3, fetched_at: GB_ENV_FETCHED_AT }} />
  </>;
}

const GB_YES_NO_KEYS: Record<string, MessageKey> = {
  yes: "popup.environmentLayer.gbYes", no: "popup.environmentLayer.gbNo", limited: "popup.environmentLayer.gbLimited",
};

/** 回收點（OSM）：名稱（null「未命名」）、類別、開放時間、收費、無障礙；固定一行 OSM 完整度說明。 */
export function GbRecyclingCentresPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const kind = gbRecyclingKind(props.kind);
  const yn = (v: unknown) => (GB_YES_NO_KEYS[text(v)] ? t(GB_YES_NO_KEYS[text(v)]!) : text(v) || t("popup.environmentLayer.gbNotStated"));
  return <>
    <Title color={kind?.color ?? GB_RECYCLING_COLOR}>{text(props.name) || t("popup.environmentLayer.gbUnnamed")}</Title>
    <Row label={t("popup.environmentLayer.gbCategory")} value={kind ? t(GB_RECYCLING_KIND_KEYS[kind.value]) : text(props.kind)} />
    <Row label={t("popup.environmentLayer.gbRecHours")} value={text(props.opening_hours) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbRecFee")} value={yn(props.fee)} />
    <Row label={t("popup.environmentLayer.gbRecWheelchair")} value={yn(props.wheelchair)} />
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.environmentLayer.gbRecOsmNote")} />
    <SourceFooter props={{ source_org: GB_RECYCLING_ATTRIBUTION, source_url: GB_RECYCLING_URL, license: GB_ENV_ODBL, fetched_at: GB_ENV_FETCHED_AT }} />
  </>;
}

/** 廢棄物處理許可：場址、設施類型（null 用設施代碼）、許可編號、狀態、發證日、主管機關；無持有人欄。 */
export function GbWastePermitsPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const authority = gbWasteAuthority(props.authority);
  const issued = envDate(props.issued);
  const size = text(props.size_band);
  return <>
    <Title color={GB_WASTE_PERMITS_COLOR}>{text(props.site_name) || t("popup.environmentLayer.gbUnnamed")}</Title>
    <Row label={t("popup.environmentLayer.gbWasteFacility")} value={text(props.facility_type) || text(props.facility_code) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbWastePermitRef")} value={text(props.permit_ref)} />
    <Row label={t("popup.environmentLayer.gbWasteStatus")} value={text(props.status)} />
    <Row label={t("popup.environmentLayer.gbWasteIssued")} value={issued && issued !== GB_WASTE_ISSUED_PLACEHOLDER ? issued : t("popup.environmentLayer.gbNotStated")} />
    {size && size !== "Data Unavailable" ? <Row label={t("popup.environmentLayer.gbWasteSize")} value={size} /> : null}
    <Row label={t("popup.environmentLayer.gbWasteAuthority")} value={text(props.authority)} />
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.site_town) || text(props.lad_name)].filter(Boolean).join(" · ")} />
    {props.authority === "NIEA" ? <Row label="" value={t("popup.environmentLayer.gbWasteNiSnapshot")} /> : null}
    {authority ? <SourceFooter props={{ source_org: authority.attribution, source_url: authority.url, license: authority.license, fetched_at: GB_ENV_FETCHED_AT }} /> : null}
  </>;
}

/** 污染排放申報（蘇格蘭 SEPA SPRI 2017）：場址、部門、活動、年份、空氣／水體是否申報排放、申報書連結。 */
export function GbPollutionInventoryPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const release = (v: unknown) => (v === "yes" ? t("popup.environmentLayer.gbPolYes") : v === "no" ? t("popup.environmentLayer.gbPolNo") : t("popup.environmentLayer.gbPolNotReported"));
  return <>
    <Title color={GB_POLLUTION_COLOR}>{text(props.site_name) || text(props.site_ref)}</Title>
    <Row label={t("popup.environmentLayer.gbPolSector")} value={text(props.sector) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbPolActivity")} value={text(props.activity) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbPolYear")} value={text(props.year)} />
    <Row label={t("popup.environmentLayer.gbPolAir")} value={release(props.release_air)} />
    <Row label={t("popup.environmentLayer.gbPolWater")} value={release(props.release_water)} />
    <LinkRow label={t("popup.environmentLayer.gbPolReturn")} url={text(props.return_url)} />
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.environmentLayer.gbPolNote")} />
    <SourceFooter props={{ source_org: GB_POLLUTION_ATTRIBUTION, source_url: GB_POLLUTION_URL, license: GB_POLLUTION_LICENSE, fetched_at: GB_ENV_FETCHED_AT }} />
  </>;
}

/** 策略噪音：來源（道路／鐵路）、Lden 帶、模型輪次；固定一行模型估計說明。 */
export function GbNoisePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const band = gbNoiseBand(props.band_min_db);
  const src = GB_NOISE_SOURCES[text(props.source) as keyof typeof GB_NOISE_SOURCES];
  const round = text(props.round);
  return <>
    <Title color={band?.color ?? GB_NOISE_COLOR}>{t(props.noise_source === "rail" ? "popup.environmentLayer.gbNoiseRail" : "popup.environmentLayer.gbNoiseRoad")}</Title>
    <Row label={t("popup.environmentLayer.gbNoiseBand")} value={band ? `${band.label} dB(A)` : text(props.band) || t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.environmentLayer.gbNoiseRound")} value={round === "Round 4" ? t("popup.environmentLayer.gbNoiseRound4") : round ? t("popup.environmentLayer.gbNoiseRound3") : t("popup.environmentLayer.gbNotStated")} />
    <Row label={t("popup.baseMap.gbNation")} value={nation(props.nation)} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.environmentLayer.gbNoiseNote")} />
    {src ? <SourceFooter props={{ source_org: src.org, source_url: src.url, license: "Open Government Licence", fetched_at: GB_ENV_FETCHED_AT }} /> : null}
  </>;
}

// ─────────────────────────── 第 12 波：公司登記、製造業、殯葬、養殖、土壤 ───────────────────────────

const w12Number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** 公司登記／製造業：只有郵遞區號 district 聚合數字（無公司名、無個資）。 */
function GbCompanyDistrictPanel({ props, manufacturing }: { props: Record<string, unknown>; manufacturing: boolean }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const count = (v: unknown) => {
    const x = w12Number(v);
    return x == null ? t("popup.funeral.gbNotStated") : t("popup.businessRegistry.gbCoCount", { n: formatNumber(x) });
  };
  const top = gbTopSicSections(props);
  const share = w12Number(props.top_postcode_share);
  return <>
    <Title color={manufacturing ? GB_MANUFACTURING_COLOR : GB_COMPANIES_COLOR}>{t("popup.businessRegistry.gbCoTitle", { d: text(props.postcode_district) })}</Title>
    {manufacturing ? <Row label={t("popup.businessRegistry.gbCoMfg")} value={count(props.c_C)} /> : null}
    <Row label={t("popup.businessRegistry.gbCoTotal")} value={count(props.total)} />
    <Row label={t("popup.businessRegistry.gbCoActive")} value={count(props.active)} />
    <Row label={t("popup.businessRegistry.gbCoTopSic")} value={top.map((s) => `${t(GB_SIC_SECTION_KEYS[s.section])} ${formatNumber(s.count)}`).join("、")} />
    <Row label={t("popup.businessRegistry.gbCoDormant")} value={count(props.c_dormant)} />
    <Row label={t("popup.businessRegistry.gbCoNoSic")} value={count(props.c_none)} />
    <Row label={t("popup.businessRegistry.gbCoArea")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.businessRegistry.gbCoSnapshot")} value={text(props.snapshot)} />
    {share != null && share > GB_COMPANIES_AGENT_SHARE ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.businessRegistry.gbCoAgentWarn")} /> : null}
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.businessRegistry.gbCoAggNote")} />
    <SourceFooter props={{ source_org: GB_COMPANIES_ATTRIBUTION, source_url: GB_COMPANIES_URL, license: GB_COMPANIES_LICENSE, fetched_at: GB_W12_FETCHED_AT }} />
  </>;
}
export function GbCompaniesPanel({ props }: { props: Record<string, unknown> }) {
  return <GbCompanyDistrictPanel props={props} manufacturing={false} />;
}
export function GbManufacturingPanel({ props }: { props: Record<string, unknown> }) {
  return <GbCompanyDistrictPanel props={props} manufacturing />;
}

const GB_W12_YES_NO_KEYS: Record<string, MessageKey> = {
  yes: "popup.funeral.gbYes", no: "popup.funeral.gbNo", limited: "popup.funeral.gbLimited",
};

/** 殯葬設施（OSM）：名稱（null「未命名」）、類別、開放時間、輪椅可及、郵遞區號；固定一行 OSM 完整度說明。 */
export function GbFuneralPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const nation = useNationLabel();
  const kind = gbFuneralKind(props.kind);
  const notStated = t("popup.funeral.gbNotStated");
  const wc = text(props.wheelchair);
  return <>
    <Title color={kind?.color ?? GB_FUNERAL_COLOR}>{text(props.name) || t("popup.funeral.gbUnnamed")}</Title>
    <Row label={t("popup.funeral.gbKind")} value={kind ? t(GB_FUNERAL_KIND_KEYS[kind.value]) : text(props.kind)} />
    <Row label={t("popup.funeral.gbHours")} value={text(props.opening_hours) || notStated} />
    <Row label={t("popup.funeral.gbWheelchair")} value={GB_W12_YES_NO_KEYS[wc] ? t(GB_W12_YES_NO_KEYS[wc]!) : wc || notStated} />
    <Row label={t("popup.funeral.gbPostcode")} value={text(props.postcode) || notStated} />
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.funeral.gbOsmNote")} />
    <SourceFooter props={{ source_org: GB_FUNERAL_ATTRIBUTION, source_url: GB_FUNERAL_URL, license: GB_W12_ODBL, fetched_at: GB_W12_FETCHED_AT }} />
  </>;
}

const GB_AQ_WATER_TYPE_KEYS: Record<string, MessageKey> = {
  freshwater: "popup.agri.gbAqFreshwater", seawater: "popup.agri.gbAqSeawater", both: "popup.agri.gbAqBoth",
};

/** 養殖場：場址名（北愛為許可編號）、類別、狀態、水域、物種、設施、管理區、面積（北愛）、官方場址頁（蘇格蘭）。 */
export function GbAquaculturePanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const kind = gbAquacultureKind(props.kind);
  const status = gbAquacultureStatus(props.status);
  const isNi = props.source === "ni_daera";
  const src = GB_AQUACULTURE_SOURCES[text(props.source) as keyof typeof GB_AQUACULTURE_SOURCES];
  const notStated = t("popup.agri.gbNotStated");
  const list = (v: unknown) => gbSplitList(v).join("、") || notStated;
  const water = text(props.water_type);
  const ha = w12Number(props.area_ha);
  return <>
    <Title color={kind?.color ?? GB_AQUACULTURE_COLOR}>{text(props.name) || text(props.site_id)}</Title>
    <Row label={t(isNi ? "popup.agri.gbAqLicenceNo" : "popup.agri.gbAqSite")} value={isNi ? text(props.name) : text(props.site_id)} />
    <Row label={t("popup.agri.gbAqKind")} value={kind ? t(GB_AQUACULTURE_KIND_KEYS[kind.value]) : text(props.kind)} />
    <Row label={t("popup.agri.gbAqStatus")} value={status ? t(GB_AQUACULTURE_STATUS_KEYS[status.value]) : text(props.status) || notStated} />
    {status?.value === "deregistered" ? <Row label={t("popup.baseMap.gbNotes")} value={t("popup.agri.gbAqDeregWarn")} /> : null}
    <Row label={t("popup.agri.gbAqWater")} value={GB_AQ_WATER_TYPE_KEYS[water] ? t(GB_AQ_WATER_TYPE_KEYS[water]!) : water || notStated} />
    <Row label={t("popup.agri.gbAqSpecies")} value={list(props.species)} />
    {isNi ? null : <Row label={t("popup.agri.gbAqFacilities")} value={list(props.facilities)} />}
    {isNi ? null : <Row label={t("popup.agri.gbAqMgmt")} value={text(props.mgmt_area) || notStated} />}
    {isNi ? <Row label={t("popup.agri.gbAqArea")} value={ha == null ? notStated : t("popup.agri.gbAqHa", { v: formatNumber(ha, { maximumFractionDigits: 2 }) })} /> : null}
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <LinkRow label={t("popup.agri.gbAqDetail")} url={text(props.detail_url)} />
    <SourceFooter props={{ source_org: src?.org ?? GB_AQUACULTURE_ATTRIBUTION, source_url: src?.url ?? "", license: GB_W12_OGL_V3, fetched_at: GB_W12_FETCHED_AT }} />
  </>;
}

/** 土壤母質：母質、質地、土壤群、土層深度、碳酸鹽、粒徑（BGS 原文）；固定一行模型推估說明。 */
export function GbSoilParentMaterialPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const nation = useNationLabel();
  const theme = useFeatureTheme();
  const idx = gbSoilDepthIndex(props.soil_depth);
  const notStated = t("popup.agri.gbNotStated");
  const raw = (v: unknown) => { const s = text(v); return s && s !== "NA" ? s : notStated; };
  const depthKey = idx >= 0 ? GB_SOIL_DEPTH_KEYS[text(props.soil_depth) as keyof typeof GB_SOIL_DEPTH_KEYS] : null;
  const km2 = w12Number(props.area_km2);
  return <>
    <Title color={idx >= 0 ? gbSoilDepthColors(theme !== LIGHT_FEATURE)[idx]! : GB_SOIL_COLOR}>{raw(props.parent_material)}</Title>
    <Row label={t("popup.agri.gbSoilDepth")} value={depthKey ? t(depthKey) : t("legend.agri.gbSoilNa")} />
    <Row label={t("popup.agri.gbSoilTexture")} value={raw(props.soil_texture)} />
    <Row label={t("popup.agri.gbSoilGroup")} value={raw(props.soil_group)} />
    <Row label={t("popup.agri.gbSoilCarbonate")} value={raw(props.carbonate)} />
    <Row label={t("popup.agri.gbSoilGrain")} value={raw(props.grain_size)} />
    {km2 == null ? null : <Row label={t("popup.agri.gbSoilArea")} value={t("popup.agri.gbSoilKm2", { v: formatNumber(km2, { maximumFractionDigits: 1 }) })} />}
    <Row label={t("popup.baseMap.gbNation")} value={[nation(props.nation), text(props.lad_name)].filter(Boolean).join(" · ")} />
    <Row label={t("popup.baseMap.gbNotes")} value={t("popup.agri.gbSoilModelNote")} />
    <SourceFooter props={{ source_org: GB_SOIL_ATTRIBUTION, source_url: GB_SOIL_URL, license: GB_W12_OGL_V3, fetched_at: GB_W12_FETCHED_AT }} />
  </>;
}
