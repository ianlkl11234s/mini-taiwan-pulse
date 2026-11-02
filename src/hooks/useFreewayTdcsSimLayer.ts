import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { FREEWAY_TDCS_SIM_LAYER_ID, freewayTdcsSimModule, mountLazyCustomLayer } from "../map/lazyThreeLayers";
import { loadFreewayTdcsSim } from "../data/freewayTdcsSimLoader";
import {
  freewayTdcsData, freewayTdcsFollowTrip, setFreewayTdcsData, setFreewayTdcsFollow, setFreewayTdcsStatus,
  subscribeFreewayTdcsFollow,
} from "../data/freewayTdcsSimStore";
import { tripEnded, tripPosition } from "../data/freewayTdcsSimModel";
import type { FreewayTdcsColorMode } from "../data/freewayTdcsSimTypes";
import { timeStore } from "../state/timeStore";

export interface FreewayTdcsSimParams {
  opacity: number;
  trail: number;
  size: number;
  colorMode: FreewayTdcsColorMode;
  vtMask: number;
}

/**
 * 雙北國道逐車模擬（本機研究層）。
 * - 時間：跟著全站時間軸；custom layer 在 render 內讀 timeStore.getTime()（不進 React deps，development-rules §8）。
 * - 跟隨：說明框按「跟隨」寫入 store；這裡用 timeStore.subscribe 每次時間變動移鏡頭（不在 paint pass 內動鏡頭）。
 *   Esc、再按一次、關圖層或車駛離資料範圍時結束。
 */
export function useFreewayTdcsSimLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  params: FreewayTdcsSimParams,
  isDark: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const paramsRef = useRef(params); paramsRef.current = params;
  const darkRef = useRef(isDark); darkRef.current = isDark;

  // 掛 custom layer（three 模組第一次可見才載入）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tryMount = () => {
      if (map.getLayer(FREEWAY_TDCS_SIM_LAYER_ID)) return;
      try {
        mountLazyCustomLayer(map, FREEWAY_TDCS_SIM_LAYER_ID, freewayTdcsSimModule, (m) => m.createFreewayTdcsSimLayer({
          getData: freewayTdcsData,
          getIsVisible: () => visibleRef.current,
          getOpacity: () => paramsRef.current.opacity,
          getTrail: () => paramsRef.current.trail,
          getSize: () => paramsRef.current.size,
          getColorMode: () => paramsRef.current.colorMode,
          getVtMask: () => paramsRef.current.vtMask,
          getIsDark: () => darkRef.current,
          getFollowTrip: freewayTdcsFollowTrip,
        }), () => visibleRef.current);
      } catch (e) {
        console.log("[freewayTdcsSim] addLayer 失敗 → idle 後重試", e);
        map.once("idle", tryMount);
      }
    };
    tryMount();
    map.on("style.load", tryMount);
    return () => { map.off("style.load", tryMount); };
  }, [mapRef, visible, mapTick]);

  // 開啟時載入資料（只抓一次）
  useEffect(() => {
    if (!visible) return;
    if (freewayTdcsData()) { mapRef.current?.triggerRepaint(); return; }
    let cancelled = false;
    setFreewayTdcsStatus({ state: "loading" });
    loadFreewayTdcsSim().then((d) => {
      setFreewayTdcsData(d);
      setFreewayTdcsStatus({ state: "ready" });
      if (!cancelled) mapRef.current?.triggerRepaint();
    }, (err) => {
      console.warn("[freewayTdcsSim] 載入失敗", err);
      setFreewayTdcsStatus({ state: "error" });
    });
    return () => { cancelled = true; };
  }, [visible, mapRef, mapTick]);

  // 參數或主題改變 → 重畫一次（時間變動由 custom layer 的 subscribeTimeRepaint 處理）
  const { opacity, trail, size, colorMode, vtMask } = params;
  useEffect(() => {
    if (visible) mapRef.current?.triggerRepaint();
  }, [visible, opacity, trail, size, colorMode, vtMask, isDark, mapRef, mapTick]);

  // 關圖層 → 結束跟隨
  useEffect(() => { if (!visible) setFreewayTdcsFollow(null); }, [visible]);

  // 跟隨鏡頭
  useEffect(() => {
    if (!visible) return;
    const pos = new Float64Array(5);
    let unsubTime: (() => void) | null = null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFreewayTdcsFollow(null); };
    const step = (first: boolean) => {
      const map = mapRef.current, D = freewayTdcsData(), trip = freewayTdcsFollowTrip();
      if (!map || !D || trip == null) return;
      const t = timeStore.getTime() - D.dayStartUnix;
      if (tripEnded(D, trip, t) || t < D.winStart || t > D.winEnd) { setFreewayTdcsFollow(null); return; }
      if (!tripPosition(D, trip, t, pos)) return; // 服務區停留等空檔：鏡頭先停著
      if (first) map.easeTo({ center: [pos[0]!, pos[1]!], zoom: Math.max(map.getZoom(), 15), duration: 600 });
      else if (!map.isEasing()) map.jumpTo({ center: [pos[0]!, pos[1]!] });
      map.triggerRepaint();
    };
    const sync = () => {
      unsubTime?.(); unsubTime = null;
      window.removeEventListener("keydown", onKey);
      if (freewayTdcsFollowTrip() == null) { mapRef.current?.triggerRepaint(); return; }
      window.addEventListener("keydown", onKey);
      unsubTime = timeStore.subscribe(() => step(false));
      step(true);
    };
    const unsubFollow = subscribeFreewayTdcsFollow(sync);
    sync();
    return () => {
      unsubFollow(); unsubTime?.();
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, mapRef, mapTick]);
}
