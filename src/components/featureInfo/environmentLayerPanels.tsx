// 環境氣候 popup：水質與污水 4 層（#490）＋第二波 9 層（海域水質、RPI 河段推估、PM2.5 手動站、戴奧辛、
// 焚化廠、核安會輻射、放流水、CEMS、紫外線）。上游 feature 的 source 欄位含內部表名或根本沒有（即時 RPC），
// 故 panel 自帶人類可讀來源並自掛 SourceFooter。null 一律顯示原因，不當 0。
import { useEffect, useState } from "react";
import type { PanelProps } from "./registry";
import { PopupDetails, PopupScroll, Row, SourceFooter, Title, formatTaiwanTime } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import {
  DRINKING_WATER_ZONE_TYPES, ENVIRONMENT_LAYER_COLORS, RIVER_RPI_CLASSES, RIVER_RPI_NO_DATA_COLOR,
  SEWAGE_GEOCODE_QUALITY_LABELS, SEWAGE_UNCERTAIN_QUALITIES, WATER_QUALITY_STATION_TYPE_LABELS, WATER_QUALITY_STATION_TYPES,
  CEMS_CODE2_LEAD_LABELS, CEMS_STATUSES, CWA_UV_LEVELS, ENV_ALERT_COLOR, ENV_STALE_COLOR, ENV_VALUE_FLAG_LABELS,
  NUSC_GAMMA_HIGH_USVH, OSM_ODBL_ATTRIBUTION, RIVER_RPI_TIDAL_LABELS, RIVER_RPI_ASSIGN_METHOD_LABELS, RIVER_RPI_DIRECTION_LABELS,
  RIVER_RPI_REASSIGN_METHOD, RIVER_RPI_REVIEW_FLAG_FALLBACK, RIVER_RPI_REVIEW_FLAG_LABELS, SEA_WATER_CLASSES,
  WATER_EFFLUENT_COORD_SOURCE_LABELS, WATER_EFFLUENT_STATUSES,
} from "../../data/environmentLayerTypes";
import { fetchCemsItems, fetchWaterEffluentItems, type CemsItem, type EffluentItem } from "../../data/environmentLiveLoaders";

type L = ReturnType<typeof useLocale>;

function text(value: unknown, fallback = ""): string {
  if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
  return String(value);
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function day(value: unknown): string {
  return text(value).slice(0, 10);
}

function fmt(i18n: L, value: number, digits = 2): string {
  return i18n.formatNumber(value, { maximumFractionDigits: digits });
}

/** 「值（註記）」：全形括號在中文介面維持原樣 */
function withNote(i18n: L, value: string, note: string): string {
  return i18n.t("popup.environmentLayer.valueWithNote", { value, note });
}

/** 低於偵測極限（*_censored='<'）時數值是極限值，不是實測值。 */
function measured(i18n: L, value: unknown, censored: unknown, unit: string): string {
  const parsed = number(value);
  if (parsed == null) return i18n.t("popup.environmentLayer.notMeasured");
  return `${censored === "<" ? "<" : ""}${fmt(i18n, parsed)} ${unit}`;
}

function place(...parts: unknown[]): string {
  return parts.map((part) => text(part)).filter(Boolean).join(" ");
}

function licenseText(i18n: L): string {
  return i18n.t("popup.environmentLayer.licenseGov");
}

export function RiverRpiStationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const rpi = number(props.latest_rpi);
  const cls = RIVER_RPI_CLASSES.find((row) => row.value === props.latest_class);
  const mean = number(props.rpi_12m_mean);
  const samples = number(props.n_samples_12m) ?? 0;
  const anyCensored = ["latest_do_censored", "latest_bod5_censored", "latest_ss_censored", "latest_nh3_n_censored"].some((key) => props[key] === "<");
  const noData = t("popup.common.noData");
  return <>
    <Title color={cls?.color ?? RIVER_RPI_NO_DATA_COLOR}>{text(props.site_name, t("popup.environmentLayer.riverStationDefault"))}</Title>
    <Row label="RPI" value={rpi == null ? t("popup.environmentLayer.noDataNotClean") : fmt(i18n, rpi)} color={rpi == null ? RIVER_RPI_NO_DATA_COLOR : undefined} />
    <Row label={t("popup.environmentLayer.pollutionLevel")} value={cls ? enumLabel("envRpiClass", cls.value, cls.label, i18n) : noData} color={cls?.color} />
    <Row label={t("popup.environmentLayer.sampleDate")} value={day(props.latest_rpi_date) || day(props.sample_date) || noData} />
    <Row label={t("popup.environmentLayer.dissolvedOxygen")} value={measured(i18n, props.latest_do, props.latest_do_censored, "mg/L")} />
    <Row label="BOD5" value={measured(i18n, props.latest_bod5, props.latest_bod5_censored, "mg/L")} />
    <Row label={t("popup.environmentLayer.suspendedSolids")} value={measured(i18n, props.latest_ss, props.latest_ss_censored, "mg/L")} />
    <Row label={t("popup.environmentLayer.ammoniaN")} value={measured(i18n, props.latest_nh3_n, props.latest_nh3_n_censored, "mg/L")} />
    <Row label={t("popup.environmentLayer.mean12m")} value={mean == null ? t("popup.environmentLayer.noSampleNotClean") : t("popup.environmentLayer.meanWithSamples", { count: samples, mean: fmt(i18n, mean) })} />
    <Row field="river" value={text(props.river)} />
    <Row field="basin" value={text(props.basin)} />
    <Row field="countyTownship" value={place(props.county, props.township)} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.gradeRule")} value={t("popup.environmentLayer.gradeRuleText")} />
      {anyCensored && <Row label={t("popup.environmentLayer.censoredLabel")} value={t("popup.environmentLayer.censoredText")} />}
      <Row field="updated" value={t("popup.environmentLayer.riverStationUpdated")} />
      <Row label={t("popup.environmentLayer.window12m")} value={text(props.rpi_12m_window)} />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcRiverStations"), source_url: "https://data.gov.tw/dataset/6078", license: licenseText(i18n), fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function WaterQualityStationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const type = text(props.station_type);
  const color = WATER_QUALITY_STATION_TYPES.find((row) => row.value === type)?.color ?? ENVIRONMENT_LAYER_COLORS.waterQualityStations;
  const readings = number(props.n_readings);
  const typeLabel = WATER_QUALITY_STATION_TYPE_LABELS[type];
  return <>
    <Title color={color}>{text(props.name, t("popup.environmentLayer.waterStationDefault"))}</Title>
    <Row field="type" value={typeLabel == null ? t("popup.common.unclassified") : enumLabel("envWaterStationType", type, typeLabel, i18n)} color={color} />
    <Row label={t("popup.environmentLayer.latestSample")} value={day(props.latest_sample_date) || t("popup.environmentLayer.noReadingNotClean")} />
    <Row label={t("popup.environmentLayer.readingCount")} value={readings == null ? "" : t("popup.environmentLayer.readingsValue", { count: readings, n: i18n.formatNumber(readings) })} />
    <Row field="stationStatus" value={props.is_active === true ? t("popup.environmentLayer.enabled") : props.is_active === false ? t("popup.environmentLayer.disabled") : ""} />
    <Row label={t("popup.environmentLayer.managingOrg")} value={text(props.agency)} />
    <Row field="river" value={text(props.river)} />
    <Row label={t("popup.environmentLayer.basinZone")} value={text(props.basin)} />
    <Row field="countyTownship" value={place(props.county, props.township)} />
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcWaterStation", { agency: text(props.agency, t("popup.environmentLayer.agencyDefault")) }), license: licenseText(i18n), fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function SewageTreatmentPlantsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const quality = text(props.geocode_quality);
  const uncertain = (SEWAGE_UNCERTAIN_QUALITIES as readonly string[]).includes(quality);
  const qualityLabel = SEWAGE_GEOCODE_QUALITY_LABELS[quality];
  return <>
    <Title color={ENVIRONMENT_LAYER_COLORS.sewageTreatmentPlants}>{text(props.name, t("popup.environmentLayer.sewageDefault"))}</Title>
    {uncertain && <Row field="location" value={t("popup.environmentLayer.sewageUncertain")} color={RIVER_RPI_NO_DATA_COLOR} />}
    <Row field="county" value={text(props.county)} />
    <Row field="address" value={text(props.address)} />
    <Row field="positionAccuracy" value={qualityLabel == null ? t("popup.common.notProvided") : enumLabel("envGeocodeQuality", quality, qualityLabel, i18n)} />
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcSewage"), source_url: "https://data.gov.tw/dataset/26496", license: licenseText(i18n), fetched_at: day(props.retrieved_at) }} />
  </>;
}

export function DrinkingWaterProtectionZonesPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const zone = DRINKING_WATER_ZONE_TYPES.find((row) => row.value === props.zone_type);
  return <>
    <Title color={zone?.color ?? ENVIRONMENT_LAYER_COLORS.drinkingWaterProtectionZones}>{text(props.name, t("popup.environmentLayer.drinkingDefault"))}</Title>
    <Row label={t("popup.environmentLayer.zoneType")} value={zone ? enumLabel("envDrinkingZone", zone.value, zone.label, i18n) : text(props.zone_type, t("popup.common.notProvided"))} color={zone?.color} />
    <Row label={t("popup.environmentLayer.delineation")} value={text(props.delineation)} />
    <Row label={t("popup.environmentLayer.waterBodyClass")} value={text(props.water_body_class)} />
    <Row label={t("popup.environmentLayer.intake")} value={text(props.intake_name)} />
    <Row field="county" value={text(props.county)} />
    <Row field="basin" value={text(props.basin)} />
    <Row field="legalBasis" value={text(props.legal_basis)} />
    <Row label={t("popup.environmentLayer.reminder")} value={t("popup.environmentLayer.drinkingNote")} />
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcDrinking"), source_url: "https://data.gov.tw/dataset/6377", license: licenseText(i18n), fetched_at: day(props.retrieved_at) }} />
  </>;
}

// ══════════════════════════════════════════════════════════════════
//  第二波（2026-10-02）
// ══════════════════════════════════════════════════════════════════

function withUnit(value: string, unit: string): string {
  return unit ? `${value} ${unit}` : value;
}

/** 測值＋上游旗標：lt_dl 時數值是偵測極限；null 依旗標說原因（ND／未測／未申報…），不寫 0。 */
function flagged(i18n: L, value: unknown, flag: unknown, unit: string, digits = 2): string {
  const { t } = i18n;
  const n = number(value);
  const f = text(flag);
  const zhReason = f ? ENV_VALUE_FLAG_LABELS[f] : undefined;
  const reason = f ? (zhReason == null ? t("popup.environmentLayer.hasNote") : enumLabel("envValueFlag", f, zhReason, i18n)) : "";
  if (f === "lt_dl") return n == null ? reason : withNote(i18n, withUnit(`<${fmt(i18n, n, digits)}`, unit), reason);
  if (n == null) return reason || t("popup.environmentLayer.notMeasured");
  return reason ? withNote(i18n, withUnit(fmt(i18n, n, digits), unit), reason) : withUnit(fmt(i18n, n, digits), unit);
}

function bool(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/** 「N 次（自 YYYY-MM-DD）」類計數列 */
function timesSince(i18n: L, count: unknown, since: unknown): string {
  const n = number(count);
  return n == null ? "" : i18n.t("popup.environmentLayer.timesSince", { count: n, n: fmt(i18n, n, 0), since: day(since) });
}

export function SeaWaterQualityStationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const cls = SEA_WATER_CLASSES.find((row) => row.value === props.water_quality_class);
  const stale = bool(props.is_stale) === true || props.latest_sample_date == null;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : cls?.color ?? ENVIRONMENT_LAYER_COLORS.seaWaterQualityStations}>{text(props.station_name, t("popup.environmentLayer.seaDefault"))}</Title>
    <Row label={t("popup.environmentLayer.seaArea")} value={text(props.sample_area)} />
    <Row label={t("popup.environmentLayer.seaClass")} value={cls ? enumLabel("envSeaClass", cls.value, cls.label, i18n) : t("popup.common.notProvided")} color={cls?.color} />
    <Row label={t("popup.environmentLayer.latestSample")} value={day(props.latest_sample_date) || t("popup.environmentLayer.noSampleRecord")} />
    {stale && <Row field="status" value={t("popup.environmentLayer.seaStale")} color={ENV_STALE_COLOR} />}
    <Row label={t("popup.environmentLayer.waterTemp")} value={flagged(i18n, props.water_temp_c, props.water_temp_c_flag, "°C", 1)} />
    <Row label="pH" value={flagged(i18n, props.ph, props.ph_flag, "", 2)} />
    <Row label={t("popup.environmentLayer.dissolvedOxygen")} value={flagged(i18n, props.do_ele_mgl, props.do_ele_mgl_flag, "mg/L")} title={t("popup.environmentLayer.doElectrodeNote")} />
    <Row label={t("popup.environmentLayer.suspendedSolids")} value={flagged(i18n, props.ss_mgl, props.ss_mgl_flag, "mg/L")} />
    <Row label={t("popup.environmentLayer.ammoniaN")} value={flagged(i18n, props.nh3_n_mgl, props.nh3_n_mgl_flag, "mg/L", 3)} />
    <Row field="county" value={text(props.county)} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row field="classification" value={t("popup.environmentLayer.seaClassNote")} />
      <Row field="updated" value={t("popup.environmentLayer.seaUpdated")} />
      <Row label={t("popup.environmentLayer.sampleCount")} value={timesSince(i18n, props.n_samples, props.first_sample_date)} />
      <Row field="stationNo" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcSea"), source_url: "https://data.gov.tw/dataset/155934", license: licenseText(i18n) }} />
  </>;
}

function rpiTarget(i18n: L, props: Record<string, unknown>): string {
  const node = text(props.to_node);
  if (node.startsWith("confluence:")) return i18n.t("popup.environmentLayer.rpiConfluence", { name: node.slice("confluence:".length) });
  if (node === "mouth") return i18n.t("popup.environmentLayer.rpiMouth");
  if (node === "unknown") return i18n.t("popup.environmentLayer.rpiEndUndetermined");
  return text(props.to_station_name, i18n.t("popup.environmentLayer.nextStation"));
}

/** 最下游段（無下一站）延伸到匯流點／河口：中間沒有測站；延伸到河口者可能受潮汐影響（未以潮位驗證）。 */
function rpiDownstreamNote(i18n: L, props: Record<string, unknown>): string {
  const node = text(props.to_node);
  if (node === "mouth") return i18n.t("popup.environmentLayer.rpiDownMouth");
  if (node.startsWith("confluence:") || node === "unknown") return i18n.t("popup.environmentLayer.rpiDownEnd");
  return "";
}

function rpiAssignment(i18n: L, props: Record<string, unknown>): string {
  const raw = text(props.river_raw);
  const assigned = text(props.river_assigned, text(props.river_name));
  if (props.assign_method === RIVER_RPI_REASSIGN_METHOD && raw && assigned && raw !== assigned) {
    return i18n.t("popup.environmentLayer.rpiReassigned", { raw, assigned });
  }
  return "";
}

/** review_flags（分號分隔）→ 白話；規則同 riverRpiReviewNotes，另依語系翻譯。 */
function reviewNotes(i18n: L, raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  const notes = raw.split(";").map((flag) => flag.trim()).filter(Boolean)
    .map((flag) => {
      if (!(flag in RIVER_RPI_REVIEW_FLAG_LABELS)) return enumLabel("envReviewFlag", "fallback", RIVER_RPI_REVIEW_FLAG_FALLBACK, i18n);
      const zh = RIVER_RPI_REVIEW_FLAG_LABELS[flag];
      return zh == null ? null : enumLabel("envReviewFlag", flag, zh, i18n);
    })
    .filter((note): note is string => note != null);
  return [...new Set(notes)];
}

export function RiverRpiSegmentsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const latest = RIVER_RPI_CLASSES.find((row) => row.value === props.class_latest);
  const mean = RIVER_RPI_CLASSES.find((row) => row.value === props.class_12m_mean);
  const rpi = number(props.rpi_latest);
  const rpiMean = number(props.rpi_12m_mean);
  const length = number(props.length_km);
  const distance = number(props.assign_distance_m);
  const direction = text(props.direction);
  const notes = reviewNotes(i18n, props.review_flags);
  const methodKey = text(props.assign_method);
  const method = RIVER_RPI_ASSIGN_METHOD_LABELS[methodKey];
  const noGrade = t("popup.environmentLayer.noGrade");
  const gradeLabel = (row: (typeof RIVER_RPI_CLASSES)[number] | undefined) => (row ? enumLabel("envRpiClass", row.value, row.label, i18n) : noGrade);
  const tidal = RIVER_RPI_TIDAL_LABELS[text(props.tidal)];
  const dirLabel = (key: string, zh: string) => enumLabel("envRpiDirection", key, zh, i18n);
  const nSamples = number(props.n_samples_12m) ?? 0;
  return <>
    <Title color={latest?.color ?? RIVER_RPI_NO_DATA_COLOR}>{t("popup.environmentLayer.segmentTitle", { name: text(props.river_name, t("popup.environmentLayer.segmentDefault")) })}</Title>
    <Row label={t("popup.environmentLayer.reach")} value={`${text(props.from_station_name, t("popup.environmentLayer.upstreamStation"))} → ${rpiTarget(i18n, props)}`} />
    <Row label={t("popup.environmentLayer.riverName")} value={rpiAssignment(i18n, props)} />
    <Row field="basin" value={text(props.basin)} />
    <Row label={t("popup.environmentLayer.latestRpi")} value={rpi == null ? t("popup.environmentLayer.noDataNotClean") : withNote(i18n, fmt(i18n, rpi), gradeLabel(latest))} color={latest?.color} />
    <Row label={t("popup.environmentLayer.sampleDate")} value={day(props.rpi_latest_date)} />
    <Row label={t("popup.environmentLayer.mean12m")} value={rpiMean == null ? t("popup.environmentLayer.noSampleNotClean") : t("popup.environmentLayer.meanWithGradeCount", { count: nSamples, value: fmt(i18n, rpiMean), grade: gradeLabel(mean), n: fmt(i18n, nSamples, 0) })} color={mean?.color} />
    <Row field="length" value={length == null ? "" : t("popup.environmentLayer.lengthKm", { value: fmt(i18n, length) })} />
    <Row label={t("popup.environmentLayer.tidal")} value={tidal == null ? t("popup.environmentLayer.undetermined") : enumLabel("envRpiTidal", text(props.tidal), tidal, i18n)} />
    <Row label={t("popup.environmentLayer.flowDirection")} value={direction === "verified" ? "" : (RIVER_RPI_DIRECTION_LABELS[direction] == null ? t("popup.environmentLayer.unverified") : dirLabel(direction, RIVER_RPI_DIRECTION_LABELS[direction]!))} />
    <Row label={t("popup.environmentLayer.toReview")} value={notes.join(t("popup.common.semicolon"))} />
    <PopupDetails summary={t("popup.environmentLayer.methodAndLimits")}>
      <Row field="method" value={t("popup.environmentLayer.methodText")} />
      <Row label={t("popup.environmentLayer.riverMatch")} value={method == null ? "" : `${enumLabel("envRpiAssign", methodKey, method, i18n)}${distance == null ? "" : t("popup.environmentLayer.assignDistance", { value: fmt(i18n, distance, 0) })}`} />
      <Row label={t("popup.environmentLayer.flowDirection")} value={direction === "verified" ? dirLabel("verified", RIVER_RPI_DIRECTION_LABELS.verified ?? "") : ""} />
      <Row label={t("popup.environmentLayer.downstream")} value={rpiDownstreamNote(i18n, props)} />
      <Row label={t("popup.environmentLayer.tidalSection")} value={t("popup.environmentLayer.tidalSectionText")} />
      <Row label={t("popup.environmentLayer.coverage")} value={t("popup.environmentLayer.coverageText")} />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcRpiSegments", { attribution: OSM_ODBL_ATTRIBUTION }), source_url: "https://data.gov.tw/dataset/6078", license: t("popup.environmentLayer.licenseOdbl", { license: licenseText(i18n) }) }} />
  </>;
}

export function Pm25ManualStationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const mean = number(props.mean_12m_ugm3);
  const latest = number(props.latest_pm25_ugm3);
  const active = bool(props.is_active);
  const nValid = number(props.n_valid_12m);
  const nRecords = number(props.n_records);
  const meanReason = ENV_VALUE_FLAG_LABELS[text(props.mean_12m_flag)];
  return <>
    <Title color={active === false || mean == null ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.pm25ManualStations}>{t("popup.environmentLayer.pm25Title", { name: text(props.station_name, t("popup.environmentLayer.pm25Default")) })}</Title>
    <Row label={t("popup.environmentLayer.mean12m")} value={mean == null ? (meanReason == null ? t("popup.environmentLayer.noValidSample") : enumLabel("envValueFlag", text(props.mean_12m_flag), meanReason, i18n)) : `${fmt(i18n, mean)} μg/m3`} />
    <Row label={t("popup.environmentLayer.validSamples")} value={nValid == null ? "" : t("popup.environmentLayer.validSamplesValue", { count: nValid, n: fmt(i18n, nValid, 0), window: text(props.mean_12m_window) })} />
    <Row label={t("popup.environmentLayer.latestRecord")} value={latest == null ? t("popup.environmentLayer.noValidValue") : withNote(i18n, `${fmt(i18n, latest, 1)} μg/m3`, day(props.latest_valid_date))} />
    <Row field="stationStatus" value={active === true ? t("popup.environmentLayer.sampling") : active === false ? t("popup.environmentLayer.stoppedHollow") : ""} color={active === false ? ENV_STALE_COLOR : undefined} />
    <Row field="county" value={text(props.county)} />
    <Row field="location" value={text(props.location_note, t("popup.environmentLayer.pm25Coordinates"))} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.samplingLabel")} value={text(props.sampling_note, t("popup.environmentLayer.pm25Sampling"))} />
      <Row label={t("popup.environmentLayer.cumulative")} value={nRecords == null ? "" : t("popup.environmentLayer.cumulativeValue", { count: nRecords, n: fmt(i18n, nRecords, 0), since: day(props.first_record_date) })} />
      <Row label={t("popup.environmentLayer.color")} value={t("popup.environmentLayer.pm25Color")} />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcPm25"), source_url: "https://data.gov.tw/dataset/6343", license: licenseText(i18n) }} />
  </>;
}

export function DioxinStationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const teq = number(props.latest_teq_pg_m3);
  const stale = bool(props.is_stale) === true;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.dioxinStations}>{text(props.station_name, t("popup.environmentLayer.dioxinDefault"))}</Title>
    <Row label={t("popup.environmentLayer.latestConcentration")} value={teq == null ? t("popup.environmentLayer.noValidValue") : `${fmt(i18n, teq, 4)} pg I-TEQ/m3`} />
    <Row label={t("popup.environmentLayer.sampleDate")} value={day(props.latest_sample_date)} />
    {stale && <Row field="status" value={t("popup.environmentLayer.dioxinStale")} color={ENV_STALE_COLOR} />}
    <Row label={t("popup.environmentLayer.sampleAddress")} value={text(props.sample_address)} />
    <Row field="sampleCount" value={timesSince(i18n, props.n_samples, props.first_sample_date)} />
    <Row field="county" value={text(props.county)} />
    <Row field="location" value={text(props.location_note)} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.samplingLabel")} value={text(props.sampling_note, t("popup.environmentLayer.dioxinSampling"))} />
      <Row label={t("popup.environmentLayer.color")} value={t("popup.environmentLayer.dioxinColor")} />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcDioxin"), source_url: "https://data.gov.tw/dataset/6353", license: licenseText(i18n) }} />
  </>;
}

function incineratorFurnaces(i18n: L, props: Record<string, unknown>) {
  const names = [
    i18n.t("popup.environmentLayer.furnace1"), i18n.t("popup.environmentLayer.furnace2"),
    i18n.t("popup.environmentLayer.furnace3"), i18n.t("popup.environmentLayer.furnace4"),
  ];
  return [1, 2, 3, 4].map((no) => {
    const value = props[`dioxin_f${no}_ng_teq_nm3`];
    const flag = props[`dioxin_f${no}_flag`];
    const date = day(props[`dioxin_f${no}_test_date`]);
    if (value == null && (flag == null || flag === "no_test") && !date) return null;
    const base = flagged(i18n, value, flag, "ng-TEQ/Nm3", 3);
    return { no, label: names[no - 1]!, value: date ? withNote(i18n, base, date) : base };
  }).filter((row): row is { no: number; label: string; value: string } => row != null);
}

export function IncineratorEmissionsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const max = number(props.dioxin_max_ng_teq_nm3);
  const unusual = bool(props.unusual_output);
  const nMonths = number(props.n_months);
  return <>
    <Title color={ENVIRONMENT_LAYER_COLORS.incineratorEmissions}>{text(props.plant_name, t("popup.environmentLayer.incineratorDefault"))}</Title>
    <Row label={t("popup.environmentLayer.reportMonth")} value={text(props.latest_month)} />
    <Row label={t("popup.environmentLayer.nox")} value={flagged(i18n, props.nox_ppm, props.nox_ppm_flag, "ppm", 1)} />
    <Row label={t("popup.environmentLayer.sox")} value={flagged(i18n, props.sox_ppm, props.sox_ppm_flag, "ppm", 2)} />
    <Row label={t("popup.environmentLayer.hcl")} value={flagged(i18n, props.hcl_ppm, props.hcl_ppm_flag, "ppm", 2)} />
    <Row label="COx" value={flagged(i18n, props.cox_ppm, props.cox_ppm_flag, "ppm", 2)} />
    <Row label={t("popup.environmentLayer.dust")} value={props.dust_mg_nm3 == null ? t("popup.environmentLayer.notReported") : flagged(i18n, props.dust_mg_nm3, props.dust_mg_nm3_flag, "mg/Nm3", 2)} />
    <Row label={t("popup.environmentLayer.opacity")} value={flagged(i18n, props.opacity_pct, props.opacity_pct_flag, "%", 2)} />
    <Row label={t("popup.environmentLayer.dioxinMax")} value={max == null ? t("popup.environmentLayer.noValidTest") : `${fmt(i18n, max, 3)} ng-TEQ/Nm3`} />
    {incineratorFurnaces(i18n, props).map((row) => <Row key={row.no} label={`　${row.label}`} value={row.value} />)}
    {unusual != null && <Row label={t("popup.environmentLayer.unusualReport")} value={unusual ? t("popup.environmentLayer.reportedThatMonth") : t("popup.environmentLayer.noneThatMonth")} color={unusual ? ENV_ALERT_COLOR : undefined} />}
    <Row field="county" value={text(props.county)} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row field="updated" value={t("popup.environmentLayer.incineratorUpdated")} />
      <Row label={t("popup.environmentLayer.compare")} value={t("popup.environmentLayer.compareText")} />
      <Row field="location" value={text(props.location_note)} />
      <Row label={t("popup.environmentLayer.reportPeriod")} value={nMonths == null ? "" : t("popup.environmentLayer.monthsSince", { count: nMonths, n: fmt(i18n, nMonths, 0), since: text(props.first_month) })} />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcIncinerator"), source_url: "https://data.gov.tw/dataset/6368", license: licenseText(i18n) }} />
  </>;
}

// ── 即時 4 層 ───────────────────────────────────────────────────

export function NuscGammaRadiationPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const dose = number(props.dose_usvh);
  const stale = bool(props.is_stale) === true;
  const high = dose != null && dose >= NUSC_GAMMA_HIGH_USVH;
  return <>
    <Title color={stale ? ENV_STALE_COLOR : ENVIRONMENT_LAYER_COLORS.nuscGammaRadiation}>{text(props.station_name, t("popup.environmentLayer.nuscDefault"))}</Title>
    <Row label={t("popup.environmentLayer.doseRate")} value={dose == null ? t("popup.environmentLayer.noReading") : `${fmt(i18n, dose, 3)} μSv/h`} color={high ? ENV_ALERT_COLOR : undefined} />
    <Row field="observedAt" value={formatTaiwanTime(text(props.observed_at) || null) || t("popup.common.none")} mono />
    {stale && <Row field="status" value={t("popup.environmentLayer.nuscStale")} color={ENV_STALE_COLOR} />}
    {high && <Row label={t("popup.environmentLayer.reminder")} value={t("popup.environmentLayer.nuscHigh")} color={ENV_ALERT_COLOR} />}
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.background")} value={t("popup.environmentLayer.nuscBackground")} />
      <Row field="updated" value={t("popup.environmentLayer.nuscUpdated")} />
      <Row label={t("popup.environmentLayer.distinction")} value={t("popup.environmentLayer.nuscDistinction")} />
      <Row label={t("popup.environmentLayer.stationCode")} value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcNusc"), source_url: "https://data.gov.tw/dataset/119233", license: licenseText(i18n), fetched_at: formatTaiwanTime(text(props.updated_at) || null) }} />
  </>;
}

/** popup 開啟時才用設施代號拉全部測項（地圖只帶彙總）；loading／錯誤各自顯示，不畫假資料。 */
function useLiveItems<T>(cno: string, fetcher: (cno: string) => Promise<T[]>) {
  const [state, setState] = useState<{ items: T[] | null; error: boolean }>({ items: null, error: false });
  useEffect(() => {
    if (!cno) { setState({ items: [], error: false }); return; }
    let cancelled = false;
    setState({ items: null, error: false });
    fetcher(cno)
      .then((items) => { if (!cancelled) setState({ items, error: false }); })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[envLive] 測項明細載入失敗:", err);
        setState({ items: null, error: true });
      });
    return () => { cancelled = true; };
  }, [cno, fetcher]);
  return state;
}

function effluentItemRow(i18n: L, item: EffluentItem, index: number) {
  const { t } = i18n;
  const value = item.value == null ? t("popup.environmentLayer.noValue") : withUnit(fmt(i18n, item.value, 3), item.unit ?? "");
  const std = item.std1 != null || item.std2 != null ? t("popup.environmentLayer.standardPart", { value: [item.std1, item.std2].filter((v) => v != null).join("–") }) : "";
  const name = item.item ?? t("popup.environmentLayer.itemDefault");
  return <Row key={index} label={item.outlet_no ? withNote(i18n, name, String(item.outlet_no)) : name} value={`${value}・${item.status ?? t("popup.environmentLayer.statusMissing")}${std}`}
    color={item.is_exceed ? ENV_ALERT_COLOR : item.status && item.status !== "正常值" ? WATER_EFFLUENT_STATUSES[1].color : undefined} />;
}

export function WaterEffluentLivePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const status = text(props.status);
  const meta = WATER_EFFLUENT_STATUSES.find((row) => row.value === status);
  const { items, error } = useLiveItems(text(props.cno), fetchWaterEffluentItems);
  const flaggedItems = (items ?? []).filter((item) => item.is_exceed || (item.status && item.status !== "正常值"));
  const normalItems = (items ?? []).filter((item) => !(item.is_exceed || (item.status && item.status !== "正常值")));
  const coordLabel = WATER_EFFLUENT_COORD_SOURCE_LABELS[text(props.coord_source)];
  return <>
    <Title color={status === "stale" ? ENV_STALE_COLOR : meta?.color ?? ENVIRONMENT_LAYER_COLORS.waterEffluentLive}>{text(props.facility_name, t("popup.environmentLayer.effluentDefault"))}</Title>
    <Row field="status" value={status === "stale" ? t("popup.environmentLayer.effluentStale") : meta ? enumLabel("envEffluentStatus", meta.value, meta.label, i18n) : t("popup.common.unknown")} color={status === "stale" ? ENV_STALE_COLOR : meta?.color} />
    <Row field="observedAt" value={formatTaiwanTime(text(props.observed_at) || null) || t("popup.common.none")} mono />
    <Row field="measurement" value={t("popup.environmentLayer.effluentSummary", { items: fmt(i18n, number(props.item_count) ?? 0, 0), exceed: fmt(i18n, number(props.exceed_count) ?? 0, 0), abnormal: fmt(i18n, number(props.abnormal_count) ?? 0, 0) })} />
    <Row field="county" value={text(props.county)} />
    <Row field="coordSource" value={coordLabel == null ? t("popup.common.notProvided") : enumLabel("envEffluentCoord", text(props.coord_source), coordLabel, i18n)} />
    {error && <Row field="measurementDetails" value={t("popup.environmentLayer.liveError")} color={ENV_ALERT_COLOR} />}
    {!error && items == null && <Row field="measurementDetails" value={t("popup.common.loading")} />}
    {flaggedItems.map((item, index) => effluentItemRow(i18n, item, index))}
    {normalItems.length > 0 && <PopupDetails summary={t("popup.environmentLayer.otherNormalItems", { count: normalItems.length })}><PopupScroll>{normalItems.map((item, index) => effluentItemRow(i18n, item, index))}</PopupScroll></PopupDetails>}
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.judge")} value={t("popup.environmentLayer.effluentJudge")} />
      <Row field="updated" value={t("popup.environmentLayer.effluentUpdated")} />
      <Row label={t("popup.environmentLayer.controlNo")} value={text(props.cno)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcEffluent"), source_url: "https://data.gov.tw/dataset/35105", license: licenseText(i18n) }} />
  </>;
}

const CEMS_SOURCE_LABELS: Record<string, string> = { stack_1h: "煙道", flare_1h: "燃燒塔" };

function cemsItemRow(i18n: L, item: CemsItem, index: number) {
  const { t } = i18n;
  const value = item.value == null ? t("popup.environmentLayer.noValue") : withUnit(fmt(i18n, item.value, 2), item.unit ?? "");
  const std = item.std_value != null ? t("popup.environmentLayer.standardPart", { value: fmt(i18n, item.std_value, 2) }) : "";
  const name = item.item ?? item.item_code ?? t("popup.environmentLayer.itemDefault");
  return <Row key={index} label={item.point_no ? withNote(i18n, name, String(item.point_no)) : name}
    value={`${value}${std}・${item.code2_desc ?? t("popup.environmentLayer.statusMissing")}`} color={item.is_exceed ? ENV_ALERT_COLOR : undefined} />;
}

export function CemsStackLivePanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const status = text(props.status);
  const meta = CEMS_STATUSES.find((row) => row.value === status);
  const comma = t("popup.common.listSeparator");
  const summary = text(props.code2_summary).split("、").filter(Boolean).map((part) => {
    const [lead, n] = part.split("×");
    const zh = CEMS_CODE2_LEAD_LABELS[lead ?? ""];
    return t("popup.environmentLayer.cemsSummaryPart", { label: zh == null ? t("popup.environmentLayer.other") : enumLabel("envCemsLead", lead ?? "", zh, i18n), n: n ?? "" });
  }).join(comma);
  const { items, error } = useLiveItems(text(props.cno), fetchCemsItems);
  const exceedItems = (items ?? []).filter((item) => item.is_exceed);
  const otherItems = (items ?? []).filter((item) => !item.is_exceed);
  return <>
    <Title color={status === "stale" ? ENV_STALE_COLOR : meta?.color ?? ENVIRONMENT_LAYER_COLORS.cemsStackLive}>{text(props.facility_name, t("popup.environmentLayer.cemsDefault"))}</Title>
    <Row field="status" value={status === "stale" ? t("popup.environmentLayer.cemsStale") : status === "unknown" ? t("popup.environmentLayer.cemsUnknownStatus") : meta ? enumLabel("envCemsStatus", meta.value, meta.label, i18n) : t("popup.common.unknown")} color={status === "stale" || status === "unknown" ? ENV_STALE_COLOR : meta?.color} />
    <Row field="observedAt" value={formatTaiwanTime(text(props.observed_at) || null) || t("popup.common.none")} mono />
    <Row label={t("popup.environmentLayer.delay")} value={t("popup.environmentLayer.cemsDelay")} />
    <Row label={t("popup.environmentLayer.operatingStatus")} value={summary} />
    <Row field="measurement" value={t("popup.environmentLayer.cemsSummary", { items: fmt(i18n, number(props.item_count) ?? 0, 0), exceed: fmt(i18n, number(props.exceed_count) ?? 0, 0) })} />
    <Row label={t("popup.environmentLayer.monitorType")} value={text(props.sources).split("、").map((src) => (CEMS_SOURCE_LABELS[src] == null ? src : enumLabel("envCemsSource", src, CEMS_SOURCE_LABELS[src], i18n))).join(comma)} />
    <Row field="county" value={text(props.county)} />
    {error && <Row field="measurementDetails" value={t("popup.environmentLayer.liveError")} color={ENV_ALERT_COLOR} />}
    {!error && items == null && <Row field="measurementDetails" value={t("popup.common.loading")} />}
    {exceedItems.map((item, index) => cemsItemRow(i18n, item, index))}
    {otherItems.length > 0 && <PopupDetails summary={t("popup.environmentLayer.otherItems", { count: otherItems.length })}><PopupScroll>{otherItems.map((item, index) => cemsItemRow(i18n, item, index))}</PopupScroll></PopupDetails>}
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.judge")} value={t("popup.environmentLayer.cemsJudge")} />
      <Row label={t("popup.common.coordinates")} value={t("popup.environmentLayer.cemsCoords")} />
      <Row label={t("popup.environmentLayer.controlNo")} value={text(props.cno)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcCems"), source_url: "https://data.gov.tw/dataset/31968", license: licenseText(i18n) }} />
  </>;
}

export function CwaUvDailyPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const level = CWA_UV_LEVELS.find((row) => row.value === props.uv_level);
  const uv = number(props.uv_index);
  const stale = bool(props.is_stale) === true;
  const missing = t("popup.common.missingValue");
  return <>
    <Title color={stale || !level ? ENV_STALE_COLOR : level.color}>{t("popup.environmentLayer.uvTitle", { name: text(props.station_name, t("popup.environmentLayer.uvDefault")) })}</Title>
    <Row label={t("popup.environmentLayer.uvIndex")} value={uv == null ? missing : fmt(i18n, uv, 1)} />
    <Row field="level" value={level ? enumLabel("envUvLevel", level.value, level.label, i18n) : missing} color={level?.color} />
    <Row field="date" value={t("popup.environmentLayer.uvDate", { date: day(props.obs_date) })} />
    {stale && <Row field="status" value={t("popup.environmentLayer.uvStale")} color={ENV_STALE_COLOR} />}
    <Row field="county" value={text(props.county)} />
    <PopupDetails summary={t("popup.common.notesAndLimits")}>
      <Row label={t("popup.environmentLayer.dataLabel")} value={t("popup.environmentLayer.uvText")} />
      <Row field="updated" value={t("popup.environmentLayer.uvUpdated")} />
      <Row field="stationNo" value={text(props.station_id)} mono />
    </PopupDetails>
    <SourceFooter props={{ source_org: t("popup.environmentLayer.srcUv"), source_url: "https://data.gov.tw/dataset/9039", license: licenseText(i18n), fetched_at: formatTaiwanTime(text(props.collected_at) || null) }} />
  </>;
}
