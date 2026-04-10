import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LayerVisibility } from "../types";

/**
 * 右下角圖例面板 — 只顯示目前開啟的圖層對應圖例
 */

// ── Earthquake depth color stops ──
const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── Disaster alert severity ──
const SEVERITY_ITEMS: { key: string; color: string; label: string }[] = [
  { key: "Extreme", color: "#dc2626", label: "極端 Extreme" },
  { key: "Severe", color: "#ea580c", label: "嚴重 Severe" },
  { key: "Moderate", color: "#eab308", label: "中度 Moderate" },
  { key: "Minor", color: "#3b82f6", label: "輕度 Minor" },
];

interface LegendPanelProps {
  visibility: LayerVisibility;
}

export function LegendPanel({ visibility }: LegendPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // 判斷有哪些需要圖例的圖層是開啟的
  const hasEarthquake = visibility.earthquakes;
  const hasDisasterAlert = visibility.disasterAlerts;
  const hasAny = hasEarthquake || hasDisasterAlert;

  if (!hasAny) return null;

  return (
    <div
      style={{
        width: 200,
        background: "rgba(10, 10, 20, 0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(100, 170, 255, 0.15)",
        borderRadius: 8,
        fontFamily: "monospace",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          fontFamily: "monospace",
          letterSpacing: 1,
        }}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0 }} />
          : <ChevronRight size={12} style={{ flexShrink: 0 }} />}
        <span>LEGEND</span>
      </button>

      {/* Content */}
      {expanded && (
        <div style={{ padding: "0 10px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {hasEarthquake && <EarthquakeLegend />}
          {hasDisasterAlert && <DisasterAlertLegend />}
        </div>
      )}
    </div>
  );
}

// ── Earthquake Legend ──

function EarthquakeLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        EARTHQUAKE
      </div>

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(to right, ${EQ_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: 8, color: "rgba(255,255,255,0.35)" }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
          Magnitude
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[3, 5, 7].map((m) => {
            const r = m === 3 ? 4 : m === 5 ? 10 : 24;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 16),
                    height: Math.min(r, 16),
                    borderRadius: "50%",
                    background: "rgba(255, 59, 48, 0.4)",
                    border: "1px solid rgba(255, 59, 48, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Disaster Alert Legend ──

function DisasterAlertLegend() {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: 1, marginBottom: 4 }}>
        DISASTER ALERT
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SEVERITY_ITEMS.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: s.color,
                opacity: 0.8,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
