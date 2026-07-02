import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createPowerPlantGlowLayer,
  POWER_PLANT_GLOW_LAYER_ID,
} from "../map/powerPlantGlowCustomLayer";
import {
  fetchFacPrimary,
  type FacilityPoint,
} from "../data/energyLoader";

/**
 * 發電廠 Bloom 測試 layer — 純視覺實驗，共用 fetchFacPrimary SSOT 資料。
 *
 * 只讀「運轉中」（status == null）電廠，不隨 timeline 變（跟主要圖層一致）。
 * pulse 在 shader 內走 uTime，React 這邊只要餵資料 + toggle。
 *
 * ⚠️ Style toggle race：走 try/catch + idle retry（見 pitfall
 * .claude/pitfalls/2026-04-22-mapbox-load-once-fired.md）
 */
export function usePowerPlantGlowLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  sizeMul: number,
) {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const sizeMulRef = useRef(sizeMul);
  sizeMulRef.current = sizeMul;
  const plantsRef = useRef<FacilityPoint[] | null>(null);

  // Mount custom layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const tryMount = () => {
      if (map.getLayer(POWER_PLANT_GLOW_LAYER_ID)) return;
      try {
        const layer = createPowerPlantGlowLayer({
          getIsVisible: () => visibleRef.current,
          getOpacity: () => opacityRef.current,
          getSizeMul: () => sizeMulRef.current,
          getPlants: () => plantsRef.current,
        });
        map.addLayer(layer);
        console.log("[PowerPlantGlow] CustomLayer mounted ✓");
      } catch (e) {
        console.log("[PowerPlantGlow] addLayer 失敗 → idle 後重試", e);
        map.once("idle", tryMount);
      }
    };

    tryMount();
    map.on("style.load", tryMount);
    return () => {
      map.off("style.load", tryMount);
    };
  }, [mapRef, visible]);

  // Fetch plants once when toggled on (5 min cache in loader)
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    fetchFacPrimary()
      .then((rows) => {
        if (cancelled) return;
        plantsRef.current = rows;
        mapRef.current?.triggerRepaint();
        console.log(`[PowerPlantGlow] fetched ${rows.length} plants`);
      })
      .catch((err) => console.warn("[PowerPlantGlow] fetch failed:", err));

    // fetchFacPrimary 自帶 cache（60 min），不用手動 poll
    return () => {
      cancelled = true;
    };
  }, [visible, mapRef]);
}
