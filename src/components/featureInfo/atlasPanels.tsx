import type { FC } from "react";
import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import { displayRocYear, enumLabel } from "../../i18n/dataText";
import { placeName, placeNameList, placeTown } from "../../i18n/placeText";
import {
  ANIMAL_STATUS_OPTIONS, ATLAS_FLAG_COLOR, ATLAS_LAYER_COLORS, BEACH_LEVEL_OPTIONS, DREDGING_STATUS_OPTIONS, FLOOD_INFO_SOURCE_OPTIONS,
  FREEWAY_SIGN_GROUP_OPTIONS, GATE_KIND_OPTIONS, INTERCHANGE_TYPE_OPTIONS, ISOLATION_CAUSE_OPTIONS, MONITOR_SERIES_OPTIONS,
  PLACE_CATEGORY_OPTIONS, POLLUTION_LEVEL_OPTIONS, ROAD_SIGN_SERIES_OPTIONS, RURAL_COMMUNITY_OPTIONS, STRUCTURE_CATEGORY_OPTIONS,
  SWCB_PHOTO_CATEGORY_OPTIONS, TRIANGULATION_GRADE_OPTIONS, COASTAL_AREA_TYPE_OPTIONS, TRIBE_ETHNIC_OPTIONS, TRIBE_NOT_APPROVED_COLOR, TURTLE_SPECIES_OPTIONS,
  CULTURE_COIN_CATEGORY_OPTIONS, CULTURE_COIN_PRECISION_LABELS, CULTURAL_HEALTH_PRECISION_LABELS,
  TWC_OFFICE_TYPE_OPTIONS, TWC_FACILITY_TYPE_OPTIONS, STATE_TENDER_KIND_OPTIONS,
  ATM_INSTITUTION_OPTIONS, BRANCH_CATEGORY_OPTIONS, SECURITIES_TYPE_OPTIONS, INSURANCE_TYPE_OPTIONS, FINANCE_SOURCE_DATE_LABELS,
  optionColor, type AtlasLayerKey,
} from "../../data/atlasLayerTypes";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { LAND_SUBSIDENCE_PANELS } from "./landSubsidencePanels";

/**
 * atlas 批次 2026-10 的 26 層 popup。來源 footer 由 FeatureInfoPanel 統一掛（每筆都帶
 * source_org／source_url／license／fetched_at）；這裡顯示上游中文 `<欄>_label`、座標精度
 * （`precision_note`，旗標原值另列）與資料日期（vintage）。
 * 上游烘進資料的中文（類別 label、precision_note、vintage）依類別代碼／原句查 enums.atlas.json 翻譯，
 * 查不到就顯示中文原值；自由文字（處置、通報者、河名…）是資料值，不翻。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const fmt = (v: unknown, digits: number, unit: string, { formatNumber }: LocaleSnapshot): string => {
  const n = num(v);
  return n == null ? "" : `${formatNumber(n, { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
};
const yesNo = (v: unknown, yes: string, no: string): string => (v === true ? yes : v === false ? no : "");
const admin = (p: Record<string, unknown>, i18n: LocaleSnapshot) =>
  [placeName(`${str(p.county)}${str(p.town)}`, i18n), str(p.village)].filter(Boolean).join(i18n.active === "zh-TW" ? "" : " ");
const time = (v: unknown) => str(v).replace("T", " ").slice(0, 16);

/** 類別代碼 → 目前語系的標籤；`zh` 是上游給的中文 label（中文介面原樣顯示）。 */
const enumOf = (domain: string, code: unknown, zh: unknown, i18n: LocaleSnapshot): string => enumLabel(domain, str(code), str(zh), i18n);
/** 「、」串起來的多個代碼（多族並列）逐一翻譯 */
const enumList = (domain: string, value: unknown, i18n: LocaleSnapshot): string =>
  str(value).split("、").filter(Boolean).map((code) => enumOf(domain, code, code, i18n)).join(i18n.t("popup.common.listSeparator"));

/** 上游烘進資料的座標精度說明（中文句子）→ 目前語系；含數字的句型用 regex 拆開再套模板。 */
function precisionPart(part: string, i18n: LocaleSnapshot): string {
  const decimals = part.match(/^約 ±([\d,]+) m（來源座標小數 (\d+) 位）$/);
  if (decimals) return i18n.t("popup.atlas.precDecimals", { n: decimals[1]!, decimals: decimals[2]! });
  const twd67 = part.match(/^約 ±([\d,]+) m（TWD67 度分秒 → WGS84 七參數）$/);
  if (twd67) return i18n.t("popup.atlas.precTwd67", { n: twd67[1]! });
  const dms = part.match(/^(.+)（度分秒換算）$/);
  if (dms) return i18n.t("popup.atlas.precDms", { base: precisionPart(dms[1]!, i18n) });
  return enumLabel("atlasPrecision", part, part, i18n);
}
function precisionText(note: string, i18n: LocaleSnapshot): string {
  if (i18n.active === "zh-TW" || !note) return note;
  const whole = i18n.lookup(`enum.atlasPrecision.${note}`);
  if (whole) return whole;
  return note.split("；").map((part) => precisionPart(part, i18n)).join(i18n.t("popup.common.semicolon"));
}

/** 資料日期（vintage）：只翻上游固定句型，其餘（來源自己給的字串）原樣顯示。 */
function vintageText(vintage: string, i18n: LocaleSnapshot): string {
  if (i18n.active === "zh-TW" || !vintage) return vintage;
  const points = vintage.match(/^點位 (.+)；核定名單 (.+)$/);
  if (points) return i18n.t("popup.atlas.vintagePoints", { points: points[1]!, approved: points[2]! });
  const register = vintage.match(/^(\d+) 年度清冊（(.+)）$/);
  if (register) return i18n.t("popup.atlas.vintageRegister", { year: displayRocYear(register[1]!, i18n), vintage: register[2]! });
  const survey = vintage.match(/^現場調查 (.+)$/);
  if (survey) return i18n.t("popup.atlas.vintageSurvey", { date: survey[1]! });
  const statistics = vintage.match(/^統計日期 (.+)$/);
  if (statistics) return i18n.t("popup.atlas.vintageStatistics", { date: statistics[1]! });
  return vintage;
}

/** 座標精度列：疑誤旗標用警示色 */
function Precision({ props, flagged = false }: Props & { flagged?: boolean }) {
  const theme = useFeatureTheme();
  const i18n = useLocale();
  return <Row field="coordPrecision" value={precisionText(str(props.precision_note), i18n)} color={flagged ? theme.warn : undefined} />;
}
const DataDate = ({ props }: Props) => {
  const i18n = useLocale();
  return <Row field="dataDate" value={vintageText(str(props.vintage), i18n)} mono />;
};

function IndigenousTribePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const approved = props.in_current_approved_list;
  const color = approved === false ? TRIBE_NOT_APPROVED_COLOR : optionColor(TRIBE_ETHNIC_OPTIONS, props.ethnic_group);
  const approvedYear = num(props.approved_roc_year) != null ? t("popup.atlas.approvedYear", { year: displayRocYear(String(props.approved_roc_year), i18n) }) : "";
  return <>
    <Title color={color}>{str(props.name) || t("popup.atlas.tribeTitle")}</Title>
    <Row label={t("popup.atlas.tribeNameRoman")} value={str(props.tribe_name_roman)} />
    <Row label={t("popup.atlas.ethnicGroup")} value={enumList("atlasEthnic", props.ethnic_group, i18n)} color={color} />
    <Row field="district" value={admin(props, i18n)} />
    <Row label={t("popup.atlas.neighborhood")} value={str(props.neighborhoods)} />
    <Row label={t("popup.atlas.approvalStatus")} value={approved === false ? t("popup.atlas.notApproved") : [str(props.approved_name), approvedYear].filter(Boolean).join(t("popup.atlas.comma"))} />
    <Precision props={props} flagged={Boolean(str(props.quality_flags))} />
    <DataDate props={props} />
  </>;
}

function IndigenousIsolationPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(ISOLATION_CAUSE_OPTIONS, props.cause_combo);
  const causes = [props.cause_debris_flow === true && t("popup.atlas.causeDebrisFlow"), props.cause_flood === true && t("popup.atlas.causeFlood"), props.cause_road_bridge_break === true && t("popup.atlas.causeRoadBridge")].filter(Boolean).join(t("popup.common.listSeparator"));
  const slash = t("popup.atlas.slash");
  return <>
    <Title color={color}>{`${placeTown(str(props.county), str(props.town), i18n)}${str(props.name)}`}</Title>
    <Row label={t("popup.atlas.cause")} value={causes || t("popup.atlas.causeNone")} color={color} />
    <Row label={t("popup.atlas.pastIsolation")} value={yesNo(props.has_past_incident, t("popup.common.yes"), t("popup.common.no"))} />
    <Row label={t("popup.atlas.walkToOffice")} value={fmt(props.walk_hours_to_office, 1, t("popup.atlas.unitHours"), i18n)} />
    <Row label={t("popup.atlas.householdsPopulation")} value={[fmt(props.households, 0, t("popup.atlas.unitHouseholds"), i18n), fmt(props.population, 0, t("popup.atlas.unitPeople"), i18n)].filter(Boolean).join(slash)} />
    <Row label={t("popup.atlas.vulnerableGroups")} value={[props.elderly_65plus, props.infants, props.critical_patients].map((v) => (num(v) == null ? "—" : String(v))).join(slash)} />
    <Row label={t("popup.atlas.protectedHouseholdsPersons")} value={[fmt(props.protected_households, 0, t("popup.atlas.unitHouseholds"), i18n), fmt(props.protected_persons, 0, t("popup.atlas.unitPeople"), i18n)].filter(Boolean).join(slash)} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Precision props={props} flagged={Boolean(str(props.quality_flags))} />
    <DataDate props={props} />
  </>;
}

function RuralCommunityPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(RURAL_COMMUNITY_OPTIONS, props.community_type);
  return <>
    <Title color={color}>{admin(props, i18n) || t("popup.atlas.villageTitle")}</Title>
    <Row field="type" value={enumOf("atlasRural", props.community_type, props.community_type, i18n)} color={color} />
    <Row field="area" value={fmt(props.area_ha, 1, t("popup.atlas.unitHectares"), i18n)} />
    <Row label={t("popup.atlas.villageCode")} value={`${str(props.id)}${props.villcode_in_current_boundary === false ? t("popup.atlas.notInCurrentBoundary") : ""}`} mono />
    <DataDate props={props} />
  </>;
}

function RoadSignPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const dot = t("popup.atlas.dot");
  const color = props.sign_series ? optionColor(ROAD_SIGN_SERIES_OPTIONS, props.sign_series) : ATLAS_LAYER_COLORS.provincialRoadMileposts;
  const face = [str(props.face_value), str(props.face_value_unit) === "km" ? "" : str(props.face_value_unit)].filter(Boolean).join(" ");
  return <>
    <Title color={color}>{`${str(props.route_no)} ${str(props.stake)}`.trim() || t("popup.atlas.signTitle")}</Title>
    <Row field="category" value={[enumOf("atlasSignSeries", props.sign_series, props.sign_series_label, i18n), str(props.sign_code_label)].filter(Boolean).join(dot)} color={color} />
    <Row label={t("popup.atlas.signFace")} value={face} />
    <Row field="direction" value={[str(props.facing), str(props.mount_position)].filter(Boolean).join(dot)} />
    <Row label={t("popup.atlas.condition")} value={str(props.condition)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row field="managingAgency" value={str(props.maint_section)} />
    <Row field="surveyDate" value={str(props.survey_date)} mono />
    <Precision props={props} flagged={props.coord_flag === "tm2_conflict"} />
  </>;
}

function FreewaySignPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(FREEWAY_SIGN_GROUP_OPTIONS, props.sign_group);
  return <>
    <Title color={color}>{`${str(props.route_name)} ${fmt(props.stake_km, 3, "K", i18n)}`.trim()}</Title>
    <Row field="category" value={str(props.sign_code_label) || t("popup.atlas.codeNameMissing")} color={color} />
    <Row field="code" value={str(props.sign_code)} mono />
    <Row label={t("popup.atlas.signFace")} value={str(props.face_value)} />
    <Row field="direction" value={str(props.direction_note)} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Precision props={props} flagged={props.coord_flag === "tm2_conflict"} />
  </>;
}

function InterchangePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(INTERCHANGE_TYPE_OPTIONS, props.facility_type);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="route" value={str(props.route_name)} />
    <Row field="type" value={enumOf("atlasInterchange", props.facility_type, props.facility_type_label, i18n)} color={color} />
    <Row label={t("popup.atlas.mileage")} value={fmt(props.mileage_km, 1, t("popup.atlas.unitKm"), i18n)} />
    <Precision props={props} />
  </>;
}

function EcoSensitivePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.freewayEcoSensitive}>{t("popup.atlas.ecoSensitiveTitle")}</Title>
    <Row field="level" value={num(props.sensi_level) != null ? t("popup.atlas.ecoLevel", { level: String(props.sensi_level) }) : ""} />
    <Row field="area" value={fmt(props.area_m2, 0, "m²", i18n)} />
  </>;
}

function MonitoredPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(MONITOR_SERIES_OPTIONS, props.monitor_series);
  return <>
    <Title color={color}>{str(props.route_text) || t("popup.atlas.monitoredTitle")}</Title>
    <Row field="category" value={enumOf("atlasMonitor", props.monitor_series, props.monitor_series_label, i18n)} color={color} />
    <Row field="district" value={admin(props, i18n)} />
    <Row field="managingAgency" value={str(props.maint_unit)} />
    <Row label={t("popup.atlas.rainGauge")} value={str(props.rainfall_station_id)} mono />
    <Row label={t("popup.atlas.earlyWarningThreshold")} value={str(props.rule_earlywarning)} />
    <Row label={t("popup.atlas.warningThreshold")} value={str(props.rule_warning)} />
    <Row label={t("popup.atlas.actionThreshold")} value={str(props.rule_action)} />
    <Precision props={props} flagged={props.geometry_source === "start_coordinate"} />
    <Row field="updated" value={time(props.source_updated_at)} mono />
  </>;
}

function EmergencyBayPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const years = str(props.roc_years).split("、").filter(Boolean).map((year) => displayRocYear(year, i18n)).join(t("popup.common.listSeparator"));
  return <>
    <Title color={ATLAS_LAYER_COLORS.provincialRoadEmergencyBays}>{str(props.route_text) || t("popup.atlas.bayTitle")}</Title>
    <Row field="district" value={admin(props, i18n)} />
    <Row field="managingAgency" value={str(props.maint_unit)} />
    <Row label={t("popup.atlas.listYears")} value={years ? t("popup.atlas.rocYears", { years }) : ""} />
    <Row label={t("popup.atlas.latestList")} value={yesNo(props.in_latest_list, t("popup.atlas.listed"), t("popup.atlas.notListed"))} />
    <Precision props={props} />
  </>;
}

function FloodPointPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(FLOOD_INFO_SOURCE_OPTIONS, props.info_source);
  return <>
    <Title color={color}>{t("popup.atlas.floodTitle", { year: str(props.event_year) })}</Title>
    <Row label={t("popup.atlas.infoSource")} value={enumOf("atlasFloodSource", props.info_source, props.info_source_label, i18n)} color={color} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row label={t("popup.atlas.samePointRows")} value={num(props.same_point_rows) != null && num(props.same_point_rows)! > 1 ? t("popup.atlas.samePointValue", { rows: String(props.same_point_rows) }) : ""} />
    <Precision props={props} />
    <DataDate props={props} />
  </>;
}

function WaterloggingPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.taipeiWaterloggingHistory}>{str(props.location_text) || t("popup.atlas.waterloggingTitle")}</Title>
    <Row field="date" value={str(props.event_date) || (num(props.event_year) != null ? t("popup.atlas.yearOnly", { year: String(props.event_year) }) : t("popup.atlas.noDate"))} mono />
    <Row field="district" value={placeTown(str(props.county), str(props.town), i18n)} />
    <Row label={t("popup.atlas.waterloggingDepth")} value={fmt(props.depth_cm, 0, t("popup.atlas.unitCmEstimated"), i18n)} />
    <Row field="area" value={fmt(props.area_m2, 0, "m²", i18n)} />
    <Row label={t("popup.atlas.attributeCompleteness")} value={str(props.attribute_status_label)} />
    <Precision props={props} />
  </>;
}

function SwcbPhotoPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(SWCB_PHOTO_CATEGORY_OPTIONS, props.photo_category);
  const category = enumOf("atlasPhotoCategory", props.photo_category, props.photo_category_label, i18n);
  return <>
    <Title color={color}>{str(props.disaster_name) || category}</Title>
    <Row field="category" value={category} color={color} />
    <Row field="description" value={str(props.description)} />
    <Row label={t("popup.atlas.photoDate")} value={str(props.photo_date)} mono />
    <Row label={t("popup.atlas.disasterYear")} value={`${str(props.disaster_year)}${props.photo_year_mismatch === true ? t("popup.atlas.differsFromPhotoYear") : ""}`} />
    <Row field="district" value={admin(props, i18n)} />
    <Row field="place" value={str(props.landmark)} />
    <Row label={t("popup.atlas.photoCredit")} value={str(props.photo_credit)} />
    <Row label={t("popup.atlas.photoLink")} value={str(props.photo_url)} mono />
    <Row label={t("popup.atlas.newsLink")} value={str(props.news_url)} mono />
    <Precision props={props} />
  </>;
}

function strandingTitle(p: Record<string, unknown>, species: string) {
  return `${str(p.event_date)} ${species}`.trim();
}

function CetaceanPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const flagged = props.coord_status === "suspect_county_mismatch";
  const color = flagged ? ATLAS_FLAG_COLOR : optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status);
  return <>
    <Title color={color}>{strandingTitle(props, str(props.species_zh))}</Title>
    <Row label={t("popup.atlas.scientificName")} value={str(props.scientific_name)} />
    <Row field="status" value={enumOf("atlasAnimalStatus", props.animal_status, props.animal_status, i18n)} color={optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status)} />
    <Row label={t("popup.atlas.groupStranding")} value={str(props.group_flag)} />
    <Row label={t("popup.atlas.bodyLength")} value={fmt(props.body_length_m, 2, t("popup.atlas.unitMeters"), i18n)} />
    <Row label={t("popup.atlas.handling")} value={str(props.handling)} />
    <Row label={t("popup.atlas.reporter")} value={str(props.reporter_category)} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Precision props={props} flagged={flagged || props.coord_status === "out_of_bbox"} />
    <DataDate props={props} />
  </>;
}

function TurtlePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const flagged = props.coord_status === "suspect_county_mismatch";
  const color = flagged ? ATLAS_FLAG_COLOR : optionColor(TURTLE_SPECIES_OPTIONS, props.species_zh);
  return <>
    <Title color={color}>{strandingTitle(props, enumOf("atlasTurtle", props.species_zh, props.species_zh, i18n))}</Title>
    <Row label={t("popup.atlas.scientificName")} value={str(props.scientific_name)} />
    <Row field="status" value={enumOf("atlasAnimalStatus", props.animal_status, props.animal_status, i18n)} color={optionColor(ANIMAL_STATUS_OPTIONS, props.animal_status)} />
    <Row label={t("popup.atlas.strandingCause")} value={str(props.stranding_cause)} />
    <Row label={t("popup.atlas.carapaceLength")} value={fmt(props.carapace_length_cm, 1, t("popup.atlas.unitCm"), i18n)} />
    <Row label={t("popup.atlas.handling")} value={str(props.handling)} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Precision props={props} flagged={flagged || props.coord_status === "out_of_bbox"} />
    <DataDate props={props} />
  </>;
}

function BeachPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(BEACH_LEVEL_OPTIONS, props.latest_water_level_code);
  const level = enumOf("atlasBeach", props.latest_water_level_code, props.latest_water_level, i18n);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row label={t("popup.atlas.latestQuality")} value={t("popup.atlas.valueWithNote", { value: level, note: str(props.last_sample_date) })} color={color} />
    <Row label={t("popup.atlas.eColi")} value={str(props.latest_e_coli) ? `${str(props.latest_e_coli)} CFU/100mL` : ""} />
    <Row label={t("popup.atlas.enterococcus")} value={str(props.latest_enterococcus) ? `${str(props.latest_enterococcus)} CFU/100mL` : ""} />
    <Row field="sampleCount" value={str(props.sample_count) ? t("popup.atlas.samplesValue", { count: Number(props.sample_count), bad: str(props.unsuitable_count) || "0" }) : ""} />
    <Row label={t("popup.atlas.yearsSampled")} value={str(props.years_sampled).split(",").filter(Boolean).join(t("popup.common.listSeparator"))} />
    <Row field="limits" value={t("popup.atlas.swimSeasonOnly")} />
    <Precision props={props} />
  </>;
}

function MicroplasticsPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.marineMicroplastics}>{t("popup.atlas.microplasticsTitle", { name: str(props.name) })}</Title>
    <Row field="region" value={str(props.sea_area_label)} />
    <Row label={t("popup.atlas.surfaceMean")} value={fmt(props.surface_mean_total_per_m3, 1, t("popup.atlas.unitPerM3"), i18n)} />
    <Row label={t("popup.atlas.surfaceMax")} value={fmt(props.surface_max_total_per_m3, 1, t("popup.atlas.unitPerM3"), i18n)} />
    <Row label={t("popup.atlas.cruisesSamples")} value={t("popup.atlas.cruisesSamplesValue", { cruises: str(props.cruise_count), samples: str(props.sample_count) })} />
    <Row label={t("popup.atlas.surveyPeriod")} value={t("popup.atlas.range", { from: str(props.first_survey_month), to: str(props.last_survey_month) })} mono />
    <Precision props={props} flagged={props.coord_quality === "inconsistent_positions_review"} />
  </>;
}

function PollutionPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(POLLUTION_LEVEL_OPTIONS, props.case_level);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="level" value={enumOf("atlasPollution", props.case_level, props.case_level_label, i18n)} color={color} />
    <Row field="occurredAt" value={time(props.occurred_at)} mono />
    <Row label={t("popup.atlas.closedAt")} value={time(props.ended_at)} mono />
    <Row field="location" value={str(props.site_description)} />
    <Row label={t("popup.atlas.reportingAgency")} value={str(props.reporting_agency)} />
    <Row label={t("popup.atlas.responsibleSea")} value={props.outside_tw_responsibility === true ? t("popup.atlas.outsideResponsibleSea") : ""} />
    <Row field="number" value={str(props.id)} mono />
    <Precision props={props} flagged={props.coord_status === "out_of_bbox"} />
  </>;
}

function EdnaPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.namrEdnaSurveySites}>{str(props.name)}</Title>
    <Row field="region" value={[str(props.region_major), str(props.region_minor)].filter(Boolean).join(t("popup.atlas.dot"))} />
    <Row field="code" value={str(props.region_code)} mono />
    <Precision props={props} />
  </>;
}

function PlaceNamePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(PLACE_CATEGORY_OPTIONS, props.category);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="category" value={enumOf("atlasPlaceKind", props.category, props.category_label, i18n)} color={color} />
    <Row field="englishName" value={str(props.name_hanyu_pinyin)} />
    <Row label={t("popup.atlas.aliases")} value={str(props.aliases)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row label={t("popup.atlas.placeMeaning")} value={str(props.place_meaning)} />
    <Row label={t("popup.atlas.pointMeaning")} value={str(props.extent_type_label)} />
    <Row field="dataSource" value={str(props.data_source_labels)} />
    <Precision props={props} flagged={(num(props.coord_precision_m) ?? 0) >= 1000} />
  </>;
}

function TriangulationPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(TRIANGULATION_GRADE_OPTIONS, String(props.grade ?? ""));
  return <>
    <Title color={color}>{str(props.name) || t("popup.atlas.triangulationTitle")}</Title>
    <Row field="level" value={enumOf("atlasTriangulation", props.grade, props.grade_label, i18n)} color={color} />
    <Row field="elevation" value={fmt(props.elevation_m, 2, t("popup.atlas.unitMeters"), i18n)} />
    <Row label={t("popup.atlas.mapSheet")} value={str(props.map_sheet)} />
    <Row label={t("popup.atlas.markNo")} value={str(props.mark_no)} mono />
    <Row label={t("popup.atlas.markMaterial")} value={str(props.mark_material)} />
    <Precision props={props} />
  </>;
}

function FloodgatePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(GATE_KIND_OPTIONS, props.gate_kind);
  const kind = enumOf("atlasGate", props.gate_kind, props.gate_kind_label, i18n);
  return <>
    <Title color={color}>{str(props.name) || kind}</Title>
    <Row field="type" value={kind} color={color} />
    <Row field="river" value={[str(props.river_name), str(props.bank)].filter(Boolean).join(t("popup.atlas.dot"))} />
    <Row label={t("popup.atlas.operationType")} value={str(props.operation_type_label)} />
    <Row label={t("popup.atlas.gateSpec")} value={str(props.gate_spec_raw)} />
    <Row label={t("popup.atlas.material")} value={str(props.material_raw)} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="managingAgency" value={str(props.river_branch_label)} />
    <Row field="surveyDate" value={str(props.survey_date)} mono />
    <Row field="caution" value={t("popup.atlas.floodgateCaution")} />
    <Precision props={props} />
  </>;
}

function DrainagePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.wraCentralDrainage}>{str(props.name)}</Title>
    <Row field="basin" value={str(props.basin_name)} />
    <Row label={t("popup.atlas.outlet")} value={str(props.outlet)} />
    <Row field="length" value={fmt(props.main_length_km, 1, t("popup.atlas.unitKm"), i18n)} />
    <Row label={t("popup.atlas.passingCounties")} value={placeNameList(str(props.passing_county_names), i18n)} />
    <Row label={t("popup.atlas.startPoint")} value={str(props.start_desc)} />
    <Row label={t("popup.atlas.endPoint")} value={str(props.end_desc)} />
    <Row field="authority" value={str(props.responsible_authority)} />
    <Row field="area" value={fmt(props.area_km2, 3, "km²", i18n)} />
  </>;
}

function IowPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(STRUCTURE_CATEGORY_OPTIONS, props.structure_category);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="category" value={enumOf("atlasStructure", props.structure_category, props.structure_category_label, i18n)} color={color} />
    <Row label={t("popup.atlas.sensorKinds")} value={num(props.sensor_count) != null ? t("popup.atlas.sensorsValue", { kinds: str(props.sensor_kinds), count: Number(props.sensor_count) }) : str(props.sensor_kinds)} />
    <Row field="managingAgency" value={str(props.org_name)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row label={t("popup.atlas.nearestFloodgate")} value={str(props.nearest_floodgate_name) ? t("popup.atlas.valueWithNote", { value: str(props.nearest_floodgate_name), note: fmt(props.nearest_floodgate_m, 0, "m", i18n) }) : ""} />
    <Precision props={props} />
  </>;
}

function DredgingPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(DREDGING_STATUS_OPTIONS, props.status);
  const unit = str(props.quantity_unit) === "unspecified" ? t("popup.atlas.unitNotStated") : str(props.quantity_unit);
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="status" value={enumOf("atlasDredging", props.status, props.status_label, i18n)} color={color} />
    <Row field="river" value={str(props.river_name)} />
    <Row label={t("popup.atlas.executingUnit")} value={str(props.executing_unit)} />
    <Row label={t("popup.atlas.constructionPeriod")} value={t("popup.atlas.range", { from: str(props.start_date), to: str(props.end_date) })} mono />
    <Row label={t("popup.atlas.planExecuteQuantity")} value={`${fmt(props.plan_quantity, 1, "", i18n)}${t("popup.atlas.slash")}${fmt(props.execute_quantity, 1, "", i18n)} ${unit}`} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Precision props={props} flagged={props.coord_precision !== "deg_0.01"} />
    <DataDate props={props} />
  </>;
}

function EcologyPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.wraEcologySurveySites}>{str(props.name) || t("popup.atlas.ecologyTitle")}</Title>
    <Row field="river" value={[str(props.river_name), str(props.basin_name)].filter(Boolean).join(t("popup.atlas.dot"))} />
    <Row label={t("popup.atlas.speciesCount")} value={str(props.species_count)} />
    <Row label={t("popup.atlas.recordCount")} value={str(props.record_count)} />
    <Row label={t("popup.atlas.taxonGroups")} value={str(props.taxon_groups_label)} />
    <Row label={t("popup.atlas.surveyPeriod")} value={t("popup.atlas.range", { from: str(props.first_survey_date), to: str(props.last_survey_date) })} mono />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="caution" value={t("popup.atlas.ecologyCaution")} />
    <Precision props={props} />
  </>;
}

// ── 海域保護與漁業 G08（2026-10-17）──────────────────────────────────────
// 每層尾端固定兩列：該層專屬警語＋「僅供參考，不構成法規適用判斷」。出典與授權由 SourceFooter 掛。

/** 全群組免責（逐字）：放在每個 popup 最後。 */
const MarineDisclaimer = ({ note }: { note?: string }) => {
  const { t } = useLocale();
  return <>
    {note ? <Row field="caution" value={note} /> : null}
    <Row field="dataLimits" value={t("popup.atlas.marineDisclaimer")} />
  </>;
};

function ProtectedAreaPanel({ props, layer }: Props & { layer: "natureReserves" | "wildlifeProtectedAreas" }) {
  const i18n = useLocale();
  const { t } = i18n;
  const area = fmt(props.source_area_ha, 2, t("popup.atlas.unitHectares"), i18n);
  return <>
    <Title color={ATLAS_LAYER_COLORS[layer]}>{str(props.name)}</Title>
    <Row label={t("popup.atlas.subarea")} value={str(props.subarea_name)} />
    <Row field="managingAgency" value={str(props.manager)} />
    <Row label={t("popup.atlas.legalEstablished")} value={str(props.legal_established_date)} mono />
    <Row label={t("popup.atlas.legalAnnounced")} value={str(props.legal_announced_date)} mono />
    <Row label={t("popup.atlas.sourceAreaHa")} value={area ? t("popup.atlas.sourceValue", { value: area }) : ""} />
    <Row field="sourceVersion" value={str(props.source_edition)} />
    <DataDate props={props} />
    <MarineDisclaimer note={t("popup.atlas.includesLand")} />
  </>;
}
const NatureReservePanel = ({ props }: Props) => <ProtectedAreaPanel props={props} layer="natureReserves" />;
const WildlifeProtectedPanel = ({ props }: Props) => <ProtectedAreaPanel props={props} layer="wildlifeProtectedAreas" />;

function OpenFishingPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.openFishingLocations}>{t("popup.atlas.openFishingTitle", { county: placeName(str(props.county), i18n) })}</Title>
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="longitude" value={str(props.source_xpos)} mono />
    <Row field="latitude" value={str(props.source_ypos)} mono />
    <DataDate props={props} />
    <MarineDisclaimer note={t("popup.atlas.fishingPointCaution")} />
  </>;
}

function CoastalAreaPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(COASTAL_AREA_TYPE_OPTIONS, props.area_type);
  const type = enumOf("atlasCoastal", props.area_type, props.area_type, i18n);
  return <>
    <Title color={color}>{`${placeName(str(props.county), i18n)} ${type}`}</Title>
    <Row field="type" value={type} color={color} />
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row field="version" value={t("popup.atlas.coastalEdition")} />
    <MarineDisclaimer note={t("popup.atlas.coastalCaution")} />
  </>;
}

function ReefCenterPanel({ props, layer }: Props & { layer: "artificialReefCenters" | "protectedReefCenters" }) {
  const i18n = useLocale();
  const { t } = i18n;
  const basis = enumOf("atlasReefBasis", props.point_basis, props.point_basis_label, i18n);
  return <>
    <Title color={ATLAS_LAYER_COLORS[layer]}>{str(props.name)}</Title>
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row label={t("popup.atlas.reefDepth")} value={str(props.depth_text)} />
    <Row label={t("popup.atlas.announceDate")} value={str(props.announce_date)} mono />
    <Row label={t("popup.atlas.rangeRule")} value={str(props.range_text)} />
    <Row label={t("popup.atlas.coordinateText")} value={str(props.coordinate_text)} mono />
    <Row label={t("popup.atlas.pointMeaning")} value={basis} />
    <DataDate props={props} />
    <MarineDisclaimer note={t("popup.atlas.reefCenterCaution")} />
  </>;
}
const ArtificialReefPanel = ({ props }: Props) => <ReefCenterPanel props={props} layer="artificialReefCenters" />;
const ProtectedReefPanel = ({ props }: Props) => <ReefCenterPanel props={props} layer="protectedReefCenters" />;

function SetNetPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  return <>
    <Title color={ATLAS_LAYER_COLORS.setNetFishingAreas}>{[str(props.fishery_name), str(props.area_name)].filter(Boolean).join(t("popup.atlas.dot")) || t("popup.atlas.setNetTitle")}</Title>
    <Row field="county" value={placeName(str(props.county), i18n)} />
    <Row label={t("popup.atlas.fisheryName")} value={str(props.fishery_name)} />
    <Row field="place" value={str(props.area_name)} />
    <Row label={t("popup.atlas.licenseNo")} value={str(props.license_no)} mono />
    <Row field="license" value={t("popup.atlas.setNetLicense")} />
    <DataDate props={props} />
    <MarineDisclaimer note={t("popup.atlas.setNetCaution")} />
  </>;
}

// ── 文化幣藝文消費點 G23（2026-10-24）────────────────────────────────────
// 資料日期＝下載日（來源檔無日期欄）；座標來源分「來源座標」與「依地址回補（精度）」；
// county_check 不一致時加注意列（只標旗標，座標未改）。出典與授權由 SourceFooter 掛。

function CultureCoinPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = optionColor(CULTURE_COIN_CATEGORY_OPTIONS, props.category);
  const zhCategory = CULTURE_COIN_CATEGORY_OPTIONS.find((o) => o.value === str(props.category))?.label ?? "";
  const category = enumOf("atlasCultureCoin", props.category, zhCategory, i18n);
  const sub = enumOf("atlasCultureCoinSub", props.sub_category, props.sub_category_label, i18n);
  const precision = enumOf("atlasCoinPrecision", props.precision, CULTURE_COIN_PRECISION_LABELS[str(props.precision)] ?? "", i18n);
  const coord = props.coord_status === "geocoded"
    ? t("popup.atlas.coinCoordGeocoded", { precision })
    : t("popup.atlas.coinCoordSource");
  const check = props.county_check === "mismatch" ? t("popup.atlas.coinCountyMismatch")
    : props.county_check === "unresolved" ? t("popup.atlas.coinCountyUnresolved") : "";
  return <>
    <Title color={color}>{str(props.name) || category}</Title>
    <Row field="category" value={category} color={color} />
    <Row field="type" value={sub} />
    <Row field="address" value={str(props.address)} />
    <Row field="district" value={placeName(`${str(props.city)}${str(props.area)}`, i18n)} />
    <Row field="coordSource" value={coord} />
    {check ? <Row field="caution" value={check} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.downloadDate")} value={str(props.vintage)} mono />
  </>;
}

// ── 原民會文化健康站 G20（2026-10-24）────────────────────────────────────
// kind=site：依地址定位的站址；kind=township_group：同鄉鎮只到鄉鎮的各站併成鄉鎮中心一點，列站名並警示非實際位置。
// 不顯示電話（成品不帶）。資料日期＝通訊錄 DateListed；出典與授權由 SourceFooter 掛。

function CulturalHealthPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = ATLAS_LAYER_COLORS.culturalHealthStations;
  const precision = enumOf("atlasChsPrecision", props.precision, CULTURAL_HEALTH_PRECISION_LABELS[str(props.precision)] ?? str(props.precision_label), i18n);
  const district = placeName(`${str(props.county)}${str(props.town)}`, i18n);
  if (props.kind === "township_group") {
    return <>
      <Title color={color}>{t("popup.atlas.chsGroupTitle", { district, count: str(props.station_count) })}</Title>
      <Row field="caution" value={t("popup.atlas.chsTownshipOnly")} color={theme.warn} />
      <Row label={t("popup.atlas.chsStationCount")} value={str(props.station_count)} />
      <Row label={t("popup.atlas.chsStationNames")} value={str(props.station_names)} />
      <Row label={t("popup.atlas.chsListDate")} value={str(props.vintage)} mono />
    </>;
  }
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="address" value={str(props.address)} />
    <Row field="district" value={district} />
    <Row field="coordSource" value={precision} />
    <Row label={t("popup.atlas.chsListDate")} value={str(props.vintage)} mono />
  </>;
}

// ── 國營事業與國有資產 G16（2026-10-24）────────────────────────────────────
// 台水、台糖的資料日期＝data.gov.tw 更新日；待標售＝下載日快照。定位精度、旗標一律顯示；出典與授權由 SourceFooter 掛。

function TwcOfficePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = optionColor(TWC_OFFICE_TYPE_OPTIONS, props.unit_type);
  const type = enumOf("atlasTwcOfficeType", props.unit_type, props.unit_type_label, i18n);
  const shared = num(props.shared_site_count) ?? 1;
  return <>
    <Title color={color}>{str(props.name) || type}</Title>
    <Row field="type" value={type} color={color} />
    <Row label={t("popup.atlas.twcRegionOffice")} value={str(props.region_office)} />
    <Row field="address" value={str(props.address)} />
    <Row field="district" value={admin(props, i18n)} />
    {shared > 1 ? <Row field="caution" value={t("popup.atlas.twcSharedSite", { n: String(shared - 1) })} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.metadataDate")} value={str(props.vintage)} mono />
  </>;
}

function TwcFacilityPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = optionColor(TWC_FACILITY_TYPE_OPTIONS, props.facility_type);
  const type = enumOf("atlasTwcFacilityType", props.facility_type, props.facility_type_label, i18n);
  const large = str(props.existing_large_plant_name);
  return <>
    <Title color={color}>{str(props.name) || type}</Title>
    <Row field="type" value={type} color={color} />
    {large ? <Row label={t("popup.atlas.twcLargePlant")} value={t("popup.atlas.twcLargePlantValue", { name: large, capacity: fmt(props.design_capacity_cmd, 0, "", i18n) })} color={color} /> : null}
    {large ? <Row field="remarks" value={t("popup.atlas.twcLargePlantSame")} /> : null}
    <Row label={t("popup.atlas.twcSupplyArea")} value={str(props.supply_area_text)} />
    <Row label={t("popup.atlas.twcRawWater")} value={str(props.raw_water_source)} />
    <Row field="district" value={admin(props, i18n)} />
    {props.name_encoding_issue === true ? <Row field="caution" value={t("popup.atlas.twcNameEncoding")} color={theme.warn} /> : null}
    {props.coord_status && props.coord_status !== "ok" ? <Row field="caution" value={enumOf("atlasTwcCoord", props.coord_status, props.coord_status_label, i18n)} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.metadataDate")} value={str(props.vintage)} mono />
  </>;
}

function TaisugarMillPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = ATLAS_LAYER_COLORS.taisugarSugarMills;
  return <>
    <Title color={color}>{str(props.name)}</Title>
    <Row field="address" value={str(props.address)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row label={t("popup.atlas.taisugarHighlights")} value={str(props.highlights)} />
    <Row field="coordSource" value={enumOf("atlasStatePrecision", props.geocode_precision, props.geocode_precision_label, i18n)} />
    {props.coord_status && props.coord_status !== "ok" ? <Row field="caution" value={enumOf("atlasTaisugarCoord", props.coord_status, props.coord_status_label, i18n)} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.metadataDate")} value={str(props.vintage)} mono />
  </>;
}

function StateTenderPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = optionColor(STATE_TENDER_KIND_OPTIONS, props.property_kind);
  const kind = enumOf("atlasTenderKind", props.property_kind, props.property_kind_label, i18n);
  const district = admin(props, i18n);
  const value = fmt(props.announced_land_value_per_sqm, 0, "", i18n);
  return <>
    <Title color={color}>{t("popup.atlas.tenderTitle", { kind, district })}</Title>
    <Row field="type" value={kind} color={color} />
    <Row label={t("popup.atlas.tenderBidNo")} value={str(props.bid_no)} />
    <Row label={t("popup.atlas.tenderBidDate")} value={str(props.bid_date)} mono />
    <Row label={t("popup.atlas.tenderBranch")} value={str(props.branch_office)} />
    <Row label={t("popup.atlas.tenderParcel")} value={str(props.parcel_text)} />
    <Row field="address" value={str(props.street_address)} />
    <Row field="area" value={fmt(props.land_area_sqm, 2, "m²", i18n)} />
    <Row label={t("popup.atlas.tenderShareArea")} value={fmt(props.share_area_sqm, 2, "m²", i18n)} />
    <Row label={t("popup.atlas.tenderZoning")} value={str(props.zoning)} />
    <Row label={t("popup.atlas.tenderLandUse")} value={str(props.land_use_class)} />
    {value ? <Row label={t("popup.atlas.tenderAnnouncedValue")} value={t("popup.atlas.tenderAnnouncedValueText", { value, date: str(props.announced_land_value_date) })} /> : null}
    <Row field="positionAccuracy" value={enumOf("atlasStatePrecision", props.geocode_precision, props.geocode_precision_label, i18n)} />
    {props.town_name_basis === "point_location" ? <Row field="remarks" value={enumOf("atlasTenderTownBasis", props.town_name_basis, props.town_name_basis_label, i18n)} /> : null}
    {props.spatial_check === "town_mismatch" ? <Row field="caution" value={enumOf("atlasTenderSpatial", props.spatial_check, props.spatial_check_label, i18n)} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.downloadDate")} value={str(props.vintage)} mono />
  </>;
}

// ── 金融服務據點 G10（2026-10-24）──────────────────────────────────────────
// 財金公司名冊快照；座標來源混合，定位精度一律顯示，Google 約略位置加警示。旗標是 1／0／null（null＝名冊未標示，不顯示）。

function FinanceLocationRows({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const approximate = props.geocode_precision === "google_approximate";
  return <>
    <Row field="address" value={str(props.address)} />
    <Row field="district" value={admin(props, i18n)} />
    <Row field="coordSource" value={enumOf("atlasFinanceCoord", props.coord_source, props.coord_source_label, i18n)} />
    <Row field="positionAccuracy" value={enumOf("atlasFinancePrecision", props.geocode_precision, props.geocode_precision_label, i18n)} color={approximate ? theme.warn : undefined} />
    {approximate ? <Row field="caution" value={t("popup.atlas.financeApproximate")} color={theme.warn} /> : null}
    {props.town_basis === "point_location" || props.town_basis === "unallocated" ? <Row field="remarks" value={enumOf("atlasFinanceTownBasis", props.town_basis, props.town_basis_label, i18n)} /> : null}
    {props.spatial_check === "town_mismatch" ? <Row field="caution" value={enumOf("atlasFinanceSpatial", props.spatial_check, props.spatial_check_label, i18n)} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.financeRosterDate")} value={str(props.vintage)} mono />
    {props.source_date_kind && props.source_date_kind !== "download"
      ? <Row label={enumOf("atlasFinanceSourceDate", props.source_date_kind, FINANCE_SOURCE_DATE_LABELS[str(props.source_date_kind)], i18n)} value={str(props.source_date)} mono />
      : null}
  </>;
}

function AtmSitePanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const theme = useFeatureTheme();
  const color = optionColor(ATM_INSTITUTION_OPTIONS, props.institution_category);
  const category = enumOf("atlasAtmInstitution", props.institution_category, props.institution_category_label, i18n);
  const flag = (v: unknown) => (v === 1 ? t("popup.common.yes") : v === 0 ? t("popup.common.no") : "");
  return <>
    <Title color={color}>{[str(props.institution_name), str(props.name)].filter(Boolean).join(" ")}</Title>
    <Row field="category" value={category} color={color} />
    <Row field="remarks" value={t("popup.atlas.atmOneSite")} />
    <Row label={t("popup.atlas.atmWheelchair")} value={flag(props.wheelchair_accessible)} />
    <Row label={t("popup.atlas.atmVoice")} value={flag(props.voice_guidance)} />
    <Row label={t("popup.atlas.atmIntlCard")} value={flag(props.intl_card_withdrawal)} />
    {props.open_to_public === 0 ? <Row field="caution" value={t("popup.atlas.atmNotPublic")} color={theme.warn} /> : null}
    <Row label={t("popup.atlas.atmAccessNote")} value={str(props.access_note)} />
    <FinanceLocationRows props={props} />
  </>;
}

function FinancialBranchPanel({ props }: Props) {
  const i18n = useLocale();
  const color = optionColor(BRANCH_CATEGORY_OPTIONS, props.institution_category);
  const category = enumOf("atlasBranchCategory", props.institution_category, props.institution_category_label, i18n);
  return <>
    <Title color={color}>{str(props.name) || category}</Title>
    <Row field="category" value={category} color={color} />
    <FinanceLocationRows props={props} />
  </>;
}

// G10 延伸：證券期貨投信投顧、保險公司與保險代理人（共用 FinanceLocationRows；名冊各自的資料日另列）。
function SecuritiesFuturesPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(SECURITIES_TYPE_OPTIONS, props.institution_type);
  const kind = enumOf("atlasSecuritiesType", props.institution_type, props.institution_type_label, i18n);
  return <>
    <Title color={color}>{str(props.name) || kind}</Title>
    <Row field="category" value={kind} color={color} />
    {props.futures_operator_kind ? <Row label={t("popup.atlas.futuresOperatorKind")} value={enumOf("atlasFuturesKind", props.futures_operator_kind, props.futures_operator_kind_label, i18n)} /> : null}
    {props.proprietary_desk === 1 ? <Row field="remarks" value={t("popup.atlas.securitiesProprietary")} /> : null}
    <Row label={t("popup.atlas.openedDate")} value={str(props.opened_date)} mono />
    <Row field="remarks" value={t("popup.atlas.securitiesRosterPoint")} />
    <FinanceLocationRows props={props} />
  </>;
}

function InsuranceInstitutionPanel({ props }: Props) {
  const i18n = useLocale();
  const { t } = i18n;
  const color = optionColor(INSURANCE_TYPE_OPTIONS, props.institution_type);
  const kind = enumOf("atlasInsuranceType", props.institution_type, props.institution_type_label, i18n);
  return <>
    <Title color={color}>{str(props.name) || kind}</Title>
    <Row field="category" value={kind} color={color} />
    <Row label={t("popup.atlas.insuranceOfficeLevel")} value={enumOf("atlasInsuranceOffice", props.office_level, props.office_level_label, i18n)} />
    {props.agency_lines ? <Row label={t("popup.atlas.insuranceAgencyLines")} value={enumOf("atlasAgencyLines", props.agency_lines, props.agency_lines_label, i18n)} /> : null}
    <FinanceLocationRows props={props} />
  </>;
}

export const ATLAS_PANELS: Record<AtlasLayerKey, FC<Props>> = {
  indigenousTribes: IndigenousTribePanel,
  indigenousIsolationRisk: IndigenousIsolationPanel,
  agriRuralCommunityVillages: RuralCommunityPanel,
  provincialRoadSigns: RoadSignPanel,
  provincialRoadMileposts: RoadSignPanel,
  freewayTrafficSigns: FreewaySignPanel,
  freewayInterchanges: InterchangePanel,
  freewayEcoSensitive: EcoSensitivePanel,
  provincialRoadMonitored: MonitoredPanel,
  provincialRoadEmergencyBays: EmergencyBayPanel,
  floodDisasterPointsNcdr: FloodPointPanel,
  taipeiWaterloggingHistory: WaterloggingPanel,
  swcbDisasterPhotoPoints: SwcbPhotoPanel,
  cetaceanStrandings: CetaceanPanel,
  seaTurtleStrandings: TurtlePanel,
  beachWaterQuality: BeachPanel,
  marineMicroplastics: MicroplasticsPanel,
  marinePollutionIncidents: PollutionPanel,
  namrEdnaSurveySites: EdnaPanel,
  placeNames: PlaceNamePanel,
  triangulationPoints: TriangulationPanel,
  wraFloodgatesCentral: FloodgatePanel,
  wraCentralDrainage: DrainagePanel,
  iowStructureMonitoring: IowPanel,
  wraDredgingPoints: DredgingPanel,
  wraEcologySurveySites: EcologyPanel,
  natureReserves: NatureReservePanel,
  wildlifeProtectedAreas: WildlifeProtectedPanel,
  openFishingLocations: OpenFishingPanel,
  coastalAreaExtents: CoastalAreaPanel,
  artificialReefCenters: ArtificialReefPanel,
  protectedReefCenters: ProtectedReefPanel,
  setNetFishingAreas: SetNetPanel,
  ...LAND_SUBSIDENCE_PANELS,
  cultureCoinVenues: CultureCoinPanel,
  culturalHealthStations: CulturalHealthPanel,
  twcServiceOffices: TwcOfficePanel,
  twcWaterFacilities: TwcFacilityPanel,
  taisugarSugarMills: TaisugarMillPanel,
  statePropertyTenderListings: StateTenderPanel,
  atmSitesFisc: AtmSitePanel,
  financialBranchesFisc: FinancialBranchPanel,
  securitiesFuturesInstitutions: SecuritiesFuturesPanel,
  insuranceInstitutions: InsuranceInstitutionPanel,
};

function manifestZh(key: AtlasLayerKey): string {
  return (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name?.zh ?? key;
}

/** 說明框標題列 */
export const ATLAS_HEADER_LABELS: Record<AtlasLayerKey, string> = {
  indigenousTribes: "原住民族部落",
  indigenousIsolationRisk: "原鄉易成孤島地區",
  agriRuralCommunityVillages: "農村社區分類",
  provincialRoadSigns: "省道交通標誌",
  provincialRoadMileposts: "省道里程牌",
  freewayTrafficSigns: "國道交通標誌",
  freewayInterchanges: "國道交流道",
  freewayEcoSensitive: "國道生態敏感路段",
  provincialRoadMonitored: "省道防救災監控路段",
  provincialRoadEmergencyBays: "省道緊急避車彎",
  floodDisasterPointsNcdr: "淹水災點",
  taipeiWaterloggingHistory: "臺北市歷年積水",
  swcbDisasterPhotoPoints: "土砂災害照片",
  cetaceanStrandings: "鯨豚擱淺",
  seaTurtleStrandings: "海龜擱淺",
  beachWaterQuality: "海水浴場水質",
  marineMicroplastics: "海洋微塑膠調查",
  marinePollutionIncidents: "海洋污染事件",
  namrEdnaSurveySites: "環境 DNA 調查站位",
  placeNames: "臺灣地名",
  triangulationPoints: "三角點",
  wraFloodgatesCentral: "中央管水門",
  wraCentralDrainage: "中央管區域排水",
  iowStructureMonitoring: "水利結構監測站",
  wraDredgingPoints: "河川疏濬工程",
  wraEcologySurveySites: "河川生態調查站",
  // 海域保護與漁業 G08：標題借 manifest 圖層名（中文正本只寫一處；英日文走 layers.json）
  natureReserves: manifestZh("natureReserves"),
  wildlifeProtectedAreas: manifestZh("wildlifeProtectedAreas"),
  openFishingLocations: manifestZh("openFishingLocations"),
  coastalAreaExtents: manifestZh("coastalAreaExtents"),
  artificialReefCenters: manifestZh("artificialReefCenters"),
  protectedReefCenters: manifestZh("protectedReefCenters"),
  setNetFishingAreas: manifestZh("setNetFishingAreas"),
  landSubsidenceStations: manifestZh("landSubsidenceStations"),
  landSubsidenceCumulative: manifestZh("landSubsidenceCumulative"),
  landSubsidenceRate: manifestZh("landSubsidenceRate"),
  seawallZones: manifestZh("seawallZones"),
  cultureCoinVenues: manifestZh("cultureCoinVenues"),
  culturalHealthStations: manifestZh("culturalHealthStations"),
  twcServiceOffices: manifestZh("twcServiceOffices"),
  twcWaterFacilities: manifestZh("twcWaterFacilities"),
  taisugarSugarMills: manifestZh("taisugarSugarMills"),
  statePropertyTenderListings: manifestZh("statePropertyTenderListings"),
  atmSitesFisc: manifestZh("atmSitesFisc"),
  financialBranchesFisc: manifestZh("financialBranchesFisc"),
  securitiesFuturesInstitutions: manifestZh("securitiesFuturesInstitutions"),
  insuranceInstitutions: manifestZh("insuranceInstitutions"),
};
