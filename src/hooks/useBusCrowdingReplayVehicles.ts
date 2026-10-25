/**
 * 公車擁擠模擬「時間回放」的車點（另開 hook；不動 useBusLayer／BusScene，它們吃真實 GPS）。
 *
 * - 平面畫法照 map-layers G-1 R6 段 3（圓點 L 6.5px、對比描邊；z ≥ 12 有方向的車換 SDF 方向箭頭），
 *   paint／layout 直接用 `flatMovingLayers.ts` 的同一組函式。**不做立體**（R6「移動物件預設立體」的偏離，待使用者決定）。
 * - 顏色＝與路段同一組四級（0 級中性灰、1–3 級 viridis；`busCrowdingColors`），語意是車上負載分級
 *   （未滿五成／五至八成／八成到滿載／超載，門檻照原型 index.html:150）。
 * - 位置：純函式 `replayTripState` 依模擬時刻內插（資料內插，不用 CSS／GL transition）。
 * - 更新：訂閱 scoped 時鐘（10Hz 通知）→ requestAnimationFrame 合併 → GeoJSON setData；
 *   不接 timeStore、模擬時刻不進 React state（CLAUDE.md §6 精神）。
 * - 23 條非單調線、s3（無幾何）的班次：lines.json 為 null → 不畫。
 */
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { type BusCrowdingScenario, type BusCrowdingVersion } from "../data/busCrowdingSimTypes";
import { busCrowdingColors } from "../data/busCrowdingSimStyle";
import { loadBusCrowdingReplayLines, loadBusCrowdingReplayTrips } from "../data/busCrowdingSimLoader";
import { busCrowdingSimReplayStore } from "../data/busCrowdingSimStore";
import { replayTripState, type ReplayLine, type ReplayTrip } from "../data/busCrowdingReplay";
import {
  FLAT_ARROW_IMAGE, FLAT_ARROW_MIN_ZOOM, ensureArrowImage, flatMovingArrowLayout, flatMovingArrowPaint, flatMovingCirclePaint,
} from "../map/flatMovingLayers";
import { busCrowdingSimClock } from "../state/busCrowdingSimClock";
import { useMapReadyTick } from "./useMapReadyTick";
import { busCrowdingSimAuth } from "./useBusCrowdingSimPrivateAccess";
import { reportBusCrowdingLoadError } from "./useBusCrowdingSimLayer";

export const BUS_CROWDING_VEHICLE_IDS = {
  source: "bus-crowding-sim-veh",
  circle: "bus-crowding-sim-veh-circle",
  arrow: "bus-crowding-sim-veh-arrow",
} as const;
const IDS = BUS_CROWDING_VEHICLE_IDS;
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
/** 0 級車點的淡化係數（乘 P-3 主體透明度）。 */
export const BUS_REPLAY_ZERO_ALPHA = 0.5;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** 每 tick 的耗時與車數（開發版放在 window 給驗收讀）。 */
export interface ReplayVehicleStats { ticks: number; lastMs: number; maxMs: number; totalMs: number; vehicles: number; peakVehicles: number; peakAt: number }

/** 某時刻在場的車 → GeoJSON（props 同 flatMovingLayers：key、color、tier、alpha、bearing；另帶 tid 給 popup）。 */
export function replayVehicleFeatures(
  trips: readonly ReplayTrip[], lines: readonly (ReplayLine | null)[], T: number, isDark: boolean,
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const colors = busCrowdingColors(isDark);
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const trip of trips) {
    const line = lines[trip.l];
    if (!line) continue;
    const st = replayTripState(trip, line, T);
    if (!st) continue;
    // 規格未定的取捨（回報列出）：0 級（未滿五成）用 M 尺寸＋半透明退到背景，1–3 級 L 尺寸；高級疊在上面（sort key）
    const zero = st.cls === 0;
    const props: Record<string, unknown> = {
      key: trip.id, tid: trip.id, cls: st.cls, color: colors[st.cls] ?? colors[0],
      tier: zero ? "parked" : "moving", alpha: zero ? BUS_REPLAY_ZERO_ALPHA : 1,
    };
    if (st.bearing !== null) props.bearing = st.bearing;
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [st.lng, st.lat] }, properties: props });
  }
  return { type: "FeatureCollection", features };
}

function removeAll(map: MapboxMap) {
  for (const id of [IDS.arrow, IDS.circle]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(IDS.source)) map.removeSource(IDS.source); } catch { /* style replaced */ }
}

function ensureLayers(map: MapboxMap, opacity: number, isDark: boolean) {
  ensureArrowImage(map);
  if (!map.getSource(IDS.source)) map.addSource(IDS.source, { type: "geojson", data: EMPTY });
  if (!map.getLayer(IDS.circle)) {
    map.addLayer({ id: IDS.circle, type: "circle", source: IDS.source, layout: { "circle-sort-key": ["get", "cls"] }, paint: flatMovingCirclePaint(isDark, 1, opacity) });
  }
  if (!map.getLayer(IDS.arrow)) {
    map.addLayer({
      id: IDS.arrow, type: "symbol", source: IDS.source, minzoom: FLAT_ARROW_MIN_ZOOM, filter: ["has", "bearing"],
      layout: { ...flatMovingArrowLayout(1), "icon-image": FLAT_ARROW_IMAGE, "symbol-sort-key": ["get", "cls"] }, paint: flatMovingArrowPaint(isDark, opacity),
    });
  }
}

export function useBusCrowdingReplayVehicles(
  mapRef: React.RefObject<MapboxMap | null>,
  active: boolean,
  opacity: number,
  version: BusCrowdingVersion,
  scenario: BusCrowdingScenario,
  isDark: boolean,
  /** 已驗證的站主帳號；null 就不抓私人資料。 */
  userId: string | null = null,
) {
  const mapTick = useMapReadyTick(mapRef, active);
  const [data, setData] = useState<{ trips: ReplayTrip[]; lines: (ReplayLine | null)[] } | null>(null);
  const [mountRevision, setMountRevision] = useState(0);
  const latest = useRef({ opacity, isDark });
  latest.current = { opacity: clamp(opacity), isDark };

  // 資料：回放開著才載（線形一次、班次依版本×方案）。
  useEffect(() => {
    if (!active || !userId) { setData(null); busCrowdingSimReplayStore.set(null); return; }
    let cancelled = false;
    const auth = busCrowdingSimAuth(userId);
    Promise.all([loadBusCrowdingReplayLines(auth), loadBusCrowdingReplayTrips(version, scenario, auth)]).then(([lines, trips]) => {
      if (cancelled) return;
      setData({ trips, lines });
      busCrowdingSimReplayStore.set({ trips, lines, byId: new Map(trips.map((t) => [t.id, t])) });
    }).catch((error: unknown) => reportBusCrowdingLoadError("replay", error));
    return () => { cancelled = true; };
  }, [active, userId, version, scenario]);

  // 圖層：關閉就拆；換底圖（style.load）重建。
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!active) { removeAll(map); return; }
      ensureLayers(map, latest.current.opacity, latest.current.isDark);
      // 車點永遠疊在路段上面（路段層可能晚於本 hook 建立）
      for (const id of [IDS.circle, IDS.arrow]) if (map.getLayer(id)) map.moveLayer(id);
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, active, mapTick]);
  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 透明度／底圖明暗：只換 paint（車色在下一個 tick 依主題重算）。
  useEffect(() => {
    const map = mapRef.current; if (!map || !map.getLayer(IDS.circle)) return;
    const o = clamp(opacity);
    for (const [k, v] of Object.entries(flatMovingCirclePaint(isDark, 1, o))) map.setPaintProperty(IDS.circle, k as never, v as never);
    for (const [k, v] of Object.entries(flatMovingArrowPaint(isDark, o))) map.setPaintProperty(IDS.arrow, k as never, v as never);
  }, [mapRef, mapTick, opacity, isDark, mountRevision]);

  // 每 tick：時鐘通知 → RAF 合併 → setData。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active || !data) return;
    const stats: ReplayVehicleStats = { ticks: 0, lastMs: 0, maxMs: 0, totalMs: 0, vehicles: 0, peakVehicles: 0, peakAt: 0 };
    if (import.meta.env.DEV) (window as unknown as { __busCrowdingReplayStats?: ReplayVehicleStats }).__busCrowdingReplayStats = stats;
    let raf: number | null = null;
    const draw = () => {
      raf = null;
      const source = map.getSource(IDS.source) as GeoJSONSource | undefined;
      if (!source) return;
      const started = performance.now();
      const T = busCrowdingSimClock.get();
      const fc = replayVehicleFeatures(data.trips, data.lines, T, latest.current.isDark);
      source.setData(fc);
      const ms = performance.now() - started;
      stats.ticks++; stats.lastMs = ms; stats.totalMs += ms; stats.maxMs = Math.max(stats.maxMs, ms);
      stats.vehicles = fc.features.length;
      if (fc.features.length > stats.peakVehicles) { stats.peakVehicles = fc.features.length; stats.peakAt = T; }
    };
    const schedule = () => { if (raf === null) raf = requestAnimationFrame(draw); };
    draw();
    const unsubscribe = busCrowdingSimClock.subscribe(schedule);
    return () => { unsubscribe(); if (raf !== null) cancelAnimationFrame(raf); };
  }, [mapRef, mapTick, active, data, isDark, mountRevision]);
}
