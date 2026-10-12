import { useMemo, useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { DisplayMode, ExpandableLayerKey, LayerVisibility, ViewMode } from "../../types";
import { searchLayers } from "../../lib/layerSearch";
import { useLocale } from "../../state/localeStore";
import { localizeSectionTitle } from "../../i18n/layerText";
import { localizeMacroTitle, localizeThemeTitle } from "./sectionText";
import { LAYER_COLORS, THEMES, TRANSPORT_LABELS, layerDisplayName, themeName, type ThemeDef } from "./layerCatalog";
import { LAYER_PANELS, panelLayerKeys, type LayerPanelId, type PanelMacroGroup } from "./layerPanels";
import { PanelHeader as SharedPanelHeader } from "./PanelHeader";
import { StatisticsModeControl } from "./StatisticsModeControl";
import { MedicalStatisticsGroupControls } from "./MedicalStatisticsGroupControls";
import { ExpandedControls } from "./ExpandedControls";
import { LayerRow } from "./LayerRow";
import { MacroGroupLabel, SubGroupLabel, ThemeBanner } from "./ThemeBanner";
import { useRailTheme } from "./railTheme";
import { LAYER_ICONS } from "./layerIcons";

export { LAYER_ICONS };

/** 「其他面板還有 N 筆」：翻譯字串裡以標記占位，把數字換回等寬字 span（維持原樣式）。 */
const COUNT_MARK = "\u0001";
function otherPanelHitText(text: string, count: number) {
  const [before = "", after = ""] = text.split(COUNT_MARK);
  return <>{before}<span style={{ fontFamily: FONT_DATA }}>{count}</span>{after}</>;
}

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
  /** 大分類（面板定義 `LayerPanelDef.macroGroups`）；沒給就不顯示 */
  macroGroups?: readonly PanelMacroGroup[];
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
  macroGroups,
  visibility, lockedKeys, expandedLayer, displayMode,
  getCount, onLayerClick, onToggleVisibility,
  onDisplayModeChange,
  onAllOff, onBulkSetVisibility, onClose,
  favoriteKeys, onToggleFavorite, allOffKeys,
  statisticsModeControl = false,
  panelId, onSearchInPanel,
}: LayersPanelProps) {
  const { ALLOFF_BG, ALLOFF_BORDER, INACTIVE_TEXT, SEARCH_BG, DIM, TEXT_STRONG, COLOR_SCHEME } = useRailTheme();
  const { active, t } = useLocale();
  const q = search.trim().toLowerCase();
  const themesToRender = themes ?? THEMES;
  const searchContext = useMemo(() => {
    const context = new Map<string, string>();
    for (const theme of themesToRender) {
      for (const group of theme.groups) {
        for (const layer of group.layers) context.set(layer.key, `${themeName(theme.title).zh}・${group.title}`);
      }
    }
    return context;
  }, [themesToRender]);
  // 搜尋結果列的「主題・群組」小字：顯示層翻譯（比對仍用上面的原文 searchContext）
  const displayContext = useMemo(() => {
    const context = new Map<string, string>();
    for (const theme of themesToRender) {
      const themeText = localizeThemeTitle(theme.title, active, t).primary;
      for (const group of theme.groups) {
        const groupText = localizeSectionTitle(group.title, active, t);
        for (const layer of group.layers) context.set(layer.key, `${themeText}・${groupText}`);
      }
    }
    return context;
  }, [themesToRender, active, t]);
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
      shortTitle: t(`panel.${panel.id}.short`),
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
            {t("layers.allOff")}
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
            aria-label={t("layers.searchAria")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("layers.searchPlaceholder")}
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
              <div style={{ padding: "12px", color: DIM, fontSize: FONT_SIZE.md }}>{t("layers.noResults")}</div>
            ) : <>
              <div aria-live="polite" style={{ padding: "6px 12px", color: DIM, fontSize: FONT_SIZE.xs }}>
                {searchResults.length > visibleSearchResults.length
                  ? t("layers.foundLimited", { total: searchResults.length, shown: visibleSearchResults.length })
                  : t("layers.found", { count: searchResults.length })}
              </div>
              {visibleSearchResults.map((result) => {
                const favorite = favoriteKeys?.has(result.key) ?? false;
                const isExpanded = expandedLayer === result.key;
                return (
                  <div key={result.key}>
                    <LayerRow
                      layerKey={result.key}
                      name={layerDisplayName(result.key, result.label)}
                      label={result.label}
                      sub={displayContext.get(result.key)}
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
                        <button type="button" aria-label={`${favorite ? t("layers.favoriteRemove") : t("layers.favoriteAdd")} ${result.label}`} onClick={() => onToggleFavorite(result.key)} title={favorite ? t("layers.favoriteRemove") : t("layers.favoriteAdd")} style={{ border: "none", background: "transparent", color: favorite ? "#facc15" : DIM, cursor: "pointer", padding: "2px 6px 2px 0", display: "flex" }}>
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
                <span style={{ flex: 1 }}>{otherPanelHitText(t("layers.otherPanelHits", { panel: hit.shortTitle, count: COUNT_MARK }), hit.count)}</span>
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

          const macroGroup = macroGroups?.find((group) => group.themes.includes(theme.title)) ?? null;
          const previousTitle = themeIndex > 0 ? themesToRender[themeIndex - 1]!.title : null;
          const showMacroLabel = macroGroup !== null && (previousTitle === null || !macroGroup.themes.includes(previousTitle));

          return (
            <div key={theme.title}>
              {showMacroLabel && <MacroGroupLabel zh={localizeMacroTitle(macroGroup.zh, active, t)} />}
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
                  <SubGroupLabel>{localizeSectionTitle(group.title, active, t)}</SubGroupLabel>
                  {group.layers.map(({ key, name, label, variant }) => {
                    // 群組變體（C 段）：只在 lead 成員的位置畫一列群組列
                    if (variant) {
                      if (!variant.lead) return null;
                      return (
                        <MedicalStatisticsGroupControls
                          key={variant.group}
                          groupKey={key}
                          visibility={visibility}
                          expandedLayer={expandedLayer}
                          onLayerClick={onLayerClick}
                          textColor={TEXT_STRONG}
                          dimColor={DIM}
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
                          name={name}
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
