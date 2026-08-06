import { useCallback, useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { TimeMode } from "../types";
import {
  fetchParkingSegmentsFC, invalidateParkingSegments, fetchParkingSegmentsDay,
  fetchParkingLotsFC, invalidateParkingLots, fetchParkingLotsDay,
  parkingSlotIndexAt, rateFromChar, type ParkingDayData,
} from "../data/parkingLoader";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 停車 parking 圖層 — Live（當下快照）+ Replay（15 分鐘 timeline 回放）雙模式。
 *
 * 比照 useBusLayer：單一 toggle，依 timeMode 切換資料來源：
 *   live   → get_parking_*_current 當下快照（5min poll），availability_rate 直接染色
 *   replay → get_parking_*_day 的 96 字元 timeline，訂閱 timeStore 算 15min slot →
 *            每 entity 取字元 → 空位率 → 就地改 feature.availability_rate → setData
 *
 * 兩模式共用 overlayRegistry 既有 paint（availabilityColorExpr / neutralCapacityColorExpr）：
 * 差別只在資料來源與染色時機（live 一次性、replay 隨 slot 更新）。台北路邊 timeline
 * 全 '-' → rate=null → fill 走中性容量色（與 live 一致）；回放讀當下未來槽 → clamp
 * 到 lastPopulatedSlot 避免全灰（比照 road congestion）。
 */

const RELOAD_MS = 5 * 60_000;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface ParkingSourceCfg {
  fetchCurrent: () => Promise<GeoJSON.FeatureCollection>;
  invalidateCurrent: () => void;
  fetchDay: (date: string) => Promise<ParkingDayData>;
}

function useParkingSource(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isLive: boolean,
  sourceId: string,
  cfg: ParkingSourceCfg,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  // fcRef 永遠是「當前該貼到 source 的 FC」（live 快照 or replay 當前 slot 已染色的 day fc）
  const fcRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const dayRef = useRef<ParkingDayData | null>(null);
  const activeDateRef = useRef<string>("");
  const fetchingRef = useRef<string>("");
  const lastSlotRef = useRef<number>(-1);

  const feed = useCallback(() => {
    const src = mapRef.current?.getSource(sourceId) as GeoJSONSource | undefined;
    src?.setData(fcRef.current ?? EMPTY_FC);
  }, [mapRef, sourceId, mapTick]);

  // ── Live：當下快照 poll ──
  useEffect(() => {
    if (!visible || !isLive) return;
    let cancelled = false;

    const load = () => {
      cfg.fetchCurrent()
        .then((fc) => {
          if (cancelled) return;
          fcRef.current = fc;
          feed();
        })
        .catch((err) => console.warn(`[parking] live ${sourceId} failed:`, err));
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    load();
    const id = window.setInterval(() => { cfg.invalidateCurrent(); load(); }, RELOAD_MS);

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isLive, sourceId, feed, mapRef, mapTick]);

  // ── Replay：day timeline scrub ──
  useEffect(() => {
    if (!visible || isLive) return;
    let cancelled = false;

    // 把當前 slot 的空位率就地寫進每個 feature 再 setData
    const recolor = (t: number, force: boolean) => {
      const day = dayRef.current;
      if (!day) return;
      const slot = Math.min(parkingSlotIndexAt(t), day.lastPopulatedSlot);
      if (!force && slot === lastSlotRef.current) return;
      lastSlotRef.current = slot;
      const feats = day.fc.features;
      for (let i = 0; i < feats.length; i++) {
        const props = feats[i]!.properties;
        if (props) props.availability_rate = rateFromChar(day.timelines[i]?.[slot]);
      }
      fcRef.current = day.fc;
      feed();
    };

    const loadDay = (dateStr: string) => {
      if (!dateStr || dateStr === activeDateRef.current || dateStr === fetchingRef.current) return;
      fetchingRef.current = dateStr;
      cfg.fetchDay(dateStr)
        .then((day) => {
          if (cancelled || fetchingRef.current !== dateStr) return;
          dayRef.current = day;
          activeDateRef.current = dateStr;
          lastSlotRef.current = -1; // 強制下一次 recolor 重算
          recolor(timeStore.getTime(), true);
        })
        .catch((err) => console.warn(`[parking] replay ${sourceId} ${dateStr} failed:`, err))
        .finally(() => { if (fetchingRef.current === dateStr) fetchingRef.current = ""; });
    };

    const map = mapRef.current;
    const onStyleLoad = () => feed();
    map?.on("style.load", onStyleLoad);

    // 進 replay：重置 → 載入當前日期 → 訂閱日期 / 時間變化
    activeDateRef.current = "";
    lastSlotRef.current = -1;
    loadDay(timeStore.getDateKey());
    const unsubDate = timeStore.subscribeDate((k) => { if (k) loadDay(k); });
    // 1s 節流足夠（資料本身 15min 粒度）；slot 未變早退避免無謂 setData
    const unsubTick = timeStore.subscribeThrottled(1000, (t) => recolor(t, false));

    return () => {
      cancelled = true;
      map?.off("style.load", onStyleLoad);
      unsubDate();
      unsubTick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isLive, sourceId, feed, mapRef, mapTick]);
}

export function useParkingLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  onstreetVisible: boolean,
  offstreetVisible: boolean,
  timeMode: TimeMode,
) {
  const isLive = timeMode === "live";
  useParkingSource(mapRef, onstreetVisible, isLive, "parking-onstreet", {
    fetchCurrent: fetchParkingSegmentsFC,
    invalidateCurrent: invalidateParkingSegments,
    fetchDay: fetchParkingSegmentsDay,
  });
  useParkingSource(mapRef, offstreetVisible, isLive, "parking-offstreet", {
    fetchCurrent: fetchParkingLotsFC,
    invalidateCurrent: invalidateParkingLots,
    fetchDay: fetchParkingLotsDay,
  });
}
