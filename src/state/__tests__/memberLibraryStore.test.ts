import { describe, expect, it, vi } from "vitest";
import { memberLibraryLoader, MemberLibraryError, type MemberLibrary } from "../../data/memberLibraryLoader";
import { createMemberLibraryStore } from "../memberLibraryStore";

const empty: MemberLibrary = { favorites: [], scenes: [], places: [], unavailableItems: [] };
const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function api(overrides: Partial<typeof memberLibraryLoader> = {}): typeof memberLibraryLoader {
  return {
    load: overrides.load ?? vi.fn().mockResolvedValue(empty),
    favorite: overrides.favorite ?? vi.fn().mockResolvedValue(undefined),
    saveScene: overrides.saveScene ?? vi.fn().mockResolvedValue(undefined),
    savePlace: overrides.savePlace ?? vi.fn().mockResolvedValue(undefined),
    remove: overrides.remove ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe("memberLibraryStore", () => {
  it("訪客收藏可重整保留；storage 失敗不把畫面假裝成已儲存", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)) };
    const store = createMemberLibraryStore(api(), storage);
    store.setUser(null);
    await store.toggleFavorite("cctv");
    expect(JSON.parse(values.get("pulse:guest-layer-favorites:v1") ?? "[]")).toEqual(["cctv"]);
    const restored = createMemberLibraryStore(api(), storage);
    restored.setUser(null);
    expect(restored.getSnapshot().favorites).toEqual(["cctv"]);

    const blocked = createMemberLibraryStore(api(), { getItem: () => null, setItem: () => { throw new Error("quota"); } });
    blocked.setUser(null);
    await blocked.toggleFavorite("cctv");
    expect(blocked.getSnapshot().favorites).toEqual([]);
    expect(blocked.getSnapshot().message).toContain("無法儲存");
  });

  it("登入只載入帳號內容，不會自動匯入訪客收藏", async () => {
    const favorite = vi.fn().mockResolvedValue(undefined);
    const store = createMemberLibraryStore(api({ favorite }), { getItem: () => '["cctv"]', setItem: () => {} });
    store.setUser("user-a");
    await nextTurn();
    expect(store.getSnapshot().favorites).toEqual([]);
    expect(favorite).not.toHaveBeenCalled();
    expect(store.getSnapshot().guestCount).toBe(1);
  });

  it("帳號切換後，舊帳號較慢的載入不能覆蓋新帳號", async () => {
    const first = deferred<typeof empty>();
    const second = deferred<typeof empty>();
    const load = vi.fn().mockImplementation((userId: string) => userId === "A" ? first.promise : second.promise);
    const store = createMemberLibraryStore(api({ load }));
    store.setUser("A");
    store.setUser("B");
    second.resolve({ ...empty, favorites: ["cctv"] });
    await nextTurn();
    first.resolve({ ...empty, favorites: ["rail"] });
    await nextTurn();
    expect(store.getSnapshot()).toMatchObject({ userId: "B", favorites: ["cctv"], status: "ready" });
  });

  it("登出立刻清除前一帳號私有 rows，回到本機收藏", async () => {
    const store = createMemberLibraryStore(api({ load: vi.fn().mockResolvedValue({ ...empty, favorites: ["rail"] }) }), { getItem: () => '["cctv"]', setItem: () => {} });
    store.setUser("A");
    await nextTurn();
    store.setUser(null);
    expect(store.getSnapshot()).toMatchObject({ userId: null, status: "guest", favorites: ["cctv"], scenes: [], places: [] });
  });

  it("雲端寫入必須讀回才顯示新收藏；讀回失敗不假成功", async () => {
    const readback = deferred<typeof empty>();
    const load = vi.fn().mockResolvedValueOnce(empty).mockImplementationOnce(() => readback.promise);
    const favorite = vi.fn().mockResolvedValue(undefined);
    const store = createMemberLibraryStore(api({ load, favorite }));
    store.setUser("A");
    await nextTurn();
    const saving = store.toggleFavorite("cctv");
    await nextTurn();
    expect(store.getSnapshot()).toMatchObject({ favorites: [], busy: true });
    readback.resolve({ ...empty, favorites: ["cctv"] });
    await saving;
    expect(store.getSnapshot()).toMatchObject({ favorites: ["cctv"], status: "ready", message: "已同步" });

    const failed = createMemberLibraryStore(api({ load: vi.fn().mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error("offline")) }));
    failed.setUser("A");
    await nextTurn();
    await failed.toggleFavorite("cctv");
    expect(failed.getSnapshot()).toMatchObject({ favorites: [], status: "error" });
    expect(failed.getSnapshot().message).toContain("offline");
  });

  it("衝突時保留已讀到的內容並要求重試", async () => {
    const store = createMemberLibraryStore(api({
      load: vi.fn().mockResolvedValue({ ...empty, favorites: ["rail"] }),
      favorite: vi.fn().mockRejectedValue(new MemberLibraryError("conflict", "內容已在其他裝置更新或刪除。請重新整理，或另存副本。")),
    }));
    store.setUser("A");
    await nextTurn();
    await store.toggleFavorite("cctv");
    expect(store.getSnapshot().favorites).toEqual(["rail"]);
    expect(store.getSnapshot().message).toContain("其他裝置");
  });
});
