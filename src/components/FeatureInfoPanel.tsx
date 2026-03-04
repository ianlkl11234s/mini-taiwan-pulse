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

export function FeatureInfoPanel({ feature, onClose }: Props) {
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
        {feature.layerType === "submarineCable" ? "通訊海纜" : "海纜登陸站"}
      </div>

      {feature.layerType === "submarineCable"
        ? <SubmarineCablePanel props={feature.properties} />
        : <LandingStationPanel props={feature.properties} />}
    </div>
  );
}
