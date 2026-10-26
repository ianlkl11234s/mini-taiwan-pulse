import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  BUS_CROWDING_SIM_ACCESS_DENIED_EVENT, BUS_CROWDING_SIM_KEY, BUS_CROWDING_SIM_LAYER_IDS, BUS_CROWDING_SIM_SOURCE_ID,
  busCrowdingLevel,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingVersion, type BusCrowdingView,
} from "../data/busCrowdingSimTypes";
import {
  BUS_CROWDING_DRAWN_FILTER, BUS_CROWDING_SORT_KEY,
  busCrowdingColorExpression, busCrowdingOpacityExpression, busCrowdingWidthExpression,
} from "../data/busCrowdingSimStyle";
import { isBusCrowdingAccessDenied, loadBusCrowdingReplayTrips, loadBusCrowdingScenario, loadBusCrowdingSegments } from "../data/busCrowdingSimLoader";
import { currentSegmentClasses, type ReplayTrip } from "../data/busCrowdingReplay";
import { busCrowdingSimClock } from "../state/busCrowdingSimClock";
import { buildSegmentIndex, busCrowdingSimIndexStore, busCrowdingSimScenarioStore } from "../data/busCrowdingSimStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { useMapReadyTick } from "./useMapReadyTick";
import { busCrowdingSimAuth } from "./useBusCrowdingSimPrivateAccess";

export interface BusCrowdingSimControls { version: BusCrowdingVersion; scenario: BusCrowdingScenario; view?: BusCrowdingView }

/** 回放路段：模擬時間變動不到這麼多秒就不重算（同原型 index.html:322 的 30 秒節流）。 */
export const REPLAY_SEGMENT_STEP_S = 30;

const IDS = BUS_CROWDING_SIM_LAYER_IDS;
const SRC = BUS_CROWDING_SIM_SOURCE_ID;
const KEY = BUS_CROWDING_SIM_KEY;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 私人讀取失敗：401／403 派 denied 事件（App 關圖層、清 popup、顯示提示），其餘只記錄（withLoading 已標失敗）。 */
export function reportBusCrowdingLoadError(what: string, error: unknown): void {
  if (isBusCrowdingAccessDenied(error)) window.dispatchEvent(new Event(BUS_CROWDING_SIM_ACCESS_DENIED_EVENT));
  console.warn(`[bus-crowding-sim] ${what} load failed`, error);
}

/** 推估路段：實線；有值＝viridis 三級＋L-1 標準線寬＋L-4 標準透明度，0 級＝F-2 灰細參考線；滑桿乘透明度。 */
const linePaint = (opacity: number, isDark: boolean) => ({
  "line-color": busCrowdingColorExpression(isDark),
  "line-width": busCrowdingWidthExpression(),
  "line-opacity": busCrowdingOpacityExpression(clamp(opacity), isDark),
});

/** 全部 style layer（初始 visibility none）；匯出供測試做 style-spec 驗證。高值靠 line-sort-key 疊在上面。 */
export function buildBusCrowdingSimLayers(opacity: number, isDark = true): LineLayer[] {
  const hidden = { visibility: "none" as const };
  const filter = BUS_CROWDING_DRAWN_FILTER;
  return [
    { id: IDS.line, type: "line", source: SRC, filter, layout: { ...hidden, ...hookLineLayout(KEY, IDS.line), "line-sort-key": BUS_CROWDING_SORT_KEY }, paint: hookLinePaint(KEY, IDS.line, linePaint(opacity, isDark), linePaint(1, isDark), isDark) },
    { id: IDS.hit, type: "line", source: SRC, filter, layout: hidden, paint: { "line-color": "#000000", "line-width": 14, "line-opacity": 0 } },
  ] as unknown as LineLayer[];
}

function removeAll(map: MapboxMap) {
  for (const id of [IDS.hit, IDS.line]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* style replaced */ }
}

/**
 * 把目前版本的數值寫進 properties（ov 缺值 -1、t 班次），幾何沿用同一物件。
 * line-sort-key 只吃 properties（不吃 feature-state），所以切版本／方案要重建 FeatureCollection。
 */
export function withBusCrowdingValues(
  geometry: GeoJSON.FeatureCollection, data: BusCrowdingScenarioData | null, version: BusCrowdingVersion,
): GeoJSON.FeatureCollection {
  const values = data?.values[version];
  return {
    type: "FeatureCollection",
    features: geometry.features.map((feature, i) => ({
      ...feature,
      properties: {
        ...feature.properties, ov: values?.ov[i] ?? -1, t: values?.n[i] ?? 0,
        lv: busCrowdingLevel(values?.ov[i], values?.n[i]) ?? -1, s: values?.ov[i] ?? -1,
      },
    })),
  };
}

/** 時間回放：只放有值的段（lv＝當下負載分級；沒有班次的段不畫，同原型）。 */
export function withReplayClasses(geometry: GeoJSON.FeatureCollection, classes: Int8Array): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  geometry.features.forEach((feature, i) => {
    const lv = classes[i] ?? -1;
    if (lv >= 0) features.push({ ...feature, properties: { ...feature.properties, lv, s: lv } });
  });
  return { type: "FeatureCollection", features };
}

/**
 * 站主限定私人資料（只經私人 Range API）：一個 GeoJSON source＋實線＋命中層。
 * `userId`＝已驗證的站主帳號；null（未登入、不是站主、失去權限）就不抓、並清掉已載入的幾何。
 */
export function useBusCrowdingSimLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: BusCrowdingSimControls,
  isDark = true,
  userId: string | null = null,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [geometry, setGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [data, setData] = useState<BusCrowdingScenarioData | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const latestOpacity = useRef(opacity);
  latestOpacity.current = opacity;
  const latestIsDark = useRef(isDark);
  latestIsDark.current = isDark;
  const latestFeatures = useRef<GeoJSON.FeatureCollection | null>(null);
  const view = controls.view ?? "static";
  const latestView = useRef(view);
  latestView.current = view;
  const [replayTrips, setReplayTrips] = useState<ReplayTrip[] | null>(null);

  // 失去權限：清掉已載入的私人幾何（不留在記憶體給別的帳號）。
  useEffect(() => {
    if (userId) return;
    setGeometry(null); busCrowdingSimIndexStore.set(null);
  }, [userId]);

  // 幾何：第一次開圖層才抓（模組級快取，依帳號分開）。
  useEffect(() => {
    if (!visible || !userId || geometry) return;
    let cancelled = false;
    loadBusCrowdingSegments(busCrowdingSimAuth(userId)).then((fc) => {
      if (cancelled) return;
      busCrowdingSimIndexStore.set(buildSegmentIndex(fc));
      setGeometry(fc);
    }).catch((error: unknown) => {
      if (cancelled) return;
      reportBusCrowdingLoadError("segments", error);
    });
    return () => { cancelled = true; };
  }, [visible, userId, geometry]);

  // 數值：方案換了才抓（兩版一起）；關圖層清掉 popup 用的 store。
  useEffect(() => {
    if (!visible || !userId) { setData(null); busCrowdingSimScenarioStore.set(null); return; }
    let cancelled = false;
    // 換方案：先清掉舊方案結果，載入失敗時地圖與 popup 不沿用舊數值。
    setData(null); busCrowdingSimScenarioStore.set(null);
    loadBusCrowdingScenario(controls.scenario, busCrowdingSimAuth(userId)).then((loaded) => {
      if (cancelled) return;
      setData(loaded); busCrowdingSimScenarioStore.set(loaded);
    }).catch((error: unknown) => {
      if (cancelled) return;
      reportBusCrowdingLoadError("values", error);
    });
    return () => { cancelled = true; };
  }, [visible, userId, controls.scenario]);

  // source／layer：關閉就拆，換底圖（style.load）重建。
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!visible || !geometry) { removeAll(map); return; }
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: latestFeatures.current ?? geometry });
        keepLoadingUntilMapIdle(map, `${SRC}:render`, "公車擁擠模擬路段繪製中", SRC);
      }
      for (const layer of buildBusCrowdingSimLayers(latestOpacity.current, latestIsDark.current)) if (!map.getLayer(layer.id)) map.addLayer(layer);
      map.setLayoutProperty(IDS.line, "visibility", "visible");
      // 回放時路段不接點擊（點車看 popup）；全時段才有路段 popup
      map.setLayoutProperty(IDS.hit, "visibility", latestView.current === "replay" ? "none" : "visible");
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, geometry, mapTick]);

  // 關閉圖層時拆掉（mount effect 只在 visible 變 false 時跑 removeAll 一次）。
  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 透明度／底圖明暗：只換 paint，不重建 source。
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.getLayer(IDS.line)) return;
    const paint = hookLinePaint(KEY, IDS.line, linePaint(opacity, isDark), linePaint(1, isDark), isDark);
    map.setPaintProperty(IDS.line, "line-opacity", paint["line-opacity"] as never);
    map.setPaintProperty(IDS.line, "line-color", paint["line-color"] as never);
  }, [mapRef, mapTick, opacity, isDark, mountRevision]);

  // 版本／方案：數值寫進 properties 後 setData（幾何不重抓）。換底圖重建 source 時 mount 直接用 latestFeatures。
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !geometry || view !== "static") return;
    if (map.getLayer(IDS.hit)) map.setLayoutProperty(IDS.hit, "visibility", "visible");
    const started = performance.now();
    const next = withBusCrowdingValues(geometry, data, controls.version);
    const built = performance.now();
    latestFeatures.current = next;
    const source = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(next);
    if (import.meta.env.DEV) console.debug(`[bus-crowding-sim] setData ${next.features.length} features: build ${(built - started).toFixed(1)} ms, setData ${(performance.now() - built).toFixed(1)} ms`);
  }, [mapRef, mapTick, visible, geometry, data, controls.version, mountRevision, view]);

  // 時間回放：開啟才載班次（版本×方案；切版本才換檔）。
  useEffect(() => {
    if (!visible || !userId || view !== "replay") { setReplayTrips(null); return; }
    let cancelled = false;
    setReplayTrips(null); // 換版本／方案：不沿用舊班次
    loadBusCrowdingReplayTrips(controls.version, controls.scenario, busCrowdingSimAuth(userId)).then((trips) => {
      if (!cancelled) setReplayTrips(trips);
    }).catch((error: unknown) => {
      if (cancelled) return;
      reportBusCrowdingLoadError("replay trips", error);
    });
    return () => { cancelled = true; };
  }, [visible, userId, view, controls.version, controls.scenario]);

  // 時間回放：訂閱 scoped 時鐘（不接 timeStore、不進 React state），模擬時間每變 30 秒重算路段當下負載。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || view !== "replay" || !geometry || !replayTrips) return;
    if (map.getLayer(IDS.hit)) map.setLayoutProperty(IDS.hit, "visibility", "none");
    const index = busCrowdingSimIndexStore.get();
    if (!index) return;
    let lastT = Number.NEGATIVE_INFINITY;
    const update = () => {
      const T = busCrowdingSimClock.get();
      if (Math.abs(T - lastT) < REPLAY_SEGMENT_STEP_S) return;
      lastT = T;
      const next = withReplayClasses(geometry, currentSegmentClasses(replayTrips, T, index, geometry.features.length));
      latestFeatures.current = next;
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(next);
    };
    update();
    return busCrowdingSimClock.subscribe(update);
  }, [mapRef, mapTick, visible, view, geometry, replayTrips, mountRevision]);
}
