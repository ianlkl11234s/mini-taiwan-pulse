/**
 * City Sound Atlas 雨網格（W6-1）：soundRain 開著時，把已載入的 rain set（雨量站＋雷達每日包）畫成北北 250 m 網格。
 *
 * - 資料：讀 soundAtlasStore.sets.rain（useSoundAtlasLayer 載入的同一份；有場景快照就是快照），不另外載入 →
 *   網格與接收點查詢讀同一份資料。雷達包讀取已在 loader 註冊 loadingRegistry；第一幀上傳後延續到地圖 idle。
 * - 時間：timeStore.subscribeThrottled（不把 currentTime 放 deps，development-rules §8）；取「≤ t 的最新一格」
 *   （10 分格起點），同一格不重算。場景回放與即時都走同一條（時間軸的 t 就是資料時間）。
 * - 渲染：src/map/soundGridCustomLayer（自訂 WebGL；255 斜線、遮罩外不畫、透明度滑桿）。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { countyCodes, GRID_CELLS, inScopeCells } from "../sound/grid/gridSpec";
import { buildRainGaugeField, rainGridFrame } from "../sound/grid/rainGrid";
import { rainGridBin, rainGridState, RAIN_GRID_STEP_S, setRainGridState } from "../sound/grid/rainGridState";
import { createSoundGridLayer, paletteFromClasses, type SoundGridLayer } from "../map/soundGridCustomLayer";
import { SOUND_RAIN_GRID_ALPHA, SOUND_RAIN_GRID_COLORS, SOUND_UNKNOWN_COLOR } from "../sound/soundAtlasColors";
import type { AnyRainRecord } from "../sound/sourceAdapters/rainFieldAdapter";

export const SOUND_RAIN_GRID_LAYER_ID = "sound-atlas-grid-rain";
/** 網格畫在聲源點圖層下面（點、連線、動畫在上） */
const BEFORE_LAYER = "sound-atlas-route-line";
/** 10 分一格，節流 250 ms 足夠（拖曳時間軸也跟得上） */
const GRID_THROTTLE_MS = 250;

export function useSoundRainGridLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number): void {
  const mapTick = useMapReadyTick(mapRef, visible);
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets.rain ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins.rain ?? null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const layerRef = useRef<SoundGridLayer | null>(null);

  // ── 圖層掛載（換底圖 style.load 重掛；幀與色表留在圖層閉包）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!layerRef.current) {
      const codes = countyCodes();
      const mask = new Uint8Array(GRID_CELLS);
      for (let i = 0; i < GRID_CELLS; i++) mask[i] = codes[i] ? 1 : 0;
      const layer = createSoundGridLayer({
        id: SOUND_RAIN_GRID_LAYER_ID,
        getOpacity: () => opacityRef.current,
        mask,
        hatch: { color: SOUND_UNKNOWN_COLOR, alpha: 0.75 },
        onUploadMs: (ms) => setRainGridState({ lastUploadMs: ms }),
      });
      layer.setPalette(paletteFromClasses(SOUND_RAIN_GRID_COLORS, SOUND_RAIN_GRID_ALPHA));
      layerRef.current = layer;
    }
    const layer = layerRef.current;
    const mount = () => {
      if (map.getLayer(SOUND_RAIN_GRID_LAYER_ID)) return;
      map.addLayer(layer, map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined);
    };
    mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      if (map.getLayer(SOUND_RAIN_GRID_LAYER_ID)) map.removeLayer(SOUND_RAIN_GRID_LAYER_ID);
    };
  }, [mapRef, visible, mapTick]);

  // 透明度：uniform 每幀讀 opacityRef，只要重畫
  useEffect(() => { mapRef.current?.triggerRepaint(); }, [mapRef, opacity, mapTick]);

  // 關閉時清狀態（popup 不再命中）
  useEffect(() => {
    if (visible) return;
    setRainGridState({ set: null, binStart: null });
    layerRef.current?.setFrame(null);
  }, [visible]);

  const field = useMemo(() => (set ? buildRainGaugeField(set.records as AnyRainRecord[]) : null), [set]);

  // ── 時間：≤ t 的最新一格 ──
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !visible || !layer) return;
    const cells = inScopeCells();
    const buf = new Uint8Array(GRID_CELLS);
    let lastBin: number | null = null;
    let firstFrame = true;
    setRainGridState({ set, origin, binStart: null });
    const apply = (t: number) => {
      const bin = rainGridBin(t);
      if (bin === lastBin) return;
      lastBin = bin;
      const t0 = performance.now();
      const frame = rainGridFrame(set, field, bin, bin + RAIN_GRID_STEP_S - 1e-6, cells, buf);
      layer.setFrame(frame.values);
      const ms = performance.now() - t0;
      setRainGridState({ binStart: bin, lastFrameMs: ms, frames: rainGridState().frames + 1 });
      if (firstFrame && set) {
        firstFrame = false;
        keepLoadingUntilMapIdle(map, `sound-rain-grid-render:${set.dateKey}`, `聲景雨網格 ${set.dateKey}`);
      }
    };
    apply(timeStore.getTime());
    return timeStore.subscribeThrottled(GRID_THROTTLE_MS, apply);
  }, [mapRef, visible, set, field, origin, mapTick]);
}
