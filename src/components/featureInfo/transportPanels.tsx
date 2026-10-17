import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import { enumLabel, localizedField } from "../../i18n/dataText";
import { useFeatureTheme } from "./featureTheme";
import { RAIL_ROUTES_FALLBACK_COLOR, RAIL_ROUTES_SYSTEM_LABELS } from "../../data/railRoutesTypes";

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
  tmrt: { name: "台中捷運", color: "#ab47bc" },
};

export function WeatherStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const stationType = String(props.station_type ?? "");
  const accentColor = WEATHER_TYPE_COLORS[stationType] ?? "#4dd0e1";
  const isActive = props.is_active;
  const active = isActive === true || isActive === 1 || isActive === "true" ? true : isActive === false || isActive === 0 || isActive === "false" ? false : null;
  const activeLabel = active == null ? "" : i18n.t(active ? "popup.transport.active" : "popup.transport.inactive");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.station_name ?? i18n.t("popup.transport.unknownStation"))}
        </div>
      </div>
      <Row field="type" value={stationType ? enumLabel("weatherStationType", stationType, stationType, i18n) : ""} color={accentColor} />
      <Row field="elevation" value={props.elevation_m != null ? `${props.elevation_m} m` : ""} />
      <Row field="city" value={placeName(String(props.city ?? ""), i18n)} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={i18n.t("popup.transport.startDate")} value={String(props.start_date ?? "")} />
      <Row field="status" value={activeLabel} color={active ? "#66bb6a" : "#ef5350"} />
      <Row field="remarks" value={String(props.note ?? "")} />
    </>
  );
}

export function BikeStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const serviceType = String(props.ServiceTypeName ?? "");
  const stationName = localizedField(props, { zh: "StationName", en: "StationNameEn" }, i18n)?.text;
  const accentColor = BIKE_SERVICE_COLORS[serviceType] ?? "#ffca28";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {stationName ?? tr("popup.transport.unknownStation")}
        </div>
      </div>
      <Row field="system" value={serviceType} color={accentColor} />
      <Row label={tr("popup.transport.docks")} value={String(props.BikesCapacity ?? "")} />
      <Row field="city" value={placeName(String(props.City ?? ""), i18n)} />
      <Row field="address" value={String(props.StationAddress ?? "")} />
    </>
  );
}

export function BusStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const busType = String(props.bus_type ?? props.BusType ?? "");
  const isIntercity = busType === "intercity";
  const accentColor = isIntercity ? "#ab47bc" : "#66bb6a";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {localizedField(props, { zh: "StationName", en: "StationNameEn" }, i18n)?.text ?? tr("popup.transport.unknownStation")}
        </div>
      </div>
      <Row field="type" value={tr(isIntercity ? "popup.transport.intercityBus" : "popup.transport.cityBus")} color={accentColor} />
      <Row label={tr("popup.transport.routeCount")} value={String(props.Stops ?? "")} />
      <Row field="city" value={placeName(String(props.City ?? ""), i18n)} />
      <Row field="address" value={String(props.StationAddress ?? "")} />
    </>
  );
}

export function RailStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const systemId = String(props.system_id ?? "");
  const info = RAIL_SYSTEM_INFO[systemId];
  const accentColor = String(props.line_color ?? props.color ?? info?.color ?? "#b8a080");
  const lineName = props.line_name ? String(props.line_name) : "";
  const isTransfer = props.transfer === true || props.transfer === "true";
  const stationName = localizedField(props, { zh: "name", en: "name_en" }, i18n)?.text;
  const lineLabel = lineName ? enumLabel("railLine", lineName, lineName, i18n) : "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {stationName ?? i18n.t("popup.transport.unknownStation")}
        </div>
      </div>
      <Row field="system" value={info ? enumLabel("railSystem", systemId, info.name, i18n) : systemId} color={accentColor} />
      {lineName && <Row field="route" value={isTransfer ? i18n.t("popup.transport.transferStation", { line: lineLabel }) : lineLabel} color={accentColor} />}
      <Row label={i18n.t("popup.transport.stationCode")} value={String(props.station_id ?? "")} />
    </>
  );
}

/** 軌道路線（railRoutes 靜態線）：線名 / 系統 / 來源；東延段另標 OSM 授權。 */
export function RailRoutesPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const systemId = String(props.system ?? "");
  const accentColor = String(props.color ?? RAIL_ROUTES_FALLBACK_COLOR);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {props.name ? enumLabel("railLine", String(props.name), String(props.name), i18n) : i18n.t("popup.transport.railRoute")}
        </div>
      </div>
      <Row field="system" value={RAIL_ROUTES_SYSTEM_LABELS[systemId] ? enumLabel("railSystem", systemId, RAIL_ROUTES_SYSTEM_LABELS[systemId], i18n) : systemId} color={accentColor} />
    </>
  );
}

/** AIS 船舶類型碼區段 → 顯示用分類（文字在 popup.transport.ship.*） */
const SHIP_TYPE_INFO = (type: number) => {
  if (type >= 60 && type <= 69) return { key: "popup.transport.ship.passenger", color: "#a78bfa" } as const;
  if (type >= 70 && type <= 79) return { key: "popup.transport.ship.cargo", color: "#38bdf8" } as const;
  if (type >= 80 && type <= 89) return { key: "popup.transport.ship.tanker", color: "#f97316" } as const;
  if (type >= 30 && type <= 39) return { key: "popup.transport.ship.fishing", color: "#22c55e" } as const;
  if (type >= 50 && type <= 59) return { key: "popup.transport.ship.special", color: "#facc15" } as const;
  return { key: "popup.transport.ship.unknown", color: "#67e8f9" } as const;
};

export function ShipPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr, formatDateTime } = useLocale();
  const vesselType = Number(props.vessel_type ?? 0);
  const info = SHIP_TYPE_INFO(vesselType);
  const ts = Number(props.timestamp ?? 0);
  const time = ts > 0 ? formatDateTime(ts * 1000, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          MMSI {String(props.mmsi ?? "—")}
        </div>
      </div>
      <Row label={tr("popup.transport.vesselType")} value={tr(info.key)} color={info.color} />
      <Row label={tr("popup.transport.aisTypeCode")} value={Number.isFinite(vesselType) ? String(vesselType) : "—"} />
      <Row field="time" value={time} />
      <Row field="longitude" value={props.lon != null ? Number(props.lon).toFixed(5) : "—"} />
      <Row field="latitude" value={props.lat != null ? Number(props.lat).toFixed(5) : "—"} />
    </>
  );
}
