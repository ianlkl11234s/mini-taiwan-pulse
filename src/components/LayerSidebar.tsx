import { getStatisticsVisual } from "../data/statisticsVisuals";
import { LayerToggleSwitch } from "./sidebar/LayerToggleSwitch";
import { useState } from "react";
import { Lock, Search, Star, User } from "lucide-react";
import type { LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode } from "../types";
// AR-22 P4：控件不再由 App 經 4 層 props 傳下來（getControls drilling 已拆除）。
// 展開的那一層自己 per-key 訂閱 —— 拖 slider 只喚醒這個元件，App 不 re-render。
import { buildParamControls } from "../state/layerParamsControls";
import { useLayerParams } from "../state/layerParamsStore";
// 圖層目錄常數單一真實來源（與 IconRailSidebar 共用，消除漂移）
import {
  LAYER_COLORS,
  LAYER_MACRO_GROUPS,
  STATISTICS_DATA_THEMES,
  STATISTICS_TAB_THEMES,
  THEMES,
  themeMacroGroup,
  TRANSPORT_LABELS,
  type ThemeDef,
} from "./sidebar/layerCatalog";
import { SURFACE, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { StatisticsModeControl } from "./sidebar/StatisticsModeControl";
import { StatisticsDetails } from "./sidebar/StatisticsDetails";
import { MedicalStatisticsGroupControls } from "./sidebar/MedicalStatisticsGroupControls";
import { getMedicalStatisticsGroup } from "../data/medicalStatisticsGroups";
import { isStatisticsRenderLayer, STATISTICS_RENDER_KEYS } from "../data/regionalStatisticsRecipes";
import { searchLayers } from "../lib/layerSearch";

const statisticsDataThemeTitles = new Set(STATISTICS_DATA_THEMES.map((theme) => theme.title));
/** Mobile has the same two entry points as desktop: general layers and statistics. */
export const MOBILE_LAYER_THEMES = THEMES.filter((theme) => !statisticsDataThemeTitles.has(theme.title));
/** Includes compatibility-only statistics render keys so a mobile all-off cannot leave an old URL active. */
export const MOBILE_STATISTICS_ALL_OFF_KEYS = [...new Set([...STATISTICS_RENDER_KEYS, ...STATISTICS_TAB_THEMES.flatMap(theme => theme.groups.flatMap(group => group.layers.map(layer => layer.key)))])];

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
  counts: { flights: number; ships: number; trains: number; buses: number; busesIntercity?: number; wasteTrucks?: number; windPlan?: number };
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onHideTransport: () => void;
  /** 批次設定多 layer 可見性（Theme 級全開/全關用） */
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
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
  onHideTransport,
  onBulkSetVisibility,
  onMemberToggle,
  memberActive,
  favoriteKeys,
  onToggleFavorite,
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
      case "busLive": return counts.buses;
      case "busIntercityLive": return counts.busesIntercity;
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
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} onBulkSetVisibility={onBulkSetVisibility}
        onMemberToggle={onMemberToggle} memberActive={memberActive}
        favoriteKeys={favoriteKeys} onToggleFavorite={onToggleFavorite}
      />
    );
  }

  // ── 收合狀態：窄條 ──
  if (collapsed) {
    const allLayers = THEMES.flatMap((t) => t.groups.flatMap((g) => g.layers));
    return (
      <div
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
        }}
      >
        {/* 展開箭頭 */}
        <span style={{ fontSize: FONT_SIZE.xs, color: dimColor, userSelect: "none" }}>&#x25B6;</span>
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
                borderRadius: RADIUS.full,
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
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} onBulkSetVisibility={onBulkSetVisibility}
        onMemberToggle={onMemberToggle} memberActive={memberActive}
        favoriteKeys={favoriteKeys} onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}

// ── Sidebar Content (extracted for reuse) ──

function SidebarContent({
  visibility, lockedKeys, expandedLayer, viewMode, displayMode, isDarkTheme, isMobile,
  textColor, dimColor, baseFontSize,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport, onBulkSetVisibility,
  onMemberToggle, memberActive, favoriteKeys, onToggleFavorite,
}: {
  visibility: LayerVisibility;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
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
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  onMemberToggle?: () => void;
  memberActive?: boolean;
  favoriteKeys?: ReadonlySet<string>;
  onToggleFavorite?: (key: string) => void;
}) {
  const [mobileTab, setMobileTab] = useState<"layers" | "statistics">("layers");
  const [search, setSearch] = useState("");
  const togglePalette = isDarkTheme
    ? { ACCENT_TOGGLE: "#fff", TOGGLE_OFF: "#4b5563", TOGGLE_KNOB_ON: "#111827", TOGGLE_KNOB_OFF: "#fff" }
    : { ACCENT_TOGGLE: "#1F2937", TOGGLE_OFF: "#D1D5DB", TOGGLE_KNOB_ON: "#fff", TOGGLE_KNOB_OFF: "#fff" };
  const activeThemes: readonly ThemeDef[] = isMobile ? (mobileTab === "statistics" ? STATISTICS_TAB_THEMES : MOBILE_LAYER_THEMES) : THEMES;
  const activeLayerKeys = new Set(activeThemes.flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key))));
  const searchResults = searchLayers(search, { favoriteKeys }).filter((result) => activeLayerKeys.has(result.key));
  const visibleSearchResults = searchResults.slice(0, 50);
  // Theme 摺疊狀態：預設摺疊 defaultCollapsed=true 的（目前僅環境氣候 Environment 預設展開）
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(
    () => new Set([...MOBILE_LAYER_THEMES, ...STATISTICS_TAB_THEMES].filter((t) => t.defaultCollapsed).map((t) => t.title)),
  );
  const toggleTheme = (title: string) => {
    setCollapsedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

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
        background: isDarkTheme ? SURFACE.subtle : "rgba(255,255,255,0.5)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: RADIUS.xl,
        padding: "8px 0",
        fontFamily: FONT_DATA,
      }}
    >
      {isMobile && <div role="tablist" aria-label="圖層分類" style={{ display: "flex", gap: 4, margin: "0 12px 6px" }}>
        {(["layers", "statistics"] as const).map((tab) => {
          const active = mobileTab === tab;
          const label = tab === "layers" ? "圖層" : "統計";
          return <button key={tab} type="button" role="tab" aria-selected={active} onClick={() => { setMobileTab(tab); setSearch(""); }} style={{ flex: 1, border: "none", borderRadius: RADIUS.lg, padding: "6px 8px", cursor: "pointer", background: active ? (isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)") : "transparent", color: active ? textColor : dimColor, fontSize: baseFontSize, fontWeight: 700 }}>{label}</button>;
        })}
      </div>}
      {isMobile && mobileTab === "statistics" && <StatisticsModeControl />}
      {isMobile && mobileTab === "statistics" && onBulkSetVisibility && <button type="button" onClick={() => onBulkSetVisibility(MOBILE_STATISTICS_ALL_OFF_KEYS, false)} style={{ margin: "0 12px 6px", border: "none", borderRadius: RADIUS.lg, padding: "6px 8px", cursor: "pointer", background: "transparent", color: dimColor, fontSize: baseFontSize, textAlign: "left" }}>統計全關</button>}
      {onMemberToggle && (
        <button
          onClick={onMemberToggle}
          style={{
            display: "flex", alignItems: "center", gap: 6, margin: "0 12px 6px", padding: "6px 8px",
            border: "none", borderRadius: RADIUS.lg, cursor: "pointer",
            background: memberActive ? (isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)") : "transparent",
            color: textColor, fontSize: baseFontSize,
          }}
        >
          <User size={14} /> 我的
        </button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 12px 6px", padding: "6px 8px", borderRadius: RADIUS.lg, background: isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" }}>
        <Search size={13} color={dimColor} />
        <input
          aria-label="搜尋圖層"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜尋圖層…"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: textColor, fontSize: baseFontSize }}
        />
      </div>
      {search.trim() && (
        <div style={{ paddingBottom: 6 }}>
          {searchResults.length === 0 ? (
            <div style={{ padding: "8px 14px", color: dimColor, fontSize: baseFontSize }}>找不到相符圖層</div>
          ) : <>
            <div aria-live="polite" style={{ padding: "4px 14px", color: dimColor, fontSize: baseFontSize - 1 }}>
              找到 {searchResults.length} 筆{searchResults.length > visibleSearchResults.length ? `，顯示前 ${visibleSearchResults.length} 筆` : ""}
            </div>
            {visibleSearchResults.map((result) => {
            const locked = !!lockedKeys?.has(result.key);
            const active = visibility[result.key];
            const favorite = favoriteKeys?.has(result.key) ?? false;
            return (
              <div key={result.key} style={{ display: "flex", gap: 6, padding: "7px 12px", borderBottom: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
                <button
                  onClick={() => locked ? onToggleVisibility(result.key) : (active ? onLayerClick(result.key) : onToggleVisibility(result.key))}
                  title={locked ? "此圖層受權限限制" : result.description}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", color: textColor, cursor: "pointer", padding: 0 }}
                >
                  <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: baseFontSize, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: RADIUS.full, background: LAYER_COLORS[result.key], flexShrink: 0 }} />
                    {result.label} {locked && <Lock size={12} />}
                  </div>
                  <div style={{ marginTop: 2, color: dimColor, fontSize: baseFontSize - 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.description}</div>
                  <div style={{ marginTop: 2, color: dimColor, fontSize: baseFontSize - 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>主題：{result.topics.join("、")} · {result.source}</div>
                </button>
                {onToggleFavorite && (
                  <button aria-label={`${favorite ? "取消收藏" : "收藏圖層"} ${result.label}`} onClick={() => onToggleFavorite(result.key)} title={favorite ? "取消收藏" : "收藏圖層"} style={{ border: "none", background: "transparent", color: favorite ? "#facc15" : dimColor, cursor: "pointer", padding: 2 }}>
                    <Star size={15} fill={favorite ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            );
            })}
          </>}
        </div>
      )}
      {!search.trim() && activeThemes.map((theme, index) => {
        const macroGroup = mobileTab === "statistics" ? null : themeMacroGroup(theme.title);
        const previousMacroGroup = mobileTab === "statistics" || index === 0 ? null : themeMacroGroup(activeThemes[index - 1]!.title);
        const macroTitle = macroGroup
          ? LAYER_MACRO_GROUPS.find((group) => group.key === macroGroup)?.title
          : null;
        const showMacroGroup = macroGroup !== previousMacroGroup && macroTitle;
        const isCollapsed = collapsedThemes.has(theme.title);
        const allKeys = theme.groups.flatMap((g) => g.layers.map((l) => l.key));
        const onCount = allKeys.filter((k) => visibility[k]).length;
        const someOn = onCount > 0;
        const handleBulkToggle = () => {
          if (onBulkSetVisibility) {
            onBulkSetVisibility(allKeys, !someOn);
          } else {
            for (const k of allKeys) {
              if ((!someOn && !visibility[k]) || (someOn && visibility[k])) {
                onToggleVisibility(k);
              }
            }
          }
        };

        return (
          <div key={theme.title}>
            {showMacroGroup && (
              <div
                style={{
                  padding: "14px 14px 5px",
                  color: isDarkTheme ? "rgba(255,255,255,0.52)" : "rgba(0,0,0,0.48)",
                  fontSize: baseFontSize - 1,
                  fontWeight: 700,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                {macroTitle}
              </div>
            )}
            {/* ── Theme Banner（sticky：滾到該 theme 時黏頂） ── */}
            <div
              onClick={() => toggleTheme(theme.title)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: isDarkTheme
                  ? "rgba(20,21,24,0.95)"
                  : "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderTop: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                borderBottom: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span style={{ color: dimColor, fontSize: FONT_SIZE.xs, width: 10 }}>
                {isCollapsed ? "▶" : "▼"}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: baseFontSize + 1,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: textColor,
                  textTransform: "uppercase",
                }}
              >
                {theme.title}
              </span>
              <span
                style={{
                  fontSize: baseFontSize - 1,
                  color: someOn ? textColor : dimColor,
                  marginRight: 4,
                }}
              >
                {onCount}/{allKeys.length}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleBulkToggle(); }}
                style={{
                  width: 28,
                  height: 14,
                  borderRadius: RADIUS.full,
                  background: someOn ? (isDarkTheme ? "#fff" : "#333") : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"),
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 1, left: someOn ? 15 : 1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: someOn ? (isDarkTheme ? "#000" : "#fff") : (isDarkTheme ? "#666" : "#999"),
                  transition: "left 0.15s",
                }} />
              </button>
            </div>

            {!isCollapsed && theme.groups.map((group) => (
              <div key={group.title}>
                <div
                  style={{
                    fontSize: baseFontSize,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    color: isDarkTheme ? "#D1D5DB" : "rgba(0,0,0,0.7)",
                    padding: "10px 14px 4px 24px",
                  }}
                >
                  └ {group.title}
                </div>

                  {group.layers.map(({ key, label, labelMobile, expandable }) => {
              const medicalGroup = getMedicalStatisticsGroup(key);
              if (medicalGroup) {
                if (medicalGroup.options[0]?.key !== key) return null;
                return (
                  <MedicalStatisticsGroupControls
                    key={medicalGroup.key}
                    groupKey={key}
                    visibility={visibility}
                    expandedLayer={expandedLayer}
                    onLayerClick={onLayerClick}
                    textColor={textColor}
                    dimColor={dimColor}
                    colorScheme={isDarkTheme ? 'dark' : 'light'}
                    renderToggle={(on, onChange, label) => <LayerToggleSwitch on={on} onChange={onChange} label={label} {...togglePalette} />}
                    renderControls={(selectedKey) => (
                      <ExpandedPanel
                        layerKey={selectedKey as ExpandableLayerKey}
                        isTransport={false}
                        isDarkTheme={isDarkTheme}
                        isMobile={isMobile}
                        viewMode={viewMode}
                        displayMode={displayMode}
                        onViewModeChange={onViewModeChange}
                        onDisplayModeChange={onDisplayModeChange}
                        onHide={onHideTransport}
                      />
                    )}
                  />
                );
              }
              // 手機版優先用全稱 labelMobile，未提供則沿用桌機 label
            const displayLabel = labelMobile ?? label;
            const active = visibility[key];
            const color = LAYER_COLORS[key];
            const statisticsVisual = isStatisticsRenderLayer(key) || key === "crimeAreaMonthly" ? getStatisticsVisual(key, displayLabel) : null;
            const StatisticsIcon = statisticsVisual?.icon;
            const count = getCount(key);
            const isExpanded = expandedLayer === key;
            const isTransport = key in TRANSPORT_LABELS;
            const hasDetails = hasLayerDetails(key, expandable);
            // 動態 gating：對此使用者上鎖 → 顯示鎖頭、點擊走 App 端 gate（onToggleVisibility）
            const locked = !!lockedKeys?.has(key);

            return (
              <div key={key}>
                <div
                  title={locked ? "私人圖層，僅擁有者可檢視" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    cursor: "pointer",
                    opacity: locked ? 0.5 : 1,
                    background: isExpanded
                      ? (isDarkTheme ? `${color}15` : `${color}10`)
                      : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  {locked ? (
                    <span
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(key); }}
                      style={{ display: "flex", flexShrink: 0, color: dimColor, cursor: "pointer" }}
                    >
                      <Lock size={13} />
                    </span>
                  ) : StatisticsIcon ? (
                    <StatisticsIcon size={14} color={color} style={{ flexShrink: 0 }} />
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(key); }}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: RADIUS.full,
                        background: active ? color : "transparent",
                        border: `1.5px solid ${active ? color : (isDarkTheme ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)")}`,
                        cursor: "pointer",
                        flexShrink: 0,
                        padding: 0,
                        transition: "all 0.15s",
                      }}
                    />
                  )}

                  <div
                    onClick={() => locked ? onToggleVisibility(key) : (hasDetails ? onLayerClick(key) : onToggleVisibility(key))}
                    style={{
                      flex: 1,
                      fontSize: baseFontSize,
                      color: textColor,
                      opacity: 1,
                      transition: "all 0.15s",
                    }}
                  >
                    {displayLabel}
                    {count != null && count > 0 && !locked && (
                      <span style={{ marginLeft: 4, opacity: 0.5, fontSize: baseFontSize - 1 }}>
                        {count}
                      </span>
                    )}
                  </div>

                  {statisticsVisual && !locked && <LayerToggleSwitch on={active} onChange={() => onToggleVisibility(key)} label={`${displayLabel} 顯示`} {...togglePalette} />}
                  {hasDetails && !locked && (
                    <button
                      type="button"
                      aria-label={`${displayLabel} 詳情`}
                      aria-expanded={isExpanded}
                      onClick={(event) => { event.stopPropagation(); onLayerClick(key); }}
                      style={{
                        fontSize: FONT_SIZE.sm,
                        color: dimColor,
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        cursor: "pointer",
                        userSelect: "none",
                        background: "transparent",
                        border: 0,
                        padding: 0,
                      }}
                    >
                      &#x25B6;
                    </button>
                  )}
                </div>

                {isExpanded && hasDetails && (
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
                  />
                )}
              </div>
            );
                })}
              </div>
            ))}
          </div>
        );
      })}
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
}

function ExpandedPanel({
  layerKey,
  isTransport,
  isDarkTheme,
  isMobile,
  displayMode,
  onDisplayModeChange,
  onHide,
}: ExpandedPanelProps) {
  // per-key 訂閱：只有這一層的參數變動才重繪本元件
  const paramValues = useLayerParams(layerKey);
  const controls = buildParamControls(layerKey, paramValues) ?? [];

  const btnBase: React.CSSProperties = {
    fontSize: FONT_SIZE.xs,
    padding: "2px 6px",
    borderRadius: RADIUS.md,
    fontFamily: FONT_DATA,
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
      {isStatisticsRenderLayer(layerKey) && <StatisticsDetails layerKey={layerKey} textColor={isDarkTheme ? '#fff' : '#333'} colorScheme={isDarkTheme ? 'dark' : 'light'} />}
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
            if (ctrl.type === "multiSelect") {
              const selected = new Set(ctrl.value);
              return (
                <details
                  key={ctrl.label}
                  onClick={(event) => event.stopPropagation()}
                  style={{ color: isDarkTheme ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.65)", fontSize: FONT_SIZE.sm }}
                >
                  <summary style={{ cursor: "pointer", padding: "3px 0" }}>
                    {ctrl.label}（{selected.size}/{ctrl.options.length}）
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "5px 0 2px 10px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={ctrl.onSelectAll} style={btnBase}>全選</button>
                      <button onClick={ctrl.onSelectNone} style={btnBase}>全關</button>
                    </div>
                    {ctrl.options.map((option) => (
                      <label key={option.value} style={{ display: "flex", alignItems: "center", gap: 6, opacity: option.disabled ? 0.45 : 1 }}>
                        <input
                          type="checkbox"
                          checked={selected.has(option.value)}
                          disabled={option.disabled}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(option.value)) next.delete(option.value); else next.add(option.value);
                            ctrl.onChange([...next]);
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </details>
              );
            }

            if (ctrl.type === "select") {
              // options ≥ 4 一律改用原生 <select> dropdown，避免橫向 button 超出 sidebar
              if (ctrl.options.length > 3) {
                return (
                  <div
                    key={ctrl.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                      fontSize: FONT_SIZE.sm,
                      fontFamily: FONT_DATA,
                    }}
                  >
                    <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{ctrl.label}</span>
                    <select
                      value={ctrl.value}
                      onChange={(e) => ctrl.onChange(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: FONT_SIZE.sm,
                        padding: "1px 6px",
                        background: isDarkTheme ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)",
                        color: isDarkTheme ? "#fff" : "#000",
                        border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                        borderRadius: RADIUS.md,
                        fontFamily: FONT_DATA,
                      }}
                    >
                      {ctrl.options.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div
                  key={ctrl.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: isDarkTheme ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                    fontSize: FONT_SIZE.sm,
                    fontFamily: FONT_DATA,
                  }}
                >
                  <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{ctrl.label}</span>
                  {ctrl.options.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={opt.disabled}
                      onClick={() => { if (!opt.disabled) ctrl.onChange(opt.value); }}
                      style={{
                        ...btnBase,
                        fontSize: FONT_SIZE.xs,
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
                        // disabled（如人均模式在 150m 尺度）：降不透明度 + 禁用游標，label 已自帶原因
                        ...(opt.disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
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
                    fontSize: FONT_SIZE.sm,
                    fontFamily: FONT_DATA,
                  }}
                >
                  <span style={{ minWidth: isMobile ? 60 : 50, flexShrink: 0 }}>{ctrl.label}</span>
                  <button
                    onClick={() => ctrl.onChange(!ctrl.value)}
                    style={{
                      ...btnBase,
                      fontSize: FONT_SIZE.xs,
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
                  fontSize: FONT_SIZE.sm,
                  fontFamily: FONT_DATA,
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
