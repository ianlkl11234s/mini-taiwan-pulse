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
 * 只有 `LAYER_PARAMS_SPEC` 列出的 key 走本 store；其餘仍由 `useLayerParamsRuntime`
 * 的 per-layer `useState` + 巨型 switch 提供。`useLayerParamsRuntime` 訂閱本 store 一次，
 * 於 `getControls` 與 `overlayParams` 兩處分岔 —— 見該檔的「雙軌」段。
 *
 * 寫入者：`buildParamControls` 產生的控件 onChange（＝面板上的 slider / select）。
 */

import { useCallback, useSyncExternalStore } from "react";
import {
  LAYER_PARAMS_SPEC, MIGRATED_PARAMS_KEYS, encodeParamValue, sharedSlotMembers, specOutKey,
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
 *
 * ⚠️ 收的是**陣列**不是單一 key —— 共用 slot（`sharedGroup`）一次寫入會動到
 * 多個 key，每個都得通知自己的訂閱者。只通知寫入端那個 key 的話，
 * 現況（消費者只有 `useLayerParamsRuntime` 的整包訂閱）看不出差別，
 * 但未來 `useLayerParams(夥伴 key)` 的元件會拿到過期值 —— 靜默的那一類。
 */
function notify(keys: readonly string[]): void {
  for (const key of keys) {
    const set = keyListeners.get(key);
    if (set) for (const cb of set) cb();
  }
  for (const cb of globalListeners) cb();
}

/** 一次寫入請求（尚未展開共用 slot） */
interface Write {
  key: string;
  name: string;
  value: ParamValue;
}

/** 這個參數宣告的 cascade 規則（沒宣告回空陣列） */
function paramCascade(key: string, name: string) {
  const spec = (LAYER_PARAMS_SPEC[key as keyof typeof LAYER_PARAMS_SPEC] as
    LayerParamSpec[] | undefined)?.find((s) => s.name === name);
  return spec?.cascade ?? [];
}

/**
 * 把一批寫入**合成一次** snapshot 置換 ＋ 每個受影響的 key 只通知一次。
 *
 * 共用 slot（`sharedGroup`）在這裡展開：一次 cascade 可能同時動到
 * 「源參數 × N 個成員」與「目標參數 × N 個成員」（裁處事件三兄弟就是 N=3）。
 * 拆成多次置換的話，中間狀態會被 listener 看見，且 notify 次數也對不上。
 */
function applyWrites(writes: readonly Write[]): void {
  const next = { ...snapshot };
  const changed = new Set<string>();
  for (const w of writes) {
    const targets = sharedSlotMembers(w.key, w.name) ?? [{ key: w.key, name: w.name }];
    for (const t of targets) {
      const cur = next[t.key];
      if (!cur || !(t.name in cur) || cur[t.name] === w.value) continue;
      next[t.key] = { ...cur, [t.name]: w.value };
      changed.add(t.key);
    }
  }
  if (changed.size === 0) return;
  snapshot = next;
  notify([...changed]);
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

  /** 整包快照（`useLayerParamsRuntime` 這種需要全部已遷移 key 的消費者用） */
  getAll(): LayerParamsSnapshot {
    return snapshot;
  },

  /**
   * 設定單一參數。同值 no-op（連 identity 都不換）。
   * 未遷移 / 未宣告的 (key, name) 一律忽略 —— 不靜默長出規格外的參數，
   * 那會讓「spec ＝ 全部參數」這個前提破功。
   *
   * ⚠️ 宣告了 `sharedGroup` 的參數會**連帶寫入同群的每個成員**（fall-through
   * `case "a": case "b":` 共用一個 useState 的等價實作）。少了這段，同群的 N 個
   * key 各存一份值、卻共用同一個 overlayParams `out` → 拖一邊 paint 不動。
   */
  setParam(key: string, name: string, value: ParamValue): void {
    const current = snapshot[key];
    if (!current || !(name in current)) return;
    if (current[name] === value) return;

    // 級聯（`cascade`）：控件 onChange 的副作用，例如「換大類 → 重設細項」。
    // ⚠️ **只展開一層** —— 目標被寫入時不再觸發目標自己的 cascade。手寫版
    //    `setYear(MIN)` 是直接呼叫 state setter、不經 year select 的 onChange；
    //    遞迴的話「按播放 → 倒帶 → 年份的 cascade 又把播放關掉」，播放鍵直接壞掉。
    const writes: Write[] = [{ key, name, value }];
    for (const rule of paramCascade(key, name)) {
      if (rule.whenSelfIs !== undefined && rule.whenSelfIs !== value) continue;
      if (rule.onlyWhenTargetIn && !rule.onlyWhenTargetIn.includes(current[rule.target] as ParamValue)) {
        continue;
      }
      writes.push({ key, name: rule.target, value: rule.set });
    }
    applyWrites(writes);
  },

  /**
   * 不走 cascade 的寫入 —— **程式內部**改值專用（目前唯一使用者：裁處事件的
   * 歷史播放引擎逐年推進）。等價手寫版直接呼叫 `setPollutionPenaltyYear(...)`：
   * 那條路徑本來就不經過年份 select 的 onChange，也就不會順帶把播放關掉。
   * 共用 slot 仍會展開（那不是副作用，是「同一份值」的本質）。
   */
  setParamDirect(key: string, name: string, value: ParamValue): void {
    const current = snapshot[key];
    if (!current || !(name in current)) return;
    if (current[name] === value) return;
    applyWrites([{ key, name, value }]);
  },

  /** 訂閱任何 key 的變動（`useLayerParamsRuntime` 走這條） */
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
 * `useLayerParamsRuntime` 把它 spread 進 overlayParams 物件，取代原本逐行手寫的
 * `xxxOpacity, xxxScale, xxxRegistryIdx: A.map(…).indexOf(…)`。
 *
 * 契約：`Record<string, number>` —— boolean 編 0/1、select 編 idx（見 spec 的 encode）。
 *
 * 共用 slot 的成員會**重複寫同一個 out key**，但 `setParam` 保證它們的值恆等，
 * 所以結果與順序無關（等價於原本那一份共用 useState 只寫一次）。
 *
 * ⚠️ `out: null` 的參數**整個跳過**（P3-2D 的第二條輸出通道）：它們的值走
 * `useLayerParamsRuntime` 的 `return {}`（refs / 子物件 / 平鋪欄位），本來就不在
 * overlayParams 裡。塞進來等於憑空多一個 paint 求值輸入。
 */
export function encodeParamsToOverlay(all: LayerParamsSnapshot): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of MIGRATED_PARAMS_KEYS) {
    const values = all[key];
    if (!values) continue;
    for (const spec of LAYER_PARAMS_SPEC[key] as LayerParamSpec[]) {
      const outKey = specOutKey(spec);
      if (outKey === null) continue;
      out[outKey] = encodeParamValue(spec, values[spec.name] ?? spec.default);
    }
  }
  return out;
}

// ── React 門面 ────────────────────────────────────────────────────

/**
 * 訂閱單一 layer 的參數。**只有這個 key 的參數變動時才 re-render。**
 * （P3-1 的消費者仍是 `useLayerParamsRuntime` 的整包訂閱；本 hook 是給
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

/** 訂閱整包（`useLayerParamsRuntime` 的雙軌橋接走這條） */
export function useAllLayerParams(): LayerParamsSnapshot {
  return useSyncExternalStore(
    layerParamsStore.subscribe,
    layerParamsStore.getAll,
    layerParamsStore.getAll,
  );
}
