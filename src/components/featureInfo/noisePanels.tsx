// 噪音／聲響六圖層 popup。
// 這些資料分別是觀測、法定區、裁處與設備清單，不共用「噪音分數」語意。
import type { PanelProps } from "./registry";
import { Badge, Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName, placeTown } from "../../i18n/placeText";
import { PENALTY_SEVERITY_LABELS, type PollutionPenaltySeverity } from "../../data/pollutionTypes";

type L = ReturnType<typeof useLocale>;

function makeFmt(i18n: L) {
  const { t, formatNumber } = i18n;
  const text = (value: unknown, fallback = t("popup.common.notProvided")): string => {
    if (value == null || value === "" || value === "null" || value === "undefined") return fallback;
    return String(value);
  };
  const db = (value: unknown, fallback = t("popup.noise.noVerified")): string => {
    const parsed = number(value);
    return parsed == null ? fallback : `${parsed.toFixed(1)} dB`;
  };
  const count = (value: unknown, unit: string): string => {
    const parsed = number(value);
    return parsed == null ? t("popup.common.notProvided") : `${formatNumber(parsed)} ${unit}`;
  };
  const dateRange = (start: unknown, end: unknown, fallback = t("popup.noise.noVerified")): string => {
    if (start == null || start === "" || end == null || end === "") return fallback;
    return `${String(start)} ～ ${String(end)}`;
  };
  return { text, db, count, dateRange };
}

function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yes(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function SourceRows({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text } = makeFmt(i18n);
  // 來源機關與原始資料頁由 FeatureInfoPanel 統一掛的 SourceFooter 顯示，這裡只留 footer 沒有的欄位
  return (
    <>
      <Row field="sourceId" value={text(props.source_dataset_id, t("popup.common.notProvided"))} />
      <Row label={t("popup.noise.sourceUpdated")} value={text(props.source_updated_at, t("popup.common.notProvided"))} />
      <Row field="license" value={text(props.source_license, t("popup.common.notProvided"))} />
    </>
  );
}

const PERIOD_LABELS: Record<string, string> = {
  day: "日間 day",
  evening: "晚間 evening",
  night: "夜間 night",
  unavailable: "無已驗資料",
};

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "近期 fresh",
  historical: "歷史資料 historical",
  unavailable: "無已驗 dB",
};

const PRECISION_LABELS: Record<string, string> = {
  official_point: "官方測站點位",
  official_polygon: "官方公告 polygon",
  admin_join: "公告名單套疊村里界",
  geocoded_address: "地址定位",
  road_segment: "路段約略位置",
  fuzzy: "模糊位置",
  unlocated: "待補定位",
  facility_join: "設施座標 join",
  address_exact: "地址精確定位",
  address_osm: "地址（OSM）",
  parcel: "地號補點",
  approx: "約略位置",
  unknown: "未知",
};

export function OfficialNoiseMonitoringPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text, db, count, dateRange } = makeFmt(i18n);
  const precisionLabel = (code: string) => enumLabel("noisePrecision", code, PRECISION_LABELS[code] ?? code, i18n);
  const period = text(props.period_type, "unavailable");
  const freshness = text(props.freshness_status, "unavailable");
  const activeDays = number(props.active_days);
  const windowDays = number(props.window_days);
  const ratio = number(props.active_day_ratio);
  const coverage = activeDays == null || windowDays == null
    ? t("popup.common.notProvided")
    : ratio == null
      ? t("popup.noise.coverageDays", { active: activeDays, window: windowDays })
      : t("popup.noise.coverageDaysRatio", { active: activeDays, window: windowDays, ratio: (ratio * 100).toFixed(1) });
  const freshnessDays = number(props.freshness_days);

  return (
    <div>
      <Row field="station" value={text(props.station_name)} />
      <Row label={t("popup.noise.stationId")} value={text(props.station_id)} />
      <Row field="county" value={placeName(text(props.county), i18n)} />
      <Row field="address" value={text(props.address)} />
      <Row label={t("popup.noise.stationType")} value={text(props.station_type)} />
      <Row field="stationStatus" value={text(props.station_status)} />
      <Row label={t("popup.noise.areaType")} value={text(props.area_type)} />
      <Row label={t("popup.noise.period")} value={enumLabel("noisePeriod", period, PERIOD_LABELS[period] ?? period, i18n)} />
      <Row label={t("popup.noise.laeqSample")} value={db(props.laeq_window_db)} color={number(props.laeq_window_db) == null ? "#94a3b8" : undefined} />
      <Row label={t("popup.noise.window")} value={dateRange(props.window_start, props.window_end)} />
      <Row label={t("popup.noise.latestObs")} value={text(props.latest_observation_date, t("popup.noise.noVerified"))} />
      <Row label={t("popup.noise.coverage")} value={coverage} />
      <Row field="sampleCount" value={count(props.sample_count, t("popup.noise.unitRecord"))} />
      <Row label={t("popup.noise.representedSeconds")} value={count(props.represented_seconds, t("popup.noise.unitSecond"))} />
      <Row label={t("popup.noise.freshness")} value={enumLabel("noiseFreshness", freshness, FRESHNESS_LABELS[freshness] ?? freshness, i18n)} />
      <Row label={t("popup.noise.sinceNow")} value={freshnessDays == null ? t("popup.noise.noVerified") : t("popup.noise.daysAgo", { days: freshnessDays })} />
      <Row label={t("popup.noise.spatialPrecision")} value={precisionLabel(text(props.spatial_precision, "unknown"))} />
      <Row field="sourceId" value={text(props.source_dataset_id)} />
      <Row label={t("popup.noise.sourceUpdated")} value={text(props.source_updated_at)} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.monitoringNote")}
      </div>
    </div>
  );
}

export function NoiseCaptureGridPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text, db, count, dateRange } = makeFmt(i18n);
  const provisional = yes(props.is_provisional);
  const scale = number(props.scale_m);
  const freshnessDays = number(props.freshness_days);
  const gpsAccuracy = number(props.gps_accuracy_p50);
  return (
    <div>
      <Row label={t("popup.noise.gridId")} value={text(props.grid_id)} />
      <Row label={t("popup.noise.laeqSample")} value={db(props.laeq_energy_db)} />
      <Row label={t("popup.noise.typicalTrack")} value={db(props.typical_track_laeq_db)} />
      <Row label="LA50" value={db(props.la50_db)} />
      <Row label={t("popup.noise.scale")} value={scale == null ? t("popup.common.notProvided") : `${i18n.formatNumber(scale)} m`} />
      <Row label={t("popup.noise.measureTime")} value={count(props.measure_seconds, t("popup.noise.unitSecond"))} />
      <Row label={t("popup.noise.trackCount")} value={count(props.track_count, t("popup.noise.unitTrack"))} />
      <Row label={t("popup.noise.activeDays")} value={count(props.active_days, t("popup.noise.unitDay"))} />
      <Row label={t("popup.noise.daypartCount")} value={count(props.daypart_count, t("popup.noise.unitKind"))} />
      <Row label={t("popup.noise.measureRange")} value={dateRange(props.measurement_start_date, props.measurement_end_date, t("popup.common.notProvided"))} />
      <Row label={t("popup.noise.freshness")} value={text(props.freshness_class)} />
      <Row label={t("popup.noise.sinceNow")} value={freshnessDays == null ? t("popup.common.notProvided") : t("popup.noise.daysAgo", { days: freshnessDays })} />
      <Row label={t("popup.noise.qualityTier")} value={text(props.quality_tier)} />
      <Row label="GPS P50" value={gpsAccuracy == null ? t("popup.common.notProvided") : `${gpsAccuracy.toFixed(1)} m`} />
      <Row label={t("popup.noise.sourceKind")} value={text(props.source_kind)} />
      <Row field="snapshotDate" value={text(props.source_snapshot_at)} />
      <div style={{ marginTop: 7 }}>
        <Badge label={provisional ? t("popup.noise.provisional") : t("popup.noise.passedThreshold")} on={provisional} color="#f59e0b" />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.captureNote")}
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
        NoiseCapture / Noise-Planet contributors · ODbL-1.0 / DbCL-1.0
      </div>
    </div>
  );
}

export function NoiseControlZonesPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text } = makeFmt(i18n);
  const repaired = yes(props.geometry_repaired);
  const area = number(props.area_km2);
  const zoneClass = number(props.zone_class);
  const zoneClassLabel = zoneClass != null && zoneClass >= 1 && zoneClass <= 4
    ? enumLabel("noiseZoneClass", zoneClass, ["第一類", "第二類", "第三類", "第四類"][zoneClass - 1] ?? text(props.zone_class), i18n)
    : text(props.zone_class);
  return (
    <div>
      <Row label={t("popup.noise.zoneName")} value={text(props.zone_name)} />
      <Row field="category" value={zoneClassLabel} />
      <Row field="county" value={placeName(text(props.county), i18n)} />
      <Row label={t("popup.noise.legalVersion")} value={text(props.legal_version)} />
      <Row label={t("popup.noise.announceYearRoc")} value={text(props.effective_year_roc, t("popup.noise.notStated"))} />
      <Row label={t("popup.noise.announceYear")} value={text(props.effective_year, t("popup.noise.notStated"))} />
      <Row label={t("popup.noise.announceNo")} value={text(props.announcement_no, t("popup.noise.notStated"))} />
      <Row label={t("popup.noise.spatialPrecision")} value={text(props.spatial_precision)} />
      <Row field="area" value={area == null ? t("popup.common.notProvided") : `${area.toFixed(2)} km²`} />
      <Row label={t("popup.noise.geometryRepaired")} value={repaired ? t("popup.noise.repairedYes") : t("popup.common.no")} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.zoneNote")}
      </div>
    </div>
  );
}

export function AviationNoiseZonesPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text, count } = makeFmt(i18n);
  const precisionLabel = (code: string) => enumLabel("noisePrecision", code, PRECISION_LABELS[code] ?? code, i18n);
  const area = number(props.area_km2);
  const measured = yes(props.is_measured_contour);
  return (
    <div>
      <Row field="village" value={`${placeName(text(props.county), i18n)} ${placeTown(String(props.county ?? ""), text(props.town), i18n)} ${text(props.village)}`} />
      <Row label={t("popup.noise.villageCode")} value={text(props.village_code)} />
      <Row label={t("popup.noise.displayLevel")} value={t("popup.noise.levelN", { level: text(props.display_zone_level) })} />
      <Row label={t("popup.noise.allLevels")} value={text(props.zone_levels)} />
      <Row label={t("popup.noise.membershipCount")} value={count(props.membership_count, t("popup.noise.unitRecord"))} />
      <Row label={t("popup.noise.legalUnit")} value={text(props.legal_unit)} />
      <Row label={t("popup.noise.legalVersion")} value={text(props.legal_version)} />
      <Row label={t("popup.noise.effectiveDate")} value={text(props.effective_date, t("popup.noise.notStated"))} />
      <Row label={t("popup.noise.boundaryVersion")} value={text(props.boundary_version)} />
      <Row label={t("popup.noise.spatialPrecision")} value={precisionLabel(text(props.spatial_precision))} />
      <Row label={t("popup.noise.measuredContour")} value={measured ? t("popup.common.yes") : t("popup.common.no")} />
      <Row field="area" value={area == null ? t("popup.common.notProvided") : `${area.toFixed(2)} km²`} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.aviationNote")}
      </div>
    </div>
  );
}

export function NoiseEnforcementEventsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text } = makeFmt(i18n);
  const precisionLabel = (code: string) => enumLabel("noisePrecision", code, PRECISION_LABELS[code] ?? code, i18n);
  const money = number(props.penalty_money);
  const precision = text(props.geocode_precision, "unknown");
  const severity = text(props.severity_event, "normal") as PollutionPenaltySeverity;
  return (
    <div>
      <Row label={t("popup.noise.respondent")} value={text(props.fac_name)} />
      <Row field="county" value={placeName(text(props.county), i18n)} />
      <Row field="penaltyDate" value={text(props.penalty_date)} />
      <Row field="penaltyType" value={text(props.transgress_type)} />
      <Row field="lawViolated" value={text(props.transgress_law)} />
      <Row field="violationFact" value={text(props.violation_fact)} />
      <Row field="fine" value={money == null ? t("popup.common.notProvided") : money > 0 ? `NT$ ${i18n.formatNumber(money)}` : t("popup.noise.noFine")} />
      <Row label={t("popup.noise.severityEvent")} value={enumLabel("pollutionPenaltySeverity", severity, PENALTY_SEVERITY_LABELS[severity] ?? severity, i18n)} />
      <Row field="severityReason" value={text(props.severity_reason)} />
      <Row field="positionAccuracy" value={precisionLabel(precision)} />
      <Row label={t("popup.noise.documentNo")} value={text(props.document_no)} />
      <Row field="eventId" value={text(props.event_id)} />
      <Row label={t("popup.noise.dataKind")} value={text(props.source_kind)} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.enforcementNote")}
      </div>
    </div>
  );
}

export function SoundCameraLocationsPanel({ props }: PanelProps) {
  const i18n = useLocale();
  const { t } = i18n;
  const { text } = makeFmt(i18n);
  const precisionLabel = (code: string) => enumLabel("noisePrecision", code, PRECISION_LABELS[code] ?? code, i18n);
  const precision = text(props.spatial_precision, "unknown");
  const renderable = yes(props.is_renderable);
  const equipmentStatus = text(props.equipment_status, "not_provided");
  return (
    <div>
      <Row field="name" value={text(props.location_name)} />
      <Row field="county" value={placeName(text(props.county), i18n)} />
      <Row label={t("popup.noise.expectedTown")} value={placeTown(String(props.county ?? ""), text(props.expected_town, t("popup.common.notProvided")), i18n)} />
      <Row label={t("popup.noise.rawLocation")} value={text(props.raw_location)} />
      <Row label={t("popup.noise.fullAddress")} value={text(props.full_address)} />
      <Row field="positionAccuracy" value={precisionLabel(precision)} />
      <Row label={t("popup.noise.geocodeMethod")} value={text(props.geocode_method, t("popup.common.notProvided"))} />
      <Row label={t("popup.noise.geocodeReference")} value={text(props.geocode_reference, t("popup.common.notProvided"))} />
      <Row label={t("popup.noise.spatialValidation")} value={text(props.spatial_validation_status)} />
      <Row label={t("popup.noise.boundaryLocation")} value={[placeName(String(props.boundary_county ?? ""), i18n), placeTown(String(props.boundary_county ?? ""), String(props.boundary_town ?? ""), i18n), props.boundary_village == null ? "" : String(props.boundary_village)].filter((v) => v !== "").join(" ") || t("popup.common.notProvided")} />
      <Row label={t("popup.noise.equipmentStatus")} value={equipmentStatus === "not_provided" ? t("popup.noise.equipmentNotProvided") : equipmentStatus} />
      <Row label={t("popup.noise.renderable")} value={renderable ? t("popup.common.yes") : t("popup.noise.renderableNo")} />
      <Row label={t("popup.noise.listMeaning")} value={props.represents ? t("popup.noise.listMeaningValue") : t("popup.common.notProvided")} />
      <SourceRows props={props} />
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup.noise.cameraNote")}
      </div>
    </div>
  );
}
