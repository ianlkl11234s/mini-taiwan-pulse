// 英國圖層 popup（2026-10-29 第 0b 波起）。來源與授權由 panel 自掛 SourceFooter（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
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
} from "../../data/gbTransportTypes";
import { LinkRow } from "./atlasPanels";
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
    <Row label="" value={t("popup.transport.gbRailColorNote")} />
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
