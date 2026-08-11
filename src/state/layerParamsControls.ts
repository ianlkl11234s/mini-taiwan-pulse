/**
 * 通用 getControls 渲染器（AR-22 P3-1）
 *
 * 從 `LAYER_PARAMS_SPEC` + store 當下值產生 `ParamControl[]`，形狀與
 * `useTransportParams` 巨型 switch 裡的手寫 case **完全相同**。
 * 黃金快照的 `params` section（348 key × getControls 輸出，onChange 已剔除）
 * 就是這件事的機械證明：搬一個 key 進規格、從 switch 刪掉它的 case，
 * fixture 必須一位元不變。
 *
 * 獨立成檔而不併進 store，是為了讓相依方向乾淨：
 * store 只管「值」（不認識 UI 型別 `ParamControl`），本檔才是 spec → UI 的橋。
 */

import type { ParamControl } from "../hooks/useTransportParams";
import {
  getParamsSpec, resolveParamValues, resolveSelectOptions, visibleParamsSpec,
  type LayerParamValues,
} from "../data/layerParamsSpec";
import { layerParamsStore } from "./layerParamsStore";

/**
 * ⚠️ slider **不帶 `type` 欄位** —— `SliderConfig.type` 是選填，現行手寫 case
 * 一律省略。多輸出一個 `type: "slider"` 會讓黃金快照 params section 立刻紅，
 * 而且它正是「編得過但值悄悄不一樣」那一類，只有快照擋得住。
 *
 * 未遷移的 key 回 `null` —— 呼叫端據此 fallthrough 到既有 switch（雙軌）。
 */
export function buildParamControls(
  key: string,
  values: LayerParamValues = layerParamsStore.getParams(key),
): ParamControl[] | null {
  const spec = getParamsSpec(key);
  if (!spec) return null;
  // `showWhen` 的控件在條件不成立時整個不渲染（等價於手寫版的 `...(cond ? [x] : [])`）；
  // `resolved` 讓 showWhen / disableRule 一定查得到值（傳入的快照可能只有部分欄位）。
  const resolved = resolveParamValues(spec, values);
  return visibleParamsSpec(spec, values).map((s) => {
    switch (s.kind) {
      case "slider": {
        const v = values[s.name];
        const value = typeof v === "number" ? v : s.default;
        // 0 有「關掉」語意的滑桿印字不印數（`全台顯示 關`）；
        // `displayScale` 是「印之前先乘一個倍率」（極小數的軌道球半徑），只動 label。
        const shown = s.zeroLabel !== undefined && value === 0
          ? s.zeroLabel
          : (s.displayScale === undefined ? value : value * s.displayScale).toFixed(s.digits);
        return {
          // 前綴側預設補一個空白（`labelSep` 可改成 ""）；後綴側緊接數字不補空白
          // （`Z 漂浮 12px` / `大小 1.00×` / `保留 10 min`）。兩欄都省略時，
          // 輸出與 P3-1 定的 `${labelPrefix} ${toFixed}` 一位元不變。
          label: `${s.labelPrefix}${s.labelSep ?? " "}${shown}${s.labelSuffix ?? ""}`,
          value, min: s.min, max: s.max, step: s.step,
          onChange: (next: number) => layerParamsStore.setParam(key, s.name, next),
        };
      }
      case "toggle": {
        const v = values[s.name];
        const value = typeof v === "boolean" ? v : s.default;
        return {
          type: "toggle" as const,
          // 值相依 label（播放鍵的 ⏸/▶）；查無對應回 `label` 兜底，同 select 的慣例
          label: s.labelByValue?.[String(value)] ?? s.label,
          value,
          onChange: (next: boolean) => layerParamsStore.setParam(key, s.name, next),
        };
      }
      case "select": {
        const v = values[s.name];
        const value = typeof v === "string" ? v : s.default;
        return {
          type: "select" as const,
          // label 隨當前值變的 select（品項 / 作物）；查無對應回 `label` 兜底 ——
          // 與手寫 case 的 `OPTIONS[idx] ?? "全部"` 同語意。
          label: s.labelByValue?.[value] ?? s.label,
          value,
          // `disableRule` 會依別的參數當下的值算出每個選項的 disabled ＋ 原因後綴
          options: resolveSelectOptions(s, resolved),
          onChange: (next: string) => layerParamsStore.setParam(key, s.name, next),
        };
      }
    }
  });
}
