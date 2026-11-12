/**
 * City Sound Atlas 連續潛勢網格（W6-3；W6-4 起幀在 Web Worker 算）：飛機、鐵道、風吹樹葉、海浪、河川開著時畫成北北 250 m 網格。
 *
 * - 資料：soundAtlasStore.sets[family] 由 soundGridClient 送進 Worker（飛機改送每日包，主執行緒驗來源雜湊）；
 *   Worker 用同一支 potentialPackFrame／railGridFrame／naturalGridFrame（網格值＝queryReceiver(格心, 區間)）。
 *   這天沒有全範圍來源檔 → 整幀無法判斷（斜線）；接收點在網格外（臺中和平）→ 除鐵道外不畫。
 * - 鐵道冷算一幀 70–280 ms：在 Worker 算＋快取 36 格＋閒置預算前後格，主執行緒不再被卡。
 * - 時間、競態、載入中：見 useSoundGridLayer。色表＝potentialLevelTable(門檻)，飛機換門檻只換色表、不重算幀。
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSoundGridLayer } from "./useSoundGridLayer";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { gridSourceApplies } from "../sound/grid/gridSources";
import { potentialLevelTable } from "../sound/grid/potentialCode";
import { potentialGridState, setPotentialGridState, type PotentialGridFamily } from "../sound/grid/potentialGridState";
import { paletteFromClasses } from "../map/soundGridCustomLayer";
import { SOUND_POTENTIAL_GRID_ALPHA, SOUND_POTENTIAL_GRID_COLORS } from "../sound/soundAtlasColors";

export const soundPotentialGridLayerId = (family: PotentialGridFamily) => `sound-atlas-grid-${family}`;

/** 256×4 色表：碼 → 分級（potentialLevelOfCode(碼, 門檻)）→ 家族色；255 與未用碼透明（渲染器另畫斜線） */
export function potentialGridPalette(family: PotentialGridFamily, gate: number): Uint8Array {
  const table = potentialLevelTable(gate);
  const colors: string[] = [];
  const alphas: number[] = [];
  for (let c = 0; c < 256; c++) {
    const lv = table[c]!;
    if (lv < 0) { colors[c] = "#000000"; alphas[c] = 0; continue; }
    colors[c] = SOUND_POTENTIAL_GRID_COLORS[family][lv]!;
    alphas[c] = SOUND_POTENTIAL_GRID_ALPHA[lv]!;
  }
  return paletteFromClasses(colors, alphas);
}

export function useSoundPotentialGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  family: PotentialGridFamily,
  visible: boolean,
  opacity: number,
  gate = 0,
): void {
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets[family] ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins[family] ?? null);
  const receiver = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().receiver);
  const outside = !!receiver && !gridSourceApplies(receiver) && family !== "rail";
  const palette = useMemo(() => potentialGridPalette(family, gate), [family, gate]);
  if (visible) setPotentialGridState(family, { set, origin, gate, ...(outside ? { binStart: null, frameNote: "receiver_outside_grid" } : {}) });
  else setPotentialGridState(family, { set: null, binStart: null, frameNote: null });
  useSoundGridLayer({
    mapRef, layerId: soundPotentialGridLayerId(family), target: family, visible, suppressed: outside, opacity, palette,
    label: `聲景${family}網格 ${set?.dateKey ?? ""}`,
    onFrame: (r) => setPotentialGridState(family, {
      binStart: r.bin, frameNote: r.type === "frame" ? r.note : null, lastFrameMs: r.ms, frames: potentialGridState(family).frames + 1,
    }),
    onUploadMs: (ms) => setPotentialGridState(family, { lastUploadMs: ms }),
  });
}

// 開發用量測／驗收把手（同 __soundRainGrid）
if (import.meta.env.DEV && typeof window !== "undefined") {
  void Promise.all([import("../state/timelineJumpBridge"), import("../sound/grid/potentialGridState")]).then(([bridge, grid]) => {
    (window as unknown as Record<string, unknown>).__soundPotentialGrid = {
      state: grid.potentialGridState,
      jump: (unix: number) => bridge.requestTimelineJump(unix),
      pick: grid.pickSoundPotentialCell,
    };
  });
}
