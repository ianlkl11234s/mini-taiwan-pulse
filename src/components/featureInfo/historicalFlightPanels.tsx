import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { LocaleSnapshot } from "../../state/localeStore";

/** 等同 toLocaleString 預設的完整日期時間；時區由資料欄位決定（覆蓋 formatDateTime 的預設台北時區） */
const DT_FULL: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false };

function valueOf(value: unknown, na: string, sep: string): string {
  if (value == null || value === "") return na;
  if (Array.isArray(value)) return value.length ? value.join(sep) : na;
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length ? parsed.map(String).join(sep) : na;
    } catch { /* Mapbox serialized string falls through. */ }
  }
  return String(value);
}

function timestamp(value: unknown, timezone: string, na: string, { formatDateTime }: LocaleSnapshot): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return na;
  return formatDateTime(new Date(numberValue * (numberValue < 10_000_000_000 ? 1000 : 1)), { ...DT_FULL, timeZone: timezone });
}

export function HistoricalFlightTrailPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const na = tr("popup.historicalFlight.notProvided");
  const sep = tr("popup.historicalFlight.listSeparator");
  const v = (value: unknown) => valueOf(value, na, sep);
  const ts = (value: unknown) => timestamp(value, timezone, na, i18n);
  const roles = (value: unknown): string => {
    const raw = v(value);
    if (raw === na) return raw;
    return raw.split(sep).map((role) => role === "departure" || role === "arrival" ? enumLabel("historicalFlightRole", role, role === "departure" ? "出發" : "抵達", i18n) : role).join(sep);
  };
  const routeScope = (value: unknown): string => {
    const code = String(value);
    const zh = ({ domestic: "國內", cross_border: "跨境", unknown: "未分類" } as Record<string, string>)[code];
    return zh ? enumLabel("historicalFlightScope", code, zh, i18n) : v(value);
  };
  const title = v(props.flight_number) !== na ? v(props.flight_number) : v(props.callsign);
  const timezone = v(props.timezone) === na ? "Asia/Taipei" : v(props.timezone);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#4d99ff", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{title}</div>
      </div>
      <Row label={tr("popup.historicalFlight.flightId")} value={v(props.flight_id)} />
      <Row label={tr("popup.historicalFlight.callsign")} value={v(props.callsign)} />
      <Row label={tr("popup.historicalFlight.airline")} value={v(props.operator)} />
      <Row label={tr("popup.historicalFlight.aircraftType")} value={v(props.aircraft_type)} />
      <Row label={tr("popup.historicalFlight.origin")} value={`${v(props.origin_icao)} / ${v(props.origin_iata)}`} />
      <Row label={tr("popup.historicalFlight.destination")} value={`${v(props.dest_icao)} / ${v(props.dest_iata)}`} />
      <Row label={tr("popup.historicalFlight.sampleDate")} value={v(props.sample_date)} />
      <Row label={tr("popup.historicalFlight.timezone")} value={timezone} />
      <Row field="source" value="FlightRadar24" />
      <Row label={tr("popup.historicalFlight.departureTime")} value={ts(props.dep_time)} />
      <Row label={tr("popup.historicalFlight.arrivalTime")} value={ts(props.arr_time)} />
      <Row label={tr("popup.historicalFlight.observedStart")} value={ts(props.observed_start)} />
      <Row label={tr("popup.historicalFlight.observedEnd")} value={ts(props.observed_end)} />
      <Row label={tr("popup.historicalFlight.roles")} value={roles(props.roles)} />
      <Row label={tr("popup.historicalFlight.routeScope")} value={routeScope(props.route_scope)} />
      <Row label={tr("popup.historicalFlight.gapCount")} value={v(props.gap_count)} />
      <Row label={tr("popup.historicalFlight.invalidPoints")} value={v(props.invalid_point_count)} />
      <Row label={tr("popup.historicalFlight.nonMonotonicPoints")} value={v(props.non_monotonic_count)} />
      <Row label={tr("popup.historicalFlight.sourcePoints")} value={v(props.source_point_count)} />
      <Row label={tr("popup.historicalFlight.retainedPoints")} value={v(props.retained_point_count)} />
    </>
  );
}
