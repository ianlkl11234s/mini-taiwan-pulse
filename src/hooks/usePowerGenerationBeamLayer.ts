import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createPowerGenerationBeamLayer,
  POWER_GENERATION_BEAM_LAYER_ID,
} from "../map/powerGenerationBeamCustomLayer";
import {
  fetchPowerPlantsForTime,
  type PowerPlantRow,
} from "../data/energyLoader";
import { timeStore } from "../state/timeStore";

/**
 * Layer 4：機組即時出力 3D beam，跟隨 timeline 時間軸。
 * - Snap timeStore.getTime() 到 10min 邊界（cron 寫入頻率）
 * - subscribeThrottled 2s：scrub 平滑、不打爆 RPC
 * - cachedByKey 15min TTL × 24 key LRU：重看同段不重抓
 * - retention 7 days；歷史超出範圍時 RPC 回空 → beam 高度歸 0
 */
export function usePowerGenerationBeamLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const plantsRef = useRef<PowerPlantRow[] | null>(null);

  // Mount layer — visible 加進 deps，toggle ON 時保證 effect 重跑（修：mapRef.current
  // 在初始 render 可能為 null，原本 [mapRef] 不會 re-run）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const mount = () => {
      if (map.getLayer(POWER_GENERATION_BEAM_LAYER_ID)) return;
      const layer = createPowerGenerationBeamLayer({
        getIsVisible: () => visibleRef.current,
        getOpacity: () => opacityRef.current,
        getPlants: () => plantsRef.current,
      });
      map.addLayer(layer);
      console.info("[PowerBeam] CustomLayer mounted");
    };

    if (map.isStyleLoaded()) mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      // 注意：visible 切 OFF 時也會跑 cleanup，但不 removeLayer
      // （toggle 開關不該 unmount/remount，只靠 scene.setVisible）
    };
  }, [mapRef, visible]);

  // Fetch + 跟隨 timeStore（2s throttle，內部用 cachedByKey 10min boundary）
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let loadGen = 0;

    const load = (tsSec: number) => {
      const myGen = ++loadGen;
      fetchPowerPlantsForTime(tsSec)
        .then((rows) => {
          if (cancelled || myGen !== loadGen) return; // 舊請求丟棄
          plantsRef.current = rows.slice();
          mapRef.current?.triggerRepaint();
        })
        .catch((err) => console.warn("[PowerBeam] load failed:", err));
    };

    // 初始 + 訂閱
    load(timeStore.getTime());
    const unsub = timeStore.subscribeThrottled(2000, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [visible, mapRef]);
}
