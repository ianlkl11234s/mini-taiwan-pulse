/**
 * 英國列車重播（倫敦與東南部，前一日 Darwin）：Mapbox 平面移動點圖層。
 *
 * - 位置：`data/gbRailReplay.ts` 純函式依時間內插（SCHEMA §5），每次只算 5 分鐘桶內的候選班次。
 * - 時間（平滑）：重播模式 timeStore 每幀都 tick → 每幀用該幀的值畫一次；直播模式 1 秒一 tick → 圖層自己的 requestAnimationFrame 迴圈用 GbRailTickClock
 *   在 tick 之間外推每幀的模擬時間（暫停不外推、拖時間軸直接跳），每幀重算位置並 setData——資料層 lerp，
 *   不靠 CSS／GL transition。模擬時間沒變（暫停）就不送 setData。currentTime 不進任何 React deps（§8）。
 * - 位置（比照公車 progress-based，docs/features/bus/design.md §2–3）：狀態是「沿整班路徑的距離」，位置一律由折線插值；
 *   首站前／終點後 60 秒淡入淡出（同 BusEngine FADE_SECONDS）。GbRailSmoother（同 BusScene smoothFactor 0.15、
 *   以實際經過時間計算）把資料跳動、停站↔行駛、路段接縫等不連續吸收成殘差，沿鐵軌約 0.3 秒滑過去；拖時間軸才直接跳。
 * - 畫法：圓點沿用台鐵平面模式樣式（flatMovingCirclePaint）；z≥11 行駛中的車加一段沿鐵軌的尾巴指出行進方向
 *   （不用 symbol 箭頭：symbol 每幀重新排版，z≥12 實測掉到 33 fps；line 尾巴維持約 60 fps）。
 *   底下淡畫鐵軌路網；點選的班次畫整條路徑。顏色依「目前所在路段前一點」的誤點分級，沒有欄位時單色。
 * - 本檔不改共用的 flatMovingController／FlatMovingKind。
 */
import { useEffect } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../../lib/loadingRegistry";
import { useSideClock } from "../../state/sideClock";
import { flatMovingCirclePaint } from "../../map/flatMovingLayers";
import { LINE_OPACITY, lineWidthExpr } from "../../map/mapStyleScale";
import {
  GB_RAIL_ATTRIBUTION_SHORT, GB_RAIL_COLOR, GB_RAIL_SELECTED_COLOR, GB_RAIL_TRACK_COLOR,
  GB_RAIL_TAIL_M, GbRailSmoother, GbRailTickClock, candidateTrips, gbRailBuildTripPath, gbRailCurrentDelay, gbRailDelayColor,
  gbRailPathPoint, gbRailReplayTime, gbRailTripPath, gbRailTripProgress,
  type GbRailReplayData,
} from "./gbRailReplay";
import { clearGbRailReplayCache, loadGbRailReplay } from "./gbRailReplayLoader";
import { registerOwnerGateReset } from "../../lib/ownerGateRevoke";
import { useMapReadyTick } from "../../hooks/useMapReadyTick";

export const GB_RAIL_REPLAY_IDS = {
  trackSource: "gb-rail-replay-tracks",
  track: "gb-rail-replay-tracks-line",
  routeSource: "gb-rail-replay-route",
  route: "gb-rail-replay-route-line",
  trainSource: "gb-rail-replay-trains",
  circle: "gb-rail-replay-trains-circle",
  tailSource: "gb-rail-replay-tails",
  tail: "gb-rail-replay-tails-line",
} as const;

// 切片只到 z14：每次 setData 重切的張數比預設 z18 少；z14 以上放大時座標格點 ≤0.5 px（z17），不會一格一格跳
// （z10 實測在 z16 量化成 4 px 一格，肉眼可見）
const MOVING_SOURCE_OPTS = { maxzoom: 14, buffer: 16, tolerance: 0.05 } as const;

/** 尾巴從這個 zoom 起畫（更遠時尾巴短於 1–2 px）。 */
const TAIL_MIN_ZOOM = 11;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// ── 選取（popup 開著＝高亮該班整條路徑；由 GbRailReplayPanel 設定）────────
let selectedRid: string | null = null;
const selectionListeners = new Set<() => void>();
export function setGbRailReplaySelection(rid: string | null): void {
  if (selectedRid === rid) return;
  selectedRid = rid;
  for (const cb of selectionListeners) cb();
}

/** 首次畫上地圖才接 keepLoadingUntilMapIdle（放模組層：拉滑桿 effect 重跑不再重複觸發載入條）。 */
let renderedOnce = false;

/**
 * 某個重播時刻的在線列車：點（circle）＋尾巴（line）GeoJSON。
 * 比照公車 progress-based：位置＝路徑距離經折線插值；有 smoother 時套顯示平滑（跳動沿鐵軌滑過去）。
 */
export function gbRailReplayFeatures(
  data: GbRailReplayData, replayT: number,
  smooth?: { smoother: GbRailSmoother; frame: { keep: number; simDelta: number } },
): { points: GeoJSON.FeatureCollection<GeoJSON.Point>; tails: GeoJSON.FeatureCollection<GeoJSON.LineString> } {
  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const tails: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const alive = new Set<string>();
  for (const i of candidateTrips(data, replayT)) {
    const trip = data.trips[i]!;
    const pr = gbRailTripProgress(trip, data.geometry, replayT);
    if (!pr || pr.alpha <= 0) continue;
    alive.add(trip.rid);
    const path = gbRailBuildTripPath(trip, data.geometry);
    const dist = smooth ? smooth.smoother.displayDist(trip.rid, pr.dist, smooth.frame) : pr.dist;
    const pt = gbRailPathPoint(path, dist, pr.dwelling ? 0 : GB_RAIL_TAIL_M);
    // 顏色可以直接換（站主同意），位置一律連續
    const color = data.hasDelay ? gbRailDelayColor(gbRailCurrentDelay(trip, pr.idx)) : GB_RAIL_COLOR;
    const alpha = pr.alpha * (pr.fallback ? 0.6 : 1);
    // 停站與行駛同樣大小（站主決定；tier 固定 moving，停站以「沒有尾巴」區分）。不帶 bearing：flatMovingCirclePaint 在 z≥12 會把有 bearing 的圓點藏起來（給箭頭用），這裡一律畫圓點
    points.push({ type: "Feature", geometry: { type: "Point", coordinates: [pt.lng, pt.lat] }, properties: { key: trip.rid, color, tier: "moving", dwelling: pr.dwelling, alpha } });
    if (pt.tail) tails.push({ type: "Feature", geometry: { type: "LineString", coordinates: pt.tail }, properties: { color, alpha } });
  }
  smooth?.smoother.retain(alive);
  return { points: { type: "FeatureCollection", features: points }, tails: { type: "FeatureCollection", features: tails } };
}

function trackFeatures(data: GbRailReplayData): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.geometry.lines.map((l) => ({
      type: "Feature", properties: { fb: l.fb }, geometry: { type: "LineString", coordinates: l.g },
    })),
  };
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

/** 尾巴：色同列車、寬隨大小滑桿、透明度 L-4 標準 × 透明度滑桿 × fallback 淡化。 */
function tailPaint(scale: number, op: number) {
  return {
    "line-color": ["get", "color"],
    "line-width": ["interpolate", ["linear"], ["zoom"], TAIL_MIN_ZOOM, 2 * scale, 14, 4 * scale],
    "line-opacity": ["*", ["get", "alpha"], LINE_OPACITY.standard * op],
  };
}

export function useGbRailReplayLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  scale: number,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  // 掛在並排右圖時讀右側時鐘（當地同時刻＝倫敦同一個牆上鐘點；state/sideClock.ts）
  const sideClock = useSideClock();

  // 站主限定（manifest OWNER_ONLY）：撤權時清掉私人資料快取；圖層由 App lockedKeys 關掉後走下面 !visible 分支移除 source
  useEffect(() => registerOwnerGateReset(["gbRailReplay"], () => clearGbRailReplayCache()), []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ids = GB_RAIL_REPLAY_IDS;
    const allLayers = [ids.track, ids.route, ids.tail, ids.circle];
    if (!visible) {
      for (const id of allLayers) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [ids.trackSource, ids.routeSource, ids.tailSource, ids.trainSource]) if (map.getSource(id)) map.removeSource(id);
      renderedOnce = false;
      return;
    }

    let disposed = false;
    let data: GbRailReplayData | null = null;
    let raf = 0;
    let routeRid: string | null | undefined; // undefined＝尚未送過（mount／換底圖後重送）
    let lastRenderedT = Number.NaN;
    let lastRenderedFrame = Number.NaN;
    let dirty = true; // 參數、選取、換底圖 → 即使時間沒變也重送
    const clock = new GbRailTickClock();
    const smoother = new GbRailSmoother();
    clock.tick(sideClock.getTime(), performance.now()); // 初值；之後由訂閱更新
    const op = clamp01(opacity);
    const theme = isDarkTheme ? "dark" : "light";

    const mount = () => {
      if (!data) return;
      if (!map.getSource(ids.trackSource)) map.addSource(ids.trackSource, { type: "geojson", data: trackFeatures(data), attribution: GB_RAIL_ATTRIBUTION_SHORT });
      if (!map.getSource(ids.routeSource)) map.addSource(ids.routeSource, { type: "geojson", data: EMPTY });
      if (!map.getSource(ids.tailSource)) map.addSource(ids.tailSource, { type: "geojson", data: EMPTY, ...MOVING_SOURCE_OPTS });
      if (!map.getSource(ids.trainSource)) map.addSource(ids.trainSource, { type: "geojson", data: EMPTY, ...MOVING_SOURCE_OPTS });
      if (!map.getLayer(ids.track)) {
        map.addLayer({
          id: ids.track, type: "line", source: ids.trackSource,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": GB_RAIL_TRACK_COLOR[theme],
            "line-width": lineWidthExpr("thin") as never,
            "line-opacity": LINE_OPACITY.grid * op,
          },
        });
      }
      if (!map.getLayer(ids.route)) {
        map.addLayer({
          id: ids.route, type: "line", source: ids.routeSource,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": GB_RAIL_SELECTED_COLOR[theme], "line-width": lineWidthExpr("emphasis") as never, "line-opacity": LINE_OPACITY.standard * op },
        });
      }
      if (!map.getLayer(ids.tail)) {
        map.addLayer({
          id: ids.tail, type: "line", source: ids.tailSource, minzoom: TAIL_MIN_ZOOM,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: tailPaint(scale, op) as never,
        });
      }
      if (!map.getLayer(ids.circle)) {
        map.addLayer({ id: ids.circle, type: "circle", source: ids.trainSource, paint: flatMovingCirclePaint(isDarkTheme, scale, op) as never });
      }
      routeRid = undefined;
      dirty = true;
    };

    // frameMs＝RAF 幀時間戳：useTimeline 也用同一個時間戳推進 timeStore，兩個 RAF 誰先跑都算出同一個模擬時間
    const update = (frameMs: number = performance.now()) => {
      if (disposed || !data) return;
      const src = map.getSource(ids.trainSource) as GeoJSONSource | undefined;
      if (!src) return;
      const simT = clock.now(frameMs);
      if (!Number.isFinite(simT)) return;
      if (!dirty && frameMs === lastRenderedFrame) return; // 這一幀畫過了（訂閱端與迴圈不重複 setData）
      if (!dirty && simT === lastRenderedT && routeRid === selectedRid && !smoother.settling()) return;
      lastRenderedFrame = frameMs;
      dirty = false;
      lastRenderedT = simT;
      const replayT = gbRailReplayTime(simT, data.serviceDate);
      // 平滑以「重播資料時間」為準（時間軸跨英國 04:00 會跳一天，視為 seek 直接跳）
      const frame = smoother.beginFrame(replayT, frameMs);
      const fc = gbRailReplayFeatures(data, replayT, { smoother, frame });
      src.setData(fc.points);
      (map.getSource(ids.tailSource) as GeoJSONSource | undefined)?.setData(fc.tails);
      const route = map.getSource(ids.routeSource) as GeoJSONSource | undefined;
      if (route && routeRid !== selectedRid) {
        routeRid = selectedRid;
        const trip = selectedRid ? data.trips.find((t) => t.rid === selectedRid) : undefined;
        route.setData(trip ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: gbRailTripPath(trip, data.geometry) } }] } : EMPTY);
      }
      if (!renderedOnce) {
        renderedOnce = true;
        keepLoadingUntilMapIdle(map, "gb-rail-replay:render", "英國列車重播渲染中", ids.trainSource);
      }
    };

    // 每幀迴圈（頁面隱藏時瀏覽器自動暫停 RAF）
    const loop = (frameMs: number) => {
      raf = 0;
      if (disposed) return;
      if (!clock.awaitingTick(frameMs)) update(frameMs);
      raf = requestAnimationFrame(loop);
    };
    const markDirty = () => { dirty = true; };

    // tick 的時間取「目前這一幀」的時間戳（在 RAF 內＝useTimeline 推進時用的 now），與 loop 的 frameMs 同一把尺
    const frameNow = () => {
      const c = typeof document !== "undefined" ? document.timeline?.currentTime : null;
      return typeof c === "number" ? c : performance.now();
    };
    const unsubTime = sideClock.subscribe((t) => {
      const now = frameNow();
      clock.tick(t, now);
      // 每幀 tick（重播）：這一幀若 loop 已先跑過（拿到舊值），由這裡用新值補畫；同值會在 update 內略過
      if (clock.perFrame()) update(now);
    });
    selectionListeners.add(markDirty);
    map.on("style.load", mount);

    loadGbRailReplay().then((d) => {
      if (disposed) return;
      data = d;
      mount();
      if (!raf) raf = requestAnimationFrame(loop);
    }).catch((err) => {
      // 非站主（401／403）本來就讀不到，不算錯誤；其他錯誤由 ownerDataStatus 記錄並在 console 留底
      const status = (err as { status?: number } | null)?.status;
      if (status !== 401 && status !== 403) console.error("[gbRailReplay] 載入失敗", err);
    });

    // 參數／主題改變（effect 重跑）時，圖層若已存在就直接改 paint
    if (map.getLayer(ids.circle)) {
      for (const [k, v] of Object.entries(flatMovingCirclePaint(isDarkTheme, scale, op))) map.setPaintProperty(ids.circle, k as never, v as never);
      for (const [k, v] of Object.entries(tailPaint(scale, op))) map.setPaintProperty(ids.tail, k as never, v as never);
      map.setPaintProperty(ids.track, "line-opacity", LINE_OPACITY.grid * op);
      map.setPaintProperty(ids.track, "line-color", GB_RAIL_TRACK_COLOR[theme]);
      map.setPaintProperty(ids.route, "line-opacity", LINE_OPACITY.standard * op);
      map.setPaintProperty(ids.route, "line-color", GB_RAIL_SELECTED_COLOR[theme]);
    }

    return () => {
      disposed = true;
      unsubTime();
      selectionListeners.delete(markDirty);
      map.off("style.load", mount);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mapRef, visible, opacity, scale, isDarkTheme, mapTick, sideClock]);
}
