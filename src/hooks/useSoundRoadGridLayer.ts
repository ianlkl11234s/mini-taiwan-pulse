/**
 * City Sound Atlas 道路車流網格（W6-2；W6-4 起幀在 Web Worker 算）：soundRoadTraffic 開著時，把已載入的 road_traffic set
 * （路網＋當日國道 VD）畫成北北 250 m 網格。
 *
 * - 資料：soundAtlasStore.sets.road_traffic 由 soundGridClient 送進 Worker（路網只送一次）；每格候選來源（約 100 ms）在 Worker 建。
 *   Worker 用同一支 roadGridFrame（網格值＝queryReceiver(格心, t) 的道路結果）。
 * - 時間、競態、載入中：見 useSoundGridLayer。
 * - 色表＝證據基底＋分級（roadNetwork.ROAD_EVIDENCE_BASE）。道路沒有示意動畫。
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSoundGridLayer } from "./useSoundGridLayer";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { ROAD_EVIDENCE_BASE, type RoadEvidence } from "../sound/grid/roadNetwork";
import { roadGridState, setRoadGridState } from "../sound/grid/roadGridState";
import { paletteFromClasses } from "../map/soundGridCustomLayer";
import { SOUND_ROAD_GRID_ALPHA, SOUND_ROAD_GRID_COLORS } from "../sound/soundAtlasColors";

export const SOUND_ROAD_GRID_LAYER_ID = "sound-atlas-grid-road";

/** 256×4 色表：碼＝證據基底＋分級（國道 0–4、臺北典型 10–14、新北推估 20–24） */
export function roadGridPalette(): Uint8Array {
  const colors: string[] = [];
  const alphas: number[] = [];
  for (const ev of Object.keys(ROAD_EVIDENCE_BASE) as RoadEvidence[]) {
    const b = ROAD_EVIDENCE_BASE[ev];
    SOUND_ROAD_GRID_COLORS[ev].forEach((c, k) => { colors[b + k] = c; alphas[b + k] = SOUND_ROAD_GRID_ALPHA[ev][k]!; });
  }
  for (let i = 0; i < colors.length; i++) if (!colors[i]) { colors[i] = "#000000"; alphas[i] = 0; }
  return paletteFromClasses(colors, alphas);
}

export function useSoundRoadGridLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number): void {
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets.road_traffic ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins.road_traffic ?? null);
  const palette = useMemo(roadGridPalette, []);
  setRoadGridState(visible ? { set, origin } : { set: null, binStart: null });
  useSoundGridLayer({
    mapRef, layerId: SOUND_ROAD_GRID_LAYER_ID, target: "road_traffic", visible, opacity, palette,
    label: `聲景道路網格 ${set?.dateKey ?? ""}`,
    onFrame: (r) => setRoadGridState({ binStart: r.bin, lastFrameMs: r.ms, frames: roadGridState().frames + 1 }),
    onUploadMs: (ms) => setRoadGridState({ lastUploadMs: ms }),
  });
}

// 開發用量測／驗收把手（同 __soundRainGrid）
if (import.meta.env.DEV && typeof window !== "undefined") {
  void Promise.all([import("../state/timelineJumpBridge"), import("../sound/grid/roadGridState")]).then(([bridge, grid]) => {
    (window as unknown as Record<string, unknown>).__soundRoadGrid = {
      state: grid.roadGridState,
      jump: (unix: number) => bridge.requestTimelineJump(unix),
      pick: grid.pickSoundRoadCell,
    };
  });
}
