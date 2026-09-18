import { isStatisticsChoropleth } from "../data/statisticsLayerRegistry";
import type { LayerVisibility } from "../types";

/**
 * Sidebar expansion is presentation-only only when its statistics layer is
 * already visible. Opening an inactive statistics layer changes the rendered
 * data and must discard a popup from the prior layer.
 */
export type LayerClickIntent = "statistics-variant-switch";

export function shouldClearFeatureInfoForLayerClick(
  layer: keyof LayerVisibility,
  intent?: LayerClickIntent,
  wasVisible = true,
): boolean {
  return isStatisticsChoropleth(layer)
    && (intent === "statistics-variant-switch" || !wasVisible);
}
