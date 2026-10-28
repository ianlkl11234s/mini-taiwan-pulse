import { STATISTICS_TAB_CHOROPLETH_LAYER_KEYS, THEMES } from "../components/sidebar/layerCatalog";
import { LAYER_MANIFEST, type LayerManifestEntry, type ManifestKey } from "../data/layerManifest";
import { isCountryCode, type CountryCode } from "../constants/countries";

export type ExplorationPanel = "layers" | "statistics" | "world" | "simulation";

/** Agent 開圖層時要切到的入口；`country` 有值時先切國家主體再開面板（不飛鏡頭）。 */
export interface ExplorationTarget {
  panel: ExplorationPanel;
  country?: CountryCode;
}

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
const worldKeys = keysForThemes(THEMES.filter(theme => theme.country === "WORLD"));
const simulationKeys = keysForThemes(THEMES.filter(theme => theme.country === "SIM"));
/**
 * 國家主題樹的 layer key → 國家。讀 manifest `country`（不從主題 title 查），主題 title 跨國重名時仍唯一；
 * 只收 THEMES 裡實際上架的圖層。
 */
const countryByKey = new Map<string, CountryCode>();
for (const theme of THEMES) {
  for (const group of theme.groups) for (const layer of group.layers) {
    const entry: LayerManifestEntry | undefined = LAYER_MANIFEST[layer.key as ManifestKey];
    const country = entry?.country;
    if (isCountryCode(country) && !countryByKey.has(layer.key)) countryByKey.set(layer.key, country);
  }
}

/** 第一個屬於國家主題樹的圖層所屬國（世界、統計以外）；都不是回 undefined。 */
export function countryForLayerKeys(keys: readonly string[]): CountryCode | undefined {
  for (const key of keys) {
    const country = countryByKey.get(key);
    if (country) return country;
  }
  return undefined;
}

/** Uses the same theme slices as IconRailSidebar's layer panels. 統計只有台灣，所以帶 TW；世界、模擬不分國家。 */
export function panelForExplorationLayers(keys: readonly string[]): ExplorationTarget {
  for (const key of keys) {
    if (statisticsKeys.has(key)) return { panel: "statistics", country: "TW" };
    if (worldKeys.has(key)) return { panel: "world" };
    if (simulationKeys.has(key)) return { panel: "simulation" };
    const country = countryByKey.get(key);
    if (country) return { panel: "layers", country };
  }
  return { panel: "layers" };
}
