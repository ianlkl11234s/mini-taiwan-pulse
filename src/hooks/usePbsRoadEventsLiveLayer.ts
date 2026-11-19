import { useEffect, useRef, useState } from "react";
import type { CircleLayer, ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";
import { isAccessDenied } from "../lib/layerGates";
import { registerOwnerGateReset } from "../lib/ownerGateRevoke";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { wallClock } from "../state/timeStore";
import { pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import {
  buildPbsDisplay,
  fetchPbsRoadEventsLive,
  isMissingRpc,
  normalizePbs,
  setPbsSnapshot,
} from "../data/liveIncidentsLoader";
import { LIVE_INCIDENT_POLL_MS, PBS_CATEGORY_COLOR, PBS_CLEARED_COLOR } from "../data/liveIncidentsTypes";

/**
 * 警廣即時路況（pbsRoadEventsLive，站主限定）。
 *
 * 當下快照圖層：開著時每分鐘重抓 get_pbs_road_events_live（mig 555），不接時間軸。
 * 點依類別（事故黃、其他灰），狀態「已排除」灰化（站主 2026-11-16 決策 9）。
 * 座標精度不一（約 2.6% 只到約 1 km），無座標的列不上圖、在圖例計數。
 */

const SRC = "pbs-road-events-live";
export const PBS_LAYER_POINT = "pbs-road-events-live-point";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type PbsRawData = ReturnType<typeof normalizePbs>;
let cache: PbsRawData | null = null;
let generation = 0;
let missingRpcLogged = false;

const color = [
  "case", ["==", ["get", "status"], "cleared"], PBS_CLEARED_COLOR,
  ["match", ["get", "category"], "traffic_incident", PBS_CATEGORY_COLOR.traffic_incident, PBS_CATEGORY_COLOR.other],
] as unknown as ExpressionSpecification;

function paint(isDark: boolean, scale: number, o: number) {
  const stroke = pointStrokePaint(isDark, o);
  return {
    "circle-radius": ["case", ["==", ["get", "category"], "traffic_incident"], pointRadius("M", scale), pointRadius("S", scale)] as unknown as ExpressionSpecification,
    "circle-color": color,
    "circle-opacity": ["case", ["==", ["get", "status"], "cleared"], 0.45 * o, 0.9 * o] as unknown as ExpressionSpecification,
    ...stroke,
  };
}

export function usePbsRoadEventsLiveLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opts: { opacity: number; scale: number; windowMin: number; isDark: boolean },
) {
  const { opacity, scale, windowMin, isDark } = opts;
  const mapTick = useMapReadyTick(mapRef, visible);
  // 樣式走 ref：建層（含換底圖 style.load 重建）用當下值，不把樣式放進建層 effect deps
  const styleRef = useRef({ opacity, scale, isDark });
  styleRef.current = { opacity, scale, isDark };
  const [raw, setRaw] = useState<PbsRawData | null>(cache);

  useEffect(() => registerOwnerGateReset(["pbsRoadEventsLive"], () => {
    generation += 1;
    cache = null;
    setRaw(null);
    setPbsSnapshot(null);
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(PBS_LAYER_POINT)) map.removeLayer(PBS_LAYER_POINT);
    if (map.getSource(SRC)) map.removeSource(SRC);
  }), [mapRef, mapTick]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const gen = generation;
    const load = () => {
      fetchPbsRoadEventsLive()
        .then((d) => {
          if (cancelled || gen !== generation) return;
          cache = normalizePbs(d);
          setRaw(cache);
        })
        .catch((err: unknown) => {
          if (cancelled || isAccessDenied(err)) return;
          if (isMissingRpc(err)) {
            if (!missingRpcLogged) console.info("[PbsRoadEventsLive] get_pbs_road_events_live 尚未部署，圖層暫無資料");
            missingRpcLogged = true;
            return;
          }
          console.warn("[PbsRoadEventsLive] load failed:", err);
        });
    };
    load();
    const id = window.setInterval(load, LIVE_INCIDENT_POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(PBS_LAYER_POINT)) map.setLayoutProperty(PBS_LAYER_POINT, "visibility", "none");
      return;
    }
    if (!raw) return;
    let lastSig: string | null = null; // 哨兵：空結果的 signature 也是 ""，不能當初值
    let first = true;
    const apply = () => {
      if (!map.getSource(SRC)) map.addSource(SRC, { type: "geojson", data: EMPTY });
      if (!map.getLayer(PBS_LAYER_POINT)) {
        map.addLayer({ id: PBS_LAYER_POINT, type: "circle", source: SRC, paint: paint(styleRef.current.isDark, styleRef.current.scale, Math.max(0, Math.min(1, styleRef.current.opacity))) } as CircleLayer);
      }
      map.setLayoutProperty(PBS_LAYER_POINT, "visibility", "visible");
      const d = buildPbsDisplay(raw, wallClock.getWallNow(), windowMin);
      setPbsSnapshot({ total: d.total, unmapped: d.unmapped, truncated: raw.truncated });
      if (d.signature === lastSig) return;
      lastSig = d.signature;
      (map.getSource(SRC) as GeoJSONSource).setData(d.fc);
      if (first) {
        first = false;
        keepLoadingUntilMapIdle(map, "pbs:render", "警廣即時路況 渲染中", SRC);
      }
    };
    apply();
    const onStyleLoad = () => { lastSig = null; setTimeout(apply, 0); };
    map.on("style.load", onStyleLoad);
    const unsub = wallClock.subscribeWallClock(60_000, apply);
    return () => { unsub(); map.off("style.load", onStyleLoad); };
    // 樣式由下一個 effect 更新，不進這裡的 deps（避免拖滑桿時重建）
  },[mapRef, mapTick, visible, raw, windowMin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(PBS_LAYER_POINT)) return;
    const o = Math.max(0, Math.min(1, opacity));
    for (const [k, v] of Object.entries(paint(isDark, scale, o))) map.setPaintProperty(PBS_LAYER_POINT, k as never, v as never);
  }, [mapRef, mapTick, visible, raw, opacity, scale, isDark]);
}
