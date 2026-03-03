import { useState, useEffect, useMemo, type CSSProperties } from "react";
import {
  Activity, Layers, MapPin, Settings, X,
  Plane, Ship, TrainFront, Bus, Bike, Route, Anchor, PlaneTakeoff,
  BarChart3, Users, AlertTriangle, CloudSun, Wind,
  ChevronDown, ChevronRight, Search, Navigation,
  Lightbulb, CircleDot, RailSymbol, Thermometer,
  type LucideIcon,
} from "lucide-react";
import type {
  LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode,
} from "../types";
import type { ParamControl } from "../hooks/useTransportParams";
import { ALL_PRESETS, AIRPORT_INFO } from "../map/cameraPresets";

// ── Color Config ──

const LAYER_COLORS: Record<keyof LayerVisibility, string> = {
  flights: "#64aaff", ships: "#1ad9e5", rail: "#ee6c00",
  stationsTHSR: "#ff8c00", stationsTRA: "#b8a080", stationsMetro: "#00bcd4",
  ports: "#4a90d9", lighthouses: "#ffd700", airports: "#daa520",
  highways: "#ff6b6b", provincialRoads: "#ffa94d", windPlan: "#7efcb0",
  busStationsCity: "#66bb6a", busStationsIntercity: "#ab47bc",
  bikeStations: "#ffca28", cyclingRoutes: "#66bb6a",
  freewayCongestion: "#ef5350", weatherStations: "#4dd0e1",
  h3Population: "#ff6b6b", popCount: "#f9bd31", indicators: "#e25822",
  temperatureWave: "#ff6b35",
};

const TRANSPORT_LABELS: Record<string, string> = {
  flights: "Flight", ships: "Ship", rail: "Rail",
};

const LAYER_ICONS: Record<keyof LayerVisibility, LucideIcon> = {
  flights: Plane,
  ships: Ship,
  rail: TrainFront,
  stationsTHSR: TrainFront,
  stationsTRA: RailSymbol,
  stationsMetro: CircleDot,
  busStationsCity: Bus,
  busStationsIntercity: Bus,
  bikeStations: Bike,
  highways: Route,
  provincialRoads: Route,
  cyclingRoutes: Bike,
  ports: Anchor,
  airports: PlaneTakeoff,
  lighthouses: Lightbulb,
  h3Population: Activity,
  popCount: Users,
  indicators: BarChart3,
  freewayCongestion: AlertTriangle,
  weatherStations: CloudSun,
  windPlan: Wind,
  temperatureWave: Thermometer,
};

// ── Section Config ──

interface SectionDef {
  title: string;
  layers: { key: keyof LayerVisibility; label: string; expandable?: boolean }[];
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
      { key: "stationsTHSR", label: "高鐵站 THSR st.", expandable: true },
      { key: "stationsTRA", label: "台鐵站 TRA st.", expandable: true },
      { key: "stationsMetro", label: "捷運站 Metro st.", expandable: true },
      { key: "busStationsCity", label: "市區公車 City Bus", expandable: true },
      { key: "busStationsIntercity", label: "客運 Intercity", expandable: true },
      { key: "bikeStations", label: "自行車站 Bike st.", expandable: true },
    ],
  },
  {
    title: "ROUTE",
    layers: [
      { key: "highways", label: "國道 Highway", expandable: true },
      { key: "provincialRoads", label: "省道 Prov. Road", expandable: true },
      { key: "cyclingRoutes", label: "自行車道 Cycling", expandable: true },
    ],
  },
  {
    title: "INFRA",
    layers: [
      { key: "ports", label: "港口 Port", expandable: true },
      { key: "airports", label: "機場 Airport", expandable: true },
      { key: "lighthouses", label: "燈塔 Lighthouse", expandable: true },
    ],
  },
  {
    title: "ANALYTICS",
    layers: [
      { key: "h3Population", label: "人口流動 Pop. Flow", expandable: true },
      { key: "popCount", label: "人口數 Population", expandable: true },
      { key: "indicators", label: "指標 Indicators", expandable: true },
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
      { key: "weatherStations", label: "氣象站 Weather", expandable: true },
      { key: "windPlan", label: "風電場 Wind Farm", expandable: true },
      { key: "temperatureWave", label: "溫度波 Temperature", expandable: true },
    ],
  },
];

// ── IATA Map for Locations Panel ──

const IATA_MAP: Record<string, string> = {};
for (const [icao, info] of Object.entries(AIRPORT_INFO)) {
  IATA_MAP[icao] = info.iata;
}

// ── Props ──

interface IconRailSidebarProps {
  visibility: LayerVisibility;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  counts: { flights: number; ships: number; trains: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onWidthChange?: (width: number) => void;
}

// ── Shared Styles ──

const ACCENT = "#E5E7EB";
const ACCENT_TOGGLE = "#FFFFFF";
const BG_RAIL = "#0D0E10";
const BG_PANEL = "#141518";
const BORDER = "#2A2D32";
const DIM = "#6B7280";
const INACTIVE_TEXT = "#9CA3AF";

type PanelId = "layers" | "locations";

// ── Main Component ──

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 260;

export function IconRailSidebar({
  visibility, expandedLayer, viewMode, displayMode,
  counts, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport,
  getControls, currentLocationId, onLocationJump, onWidthChange,
}: IconRailSidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>("layers");
  const [locationSearch, setLocationSearch] = useState("");

  const panelOpen = activePanel !== null;

  useEffect(() => {
    onWidthChange?.(RAIL_WIDTH + (panelOpen ? PANEL_WIDTH : 0));
  }, [panelOpen, onWidthChange]);

  const togglePanel = (panel: PanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setActivePanel(null);

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "flights": return counts.flights;
      case "ships": return counts.ships;
      case "rail": return counts.trains;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Filter presets
  const overviewPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "overview"), []);
  const cityPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "city"), []);
  const airportPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "airport"), []);

  const filteredCities = useMemo(() => {
    if (!locationSearch) return cityPresets;
    const q = locationSearch.toLowerCase();
    return cityPresets.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [cityPresets, locationSearch]);

  const filteredAirports = useMemo(() => {
    if (!locationSearch) return airportPresets;
    const q = locationSearch.toLowerCase();
    return airportPresets.filter((p) =>
      p.name.toLowerCase().includes(q)
      || p.id.toLowerCase().includes(q)
      || (IATA_MAP[p.id] ?? "").toLowerCase().includes(q),
    );
  }, [airportPresets, locationSearch]);

  const filteredOverviews = useMemo(() => {
    if (!locationSearch) return overviewPresets;
    const q = locationSearch.toLowerCase();
    return overviewPresets.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [overviewPresets, locationSearch]);

  return (
    <div style={{ display: "flex", height: "100%", pointerEvents: "auto" }}>
      {/* ── Icon Rail ── */}
      <div
        style={{
          width: RAIL_WIDTH,
          background: BG_RAIL,
          borderRight: `1px solid ${BORDER}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 8,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {/* Logo / Activity */}
        <RailIcon icon={Activity} active={false} onClick={() => {}} tooltip="Mini Taiwan Pulse" />

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: BORDER, margin: "8px 0" }} />

        {/* Layers */}
        <RailIcon
          icon={Layers}
          active={activePanel === "layers"}
          onClick={() => togglePanel("layers")}
          tooltip="Layers"
        />

        {/* Locations */}
        <RailIcon
          icon={MapPin}
          active={activePanel === "locations"}
          onClick={() => togglePanel("locations")}
          tooltip="Locations"
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Settings (placeholder) */}
        <RailIcon icon={Settings} active={false} onClick={() => {}} tooltip="Settings" />
      </div>

      {/* ── Sliding Panel ── */}
      <div
        style={{
          width: panelOpen ? PANEL_WIDTH : 0,
          overflow: "hidden",
          transition: "width 0.2s ease",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            width: PANEL_WIDTH,
            height: "100%",
            background: BG_PANEL,
            borderRight: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            transform: panelOpen ? "translateX(0)" : `translateX(-${PANEL_WIDTH}px)`,
            transition: "transform 0.2s ease",
          }}
        >
          {activePanel === "layers" && (
            <LayersPanel
              visibility={visibility}
              expandedLayer={expandedLayer}
              viewMode={viewMode}
              displayMode={displayMode}
              getCount={getCount}
              onLayerClick={onLayerClick}
              onToggleVisibility={onToggleVisibility}
              onViewModeChange={onViewModeChange}
              onDisplayModeChange={onDisplayModeChange}
              onHideTransport={onHideTransport}
              getControls={getControls}
              onClose={closePanel}
            />
          )}
          {activePanel === "locations" && (
            <LocationsPanel
              search={locationSearch}
              onSearchChange={setLocationSearch}
              overviewPresets={filteredOverviews}
              cityPresets={filteredCities}
              airportPresets={filteredAirports}
              currentLocationId={currentLocationId}
              onLocationJump={onLocationJump}
              onClose={closePanel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rail Icon Button ──

function RailIcon({
  icon: Icon, active, onClick, tooltip,
}: {
  icon: LucideIcon; active: boolean; onClick: () => void; tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: "none",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? ACCENT : DIM,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        marginBottom: 4,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <Icon size={20} />
    </button>
  );
}

// ── Panel Header ──

function PanelHeader({
  icon: Icon, title, onClose,
}: {
  icon: LucideIcon; title: string; onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 12px 10px",
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}
    >
      <Icon size={16} color={ACCENT} />
      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>
        {title}
      </span>
      <div style={{ flex: 1 }} />
      <button
        onClick={onClose}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: DIM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Category Label ──

function CategoryLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        color: DIM,
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: "uppercase",
        padding: "10px 12px 4px",
      }}
    >
      {children}
    </div>
  );
}

// ── Toggle Switch ──

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: 28,
        height: 16,
        borderRadius: 8,
        border: "none",
        background: on ? ACCENT_TOGGLE : "#4B5563",
        position: "relative",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: on ? "#1a1a1a" : "#fff",
          position: "absolute",
          top: 2,
          left: on ? 14 : 2,
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

// ══════════════════════════════════
//  LAYERS PANEL
// ══════════════════════════════════

interface LayersPanelProps {
  visibility: LayerVisibility;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  onClose: () => void;
}

function LayersPanel({
  visibility, expandedLayer, viewMode: _viewMode, displayMode,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange: _onViewModeChange, onDisplayModeChange, onHideTransport,
  getControls, onClose,
}: LayersPanelProps) {
  return (
    <>
      <PanelHeader icon={Layers} title="Layers" onClose={onClose} />
      <div
        className="layer-sidebar-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0 8px",
        }}
      >
        {SECTIONS.map((section, sIdx) => (
          <div key={section.title}>
            {sIdx > 0 && (
              <div style={{ height: 1, background: BORDER, margin: "4px 12px" }} />
            )}
            <CategoryLabel>{section.title}</CategoryLabel>
            {section.layers.map(({ key, label, expandable }) => {
              const active = visibility[key];
              const color = LAYER_COLORS[key];
              const count = getCount(key);
              const isExpanded = expandedLayer === key;
              const isTransport = key in TRANSPORT_LABELS;
              const Icon = LAYER_ICONS[key];

              return (
                <div key={key}>
                  {/* Layer Row */}
                  <div
                    onClick={() => expandable ? onLayerClick(key) : onToggleVisibility(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 12px 5px 0",
                      cursor: "pointer",
                      borderLeft: active ? `2px solid ${color}` : "2px solid transparent",
                      paddingLeft: 10,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {/* Icon */}
                    <Icon size={14} color={active ? color : DIM} style={{ flexShrink: 0 }} />

                    {/* Label */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontFamily: "Inter, system-ui, sans-serif",
                        color: active ? "#fff" : INACTIVE_TEXT,
                        transition: "color 0.15s",
                      }}
                    >
                      {label}
                    </span>

                    {/* Count */}
                    {count != null && count > 0 && (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: active ? color : INACTIVE_TEXT,
                          marginRight: 4,
                        }}
                      >
                        {count.toLocaleString()}
                      </span>
                    )}

                    {/* Expand chevron */}
                    {expandable && (
                      <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
                        {isExpanded
                          ? <ChevronDown size={12} />
                          : <ChevronRight size={12} />}
                      </span>
                    )}

                    {/* Toggle switch */}
                    <ToggleSwitch on={active} onChange={() => onToggleVisibility(key)} />
                  </div>

                  {/* Expanded Controls */}
                  {isExpanded && expandable && (
                    <ExpandedControls
                      layerKey={key as ExpandableLayerKey}
                      isTransport={isTransport}
                      displayMode={displayMode}
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
    </>
  );
}

// ── Expanded Controls (param sliders / toggles / selects) ──

interface ExpandedControlsProps {
  layerKey: ExpandableLayerKey;
  isTransport: boolean;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHide: () => void;
  controls: ParamControl[];
}

function ExpandedControls({
  layerKey, isTransport, displayMode,
  onDisplayModeChange, onHide, controls,
}: ExpandedControlsProps) {
  const btnBase: CSSProperties = {
    fontSize: 9,
    padding: "2px 6px",
    borderRadius: 3,
    fontFamily: "monospace",
    cursor: "pointer",
    border: "1px solid transparent",
  };

  const activeBtn: CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
  };

  const inactiveBtn: CSSProperties = {
    ...btnBase,
    background: "rgba(0,0,0,0.4)",
    color: "rgba(255,255,255,0.5)",
  };

  return (
    <div style={{ padding: "6px 12px 8px 36px", display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Display mode (flights only) + Hide */}
      {isTransport && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {layerKey === "flights" && (
            <>
              <button
                style={displayMode === "status" ? activeBtn : inactiveBtn}
                onClick={() => onDisplayModeChange("status")}
              >
                Live Status
              </button>
              <button
                style={displayMode === "trails" ? activeBtn : inactiveBtn}
                onClick={() => onDisplayModeChange("trails")}
              >
                Trails
              </button>
            </>
          )}
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>Hide</button>
        </div>
      )}
      {!isTransport && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={{ ...inactiveBtn, marginLeft: "auto" }} onClick={onHide}>Hide</button>
        </div>
      )}

      {/* Controls */}
      {controls.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {controls.map((ctrl) => {
            if (ctrl.type === "select") {
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace",
                  }}
                >
                  <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                  {ctrl.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => ctrl.onChange(opt.value)}
                      style={{
                        ...btnBase,
                        fontSize: 9,
                        padding: "1px 8px",
                        background: ctrl.value === opt.value
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.4)",
                        border: ctrl.value === opt.value
                          ? "1px solid rgba(255,255,255,0.25)"
                          : "1px solid rgba(255,255,255,0.15)",
                        color: ctrl.value === opt.value ? "#fff" : "rgba(255,255,255,0.4)",
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
                    display: "flex", alignItems: "center", gap: 4,
                    color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace",
                  }}
                >
                  <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                  <button
                    onClick={() => ctrl.onChange(!ctrl.value)}
                    style={{
                      ...btnBase,
                      fontSize: 9,
                      padding: "1px 8px",
                      background: ctrl.value ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.4)",
                      border: ctrl.value
                        ? "1px solid rgba(255,255,255,0.25)"
                        : "1px solid rgba(255,255,255,0.15)",
                      color: ctrl.value ? "#fff" : "rgba(255,255,255,0.4)",
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
                  display: "flex", alignItems: "center", gap: 4,
                  color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace",
                }}
              >
                <span style={{ minWidth: 50, flexShrink: 0 }}>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.onChange(Number(e.target.value))}
                  style={{
                    flex: 1, height: 3,
                    accentColor: ACCENT_TOGGLE,
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

// ══════════════════════════════════
//  LOCATIONS PANEL
// ══════════════════════════════════

interface LocationsPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  overviewPresets: typeof ALL_PRESETS;
  cityPresets: typeof ALL_PRESETS;
  airportPresets: typeof ALL_PRESETS;
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onClose: () => void;
}

function LocationsPanel({
  search, onSearchChange, overviewPresets, cityPresets, airportPresets,
  currentLocationId, onLocationJump, onClose,
}: LocationsPanelProps) {
  return (
    <>
      <PanelHeader icon={MapPin} title="Locations" onClose={onClose} />

      {/* Search Bar */}
      <div style={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#1A1C20",
            borderRadius: 6,
            padding: "6px 8px",
          }}
        >
          <Search size={13} color={DIM} style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search locations..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
        </div>
      </div>

      {/* Body */}
      <div
        className="layer-sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}
      >
        {/* Overview */}
        {overviewPresets.length > 0 && (
          <>
            <CategoryLabel>OVERVIEW</CategoryLabel>
            {overviewPresets.map((p) => (
              <LocationItem
                key={p.id}
                name={p.name}
                subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
                active={currentLocationId === p.id}
                onClick={() => onLocationJump(p.id)}
              />
            ))}
          </>
        )}

        {/* Divider */}
        {overviewPresets.length > 0 && cityPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Major Cities */}
        {cityPresets.length > 0 && (
          <>
            <CategoryLabel>MAJOR CITIES</CategoryLabel>
            {cityPresets.map((p) => (
              <LocationItem
                key={p.id}
                name={p.name}
                subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
                active={currentLocationId === p.id}
                onClick={() => onLocationJump(p.id)}
              />
            ))}
          </>
        )}

        {/* Divider */}
        {cityPresets.length > 0 && airportPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Airports */}
        {airportPresets.length > 0 && (
          <>
            <CategoryLabel>AIRPORT</CategoryLabel>
            {airportPresets.map((p) => {
              const iata = IATA_MAP[p.id];
              return (
                <LocationItem
                  key={p.id}
                  name={p.name}
                  subtitle={iata ? `IATA: ${iata}` : p.id}
                  active={currentLocationId === p.id}
                  onClick={() => onLocationJump(p.id)}
                />
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

// ── Location Item ──

function LocationItem({
  name, subtitle, active, onClick,
}: {
  name: string; subtitle: string; active: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        cursor: "pointer",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = active ? "rgba(255,255,255,0.06)" : "transparent";
      }}
    >
      <MapPin size={14} color={active ? ACCENT : DIM} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: active ? "#fff" : INACTIVE_TEXT,
            fontFamily: "Inter, system-ui, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: DIM,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: active ? ACCENT : DIM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <Navigation size={12} />
      </button>
    </div>
  );
}
