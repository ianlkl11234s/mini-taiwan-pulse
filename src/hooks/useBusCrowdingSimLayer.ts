import { useEffect, useRef, useState } from "react";
import type { LineLayer, Map as MapboxMap } from "mapbox-gl";
import {
  BUS_CROWDING_SIM_KEY, BUS_CROWDING_SIM_LAYER_IDS, BUS_CROWDING_SIM_SOURCE_ID,
  busCrowdingColorExpression, busCrowdingOpacityExpression,
  type BusCrowdingScenario, type BusCrowdingScenarioData, type BusCrowdingVersion,
} from "../data/busCrowdingSimTypes";
import { loadBusCrowdingScenario, loadBusCrowdingSegments } from "../data/busCrowdingSimLoader";
import { buildSegmentIndex, busCrowdingSimIndexStore, busCrowdingSimScenarioStore } from "../data/busCrowdingSimStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { LINE_DASH, LINE_OPACITY, lineWidthExpr } from "../map/mapStyleScale";
import { hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { useMapReadyTick } from "./useMapReadyTick";

export interface BusCrowdingSimControls { version: BusCrowdingVersion; scenario: BusCrowdingScenario }

const IDS = BUS_CROWDING_SIM_LAYER_IDS;
const SRC = BUS_CROWDING_SIM_SOURCE_ID;
const KEY = BUS_CROWDING_SIM_KEY;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 推估路段：L-1 標準線寬、L-2 [2,2] 虛線、L-4 標準透明度 × 滑桿；0 級淡化、班次 < 5 不畫（feature-state）。 */
const linePaint = (opacity: number) => ({
  "line-color": busCrowdingColorExpression(),
  "line-width": lineWidthExpr("standard"),
  "line-opacity": busCrowdingOpacityExpression(clamp(opacity) * LINE_OPACITY.standard),
  "line-dasharray": [...LINE_DASH.general],
});

/** 全部 style layer（初始 visibility none）；匯出供測試做 style-spec 驗證。 */
export function buildBusCrowdingSimLayers(opacity: number): LineLayer[] {
  const hidden = { visibility: "none" as const };
  const paint = linePaint(opacity);
  return [
    { id: IDS.line, type: "line", source: SRC, layout: { ...hidden, ...hookLineLayout(KEY, IDS.line) }, paint: hookLinePaint(KEY, IDS.line, paint, linePaint(1)) },
    { id: IDS.hit, type: "line", source: SRC, layout: hidden, paint: { "line-color": "#000000", "line-width": 14, "line-opacity": 0 } },
  ] as unknown as LineLayer[];
}

function removeAll(map: MapboxMap) {
  for (const id of [IDS.hit, IDS.line]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* style replaced */ }
}

/** 依目前版本寫 feature-state（id＝feature 順序）；回傳寫入筆數。state 不依賴 tile 載入；換底圖後靠 mountRevision 重套。 */
export function applyBusCrowdingState(
  map: Pick<MapboxMap, "getSource" | "setFeatureState">, data: BusCrowdingScenarioData | null, version: BusCrowdingVersion,
): number {
  if (!data || !map.getSource(SRC)) return 0;
  const { ov, n } = data.values[version];
  try {
    for (let i = 0; i < ov.length; i++) map.setFeatureState({ source: SRC, id: i }, { ov: ov[i] ?? -1, n: n[i] ?? 0 });
    return ov.length;
  } catch {
    return 0;
  }
}

/** 公開 TDX 衍生的模擬結果（站主限定只做 UI 鎖）：一個 GeoJSON source＋虛線＋命中層。 */
export function useBusCrowdingSimLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: BusCrowdingSimControls,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [geometry, setGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [data, setData] = useState<BusCrowdingScenarioData | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const latestOpacity = useRef(opacity);
  latestOpacity.current = opacity;

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
        map.addSource(SRC, { type: "geojson", data: geometry });
        keepLoadingUntilMapIdle(map, `${SRC}:render`, "公車擁擠模擬路段繪製中", SRC);
      }
      for (const layer of buildBusCrowdingSimLayers(latestOpacity.current)) if (!map.getLayer(layer.id)) map.addLayer(layer);
      for (const id of [IDS.line, IDS.hit]) map.setLayoutProperty(id, "visibility", "visible");
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, geometry, mapTick]);

  // 關閉圖層時拆掉（mount effect 只在 visible 變 false 時跑 removeAll 一次）。
  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 透明度：只換 paint，不重建 source。
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.getLayer(IDS.line)) return;
    map.setPaintProperty(IDS.line, "line-opacity", hookLinePaint(KEY, IDS.line, linePaint(opacity), linePaint(1))["line-opacity"] as never);
  }, [mapRef, mapTick, opacity, mountRevision]);

  // 版本／方案：只換 feature-state，不重載幾何（換底圖後 state 全丟，靠 mountRevision 重套）。
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible) return;
    applyBusCrowdingState(map, data, controls.version);
  }, [mapRef, mapTick, visible, data, controls.version, mountRevision]);
}
