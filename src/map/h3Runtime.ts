/**
 * h3-js 按需載入（C1 首屏瘦身）。
 *
 * h3-js（emscripten，~600KB）只有 H3 網格圖層把 cell 轉成多邊形時才需要，
 * 不該進首屏 bundle。各 layer factory 的 update* 仍是同步 API：
 * 需要 h3 但尚未載入時，先記下「這個 key 最新的一次呼叫」，載入完成後重跑它
 * （last-write-wins：載入期間被新呼叫取代的舊參數不會再套用）。
 */
import { withLoading } from "../lib/loadingRegistry";

type H3Module = typeof import("h3-js");

let h3: H3Module | null = null;
let pending: Promise<H3Module> | null = null;
const deferred = new Map<string, () => void>();

/** 載入 h3-js（快取；失敗會清掉快取讓下次重試）。 */
export function loadH3(): Promise<H3Module> {
  if (h3) return Promise.resolve(h3);
  if (!pending) {
    pending = import("h3-js").then(
      (mod) => { h3 = mod; return mod; },
      (err) => { pending = null; throw err; },
    );
  }
  return pending;
}

/** 已載入的 h3-js；未載入時丟錯（呼叫端應先經過 deferUntilH3）。 */
export function requireH3(): H3Module {
  if (!h3) throw new Error("h3-js not loaded yet");
  return h3;
}

/**
 * 需要 h3 且尚未載入 → 記下 retry、啟動載入（掛 loadingRegistry），回傳 true（呼叫端應 return）。
 * 不需要 h3 或已載入 → 取消該 key 等待中的舊呼叫，回傳 false（呼叫端照常同步執行）。
 */
export function deferUntilH3(key: string, needsH3: boolean, retry: () => void): boolean {
  if (!needsH3 || h3) {
    deferred.delete(key);
    return false;
  }
  deferred.set(key, retry);
  void withLoading("h3-js", "H3 網格工具", loadH3()).then(
    () => {
      const fn = deferred.get(key);
      deferred.delete(key);
      fn?.();
    },
    (err) => {
      deferred.delete(key);
      console.error("[h3Runtime] failed to load h3-js", err);
    },
  );
  return true;
}
