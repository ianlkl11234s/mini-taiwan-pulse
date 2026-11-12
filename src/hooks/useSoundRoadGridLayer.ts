/**
 * City Sound Atlas 道路車流網格（W6-2）：soundRoadTraffic 開著時，把已載入的 road_traffic set（路網＋當日國道 VD）
 * 畫成北北 250 m 網格。仿 useSoundRainGridLayer（W6-1）：
 *
 * - 資料：讀 soundAtlasStore.sets.road_traffic（useSoundAtlasLayer 載入的同一份），不另外載入 → 網格與接收點同一份資料。
 *   路網與每日包的 fetch 已在 loader 註冊 loadingRegistry；建每格候選與第一幀延續到地圖 idle。
 * - 時間：timeStore.subscribeThrottled（不把 currentTime 放 deps）；取「≤ t 的最新一格」，同一格不重算。
 * - 渲染：src/map/soundGridCustomLayer（255 斜線、遮罩外不畫、透明度滑桿）；色表＝證據基底＋分級（roadNetwork.ROAD_EVIDENCE_BASE）。
 * - 道路沒有示意動畫，不需要動畫開關。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { countyCodes, GRID_CELLS } from "../sound/grid/gridSpec";
import { buildRoadGridField, roadGridFrame, roadNetworkRecordOf } from "../sound/grid/roadGrid";
import { ROAD_EVIDENCE_BASE, type RoadEvidence } from "../sound/grid/roadNetwork";
import { roadGridBin, roadGridState, ROAD_GRID_STEP_S, setRoadGridState } from "../sound/grid/roadGridState";
import { createSoundGridLayer, paletteFromClasses, type SoundGridLayer } from "../map/soundGridCustomLayer";
import { SOUND_ROAD_GRID_ALPHA, SOUND_ROAD_GRID_COLORS, SOUND_UNKNOWN_COLOR } from "../sound/soundAtlasColors";

export const SOUND_ROAD_GRID_LAYER_ID = "sound-atlas-grid-road";
const BEFORE_LAYER = "sound-atlas-route-line";
const GRID_THROTTLE_MS = 250;

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
  const mapTick = useMapReadyTick(mapRef, visible);
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets.road_traffic ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins.road_traffic ?? null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const layerRef = useRef<SoundGridLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!layerRef.current) {
      const codes = countyCodes();
      const mask = new Uint8Array(GRID_CELLS);
      for (let i = 0; i < GRID_CELLS; i++) mask[i] = codes[i] ? 1 : 0;
      const layer = createSoundGridLayer({
        id: SOUND_ROAD_GRID_LAYER_ID,
        getOpacity: () => opacityRef.current,
        mask,
        hatch: { color: SOUND_UNKNOWN_COLOR, alpha: 0.75 },
        onUploadMs: (ms) => setRoadGridState({ lastUploadMs: ms }),
      });
      layer.setPalette(roadGridPalette());
      layerRef.current = layer;
    }
    const layer = layerRef.current;
    const mount = () => {
      if (map.getLayer(SOUND_ROAD_GRID_LAYER_ID)) return;
      map.addLayer(layer, map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined);
    };
    mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      if (map.getLayer(SOUND_ROAD_GRID_LAYER_ID)) map.removeLayer(SOUND_ROAD_GRID_LAYER_ID);
    };
  }, [mapRef, visible, mapTick]);

  useEffect(() => { mapRef.current?.triggerRepaint(); }, [mapRef, opacity, mapTick]);

  useEffect(() => {
    if (visible) return;
    setRoadGridState({ set: null, binStart: null });
    layerRef.current?.setFrame(null);
  }, [visible]);

  // 每格候選來源只跟路網有關（換日只換流量，路網物件相同 → 不重建）
  const net = roadNetworkRecordOf(set)?.payload.net ?? null;
  const field = useMemo(() => {
    if (!net) return null;
    const t0 = performance.now();
    const f = buildRoadGridField(net);
    setRoadGridState({ fieldMs: performance.now() - t0 });
    return f;
  }, [net]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !visible || !layer) return;
    const buf = new Uint8Array(GRID_CELLS);
    let lastBin: number | null = null;
    let firstFrame = true;
    setRoadGridState({ set, origin, binStart: null });
    const apply = (t: number) => {
      const bin = roadGridBin(t);
      if (bin === lastBin) return;
      lastBin = bin;
      const t0 = performance.now();
      const frame = roadGridFrame(set, field, bin, bin + ROAD_GRID_STEP_S - 1e-6, buf);
      layer.setFrame(frame.values);
      setRoadGridState({ binStart: bin, lastFrameMs: performance.now() - t0, frames: roadGridState().frames + 1 });
      if (firstFrame && set) {
        firstFrame = false;
        keepLoadingUntilMapIdle(map, `sound-road-grid-render:${set.dateKey}`, `聲景道路網格 ${set.dateKey}`);
      }
    };
    apply(timeStore.getTime());
    return timeStore.subscribeThrottled(GRID_THROTTLE_MS, apply);
  }, [mapRef, visible, set, field, origin, mapTick]);
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
