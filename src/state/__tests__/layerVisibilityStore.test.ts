/**
 * layerVisibilityStore（AR-21）等價性 / 訂閱語意測試。
 *
 * 測試環境是 `environment: "node"`（見 vitest.config.ts），沒有 DOM 也沒有
 * @testing-library/react，所以這裡驗的是 **store 層語意**，不是 React hook 行為。
 * bridge（hooks/useLayerVisibility.ts）是 useSyncExternalStore 的薄殼，它的正確性
 * 取決於下面這幾條：
 *   1. getAll() 的 snapshot identity 只在真的有值變動時才換 —— uSES 的硬需求，
 *      也是「setLayerVisibility 同值寫入不觸發 re-render」的保證。
 *   2. 同值寫入完全不通知 —— bridge 是雙向的，若同值也通知就會 store→App→store 互推。
 *   3. per-key 訂閱只在該 key 變動時觸發。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  layerVisibilityStore,
  buildDefaultVisibility,
} from "../layerVisibilityStore";
import type { LayerVisibility } from "../../types";

const store = layerVisibilityStore;

beforeEach(() => {
  store.reset();
});

describe("buildDefaultVisibility", () => {
  it("預設全關（訪客一進站不打任何 RPC）", () => {
    const defaults = buildDefaultVisibility();
    const keys = Object.keys(defaults) as (keyof LayerVisibility)[];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => defaults[k] === false)).toBe(true);
  });

  it("每次呼叫回傳新物件（不共享 mutable 預設值）", () => {
    expect(buildDefaultVisibility()).not.toBe(buildDefaultVisibility());
  });
});

describe("基本讀寫", () => {
  it("setVisibility / getVisibility 往返", () => {
    expect(store.getVisibility("earthquakes")).toBe(false);
    store.setVisibility("earthquakes", true);
    expect(store.getVisibility("earthquakes")).toBe(true);
    expect(store.getAll().earthquakes).toBe(true);
  });

  it("toggle 反轉單一 key，不動其他 key", () => {
    store.setVisibility("earthquakes", true);
    store.toggle("earthquakes");
    expect(store.getVisibility("earthquakes")).toBe(false);
    store.toggle("earthquakes");
    expect(store.getVisibility("earthquakes")).toBe(true);
    expect(store.getVisibility("popCount")).toBe(false);
  });

  it("setBulk 只寫入 partial 提到的 key", () => {
    store.setVisibility("popCount", true);
    store.setBulk({ earthquakes: true, typhoonTracks: true });
    expect(store.getVisibility("earthquakes")).toBe(true);
    expect(store.getVisibility("typhoonTracks")).toBe(true);
    // 沒被 partial 提到的維持原值
    expect(store.getVisibility("popCount")).toBe(true);
  });

  it("setAll 整包取代（App 端 setLayerVisibility(obj) 的落點）", () => {
    store.setVisibility("earthquakes", true);
    const next = { ...buildDefaultVisibility(), popCount: true };
    store.setAll(next);
    expect(store.getVisibility("earthquakes")).toBe(false);
    expect(store.getVisibility("popCount")).toBe(true);
  });
});

describe("snapshot identity（useSyncExternalStore 契約）", () => {
  it("有變動才換 identity", () => {
    const before = store.getAll();
    store.setVisibility("earthquakes", true);
    expect(store.getAll()).not.toBe(before);
  });

  it("同值 setVisibility 不換 identity", () => {
    store.setVisibility("earthquakes", true);
    const before = store.getAll();
    store.setVisibility("earthquakes", true);
    expect(store.getAll()).toBe(before);
  });

  it("值全同的 setAll 不換 identity（bridge 防迴圈的關鍵）", () => {
    store.setVisibility("earthquakes", true);
    const before = store.getAll();
    // 模擬 App 端 `setLayerVisibility({ ...prev })`：新物件、值全同
    store.setAll({ ...before });
    expect(store.getAll()).toBe(before);
  });

  it("沒有實際變動的 setBulk 不換 identity", () => {
    const before = store.getAll();
    store.setBulk({ earthquakes: false, popCount: false });
    expect(store.getAll()).toBe(before);
  });

  it("getAll() 連續呼叫回傳同一個物件（getSnapshot 穩定，否則 uSES 無限迴圈）", () => {
    expect(store.getAll()).toBe(store.getAll());
  });
});

describe("全域訂閱 subscribe", () => {
  it("任何 key 變動都通知，且每次寫入只通知一次", () => {
    const cb = vi.fn();
    const unsub = store.subscribe(cb);

    store.setVisibility("earthquakes", true);
    expect(cb).toHaveBeenCalledTimes(1);

    store.setVisibility("popCount", true);
    expect(cb).toHaveBeenCalledTimes(2);

    // setBulk 改了 2 個 key，全域仍只通知一次
    store.setBulk({ typhoonTracks: true, windField: true });
    expect(cb).toHaveBeenCalledTimes(3);

    unsub();
    store.setVisibility("earthquakes", false);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("同值寫入完全不通知（bridge 不會 store→App→store 互推）", () => {
    store.setVisibility("earthquakes", true);
    const cb = vi.fn();
    store.subscribe(cb);

    store.setVisibility("earthquakes", true);
    store.setAll({ ...store.getAll() });
    store.setBulk({ earthquakes: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it("listener 觸發時讀到的已經是新狀態（先換 snapshot 再通知）", () => {
    let seen: boolean | null = null;
    store.subscribe(() => {
      seen = store.getVisibility("earthquakes");
    });
    store.setVisibility("earthquakes", true);
    expect(seen).toBe(true);
  });
});

describe("per-key 訂閱 subscribeKey", () => {
  it("只在該 key 變動時觸發", () => {
    const onEq = vi.fn();
    const onPop = vi.fn();
    store.subscribeKey("earthquakes", onEq);
    store.subscribeKey("popCount", onPop);

    store.setVisibility("earthquakes", true);
    expect(onEq).toHaveBeenCalledTimes(1);
    expect(onPop).not.toHaveBeenCalled();

    store.setVisibility("popCount", true);
    expect(onEq).toHaveBeenCalledTimes(1);
    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it("setBulk 只通知真的變動的 key", () => {
    store.setVisibility("earthquakes", true);
    const onEq = vi.fn();
    const onPop = vi.fn();
    store.subscribeKey("earthquakes", onEq);
    store.subscribeKey("popCount", onPop);

    // earthquakes 已是 true → 同值不通知；popCount 由 false→true → 通知
    store.setBulk({ earthquakes: true, popCount: true });
    expect(onEq).not.toHaveBeenCalled();
    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it("setAll 只通知有 diff 的 key", () => {
    const onEq = vi.fn();
    const onPop = vi.fn();
    store.subscribeKey("earthquakes", onEq);
    store.subscribeKey("popCount", onPop);

    store.setAll({ ...buildDefaultVisibility(), popCount: true });
    expect(onEq).not.toHaveBeenCalled();
    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe 後不再觸發，且同 key 多訂閱者互不影響", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = store.subscribeKey("earthquakes", a);
    store.subscribeKey("earthquakes", b);

    store.toggle("earthquakes");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    store.toggle("earthquakes");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe("bridge 等價性（模擬 App 端既有寫入路徑）", () => {
  /** App.tsx handleAllOff 的寫法：`{ ...prev }` 後全刷 false */
  function allOff() {
    const next = { ...store.getAll() };
    for (const k in next) next[k as keyof LayerVisibility] = false;
    store.setAll(next);
  }

  it("All Off 後全部關閉；再按一次 All Off 完全沒有通知（空轉不 re-render）", () => {
    store.setBulk({ earthquakes: true, popCount: true });
    allOff();
    const all = store.getAll();
    expect((Object.keys(all) as (keyof LayerVisibility)[]).every((k) => !all[k])).toBe(true);

    const cb = vi.fn();
    store.subscribe(cb);
    allOff();
    expect(cb).not.toHaveBeenCalled();
    expect(store.getAll()).toBe(all);
  });

  /** App.tsx 歷史模式：snapshot → 全關 → 還原 */
  it("歷史模式 snapshot / 還原往返後狀態一致", () => {
    store.setBulk({ earthquakes: true, typhoonTracks: true });
    const snapshotBefore = store.getAll();

    const allOffObj = { ...snapshotBefore };
    for (const k in allOffObj) allOffObj[k as keyof LayerVisibility] = false;
    store.setAll({ ...allOffObj, popCount: true });
    expect(store.getVisibility("earthquakes")).toBe(false);
    expect(store.getVisibility("popCount")).toBe(true);

    store.setAll(snapshotBefore);
    expect(store.getVisibility("earthquakes")).toBe(true);
    expect(store.getVisibility("typhoonTracks")).toBe(true);
    expect(store.getVisibility("popCount")).toBe(false);
  });

  /** App.tsx 常見的 updater 寫法：`setLayerVisibility(prev => ({ ...prev, [k]: true }))` */
  it("updater 形式的整包寫入等價於 setVisibility", () => {
    const viaUpdater = { ...store.getAll(), earthquakes: true };
    store.setAll(viaUpdater);
    const afterUpdater = store.getAll();

    store.reset();
    store.setVisibility("earthquakes", true);
    expect(store.getAll()).toEqual(afterUpdater);
  });

  it("reset 回到預設全關", () => {
    store.setBulk({ earthquakes: true, popCount: true });
    store.reset();
    expect(store.getAll()).toEqual(buildDefaultVisibility());
  });
});
