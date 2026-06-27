import { useState } from "react";
import type { LayerVisibility, ExpandableLayerKey, ViewMode, DisplayMode } from "../types";
import type { ParamControl } from "../hooks/useTransportParams";
// 圖層目錄常數單一真實來源（與 IconRailSidebar 共用，消除漂移）
import { LAYER_COLORS, TRANSPORT_LABELS, THEMES } from "./sidebar/layerCatalog";
import { SURFACE, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";

// ── Props ──

interface LayerSidebarProps {
  visibility: LayerVisibility;
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
  onBulkSetVisibility,
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
        visibility={visibility} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} onBulkSetVisibility={onBulkSetVisibility} getControls={getControls}
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
        visibility={visibility} expandedLayer={expandedLayer} viewMode={viewMode}
        displayMode={displayMode} isDarkTheme={isDarkTheme} isMobile={isMobile}
        textColor={textColor} dimColor={dimColor} baseFontSize={baseFontSize}
        getCount={getCount} onLayerClick={onLayerClick} onToggleVisibility={onToggleVisibility}
        onViewModeChange={onViewModeChange} onDisplayModeChange={onDisplayModeChange}
        onHideTransport={onHideTransport} onBulkSetVisibility={onBulkSetVisibility} getControls={getControls}
      />
    </div>
  );
}

// ── Sidebar Content (extracted for reuse) ──

function SidebarContent({
  visibility, expandedLayer, viewMode, displayMode, isDarkTheme, isMobile,
  textColor, dimColor, baseFontSize,
  getCount, onLayerClick, onToggleVisibility,
  onViewModeChange, onDisplayModeChange, onHideTransport, onBulkSetVisibility, getControls,
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
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  getControls: (layer: ExpandableLayerKey) => ParamControl[];
}) {
  // Theme 摺疊狀態：預設只摺疊 defaultCollapsed=true 的（BASE）
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(
    () => new Set(THEMES.filter((t) => t.defaultCollapsed).map((t) => t.title)),
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
      {THEMES.map((theme) => {
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
            // 手機版優先用全稱 labelMobile，未提供則沿用桌機 label
            const displayLabel = labelMobile ?? label;
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
                      borderRadius: RADIUS.full,
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
                    {displayLabel}
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
                        fontSize: FONT_SIZE.sm,
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
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                      onClick={() => ctrl.onChange(opt.value)}
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
