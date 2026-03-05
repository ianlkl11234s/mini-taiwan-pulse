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

const HEADER_LABELS: Record<FeatureInfo["layerType"], string> = {
  submarineCable: "通訊海纜",
  landingStation: "海纜登陸站",
  school: "學校",
  convenienceStore: "超商",
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
