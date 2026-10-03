/**
 * 熱區／網格的顏色解析器（R7，map-layers.md §3.4 G-2／G-3）。
 *
 * 色盤選單（`kind: "palette"`）的值是字串、**不進 overlayParams**；paint、hook、圖例一律從這裡
 * 拿「這一層、這個底圖」的色階，不再各自 import 色票常數：
 *   registry paint → `heatmapRampFor` ／ `gridRampFor`（讀 store 當下值；store 一變 overlayParams
 *     的 identity 就換新，MapView 的 paint effect 會重跑）
 *   hook／圖例   → `usePaletteRamp`（訂閱單一 key）
 *
 * 另管 Q6 B「多層熱區疊放」：同時開 ≥2 層可換色熱區時，每層熱區透明度再乘 `HEATMAP.stackedOpacity`。
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { LAYER_PARAMS_SPEC, getParamsSpec, type LayerParamSpec, type PaletteParamSpec } from "../data/layerParamsSpec";
import { HEATMAP, heatmapColorExpr, heatmapOpacity, heatmapPaint } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import type { LayerVisibility } from "../types";
import { layerParamsStore, useLayerParams } from "./layerParamsStore";
import { layerVisibilityStore } from "./layerVisibilityStore";

/** 熱區預設色盤（Q4 A：全部熱區用驗證過的新版 magma） */
export const DEFAULT_HEATMAP_PALETTE = "magma";

type PaletteRole = PaletteParamSpec["role"];

function paletteSpecOf(key: string, name?: string): PaletteParamSpec | undefined {
  return getParamsSpec(key)?.find(
    (s): s is PaletteParamSpec => s.kind === "palette" && (name === undefined || s.name === name),
  );
}

/** 這一層目前的色盤 id（store 值不在選項內時回預設）；沒有色盤選單回 undefined */
export function layerPaletteId(key: string, name?: string): string | undefined {
  const spec = paletteSpecOf(key, name);
  if (!spec) return undefined;
  const v = layerParamsStore.getParam(key, spec.name);
  return typeof v === "string" && spec.options.includes(v) ? v : spec.default;
}

/**
 * 熱區 7 階（低 → 高，依底圖）。沒有色盤選單的層回 magma —— 熱區永遠有色，
 * 不讓某層因為漏登記就畫不出來。
 */
export function heatmapRampFor(key: string, isDark: boolean): readonly string[] {
  return paletteRamp(layerPaletteId(key) ?? DEFAULT_HEATMAP_PALETTE, isDark)!;
}

/**
 * 網格色階：該層色盤重新取樣成 `steps` 階（低 → 高）。`name` 給同一層有多個色盤選單時
 * （例：不動產總市值的總值／人均兩種模式）指定哪一個。
 */
export function gridRampFor(key: string, isDark: boolean, steps: number, name?: string): string[] {
  const id = layerPaletteId(key, name);
  if (!id) throw new Error(`${key} 沒有色盤選單${name ? `（${name}）` : ""}`);
  return resampleRamp(paletteRamp(id, isDark)!, steps);
}

/** React：訂閱單一 key 的色盤，回傳當下底圖的色階（圖例、hook 用） */
export function usePaletteRamp(key: string, isDark: boolean, steps = 7, name?: string): string[] {
  const values = useLayerParams(key);
  const spec = paletteSpecOf(key, name);
  const raw = spec ? values[spec.name] : undefined;
  return useMemo(() => {
    if (!spec) return resampleRamp(paletteRamp(DEFAULT_HEATMAP_PALETTE, isDark)!, steps);
    const id = typeof raw === "string" && spec.options.includes(raw) ? raw : spec.default;
    return resampleRamp(paletteRamp(id, isDark)!, steps);
  }, [spec, raw, isDark, steps]);
}

// ── Q6 B 多層熱區 ───────────────────────────────────────────────────

/** 有熱區色盤選單的 layer key（＝可換色熱區；雨量、電桿等自有色熱區不列） */
export const HEATMAP_PALETTE_KEYS: readonly string[] = Object.entries(LAYER_PARAMS_SPEC as Record<string, LayerParamSpec[]>)
  .filter(([, specs]) => specs.some((s) => s.kind === "palette" && s.role === ("heatmap" satisfies PaletteRole)))
  .map(([key]) => key);

/** 同時開著的可換色熱區層數 */
export function visibleHeatmapCount(vis: LayerVisibility): number {
  let n = 0;
  for (const key of HEATMAP_PALETTE_KEYS) if (vis[key as keyof LayerVisibility]) n += 1;
  return n;
}

/** 熱區疊放倍率：≥2 層 → `HEATMAP.stackedOpacity`，否則 1 */
export function heatmapStackFactor(vis: LayerVisibility = layerVisibilityStore.getAll()): number {
  return visibleHeatmapCount(vis) >= 2 ? HEATMAP.stackedOpacity : 1;
}

/** React：訂閱可見性，只在倍率真的改變時 re-render（回傳值是 number，同值不觸發） */
export function useHeatmapStackFactor(): number {
  const get = useCallback(() => heatmapStackFactor(layerVisibilityStore.getAll()), []);
  return useSyncExternalStore(layerVisibilityStore.subscribe, get, get);
}

// ── hook 自畫熱區的共用接線 ─────────────────────────────────────────

/** hook 建熱區圖層時的 paint（顏色＋疊放倍率由解析器給） */
export function heatmapLayerPaint(key: string, isDark: boolean, opacityScale: number, intensity: number, weight: unknown = 1): Record<string, unknown> {
  return heatmapPaint(opacityScale, intensity, weight, heatmapRampFor(key, isDark), heatmapStackFactor());
}

interface PaintTarget {
  getLayer(id: string): unknown;
  setPaintProperty(layer: string, name: string, value: unknown): void;
}

/** hook 更新既有熱區：顏色（色盤×底圖）＋透明度（滑桿比例×疊放倍率）一起套 */
export function applyHeatmapStyle(map: PaintTarget, layerId: string, key: string, isDark: boolean, opacityScale: number): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, "heatmap-color", heatmapColorExpr(heatmapRampFor(key, isDark)));
  map.setPaintProperty(layerId, "heatmap-opacity", heatmapOpacity(opacityScale, heatmapStackFactor()));
}

/**
 * hook 的 effect deps 用：這幾層的色盤 id ＋ 疊放倍率組成的字串。只有字串真的變了才 re-render
 * （拖其他滑桿、開關無關圖層都不會觸發）。
 */
export function useHeatmapStyleSignature(keys: readonly string[]): string {
  const joined = keys.join(",");
  const subscribe = useCallback((cb: () => void) => {
    const a = layerParamsStore.subscribe(cb);
    const b = layerVisibilityStore.subscribe(cb);
    return () => { a(); b(); };
  }, []);
  const get = useCallback(
    () => `${joined.split(",").map((k) => layerPaletteId(k) ?? "").join(",")}|${heatmapStackFactor()}`,
    [joined],
  );
  return useSyncExternalStore(subscribe, get, get);
}

/**
 * 圖例 LG-8 用：這幾層中「開著的」各自的熱區色盤 id（`key=id` 以逗號串起；都沒開時列全部）。
 * 一個圖例常管好幾層（診所／AED／長照、三種宗教設施），各層可能選了不同色盤。
 */
export function useHeatmapLegendPalettes(keys: readonly string[]): { key: string; paletteId: string }[] {
  const joined = keys.join(",");
  const subscribe = useCallback((cb: () => void) => {
    const a = layerParamsStore.subscribe(cb);
    const b = layerVisibilityStore.subscribe(cb);
    return () => { a(); b(); };
  }, []);
  const get = useCallback(() => {
    const all = joined.split(",");
    const vis = layerVisibilityStore.getAll() as unknown as Record<string, boolean>;
    const shown = all.filter((k) => vis[k]);
    return (shown.length ? shown : all).map((k) => `${k}=${layerPaletteId(k) ?? DEFAULT_HEATMAP_PALETTE}`).join(",");
  }, [joined]);
  const sig = useSyncExternalStore(subscribe, get, get);
  return useMemo(() => sig.split(",").map((pair) => {
    const [key, paletteId] = pair.split("=") as [string, string];
    return { key, paletteId };
  }), [sig]);
}
