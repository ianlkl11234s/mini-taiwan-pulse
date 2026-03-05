import { X } from "lucide-react";
import type { FeatureInfo } from "../types";

/** 海纜 cable_type 對應色 */
const CABLE_TYPE_COLORS: Record<string, string> = {
  "國際幹線": "#2196F3",
  "海峽專線": "#F44336",
  "離島連接": "#4CAF50",
  "中國境內": "#FF9800",
  "規劃中": "#9E9E9E",
};

/** 登陸站 station_type 對應色 */
const STATION_TYPE_COLORS: Record<string, string> = {
  "國際樞紐": "#2196F3",
  "區域節點": "#26c6da",
};

/** 學校分級對應色 */
const SCHOOL_LEVEL_COLORS: Record<string, string> = {
  "國民小學": "#66bb6a",
  "附設國民小學": "#66bb6a",
  "國民中學": "#ffa726",
  "附設國民中學": "#ffa726",
  "高級中等學校": "#ef5350",
  "大專校院": "#ab47bc",
  "宗教研修學院": "#ab47bc",
  "空中大學": "#ab47bc",
  "專科學校": "#ab47bc",
  "特殊教育學校": "#78909c",
};

/** 超商品牌對應色 */
const BRAND_COLORS: Record<string, string> = {
  "7-ELEVEN": "#00843D",
  "全家": "#00843D",
  "FamilyMart": "#00843D",
  "萊爾富": "#E31937",
  "Hi-Life": "#E31937",
  "OK": "#FF8C00",
  "OKmart": "#FF8C00",
};

interface Props {
  feature: FeatureInfo;
  onClose: () => void;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0, minWidth: 56 }}>{label}</span>
      <span style={{ color: color ?? "rgba(255,255,255,0.85)", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function SubmarineCablePanel({ props }: { props: Record<string, unknown> }) {
  const cableType = String(props.cable_type ?? "");
  const accentColor = CABLE_TYPE_COLORS[cableType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Cable")}
        </div>
      </div>
      <Row label="類型" value={cableType} color={accentColor} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="啟用年" value={String(props.rfs_year ?? "")} />
      <Row label="長度" value={String(props.length ?? "")} />
      <Row label="擁有者" value={String(props.owners ?? "")} />
      <Row label="供應商" value={String(props.suppliers ?? "")} />
      <Row label="台灣端" value={String(props.tw_landings ?? "")} />
      <Row label="中國端" value={String(props.cn_landings ?? "")} />
    </>
  );
}

function LandingStationPanel({ props }: { props: Record<string, unknown> }) {
  const stationType = String(props.station_type ?? "");
  const accentColor = STATION_TYPE_COLORS[stationType] ?? "#9E9E9E";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="國家" value={String(props.country ?? "")} />
      <Row label="樞紐等級" value={stationType} color={accentColor} />
      <Row label="電纜數" value={String(props.cable_count ?? "")} />
      <Row label="電纜清單" value={String(props.cable_names_str ?? "")} />
    </>
  );
}

function SchoolPanel({ props }: { props: Record<string, unknown> }) {
  const level = String(props.school_level ?? "");
  const accentColor = SCHOOL_LEVEL_COLORS[level] ?? "#42a5f5";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.school_name ?? "Unknown School")}
        </div>
      </div>
      <Row label="分級" value={level} color={accentColor} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="區域" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="電話" value={String(props.phone ?? "")} />
      <Row label="網站" value={String(props.website ?? "")} />
    </>
  );
}

function ConvenienceStorePanel({ props }: { props: Record<string, unknown> }) {
  const brand = String(props.brand ?? "");
  const accentColor = BRAND_COLORS[brand] ?? "#26c6da";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Store")}
        </div>
      </div>
      <Row label="品牌" value={brand} color={accentColor} />
      <Row label="地址" value={String(props.addr ?? props.address ?? "")} />
    </>
  );
}

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

function WeatherStationPanel({ props }: { props: Record<string, unknown> }) {
  const stationType = String(props.station_type ?? "");
  const accentColor = WEATHER_TYPE_COLORS[stationType] ?? "#4dd0e1";
  const isActive = props.is_active;
  const activeLabel = isActive === true || isActive === 1 || isActive === "true" ? "運作中" : isActive === false || isActive === 0 || isActive === "false" ? "已停用" : "";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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

function BikeStationPanel({ props }: { props: Record<string, unknown> }) {
  const serviceType = String(props.ServiceTypeName ?? "");
  const accentColor = BIKE_SERVICE_COLORS[serviceType] ?? "#ffca28";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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

function BusStationPanel({ props }: { props: Record<string, unknown> }) {
  const busType = String(props.bus_type ?? props.BusType ?? "");
  const isIntercity = busType === "intercity";
  const accentColor = isIntercity ? "#ab47bc" : "#66bb6a";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
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

function LighthousePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffd700", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.Name ?? "Unknown Lighthouse")}
        </div>
      </div>
      <Row label="緯度" value={String(props.Lat ?? "")} />
      <Row label="經度" value={String(props.Lon ?? "")} />
    </>
  );
}

function RailStationPanel({ props }: { props: Record<string, unknown> }) {
  const systemId = String(props.system_id ?? "");
  const info = RAIL_SYSTEM_INFO[systemId];
  const accentColor = String(props.color ?? info?.color ?? "#b8a080");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Station")}
        </div>
      </div>
      <Row label="系統" value={info?.name ?? systemId} color={accentColor} />
      <Row label="站代碼" value={String(props.station_id ?? "")} />
    </>
  );
}

/** 港口分類對應色 */
const PORT_CLASS_COLORS: Record<string, string> = {
  "國際商港": "#42a5f5",
  "國內商港": "#64b5f6",
  "第一類漁港": "#26c6da",
  "第二類漁港": "#4dd0e1",
  "工業專用港": "#ffa726",
  "軍港": "#78909c",
};

function PortPanel({ props }: { props: Record<string, unknown> }) {
  const portClass = String(props.port_class ?? "");
  const accentColor = PORT_CLASS_COLORS[portClass] ?? "#88bbff";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Port")}
        </div>
      </div>
      <Row label="分類" value={portClass} color={accentColor} />
      <Row label="縣市" value={String(props.county ?? "")} />
      <Row label="資料源" value={String(props.source ?? "")} />
    </>
  );
}

function AirportPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#daa520", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.name ?? "Unknown Airport")}
        </div>
      </div>
      <Row label="英文" value={String(props.name_en ?? "")} />
      <Row label="ICAO" value={String(props.icao ?? "")} />
      <Row label="IATA" value={String(props.iata ?? "")} />
    </>
  );
}

const HEADER_LABELS: Record<FeatureInfo["layerType"], string> = {
  submarineCable: "通訊海纜",
  landingStation: "海纜登陸站",
  school: "學校",
  convenienceStore: "超商",
  weatherStation: "氣象站",
  bikeStation: "公共自行車站",
  busStation: "公車站",
  lighthouse: "燈塔",
  railStation: "車站",
  port: "港口",
  airport: "機場",
};

export function FeatureInfoPanel({ feature, onClose }: Props) {
  let content: React.ReactNode;
  switch (feature.layerType) {
    case "submarineCable":
      content = <SubmarineCablePanel props={feature.properties} />;
      break;
    case "landingStation":
      content = <LandingStationPanel props={feature.properties} />;
      break;
    case "school":
      content = <SchoolPanel props={feature.properties} />;
      break;
    case "convenienceStore":
      content = <ConvenienceStorePanel props={feature.properties} />;
      break;
    case "weatherStation":
      content = <WeatherStationPanel props={feature.properties} />;
      break;
    case "bikeStation":
      content = <BikeStationPanel props={feature.properties} />;
      break;
    case "busStation":
      content = <BusStationPanel props={feature.properties} />;
      break;
    case "lighthouse":
      content = <LighthousePanel props={feature.properties} />;
      break;
    case "railStation":
      content = <RailStationPanel props={feature.properties} />;
      break;
    case "port":
      content = <PortPanel props={feature.properties} />;
      break;
    case "airport":
      content = <AirportPanel props={feature.properties} />;
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        right: 16,
        zIndex: 30,
        width: 280,
        background: "rgba(10, 10, 20, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.25)",
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "monospace",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "none",
          border: "none",
          color: "rgba(255,255,255,0.4)",
          cursor: "pointer",
          padding: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <X size={14} />
      </button>

      {/* Header label */}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
        {HEADER_LABELS[feature.layerType]}
      </div>

      {content}
    </div>
  );
}
