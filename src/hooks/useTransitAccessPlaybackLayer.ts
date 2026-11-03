/**
 * 雙北大眾運輸可及性「單一起點擴張」圖層 hook（模擬面板，公開）。
 *
 * - 格面：沿用全台交通可及性的自訂 WebGL 圖層（`transitReachCustomLayer.ts`，另給 id），每幀只更新時間 uniform；
 *   時間來自 scoped 時鐘 `transitAccessClock`（不訂閱全站 currentTime，development-rules §8）。
 * - 資料：P1 u8 [3][N]（P5／P50／P95）取所選分位數轉成 0.1 分 Uint16；比較模式主檔＝GPS 版、基準＝表定版，
 *   以 PuOr 雙向分色（spec §5.40 S-4）。
 * - 起點：圓點。點擊讀值：`useMapInteraction` 用 h3 latLngToCell(res9) 查 `transitAccessPlaybackState`。
 */
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { loadH3 } from "../map/h3Runtime";
import { withLoading } from "../lib/loadingRegistry";
import { createTransitReachLayer, type TransitReachCustomLayer } from "../map/transitReachCustomLayer";
import { reportSimBundleError } from "../data/simBundle";
import {
  loadTransitAccessSingle, loadTransitAccessSingleBase, setTransitAccessPlaybackState, type TransitAccessSingleBase,
} from "../data/transitAccessStore";
import {
  PUOR, TRANSIT_ACCESS_SLUG, TRANSIT_ACCESS_UNREACHED_COLOR, singleSlice,
  type SinglePercentile, type TransitAccessNetwork, type TransitAccessOriginKey, type TransitAccessSlot,
} from "../data/transitAccessTypes";
import { autoRangeHours, maxReachedMinutes } from "../data/transitReachTypes";
import { transitAccessClock } from "../state/transitAccessClock";
import { useMapReadyTick } from "./useMapReadyTick";

export const TRANSIT_ACCESS_PLAYBACK_IDS = { cells: "transit-access-playback-cells", origin: "transit-access-origin-circle" } as const;
const SRC_ORIGIN = "transit-access-origin-src";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
/** 雙向比較容許值（分）：表定版 Monte Carlo 抽樣噪音最大約 4 分（p2.md §2.1） */
export const TRANSIT_ACCESS_PLAYBACK_TOL = 5;
/** 雙向 7 色：GPS 早很多（橘）→ 差在容許值內（灰）→ GPS 晚很多（紫） */
export const TRANSIT_ACCESS_DIVERGE = [PUOR[0], PUOR[1], PUOR[2], TRANSIT_ACCESS_UNREACHED_COLOR, PUOR[4], PUOR[5], PUOR[6]] as const;

export interface TransitAccessPlaybackControls {
  origin: TransitAccessOriginKey;
  slot: TransitAccessSlot;
  network: TransitAccessNetwork;
  pct: SinglePercentile;
}

function removeAll(map: MapboxMap) {
  for (const id of [TRANSIT_ACCESS_PLAYBACK_IDS.origin, TRANSIT_ACCESS_PLAYBACK_IDS.cells]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC_ORIGIN)) map.removeSource(SRC_ORIGIN); } catch { /* style replaced */ }
}

export function useTransitAccessPlaybackLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: TransitAccessPlaybackControls,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [base, setBase] = useState<TransitAccessSingleBase | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const layerRef = useRef<TransitReachCustomLayer | null>(null);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const geometryReady = useRef(false);

  if (!layerRef.current) {
    layerRef.current = createTransitReachLayer({
      id: TRANSIT_ACCESS_PLAYBACK_IDS.cells,
      getTimeMin: () => transitAccessClock.get() / 60,
      getOpacity: () => opacityRef.current,
      diverge: { colors: TRANSIT_ACCESS_DIVERGE, tolMin: TRANSIT_ACCESS_PLAYBACK_TOL },
    });
  }

  // 基本檔（cells、origins）＋靜態幾何：第一次開圖層才抓
  useEffect(() => {
    if (!visible || base) return;
    let cancelled = false;
    loadTransitAccessSingleBase().then((b) => withLoading("transit-access-geometry", "雙北大眾運輸可及性網格幾何", loadH3().then((h3) => {
      if (cancelled) return;
      if (!geometryReady.current) {
        layerRef.current!.setGeometry({
          rings: b.cells.h3.map((id) => h3.cellToBoundary(id)),
          centers: b.cells.h3.map((id) => h3.cellToLatLng(id)),
          u: new Array<number>(b.cells.h3.length).fill(0),
        });
        geometryReady.current = true;
      }
      setBase(b);
    }))).catch((error: unknown) => { if (!cancelled) reportSimBundleError(TRANSIT_ACCESS_SLUG, "single", error); });
    return () => { cancelled = true; };
  }, [visible, base]);

  // 起點／時段／版本／分位數：載入 → 上傳 GPU、算色階範圍
  const { origin: originKey, slot, network, pct } = controls;
  useEffect(() => {
    if (!visible || !base) return;
    const origin = base.origins.find((o) => o.key === originKey);
    if (!origin) { layerRef.current!.setTimes(null, null, false); setTransitAccessPlaybackState(null); return; }
    const compare = network === "cmp";
    let cancelled = false;
    Promise.all([
      loadTransitAccessSingle(base, compare ? "observed" : network, slot, origin.key),
      compare ? loadTransitAccessSingle(base, "scheduled", slot, origin.key) : Promise.resolve(null),
    ]).then(([main, sched]) => {
      if (cancelled) return;
      const n = base.cells.h3.length;
      const mainT = singleSlice(main, n, pct);
      const schedT = sched ? singleSlice(sched, n, pct) : null;
      layerRef.current!.setTimes(mainT, schedT, compare ? "diverge" : false);
      const zeros = new Array<number>(n).fill(0);
      const hours = Math.min(4, autoRangeHours(maxReachedMinutes(mainT, zeros)));
      layerRef.current!.setRangeHours(hours);
      setTransitAccessPlaybackState({ base, origin, network, slot, main, sched, rangeHours: hours });
    }).catch((error: unknown) => {
      if (cancelled) return;
      layerRef.current!.setTimes(null, null, false);
      setTransitAccessPlaybackState(null);
      reportSimBundleError(TRANSIT_ACCESS_SLUG, "single origin", error);
    });
    return () => { cancelled = true; };
  }, [visible, base, originKey, slot, network, pct]);

  useEffect(() => { if (!visible) setTransitAccessPlaybackState(null); }, [visible]);

  // source／layer：關閉就拆，換底圖（style.load）重建
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!visible || !base) { removeAll(map); return; }
      if (!map.getLayer(TRANSIT_ACCESS_PLAYBACK_IDS.cells)) map.addLayer(layerRef.current!);
      if (!map.getSource(SRC_ORIGIN)) map.addSource(SRC_ORIGIN, { type: "geojson", data: EMPTY });
      if (!map.getLayer(TRANSIT_ACCESS_PLAYBACK_IDS.origin)) map.addLayer({
        id: TRANSIT_ACCESS_PLAYBACK_IDS.origin, type: "circle", source: SRC_ORIGIN,
        paint: { "circle-radius": 6, "circle-color": "#ef4444", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, base, mapTick]);

  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 起點圓點
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !base) return;
    const o = base.origins.find((x) => x.key === originKey);
    (map.getSource(SRC_ORIGIN) as GeoJSONSource | undefined)?.setData(o
      ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [o.lng, o.lat] } }] }
      : EMPTY);
  }, [mapRef, visible, base, originKey, mountRevision, mapTick]);

  // 透明度：起點圓點跟著滑桿；格面在 render 內讀
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !map.getLayer(TRANSIT_ACCESS_PLAYBACK_IDS.origin)) return;
    map.setPaintProperty(TRANSIT_ACCESS_PLAYBACK_IDS.origin, "circle-opacity", Math.max(0, Math.min(1, opacity)));
    map.triggerRepaint();
  }, [mapRef, visible, opacity, mountRevision, mapTick]);

  // 時鐘：拖曳／暫停時重繪一次；播放時 RAF 每幀只 triggerRepaint（uniform 在 render 內讀時鐘）
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible) return;
    let raf: number | null = null;
    const frame = () => {
      raf = null;
      map.triggerRepaint();
      if (transitAccessClock.getSnapshot().playing) raf = requestAnimationFrame(frame);
    };
    const onClock = () => {
      if (transitAccessClock.getSnapshot().playing) { if (raf === null) raf = requestAnimationFrame(frame); }
      else map.triggerRepaint();
    };
    onClock();
    const off = transitAccessClock.subscribe(onClock);
    return () => { off(); if (raf !== null) cancelAnimationFrame(raf); };
  }, [mapRef, visible, mountRevision, mapTick]);
}
