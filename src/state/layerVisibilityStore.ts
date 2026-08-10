/**
 * Layer Visibility Store（AR-21 試點）
 *
 * 圖層開關的 SSOT。目的與 `timeStore.ts` 相同：讓「誰關心哪個 key」變成細粒度
 * 訂閱，而不是「一包大物件進 App state → 任何 toggle 都讓整棵樹 reconcile」。
 *
 * 模式完全比照 timeStore（本專案已驗證的自家寫法，不引入 zustand/jotai）：
 *   - 模組級 state + getter/setter + subscribe，寫入時同值不通知（消除 identity churn）
 *   - React 端一律走 `useSyncExternalStore`，不再維護第二份 useState 副本
 *
 * 過渡期（AR-21 → AR-23）：
 *   `hooks/useLayerVisibility.ts` 是本 store 的 React 門面（bridge）。App.tsx 既有的
 *   71 處 `layerVisibility` / `setLayerVisibility` 呼叫一行不改仍可運作 —— 因為那個
 *   hook 現在讀寫的就是本 store。元件可逐步改成直接訂閱（`useLayerVisible(key)`），
 *   全部改完後 bridge 即可退場（AR-23）。
 *
 * 寫入者：useLayerVisibility 的 setter（App 端所有既有路徑）。
 * 未來直接呼叫本 store 的 setter 也可以 —— bridge 是雙向的，App state 會跟著動。
 */

import { useCallback, useSyncExternalStore } from "react";
import type { LayerVisibility } from "../types";
import { LAYER_COLORS } from "../components/sidebar/layerCatalog";

type Listener = () => void;
type VisKey = keyof LayerVisibility;

/**
 * 預設開啟的圖層；其餘一律 false。
 * key 全集從 layerCatalog 的 LAYER_COLORS 派生（型別強制完整）—
 * 新增 layer 不用再改本檔，除非要預設開啟。
 *
 * 預設全關：訪客一進站不打任何 RPC、不載任何圖層（2026-08-10 移除行道樹預設開啟）。
 */
const DEFAULT_ON: ReadonlySet<VisKey> = new Set<VisKey>([]);

export function buildDefaultVisibility(): LayerVisibility {
  const keys = Object.keys(LAYER_COLORS) as VisKey[];
  return Object.fromEntries(
    keys.map((k) => [k, DEFAULT_ON.has(k)]),
  ) as unknown as LayerVisibility;
}

/**
 * 當前快照。**identity 只在真的有 key 變動時才換新** —— 這是
 * `useSyncExternalStore` 的硬性要求（getSnapshot 每次回傳新物件會無限迴圈），
 * 同時也順手消滅了「setLayerVisibility({...prev}) 但值沒變」造成的空轉 re-render。
 */
let snapshot: LayerVisibility = buildDefaultVisibility();

const globalListeners = new Set<Listener>();
/** per-key 訂閱者；只有該 key 真的變動時才通知。 */
const keyListeners = new Map<VisKey, Set<Listener>>();

/**
 * 套用一批變更。
 * 回傳是否真的有變動 —— 沒變動就完全不換 snapshot identity、不通知任何人。
 *
 * 通知順序刻意固定：**先把 snapshot 換掉，再通知**（所有 listener 讀到的都是
 * 已完成的新狀態）；先 per-key 後 global，且 global 只發一次。
 */
function applyChanges(changed: VisKey[], next: LayerVisibility): boolean {
  if (changed.length === 0) return false;
  snapshot = next;
  for (const k of changed) {
    const set = keyListeners.get(k);
    if (set) for (const cb of set) cb();
  }
  for (const cb of globalListeners) cb();
  return true;
}

export const layerVisibilityStore = {
  /** 單一 key 的開關狀態。純讀，不觸發 React。 */
  getVisibility(key: VisKey): boolean {
    return snapshot[key];
  },

  /**
   * 整包快照。**回傳的物件請視為 immutable**（不要 mutate）——
   * 它就是 useSyncExternalStore 的 snapshot，identity 是判斷變動的依據。
   */
  getAll(): LayerVisibility {
    return snapshot;
  },

  /** 設定單一 key。同值 no-op。 */
  setVisibility(key: VisKey, value: boolean): void {
    if (snapshot[key] === value) return;
    applyChanges([key], { ...snapshot, [key]: value });
  },

  /** 反轉單一 key。 */
  toggle(key: VisKey): void {
    applyChanges([key], { ...snapshot, [key]: !snapshot[key] });
  },

  /** 批次設定（只寫入 partial 提到的 key）。同值的 key 不會觸發其 per-key listener。 */
  setBulk(partial: Partial<LayerVisibility>): void {
    const next = { ...snapshot };
    const changed: VisKey[] = [];
    for (const k of Object.keys(partial) as VisKey[]) {
      const v = partial[k];
      if (v === undefined || snapshot[k] === v) continue;
      next[k] = v;
      changed.push(k);
    }
    applyChanges(changed, next);
  },

  /**
   * 整包取代（bridge 用：App 端 `setLayerVisibility(obj)` 的落點）。
   * 逐 key 比對，值全同 → 完全 no-op（snapshot identity 不變）。
   */
  setAll(next: LayerVisibility): void {
    if (next === snapshot) return;
    const changed: VisKey[] = [];
    for (const k of Object.keys(snapshot) as VisKey[]) {
      if (snapshot[k] !== next[k]) changed.push(k);
    }
    applyChanges(changed, next);
  },

  /** 訂閱任何 key 的變動（整包消費者用，例如 MapView 的 overlay hydrate）。 */
  subscribe(cb: Listener): () => void {
    globalListeners.add(cb);
    return () => globalListeners.delete(cb);
  },

  /** 訂閱單一 key —— 只有該 key 變動才觸發（AR-21 的核心賣點）。 */
  subscribeKey(key: VisKey, cb: Listener): () => void {
    let set = keyListeners.get(key);
    if (!set) {
      set = new Set();
      keyListeners.set(key, set);
    }
    const s = set;
    s.add(cb);
    return () => {
      s.delete(cb);
      if (s.size === 0) keyListeners.delete(key);
    };
  },

  /** 測試 / 重置用：回到 buildDefaultVisibility()。 */
  reset(): void {
    layerVisibilityStore.setAll(buildDefaultVisibility());
  },
};

export type LayerVisibilityStore = typeof layerVisibilityStore;

// ── React 門面 ──────────────────────────────────────────────────────────

/**
 * 訂閱單一圖層的開關。**只有這個 key 變動時才 re-render** ——
 * 元件從「吃整包 visibility prop」改吃這個 hook，就不會被無關圖層的 toggle 波及。
 */
export function useLayerVisible(key: VisKey): boolean {
  const subscribe = useCallback(
    (cb: Listener) => layerVisibilityStore.subscribeKey(key, cb),
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => layerVisibilityStore.getVisibility(key),
    () => layerVisibilityStore.getVisibility(key),
  );
}

/**
 * 訂閱整包（給真的需要全 key 的消費者：LegendPanel 要掃 LEGEND_REGISTRY、
 * IconRailSidebar 要畫全清單）。任何 key 變動都會 re-render。
 */
export function useLayerVisibilityAll(): LayerVisibility {
  return useSyncExternalStore(
    layerVisibilityStore.subscribe,
    layerVisibilityStore.getAll,
    layerVisibilityStore.getAll,
  );
}
