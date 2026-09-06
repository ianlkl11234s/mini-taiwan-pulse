import { useSyncExternalStore } from "react";
import { memberLibraryLoader, MemberLibraryError, type MemberLibrary, type PlaceInput, type SavedPlace, type SavedScene, type UnavailableMemberItem } from "../data/memberLibraryLoader";
import type { MemberSceneSnapshot } from "../lib/memberSchema";
import { withLoading } from "../lib/loadingRegistry";

const GUEST_KEY = "pulse:guest-layer-favorites:v1";
const EMPTY: MemberLibrary = { favorites: [], scenes: [], places: [], unavailableItems: [] };
type State = MemberLibrary & {
  userId: string | null; status: "guest" | "loading" | "ready" | "error" | "unavailable";
  busy: boolean; message: string | null; guestCount: number;
};
// Private account rows stay in memory only. Never persist them under the guest key.
export function createMemberLibraryStore(api = memberLibraryLoader, storage?: Pick<Storage, "getItem" | "setItem">) {
  const listeners = new Set<() => void>();
  let epoch = 0;
  let guest: string[] = [];
  let initialized = false;
  let state: State = { ...EMPTY, userId: null, status: "guest", busy: false, message: null, guestCount: 0 };
  const emit = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((cb) => cb()); };
  const local = () => storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  function readGuest() {
    try {
      const raw: unknown = JSON.parse(local()?.getItem(GUEST_KEY) ?? "[]");
      guest = Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(x)))].slice(0, 500) : [];
    } catch { guest = []; }
  }
  function failure(error: unknown) {
    emit({ status: error instanceof MemberLibraryError && error.kind === "unavailable" ? "unavailable" : "error", message: error instanceof Error ? error.message : "操作未完成，請重試。" });
  }
  async function refresh(): Promise<void> {
    const userId = state.userId;
    if (!userId || state.busy) return;
    const token = ++epoch;
    emit({ status: "loading", message: null });
    try {
      const rows = await api.load(userId);
      if (epoch === token && state.userId === userId) emit({ ...rows, status: "ready" });
    } catch (error) { if (epoch === token) failure(error); }
  }
  async function mutate(work: (userId: string) => Promise<void>) {
    const userId = state.userId;
    if (!userId || state.busy || state.status !== "ready") { emit({ message: state.busy ? "正在同步，請稍候。" : "請先重新整理雲端內容，再進行保存。" }); return; }
    const token = ++epoch;
    emit({ busy: true, message: null });
    try {
      await withLoading("member-write", "保存我的內容", work(userId));
      if (epoch !== token || state.userId !== userId) return;
      // A successful write is followed by a fresh read. No optimistic "synced" badge.
      const rows = await api.load(userId);
      if (epoch === token && state.userId === userId) emit({ ...rows, status: "ready", message: "已同步" });
    } catch (error) { if (epoch === token) failure(error); }
    finally { if (epoch === token) emit({ busy: false }); }
  }
  return {
    getSnapshot: () => state,
    subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
    setUser(userId: string | null) {
      if (initialized && state.userId === userId) return;
      initialized = true; ++epoch; readGuest();
      emit({ ...EMPTY, favorites: userId ? [] : guest, userId, status: userId ? "loading" : "guest", busy: false, message: null, guestCount: guest.length });
      if (userId) void refresh();
    },
    refresh,
    async toggleFavorite(key: string) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(key)) return;
      if (state.userId) {
        const add = !state.favorites.includes(key);
        return mutate((userId) => api.favorite(userId, key, add));
      }
      if (!guest.includes(key) && guest.length >= 500) { emit({ message: "本機收藏上限為 500 個。" }); return; }
      const next = guest.includes(key) ? guest.filter((x) => x !== key) : [...guest, key];
      try {
        const target = local();
        if (!target) throw new Error("storage unavailable");
        target.setItem(GUEST_KEY, JSON.stringify(next));
        guest = next; emit({ favorites: guest, guestCount: guest.length, message: "已儲存於此瀏覽器" });
      } catch { emit({ message: "瀏覽器無法儲存收藏；請檢查儲存空間或隱私設定後重試。" }); }
    },
    importGuest() {
      const additions = guest.filter((key) => !state.favorites.includes(key));
      return mutate(async (userId) => {
        if (state.favorites.length + additions.length > 500) throw new Error("匯入後會超過 500 個收藏，請先移除部分收藏。");
        // Sequential idempotent writes keep quota and retry behavior explicit.
        for (const key of additions) {
          if (state.userId !== userId) return;
          await api.favorite(userId, key, true);
        }
      });
    },
    saveScene(name: string, snapshot: MemberSceneSnapshot, previous?: SavedScene) {
      return mutate(async (userId) => { if (previous && previous.user_id !== userId) throw new Error("登入帳號已變更，請重新開啟場景。"); await api.saveScene(userId, name, snapshot, previous); });
    },
    savePlace(input: PlaceInput, previous?: SavedPlace) {
      return mutate(async (userId) => { if (previous && previous.user_id !== userId) throw new Error("登入帳號已變更，請重新開啟地點。"); await api.savePlace(userId, input, previous); });
    },
    removeUnavailable(row: UnavailableMemberItem) { return mutate((userId) => api.remove(userId, row.table, row)); },
    removeScene(row: SavedScene) { return mutate((userId) => api.remove(userId, "user_scenes", row)); },
    removePlace(row: SavedPlace) { return mutate((userId) => api.remove(userId, "user_places", row)); },
  };
}
export const memberLibraryStore = createMemberLibraryStore();
export function useMemberLibrary() { return useSyncExternalStore(memberLibraryStore.subscribe, memberLibraryStore.getSnapshot); }
