import type { LayerVisibility } from "../../types";
import { STATISTICS_RENDER_KEYS } from "../../data/regionalStatisticsRecipes";
import { THEMES, WORLD_TAB_THEME_TITLES, JAPAN_TAB_THEME_TITLES, STATISTICS_DATA_THEMES, STATISTICS_TAB_THEMES, withoutStatisticsLayers, type ThemeDef } from "./layerCatalog";

/**
 * 圖層面板四個入口（台灣／統計／世界／日本）—— 桌機 rail 與手機底部面板共用同一份定義
 * （layer-panel-unify P7）。每個入口只差主題清單與兩三個開關，面板本體都是 `LayersPanel`。
 */
export type LayerPanelId = "layers" | "statistics" | "world" | "japan";

export interface LayerPanelDef {
  id: LayerPanelId;
  /** 面板標題（桌機 PanelHeader） */
  title: string;
  /** 手機分頁與「其他面板還有 N 筆」提示用的短名 */
  shortTitle: string;
  themes: ThemeDef[];
  /** 是否顯示大分類（目前只有台灣；其他入口的大分類屬 B 段） */
  showMacroGroups?: boolean;
  /** 「全部關閉」只關這些 key；未給則關全站 */
  allOffKeys?: (keyof LayerVisibility)[];
  /** 統計入口的「單一／可重疊」切換 */
  statisticsModeControl?: boolean;
}

export function getThemeLayerKeys(themes: readonly ThemeDef[]): (keyof LayerVisibility)[] {
  return themes.flatMap((theme) => theme.groups.flatMap((group) => group.layers.map((layer) => layer.key)));
}

// 「世界」「日本」入口只渲染各自登記的主題，順序照登記陣列；台灣入口渲染其餘非統計主題。
export const WORLD_THEMES = THEMES.filter((t) => WORLD_TAB_THEME_TITLES.includes(t.title))
  .sort((a, b) => WORLD_TAB_THEME_TITLES.indexOf(a.title) - WORLD_TAB_THEME_TITLES.indexOf(b.title));
export const JAPAN_THEMES = THEMES.filter((t) => JAPAN_TAB_THEME_TITLES.includes(t.title))
  .sort((a, b) => JAPAN_TAB_THEME_TITLES.indexOf(a.title) - JAPAN_TAB_THEME_TITLES.indexOf(b.title));
const statisticsDataThemeTitles = new Set(STATISTICS_DATA_THEMES.map((theme) => theme.title));
export const MAIN_THEMES = withoutStatisticsLayers(THEMES.filter((t) => !WORLD_TAB_THEME_TITLES.includes(t.title) && !JAPAN_TAB_THEME_TITLES.includes(t.title) && !statisticsDataThemeTitles.has(t.title)));

/** 統計入口的「全部關閉」範圍：含只為相容舊網址存在的統計 render key。 */
export const STATISTICS_ALL_OFF_KEYS = [...new Set([...getThemeLayerKeys(STATISTICS_TAB_THEMES), ...STATISTICS_RENDER_KEYS])];

/** 四個入口，順序＝桌機 rail 由上到下＝手機分頁由左到右。 */
export const LAYER_PANELS: readonly LayerPanelDef[] = [
  { id: "layers", title: "台灣 Taiwan", shortTitle: "台灣", themes: MAIN_THEMES, showMacroGroups: true },
  { id: "statistics", title: "統計 Statistics", shortTitle: "統計", themes: STATISTICS_TAB_THEMES, allOffKeys: STATISTICS_ALL_OFF_KEYS, statisticsModeControl: true },
  { id: "world", title: "世界 World", shortTitle: "世界", themes: WORLD_THEMES },
  { id: "japan", title: "日本 Japan", shortTitle: "日本", themes: JAPAN_THEMES },
];

export const layerPanelDef = (id: LayerPanelId): LayerPanelDef => LAYER_PANELS.find((panel) => panel.id === id)!;
