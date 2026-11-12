/**
 * City Sound Atlas 雨網格（W6-1；W6-4 起幀在 Web Worker 算）：soundRain 開著時，把已載入的 rain set（雨量站＋雷達每日包）畫成北北 250 m 網格。
 *
 * - 資料：soundAtlasStore.sets.rain（useSoundAtlasLayer 載入的同一份）由 soundGridClient 送進 Worker；
 *   Worker 用同一支 rainGridFrame（網格值＝queryReceiver(格心, t) 的雨分級）。
 * - 時間、競態、載入中：見 useSoundGridLayer。
 * - 渲染：src/map/soundGridCustomLayer（255 斜線、遮罩外不畫、透明度滑桿）。
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSoundGridLayer } from "./useSoundGridLayer";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { rainGridState, setRainGridState } from "../sound/grid/rainGridState";
import { paletteFromClasses } from "../map/soundGridCustomLayer";
import { SOUND_RAIN_GRID_ALPHA, SOUND_RAIN_GRID_COLORS } from "../sound/soundAtlasColors";

export const SOUND_RAIN_GRID_LAYER_ID = "sound-atlas-grid-rain";

export function useSoundRainGridLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number): void {
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets.rain ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins.rain ?? null);
  const palette = useMemo(() => paletteFromClasses(SOUND_RAIN_GRID_COLORS, SOUND_RAIN_GRID_ALPHA), []);
  setRainGridState(visible ? { set, origin } : { set: null, binStart: null });
  useSoundGridLayer({
    mapRef, layerId: SOUND_RAIN_GRID_LAYER_ID, target: "rain", visible, opacity, palette,
    label: `聲景雨網格 ${set?.dateKey ?? ""}`,
    onFrame: (r) => setRainGridState({ binStart: r.bin, lastFrameMs: r.ms, frames: rainGridState().frames + 1 }),
    onUploadMs: (ms) => setRainGridState({ lastUploadMs: ms }),
  });
}

// 開發用量測／驗收把手（同 __transitReachPerf）：讀目前格狀態、跳時間、選場景、點格查詢
if (import.meta.env.DEV && typeof window !== "undefined") {
  void Promise.all([import("../state/timelineJumpBridge"), import("../sound/soundAtlasActions"), import("../sound/grid/rainGridState")]).then(([bridge, actions, grid]) => {
    (window as unknown as Record<string, unknown>).__soundRainGrid = {
      state: grid.rainGridState,
      jump: (unix: number) => bridge.requestTimelineJump(unix),
      scene: (id: Parameters<typeof actions.selectSoundScene>[0]) => actions.selectSoundScene(id),
      pick: grid.pickSoundRainCell,
    };
  });
}
