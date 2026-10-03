import { useState } from "react";
import { User } from "lucide-react";
import type { LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode } from "../types";
import { LAYER_COLORS, THEMES } from "./sidebar/layerCatalog";
import { SURFACE, FONT_CJK, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { isStatisticsRenderLayer } from "../data/regionalStatisticsRecipes";
// 與桌機 IconRailSidebar 共用同一套面板元件與四個入口定義（layer-panel-unify P7）
import { LayersPanel } from "./sidebar/LayersPanel";
import { LAYER_PANELS, layerPanelDef, STATISTICS_ALL_OFF_KEYS, type LayerPanelId } from "./sidebar/layerPanels";
import { railPalette, RailThemeContext } from "./sidebar/railTheme";

/** 手機入口＝桌機入口：同一份 `LAYER_PANELS`。 */
export const MOBILE_LAYER_PANELS = LAYER_PANELS;
/** Includes compatibility-only statistics render keys so a mobile all-off cannot leave an old URL active. */
export const MOBILE_STATISTICS_ALL_OFF_KEYS = STATISTICS_ALL_OFF_KEYS;

// ── Props ──

/**
 * 統計圖層即使沒有一般參數控件，也必須可展開以讀取來源、涵蓋與資料健康狀態。
 */
export function hasLayerDetails(key: keyof LayerVisibility, expandable?: boolean): boolean {
  return Boolean(expandable || isStatisticsRenderLayer(key));
}

interface LayerSidebarProps {
  visibility: LayerVisibility;
  /** 對目前使用者上鎖的圖層 keys（動態 gating，見 lib/layerGates）：命中 → 顯示鎖頭 + 禁 toggle */
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  /** 航班／船舶／列車／公車／客運的即時計數不在這裡：row 以 `useLayerLiveCount` per-key 訂閱 liveCountStore */
  counts: { wasteTrucks?: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  /** 批次設定多 layer 可見性（Theme 級全開/全關用） */
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  /** 「全部關閉」（台灣／世界／日本入口；統計入口只關統計） */
  onAllOff?: () => void;
  /** 切到日本分頁時（App 飛到日本，同桌機） */
  onJapanOpen?: () => void;
  /** 可選的「我的」入口，由 App 持有 panel mutex 與會員狀態。 */
  onMemberToggle?: () => void;
  memberActive?: boolean;
  favoriteKeys?: ReadonlySet<string>;
  onToggleFavorite?: (key: string) => void;
}

// ── Component ──

export function LayerSidebar({
  visibility,
  lockedKeys,
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
  onBulkSetVisibility,
  onAllOff,
  onJapanOpen,
  onMemberToggle,
  memberActive,
  favoriteKeys,
  onToggleFavorite,
}: LayerSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const dimColor = isDarkTheme ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";

  const getCount = (key: keyof LayerVisibility): number | undefined => {
    switch (key) {
      case "wasteTruck": return counts.wasteTrucks;
      case "windPlan": return counts.windPlan;
      default: return undefined;
    }
  };

  // Mobile 不收合
  if (isMobile) {
    return (
      <SidebarContent
        visibility={visibility} lockedKeys={lockedKeys} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onBulkSetVisibility={onBulkSetVisibility} onAllOff={onAllOff} onJapanOpen={onJapanOpen}
        onMemberToggle={onMemberToggle} memberActive={memberActive}
        favoriteKeys={favoriteKeys} onToggleFavorite={onToggleFavorite}
      />
    );
  }

  // ── 收合狀態：窄條 ──
  if (collapsed) {
    const allLayers = THEMES.flatMap((t) => t.groups.flatMap((g) => g.layers));
    return (
      <button
        type="button"
        aria-label="展開圖層側欄"
        aria-expanded={false}
        onClick={() => setCollapsed(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          width: 28,
          background: isDarkTheme ? SURFACE.subtle : "rgba(255,255,255,0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: RADIUS.xl,
          padding: "8px 0",
          cursor: "pointer",
          transition: "width 0.2s ease",
          border: "none",
        }}
      >
        {/* 展開箭頭 */}
        <span style={{ fontSize: FONT_SIZE.xs, color: dimColor, userSelect: "none" }}>&#x25B6;</span>
        {/* 活躍圖層色點 */}
        {allLayers.map(({ key }) => {
          const active = visibility[key];
          const color = LAYER_COLORS[key];
          return (
            <span
              key={key}
              style={{
                display: "block",
                width: 8,
                height: 8,
                borderRadius: RADIUS.full,
                background: active ? color : "transparent",
                border: `1px solid ${active ? color : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)")}`,
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            />
          );
        })}
      </button>
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
          borderRadius: RADIUS.md,
          border: "none",
          background: isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          color: dimColor,
          fontSize: FONT_SIZE.xs,
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
        visibility={visibility} lockedKeys={lockedKeys} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onBulkSetVisibility={onBulkSetVisibility} onAllOff={onAllOff} onJapanOpen={onJapanOpen}
        onMemberToggle={onMemberToggle} memberActive={memberActive}
        favoriteKeys={favoriteKeys} onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

// ── Sidebar Content ──

/**
 * 手機底部面板（layer-panel-unify P7）：分頁＝桌機 rail 的四個入口（台灣／統計／世界／日本），
 * 內容直接用桌機同一個 `LayersPanel`（列、主題列、展開區、搜尋全部共用，不再有手機專用的列）。
 */
function SidebarContent({
  visibility, lockedKeys, expandedLayer, viewMode, displayMode, isDarkTheme, isMobile,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onBulkSetVisibility, onAllOff, onJapanOpen,
  onMemberToggle, memberActive, favoriteKeys, onToggleFavorite,
}: {
  visibility: LayerVisibility;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  isDarkTheme: boolean;
  isMobile?: boolean;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  onAllOff?: () => void;
  onJapanOpen?: () => void;
  onMemberToggle?: () => void;
  memberActive?: boolean;
  favoriteKeys?: ReadonlySet<string>;
  onToggleFavorite?: (key: string) => void;
}) {
  const palette = railPalette(isDarkTheme);
  const { TEXT_STRONG, DIM, ROW_ACTIVE, ALLOFF_BG } = palette;
  const [tab, setTab] = useState<LayerPanelId>("layers");
  const [panelSearch, setPanelSearch] = useState<Record<LayerPanelId, string>>({ layers: "", statistics: "", world: "", japan: "" });
  const panel = layerPanelDef(tab);
  const openTab = (next: LayerPanelId) => {
    if (next === "japan" && tab !== "japan") onJapanOpen?.();
    setTab(next);
  };

  return (
    <RailThemeContext.Provider value={palette}>
    <div
      className="layer-sidebar-scroll"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: isMobile ? "100%" : 240,
        maxHeight: isMobile ? undefined : "70vh",
        overflowY: isMobile ? undefined : "auto",
        background: isDarkTheme ? SURFACE.subtle : "rgba(255,255,255,0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: RADIUS.xl,
        padding: "8px 0",
        fontFamily: FONT_CJK,
      }}
    >
      <div role="tablist" aria-label="圖層入口" style={{ display: "flex", gap: 4, margin: "0 12px 6px" }}>
        {LAYER_PANELS.map((entry) => {
          const active = tab === entry.id;
          return <button key={entry.id} type="button" role="tab" aria-selected={active} onClick={() => openTab(entry.id)} style={{ flex: 1, minWidth: 0, border: "none", borderRadius: RADIUS.lg, padding: "6px 4px", cursor: "pointer", background: active ? ROW_ACTIVE : "transparent", color: active ? TEXT_STRONG : DIM, fontSize: FONT_SIZE.md, fontWeight: 700, fontFamily: FONT_CJK }}>{entry.shortTitle}</button>;
        })}
      </div>
      {onMemberToggle && (
        <button
          type="button"
          onClick={onMemberToggle}
          style={{
            display: "flex", alignItems: "center", gap: 6, margin: "0 12px 6px", padding: "6px 8px",
            border: "none", borderRadius: RADIUS.lg, cursor: "pointer",
            background: memberActive ? ALLOFF_BG : "transparent",
            color: TEXT_STRONG, fontSize: FONT_SIZE.md, fontFamily: FONT_CJK,
          }}
        >
          <User size={14} /> 我的
        </button>
      )}
      <LayersPanel
        key={panel.id}
        panelId={panel.id}
        onSearchInPanel={(target, query) => { setPanelSearch((prev) => ({ ...prev, [target]: query })); openTab(target); }}
        search={panelSearch[panel.id]}
        onSearchChange={(value) => setPanelSearch((prev) => ({ ...prev, [panel.id]: value }))}
        themes={panel.themes}
        macroGroups={panel.macroGroups}
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
      />
    </div>
    </RailThemeContext.Provider>
  );
}
