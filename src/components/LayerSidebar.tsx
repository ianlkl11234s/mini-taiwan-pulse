import { useState } from "react";
import type { LayerVisibility, TransportType, ExpandableLayerKey, ViewMode, DisplayMode } from "../types";
import type { ParamControl } from "../hooks/useTransportParams";

// ── Color Config ──

const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  flights: "#64aaff",
  ships: "#1ad9e5",
  rail: "#ee6c00",
  stationsTHSR: "#ff8c00",
  stationsTRA: "#b8a080",
  stationsMetro: "#00bcd4",
  ports: "#4a90d9",
  lighthouses: "#ffd700",
  airports: "#daa520",
  highways: "#ff6b6b",
  provincialRoads: "#ffa94d",
  windPlan: "#7efcb0",
  busStationsCity: "#66bb6a",
  busStationsIntercity: "#ab47bc",
  bikeStations: "#ffca28",
  cyclingRoutes: "#66bb6a",
  freewayCongestion: "#ef5350",
  weatherStations: "#4dd0e1",
  h3Population: "#ff6b6b",
  popCount: "#f9bd31",
  indicators: "#e25822",
  temperatureWave: "#ff6b35",
  schools: "#42a5f5",
  convenienceStores: "#26c6da",
  submarineCables: "#2196F3",
  landingStations: "#26c6da",
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  flights: "航班 Flight",
  ships: "船舶 Ship",
  rail: "鐵道 Rail",
};

// ── Section Config ──

interface SectionDef {
  title: string;
  layers: {
    key: keyof LayerVisibility;
    label: string;
    expandable?: boolean;
  }[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "MOVING",
    layers: [
      { key: "flights", label: "航班 Flight", expandable: true },
      { key: "ships", label: "船舶 Ship", expandable: true },
      { key: "rail", label: "鐵道 Rail", expandable: true },
    ],
  },
  {
    title: "STATION",
    layers: [
      { key: "stationsTHSR", label: "高鐵站 THSR Station", expandable: true },
      { key: "stationsTRA", label: "台鐵站 TRA Station", expandable: true },
      { key: "stationsMetro", label: "捷運站 Metro Station", expandable: true },
      { key: "busStationsCity", label: "市區公車站 City Bus", expandable: true },
      { key: "busStationsIntercity", label: "公路客運站 Intercity", expandable: true },
      { key: "bikeStations", label: "公共腳踏車 Bike", expandable: true },
    ],
  },
  {
    title: "ROUTE",
    layers: [
      { key: "highways", label: "國道 Highway", expandable: true },
      { key: "provincialRoads", label: "省道 Prov.Road", expandable: true },
      { key: "cyclingRoutes", label: "自行車道 Cycling", expandable: true },
    ],
  },
  {
    title: "INFRA",
    layers: [
      { key: "ports", label: "碼頭 Port", expandable: true },
      { key: "airports", label: "機場 Airport", expandable: true },
      { key: "lighthouses", label: "燈塔 Lighthouse", expandable: true },
    ],
  },
  {
    title: "ANALYTICS",
    layers: [
      { key: "h3Population", label: "人流模擬 Pop. Flow", expandable: true },
      { key: "popCount", label: "人口數 Population", expandable: true },
      { key: "indicators", label: "人口指標 Indicators", expandable: true },
    ],
  },
  {
    title: "MONITOR",
    layers: [
      { key: "freewayCongestion", label: "國道壅塞 Congestion", expandable: true },
    ],
  },
  {
    title: "ENVIRON",
    layers: [
      { key: "temperatureWave", label: "溫度波 Temperature", expandable: true },
      { key: "weatherStations", label: "氣象站 Weather", expandable: true },
      { key: "windPlan", label: "風場範圍 Wind Farm", expandable: true },
    ],
  },
];

// ── Props ──

interface LayerSidebarProps {
  visibility: LayerVisibility;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  counts: { flights: number; ships: number; trains: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
}

// ── Component ──

export function LayerSidebar({
  visibility,
  expandedLayer,
  viewMode,
  displayMode,
  isDarkTheme,
  isMobile,
  counts,
  onLayerClick,
  onToggleVisibility,
  onViewModeChange,
  onDisplayModeChange,
  onHideTransport,
  getControls,
}: LayerSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const textColor = isDarkTheme ? "#fff" : "#333";
  const dimColor = isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";
  const baseFontSize = isMobile ? 12 : 11;

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "flights": return counts.flights;
      case "ships": return counts.ships;
      case "rail": return counts.trains;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Mobile 不收合
  if (isMobile) {
    return (
      <SidebarContent
        visibility={visibility} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} getControls={getControls}
      />
    );
  }

  // ── 收合狀態：窄條 ──
  if (collapsed) {
    const allLayers = SECTIONS.flatMap((s) => s.layers);
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          width: 28,
          background: isDarkTheme ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 8,
          padding: "8px 0",
          cursor: "pointer",
          transition: "width 0.2s ease",
        }}
      >
        {/* 展開箭頭 */}
        <span style={{ fontSize: 9, color: dimColor, userSelect: "none" }}>&#x25B6;</span>
        {/* 活躍圖層色點 */}
        {allLayers.map(({ key }) => {
          const active = visibility[key];
          const color = LAYER_COLORS[key];
          return (
            <div
              key={key}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: active ? color : "transparent",
                border: `1px solid ${active ? color : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")}`,
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    );
  }

  // ── 展開狀態 ──
  return (
    <div style={{ position: "relative", transition: "width 0.2s ease" }}>
      {/* 收合按鈕 */}
      <button
        onClick={() => setCollapsed(true)}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          zIndex: 1,
          width: 18,
          height: 18,
          borderRadius: 3,
          border: "none",
          background: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          color: dimColor,
          fontSize: 8,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        &#x25C0;
      </button>
      <SidebarContent
        visibility={visibility} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} getControls={getControls}
      />
    </div>
  );
}

// ── Sidebar Content (extracted for reuse) ──

function SidebarContent({
  visibility, expandedLayer, viewMode, displayMode, isDarkTheme, isMobile,
  textColor, dimColor, baseFontSize,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport, getControls,
}: {
  visibility: LayerVisibility;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  textColor: string;
  dimColor: string;
  baseFontSize: number;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
}) {
  return (
    <div
      className="layer-sidebar-scroll"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: isMobile ? "100%" : 240,
        maxHeight: isMobile ? undefined : "70vh",
        overflowY: isMobile ? undefined : "auto",
        background: isDarkTheme ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 8,
        padding: "8px 0",
        fontFamily: "monospace",
      }}
    >
      {SECTIONS.map((section, sIdx) => (
        <div key={section.title}>
          {sIdx > 0 && (
            <div
              style={{
                height: 1,
                background: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                margin: "6px 12px",
              }}
            />
          )}

          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              color: dimColor,
              padding: "4px 14px 2px",
              textTransform: "uppercase",
            }}
          >
            {section.title}
          </div>

          {section.layers.map(({ key, label, expandable }) => {
            const active = visibility[key];
            const color = LAYER_COLORS[key];
            const count = getCount(key);
            const isExpanded = expandedLayer === key;
            const isTransport = key in TRANSPORT_LABELS;

            return (
              <div key={key}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    cursor: "pointer",
                    background: isExpanded
                      ? (isDarkTheme ? `${color}15` : `${color}10`)
                      : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(key); }}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: active ? color : "transparent",
                      border: `1.5px solid ${active ? color : (isDarkTheme ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)")}`,
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                      transition: "all 0.15s",
                    }}
                  />

                  <div
                    onClick={() => expandable ? onLayerClick(key) : onToggleVisibility(key)}
                    style={{
                      flex: 1,
                      fontSize: baseFontSize,
                      color: active ? textColor : dimColor,
                      opacity: active ? 1 : 0.6,
                      transition: "all 0.15s",
                    }}
                  >
                    {label}
                    {count != null && count > 0 && (
                      <span style={{ marginLeft: 4, opacity: 0.5, fontSize: baseFontSize - 1 }}>
                        {count}
                      </span>
                    )}
                  </div>

                  {expandable && (
                    <span
                      onClick={() => onLayerClick(key)}
                      style={{
                        fontSize: 10,
                        color: dimColor,
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      &#x25B6;
                    </span>
                  )}
                </div>

                {isExpanded && expandable && (
                  <ExpandedPanel
                    layerKey={key as ExpandableLayerKey}
                    isTransport={isTransport}
                    isDarkTheme={isDarkTheme}
                    isMobile={isMobile}
                    viewMode={viewMode}
                    displayMode={displayMode}
                    onViewModeChange={onViewModeChange}
                    onDisplayModeChange={onDisplayModeChange}
                    onHide={onHideTransport}
                    controls={getControls(key as ExpandableLayerKey)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Expanded Panel ──

interface ExpandedPanelProps {
  layerKey: ExpandableLayerKey;
  isTransport: boolean;
  isDarkTheme: boolean;
  isMobile?: boolean;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHide: () => void;
  controls: ParamControl[];
}

function ExpandedPanel({
  layerKey,
  isTransport,
  isDarkTheme,
  isMobile,
  displayMode,
  onDisplayModeChange,
  onHide,
  controls,
}: ExpandedPanelProps) {
  const btnBase: React.CSSProperties = {
    fontSize: 9,
    padding: "2px 6px",
    borderRadius: 3,
    fontFamily: "monospace",
    cursor: "pointer",
    border: "1px solid transparent",
  };

  const activeBtn: React.CSSProperties = {
    ...btnBase,
    background: isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)",
    border: "1px solid rgba(100,170,255,0.5)",
    color: isDarkTheme ? "#fff" : "#000",
  };

  const inactiveBtn: React.CSSProperties = {
    ...btnBase,
    background: isDarkTheme ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)",
    color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
  };

  const hasTransportControls = isTransport;

  return (
    <div
      style={{
        padding: "6px 14px 8px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      {/* Display mode (flights only) + Hide */}
      {hasTransportControls && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {layerKey === "flights" && (
            <>
              <button style={displayMode === "status" ? activeBtn : inactiveBtn} onClick={() => onDisplayModeChange("status")}>
                Live Status
              </button>
              <button style={displayMode === "trails" ? activeBtn : inactiveBtn} onClick={() => onDisplayModeChange("trails")}>
                Trails
              </button>
            </>
          )}
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>
            Hide
          </button>
        </div>
      )}

      {/* Non-transport: just a Hide button */}
      {!hasTransportControls && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>
            Hide
          </button>
        </div>
      )}

      {/* Controls: sliders + toggles */}
      {controls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {controls.map((ctrl) => {
            if (ctrl.type === "select") {
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{ctrl.label}</span>
                  {ctrl.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => ctrl.onChange(opt.value)}
                      style={{
                        ...btnBase,
                        fontSize: 9,
                        padding: "1px 8px",
                        background: ctrl.value === opt.value
                          ? (isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)")
                          : (isDarkTheme ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)"),
                        border: ctrl.value === opt.value
                          ? "1px solid rgba(100,170,255,0.5)"
                          : `1px solid ${isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                        color: ctrl.value === opt.value
                          ? (isDarkTheme ? "#fff" : "#000")
                          : (isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"),
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              );
            }

            if (ctrl.type === "toggle") {
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                >
                  <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{ctrl.label}</span>
                  <button
                    onClick={() => ctrl.onChange(!ctrl.value)}
                    style={{
                      ...btnBase,
                      fontSize: 9,
                      padding: "1px 8px",
                      background: ctrl.value
                        ? (isDarkTheme ? "rgba(100,170,255,0.3)" : "rgba(100,170,255,0.2)")
                        : (isDarkTheme ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.7)"),
                      border: ctrl.value
                        ? "1px solid rgba(100,170,255,0.5)"
                        : `1px solid ${isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                      color: ctrl.value
                        ? (isDarkTheme ? "#fff" : "#000")
                        : (isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"),
                    }}
                  >
                    {ctrl.value ? "ON" : "OFF"}
                  </button>
                </div>
              );
            }

            // Slider
            const s = ctrl;
            return (
              <label
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
              >
                <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.onChange(Number(e.target.value))}
                  style={{
                    flex: 1,
                    height: 3,
                    accentColor: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                    cursor: "pointer",
                  }}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
