import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row } from "./shared";

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
  trtc: { name: "台北捷運", color: "#00bcd4" },
  krtc: { name: "高雄捷運", color: "#f57f17" },
  klrt: { name: "高雄輕軌", color: "#66bb6a" },
  tmrt: { name: "桃園捷運", color: "#ab47bc" },
};

export function WeatherStationPanel({ props }: { props: Record<string, unknown> }) {
  const stationType = String(props.station_type ?? "");
  const accentColor = WEATHER_TYPE_COLORS[stationType] ?? "#4dd0e1";
  const isActive = props.is_active;
  const activeLabel = isActive === true || isActive === 1 || isActive === "true" ? "運作中" : isActive === false || isActive === 0 || isActive === "false" ? "已停用" : "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
  const serviceType = String(props.ServiceTypeName ?? "");
  const accentColor = BIKE_SERVICE_COLORS[serviceType] ?? "#ffca28";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
  const busType = String(props.bus_type ?? props.BusType ?? "");
  const isIntercity = busType === "intercity";
  const accentColor = isIntercity ? "#ab47bc" : "#66bb6a";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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
  const systemId = String(props.system_id ?? "");
  const info = RAIL_SYSTEM_INFO[systemId];
  const accentColor = String(props.color ?? info?.color ?? "#b8a080");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={info?.name ?? systemId} color={accentColor} />
      <Row label="站代碼" value={String(props.station_id ?? "")} />
    </>
  );
}
