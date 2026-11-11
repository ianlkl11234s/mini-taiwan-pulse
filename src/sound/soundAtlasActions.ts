/**
 * City Sound Atlas 使用者動作（面板呼叫）：選場景、放置／清除接收點。
 * 時間只經 timelineJumpBridge 寫入（timeStore 只有 useTimeline 能寫）。
 */
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { requestTimelineJump, requestTimelinePlay } from "../state/timelineJumpBridge";
import { applySceneView, fetchSceneSnapshot, findScene, sceneFallbackFocusUnix, type SoundSceneId } from "./scenes";
import { DEFAULT_RECEIVER_HEIGHT_M, EMPTY_ROUTE, getSoundAtlasMap, makeReceiver, soundAtlasStore } from "./soundAtlasStore";
import { timeStore } from "../state/timeStore";
import { routeProfile } from "./engines/routeProfile";
import type { SoundSourceFamily, SoundSourceSet } from "./types";

export function selectSoundScene(id: SoundSceneId | null): void {
  if (!id) {
    soundAtlasStore.set({ sceneId: null, snapshot: null, snapshotStatus: "none" });
    return;
  }
  const def = findScene(id);
  if (!def) return;
  soundAtlasStore.set({ sceneId: id, snapshot: null, snapshotStatus: "loading", placing: false, route: { ...EMPTY_ROUTE, mode: soundAtlasStore.get().route.mode } });
  for (const key of def.companionLayers ?? []) layerVisibilityStore.setVisibility(key, true);

  // 接收點與焦點時刻只看快照（子場景以 def.view 覆寫，見 scenes.ts）。先寫快照與接收點、再撥時間軸：
  // 日期切換觸發載入時，已能判斷快照是否適用。
  void fetchSceneSnapshot(def.snapshotId ?? id).then((loaded) => {
    const snap = loaded ? applySceneView(loaded, def.view) : null;
    if (soundAtlasStore.get().sceneId !== id) return;
    if (!snap) {
      // 快照讀不到：只把時間軸撥到場景日期中午，接收點不動（來源全走即時）
      soundAtlasStore.set({ snapshotStatus: "missing" });
      requestTimelineJump(sceneFallbackFocusUnix(def));
      return;
    }
    const r = snap.receiver;
    soundAtlasStore.set({
      snapshot: snap,
      snapshotStatus: "loaded",
      ...(r ? { receiver: makeReceiver(r.lon, r.lat, r.height_m ?? DEFAULT_RECEIVER_HEIGHT_M) } : {}),
    });
    if (r) getSoundAtlasMap()?.flyTo({ center: [r.lon, r.lat], zoom: def.zoom, essential: true });
    requestTimelineJump(snap.focus_time ? Date.parse(snap.focus_time) / 1000 : sceneFallbackFocusUnix(def));
  });
}

/** 播放目前場景：從快照焦點時刻前 leadS 秒，以場景設定倍速播放（時間仍走 timeStore） */
export function playSoundScene(): boolean {
  const st = soundAtlasStore.get();
  const def = findScene(st.sceneId);
  if (!def || !st.snapshot?.focus_time) return false;
  return requestTimelinePlay(Date.parse(st.snapshot.focus_time) / 1000 - def.playback.leadS, def.playback.speed);
}

export function startPlacingReceiver(): void {
  const st = soundAtlasStore.get();
  // 放接收點與畫路線互斥
  soundAtlasStore.set({ placing: !st.placing, route: { ...st.route, drawing: false } });
}

// ── 路線剖面（沿途主要聲源，不是噪音暴露量）────────────────────

/** 開始畫路線：清掉舊路線，之後每次點地圖加一個節點；畫線中再按一次＝取消（同 Esc） */
export function startRouteDrawing(): void {
  const st = soundAtlasStore.get();
  soundAtlasStore.set({ placing: false, route: { ...EMPTY_ROUTE, mode: st.route.mode, drawing: !st.route.drawing } });
}

export function addRoutePoint(lon: number, lat: number): void {
  const r = soundAtlasStore.get().route;
  if (!r.drawing) return;
  soundAtlasStore.set({ route: { ...r, points: [...r.points, [lon, lat]] } });
}

export function clearRoute(): void {
  soundAtlasStore.set({ route: { ...EMPTY_ROUTE, mode: soundAtlasStore.get().route.mode } });
}

/**
 * 依已載入的來源集合（未經接收點預篩）算剖面；家族＝目前開著且已載入的。
 * 限制：垃圾車只載接收點附近縣市、場景快照只涵蓋場景範圍、只有當天資料（過午夜的樣本無法判斷）。
 */
function computeRoute(points: readonly [number, number][], departUnix: number, mode: "walk" | "bike") {
  const st = soundAtlasStore.get();
  const families = Object.keys(st.sets) as SoundSourceFamily[];
  const sets = Object.values(st.sets).filter((s): s is SoundSourceSet => !!s);
  if (points.length < 2 || families.length === 0) return null;
  return routeProfile<SoundSourceFamily>(points, departUnix, sets, { mode, families });
}

/** 完成：出發時間＝此刻時間軸（只讀一次） */
export function finishRoute(): void {
  const r = soundAtlasStore.get().route;
  if (r.points.length < 2) return;
  const departUnix = timeStore.getTime();
  soundAtlasStore.set({ route: { ...r, drawing: false, departUnix, result: computeRoute(r.points, departUnix, r.mode) } });
}

export function setRouteMode(mode: "walk" | "bike"): void {
  const r = soundAtlasStore.get().route;
  const result = r.departUnix != null && r.points.length >= 2 ? computeRoute(r.points, r.departUnix, mode) : null;
  soundAtlasStore.set({ route: { ...r, mode, result } });
}

export function clearReceiver(): void {
  soundAtlasStore.set({ receiver: null, placing: false, sceneId: null, snapshot: null, snapshotStatus: "none", current: null, profile: null, route: EMPTY_ROUTE });
}
