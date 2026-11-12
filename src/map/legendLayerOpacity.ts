/**
 * 圖例合成色（design-system map-layers §4 LG-14）：查圖層「目前畫在地圖上」的面填色透明度。
 *
 * 用與地圖相同的路徑求值：
 *   - config 當下可見（`isOverlayVisible`：toggle 開著、多尺度圖層選中的那個尺度）；
 *   - fill 子圖層的 layout 求值後不是 `visibility: none`（V-5 點／面切換：點模式時面子圖層隱藏）；
 *   - 排除裝飾子圖層（hit、halo、hatch、outline…，與對比契約同一份字表）；
 *   - `paint(isDark, overlayParams)["fill-opacity"]` 再乘 `opacityParam` 滑桿（同 applyLayerOpacity）。
 * 只認數字；透明度是 Mapbox 表達式、目前沒有畫面、或圖層不在 registry（hook 自建、3D）時回 undefined，
 * 圖例維持原本的色票畫法。
 */
import type { LayerVisibility, OverlayConfig, OverlayLayerSpec } from "../types";
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import { isOverlayVisible } from "./overlayManager";

export { DECORATIVE_SUFFIX_WORDS, isDecorativeSuffix } from "./decorativeSuffix";
import { isDecorativeSuffix } from "./decorativeSuffix";
import { liftedColorMap } from "./darkContrast";

let configsByKey: Map<string, OverlayConfig[]> | null = null;

function configsOf(key: string): OverlayConfig[] {
  if (!configsByKey) {
    configsByKey = new Map();
    for (const config of OVERLAY_REGISTRY) {
      const list = configsByKey.get(config.id) ?? [];
      list.push(config);
      configsByKey.set(config.id, list);
    }
  }
  return configsByKey.get(key) ?? [];
}

function layoutHidden(spec: OverlayLayerSpec, isDark: boolean, params: Record<string, number>): boolean {
  const layout = typeof spec.layout === "function" ? spec.layout(isDark, params) : spec.layout;
  return layout?.visibility === "none";
}

/** 單一圖層 key 目前畫著的面填色透明度；查不到回 undefined。 */
export function overlayFillOpacity(
  key: string,
  isDark: boolean,
  params: Record<string, number>,
  visibility: Partial<Record<keyof LayerVisibility, boolean>> = { [key]: true },
): number | undefined {
  for (const config of configsOf(key)) {
    if (!isOverlayVisible(config, visibility as LayerVisibility, params)) continue;
    for (const spec of config.layers) {
      if (spec.type !== "fill" || isDecorativeSuffix(spec.suffix)) continue;
      let value: unknown;
      try {
        if (layoutHidden(spec, isDark, params)) continue;
        value = spec.paint(isDark, params)["fill-opacity"];
        // 0 是有效值（滑桿拉到 0）；只有「不論參數都是 0」的點擊用透明面（如縣市界 fill）才當查不到
        if (value === 0 && !(Number(spec.paint(isDark, {})["fill-opacity"]) > 0)) continue;
      } catch {
        continue;
      }
      if (typeof value !== "number" || value < 0) continue;
      const multiplier = config.opacityParam ? params[config.opacityParam] : undefined;
      return Math.max(0, Math.min(1, multiplier === undefined ? value : value * multiplier));
    }
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
    const alpha = overlayFillOpacity(key, isDark, params, visibility);
    if (alpha !== undefined) return alpha;
  }
  return undefined;
}

/**
 * C-4 圖例同步：群組內「開著」的圖層提亮對照合併（darkContrast liftedColorMap）；都沒有回 null。
 * 同一原色在不同圖層提亮結果不同時，取群組順序中第一個。
 */
export function legendLiftMap(
  keys: readonly (keyof LayerVisibility)[],
  visibility: Partial<Record<keyof LayerVisibility, boolean>>,
  isDark: boolean,
): ReadonlyMap<string, string> | null {
  let out: Map<string, string> | null = null;
  for (const key of keys) {
    if (!visibility[key]) continue;
    const map = liftedColorMap(key, isDark);
    if (map.size === 0) continue;
    out ??= new Map();
    for (const [from, to] of map) if (!out.has(from)) out.set(from, to);
  }
  return out;
}
