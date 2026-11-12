/**
 * City Sound Atlas 綜合網格（W6-4/5，`soundComposite`，預覽）：七族當下的網格在 Web Worker 即時合成，甲乙一起算，切版本只換色表與幀。
 *
 * - 七族資料由 useSoundAtlasLayer 在背景載入（單族圖層維持關閉）；要等七族都載完、飛機每日包抓完才請求（之前註冊的 loading 會顯示）。
 * - 規則：src/sound/grid/compositeGrid.ts（MODEL_DECISIONS §10）；色表 SOUND_COMPOSITE_*（靛藍單一色相，越深越多）；255 斜線。
 * - 時間、競態、載入中：見 useSoundGridLayer。接收點在網格外（臺中和平）→ 不畫。
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSoundGridLayer, type GridLayerResult } from "./useSoundGridLayer";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { gridSourceApplies } from "../sound/grid/gridSources";
import { COMPOSITE_B_SCALE } from "../sound/grid/compositeGrid";
import { compositePreviewStore, type CompositeVariant } from "../sound/grid/compositePreview";
import { inScopeCells, GRID_UNKNOWN } from "../sound/grid/gridSpec";
import { COMPOSITE } from "../sound/model/soundProfiles";
import { paletteFromClasses } from "../map/soundGridCustomLayer";
import { SOUND_COMPOSITE_A_ALPHA, SOUND_COMPOSITE_A_COLORS, SOUND_COMPOSITE_B_RAMP } from "../sound/soundAtlasColors";

export const SOUND_COMPOSITE_GRID_LAYER_ID = "sound-atlas-grid-composite";

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** 乙：指數碼 0–200 → 由淺到深內插到 displayMaxIndex（之上同色） */
export function compositeBColorAt(code: number): { color: string; alpha: number } {
  const t = Math.min(1, code / COMPOSITE_B_SCALE / COMPOSITE.displayMaxIndex.value);
  const a = hex(SOUND_COMPOSITE_B_RAMP.from), b = hex(SOUND_COMPOSITE_B_RAMP.to);
  return {
    color: toHex(a.map((v, i) => v + (b[i]! - v) * t)),
    alpha: SOUND_COMPOSITE_B_RAMP.alphaFrom + (SOUND_COMPOSITE_B_RAMP.alphaTo - SOUND_COMPOSITE_B_RAMP.alphaFrom) * t,
  };
}

export function compositePalette(variant: CompositeVariant): Uint8Array {
  const colors: string[] = [];
  const alphas: number[] = [];
  for (let c = 0; c < 256; c++) {
    if (variant === "a" && c < SOUND_COMPOSITE_A_COLORS.length) { colors[c] = SOUND_COMPOSITE_A_COLORS[c]!; alphas[c] = SOUND_COMPOSITE_A_ALPHA[c]!; continue; }
    if (variant === "b" && c <= COMPOSITE_B_SCALE) { const x = compositeBColorAt(c); colors[c] = x.color; alphas[c] = x.alpha; continue; }
    colors[c] = "#000000"; alphas[c] = 0;
  }
  return paletteFromClasses(colors, alphas);
}

let scopeCells: Uint32Array | null = null;

export function useSoundCompositeGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  gate: number,
): void {
  const variant = useSyncExternalStore(compositePreviewStore.subscribe, () => compositePreviewStore.get().variant);
  const receiver = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().receiver);
  const loadingCount = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().loading.length);
  const outside = !!receiver && !gridSourceApplies(receiver);
  const palette = useMemo(() => compositePalette(variant), [variant]);
  const pick = useCallback((r: GridLayerResult) => {
    const c = r as Extract<GridLayerResult, { type: "composite" }>;
    return compositePreviewStore.get().variant === "a" ? c.a : c.b;
  }, []);
  const onFrame = useCallback((r: GridLayerResult) => {
    const c = r as Extract<GridLayerResult, { type: "composite" }>;
    scopeCells ??= inScopeCells();
    const v = compositePreviewStore.get().variant === "a" ? c.a : c.b;
    let unk = 0;
    for (let k = 0; k < scopeCells.length; k++) if (v[scopeCells[k]!] === GRID_UNKNOWN) unk++;
    compositePreviewStore.set({ notes: c.notes, unknownShare: unk / scopeCells.length, bin: c.bin });
  }, []);
  useSoundGridLayer({
    mapRef, layerId: SOUND_COMPOSITE_GRID_LAYER_ID, target: "composite", visible, suppressed: outside, ready: loadingCount === 0,
    opacity, palette, gate, pick, onFrame, label: "聲景綜合網格",
  });
}
