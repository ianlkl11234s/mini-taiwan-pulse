import { Row } from "./shared";
import { localeStore, useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { useFeatureTheme } from "./featureTheme";
import { parseGfwHourlyGridVessels, type GfwHourlyGridVessel } from "../../data/gfwHourlyGridTypes";
import { GLOBAL_EVENT_CATEGORIES, GLOBAL_EVENT_SEVERITIES, globalEventCategoryLabel, globalEventSeverityLabel } from "../../data/globalEventsTypes";
import { FONT_SIZE } from "../../styles/designTokens";

type I18n = ReturnType<typeof useLocale>;

function fmtAge(ts: unknown, { t }: I18n): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const now = Math.floor(Date.now() / 1000);
  const dt = now - ts;
  if (dt < 60) return t("popup.globalClimate.ageSeconds", { value: dt });
  if (dt < 3600) return t("popup.globalClimate.ageMinutes", { value: Math.floor(dt / 60) });
  if (dt < 86400) return t("popup.globalClimate.ageHours", { value: Math.floor(dt / 3600) });
  return t("popup.globalClimate.ageDays", { value: Math.floor(dt / 86400) });
}

function fmtTime(ts: unknown, { formatDateTime }: I18n): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  return formatDateTime(d, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
}

// 與 useEarthquakesGlobalLayer 的 COLOR_EXPR 同步
function depthColor(depth: number): string {
  if (depth <= 30) return "#dc2626";
  if (depth <= 70) return "#f97316";
  if (depth <= 150) return "#facc15";
  if (depth <= 300) return "#38bdf8";
  return "#3949ab";
}

function magBadgeColor(mag: number): string {
  if (mag >= 7) return "#dc2626";
  if (mag >= 6) return "#ef4444";
  if (mag >= 5) return "#f97316";
  if (mag >= 4) return "#facc15";
  return "#94a3b8";
}

export function EarthquakeGlobalPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const mag = typeof props.mag === "number" ? props.mag : null;
  const depth = typeof props.depth_km === "number" ? props.depth_km : null;
  const magColor = mag != null ? magBadgeColor(mag) : t.textDim;
  const dColor = depth != null ? depthColor(depth) : t.textDim;
  return (
    <div>
      <Row field="place" value={String(props.place ?? "—")} />
      <Row
        label={i18n.t("popup.globalClimate.magnitude")}
        value={mag != null ? `M ${mag.toFixed(1)}` : "—"}
        color={magColor}
      />
      <Row
        label={i18n.t("popup.globalClimate.depth")}
        value={depth != null ? `${depth.toFixed(1)} km` : "—"}
        color={dColor}
      />
      <Row label={i18n.t("popup.globalClimate.occurredTime")} value={fmtTime(props.observed_ts, i18n)} />
      <Row field="age" value={fmtAge(props.observed_ts, i18n)} />
      <Row label="USGS ID" value={String(props.event_id ?? "—")} />
    </div>
  );
}

export function TyphoonTrackPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const pointType = String(props.point_type ?? "");
  const isFcst = pointType === "forecast";
  const wind = typeof props.max_wind_kt === "number" ? props.max_wind_kt : null;
  const pressure = typeof props.center_pressure === "number" ? props.center_pressure : null;
  const adv = typeof props.advisory_number === "number" ? props.advisory_number : null;
  const sourceLabel = String(props.source ?? "—").toUpperCase();
  return (
    <div>
      <Row
        field="name"
        value={`${String(props.name_en ?? "")}${
          props.name_local ? ` (${String(props.name_local)})` : ""
        }`}
      />
      <Row field="number" value={String(props.storm_id ?? "—")} />
      <Row
        field="type"
        value={i18n.t(isFcst ? "popup.globalClimate.typhoonForecast" : "popup.globalClimate.typhoonObserved")}
        color={isFcst ? "#c084fc" : "#a855f7"}
      />
      <Row field="dataSource" value={sourceLabel} />
      {adv != null && <Row label="Advisory" value={`#${adv}`} />}
      <Row
        label={i18n.t("popup.globalClimate.maxWind")}
        value={wind != null ? i18n.t("popup.globalClimate.maxWindValue", { kt: wind.toFixed(0), kmh: (wind * 1.852).toFixed(0) }) : "—"}
        color={wind != null && wind >= 64 ? "#dc2626" : undefined}
      />
      <Row
        label={i18n.t("popup.globalClimate.centerPressure")}
        value={pressure != null ? `${pressure.toFixed(0)} hPa` : "—"}
        color={pressure != null && pressure <= 970 ? "#ef4444" : undefined}
      />
      <Row label={i18n.t("popup.globalClimate.positionTime")} value={fmtTime(props.valid_ts, i18n)} />
      <Row field="age" value={fmtAge(props.valid_ts, i18n)} />
    </div>
  );
}

// ── 🌍 世界 World：全球垃圾殘骸（Outerview）──

export function WorldTrashDebrisPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.globalClimate.region")} value={String(props.region ?? "—")} />
      <Row label="ID" value={String(props.id ?? "—")} />
      <Row label={t("popup.globalClimate.dataset")} value="Outerview（CC-BY-4.0）" />
      <Row field="description" value={t("popup.globalClimate.trashNote")} />
    </div>
  );
}

function fmtGlobalEventTime(value: unknown, { formatDateTime }: I18n): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDateTime(date, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function globalEventLocationLabel(props: Record<string, unknown>, t: I18n["t"] = localeStore.getSnapshot().t): string {
  if (props.source_kind === "gdelt_metadata_mention") return t("popup.globalClimate.loc.mention");
  if (props.source_kind === "headline_gazetteer") return t("popup.globalClimate.loc.headline");
  if (props.research_status === "ai_assessed" && (props.location_kind === "country_center" || props.location_kind === "city_center")) {
    return t("popup.globalClimate.loc.related");
  }
  if (props.location_kind === "event_point") return t("popup.globalClimate.loc.eventPoint");
  if (props.location_kind === "city_center") return t("popup.globalClimate.loc.cityCenter");
  if (props.location_kind === "country_center") return t("popup.globalClimate.loc.countryCenter");
  if (props.is_proxy === true && props.representative_precision === "city") {
    return t("popup.globalClimate.loc.cityCenter");
  }
  if (props.is_proxy === true && props.representative_precision === "country") {
    return t("popup.globalClimate.loc.countryCenter");
  }
  return t("popup.globalClimate.loc.default");
}

function globalEventCategoryText(category: unknown, i18n: I18n): string {
  const code = GLOBAL_EVENT_CATEGORIES.some((item) => item.value === category) ? String(category) : "unknown";
  return enumLabel("globalEventCategory", code, globalEventCategoryLabel(category), i18n);
}

function globalEventSeverityText(severity: unknown, i18n: I18n): string {
  const code = GLOBAL_EVENT_SEVERITIES.some((item) => item.value === severity) ? String(severity) : "unknown";
  return enumLabel("globalEventSeverity", code, globalEventSeverityLabel(severity), i18n);
}

export function GlobalEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const isInitial = props.research_status === "ai_assessed";
  let locationUrl: URL | null = null;
  if (typeof props.location_source === "string") {
    try {
      const parsed = new URL(props.location_source);
      if (["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password) locationUrl = parsed;
    } catch { /* Missing/invalid evidence links are not replaced with invented sources. */ }
  }
  const placeParts = [...new Set(
    [props.place_name, props.admin2, props.admin1, props.country_code]
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  )];
  return (
    <div data-testid="global-event-popup" style={{ color: t.textDefault }}>
      <div style={{ color: t.textMuted, fontSize: FONT_SIZE.base, marginBottom: 3 }}>{i18n.t("popup.globalClimate.event")}</div>
      <h3 style={{ color: t.textStrong, fontSize: FONT_SIZE.xl, fontWeight: 600, lineHeight: 1.45, margin: "0 0 10px", overflowWrap: "anywhere" }}>
        {String(props.title_zh_tw ?? "—")}
      </h3>
      <Row label={i18n.t("popup.globalClimate.verification")} value={i18n.t(isInitial ? (props.assessment_status === "pending" ? "popup.globalClimate.verifyPending" : "popup.globalClimate.verifyInitial") : "popup.globalClimate.verifyPublished")} />
      <div style={{ marginTop: 10 }}>
        <div style={{ color: t.textMuted, fontSize: FONT_SIZE.base }}>{i18n.t("popup.globalClimate.summary")}</div>
        <p style={{ color: t.textStrong, fontSize: FONT_SIZE.md, lineHeight: 1.65, margin: "3px 0 10px", overflowWrap: "anywhere" }}>
          {String(props.summary_zh_tw ?? "—")}
        </p>
      </div>
      <Row label={i18n.t("popup.globalClimate.categorySeverity")} value={`${globalEventCategoryText(props.category, i18n)} · ${globalEventSeverityText(props.severity, i18n)}`} />
      <Row label={i18n.t("popup.globalClimate.taiwanImpact")} value={String(props.taiwan_impact_zh_tw ?? "—")} />
      <Row label={i18n.t("popup.globalClimate.reason")} value={String(props.reason_zh_tw ?? "—")} />
      <Row field="place" value={placeParts.length > 0 ? placeParts.join(" · ") : "—"} />
      <Row label={i18n.t("popup.globalClimate.locationSemantics")} value={globalEventLocationLabel(props, i18n.t)} />
      {/* Candidate valid_from carries observed_at; formal valid_from is not a collection time. */}
      <Row label={i18n.t("popup.globalClimate.collectedAt")} value={fmtGlobalEventTime(props.observed_at ?? (isInitial ? props.valid_from : null), i18n)} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: FONT_SIZE.base, lineHeight: 1.5 }}>
        <span style={{ color: t.textMuted, flexShrink: 0 }}>{i18n.t("popup.globalClimate.locationSource")}</span>
        {locationUrl ? <a href={String(props.location_source)} target="_blank" rel="noopener noreferrer"
          style={{ color: t.link, overflowWrap: "anywhere" }}>{locationUrl.hostname}</a> : <span style={{ color: t.textStrong }}>—</span>}
      </div>
    </div>
  );
}

function fmtMaritimeTime(value: unknown, { formatDateTime }: I18n): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : formatDateTime(d, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtMaritimeUtcTime(value: unknown, { formatDateTime }: I18n): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : formatDateTime(d, {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function GfwMemberDetails({ vessel }: { vessel: GfwHourlyGridVessel }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const hasFullDetail = vessel.hours !== undefined;
  return (
    <div style={{ color: t.textDim, fontSize: 10, lineHeight: 1.5 }}>
      ID {vessel.vesselId} · MMSI {vessel.mmsi ?? "—"}<br />
      {vessel.vesselType ?? i18n.t("popup.globalClimate.typeUnknown")} · {vessel.flag ?? i18n.t("popup.globalClimate.flagUnknown")}
      {hasFullDetail && <>
        <br />IMO {vessel.imo ?? "—"} · Callsign {vessel.callsign ?? "—"}
        <br />Gear {vessel.geartype ?? "—"} · Dataset {vessel.dataset ?? "—"}
        <br />{i18n.t("popup.globalClimate.hoursInCell")} {vessel.hours != null ? i18n.formatNumber(vessel.hours, { maximumFractionDigits: 4 }) : "—"}
        <br />{i18n.t("popup.globalClimate.entry")} {fmtMaritimeUtcTime(vessel.entryTimestamp, i18n)} · {i18n.t("popup.globalClimate.exit")} {fmtMaritimeUtcTime(vessel.exitTimestamp, i18n)}
        <br />{i18n.t("popup.globalClimate.firstTx")} {fmtMaritimeUtcTime(vessel.firstTransmissionDate, i18n)} · {i18n.t("popup.globalClimate.lastTx")} {fmtMaritimeUtcTime(vessel.lastTransmissionDate, i18n)}
      </>}
    </div>
  );
}

export function AisstreamVesselPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  return (
    <div>
      <Row field="vesselName" value={String(props.ship_name ?? "—")} />
      <Row label="MMSI" value={String(props.mmsi ?? "—")} />
      <Row label={t("popup.transport.vesselType")} value={String(props.ship_type ?? "—")} />
      <Row label={t("popup.globalClimate.speedCourse")} value={`${props.speed_knots ?? "—"} kt / ${props.course_over_ground ?? "—"}°`} />
      <Row label={t("popup.globalClimate.destination")} value={String(props.destination ?? "—")} />
      <Row field="observedAt" value={fmtMaritimeTime(props.observed_at, i18n)} />
      <Row label={t("popup.globalClimate.messageAge")} value={props.age_seconds == null ? "—" : t("popup.globalClimate.secondsValue", { value: Number(props.age_seconds).toFixed(0) })} />
      <Row field="dataSource" value="AISStream（AIS message feed）" />
    </div>
  );
}

export function GfwVesselPresencePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  return (
    <div>
      <Row field="vesselName" value={String(props.ship_name ?? "—")} />
      <Row label="Vessel ID" value={String(props.vessel_id ?? "—")} />
      <Row label={t("popup.globalClimate.mmsiFlag")} value={`${props.mmsi ?? "—"} / ${props.flag ?? "—"}`} />
      <Row label={t("popup.transport.vesselType")} value={String(props.vessel_type ?? "—")} />
      <Row field="snapshotDate" value={String(props.source_snapshot_date ?? "—")} />
      <Row field="observedAt" value={fmtMaritimeTime(props.observed_at, i18n)} />
      <Row field="dataAge" value={props.age_hours == null ? "—" : t("popup.globalClimate.hoursValue", { value: Number(props.age_hours).toFixed(1) })} />
      <Row field="dataSource" value={t("popup.globalClimate.gfwDaily")} />
    </div>
  );
}

export function GfwHourlyGridPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const vessels = parseGfwHourlyGridVessels(props.vessels_json) ?? [];
  const expectedCount = Number(props.vessel_count);
  const detailStatus = props.detail_status;
  return (
    <div>
      <Row label={tr("popup.globalClimate.utcHour")} value={fmtMaritimeUtcTime(props.observed_at, i18n)} />
      {typeof props.dominant_observed_at === "string" && <Row label={tr("popup.globalClimate.dominantHour")} value={fmtMaritimeUtcTime(props.dominant_observed_at, i18n)} />}
      <Row label={tr("popup.globalClimate.vesselsInCell")} value={Number.isFinite(expectedCount) ? tr("popup.globalClimate.shipCount", { count: expectedCount }) : "—"} />
      <Row label={tr("popup.globalClimate.gridCenter")} value={`${props.center_lon ?? props.grid_lon ?? "—"}, ${props.center_lat ?? props.grid_lat ?? "—"}`} />
      {typeof props.cell_id === "string" && <Row field="gridId" value={props.cell_id} />}
      <Row label={tr("popup.globalClimate.geomSemantics")} value={tr(props.geometry_semantics === "globally_aligned_0_1_degree_cell" ? "popup.globalClimate.geomLocalAgg" : "popup.globalClimate.geomCenter")} />
      {props.geometry_semantics === "inferred_0_01_degree_footprint" && <Row label={tr("popup.globalClimate.geomExtent")} value={tr("popup.globalClimate.extentInferred")} />}
      {props.geometry_semantics === "globally_aligned_0_1_degree_cell" && <Row label={tr("popup.globalClimate.geomExtent")} value={tr("popup.globalClimate.extentAligned")} />}
      {Number(props.full_fidelity) === 1 && <Row label={tr("popup.globalClimate.integrity")} value={tr("popup.globalClimate.fullFidelity")} />}
      {detailStatus === "loading" && <Row label={tr("popup.globalClimate.fullList")} value={tr("popup.globalClimate.listLoading")} />}
      {detailStatus === "error" && <Row label={tr("popup.globalClimate.fullList")} value={String(props.detail_error ?? tr("popup.globalClimate.listError"))} color="#f87171" />}
      <div style={{ marginTop: 8, fontSize: 11, color: t.textDim, letterSpacing: 0.6 }}>
        {tr("popup.globalClimate.shipsInCell", { count: vessels.length })}
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 4, paddingRight: 4 }}>
        {vessels.map((vessel, index) => (
          <div
            key={`${vessel.vesselId}-${index}`}
            style={{ padding: "6px 0", borderTop: `1px solid ${t.border}` }}
          >
            <div style={{ color: t.textDefault, fontSize: 12 }}>
              {vessel.shipName || vessel.vesselId}
            </div>
            <GfwMemberDetails vessel={vessel} />
          </div>
        ))}
        {vessels.length === 0 && detailStatus !== "loading" && (
          <div style={{ color: t.textDim, fontSize: 11, padding: "6px 0" }}>{detailStatus === "error" ? tr("popup.globalClimate.unverifiedHidden") : tr("popup.globalClimate.listUnparsable")}</div>
        )}
      </div>
      <Row field="dataSource" value={`Global Fishing Watch ${String(props.source_dataset ?? "public-global-presence")}`} />
      <div style={{ marginTop: 7, fontSize: 10, color: t.textDim, lineHeight: 1.5 }}>
        {tr("popup.globalClimate.approxGrid")} · <a href={String(props.attribution_href ?? "https://globalfishingwatch.org/")} target="_blank" rel="noreferrer" style={{ color: t.link }}>Powered by {String(props.attribution_label ?? "Global Fishing Watch")}</a>
      </div>
    </div>
  );
}

export function GfwHourlyTrackPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const vessels = parseGfwHourlyGridVessels(props.vessels_json);
  const shipName = String(props.ship_name ?? "").trim();
  const vesselId = String(props.vessel_id ?? "—");
  const count = Number(props.point_count);
  const vesselCount = Number(props.vessel_count);
  const interpolated = Number(props.interpolated) === 1;
  const grouped = vessels && vessels.length > 1;
  const singleVessel = vessels?.length === 1 ? vessels[0] : null;
  const detailStatus = props.detail_status;
  return (
    <div>
      {!grouped && (singleVessel ? <>
        <Row field="vesselName" value={singleVessel.shipName || tr("popup.globalClimate.noShipName")} />
        <GfwMemberDetails vessel={singleVessel} />
      </> : <>
        <Row field="vesselName" value={shipName || tr("popup.globalClimate.noShipName")} />
        <Row label="Vessel ID" value={vesselId} />
        <Row label={tr("popup.globalClimate.mmsiFlag")} value={`${props.mmsi ?? "—"} / ${props.flag ?? "—"}`} />
        <Row label={tr("popup.globalClimate.gfwOriginalType")} value={String(props.vessel_type ?? "—")} />
      </>)}
      <Row label={tr(grouped ? "popup.globalClimate.sameCoordVessels" : "popup.globalClimate.visualClass")} value={grouped && Number.isFinite(vesselCount) ? tr("popup.globalClimate.shipCount", { count: vesselCount }) : String(props.ship_type_label ?? tr("popup.globalClimate.otherShip"))} />
      {Number(props.mixed_type) === 1 && <Row label={tr("popup.globalClimate.shipType")} value={tr("popup.globalClimate.mixedShip")} />}
      <Row label={tr("popup.globalClimate.trailStart")} value={fmtMaritimeUtcTime(props.start_at, i18n)} />
      <Row label={tr("popup.globalClimate.trailEnd")} value={fmtMaritimeUtcTime(props.end_at, i18n)} />
      <Row
        label={tr("popup.globalClimate.timelinePos")}
        value={tr(interpolated ? "popup.globalClimate.timelineInterp" : "popup.globalClimate.timelineObserved", { time: fmtMaritimeUtcTime(props.selected_time, i18n) })}
      />
      <Row label={tr("popup.globalClimate.trailPoints")} value={Number.isFinite(count) ? tr("popup.globalClimate.pointsValue", { count }) : "—"} />
      <Row field="dataSource" value={`Global Fishing Watch ${String(props.source_dataset ?? "public-global-presence")}`} />
      {Number(props.full_fidelity) === 1 && <Row label={tr("popup.globalClimate.integrity")} value={tr("popup.globalClimate.fullFidelity")} />}
      {detailStatus === "loading" && <Row label={tr("popup.globalClimate.segmentDetail")} value={tr("popup.globalClimate.segLoading")} />}
      {detailStatus === "error" && <Row label={tr("popup.globalClimate.segmentDetail")} value={String(props.detail_error ?? tr("popup.globalClimate.segError"))} color="#f87171" />}
      {grouped && (
        <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6, paddingRight: 4 }}>
          {(vessels ?? []).map((vessel, index) => (
            <div key={`${vessel.vesselId}-${index}`} style={{ padding: "6px 0", borderTop: `1px solid ${t.border}` }}>
              <div style={{ color: t.textDefault, fontSize: 12 }}>{vessel.shipName || vessel.vesselId}</div>
              <GfwMemberDetails vessel={vessel} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 7, fontSize: 10, color: t.textDim, lineHeight: 1.5 }}>
        {tr("popup.globalClimate.trackNote")}
        {" "}{tr("popup.globalClimate.approxShort")} · <a href={String(props.attribution_href ?? "https://globalfishingwatch.org/")} target="_blank" rel="noreferrer" style={{ color: t.link }}>Powered by {String(props.attribution_label ?? "Global Fishing Watch")}</a>
      </div>
    </div>
  );
}

export function GfwFishingEffortPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const hours = typeof props.apparent_fishing_hours === "number" && Number.isFinite(props.apparent_fishing_hours) && props.apparent_fishing_hours >= 0
    ? props.apparent_fishing_hours : null;
  const components = typeof props.component_count === "number" && Number.isInteger(props.component_count) && props.component_count >= 1
    ? props.component_count : null;
  let facets: Record<string, unknown>[] = [];
  let facetCount: number | null = null;
  if (typeof props.aggregation_facets_json === "string") {
    try {
      const parsed: unknown = JSON.parse(props.aggregation_facets_json);
      facets = Array.isArray(parsed) && parsed.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))
        ? parsed as Record<string, unknown>[] : [];
      facetCount = facets.length > 0 ? facets.length : null;
    } catch {
      facetCount = null;
    }
  }
  const unavailable = (value: unknown): string => value == null || value === "" ? tr("popup.common.notProvided") : String(value);
  const attributionHref = typeof props.attribution_href === "string" && props.attribution_href ? props.attribution_href : null;
  return (
    <div>
      <Row label={tr("popup.globalClimate.selectedUtcDay")} value={unavailable(props.selected_utc_date ?? props.date)} />
      <Row label={tr("popup.globalClimate.fishingActivity")} value={hours != null ? `${i18n.formatNumber(hours, { maximumFractionDigits: 2 })} ${unavailable(props.unit)}` : tr("popup.common.notProvided")} />
      <Row label={tr("popup.globalClimate.components")} value={components != null ? i18n.formatNumber(components) : tr("popup.common.notProvided")} />
      {facetCount != null && <Row label="Aggregation facets" value={tr("popup.globalClimate.facetsValue", { count: facetCount })} />}
      {facets.length > 0 && (
        <details style={{ marginTop: 7, color: t.textDim }}>
          <summary style={{ cursor: "pointer", fontSize: 10 }}>{tr("popup.globalClimate.viewFacets")}</summary>
          <pre style={{ maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 9, lineHeight: 1.35 }}>
            {JSON.stringify(facets, null, 2)}
          </pre>
        </details>
      )}
      <Row field="dataVersion" value={unavailable(props.dataset_version ?? props.resolved_dataset_version)} />
      <Row label={tr("popup.globalClimate.metric")} value={unavailable(props.metric_semantics ?? props.metric)} />
      <Row label={tr("popup.globalClimate.latestDate")} value={unavailable(props.latest_available_date)} />
      <Row label="Finalization" value={unavailable(props.finalization_status)} />
      <Row label="Revision" value={unavailable(props.revision_semantics)} />
      <Row field="dataSource" value={unavailable(props.attribution)} />
      <div style={{ marginTop: 7, fontSize: 10, lineHeight: 1.5, color: t.textDim }}>
        {unavailable(props.caveat)}
        {attributionHref && <> · <a href={attributionHref} target="_blank" rel="noreferrer" style={{ color: t.link }}>GFW attribution</a></>}
      </div>
    </div>
  );
}

export function GfwDarkVesselPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const tr = i18n.t;
  const detections = Number(props.detections);
  return (
    <div>
      <Row label={tr("popup.globalClimate.obsTimeUtc")} value={fmtMaritimeUtcTime(props.observed_at, i18n)} />
      <Row label="SAR detections" value={Number.isFinite(detections) ? tr("popup.globalClimate.detectionsValue", { count: detections }) : "—"} />
      <Row label={tr("popup.globalClimate.geomSemantics")} value={tr("popup.globalClimate.sarGeom")} />
      <Row label={tr("popup.globalClimate.matchStatus")} value={tr("popup.globalClimate.sarUnmatched")} />
      <Row field="dataSource" value={`Global Fishing Watch ${String(props.source_dataset ?? "—")}`} />
      <div style={{ marginTop: 8, padding: "7px 8px", border: `1px solid ${t.border}`, borderRadius: 6, color: t.textDim, fontSize: 10, lineHeight: 1.5 }}>
        {tr("popup.globalClimate.darkNote")}
        {props.interpretation_note ? ` ${String(props.interpretation_note)}` : ""}
      </div>
    </div>
  );
}

// ── 氣候場 click 讀值（風場 / 海流 UV 前端取樣）──

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compassLabel(deg: number): string {
  return COMPASS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]!;
}

/** 風「來向」（氣象慣例）：u 東向、v 北向分量 → 風從哪個方位吹來。 */
function windDirFrom(u: number, v: number): number {
  return ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
}

/** 流「去向」（海洋慣例）：海流往哪個方位流。 */
function currentDirTo(u: number, v: number): number {
  return ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
}

function fmtValidAt(validAt: unknown, { formatDateTime }: I18n): string {
  if (typeof validAt !== "string" || !validAt) return "—";
  const d = new Date(validAt);
  if (Number.isNaN(d.getTime())) return validAt;
  return formatDateTime(d, {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

interface FieldSampleProps {
  u: number;
  v: number;
  speed: number;
  valid_at: string | null;
}

function asFieldSample(raw: unknown): FieldSampleProps | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.u !== "number" || typeof o.v !== "number" || typeof o.speed !== "number") return null;
  return { u: o.u, v: o.v, speed: o.speed, valid_at: typeof o.valid_at === "string" ? o.valid_at : null };
}

export function ClimateFieldPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const tr = i18n.t;
  const wind = asFieldSample(props.wind);
  const currents = asFieldSample(props.currents);
  return (
    <div>
      {wind && (
        <>
          <Row field="windSpeed" value={tr("popup.globalClimate.windSpeedValue", { ms: wind.speed.toFixed(1), kmh: (wind.speed * 3.6).toFixed(0) })} />
          <Row
            label={tr("popup.globalClimate.windDir")}
            value={tr("popup.globalClimate.windDirValue", { deg: windDirFrom(wind.u, wind.v).toFixed(0), dir: compassLabel(windDirFrom(wind.u, wind.v)) })}
          />
          <Row label={tr("popup.globalClimate.windTime")} value={fmtValidAt(wind.valid_at, i18n)} />
        </>
      )}
      {currents && (
        <>
          <Row label={tr("popup.globalClimate.currentSpeed")} value={tr("popup.globalClimate.currentSpeedValue", { ms: currents.speed.toFixed(2), kt: (currents.speed * 1.944).toFixed(1) })} />
          <Row
            label={tr("popup.globalClimate.currentDir")}
            value={tr("popup.globalClimate.currentDirValue", { deg: currentDirTo(currents.u, currents.v).toFixed(0), dir: compassLabel(currentDirTo(currents.u, currents.v)) })}
          />
          <Row label={tr("popup.globalClimate.currentTime")} value={fmtValidAt(currents.valid_at, i18n)} />
        </>
      )}
    </div>
  );
}
