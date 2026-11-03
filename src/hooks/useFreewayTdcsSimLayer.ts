import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { FREEWAY_TDCS_SIM_LAYER_ID, freewayTdcsSimModule, mountLazyCustomLayer } from "../map/lazyThreeLayers";
import { ensureFreewayTdcsWindow, loadFreewayTdcsSim } from "../data/freewayTdcsSimLoader";
import {
  freewayTdcsData, freewayTdcsFollowTrip, setFreewayTdcsData, setFreewayTdcsFollow, setFreewayTdcsFollowEndMsg,
  setFreewayTdcsStatus, subscribeFreewayTdcsColors, subscribeFreewayTdcsFollow, type FreewayTdcsFollowEndCode,
} from "../data/freewayTdcsSimStore";
import { SEGPOS_LEN, tripPosition, type FreewayTdcsData } from "../data/freewayTdcsSimModel";
import type { FreewayTdcsColorMode } from "../data/freewayTdcsSimTypes";
import { timeStore } from "../state/timeStore";

export interface FreewayTdcsSimParams {
  opacity: number;
  trail: number;
  width: number;
  size: number;
  colorMode: FreewayTdcsColorMode;
  vtMask: number;
}

/**
 * 雙北國道逐車模擬（本機研究層）。
 * - 時間：跟著全站時間軸；custom layer 在 render 內讀 timeStore.getTime()（不進 React deps，development-rules §8）。
 * - 跟隨：說明框按「跟隨」寫入 store；這裡用 timeStore.subscribe 每次時間變動移鏡頭（不在 paint pass 內動鏡頭）。
 *   Esc、再按一次、關圖層或車駛離資料範圍時結束；結束原因寫進 store 由圖例顯示（原型的 toast）。
 *   跟隨中鏡頭轉向行進方向（平滑），並暫停拖曳平移（縮放、旋轉照常）。
 */

/** 跟隨結束原因（原型 followStep 同款判斷） */
function followEndReason(D: FreewayTdcsData, trip: number, t: number): FreewayTdcsFollowEndCode {
  const first = D.tripFirst[trip]!, last = D.tripLast[trip]!;
  if (t < D.winStart || t > D.winEnd) return "window";
  if (t < first) return "before";
  if (t < last) return "service";
  return "exited";
}
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
          getWidth: () => paramsRef.current.width,
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

  // 開啟時載共用檔（只抓一次），之後依時間軸載入時段檔（timeStore 訂閱，不進 React deps）
  const ensureRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false, unsubTime: (() => void) | null = null;
    setFreewayTdcsStatus({ state: "loading" });
    loadFreewayTdcsSim().then((sim) => {
      if (cancelled) return;
      setFreewayTdcsStatus({ state: "ready" });
      (window as unknown as { __freewayTdcsSource?: string }).__freewayTdcsSource = sim.source;
      const onData = (D: FreewayTdcsData) => { setFreewayTdcsData(D); mapRef.current?.triggerRepaint(); };
      const run = () => ensureFreewayTdcsWindow(sim, timeStore.getTime() - sim.base.dayStartUnix, paramsRef.current.trail, onData);
      ensureRef.current = run;
      unsubTime = timeStore.subscribe(run);
      run();
      mapRef.current?.triggerRepaint();
    }, (err) => {
      console.warn("[freewayTdcsSim] 載入失敗", err);
      setFreewayTdcsStatus({ state: "error" });
    });
    return () => { cancelled = true; unsubTime?.(); ensureRef.current = null; };
  }, [visible, mapRef, mapTick]);

  // 參數或主題改變 → 重畫一次（時間變動由 custom layer 的 subscribeTimeRepaint 處理）
  const { opacity, trail, width, size, colorMode, vtMask } = params;
  useEffect(() => {
    if (!visible) return;
    ensureRef.current?.();   // 拖尾變長可能要多載前一個時段檔
    mapRef.current?.triggerRepaint();
  }, [visible, opacity, trail, width, size, colorMode, vtMask, isDark, mapRef, mapTick]);

  // 自訂顏色改變 → 重畫
  useEffect(() => {
    if (!visible) return;
    return subscribeFreewayTdcsColors(() => mapRef.current?.triggerRepaint());
  }, [visible, mapRef, mapTick]);

  // 關圖層 → 結束跟隨
  useEffect(() => { if (!visible) setFreewayTdcsFollow(null); }, [visible]);

  // 跟隨鏡頭
  useEffect(() => {
    if (!visible) return;
    const pos = new Float64Array(SEGPOS_LEN);
    let unsubTime: (() => void) | null = null;
    let bearing = 0, panLocked = false;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFreewayTdcsFollow(null); };
    const unlockPan = () => { if (panLocked) { mapRef.current?.dragPan.enable(); panLocked = false; } };
    const step = (first: boolean) => {
      const map = mapRef.current, D = freewayTdcsData(), trip = freewayTdcsFollowTrip();
      if (!map || !D || trip == null) return;
      const t = timeStore.getTime() - D.dayStartUnix;
      if (!tripPosition(D, trip, t, pos)) {
        // 這個時段的檔還在載：先等，不結束跟隨
        if (t >= D.winStart && t <= D.winEnd && (t < D.coverStart || t > D.coverEnd)) return;
        setFreewayTdcsFollowEndMsg(followEndReason(D, trip, t));
        setFreewayTdcsFollow(null);
        return;
      }
      // 方向平滑；大轉向（拖時間軸）直接對齊（原型同）
      const hb = 90 - (Math.atan2(pos[3]!, pos[2]!) * 180) / Math.PI;
      const d = ((((hb - bearing) % 360) + 540) % 360) - 180;
      bearing += first || Math.abs(d) > 60 ? d : d * 0.12;
      if (first) {
        map.easeTo({ center: [pos[0]!, pos[1]!], bearing, zoom: Math.max(map.getZoom(), 15), pitch: Math.max(map.getPitch(), 50), duration: 600 });
      } else if (!map.isEasing()) map.jumpTo({ center: [pos[0]!, pos[1]!], bearing });
      map.triggerRepaint();
    };
    const sync = () => {
      unsubTime?.(); unsubTime = null;
      window.removeEventListener("keydown", onKey);
      if (freewayTdcsFollowTrip() == null) { unlockPan(); mapRef.current?.triggerRepaint(); return; }
      const map = mapRef.current;
      if (map && !panLocked) { map.dragPan.disable(); panLocked = true; }
      if (map) bearing = map.getBearing();
      setFreewayTdcsFollowEndMsg(null);
      window.addEventListener("keydown", onKey);
      unsubTime = timeStore.subscribe(() => step(false));
      step(true);
    };
    const unsubFollow = subscribeFreewayTdcsFollow(sync);
    sync();
    return () => {
      unsubFollow(); unsubTime?.();
      unlockPan();
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, mapRef, mapTick]);
}
