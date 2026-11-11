/**
 * City Sound Atlas 使用者動作（面板呼叫）：選場景、放置／清除接收點。
 * 時間只經 timelineJumpBridge 寫入（timeStore 只有 useTimeline 能寫）。
 */
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { requestTimelineJump } from "../state/timelineJumpBridge";
import { fetchSceneSnapshot, findScene, type SoundSceneId } from "./scenes";
import { getSoundAtlasMap, makeReceiver, soundAtlasStore } from "./soundAtlasStore";

export function selectSoundScene(id: SoundSceneId | null): void {
  if (!id) {
    soundAtlasStore.set({ sceneId: null, snapshot: null, snapshotStatus: "none" });
    return;
  }
  const def = findScene(id);
  if (!def) return;
  // 先寫場景與接收點，再撥時間軸：日期切換觸發載入時，已能判斷快照是否適用
  soundAtlasStore.set({
    sceneId: id,
    snapshot: null,
    snapshotStatus: "loading",
    placing: false,
    receiver: makeReceiver(def.receiver.lon, def.receiver.lat, def.receiver.heightM),
  });
  for (const key of def.companionLayers ?? []) layerVisibilityStore.setVisibility(key, true);
  getSoundAtlasMap()?.flyTo({ center: [def.receiver.lon, def.receiver.lat], zoom: def.zoom, essential: true });
  requestTimelineJump(Date.parse(def.focusTime) / 1000);

  void fetchSceneSnapshot(id).then((snap) => {
    if (soundAtlasStore.get().sceneId !== id) return;
    if (!snap) {
      soundAtlasStore.set({ snapshotStatus: "missing" });
      return;
    }
    const r = snap.receiver;
    soundAtlasStore.set({
      snapshot: snap,
      snapshotStatus: "loaded",
      ...(r ? { receiver: makeReceiver(r.lon, r.lat, r.height_m ?? def.receiver.heightM) } : {}),
    });
    if (r) getSoundAtlasMap()?.flyTo({ center: [r.lon, r.lat], zoom: def.zoom, essential: true });
    if (snap.focus_time && snap.focus_time !== def.focusTime) requestTimelineJump(Date.parse(snap.focus_time) / 1000);
  });
}

export function startPlacingReceiver(): void {
  soundAtlasStore.set({ placing: !soundAtlasStore.get().placing });
}

export function clearReceiver(): void {
  soundAtlasStore.set({ receiver: null, placing: false, sceneId: null, snapshot: null, snapshotStatus: "none", current: null, profile: null });
}
