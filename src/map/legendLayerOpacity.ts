/**
 * 圖例合成色（design-system map-layers §4 LG-13）：查圖層「目前實際的面填色透明度」。
 *
 * 用與地圖相同的路徑求值：OVERLAY_REGISTRY 的 fill 子圖層 `paint(isDark, overlayParams)` 的
 * `fill-opacity`，再乘 `opacityParam` 滑桿（同 overlayManager.applyLayerOpacity）。
 * 只認數字；透明度是 Mapbox 表達式（依 zoom／資料變化）或圖層不在 registry（hook 自建、3D）時回 undefined，
 * 圖例維持原本的色票畫法。
 */
import type { LayerVisibility, OverlayConfig, OverlayLayerSpec } from "../types";
import { OVERLAY_REGISTRY } from "./overlayRegistry";

let fillSpecsByKey: Map<string, Array<{ config: OverlayConfig; spec: OverlayLayerSpec }>> | null = null;

function fillSpecs(key: string) {
  if (!fillSpecsByKey) {
    fillSpecsByKey = new Map();
    for (const config of OVERLAY_REGISTRY) {
      for (const spec of config.layers) {
        if (spec.type !== "fill") continue;
        const list = fillSpecsByKey.get(config.id) ?? [];
        list.push({ config, spec });
        fillSpecsByKey.set(config.id, list);
      }
    }
  }
  return fillSpecsByKey.get(key) ?? [];
}

/** 單一圖層 key 的面填色透明度（第一個透明度是數字的 fill 子圖層）；查不到回 undefined。 */
export function overlayFillOpacity(key: string, isDark: boolean, params: Record<string, number>): number | undefined {
  for (const { config, spec } of fillSpecs(key)) {
    let value: unknown;
    try {
      value = spec.paint(isDark, params)["fill-opacity"];
    } catch {
      continue;
    }
    if (typeof value !== "number") continue;
    const multiplier = config.opacityParam ? params[config.opacityParam] : undefined;
    return Math.max(0, Math.min(1, multiplier === undefined ? value : value * multiplier));
  }
  return undefined;
}

/** 圖例群組：取第一個「開著且查得到」的成員。 */
export function legendFillOpacity(
  keys: readonly (keyof LayerVisibility)[],
  visibility: Partial<Record<keyof LayerVisibility, boolean>>,
  isDark: boolean,
  params: Record<string, number>,
): number | undefined {
  for (const key of keys) {
    if (!visibility[key]) continue;
    const alpha = overlayFillOpacity(key, isDark, params);
    if (alpha !== undefined) return alpha;
  }
  return undefined;
}
