import { useMemo, useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { DisplayMode, ExpandableLayerKey, LayerVisibility, ViewMode } from "../../types";
import { getMedicalStatisticsGroup } from "../../data/medicalStatisticsGroups";
import { searchLayers } from "../../lib/layerSearch";
import { LAYER_COLORS, LAYER_MACRO_GROUPS, THEMES, TRANSPORT_LABELS, splitThemeTitle, themeMacroGroup, type ThemeDef } from "./layerCatalog";
import { LAYER_PANELS, panelLayerKeys, type LayerPanelId } from "./layerPanels";
import { PanelHeader as SharedPanelHeader } from "./PanelHeader";
import { StatisticsModeControl } from "./StatisticsModeControl";
import { MedicalStatisticsGroupControls } from "./MedicalStatisticsGroupControls";
import { ExpandedControls } from "./ExpandedControls";
import { LayerRow } from "./LayerRow";
import { MacroGroupLabel, SubGroupLabel, ThemeBanner } from "./ThemeBanner";
import { useRailTheme } from "./railTheme";
import { LAYER_ICONS } from "./layerIcons";

export { LAYER_ICONS };

/** rail 面板標頭（舊版標頭分支，spec §5.1）。 */
export function RailPanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { BORDER, DIM, TEXT_STRONG } = useRailTheme();
  return <SharedPanelHeader title={title} onClose={onClose} borderColor={BORDER} mutedColor={DIM} textColor={TEXT_STRONG} titleSize={FONT_SIZE.lg} />;
}

export interface LayersPanelProps {
  search: string;
  onSearchChange: (v: string) => void;
  /** 只渲染這批主題（預設全部 THEMES）。 */
  themes?: ThemeDef[];
  /** PanelHeader 標題；`onClose` 未給時不顯示標頭（手機用分頁代替）。 */
  title?: string;
  /** 是否顯示第一層大分類。 */
  showMacroGroups?: boolean;
  visibility: LayerVisibility;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  expandedLayer: ExpandableLayerKey | null;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onLayerClick: (layer: keyof LayerVisibility) => void;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onAllOff?: () => void;
  allOffKeys?: (keyof LayerVisibility)[];
  /** 僅 Statistics 入口顯示單一／重疊模式。 */
  statisticsModeControl?: boolean;
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  favoriteKeys?: ReadonlySet<string>;
  onToggleFavorite?: (key: string) => void;
  onClose?: () => void;
  /** 本面板是哪個入口；給了且有 `onSearchInPanel` 才會顯示「其他面板還有 N 筆」 */
  panelId?: LayerPanelId;
  /** 切到另一個入口並帶入關鍵字（P9） */
  onSearchInPanel?: (panelId: LayerPanelId, query: string) => void;
}

/**
 * 圖層面板本體（spec §5.5）：桌機 rail 四入口與手機底部面板共用。
 * 頂部：全部關閉・搜尋（統計另有單一／可重疊）；內容：大分類 → 主題列 → L2 群組 → 圖層列。
 */
export function LayersPanel({
  search, onSearchChange, themes, title = "Layers",
  showMacroGroups = false,
  visibility, lockedKeys, expandedLayer, displayMode,
  getCount, onLayerClick, onToggleVisibility,
  onDisplayModeChange,
  onAllOff, onBulkSetVisibility, onClose,
  favoriteKeys, onToggleFavorite, allOffKeys,
  statisticsModeControl = false,
  panelId, onSearchInPanel,
}: LayersPanelProps) {
  const { ALLOFF_BG, ALLOFF_BORDER, INACTIVE_TEXT, SEARCH_BG, DIM, TEXT_STRONG, COLOR_SCHEME } = useRailTheme();
  const q = search.trim().toLowerCase();
  const themesToRender = themes ?? THEMES;
  const searchContext = useMemo(() => {
    const context = new Map<string, string>();
    for (const theme of themesToRender) {
      for (const group of theme.groups) {
        for (const layer of group.layers) context.set(layer.key, `${splitThemeTitle(theme.title).zh}・${group.title}`);
      }
    }
    return context;
  }, [themesToRender]);
  const searchResults = searchLayers(search, {
    favoriteKeys,
    scopeKeys: new Set(searchContext.keys()),
    contextByKey: searchContext,
    lockedKeys,
  });
  const visibleSearchResults = searchResults.slice(0, 50);
  const otherPanelHits = q && panelId
    ? LAYER_PANELS.filter((panel) => panel.id !== panelId).map((panel) => ({
      id: panel.id,
      shortTitle: panel.shortTitle,
      count: searchLayers(search, { favoriteKeys, scopeKeys: panelLayerKeys(panel.id), lockedKeys }).length,
    })).filter((hit) => hit.count > 0)
    : [];
  // Theme 摺疊狀態：defaultCollapsed=true 的主題預設收合。
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(
    () => new Set(themesToRender.filter((t) => t.defaultCollapsed).map((t) => t.title)),
  );

  const toggleTheme = (title: string) => {
    setCollapsedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  const allOff = allOffKeys && onBulkSetVisibility
    ? () => onBulkSetVisibility(allOffKeys, false)
    : onAllOff;

  return (
    <>
      {onClose && <RailPanelHeader title={title} onClose={onClose} />}
      {allOff && (
        <div style={{ padding: "4px 12px 4px" }}>
          <button
            type="button"
            onClick={allOff}
            style={{
              width: "100%",
              padding: "5px 0",
              background: ALLOFF_BG,
              border: `1px solid ${ALLOFF_BORDER}`,
              borderRadius: RADIUS.lg,
              color: INACTIVE_TEXT,
              fontSize: FONT_SIZE.base,
              cursor: "pointer",
              fontFamily: FONT_CJK,
            }}
          >
            全部關閉
          </button>
        </div>
      )}
      {/* Search Bar（仿 Locations，主題感知）*/}
      <div style={{ padding: "0 12px 4px" }}>
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
            aria-label="搜尋圖層"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜尋圖層… Search layers…"
            style={{
              flex: 1,
              minWidth: 0,
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
      {statisticsModeControl && <StatisticsModeControl isDarkTheme={COLOR_SCHEME === "dark"} />}
      <div
        className="layer-sidebar-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 0 8px",
        }}
      >
        {q ? (
          <>
            {searchResults.length === 0 ? (
              <div style={{ padding: "12px", color: DIM, fontSize: FONT_SIZE.md }}>找不到相符圖層</div>
            ) : <>
              <div aria-live="polite" style={{ padding: "6px 12px", color: DIM, fontSize: FONT_SIZE.xs }}>
                找到 {searchResults.length} 筆{searchResults.length > visibleSearchResults.length ? `，顯示前 ${visibleSearchResults.length} 筆` : ""}
              </div>
              {visibleSearchResults.map((result) => {
                const favorite = favoriteKeys?.has(result.key) ?? false;
                const isExpanded = expandedLayer === result.key;
                return (
                  <div key={result.key}>
                    <LayerRow
                      layerKey={result.key}
                      label={result.label}
                      sub={searchContext.get(result.key)}
                      expandable
                      active={visibility[result.key]}
                      locked={!!lockedKeys?.has(result.key)}
                      color={LAYER_COLORS[result.key]}
                      count={getCount(result.key)}
                      isExpanded={isExpanded}
                      Icon={LAYER_ICONS[result.key]}
                      onLayerClick={onLayerClick}
                      onToggleVisibility={onToggleVisibility}
                      trailing={onToggleFavorite && (
                        <button type="button" aria-label={`${favorite ? "取消收藏" : "收藏圖層"} ${result.label}`} onClick={() => onToggleFavorite(result.key)} title={favorite ? "取消收藏" : "收藏圖層"} style={{ border: "none", background: "transparent", color: favorite ? "#facc15" : DIM, cursor: "pointer", padding: "2px 6px 2px 0", display: "flex" }}>
                          <Star size={14} fill={favorite ? "currentColor" : "none"} />
                        </button>
                      )}
                    />
                    {isExpanded && (
                      <ExpandedControls
                        layerKey={result.key as ExpandableLayerKey}
                        isTransport={result.key in TRANSPORT_LABELS}
                        displayMode={displayMode}
                        onDisplayModeChange={onDisplayModeChange}
                      />
                    )}
                  </div>
                );
              })}
            </>}
            {/* P9：各面板搜自己，結果末尾提示其他入口的相符筆數，點了切過去並帶入關鍵字 */}
            {onSearchInPanel && otherPanelHits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => onSearchInPanel(hit.id, search)}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "calc(100% - 24px)", margin: "6px 12px 0", padding: "6px 8px", border: `1px dashed ${ALLOFF_BORDER}`, borderRadius: RADIUS.lg, background: "transparent", color: INACTIVE_TEXT, cursor: "pointer", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, textAlign: "left" }}
              >
                <span style={{ flex: 1 }}>{hit.shortTitle}還有 <span style={{ fontFamily: FONT_DATA }}>{hit.count}</span> 筆相符</span>
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            ))}
          </>
        ) : themesToRender.map((theme, themeIndex) => {
          const isCollapsed = collapsedThemes.has(theme.title);
          const allKeys = theme.groups.flatMap((g) => g.layers.map((l) => l.key));
          const onCount = allKeys.filter((k) => visibility[k]).length;
          const someOn = onCount > 0;

          const handleBulkToggle = () => {
            // 有任何一個 on → 全部 off；全部 off → 全部 on
            if (onBulkSetVisibility) {
              onBulkSetVisibility(allKeys, !someOn);
            } else {
              // fallback: 逐一 toggle 還沒對齊的 key
              for (const k of allKeys) {
                if ((!someOn && !visibility[k]) || (someOn && visibility[k])) {
                  onToggleVisibility(k);
                }
              }
            }
          };

          const macroGroup = showMacroGroups ? themeMacroGroup(theme.title) : null;
          const previousMacroGroup = showMacroGroups && themeIndex > 0
            ? themeMacroGroup(themesToRender[themeIndex - 1]!.title)
            : null;
          const macroTitle = macroGroup
            ? LAYER_MACRO_GROUPS.find((group) => group.key === macroGroup)?.title
            : null;

          return (
            <div key={theme.title}>
              {macroTitle && macroGroup !== previousMacroGroup && <MacroGroupLabel title={macroTitle} />}
              <ThemeBanner
                title={theme.title}
                isCollapsed={isCollapsed}
                onCount={onCount}
                totalCount={allKeys.length}
                onToggleCollapse={() => toggleTheme(theme.title)}
                onBulkToggle={handleBulkToggle}
              />
              {!isCollapsed && theme.groups.map((group) => (
                <div key={group.title}>
                  <SubGroupLabel>{group.title}</SubGroupLabel>
                  {group.layers.map(({ key, label }) => {
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
                          textColor={TEXT_STRONG}
                          dimColor={DIM}
                          colorScheme={COLOR_SCHEME}
                          renderControls={(selectedKey) => (
                            <ExpandedControls
                              layerKey={selectedKey as ExpandableLayerKey}
                              isTransport={false}
                              displayMode={displayMode}
                              onDisplayModeChange={onDisplayModeChange}
                            />
                          )}
                        />
                      );
                    }
                    const active = visibility[key];
                    const isExpanded = expandedLayer === key;
                    const isTransport = key in TRANSPORT_LABELS;
                    return (
                      <div key={key}>
                        <LayerRow
                          layerKey={key}
                          label={label}
                          expandable
                          active={active}
                          locked={!!lockedKeys?.has(key)}
                          color={LAYER_COLORS[key]}
                          count={getCount(key)}
                          isExpanded={isExpanded}
                          Icon={LAYER_ICONS[key]}
                          onLayerClick={onLayerClick}
                          onToggleVisibility={onToggleVisibility}
                        />
                        {/* 每一列都有展開區：至少有最後一行「說明・來源」（P1） */}
                        {isExpanded && (
                          <ExpandedControls
                            layerKey={key as ExpandableLayerKey}
                            isTransport={isTransport}
                            displayMode={displayMode}
                            onDisplayModeChange={onDisplayModeChange}
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
    </>
  );
}
