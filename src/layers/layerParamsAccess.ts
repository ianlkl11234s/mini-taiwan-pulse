// ══════════════════════════════════════════════════════════════════
//  Layer Params Access — Host 端的 per-key 參數讀取（AR-22 P1）
// ══════════════════════════════════════════════════════════════════
//
// Host 不再吃 App 的 `useLayerParamsRuntime()` 整包快照，改用
// `useLayerParams(key)`（per-key `useSyncExternalStore`，只有該 key 變動才通知）。
//
// ── 為什麼要「per-key overlayParams 分片」而不是直接讀原始值 ──────────
// 呼叫端現況長這樣：
//   `transportParams.overlayParams.iotWraRiverScale ?? 1`
//   `!!(transportParams.overlayParams.iotWraRiverShowMeasured ?? 1)`
//   `(["all","jma","jtwc"][transportParams.overlayParams.typhoonSourceIdx ?? 0] ?? "all")`
//
// `overlayParams` 是**編碼後**的 `Record<string, number>`：toggle 編成 0/1、
// select 編成選項索引、key 是 spec 的 `out` 而不是參數名。直接改讀 store 原始值
// （boolean / 字串）等於在 66 個呼叫點各做一次手工轉譯 —— 66 次靜默走味的機會，
// 而且 tsc 擋不住（`!!true` 與 `!!1` 都合法、都不紅）。
//
// 所以本檔提供 `encodeKeyOverlay`：**逐字照抄 `encodeParamsToOverlay` 的內圈**，
// 只是把 `for (const key of MIGRATED_PARAMS_KEYS)` 換成單一 key。呼叫端的
// `?? default` / `!!` / `[...][idx]` 因此**一個字都不用改**。
//
// 逐位相同的理由：`encodeParamsToOverlay` 的外圈對每個 key 獨立寫 `out[outKey]`，
// key 之間沒有任何交互。唯一會重複寫同一個 outKey 的是共用 slot（`sharedGroup`），
// 而 store 的 `setParam` 保證同群成員的值恆等 —— 誰後寫結果都一樣。
//
// ⚠️ **不從 `useLayerParamsRuntime.ts` import 讀取器**：那支檔有兩道文字護欄
// （`overlayParamsDeps` 的 MEMO_START 哨兵、`layerParamsSharedState` 的 switch 掃描）
// 盯著它的原始碼，本棒一個字都不動它。下面三支 `p*` 是它 L64-80 的等價複製。

import { useMemo } from "react";
import {
  LAYER_PARAMS_SPEC, encodeParamValue, paramDefault, specOutKey,
  type LayerParamSpec, type LayerParamValues,
} from "../data/layerParamsSpec";
import { useLayerParams } from "../state/layerParamsStore";

/** 這個 key 的規格（未遷移 / 無控件的 key 回 undefined） */
function specsOf(key: string): LayerParamSpec[] | undefined {
  return LAYER_PARAMS_SPEC[key as keyof typeof LAYER_PARAMS_SPEC] as LayerParamSpec[] | undefined;
}

/**
 * 單一 key 的 overlayParams 分片。
 * 與 `encodeParamsToOverlay(全快照)` 中屬於本 key 的那些 out 欄位**逐位相同**。
 *
 * ⚠️ `out: null` 的參數整個跳過（同 store 的第二輸出通道規則）——
 * 它們的值不在 overlayParams 裡，要讀請用下方的 `paramNum` / `paramBool` / `paramStr`。
 */
export function encodeKeyOverlay(key: string, values: LayerParamValues): Record<string, number> {
  const out: Record<string, number> = {};
  const specs = specsOf(key);
  if (!specs) return out;
  for (const spec of specs) {
    const outKey = specOutKey(spec);
    if (outKey === null) continue;
    out[outKey] = encodeParamValue(spec, values[spec.name] ?? spec.default);
  }
  return out;
}

/**
 * 訂閱單一 layer 的參數並編成 overlayParams 分片。
 *
 * identity 由 `useMemo` 釘住、deps 取 store 的 per-key 快照 —— store 保證
 * 「只有這個 key 真的變動時才換 identity」，所以下游 hook 的 deps 比對行為
 * 與原本吃 `transportParams.overlayParams.<欄位>` 純量時一致。
 */
export function useKeyOverlayParams(key: string): Record<string, number> {
  const values = useLayerParams(key);
  return useMemo(() => encodeKeyOverlay(key, values), [key, values]);
}

// ── 原始值讀取器（`out: null` 的第二通道參數用）────────────────────
//
// 查無值時退回規格 `default`：正常路徑上不會發生（store 的 slot 就是規格宣告的），
// 但這條路徑在 render 期間，throw 等於整頁白畫面 —— 回退比炸掉安全。
// 逐字等價於 `useLayerParamsRuntime.ts` 的 `pNum` / `pBool` / `pStr`。

/** slider ／ 數值型 select（store 存字串、消費端要數字） */
export function paramNum(values: LayerParamValues, key: string, name: string): number {
  const v = values[name] ?? paramDefault(key, name);
  return typeof v === "number" ? v : Number(v);
}

/** toggle */
export function paramBool(values: LayerParamValues, key: string, name: string): boolean {
  const v = values[name] ?? paramDefault(key, name);
  return typeof v === "boolean" ? v : Boolean(v);
}

/** select（字串原值；要窄化成字面聯集時在呼叫端比對，不做無憑據的 `as`） */
export function paramStr(values: LayerParamValues, key: string, name: string): string {
  const v = values[name] ?? paramDefault(key, name);
  return typeof v === "string" ? v : String(v);
}

/** 從允許清單窄化字串（不在清單內回 fallback）—— 同 runtime 的 `oneOf` */
export function oneOfParam<T extends string>(v: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** 同上，數值版（新聞三軸的 `0 | 2 | 3` 這種字面聯集）—— 同 runtime 的 `oneOfNum` */
export function oneOfParamNum<T extends number>(v: number, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly number[]).includes(v) ? (v as T) : fallback;
}

export { useLayerParams };
