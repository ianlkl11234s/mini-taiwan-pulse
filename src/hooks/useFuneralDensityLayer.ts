import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, FillLayer, LineLayer } from "mapbox-gl";
import { fetchFuneralDensity, type FuneralDensityData } from "../data/funeralDensityLoader";
import { funeralDensityColorExpr, FUNERAL_LAYER_COLORS } from "../data/funeralTypes";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 殯葬禮儀業者「區級密度」面量圖（funeralOperatorDensity）。
 *
 * 資料本身無幾何（5.1 KB 純數值）→ 借用 base_map 的鄉鎮界 PMTiles 當幾何，
 * 用 Mapbox feature-state 把家數掛上去（promoteId: TOWNCODE，8 碼字串）。
 * 通用 overlayRegistry 路徑不支援 promoteId + feature-state 染色，故走專屬 hook
 * （同 useRoadCongestionLayer / useEarthquakeReplayLayer 慣例）。
 *
 * 用**獨立 sourceId**（不與 base_map townshipBoundary 共用）：共用會讓兩層搶
 * promoteId 設定，且對方 toggle 關閉時整包 source 生命週期難以推理。PMTiles 走
 * HTTP Range Request + 邊緣快取，多開一份 source 的成本可接受。
 *
 * feature-state 一次寫完 325 區（不看視窗），Mapbox 會依 source/sourceLayer/id
 * 快取並套到後續載入的 tile —— 不必每次 tile 載入重刷。
 */

const SOURCE_ID = "funeral-density";
const SOURCE_LAYER = "township_boundary";
const SOURCE_URL = "./base_map/township_boundary.pmtiles";
const LAYER_FILL = "funeral-density-fill";
const LAYER_LINE = "funeral-density-line";

/** 底圖之上、地名標籤之下（同 temperatureGridLayerFactory） */
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return undefined;
    for (const l of layers) {
      if (l.type === "symbol") return l.id;
    }
  } catch {
    // setStyle 進行中 getStyle() 會 throw → 當作沒有 beforeId
  }
  return undefined;
}

export function useFuneralDensityLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const dataRef = useRef<FuneralDensityData | null>(null);
  const [dataTick, setDataTick] = useState(0);
  /** mapRef 還沒填時的重試 tick（production 首載 map "load" 可能晚於資料就緒） */
  const [mapRetry, setMapRetry] = useState(0);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  // ── 首次開啟才載資料（5.1 KB，模組級快取）──
  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    fetchFuneralDensity()
      .then((d) => {
        if (cancelled) return;
        if (d.joinKey !== "TOWNCODE") {
          console.warn(`[FuneralDensity] 上游改了 join_key（${d.joinKey}）→ 中止 join`);
          return;
        }
        dataRef.current = d;
        setDataTick((v) => v + 1);
      })
      .catch((err) => console.warn("[FuneralDensity] load failed:", err));
    return () => { cancelled = true; };
  }, [visible]);

  // ── 建層 + 灌 feature-state + 可見性 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      if (!visible) return;
      const timer = setInterval(() => {
        if (mapRef.current) setMapRetry((v) => v + 1);
      }, 200);
      return () => clearInterval(timer);
    }

    if (!visible) {
      for (const id of [LAYER_FILL, LAYER_LINE]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
      return;
    }

    let cancelled = false;
    let stateDone = false;

    /** source + fill/line layers（idempotent，底圖切換後可重呼） */
    const ensureLayers = (): boolean => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE,
          url: SOURCE_URL,
          minzoom: 6,
          maxzoom: 14,
          // feature-state 染色鍵：feature id = TOWNCODE（8 碼字串，同地震回放）
          promoteId: { [SOURCE_LAYER]: "TOWNCODE" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      const before = firstSymbolLayerId(map);
      if (!map.getLayer(LAYER_FILL)) {
        map.addLayer({
          id: LAYER_FILL,
          type: "fill",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          paint: {
            "fill-color": funeralDensityColorExpr(),
            "fill-opacity": opacityRef.current,
          },
        } as unknown as FillLayer, before);
      }
      if (!map.getLayer(LAYER_LINE)) {
        map.addLayer({
          id: LAYER_LINE,
          type: "line",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          paint: {
            "line-color": FUNERAL_LAYER_COLORS.funeralOperatorDensity,
            "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.2, 13, 0.8],
            "line-opacity": opacityRef.current * 0.5,
          },
        } as unknown as LineLayer, before);
      }
      return !!map.getLayer(LAYER_FILL);
    };

    /**
     * 325 區 feature-state 一次寫完。source loaded 後才可靠（未 loaded 時寫入會落空），
     * 之後由 Mapbox 快取套到後續載入的 tile。家數 0 的區不在表內 → 不寫，靠 step 的
     * fallback 落最淺色（語意即「0 家」）。
     */
    const flushState = () => {
      if (cancelled || stateDone) return;
      const d = dataRef.current;
      if (!d || !map.getSource(SOURCE_ID)) return;
      if (!map.isSourceLoaded(SOURCE_ID)) return;
      for (const [townCode, count] of Object.entries(d.values)) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: townCode },
          { operatorCount: count },
        );
      }
      stateDone = true;
    };

    const mount = () => {
      if (cancelled) return;
      if (!ensureLayers()) return;
      for (const id of [LAYER_FILL, LAYER_LINE]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
      }
      flushState();
    };

    mount();

    const onSourceData = () => flushState();
    map.on("sourcedata", onSourceData);

    // 底圖切換 → source/layer/feature-state 全被清掉，重建一次
    const onStyleLoad = () => {
      stateDone = false;
      setTimeout(mount, 0);
    };
    map.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      map.off("sourcedata", onSourceData);
      map.off("style.load", onStyleLoad);
    };
  }, [mapRef, visible, dataTick, mapRetry, mapTick]);

  // ── 透明度 slider ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (map.getLayer(LAYER_FILL)) map.setPaintProperty(LAYER_FILL, "fill-opacity", opacity);
    if (map.getLayer(LAYER_LINE)) map.setPaintProperty(LAYER_LINE, "line-opacity", opacity * 0.5);
  }, [mapRef, visible, opacity, mapTick]);
}
