import { useMemo, useState } from "react";
import { ChevronRight, Search, Star } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import type { DisplayMode, ExpandableLayerKey, LayerVisibility, ViewMode } from "../../types";
import { searchLayers } from "../../lib/layerSearch";
import { useLocale } from "../../state/localeStore";
import { localizeSectionTitle } from "../../i18n/layerText";
import { localizeMacroTitle, localizeThemeTitle } from "./sectionText";
import { LAYER_COLORS, THEMES, TRANSPORT_LABELS, layerDisplayName, themeKey, themeName, type ThemeDef } from "./layerCatalog";
import { LAYER_PANELS, PANEL_COUNTRIES, panelLayerKeys, type LayerPanelId, type PanelMacroGroup } from "./layerPanels";
import { CountryMenu } from "./CountryMenu";
import { countryDef, DEFAULT_COUNTRY, type CountryCode } from "../../constants/countries";
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
  /** 目前使用者看得到的入口（模擬只對站主）；「其他面板還有 N 筆」只算這些。未給＝全部。 */
  availablePanelIds?: readonly LayerPanelId[];
  /** 切到另一個入口並帶入關鍵字（P9）；`country` 有值時同時切國家主體（不飛鏡頭） */
  onSearchInPanel?: (panelId: LayerPanelId, query: string, country?: CountryCode) => void;
  /** 目前國家主體（國家選單、「其他面板」提示用）；未給＝台灣 */
  country?: CountryCode;
  /** 給了才顯示頂部國家選單（圖層、統計入口）；選了國家由呼叫端切國家並 flyTo */
  onCountrySelect?: (code: CountryCode) => void;
  /** false＝本入口不涵蓋目前國家（統計在非台灣）：不畫主題樹，改顯示未涵蓋空狀態＋「切回台灣」 */
  covered?: boolean;
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
  panelId, availablePanelIds, onSearchInPanel,
  country = DEFAULT_COUNTRY, onCountrySelect, covered = true,
}: LayersPanelProps) {
  const { ALLOFF_BG, ALLOFF_BORDER, INACTIVE_TEXT, SEARCH_BG, DIM, TEXT_STRONG, COLOR_SCHEME } = useRailTheme();
  const i18n = useLocale();
  const { active, t } = i18n;
  const q = search.trim().toLowerCase();
  const themesToRender = themes ?? THEMES;
  const searchContext = useMemo(() => {
    const context = new Map<string, string>();
    for (const theme of themesToRender) {
      for (const group of theme.groups) {
        for (const layer of group.layers) context.set(layer.key, `${themeName(theme).zh}・${group.title}`);
      }
    }
    return context;
  }, [themesToRender]);
  // 搜尋結果列的「主題・群組」小字：顯示層翻譯（比對仍用上面的原文 searchContext）
  const displayContext = useMemo(() => {
    const context = new Map<string, string>();
    for (const theme of themesToRender) {
      const themeText = localizeThemeTitle(theme, i18n).primary;
      for (const group of theme.groups) {
        const groupText = localizeSectionTitle(group.title, i18n);
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
  // 其他入口（同一國家；統計不涵蓋目前國家時算台灣的統計）＋其他國家的「圖層」入口（顯示國名）
  const otherPanelHits = q && panelId
    ? [
      ...LAYER_PANELS.filter((panel) => panel.id !== panelId && (!availablePanelIds || availablePanelIds.includes(panel.id))).map((panel) => {
        const hitCountry = panel.countries && !panel.countries.includes(country) ? panel.countries[0]! : country;
        return {
          key: panel.id,
          id: panel.id,
          country: hitCountry === country ? undefined : hitCountry,
          shortTitle: t(`panel.${panel.id}.short`),
          count: searchLayers(search, { favoriteKeys, scopeKeys: panelLayerKeys(panel.id, hitCountry), lockedKeys }).length,
        };
      }),
      ...PANEL_COUNTRIES.filter((code) => code !== country).map((code) => ({
        key: `layers:${code}`,
        id: "layers" as LayerPanelId,
        country: code as CountryCode | undefined,
        shortTitle: t(countryDef(code).labelKey),
        count: searchLayers(search, { favoriteKeys, scopeKeys: panelLayerKeys("layers", code), lockedKeys }).length,
      })),
    ].filter((hit) => hit.count > 0)
    : [];
  // Theme 摺疊狀態：defaultCollapsed=true 的主題預設收合。鍵用 `themeKey`（country:title），不同國家的同名主題各自記。
  const [collapsedThemes, setCollapsedThemes] = useState<Set<string>>(
    () => new Set(themesToRender.filter((t) => t.defaultCollapsed).map(themeKey)),
  );

  const toggleTheme = (key: string) => {
    setCollapsedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allOff = allOffKeys && onBulkSetVisibility
    ? () => onBulkSetVisibility(allOffKeys, false)
    : onAllOff;

  return (
    <>
      {onClose && <RailPanelHeader title={title} onClose={onClose} />}
      {onCountrySelect ? (
        <CountryMenu
          country={country}
          onSelect={onCountrySelect}
          trailing={allOff && (
            <button
              type="button"
              onClick={allOff}
              style={{
                flexShrink: 0,
                padding: "5px 10px",
                background: ALLOFF_BG,
                border: `1px solid ${ALLOFF_BORDER}`,
                borderRadius: RADIUS.lg,
                color: INACTIVE_TEXT,
                fontSize: FONT_SIZE.base,
                cursor: "pointer",
                fontFamily: FONT_CJK,
                whiteSpace: "nowrap",
              }}
            >
              {t("layers.allOff")}
            </button>
          )}
        />
      ) : allOff && (
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
                key={hit.key}
                type="button"
                onClick={() => onSearchInPanel(hit.id, search, hit.country)}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "calc(100% - 24px)", margin: "6px 12px 0", padding: "6px 8px", border: `1px dashed ${ALLOFF_BORDER}`, borderRadius: RADIUS.lg, background: "transparent", color: INACTIVE_TEXT, cursor: "pointer", fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, textAlign: "left" }}
              >
                <span style={{ flex: 1 }}>{otherPanelHitText(t("layers.otherPanelHits", { panel: hit.shortTitle, count: COUNT_MARK }), hit.count)}</span>
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            ))}
          </>
        ) : !covered ? (
          <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <div style={{ color: DIM, fontSize: FONT_SIZE.md, fontFamily: FONT_CJK }}>
              {t("statistics.uncovered", { country: t(countryDef(country).labelKey) })}
            </div>
            {onCountrySelect && (
              <button
                type="button"
                onClick={() => onCountrySelect(DEFAULT_COUNTRY)}
                style={{ padding: "5px 10px", background: ALLOFF_BG, border: `1px solid ${ALLOFF_BORDER}`, borderRadius: RADIUS.lg, color: TEXT_STRONG, fontSize: FONT_SIZE.base, fontFamily: FONT_CJK, cursor: "pointer" }}
              >
                {t("statistics.backToTaiwan")}
              </button>
            )}
          </div>
        ) : themesToRender.map((theme, themeIndex) => {
          const isCollapsed = collapsedThemes.has(themeKey(theme));
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
            <div key={themeKey(theme)}>
              {showMacroLabel && <MacroGroupLabel zh={localizeMacroTitle(macroGroup.zh, i18n)} />}
              <ThemeBanner
                title={theme.title}
                country={theme.country}
                isCollapsed={isCollapsed}
                onCount={onCount}
                totalCount={allKeys.length}
                onToggleCollapse={() => toggleTheme(themeKey(theme))}
                onBulkToggle={handleBulkToggle}
              />
              {!isCollapsed && theme.groups.map((group) => (
                <div key={group.title}>
                  <SubGroupLabel>{localizeSectionTitle(group.title, i18n)}</SubGroupLabel>
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
