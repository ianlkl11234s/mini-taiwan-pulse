import { useState, useEffect, useMemo, memo, type CSSProperties } from "react";
import {
  Activity, Layers, MapPin, CalendarDays, Settings, X,
  Plane, Ship, TrainFront, Bus, Bike, Route, Anchor, PlaneTakeoff,
  BarChart3, Users, AlertTriangle, CloudSun, Wind,
  ChevronDown, ChevronRight, Search, Navigation,
  Lightbulb, CircleDot, RailSymbol, Thermometer,
  GraduationCap, Store, Play, Cable, Radio, Mountain,
  Cloud, CloudRain,
  Droplets, Droplet, Waves, GitBranch, Dam, Factory, Gauge, Shield, ShieldCheck, Container,
  Flame, Trash2, Truck, MapPinned, Battery, Recycle, Shirt,
  Timer,
  Hospital, Stethoscope, Pill, HeartPulse, Accessibility, Clock, AlertCircle, Bed,
  Sprout,
  Video, Receipt, Coffee, Car,
  ShoppingCart, Warehouse,
  // FORESTRY icons
  Trees, TreePine, Hammer, Signal, PawPrint, Footprints,
  type LucideIcon,
} from "lucide-react";
import type {
  LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode,
} from "../types";
import type { ParamControl } from "../hooks/useTransportParams";
import type { DataRegistry } from "../hooks/useDataRegistry";
import { ALL_PRESETS, AIRPORT_INFO } from "../map/cameraPresets";
// 圖層目錄常數單一真實來源（與 LayerSidebar 共用，消除漂移）
import { LAYER_COLORS, TRANSPORT_LABELS, SECTIONS } from "./sidebar/layerCatalog";

// ── Color Config ──

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
  cctv: Video,
  etcGantry: Receipt,
  serviceArea: Coffee,
  serviceAreaPolygon: Coffee,
  taxiStand: Car,
  ports: Anchor,
  airports: PlaneTakeoff,
  lighthouses: Lightbulb,
  h3Population: Activity,
  popCount: Users,
  indicators: BarChart3,
  socioeconomic: BarChart3,
  spatialEconomy: Store,
  freewayCongestion: AlertTriangle,
  weatherStations: CloudSun,
  windPlan: Wind,
  temperatureWave: Thermometer,
  schools: GraduationCap,
  convenienceStores: Store,
  submarineCables: Cable,
  landingStations: Radio,
  activeFaults: Mountain,
  newsEvents: Radio,
  youbikeFullness: Bike,
  earthquakes: Activity,
  lifelineAlerts: Lightbulb,
  floodAlerts: Waves,
  weatherAlerts: CloudRain,
  transitAlerts: TrainFront,
  safetyAlerts: AlertTriangle,
  roadEvents: AlertTriangle,
  cwaCloudImagery: Cloud,
  cwaRadarImagery: CloudRain,
  aqiImagery: Wind,
  aqiStations: CircleDot,
  aqiMicroSensors: Activity,
  busLive: Bus,
  busIntercityLive: Bus,
  waterBasins: Waves,
  waterRivers: GitBranch,
  waterLevees: Shield,
  waterCanals: Droplets,
  waterProtectionZones: ShieldCheck,
  waterReservoirs: Dam,
  waterFacilities: Factory,
  waterMonitorStations: Gauge,
  waterFloodExtreme: AlertTriangle,
  waterDetentionBasins: Container,
  rainGauge: CloudRain,
  riverLevel: Waves,
  groundwater: Droplet,
  groundwaterWells: Droplet,
  iotWraRiver: Waves,
  iotWraStructure: Gauge,
  floodSensor: Droplets,
  floodSensorIsochrone: Timer,
  taipeiSewer: Waves,
  taipeiEvacuate: Gauge,
  taipeiPumb: Droplets,
  precipRaster: CloudRain,
  fireEvents: Flame,
  fireLatest: Flame,
  fireStations: Truck,
  fireHydrants: Droplet,
  fireIsochrone: Timer,
  medHospital: Hospital,
  medClinic: Stethoscope,
  medPharmacy: Pill,
  medAED: HeartPulse,
  medLTC: Accessibility,
  medIsochrone: Clock,
  medDesert: AlertCircle,
  medICUBeds: Bed,
  agriculture: Sprout,
  agriSoil: Mountain,
  agriSoilFertility: Sprout,
  agriLeisureFarmZones: Sprout,
  agriRuralRegen: MapPinned,
  agriCropSuitability: Sprout,
  agriPOI: Store,
  agriRetail: ShoppingCart,
  agriProduceWholesale: Truck,
  agriWholesaleMarket: Warehouse,
  farmRoads: Route,
  ecoNetworkZones: Mountain,
  // FORESTRY 12 base
  forestCompartments: Trees,
  forestReserve: Shield,
  forestRecreation: TreePine,
  forestRoads: Route,
  forestTreatmentWorks: Hammer,
  forestTrailSigns: MapPin,
  forestSignalPoints: Signal,
  forestEducationCenters: GraduationCap,
  forestWildlife: PawPrint,
  forestDamLakes: Waves,
  forestFlatParks: Sprout,
  forestAlishanRail: TrainFront,
  hikingTrails: Footprints,
  wasteTruck: Truck,
  wasteSchedule: CalendarDays,
  wasteScheduleNote: CalendarDays,
  wasteStopsStatic: MapPinned,
  wasteRoute: Route,
  wasteStop: MapPinned,
  wfIncinerator: Flame,
  wfLandfill: Mountain,
  wfTransfer: Truck,
  wfMedical: AlertTriangle,
  wfMonitoring: Gauge,
  wfRecycling: Recycle,
  wfScrapYard: Trash2,
  wfOther: MapPinned,
  wdClothes: Shirt,
  wdMixed: Trash2,
  wdRecyclingContainer: Recycle,
  wdBattery: Battery,
};

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
  counts: { flights: number; ships: number; trains: number; buses: number; busesIntercity?: number; wasteTrucks?: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  onAllOff: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onWidthChange?: (width: number) => void;
  dataRegistry?: DataRegistry;
  selectedDate?: Date;
  onDateSelect?: (d: Date) => void;
}

// ── Shared Styles ──

const ACCENT = "#E5E7EB";
const ACCENT_TOGGLE = "#FFFFFF";
const BG_RAIL = "#0D0E10";
const BG_PANEL = "rgba(0, 0, 0, 0.45)";
const BORDER = "#2A2D32";
const DIM = "#6B7280";
const INACTIVE_TEXT = "#9CA3AF";

type PanelId = "layers" | "locations";

// ── Main Component ──

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 240;

export function IconRailSidebar({
  visibility, expandedLayer, viewMode, displayMode,
  counts, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport, onAllOff,
  getControls, currentLocationId, onLocationJump, onWidthChange,
}: IconRailSidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelId | null>("layers");
  const [locationSearch, setLocationSearch] = useState("");
  const [comingSoon, setComingSoon] = useState(false);

  // 齒輪「規劃中」提示：顯示後 2 秒自動消失
  useEffect(() => {
    if (!comingSoon) return;
    const t = setTimeout(() => setComingSoon(false), 2000);
    return () => clearTimeout(t);
  }, [comingSoon]);

  const panelOpen = activePanel !== null;

  // Floating panel doesn't push content — always report rail width only
  useEffect(() => {
    onWidthChange?.(RAIL_WIDTH);
  }, [onWidthChange]);

  const togglePanel = (panel: PanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setActivePanel(null);

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "flights": return counts.flights;
      case "ships": return counts.ships;
      case "rail": return counts.trains;
      case "busLive": return counts.buses;
      case "busIntercityLive": return counts.busesIntercity;
      case "wasteTruck": return counts.wasteTrucks;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Filter presets
  const overviewPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "overview"), []);
  const cityPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "city"), []);
  const airportPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "airport"), []);
  const scenePresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "scene"), []);

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

  const filteredScenes = useMemo(() => {
    if (!locationSearch) return scenePresets;
    const q = locationSearch.toLowerCase();
    return scenePresets.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [scenePresets, locationSearch]);

  return (
    <div style={{ position: "relative", height: "100%", pointerEvents: "auto" }}>
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

        {/* Settings（規劃中） */}
        <RailIcon icon={Settings} active={false} onClick={() => setComingSoon(true)} tooltip="Settings" />
      </div>

      {/* 齒輪「規劃中」提示 */}
      {comingSoon && (
        <div
          style={{
            position: "absolute",
            left: RAIL_WIDTH + 8,
            bottom: 12,
            padding: "8px 14px",
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: ACCENT,
            fontSize: 13,
            whiteSpace: "nowrap",
            zIndex: 5,
            pointerEvents: "none",
            animation: "panelFadeIn 0.2s ease-out",
          }}
        >
          ⚙️ 設定功能規劃中
        </div>
      )}

      {/* ── Floating Panel ── */}
      {panelOpen && (
        <>
          <style>{`
            @keyframes panelFadeIn {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              left: RAIL_WIDTH + 8,
              top: 92,
              width: PANEL_WIDTH,
              maxHeight: "70vh",
              background: BG_PANEL,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 3,
              pointerEvents: "auto",
              animation: "panelFadeIn 0.25s ease-out",
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
                onAllOff={onAllOff}
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
                scenePresets={filteredScenes}
                currentLocationId={currentLocationId}
                onLocationJump={onLocationJump}
                onClose={closePanel}
              />
            )}
          </div>
        </>
      )}
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
  title, onClose,
}: {
  title: string; onClose: () => void;
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
  onAllOff: () => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
  onClose: () => void;
}

// 單一 layer row — memo 後只在該 row 的 props 真變動時才 re-render。
// 這讓 LayersPanel 每次被動 re-render（例如 count 變動）時，
// 大多數 row 跳過、只有 count 變化的少數 row 重繪。
interface LayerRowProps {
  layerKey: keyof LayerVisibility;
  label: string;
  expandable: boolean;
  active: boolean;
  color: string;
  count: number | undefined;
  isExpanded: boolean;
  Icon: LucideIcon;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
}

const LayerRow = memo(function LayerRow({
  layerKey, label, expandable, active, color, count, isExpanded, Icon,
  onLayerClick, onToggleVisibility,
}: LayerRowProps) {
  const handleClick = () =>
    expandable ? onLayerClick(layerKey) : onToggleVisibility(layerKey);
  const handleToggle = () => onToggleVisibility(layerKey);

  return (
    <div
      onClick={handleClick}
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
      <Icon size={14} color={active ? color : DIM} style={{ flexShrink: 0 }} />
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
      {expandable && (
        <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      )}
      <ToggleSwitch on={active} onChange={handleToggle} />
    </div>
  );
});

function LayersPanel({
  visibility, expandedLayer, viewMode: _viewMode, displayMode,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange: _onViewModeChange, onDisplayModeChange, onHideTransport,
  onAllOff, getControls, onClose,
}: LayersPanelProps) {
  return (
    <>
      <PanelHeader title="Layers" onClose={onClose} />
      <div style={{ padding: "4px 12px 0" }}>
        <button
          onClick={onAllOff}
          style={{
            width: "100%",
            padding: "5px 0",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: "rgba(255,255,255,0.5)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          All Off
        </button>
      </div>
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
              const isExpanded = expandedLayer === key;
              const isTransport = key in TRANSPORT_LABELS;

              return (
                <div key={key}>
                  <LayerRow
                    layerKey={key}
                    label={label}
                    expandable={!!expandable}
                    active={active}
                    color={LAYER_COLORS[key]}
                    count={getCount(key)}
                    isExpanded={isExpanded}
                    Icon={LAYER_ICONS[key]}
                    onLayerClick={onLayerClick}
                    onToggleVisibility={onToggleVisibility}
                  />
                  {/* Expanded Controls — 不 memo（狀態變動要即時反映到 slider） */}
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
              // options ≥ 4 一律改用原生 <select> dropdown，避免橫向 button 超出 sidebar
              if (ctrl.options.length > 3) {
                return (
                  <div
                    key={ctrl.label}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "monospace",
                    }}
                  >
                    <span style={{ minWidth: 50, flexShrink: 0 }}>{ctrl.label}</span>
                    <select
                      value={ctrl.value}
                      onChange={(e) => ctrl.onChange(e.target.value)}
                      style={{
                        flex: 1, fontSize: 10, padding: "1px 6px",
                        background: "rgba(0,0,0,0.5)", color: "#fff",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 3, fontFamily: "monospace",
                      }}
                    >
                      {ctrl.options.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ background: "#1a1a1a" }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
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
  scenePresets: typeof ALL_PRESETS;
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onClose: () => void;
}

/** 可收合的 section */
function CollapsibleSection({
  title, count, defaultOpen = true, children,
}: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 12px 2px", cursor: "pointer", userSelect: "none",
        }}
      >
        {open
          ? <ChevronDown size={12} color={DIM} />
          : <ChevronRight size={12} color={DIM} />}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: DIM, fontFamily: "Inter, system-ui, sans-serif",
        }}>
          {title}
        </span>
        <span style={{ fontSize: 9, color: DIM, fontFamily: "monospace", marginLeft: 4 }}>
          {count}
        </span>
      </div>
      {open && children}
    </>
  );
}

function LocationsPanel({
  search, onSearchChange, overviewPresets, cityPresets, airportPresets, scenePresets,
  currentLocationId, onLocationJump, onClose,
}: LocationsPanelProps) {
  return (
    <>
      <PanelHeader title="Locations" onClose={onClose} />

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
        {/* Scenes */}
        <CollapsibleSection title="SCENE" count={scenePresets.length} defaultOpen={true}>
          {scenePresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={p.description ?? ""}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
              icon={Play}
            />
          ))}
        </CollapsibleSection>
        {scenePresets.length > 0 && overviewPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Overview */}
        <CollapsibleSection title="OVERVIEW" count={overviewPresets.length} defaultOpen={true}>
          {overviewPresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
            />
          ))}
        </CollapsibleSection>
        {overviewPresets.length > 0 && cityPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Major Cities */}
        <CollapsibleSection title="MAJOR CITIES" count={cityPresets.length}>
          {cityPresets.map((p) => (
            <LocationItem
              key={p.id}
              name={p.name}
              subtitle={`${p.center[1].toFixed(2)}, ${p.center[0].toFixed(2)}`}
              active={currentLocationId === p.id}
              onClick={() => onLocationJump(p.id)}
            />
          ))}
        </CollapsibleSection>
        {cityPresets.length > 0 && airportPresets.length > 0 && (
          <div style={{ height: 1, background: BORDER, margin: "6px 12px" }} />
        )}

        {/* Airports */}
        <CollapsibleSection title="AIRPORT" count={airportPresets.length} defaultOpen={false}>
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
        </CollapsibleSection>
      </div>
    </>
  );
}

// ── Location Item ──

function LocationItem({
  name, subtitle, active, onClick, icon: Icon = MapPin,
}: {
  name: string; subtitle: string; active: boolean; onClick: () => void; icon?: LucideIcon;
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
      <Icon size={14} color={active ? ACCENT : DIM} style={{ flexShrink: 0 }} />
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
