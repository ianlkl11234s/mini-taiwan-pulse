import { useState, useEffect, useMemo, useRef, type ComponentType } from "react";
import { FONT_CJK, FONT_DATA, RADIUS, FONT_SIZE, ELEVATION, LAYOUT } from "../styles/designTokens";
import {
  // 以下 import 沒有一顆是餵圖層的 —— 全是本元件自己的 UI（rail 按鈕 / 展開箭頭 / 搜尋框…）。
  // 圖層 icon 由 layerManifest 派生（sidebar/LayersPanel.tsx 的 LAYER_ICONS），新增圖層請改 manifest 的 `icon` 欄。
  Activity, Layers, ChartColumn, MapPin, User, Bot,
  ChevronDown, ChevronRight, Search, Navigation,
  Radio, Globe,
  Satellite,   // 衛星情報 Console 的 rail 按鈕
  PanelRight,  // 監測模式 Monitor split（右半邊）rail 按鈕
  Database,    // 資料來源 rail 按鈕
  type LucideIcon,
} from "lucide-react";
import type {
  LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode,
} from "../types";
import type { DataRegistry } from "../hooks/useDataRegistry";
import { ALL_PRESETS } from "../map/cameraPresets";
import { MONITOR_SPLIT_DOCK } from "./intel/monitor/monitorSplitLayout";
import { searchLocationPresets } from "../lib/locationSearch";
import { DataSourcePanel } from "./sidebar/DataSourcePanel";
import { panelForExplorationLayers, type ExplorationPanel } from "../research/explorationNavigation";
// 圖層面板共用外殼（layer-panel-unify A 段）：四個入口與手機底部面板用同一套元件
import { LayersPanel, RailPanelHeader } from "./sidebar/LayersPanel";
import { LAYER_PANELS, type LayerPanelId } from "./sidebar/layerPanels";
import { railPalette, RailThemeContext, useRailTheme } from "./sidebar/railTheme";

// 既有 export 維持原路徑（測試與其他模組從這裡 import）
export { LAYER_ICONS } from "./sidebar/LayersPanel";
export { MAIN_THEMES, getThemeLayerKeys } from "./sidebar/layerPanels";

// ── Props ──

interface IconRailSidebarProps {
  visibility: LayerVisibility;
  /** 主題模式：白底地圖時傳 false，rail / panel 切淺色 palette（預設深色） */
  isDarkTheme?: boolean;
  /** 對目前使用者上鎖的圖層 keys（動態 gating，見 lib/layerGates）：命中 → 顯示鎖頭 + 禁 toggle */
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  /** 航班／船舶／列車／公車／客運的即時計數不在這裡：row 以 `useLayerLiveCount` per-key 訂閱 liveCountStore */
  counts: { wasteTrucks?: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onAllOff: () => void;
  /** 批次設定多 layer 可見性（Theme 級全開/全關用） */
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  currentLocationId?: string;
  onLocationJump: (presetId: string) => void;
  onWidthChange?: (width: number) => void;
  dataRegistry?: DataRegistry;
  selectedDate?: Date;
  onDateSelect?: (d: Date) => void;
  /** 即時情報 Intel panel toggle（外部渲染，rail 只負責切換） */
  onIntelToggle?: () => void;
  intelActive?: boolean;
  /** 衛星情報 Satellite Console panel toggle */
  onSatelliteToggle?: () => void;
  satelliteActive?: boolean;
  /** 由外部觸發強制收起 rail panel（4-way panel mutex 用）— epoch 變動就收 */
  externalCloseEpoch?: number;
  /** 監測模式 Monitor split（右半邊）toggle */
  onMonitorSplitToggle?: () => void;
  monitorSplitActive?: boolean;
  /** split 開啟時把 Layers 浮動面板縮短，避免擋住台灣本島 */
  compactLayers?: boolean;
  /** 打開「日本」rail tab 時觸發（App 用來 flyTo 日本；clone SatelliteConsole 自動飛台灣模式） */
  onJapanOpen?: () => void;
  /** 外部持有會員面板互斥與登入狀態；rail 只提供入口。 */
  onMemberToggle?: () => void;
  memberActive?: boolean;
  favoriteKeys?: ReadonlySet<string>;
  onToggleFavorite?: (key: string) => void;
  /** DEV-only 本地研究 Agent 的單一常駐實例由 App 持有；rail 僅提供開關。 */
  agentAvailable?: boolean;
  agentActive?: boolean;
  onAgentToggle?: () => void;
}


type PanelId = LayerPanelId | "locations" | "datasource";

// ── Main Component ──

const RAIL_WIDTH = 56;
const PANEL_WIDTH = 288;

export function IconRailSidebar({
  visibility, lockedKeys, expandedLayer, viewMode, displayMode,
  counts, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onAllOff,
  onBulkSetVisibility,
  currentLocationId, onLocationJump, onWidthChange,
  onIntelToggle, intelActive,
  onSatelliteToggle, satelliteActive,
  externalCloseEpoch,
  onMonitorSplitToggle, monitorSplitActive,
  compactLayers,
  onJapanOpen,
  onMemberToggle, memberActive,
  favoriteKeys, onToggleFavorite,
  agentAvailable, agentActive, onAgentToggle,
  isDarkTheme = true,
}: IconRailSidebarProps) {
  const palette = railPalette(isDarkTheme);
  const { BG_RAIL, BORDER, BG_PANEL, PANEL_BORDER } = palette;
  const [activePanel, setActivePanel] = useState<PanelId | null>("layers");
  const lastExplorationPanel = useRef<ExplorationPanel>("layers");
  const [locationSearch, setLocationSearch] = useState("");
  // 四個入口各自保留搜尋字（P9：各面板搜自己）
  const [panelSearch, setPanelSearch] = useState<Record<LayerPanelId, string>>({ layers: "", statistics: "", world: "", japan: "" });

  // 4-way panel mutex：外部（Intel / Satellite）打開時，epoch 變動 → 收 rail panel
  const firstEpochRunRef = useRef(true);
  useEffect(() => {
    if (firstEpochRunRef.current) { firstEpochRunRef.current = false; return; }
    if (externalCloseEpoch === undefined) return;
    setActivePanel(null);
  }, [externalCloseEpoch]);

  const closeExternalPanels = () => {
    if (agentActive && onAgentToggle) onAgentToggle();
    if (memberActive && onMemberToggle) onMemberToggle();
    if (intelActive && onIntelToggle) onIntelToggle();
    if (satelliteActive && onSatelliteToggle) onSatelliteToggle();
  };

  useEffect(() => {
    const onExplore = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const rawKeys = detail && typeof detail === "object" && Array.isArray((detail as { layerKeys?: unknown }).layerKeys)
        ? (detail as { layerKeys: unknown[] }).layerKeys.filter((key): key is string => typeof key === "string") : [];
      if (rawKeys.length) {
        const panel = panelForExplorationLayers(rawKeys);
        lastExplorationPanel.current = panel;
        closeExternalPanels();
        setActivePanel(panel);
      } else setActivePanel(current => current ?? lastExplorationPanel.current);
    };
    window.addEventListener("pulse:explore-layers", onExplore);
    return () => window.removeEventListener("pulse:explore-layers", onExplore);
  }, [memberActive, onMemberToggle, intelActive, onIntelToggle, satelliteActive, onSatelliteToggle, agentActive, onAgentToggle]);

  const panelOpen = activePanel !== null;

  // Floating panel doesn't push content — always report rail width only
  useEffect(() => {
    onWidthChange?.(RAIL_WIDTH);
  }, [onWidthChange]);

  // Layers 入口紅點：每次進站顯示，第一次點開 Layers 後本 session 消失（引導訪客發現圖層）
  const [layersBadgeSeen, setLayersBadgeSeen] = useState(false);

  const togglePanel = (panel: PanelId) => {
    if (panel === "layers") setLayersBadgeSeen(true);
    // 是否為「開啟」動作（切到別的 panel 或開啟目前關閉的）。activePanel === panel 才是關閉。
    const willOpen = activePanel !== panel;
    // 開啟 Layers/Locations 時，關掉 Intel / Satellite（左側 panel 互斥）。
    // ⚠️ 副作用必須放在 setState updater 外：StrictMode 下 updater 會被呼叫兩次，
    // 若在其中 toggle，Intel/Satellite 會開了又關（淨零）→ 關不掉。
    if (willOpen) {
      if (panel === "layers" || panel === "statistics" || panel === "world" || panel === "japan") lastExplorationPanel.current = panel;
      closeExternalPanels();
      // 打開「日本」tab → 自動飛日本（App 用 mapRef flyTo）
      if (panel === "japan") onJapanOpen?.();
    }
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setActivePanel(null);

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "wasteTruck": return counts.wasteTrucks;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Filter presets
  const overviewPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "overview"), []);
  const cityPresets = useMemo(() => ALL_PRESETS.filter((p) => p.category === "city"), []);

  const filteredCities = useMemo(() => {
    return searchLocationPresets(cityPresets, locationSearch);
  }, [cityPresets, locationSearch]);

  const filteredOverviews = useMemo(() => {
    return searchLocationPresets(overviewPresets, locationSearch);
  }, [overviewPresets, locationSearch]);

  return (
    <RailThemeContext.Provider value={palette}>
    <div style={{ position: "relative", height: "100%", pointerEvents: "auto" }}>
      {/* ── Icon Rail ── */}
      <div data-viewport-occluder="icon-rail" data-boot-part="rail"
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
          tooltip="台灣 Taiwan"
          badge={!layersBadgeSeen}
        />

        {/* 統計 Statistics：獨立功能入口，共用既有圖層開關狀態 */}
        <RailIcon
          icon={StatisticsGlyph}
          active={activePanel === "statistics"}
          onClick={() => togglePanel("statistics")}
          tooltip="統計 Statistics"
        />

        {/* 🌍 世界 World（維持獨立 rail，排在 Layers 之後） */}
        <RailIcon
          icon={WorldGlyph}
          active={activePanel === "world"}
          onClick={() => togglePanel("world")}
          tooltip="世界 World"
        />

        {/* 🗾 日本 Japan（clone 世界 tab；打開自動飛日本） */}
        <RailIcon
          icon={JapanGlyph}
          active={activePanel === "japan"}
          onClick={() => togglePanel("japan")}
          tooltip="日本 Japan"
        />

        {/* Locations */}
        <RailIcon
          icon={MapPin}
          active={activePanel === "locations"}
          onClick={() => togglePanel("locations")}
          tooltip="Locations"
        />

        {/* 資料來源（Phase K：收進側邊欄，取代右下浮動 ⓘ 抽屜） */}
        <RailIcon
          icon={Database}
          active={activePanel === "datasource"}
          onClick={() => togglePanel("datasource")}
          tooltip="資料來源"
        />

        {agentAvailable && onAgentToggle && (
          <RailIcon
            icon={Bot}
            active={!!agentActive}
            onClick={() => { if (!agentActive) { closePanel(); closeExternalPanels(); } onAgentToggle(); }}
            tooltip="本地 Agent"
          />
        )}

        {/* 即時情報 Intel */}
        {onIntelToggle && (
          <RailIcon
            icon={Radio}
            active={!!intelActive}
            onClick={() => {
              if (!intelActive) { closePanel(); if (agentActive) onAgentToggle?.(); }
              onIntelToggle();
            }}
            tooltip="即時情報 Intel"
          />
        )}

        {/* 衛星情報 Satellite Console */}
        {onSatelliteToggle && (
          <RailIcon
            icon={Satellite}
            active={!!satelliteActive}
            onClick={() => {
              if (!satelliteActive) { closePanel(); if (agentActive) onAgentToggle?.(); }
              onSatelliteToggle();
            }}
            tooltip="衛星情報 Satellite"
          />
        )}

        {/* 監測模式 Monitor split（右半邊） */}
        {onMonitorSplitToggle && (
          <RailIcon
            icon={PanelRight}
            active={!!monitorSplitActive}
            onClick={() => { if (!monitorSplitActive && agentActive) onAgentToggle?.(); onMonitorSplitToggle(); }}
            tooltip="監測模式 Monitor"
          />
        )}

        {onMemberToggle && (
          <RailIcon
            icon={User}
            active={!!memberActive}
            onClick={() => { if (!memberActive) { closePanel(); if (agentActive) onAgentToggle?.(); } onMemberToggle(); }}
            tooltip="會員專區"
          />
        )}

      </div>

      {/* ── Floating Panel ── */}
      {panelOpen && (
        <>
          <style>{`
            @keyframes panelFadeIn {
              from { opacity: 0; transform: translateX(-12px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div data-viewport-occluder="sidebar-panel"
            style={{
              position: "absolute",
              left: RAIL_WIDTH + 8,
              top: LAYOUT.leftDockTop,
              width: compactLayers ? MONITOR_SPLIT_DOCK.layersWidth : PANEL_WIDTH,
              maxHeight: compactLayers ? `${MONITOR_SPLIT_DOCK.layersMaxVh * 100}vh` : "70vh",
              background: BG_PANEL,
              border: `1px solid ${PANEL_BORDER}`,
              boxShadow: ELEVATION.lg,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: RADIUS.xl,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              zIndex: 3,
              pointerEvents: "auto",
              animation: "panelFadeIn 0.25s ease-out",
            }}
          >
            {LAYER_PANELS.map((panel) => activePanel === panel.id && (
              <LayersPanel
                key={panel.id}
                panelId={panel.id}
                onSearchInPanel={(target, query) => {
                  setPanelSearch((prev) => ({ ...prev, [target]: query }));
                  togglePanel(target);
                }}
                search={panelSearch[panel.id]}
                onSearchChange={(value) => setPanelSearch((prev) => ({ ...prev, [panel.id]: value }))}
                themes={panel.themes}
                title={panel.title}
                showMacroGroups={panel.showMacroGroups}
                allOffKeys={panel.allOffKeys}
                statisticsModeControl={panel.statisticsModeControl}
                visibility={visibility}
                lockedKeys={lockedKeys}
                expandedLayer={expandedLayer}
                viewMode={viewMode}
                displayMode={displayMode}
                getCount={getCount}
                onLayerClick={onLayerClick}
                onToggleVisibility={onToggleVisibility}
                onViewModeChange={onViewModeChange}
                onDisplayModeChange={onDisplayModeChange}
                onAllOff={onAllOff}
                onBulkSetVisibility={onBulkSetVisibility}
                favoriteKeys={favoriteKeys}
                onToggleFavorite={onToggleFavorite}
                onClose={closePanel}
              />
            ))}
            {activePanel === "locations" && (
              <LocationsPanel
                search={locationSearch}
                onSearchChange={setLocationSearch}
                overviewPresets={filteredOverviews}
                cityPresets={filteredCities}
                currentLocationId={currentLocationId}
                onLocationJump={onLocationJump}
                onClose={closePanel}
              />
            )}
            {activePanel === "datasource" && (
              <DataSourcePanel
                isDarkTheme={isDarkTheme}
                lockedKeys={lockedKeys}
                onActivateLayer={onBulkSetVisibility ? (key) => onBulkSetVisibility([key], true) : undefined}
                onClose={closePanel}
              />
            )}
          </div>
        </>
      )}

    </div>
    </RailThemeContext.Provider>
  );
}

// ── Rail Icon Button ──

// 統計沿用 Layers 底圖，右下角以長條圖徽章辨識。
function StatisticsGlyph({ size = 20 }: { size?: number }) {
  const { BG_RAIL } = useRailTheme();
  const badge = Math.round(size * 0.66);
  return (
    <span aria-hidden style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <Layers size={size} />
      <span style={{ position: "absolute", right: -4, bottom: -4, width: badge, height: badge,
        borderRadius: "50%", background: BG_RAIL, border: "1.5px solid currentColor",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChartColumn size={Math.round(badge * 0.75)} strokeWidth={2} />
      </span>
    </span>
  );
}

function WorldGlyph({ size = 20 }: { size?: number }) {
  const badge = Math.round(size * 0.58);
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <Layers size={size} />
      <Globe
        size={badge}
        style={{ position: "absolute", right: -3, bottom: -3, strokeWidth: 2.5 }}
      />
    </span>
  );
}

// 「日本」rail icon：比照 WorldGlyph 的「Layers 底 + 右下角徽章」構圖 ——
// 世界是 Layers＋地球，日本是 Layers＋右下「JP」圓徽（currentColor 隨 active/dim 變色，非紅點）。
// 圓徽底色用 rail 背景做 knockout，讓 JP 兩字在 Layers 線條上仍清楚。
function JapanGlyph({ size = 20 }: { size?: number }) {
  const { BG_RAIL } = useRailTheme();
  const badge = Math.round(size * 0.66);
  return (
    // aria-hidden：「JP」是裝飾文字，button 名稱應走 RailIcon 的 title「日本 Japan」
    // （否則 button 的 accessible name 會被可見文字 JP 蓋過）。
    <span aria-hidden style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      <Layers size={size} />
      <span
        style={{
          position: "absolute", right: -4, bottom: -4,
          width: badge, height: badge, borderRadius: "50%",
          background: BG_RAIL,
          border: "1.5px solid currentColor",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.round(badge * 0.5),
          fontWeight: 800, lineHeight: 1, letterSpacing: "-0.5px",
          fontFamily: FONT_CJK,
        }}
      >
        JP
      </span>
    </span>
  );
}

function RailIcon({
  icon: Icon, active, onClick, tooltip, badge,
}: {
  icon: ComponentType<{ size?: number }>; active: boolean; onClick: () => void; tooltip: string;
  /** 右上角紅底白字「!」提示圓點（引導點擊；點開後由呼叫端關閉） */
  badge?: boolean;
}) {
  const { ACCENT, DIM, RAIL_ICON_ACTIVE } = useRailTheme();
  return (
    <button
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: RADIUS.xl,
        border: "none",
        background: active ? RAIL_ICON_ACTIVE : "transparent",
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
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#dc2626",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: "14px",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          !
        </span>
      )}
    </button>
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
  const { DIM } = useRailTheme();
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 12px 2px", cursor: "pointer", userSelect: "none",
        }}
      >
        {open
          ? <ChevronDown size={12} color={DIM} />
          : <ChevronRight size={12} color={DIM} />}
        <span style={{
          fontSize: FONT_SIZE.sm, fontWeight: 700, letterSpacing: 1.5,
          color: DIM, fontFamily: FONT_CJK,
        }}>
          {title}
        </span>
        <span style={{ fontSize: FONT_SIZE.xs, color: DIM, fontFamily: FONT_DATA, marginLeft: 4 }}>
          {count}
        </span>
      </div>
      {open && children}
    </>
  );
}

function LocationsPanel({
  search, onSearchChange, overviewPresets, cityPresets,
  currentLocationId, onLocationJump, onClose,
}: LocationsPanelProps) {
  const { DIM, SEARCH_BG, TEXT_STRONG, BORDER } = useRailTheme();
  return (
    <>
      <RailPanelHeader title="Locations" onClose={onClose} />

      {/* Search Bar */}
      <div style={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: SEARCH_BG,
            borderRadius: RADIUS.lg,
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
              color: TEXT_STRONG,
              fontSize: FONT_SIZE.md,
              fontFamily: FONT_CJK,
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
  const { ACCENT, DIM, INACTIVE_TEXT, TEXT_STRONG, ROW_HOVER, ROW_ACTIVE } = useRailTheme();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${subtitle}`}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        cursor: "pointer",
        background: active ? ROW_ACTIVE : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = ROW_HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = active ? ROW_ACTIVE : "transparent";
      }}
    >
      <Icon size={14} color={active ? ACCENT : DIM} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: FONT_SIZE.md,
            fontWeight: 600,
            color: active ? TEXT_STRONG : INACTIVE_TEXT,
            fontFamily: FONT_CJK,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: FONT_SIZE.sm,
            color: DIM,
            fontFamily: FONT_DATA,
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
          borderRadius: RADIUS.md,
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
