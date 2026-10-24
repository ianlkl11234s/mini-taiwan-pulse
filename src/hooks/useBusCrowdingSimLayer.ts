import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  BUS_CROWDING_SIM_KEY, BUS_CROWDING_SIM_LAYER_IDS, BUS_CROWDING_SIM_SOURCE_ID,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingVersion,
} from "../data/busCrowdingSimTypes";
import {
  BUS_CROWDING_DRAWN_FILTER, BUS_CROWDING_SORT_KEY,
  busCrowdingColorExpression, busCrowdingOpacityExpression, busCrowdingWidthExpression,
} from "../data/busCrowdingSimStyle";
import { loadBusCrowdingScenario, loadBusCrowdingSegments } from "../data/busCrowdingSimLoader";
import { buildSegmentIndex, busCrowdingSimIndexStore, busCrowdingSimScenarioStore } from "../data/busCrowdingSimStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { useMapReadyTick } from "./useMapReadyTick";

export interface BusCrowdingSimControls { version: BusCrowdingVersion; scenario: BusCrowdingScenario }

const IDS = BUS_CROWDING_SIM_LAYER_IDS;
const SRC = BUS_CROWDING_SIM_SOURCE_ID;
const KEY = BUS_CROWDING_SIM_KEY;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 推估路段：實線；有值＝magma 三級＋L-1 標準線寬＋L-4 標準透明度，0 級＝F-2 灰細參考線；滑桿乘透明度。 */
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
      properties: { ...feature.properties, ov: values?.ov[i] ?? -1, t: values?.n[i] ?? 0 },
    })),
  };
}

/** 公開 TDX 衍生的模擬結果（站主限定只做 UI 鎖）：一個 GeoJSON source＋實線＋命中層。 */
export function useBusCrowdingSimLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: BusCrowdingSimControls,
  isDark = true,
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

  // 幾何：第一次開圖層才抓（模組級快取）。
  useEffect(() => {
    if (!visible || geometry) return;
    let cancelled = false;
    loadBusCrowdingSegments().then((fc) => {
      if (cancelled) return;
      busCrowdingSimIndexStore.set(buildSegmentIndex(fc));
      setGeometry(fc);
    }).catch((error: unknown) => console.warn("[bus-crowding-sim] segments load failed", error));
    return () => { cancelled = true; };
  }, [visible, geometry]);

  // 數值：方案換了才抓（兩版一起）；關圖層清掉 popup 用的 store。
  useEffect(() => {
    if (!visible) { setData(null); busCrowdingSimScenarioStore.set(null); return; }
    let cancelled = false;
    loadBusCrowdingScenario(controls.scenario).then((loaded) => {
      if (cancelled) return;
      setData(loaded); busCrowdingSimScenarioStore.set(loaded);
    }).catch((error: unknown) => console.warn("[bus-crowding-sim] values load failed", error));
    return () => { cancelled = true; };
  }, [visible, controls.scenario]);

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
      for (const id of [IDS.line, IDS.hit]) map.setLayoutProperty(id, "visibility", "visible");
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
    const map = mapRef.current; if (!map || !visible || !geometry || !data) return;
    const started = performance.now();
    const next = withBusCrowdingValues(geometry, data, controls.version);
    const built = performance.now();
    latestFeatures.current = next;
    const source = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(next);
    if (import.meta.env?.DEV) console.debug(`[bus-crowding-sim] setData ${next.features.length} features: build ${(built - started).toFixed(1)} ms, setData ${(performance.now() - built).toFixed(1)} ms`);
  }, [mapRef, mapTick, visible, geometry, data, controls.version, mountRevision]);
}
