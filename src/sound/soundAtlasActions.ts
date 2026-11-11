/**
 * City Sound Atlas 使用者動作（面板呼叫）：選場景、放置／清除接收點。
 * 時間只經 timelineJumpBridge 寫入（timeStore 只有 useTimeline 能寫）。
 */
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { requestTimelineJump, requestTimelinePlay } from "../state/timelineJumpBridge";
import { fetchSceneSnapshot, findScene, sceneFallbackFocusUnix, type SoundSceneId } from "./scenes";
import { DEFAULT_RECEIVER_HEIGHT_M, getSoundAtlasMap, makeReceiver, soundAtlasStore } from "./soundAtlasStore";

export function selectSoundScene(id: SoundSceneId | null): void {
  if (!id) {
    soundAtlasStore.set({ sceneId: null, snapshot: null, snapshotStatus: "none" });
    return;
  }
  const def = findScene(id);
  if (!def) return;
  soundAtlasStore.set({ sceneId: id, snapshot: null, snapshotStatus: "loading", placing: false });
  for (const key of def.companionLayers ?? []) layerVisibilityStore.setVisibility(key, true);

  // 接收點與焦點時刻只看快照（不寫死在前端）。先寫快照與接收點、再撥時間軸：
  // 日期切換觸發載入時，已能判斷快照是否適用。
  void fetchSceneSnapshot(id).then((snap) => {
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
  soundAtlasStore.set({ placing: !soundAtlasStore.get().placing });
}

export function clearReceiver(): void {
  soundAtlasStore.set({ receiver: null, placing: false, sceneId: null, snapshot: null, snapshotStatus: "none", current: null, profile: null });
}
