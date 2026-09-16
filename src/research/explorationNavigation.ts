import { JAPAN_TAB_THEME_TITLES, STATISTICS_TAB_THEMES, THEMES, WORLD_TAB_THEME_TITLES } from "../components/sidebar/layerCatalog";

export type ExplorationPanel = "layers" | "statistics" | "world" | "japan";

/** Requests that the persistent rail show the relevant registered layer panel. */
export function requestLayerExploration(layerKeys?: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pulse:explore-layers", { detail: Array.isArray(layerKeys) ? { layerKeys: layerKeys.filter(key => typeof key === "string") } : {} }));
}

function keysForThemes(themes: readonly typeof THEMES[number][]): Set<string> {
  return new Set(themes.flatMap(theme => theme.groups.flatMap(group => group.layers.map(layer => layer.key))));
}

const statisticsKeys = keysForThemes(STATISTICS_TAB_THEMES);
const worldKeys = keysForThemes(THEMES.filter(theme => WORLD_TAB_THEME_TITLES.includes(theme.title)));
const japanKeys = keysForThemes(THEMES.filter(theme => JAPAN_TAB_THEME_TITLES.includes(theme.title)));

/** Uses the same theme slices as IconRailSidebar's four layer panels. */
export function panelForExplorationLayers(keys: readonly string[]): ExplorationPanel {
  for (const key of keys) {
    if (statisticsKeys.has(key)) return "statistics";
    if (worldKeys.has(key)) return "world";
    if (japanKeys.has(key)) return "japan";
  }
  return "layers";
}
