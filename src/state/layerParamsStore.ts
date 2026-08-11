/**
 * Layer Params Store（AR-22 Phase 3 / P3-1）
 *
 * 圖層參數值的 SSOT。模式完全比照 `layerVisibilityStore.ts`（AR-21 已驗證，
 * 再往上是 `timeStore.ts` —— 本專案自家寫法，不引入 zustand/jotai）：
 *   模組級 state + getter/setter + subscribe，寫入時同值不通知（消除 identity churn）；
 *   React 端一律走 `useSyncExternalStore`，不維護第二份 useState 副本。
 *
 * 與 visibility store 的差別只有一層巢狀：value 是 `Record<paramName, ParamValue>`
 * 而不是 boolean。**per-key 的內層物件 identity 只在該 key 真的變動時才換新** ——
 * 否則 `useLayerParams(key)` 的 `useSyncExternalStore` 會每次拿到新物件而無限迴圈。
 *
 * ── 雙軌過渡（P3-1 → 全量）────────────────────────────────────────
 * 只有 `LAYER_PARAMS_SPEC` 列出的 key 走本 store；其餘仍由 `useTransportParams`
 * 的 per-layer `useState` + 巨型 switch 提供。`useTransportParams` 訂閱本 store 一次，
 * 於 `getControls` 與 `overlayParams` 兩處分岔 —— 見該檔的「雙軌」段。
 *
 * 寫入者：`buildParamControls` 產生的控件 onChange（＝面板上的 slider / select）。
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, encodeParamValue, specOutKey,
  type LayerParamSpec, type LayerParamValues, type ParamValue,
} from "../data/layerParamsSpec";

type Listener = () => void;

/** 全部已遷移 key 的參數值快照 */
export type LayerParamsSnapshot = Readonly<Record<string, LayerParamValues>>;

/** 規格的預設值 → 初始快照 */
export function buildDefaultParams(): LayerParamsSnapshot {
  const out: Record<string, LayerParamValues> = {};
  for (const key of MIGRATED_PARAMS_KEYS) {
    const values: Record<string, ParamValue> = {};
    for (const spec of LAYER_PARAMS_SPEC[key] as LayerParamSpec[]) {
      values[spec.name] = spec.default;
    }
    out[key] = values;
  }
  return out;
}

let snapshot: LayerParamsSnapshot = buildDefaultParams();

/** 未遷移 key 的穩定空物件 —— 每次回傳新的 `{}` 會讓 useSyncExternalStore 無限迴圈 */
const EMPTY: LayerParamValues = Object.freeze({});

const globalListeners = new Set<Listener>();
/** per-key 訂閱者；只有該 key 真的變動時才通知 */
const keyListeners = new Map<string, Set<Listener>>();

/**
 * 通知順序刻意固定（同 visibility store）：**先換 snapshot 再通知**
 * （listener 讀到的都是已完成的新狀態）；先 per-key 後 global，global 只發一次。
 */
function notify(key: string): void {
  const set = keyListeners.get(key);
  if (set) for (const cb of set) cb();
  for (const cb of globalListeners) cb();
}

export const layerParamsStore = {
  /**
   * 單一 layer 的全部參數值。未遷移的 key 回**同一個** frozen 空物件。
   * 回傳物件請視為 immutable —— 它就是 useSyncExternalStore 的 snapshot。
   */
  getParams(key: string): LayerParamValues {
    return snapshot[key] ?? EMPTY;
  },

  /** 單一參數值；查無回 undefined（呼叫端多半用 spec.default 兜底） */
  getParam(key: string, name: string): ParamValue | undefined {
    return snapshot[key]?.[name];
  },

  /** 整包快照（`useTransportParams` 這種需要全部已遷移 key 的消費者用） */
  getAll(): LayerParamsSnapshot {
    return snapshot;
  },

  /**
   * 設定單一參數。同值 no-op（連 identity 都不換）。
   * 未遷移 / 未宣告的 (key, name) 一律忽略 —— 不靜默長出規格外的參數，
   * 那會讓「spec ＝ 全部參數」這個前提破功。
   */
  setParam(key: string, name: string, value: ParamValue): void {
    const current = snapshot[key];
    if (!current || !(name in current)) return;
    if (current[name] === value) return;
    snapshot = { ...snapshot, [key]: { ...current, [name]: value } };
    notify(key);
  },

  /** 訂閱任何 key 的變動（`useTransportParams` 走這條） */
  subscribe(cb: Listener): () => void {
    globalListeners.add(cb);
    return () => globalListeners.delete(cb);
  },

  /** 訂閱單一 layer 的參數變動 —— 只有該 key 變動才觸發 */
  subscribeKey(key: string, cb: Listener): () => void {
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

  /** 測試 / 重置用：全部回到規格的 default */
  reset(): void {
    const next = buildDefaultParams();
    const changed = MIGRATED_PARAMS_KEYS.filter((k) => {
      const a = snapshot[k];
      const b = next[k];
      if (!a || !b) return true;
      return Object.keys(b).some((n) => a[n] !== b[n]);
    });
    if (changed.length === 0) return;
    snapshot = next;
    for (const k of changed) {
      const set = keyListeners.get(k);
      if (set) for (const cb of set) cb();
    }
    for (const cb of globalListeners) cb();
  },
};

export type LayerParamsStore = typeof layerParamsStore;

// ── overlayParams 編碼 ────────────────────────────────────────────

/**
 * 已遷移 key 的 overlayParams 分片。**這是 paint 真正吃到的東西**——
 * `useTransportParams` 把它 spread 進 overlayParams 物件，取代原本逐行手寫的
 * `xxxOpacity, xxxScale, xxxRegistryIdx: A.map(…).indexOf(…)`。
 *
 * 契約：`Record<string, number>` —— boolean 編 0/1、select 編 idx（見 spec 的 encode）。
 */
export function encodeParamsToOverlay(all: LayerParamsSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of MIGRATED_PARAMS_KEYS) {
    const values = all[key];
    if (!values) continue;
    for (const spec of LAYER_PARAMS_SPEC[key] as LayerParamSpec[]) {
      out[specOutKey(spec)] = encodeParamValue(spec, values[spec.name] ?? spec.default);
    }
  }
  return out;
}

// ── React 門面 ────────────────────────────────────────────────────

/**
 * 訂閱單一 layer 的參數。**只有這個 key 的參數變動時才 re-render。**
 * （P3-1 的消費者仍是 `useTransportParams` 的整包訂閱；本 hook 是給
 * 未來直接吃參數的元件用 —— 那才是拆掉「一個 slider 動、整棵樹 reconcile」的終點。）
 */
export function useLayerParams(key: string): LayerParamValues {
  const subscribe = useCallback(
    (cb: Listener) => layerParamsStore.subscribeKey(key, cb),
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => layerParamsStore.getParams(key),
    () => layerParamsStore.getParams(key),
  );
}

/** 訂閱整包（`useTransportParams` 的雙軌橋接走這條） */
export function useAllLayerParams(): LayerParamsSnapshot {
  return useSyncExternalStore(
    layerParamsStore.subscribe,
    layerParamsStore.getAll,
    layerParamsStore.getAll,
  );
}
