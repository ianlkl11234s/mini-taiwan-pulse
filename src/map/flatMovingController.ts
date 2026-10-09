/**
 * R6 段 3：移動物件平面模式的每幀更新（台鐵／高鐵列車、垃圾車 GPS）。
 *
 * - 位置：列車讀 `useRailEngine` 每 tick 算好的 activeTrains（含 bearing）；垃圾車用
 *   `data/wasteTruckFrames.ts` 的同一份插值純函式（Three.js 立體版也用它）。
 * - 節流：訂閱 `timeStore.subscribeThrottled(40ms)`（約 25fps）→ requestAnimationFrame 合併 → setData。
 *   暫停播放＝timeStore 不再通知＝不更新；頁面隱藏＝RAF 不跑＝不更新。不把 currentTime 放進任何 deps（規則 6）。
 * - 參數／可見性／資料換 ref／底圖主題：各自的 store 訂閱觸發一次更新（暫停時切開關也立即重畫）。
 * - 點選：`pickFlatTrain`／`pickFlatWasteTruck` 用 Mapbox queryRenderedFeatures，回傳原物件給既有 tooltip／featureInfo。
 * - 只有點選的物件畫近段軌跡（setFlatMovingSelection）。
 */
import type { Map as MapboxMap } from "mapbox-gl";
import type { LayerVisibility, RailTrain } from "../types";
import { WASTE_STATUS_COLORS, type WasteTrailRow } from "../data/wasteLoader";
import { computeWasteTruckFrames, wasteTruckRecentPath, wasteVisualTimeSec, type WasteTruckPlacement } from "../data/wasteTruckFrames";
import { paramDefault } from "../data/layerParamsSpec";
import { layerParamRefs as paramRefs } from "../state/layerParamRefs";
import { layerParamsStore } from "../state/layerParamsStore";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { subscribeThreeRepaint } from "../state/threeRepaintSignal";
import { timeStore } from "../state/timeStore";
import {
  EMPTY_FEATURES, FLAT_MOVING_IDS, applyFlatMovingStyle, ensureFlatMovingLayers, flatMovingPickLayers,
  raiseFlatMovingLayers, removeFlatMovingLayers, setFlatMovingData,
  type FlatMovingKind, type FlatMovingProps, type FlatMovingStyle,
} from "./flatMovingLayers";
import { RAIL_TRACKS_LAYER_ID } from "./railTracks";

/** 平面模式 setData 節流（ms）：約 25fps，數百到 2,500 點的 GeoJSON 更新負擔可接受。 */
export const FLAT_MOVING_THROTTLE_MS = 40;
/** 列車點選軌跡保留的模擬時間（秒），同立體拖尾 3 分鐘。 */
export const RAIL_TRAIL_WINDOW_S = 180;

// ── 純函式（測試用）────────────────────────────────────────

export interface FlatMovingToggleState {
  railTrainVisible: boolean;
  railTrain3D: boolean;
  wasteTruck3D: boolean;
}

/** 哪幾層要畫平面版：圖層開、（列車顯示中）且「立體效果」關。 */
export function resolveFlatMovingActive(vis: LayerVisibility, t: FlatMovingToggleState): Record<FlatMovingKind, boolean> {
  return {
    rail: !!vis.rail && t.railTrainVisible && !t.railTrain3D,
    wasteTruck: !!vis.wasteTruck && !t.wasteTruck3D,
  };
}

export const railTrainKey = (t: RailTrain) => `${t.systemId}-${t.trainId}`;

function pointFeature(lng: number, lat: number, props: FlatMovingProps): GeoJSON.Feature<GeoJSON.Point, FlatMovingProps> {
  if (props.bearing == null) delete props.bearing; // 沒方向就不帶屬性：拉近仍畫圓點（["has","bearing"]）
  return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props };
}

/** 列車 → GeoJSON（色＝train.color，M 階；位置 [0,0] 視為無效，同 RailScene）。 */
export function railFlatFeatures(trains: readonly RailTrain[]): GeoJSON.FeatureCollection<GeoJSON.Point, FlatMovingProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, FlatMovingProps>[] = [];
  for (const t of trains) {
    const [lng, lat] = t.position;
    if (lng === 0 && lat === 0) continue;
    features.push(pointFeature(lng, lat, {
      key: railTrainKey(t), color: t.color, tier: "M", alpha: 1,
      bearing: typeof t.bearing === "number" ? t.bearing : undefined,
    }));
  }
  return { type: "FeatureCollection", features };
}

/** 垃圾車 → GeoJSON（色＝WASTE_STATUS_COLORS；停車／離線 S 階，對應立體版 ×0.6；alpha＝淡入淡出／過期淡化）。 */
export function wasteFlatFeatures(placements: readonly WasteTruckPlacement[]): GeoJSON.FeatureCollection<GeoJSON.Point, FlatMovingProps> {
  return {
    type: "FeatureCollection",
    features: placements.map(({ row, frame, bearing }) => pointFeature(frame.lng, frame.lat, {
      key: row.vehicle_no,
      color: WASTE_STATUS_COLORS[frame.status] ?? WASTE_STATUS_COLORS.unknown,
      tier: frame.status === "parked" || frame.status === "offline" ? "S" : "M",
      alpha: frame.alpha,
      bearing: bearing ?? undefined,
    })),
  };
}

/**
 * 各列車近段位置歷史（只用來畫「點選的那班」的軌跡線，不畫全部拖尾）。
 * 邏輯同 RailScene 的 positionHistory：模擬時間每 0.5 秒最多記一點、超過視窗丟棄、時間跳轉清空。
 */
export class RecentTrackHistory {
  private tracks = new Map<string, Array<[number, number, number]>>();
  private lastTime = 0;

  constructor(private windowSec = RAIL_TRAIL_WINDOW_S, private jumpResetSec = 120) {}

  record(entries: Iterable<{ key: string; position: [number, number] }>, now: number): void {
    if (this.lastTime > 0 && Math.abs(now - this.lastTime) > this.jumpResetSec) this.tracks.clear();
    this.lastTime = now;
    const cutoff = now - this.windowSec;
    const alive = new Set<string>();
    for (const { key, position } of entries) {
      alive.add(key);
      let pts = this.tracks.get(key);
      if (!pts) { pts = []; this.tracks.set(key, pts); }
      const last = pts[pts.length - 1];
      if (!last || now - last[2] > 0.5) pts.push([position[0], position[1], now]);
      let drop = 0;
      while (drop < pts.length && pts[drop]![2] < cutoff) drop++;
      if (drop > 0) pts.splice(0, drop);
    }
    for (const key of this.tracks.keys()) if (!alive.has(key)) this.tracks.delete(key);
  }

  path(key: string): [number, number][] {
    return (this.tracks.get(key) ?? []).map(([lng, lat]) => [lng, lat]);
  }

  clear(): void {
    this.tracks.clear();
    this.lastTime = 0;
  }
}

// ── 模組層狀態：點選查詢與選取（App 只有一張主地圖）────────────

const railByKey = new Map<string, RailTrain>();
const wasteByKey = new Map<string, WasteTrailRow>();
const selection: Record<FlatMovingKind, string | null> = { rail: null, wasteTruck: null };
const selectionListeners = new Set<() => void>();

/** 設定（或清除）平面模式要畫軌跡的物件。 */
export function setFlatMovingSelection(kind: FlatMovingKind, key: string | null): void {
  if (selection[kind] === key) return;
  selection[kind] = key;
  for (const cb of selectionListeners) cb();
}

const PICK_RADIUS_PX = 25; // 同 RailScene／WasteTruckScene 的螢幕拾取門檻

function pickKey(map: MapboxMap, kind: FlatMovingKind, x: number, y: number): string | null {
  const layers = flatMovingPickLayers(kind).filter((id) => map.getLayer(id));
  if (layers.length === 0) return null;
  const r = PICK_RADIUS_PX;
  const hits = map.queryRenderedFeatures([[x - r, y - r], [x + r, y + r]], { layers });
  let best: { key: string; d: number } | null = null;
  for (const f of hits) {
    if (f.geometry.type !== "Point") continue;
    const key = f.properties?.key;
    if (typeof key !== "string") continue;
    const p = map.project(f.geometry.coordinates as [number, number]);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= r && (!best || d < best.d)) best = { key, d };
  }
  return best?.key ?? null;
}

/** 平面模式點選列車：回傳該班 RailTrain（給既有 train tooltip）。 */
export function pickFlatTrain(map: MapboxMap, x: number, y: number): RailTrain | null {
  const key = pickKey(map, "rail", x, y);
  return key ? railByKey.get(key) ?? null : null;
}

/** 平面模式點選垃圾車：回傳該車 trail row（給既有 featureInfo）。 */
export function pickFlatWasteTruck(map: MapboxMap, x: number, y: number): WasteTrailRow | null {
  const key = pickKey(map, "wasteTruck", x, y);
  return key ? wasteByKey.get(key) ?? null : null;
}

// ── Controller ───────────────────────────────────────────────

export interface FlatMovingDeps {
  getTrains: () => RailTrain[];
  getWasteTrails: () => WasteTrailRow[];
  getIsDark: () => boolean;
  getVisibility: () => LayerVisibility;
}

function styleReady(map: MapboxMap): boolean {
  try { return !!map.getStyle(); } catch { return false; }
}

const styleKey = (s: FlatMovingStyle) => `${s.isDark}|${s.sizeScale}|${s.opacityScale}`;

export function createFlatMovingController(deps: FlatMovingDeps) {
  let map: MapboxMap | null = null;
  let raf = 0;
  const shown: Record<FlatMovingKind, boolean> = { rail: false, wasteTruck: false };
  const lastStyle: Record<FlatMovingKind, string> = { rail: "", wasteTruck: "" };
  const history = new RecentTrackHistory();
  let railTracksPresent = false;

  const schedule = () => {
    if (raf || typeof requestAnimationFrame === "undefined") return;
    raf = requestAnimationFrame(() => { raf = 0; update(); });
  };

  const deactivate = (m: MapboxMap, kind: FlatMovingKind) => {
    if (!shown[kind]) return;
    shown[kind] = false;
    lastStyle[kind] = "";
    removeFlatMovingLayers(m, kind);
    if (kind === "rail") { railByKey.clear(); history.clear(); railTracksPresent = false; } else wasteByKey.clear();
  };

  const prepare = (m: MapboxMap, kind: FlatMovingKind, style: FlatMovingStyle) => {
    const ids = FLAT_MOVING_IDS[kind];
    const fresh = !m.getLayer(ids.circle); // 首次或換底圖後 style 被清空 → 重建（自癒）
    ensureFlatMovingLayers(m, kind, style);
    if (kind === "rail") {
      // 2D 軌道（Mapbox line）可能晚於平面列車加入、蓋在列車上 → 軌道出現時把列車層移回最上層
      const tracks = !!m.getLayer(RAIL_TRACKS_LAYER_ID);
      const raise = tracks && (fresh || !railTracksPresent);
      railTracksPresent = tracks;
      if (raise) raiseFlatMovingLayers(m, kind);
    }
    const key = styleKey(style);
    if (!fresh && key !== lastStyle[kind]) applyFlatMovingStyle(m, kind, style);
    lastStyle[kind] = key;
    shown[kind] = true;
  };

  function update() {
    const m = map;
    if (!m || !styleReady(m)) return;
    const active = resolveFlatMovingActive(deps.getVisibility(), {
      railTrainVisible: paramRefs.railTrainVisible.current,
      railTrain3D: paramRefs.railTrain3D.current,
      wasteTruck3D: paramRefs.wasteTruck3D.current,
    });
    const isDark = deps.getIsDark();

    if (active.rail) {
      const sizeDefault = Number(paramDefault("rail", "railOrbScale")) || 1;
      prepare(m, "rail", { isDark, sizeScale: paramRefs.railOrbScale.current / sizeDefault, opacityScale: 1 });
      const trains = deps.getTrains() ?? [];
      railByKey.clear();
      for (const t of trains) railByKey.set(railTrainKey(t), t);
      history.record(trains.map((t) => ({ key: railTrainKey(t), position: t.position })), timeStore.getTime());
      const sel = selection.rail ? railByKey.get(selection.rail) : undefined;
      let trail: GeoJSON.FeatureCollection = EMPTY_FEATURES;
      if (sel) {
        const coords = [...history.path(railTrainKey(sel)), sel.position];
        if (coords.length >= 2) {
          trail = { type: "FeatureCollection", features: [{ type: "Feature", properties: { color: sel.color }, geometry: { type: "LineString", coordinates: coords } }] };
        }
      }
      setFlatMovingData(m, "rail", railFlatFeatures(trains), trail);
    } else {
      deactivate(m, "rail");
    }

    if (active.wasteTruck) {
      const sizeDefault = Number(paramDefault("wasteTruck", "wasteOrbScale")) || 1;
      prepare(m, "wasteTruck", {
        isDark,
        sizeScale: (paramRefs.wasteOrbScale.current ?? sizeDefault) / sizeDefault,
        opacityScale: Math.max(0, Math.min(1, paramRefs.wasteTruckOpacity.current)),
      });
      const trails = deps.getWasteTrails() ?? [];
      const nowSec = wasteVisualTimeSec(timeStore.getTime(), Date.now());
      const placements = computeWasteTruckFrames(trails, nowSec, { maxCount: 500, withBearing: true });
      wasteByKey.clear();
      for (const p of placements) wasteByKey.set(p.row.vehicle_no, p.row);
      const selRow = selection.wasteTruck ? wasteByKey.get(selection.wasteTruck) : undefined;
      let trail: GeoJSON.FeatureCollection = EMPTY_FEATURES;
      if (selRow) {
        const lines = wasteTruckRecentPath(selRow, nowSec);
        if (lines.length > 0) {
          trail = { type: "FeatureCollection", features: [{ type: "Feature", properties: { color: WASTE_STATUS_COLORS.collecting }, geometry: { type: "MultiLineString", coordinates: lines } }] };
        }
      }
      setFlatMovingData(m, "wasteTruck", wasteFlatFeatures(placements), trail);
    } else {
      deactivate(m, "wasteTruck");
    }
  }

  // 暫停中切「軌道 2D」：軌道層加入時沒有時間 tick，靠 styledata 把平面列車移回軌道之上（只做 getLayer 檢查）
  const onStyleData = () => {
    const m = map;
    if (!m || !shown.rail) return;
    const tracks = !!m.getLayer(RAIL_TRACKS_LAYER_ID);
    const raise = tracks && !railTracksPresent;
    railTracksPresent = tracks; // 先記再移：moveLayer 本身也會發 styledata
    if (raise) raiseFlatMovingLayers(m, "rail");
  };

  const unsubs = [
    // 時間：只在有平面層時才排更新（暫停＝不通知＝0 次 setData）
    timeStore.subscribeThrottled(FLAT_MOVING_THROTTLE_MS, () => { if (shown.rail || shown.wasteTruck) schedule(); }),
    layerVisibilityStore.subscribe(schedule),
    layerParamsStore.subscribe(schedule),
    subscribeThreeRepaint(schedule),
  ];
  selectionListeners.add(schedule);

  return {
    /** 地圖就緒／換底圖後呼叫（useThreeJsLayers.addAllLayers）。 */
    attach(next: MapboxMap) {
      if (map !== next) {
        map?.off("styledata", onStyleData);
        next.on("styledata", onStyleData);
        shown.rail = false; shown.wasteTruck = false;
      }
      map = next;
      // 換底圖後 style 已清空：shown 旗標重置，下一次 update 會重建
      lastStyle.rail = ""; lastStyle.wasteTruck = "";
      schedule();
    },
    /** 測試／診斷用：立即更新一次。 */
    update,
    dispose() {
      for (const u of unsubs) u();
      map?.off("styledata", onStyleData);
      selectionListeners.delete(schedule);
      if (raf && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
