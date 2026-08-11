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
import { getParamsSpec, type LayerParamValues } from "../data/layerParamsSpec";
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
  return spec.map((s) => {
    switch (s.kind) {
      case "slider": {
        const v = values[s.name];
        const value = typeof v === "number" ? v : s.default;
        return {
          label: `${s.labelPrefix} ${value.toFixed(s.digits)}`,
          value, min: s.min, max: s.max, step: s.step,
          onChange: (next: number) => layerParamsStore.setParam(key, s.name, next),
        };
      }
      case "toggle": {
        const v = values[s.name];
        return {
          type: "toggle" as const,
          label: s.label,
          value: typeof v === "boolean" ? v : s.default,
          onChange: (next: boolean) => layerParamsStore.setParam(key, s.name, next),
        };
      }
      case "select": {
        const v = values[s.name];
        return {
          type: "select" as const,
          label: s.label,
          value: typeof v === "string" ? v : s.default,
          options: s.options,
          onChange: (next: string) => layerParamsStore.setParam(key, s.name, next),
        };
      }
    }
  });
}
