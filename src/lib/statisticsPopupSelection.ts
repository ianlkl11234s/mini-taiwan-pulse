import { isStatisticsChoropleth } from "../data/statisticsLayerRegistry";
import type { LayerVisibility } from "../types";

/**
 * Sidebar expansion is presentation-only. A statistics popup is stale only
 * after a successful switch to a different statistics variant.
 */
export type LayerClickIntent = "statistics-variant-switch";

export function shouldClearFeatureInfoForLayerClick(
  layer: keyof LayerVisibility,
  intent?: LayerClickIntent,
): boolean {
  return intent === "statistics-variant-switch" && isStatisticsChoropleth(layer);
}
