import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

/** 氣象站類型對應色 */
const WEATHER_TYPE_COLORS: Record<string, string> = {
  "署屬有人站": "#4dd0e1",
  "署屬無人站": "#80deea",
  "自動雨量站": "#26c6da",
  "農業站": "#66bb6a",
};

/** 自行車服務類型對應色 */
const BIKE_SERVICE_COLORS: Record<string, string> = {
  "YouBike2.0": "#a1d344",
  "YouBike1.0": "#f5a623",
  "T-Bike": "#00bcd4",
  "iBike": "#ff7043",
  "PBIKE": "#ab47bc",
};

/** 鐵路系統對應色與名稱 */
const RAIL_SYSTEM_INFO: Record<string, { name: string; color: string }> = {
  tra: { name: "台鐵", color: "#b8a080" },
  // 高鐵只存在於 station_polygons（station_points 零筆 thsr）→ 本層由站體面接 popup，
  // 顏色對齊 overlayRegistry 的 station-polygons-thsr-poly-* 橘。
  thsr: { name: "高鐵", color: "#ff8c00" },
  trtc: { name: "台北捷運", color: "#00bcd4" },
  krtc: { name: "高雄捷運", color: "#f57f17" },
  klrt: { name: "高雄輕軌", color: "#66bb6a" },
  tmrt: { name: "桃園捷運", color: "#ab47bc" },
};

export function WeatherStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const stationType = String(props.station_type ?? "");
  const accentColor = WEATHER_TYPE_COLORS[stationType] ?? "#4dd0e1";
  const isActive = props.is_active;
  const activeLabel = isActive === true || isActive === 1 || isActive === "true" ? "運作中" : isActive === false || isActive === 0 || isActive === "false" ? "已停用" : "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.station_name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="類型" value={stationType} color={accentColor} />
      <Row label="海拔" value={props.elevation_m != null ? `${props.elevation_m} m` : ""} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="啟用日" value={String(props.start_date ?? "")} />
      <Row label="狀態" value={activeLabel} color={activeLabel === "運作中" ? "#66bb6a" : "#ef5350"} />
      <Row label="備註" value={String(props.note ?? "")} />
    </>
  );
}

export function BikeStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const serviceType = String(props.ServiceTypeName ?? "");
  const accentColor = BIKE_SERVICE_COLORS[serviceType] ?? "#ffca28";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.StationName ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={serviceType} color={accentColor} />
      <Row label="車柱數" value={String(props.BikesCapacity ?? "")} />
      <Row label="城市" value={String(props.City ?? "")} />
      <Row label="地址" value={String(props.StationAddress ?? "")} />
    </>
  );
}

export function BusStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const busType = String(props.bus_type ?? props.BusType ?? "");
  const isIntercity = busType === "intercity";
  const accentColor = isIntercity ? "#ab47bc" : "#66bb6a";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.StationName ?? "Unknown Station")}
        </div>
      </div>
      <Row label="類型" value={isIntercity ? "客運" : "市區公車"} color={accentColor} />
      <Row label="路線數" value={String(props.Stops ?? "")} />
      <Row label="城市" value={String(props.City ?? "")} />
      <Row label="地址" value={String(props.StationAddress ?? "")} />
    </>
  );
}

export function RailStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const systemId = String(props.system_id ?? "");
  const info = RAIL_SYSTEM_INFO[systemId];
  const accentColor = String(props.color ?? info?.color ?? "#b8a080");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={info?.name ?? systemId} color={accentColor} />
      <Row label="站代碼" value={String(props.station_id ?? "")} />
    </>
  );
}


const SHIP_TYPE_INFO = (type: number): { label: string; color: string } => {
  if (type >= 60 && type <= 69) return { label: "客船 Passenger", color: "#a78bfa" };
  if (type >= 70 && type <= 79) return { label: "貨船 Cargo", color: "#38bdf8" };
  if (type >= 80 && type <= 89) return { label: "油輪 Tanker", color: "#f97316" };
  if (type >= 30 && type <= 39) return { label: "漁船 Fishing", color: "#22c55e" };
  if (type >= 50 && type <= 59) return { label: "作業/拖船 Tug/Special", color: "#facc15" };
  return { label: "未知 Unknown", color: "#67e8f9" };
};

export function ShipPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const vesselType = Number(props.vessel_type ?? 0);
  const info = SHIP_TYPE_INFO(vesselType);
  const ts = Number(props.timestamp ?? 0);
  const time = ts > 0 ? new Date(ts * 1000).toLocaleString("zh-TW", { hour12: false }) : "—";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          MMSI {String(props.mmsi ?? "—")}
        </div>
      </div>
      <Row label="船舶類型" value={info.label} color={info.color} />
      <Row label="AIS 類型碼" value={Number.isFinite(vesselType) ? String(vesselType) : "—"} />
      <Row label="時間" value={time} />
      <Row label="經度" value={props.lon != null ? Number(props.lon).toFixed(5) : "—"} />
      <Row label="緯度" value={props.lat != null ? Number(props.lat).toFixed(5) : "—"} />
    </>
  );
}
