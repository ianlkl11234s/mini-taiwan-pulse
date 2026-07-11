import { aqiToColor } from "../../map/aqiColorScale";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, numOrNull, formatNum } from "./shared";
import { useFeatureTheme } from "./featureTheme";

export function AqiStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const aqi = numOrNull(props.aqi);
  const color = aqi != null ? aqiToColor(aqi) : "#707070";
  const observedAt = String(props.observedAt ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.stationName ?? "Unknown")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: t.bgSubtle,
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 700, color }}>
          {aqi ?? "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.base, color: t.textDefault }}>
          AQI {String(props.status ?? "")}
        </span>
      </div>
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="主污染物" value={String(props.pollutant ?? "")} />
      <Row label="PM2.5" value={formatNum(numOrNull(props.pm25), "µg/m³")} />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} />
      <Row label="O₃" value={formatNum(numOrNull(props.o3), "ppb", 1)} />
      <Row label="NO₂" value={formatNum(numOrNull(props.no2), "ppb", 1)} />
      <Row label="SO₂" value={formatNum(numOrNull(props.so2), "ppb", 2)} />
      <Row label="CO" value={formatNum(numOrNull(props.co), "ppm", 2)} />
      <Row label="風速" value={formatNum(numOrNull(props.windSpeed), "m/s", 1)} />
      <Row label="觀測時間" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}

export function MicroSensorPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const pm25 = numOrNull(props.pm25);
  const color = String(props.color ?? "#707070");
  const temperature = Number(props.temperature);
  const tempStr = Number.isFinite(temperature) && temperature > -100 ? `${temperature.toFixed(1)} °C` : "";
  const observedAt = String(props.observedAt ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.deviceId ?? "LASS Device")}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginTop: 4,
          padding: "6px 8px",
          background: t.bgSubtle,
          borderRadius: RADIUS.md,
        }}
      >
        <span style={{ fontSize: FONT_SIZE.xxl, fontWeight: 700, color }}>
          {pm25 != null ? pm25.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>PM2.5 µg/m³</span>
      </div>
      <Row label="來源" value={String(props.source ?? "")} />
      <Row label="裝置" value={String(props.app ?? "")} />
      <Row label="地區" value={String(props.area ?? "")} />
      <Row label="PM10" value={formatNum(numOrNull(props.pm10), "µg/m³")} />
      <Row label="PM1" value={formatNum(numOrNull(props.pm1), "µg/m³")} />
      <Row label="溫度" value={tempStr} />
      <Row label="濕度" value={formatNum(numOrNull(props.humidity), "%")} />
      <Row label="觀測時間" value={observedAt ? observedAt.slice(0, 16).replace("T", " ") : ""} />
    </>
  );
}
