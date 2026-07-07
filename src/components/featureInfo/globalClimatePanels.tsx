import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

function fmtAge(ts: unknown): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const now = Math.floor(Date.now() / 1000);
  const dt = now - ts;
  if (dt < 60) return `${dt}s 前`;
  if (dt < 3600) return `${Math.floor(dt / 60)} 分鐘前`;
  if (dt < 86400) return `${Math.floor(dt / 3600)} 小時前`;
  return `${Math.floor(dt / 86400)} 天前`;
}

function fmtTime(ts: unknown): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString("zh-TW", {
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
  const mag = typeof props.mag === "number" ? props.mag : null;
  const depth = typeof props.depth_km === "number" ? props.depth_km : null;
  const magColor = mag != null ? magBadgeColor(mag) : t.textDim;
  const dColor = depth != null ? depthColor(depth) : t.textDim;
  return (
    <div>
      <Row label="地點" value={String(props.place ?? "—")} />
      <Row
        label="規模 (M)"
        value={mag != null ? `M ${mag.toFixed(1)}` : "—"}
        color={magColor}
      />
      <Row
        label="深度"
        value={depth != null ? `${depth.toFixed(1)} km` : "—"}
        color={dColor}
      />
      <Row label="發生時刻" value={fmtTime(props.observed_ts)} />
      <Row label="距現在" value={fmtAge(props.observed_ts)} />
      <Row label="USGS ID" value={String(props.event_id ?? "—")} />
    </div>
  );
}

export function TyphoonTrackPanel({ props }: { props: Record<string, unknown> }) {
  const pointType = String(props.point_type ?? "");
  const isFcst = pointType === "forecast";
  const wind = typeof props.max_wind_kt === "number" ? props.max_wind_kt : null;
  const pressure = typeof props.center_pressure === "number" ? props.center_pressure : null;
  const adv = typeof props.advisory_number === "number" ? props.advisory_number : null;
  const sourceLabel = String(props.source ?? "—").toUpperCase();
  return (
    <div>
      <Row
        label="名稱"
        value={`${String(props.name_en ?? "")}${
          props.name_local ? ` (${String(props.name_local)})` : ""
        }`}
      />
      <Row label="編號" value={String(props.storm_id ?? "—")} />
      <Row
        label="類型"
        value={isFcst ? "預報位置 Forecast" : "觀測位置 Observed"}
        color={isFcst ? "#c084fc" : "#a855f7"}
      />
      <Row label="資料源" value={sourceLabel} />
      {adv != null && <Row label="Advisory" value={`#${adv}`} />}
      <Row
        label="近中心最大風"
        value={wind != null ? `${wind.toFixed(0)} kt（約 ${(wind * 1.852).toFixed(0)} km/h）` : "—"}
        color={wind != null && wind >= 64 ? "#dc2626" : undefined}
      />
      <Row
        label="中心氣壓"
        value={pressure != null ? `${pressure.toFixed(0)} hPa` : "—"}
        color={pressure != null && pressure <= 970 ? "#ef4444" : undefined}
      />
      <Row label="位置時刻" value={fmtTime(props.valid_ts)} />
      <Row label="距現在" value={fmtAge(props.valid_ts)} />
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

function fmtValidAt(validAt: unknown): string {
  if (typeof validAt !== "string" || !validAt) return "—";
  const d = new Date(validAt);
  if (Number.isNaN(d.getTime())) return validAt;
  return d.toLocaleString("zh-TW", {
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
  const wind = asFieldSample(props.wind);
  const currents = asFieldSample(props.currents);
  return (
    <div>
      {wind && (
        <>
          <Row label="風速" value={`${wind.speed.toFixed(1)} m/s（${(wind.speed * 3.6).toFixed(0)} km/h）`} />
          <Row
            label="風向"
            value={`${windDirFrom(wind.u, wind.v).toFixed(0)}°（${compassLabel(windDirFrom(wind.u, wind.v))} 來風）`}
          />
          <Row label="風場時刻" value={fmtValidAt(wind.valid_at)} />
        </>
      )}
      {currents && (
        <>
          <Row label="流速" value={`${currents.speed.toFixed(2)} m/s（${(currents.speed * 1.944).toFixed(1)} kt）`} />
          <Row
            label="流向"
            value={`${currentDirTo(currents.u, currents.v).toFixed(0)}°（往 ${compassLabel(currentDirTo(currents.u, currents.v))}）`}
          />
          <Row label="海流時刻" value={fmtValidAt(currents.valid_at)} />
        </>
      )}
    </div>
  );
}
