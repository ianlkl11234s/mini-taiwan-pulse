import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createPowerGenerationBeamLayer,
  POWER_GENERATION_BEAM_LAYER_ID,
} from "../map/powerGenerationBeamCustomLayer";
import {
  fetchPowerPlants,
  invalidatePowerPlants,
  type PowerPlantRow,
} from "../data/energyLoader";

/**
 * Layer 4：機組即時出力 3D beam。
 * - 與 useEnergyPoiLayer 共用 fetchPowerPlants（cachedOnce 5min）→ 不重複網路
 * - 自己持有 plantsRef 給 CustomLayer 拉取（避免 React re-render 進 frame loop）
 * - 5 min poll，與 layer 1 同步
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

  // Mount layer
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
    };

    if (map.isStyleLoaded()) mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      if (map.getLayer(POWER_GENERATION_BEAM_LAYER_ID)) {
        map.removeLayer(POWER_GENERATION_BEAM_LAYER_ID);
      }
    };
  }, [mapRef]);

  // Fetch + poll
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = () => {
      fetchPowerPlants()
        .then((rows) => {
          if (cancelled) return;
          // CustomLayer 用 reference equality 判斷 dirty，重發新 array reference
          plantsRef.current = rows.slice();
          mapRef.current?.triggerRepaint();
        })
        .catch((err) => console.warn("[PowerBeam] load failed:", err));
    };

    load();
    const t = window.setInterval(() => {
      invalidatePowerPlants();
      load();
    }, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [visible, mapRef]);
}
