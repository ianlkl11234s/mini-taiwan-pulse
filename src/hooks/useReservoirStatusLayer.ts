import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  fetchReservoirStatusLatest,
  type ReservoirStatus,
} from "../data/reservoirStatusLoader";
import { ReservoirScene } from "../three/ReservoirScene";
import { createReservoirLayer } from "../map/reservoirCustomLayer";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

/**
 * 水庫 3D 水位計 hook
 *
 * 管理：
 *   1. ReservoirScene 實例 + Mapbox custom layer 掛載
 *   2. 定期呼叫 get_reservoir_status_latest() 更新水位
 *   3. 暴露 sceneRef 供 useMapInteraction 做 pick
 *
 * **關鍵**：以 visible 變 true 作為掛載觸發條件。
 * - useEffect 依賴 ref 不會 re-run（ref 不會觸發 render）
 * - handleMapReady 發生時 hook 已 mount 但 mapRef.current 還是 null
 * - 所以靠 visible 變 true 的 re-render 重新執行 effect 才能正確 attach
 *
 * Refresh 策略：visible 開啟後立即 fetch + 每 REFRESH_MS 輪詢
 */

const REFRESH_MS = 5 * 60 * 1000; // 5 分鐘
const LAYER_ID = "reservoir-3d";

export function useReservoirStatusLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  heightScale: number,
  sceneRef: React.RefObject<ReservoirScene | null>,
  statusesRef: React.RefObject<ReservoirStatus[]>,
) {
  const visibleRef = useRef(visible);
  const isDarkRef = useRef(isDark);
  const heightScaleRef = useRef(heightScale);
  const mountedRef = useRef(false);

  visibleRef.current = visible;
  isDarkRef.current = isDark;
  heightScaleRef.current = heightScale;

  // ── 首次 visible = true 時建 scene + 掛 custom layer ──
  useEffect(() => {
    console.log("[Reservoir] mount effect", { visible, mounted: mountedRef.current, map: !!mapRef.current });
    if (!visible) return;
    if (mountedRef.current) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retry = 0;

    const attach = () => {
      console.log("[Reservoir] attaching custom layer", { styleLoaded: map.isStyleLoaded() });
      mountedRef.current = true;
      const scene = new ReservoirScene();
      sceneRef.current = scene;

      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      const layer = createReservoirLayer({
        scene,
        getStatuses: () => statusesRef.current ?? [],
        getIsVisible: () => visibleRef.current,
        getIsDarkTheme: () => isDarkRef.current,
        getHeightScale: () => heightScaleRef.current,
      });
      try {
        map.addLayer(layer);
        console.log("[Reservoir] layer added, getLayer =", !!map.getLayer(LAYER_ID));
      } catch (err) {
        console.warn("[Reservoir] addLayer failed:", err);
        mountedRef.current = false;
        sceneRef.current = null;
        return false;
      }
      // 如果已經 fetch 過，立即 setStatuses
      const existing = statusesRef.current ?? [];
      if (existing.length > 0) {
        scene.setStatuses(existing);
      }
      map.triggerRepaint();
      return true;
    };

    // 若 style 已 ready 直接裝；否則每 200ms retry（通常 1-2 tick 內就 ready）
    const tryAttach = () => {
      if (cancelled || mountedRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      retry++;
      if (!map.isStyleLoaded() && retry < 50) {
        return; // 等下一個 tick
      }
      if (attach() && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      attach();
    } else {
      console.log("[Reservoir] style not loaded, start polling");
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [mapRef, visible, sceneRef, statusesRef]);

  // ── visible = true 時啟動 fetch + 輪詢 ──
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const load = async () => {
      try {
        console.log("[Reservoir] calling get_reservoir_status_latest...");
        const list = await fetchReservoirStatusLatest();
        if (cancelled) return;
        console.log(`[Reservoir] RPC returned ${list.length} reservoirs`, list[0]);
        statusesRef.current = list;
        const scene = sceneRef.current;
        if (scene) {
          scene.setStatuses(list);
          const map = mapRef.current;
          if (map) {
            keepLoadingUntilMapIdle(
              map,
              "reservoir-status-render",
              "水庫水情 渲染中",
              null,
            );
            map.triggerRepaint();
          }
        } else {
          console.warn("[Reservoir] scene not ready when RPC returned");
        }
      } catch (err) {
        console.warn("[Reservoir] status fetch failed:", err);
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mapRef, sceneRef, statusesRef, visible]);

  // ── heightScale 變化（slider 拖拉）強制 repaint ──
  useEffect(() => {
    const map = mapRef.current;
    if (map && visible) map.triggerRepaint();
  }, [heightScale, visible, mapRef]);
}
