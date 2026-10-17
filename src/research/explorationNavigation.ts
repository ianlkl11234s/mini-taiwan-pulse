import { JAPAN_TAB_THEME_TITLES, STATISTICS_TAB_CHOROPLETH_LAYER_KEYS, THEMES, WORLD_TAB_THEME_TITLES } from "../components/sidebar/layerCatalog";

export type ExplorationPanel = "layers" | "statistics" | "world" | "japan";

/** Requests that the persistent rail show the relevant registered layer panel. */
export function requestLayerExploration(layerKeys?: string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("pulse:explore-layers", { detail: Array.isArray(layerKeys) ? { layerKeys: layerKeys.filter(key => typeof key === "string") } : {} }));
}

/**
 * Layer keys that should surface the Layers rail panel: only when *this* scene update's patch
 * explicitly carried a `layers` instruction (an Agent-issued `pulse_set_layers`-style command).
 * A results-only patch (presenting an analysis result) or an undefined patch (resync/recover/
 * report replay) must never force the panel open, even if the resolved `scene.layers` differs
 * from the previously rendered snapshot for unrelated reasons.
 */
export function explorationLayerKeys(
  sceneLayers: Record<string, boolean> | undefined,
  previousLayers: Record<string, boolean> | undefined,
  patchLayers: Record<string, boolean> | undefined,
): string[] {
  if (patchLayers === undefined) return [];
  return Object.entries(sceneLayers ?? {}).filter(([key, on]) => on && previousLayers?.[key] !== true).map(([key]) => key);
}

function keysForThemes(themes: readonly typeof THEMES[number][]): Set<string> {
  return new Set(themes.flatMap(theme => theme.groups.flatMap(group => group.layers.map(layer => layer.key))));
}

const statisticsKeys = STATISTICS_TAB_CHOROPLETH_LAYER_KEYS;
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
