import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

function valueOf(value: unknown): string {
  if (value == null || value === "") return "未提供";
  if (Array.isArray(value)) return value.length ? value.join("、") : "未提供";
  if (typeof value === "string" && value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.length ? parsed.map(String).join("、") : "未提供";
    } catch { /* Mapbox serialized string falls through. */ }
  }
  return String(value);
}

function timestamp(value: unknown, timezone: string): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return "未提供";
  return new Date(numberValue * (numberValue < 10_000_000_000 ? 1000 : 1)).toLocaleString("zh-TW", { hour12: false, timeZone: timezone });
}

function roles(value: unknown): string {
  const raw = valueOf(value);
  if (raw === "未提供") return raw;
  return raw.split("、").map((role) => role === "departure" ? "出發" : role === "arrival" ? "抵達" : role).join("、");
}

function routeScope(value: unknown): string {
  return ({ domestic: "國內", cross_border: "跨境", unknown: "未分類" } as Record<string, string>)[String(value)] ?? valueOf(value);
}

export function HistoricalFlightTrailPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const title = valueOf(props.flight_number) !== "未提供" ? valueOf(props.flight_number) : valueOf(props.callsign);
  const timezone = valueOf(props.timezone) === "未提供" ? "Asia/Taipei" : valueOf(props.timezone);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#4d99ff", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong }}>{title}</div>
      </div>
      <Row label="航班 ID" value={valueOf(props.flight_id)} />
      <Row label="呼號" value={valueOf(props.callsign)} />
      <Row label="航空公司" value={valueOf(props.operator)} />
      <Row label="機型" value={valueOf(props.aircraft_type)} />
      <Row label="起點" value={`${valueOf(props.origin_icao)} / ${valueOf(props.origin_iata)}`} />
      <Row label="終點" value={`${valueOf(props.dest_icao)} / ${valueOf(props.dest_iata)}`} />
      <Row label="樣本日期" value={valueOf(props.sample_date)} />
      <Row label="時區" value={timezone} />
      <Row label="來源" value="FlightRadar24" />
      <Row label="起飛時間" value={timestamp(props.dep_time, timezone)} />
      <Row label="到達時間" value={timestamp(props.arr_time, timezone)} />
      <Row label="觀測起點" value={timestamp(props.observed_start, timezone)} />
      <Row label="觀測終點" value={timestamp(props.observed_end, timezone)} />
      <Row label="角色" value={roles(props.roles)} />
      <Row label="航線範圍" value={routeScope(props.route_scope)} />
      <Row label="資料缺口" value={valueOf(props.gap_count)} />
      <Row label="無效點" value={valueOf(props.invalid_point_count)} />
      <Row label="非單調點" value={valueOf(props.non_monotonic_count)} />
      <Row label="來源點" value={valueOf(props.source_point_count)} />
      <Row label="保留點" value={valueOf(props.retained_point_count)} />
    </>
  );
}
