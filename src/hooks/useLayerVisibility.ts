import { useCallback, useRef, useState } from "react";
import type { LayerVisibility } from "../types";
import { LAYER_COLORS } from "../components/sidebar/layerCatalog";

/**
 * 預設開啟的圖層；其餘一律 false。
 * key 全集從 layerCatalog 的 LAYER_COLORS 派生（型別強制完整）—
 * 新增 layer 不用再改本檔，除非要預設開啟。
 */
const DEFAULT_ON: ReadonlySet<keyof LayerVisibility> = new Set<keyof LayerVisibility>([
  "flights",
  "ships",
  "rail",
  "stationsTHSR",
  "stationsTRA",
  "stationsMetro",
  "ports",
  "lighthouses",
  "airports",
  // Phase 8 SSOT facilities — L1 主要電廠 + L2 離岸風場 polygon 預設 ON
  "facPrimary",
  "facOffshore",
]);

function buildDefaults(): LayerVisibility {
  const keys = Object.keys(LAYER_COLORS) as (keyof LayerVisibility)[];
  return Object.fromEntries(
    keys.map((k) => [k, DEFAULT_ON.has(k)]),
  ) as unknown as LayerVisibility;
}

export function useLayerVisibility() {
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(buildDefaults);
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;

  const toggleVisibility = useCallback((layer: keyof LayerVisibility) => {
    setLayerVisibility((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  return { layerVisibility, layerVisibilityRef, setLayerVisibility, toggleVisibility };
}
