/**
 * City Sound Atlas 綜合網格（W6-4/5，`soundComposite`，預覽）：七族當下的網格在 Web Worker 即時合成，甲乙丙一起算，切版本只換色表與幀。
 * - 丙「主因」（W6-8）：每格＝最明顯那一族的家族色，深淺＝該族分級；平靜＝中性灰。
 * - 滑過提示（W6-8，只限滑鼠）：讀主執行緒持有的當前幀（Worker 回的三版碼＋七族分級打包），一行白話原因；不重算、不呼叫 queryReceiver。
 *
 * - 七族資料由 useSoundAtlasLayer 在背景載入（單族圖層維持關閉）；要等七族都載完、飛機每日包抓完才請求（之前註冊的 loading 會顯示）。
 * - 規則：src/sound/grid/compositeGrid.ts（MODEL_DECISIONS §10）；色表 SOUND_COMPOSITE_*（靛藍單一色相，越深越多）；255 斜線。
 * - 時間、競態、載入中：見 useSoundGridLayer。接收點在網格外（臺中和平）→ 不畫。
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { MapMouseEvent } from "mapbox-gl";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSoundGridLayer, type GridLayerResult } from "./useSoundGridLayer";
import { useMapReadyTick } from "./useMapReadyTick";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { gridSourceApplies } from "../sound/grid/gridSources";
import { COMPOSITE_B_SCALE, COMPOSITE_C_LEVELS, COMPOSITE_FAMILIES, unpackLevels } from "../sound/grid/compositeGrid";
import { compositeFrameRef, compositePreviewStore, type CompositeVariant } from "../sound/grid/compositePreview";
import { cellIndexOf, countyOf, inScopeCells, GRID_UNKNOWN } from "../sound/grid/gridSpec";
import { createAnalysisHoverTip, supportsAnalysisHover } from "../research/analysisResultHover";
import { compositeReason } from "../components/sound/compositeReason";
import { useLocale } from "../state/localeStore";
import { COMPOSITE } from "../sound/model/soundProfiles";
import { paletteFromClasses } from "../map/soundGridCustomLayer";
import { SOUND_COMPOSITE_A_ALPHA, SOUND_COMPOSITE_A_COLORS, SOUND_COMPOSITE_B_RAMP, SOUND_COMPOSITE_C_ALPHA, SOUND_COMPOSITE_C_CALM, SOUND_COMPOSITE_C_CATEGORICAL_INDEX } from "../sound/soundAtlasColors";
import { categoricalColor, categoricalNeutral } from "../map/mapStyleScale";

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

export function compositePalette(variant: CompositeVariant, isDark = true): Uint8Array {
  const colors: string[] = [];
  const alphas: number[] = [];
  for (let c = 0; c < 256; c++) {
    if (variant === "a" && c < SOUND_COMPOSITE_A_COLORS.length) { colors[c] = SOUND_COMPOSITE_A_COLORS[c]!; alphas[c] = SOUND_COMPOSITE_A_ALPHA[c]!; continue; }
    if (variant === "b" && c <= COMPOSITE_B_SCALE) { const x = compositeBColorAt(c); colors[c] = x.color; alphas[c] = x.alpha; continue; }
    if (variant === "c" && c === 0) { colors[c] = categoricalNeutral(isDark); alphas[c] = SOUND_COMPOSITE_C_CALM.alpha; continue; }
    if (variant === "c" && c <= COMPOSITE_FAMILIES.length * COMPOSITE_C_LEVELS) {
      colors[c] = categoricalColor(SOUND_COMPOSITE_C_CATEGORICAL_INDEX[COMPOSITE_FAMILIES[Math.floor((c - 1) / COMPOSITE_C_LEVELS)]!], isDark);
      alphas[c] = SOUND_COMPOSITE_C_ALPHA[(c - 1) % COMPOSITE_C_LEVELS]!;
      continue;
    }
    colors[c] = "#000000"; alphas[c] = 0;
  }
  return paletteFromClasses(colors, alphas);
}

let scopeCells: Uint32Array | null = null;

type CompositeResult = Extract<GridLayerResult, { type: "composite" }>;
const variantFrame = (c: CompositeResult, v: CompositeVariant) => (v === "a" ? c.a : v === "b" ? c.b : c.c);

/** DEV 量測：滑過處理時間（ms） */
const hoverPerf = { n: 0, max: 0, sum: 0 };
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __soundHoverPerf: typeof hoverPerf }).__soundHoverPerf = hoverPerf;

export function useSoundCompositeGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  gate: number,
  isDarkTheme = true,
): void {
  const { t } = useLocale();
  const tRef = useRef(t);
  tRef.current = t;
  const darkRef = useRef(isDarkTheme);
  darkRef.current = isDarkTheme;
  const variant = useSyncExternalStore(compositePreviewStore.subscribe, () => compositePreviewStore.get().variant);
  const receiver = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().receiver);
  const loadingCount = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().loading.length);
  const outside = !!receiver && !gridSourceApplies(receiver);
  const palette = useMemo(() => compositePalette(variant, isDarkTheme), [variant, isDarkTheme]);
  const pick = useCallback((r: GridLayerResult) => {
    return variantFrame(r as CompositeResult, compositePreviewStore.get().variant);
  }, []);
  const onFrame = useCallback((r: GridLayerResult) => {
    const c = r as CompositeResult;
    scopeCells ??= inScopeCells();
    compositeFrameRef.set({ bin: c.bin, a: c.a, b: c.b, c: c.c, lv: c.lv });
    const v = variantFrame(c, compositePreviewStore.get().variant);
    let unk = 0;
    for (let k = 0; k < scopeCells.length; k++) if (v[scopeCells[k]!] === GRID_UNKNOWN) unk++;
    compositePreviewStore.set({ notes: c.notes, unknownShare: unk / scopeCells.length, bin: c.bin });
  }, []);
  useSoundGridLayer({
    mapRef, layerId: SOUND_COMPOSITE_GRID_LAYER_ID, target: "composite", visible, suppressed: outside, ready: loadingCount === 0,
    opacity, palette, gate, pick, onFrame, label: "聲景綜合網格",
  });

  // 滑過提示：只在綜合圖層開著、滑鼠裝置；手機不做
  const mapTick = useMapReadyTick(mapRef, visible);
  useEffect(() => {
    const map = mapRef.current;
    if (!visible || outside || !map || !supportsAnalysisHover()) return;
    const tip = createAnalysisHoverTip(map.getContainer());
    let lastKey = "";
    let label = { name: "", value: null as string | null };
    const hide = () => { tip.hide(); lastKey = ""; };
    const onMove = (e: MapMouseEvent) => {
      const s0 = performance.now();
      const f = compositeFrameRef.get();
      const cell = cellIndexOf(e.lngLat.lng, e.lngLat.lat);
      if (!f || cell < 0 || countyOf(cell) === 0) { hide(); return; }
      const variant = compositePreviewStore.get().variant;
      const key = `${f.bin}|${cell}|${variant}`;
      // 同一格只重新定位，不重組文字
      if (key !== lastKey) {
        const r = compositeReason(tRef.current, unpackLevels(f.lv[cell]!), variant, { a: f.a[cell]!, b: f.b[cell]!, c: f.c[cell]! });
        label = { name: r.head, value: r.detail };
        lastKey = key;
      }
      tip.show(e.point, label, !darkRef.current);
      const ms = performance.now() - s0;
      hoverPerf.n++; hoverPerf.sum += ms; if (ms > hoverPerf.max) hoverPerf.max = ms;
    };
    map.on("mousemove", onMove);
    map.on("mouseout", hide);
    map.on("movestart", hide);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", hide);
      map.off("movestart", hide);
      tip.destroy();
      compositeFrameRef.set(null);
    };
  }, [mapRef, mapTick, visible, outside]);
}
