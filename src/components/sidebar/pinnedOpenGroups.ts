import type { LayerVisibility } from "../../types";
import type { CountryCode } from "../../constants/countries";
import type { LayerDef } from "./layerCatalog";
import { countryLayerThemes } from "./layerPanels";

/** 「其他釘選國家已開的圖層」摺疊區的一組：某個釘選國家＋它目前開著的圖層。 */
export interface PinnedOpenGroup {
  country: CountryCode;
  layers: LayerDef[];
}

/**
 * 釘選但不是目前國家、而且目前開著的圖層，依釘選順序分組（G1-b）。
 * 只看各國「圖層」入口的主題樹（WORLD／SIM 不屬於任何國家，所以不會出現）；
 * `visibleCountries` 過濾站主限定國家（非站主不列，釘過也不列）。沒有符合的圖層就不回該國，整區可以不畫。
 */
export function groupPinnedOpenLayers(
  pinned: readonly CountryCode[],
  current: CountryCode,
  visibleCountries: ReadonlySet<CountryCode>,
  visibility: LayerVisibility,
): PinnedOpenGroup[] {
  const groups: PinnedOpenGroup[] = [];
  for (const country of pinned) {
    if (country === current || !visibleCountries.has(country)) continue;
    const seen = new Set<string>();
    const layers: LayerDef[] = [];
    for (const theme of countryLayerThemes(country)) {
      for (const group of theme.groups) {
        for (const layer of group.layers) {
          if (visibility[layer.key] && !seen.has(layer.key)) {
            seen.add(layer.key);
            layers.push(layer);
          }
        }
      }
    }
    if (layers.length > 0) groups.push({ country, layers });
  }
  return groups;
}
