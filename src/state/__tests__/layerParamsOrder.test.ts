/**
 * 設定區順序護欄（layer-panel-unify P5，spec §5.11）
 *
 * 展開區控制項一律：資料篩選 → 顏色 → 透明度 → 大小 → 其他外觀（說明・來源由 ExpandedControls 放最後）。
 * - 每個控制項都要分得出類：新圖層用了詞彙表沒有的標籤就紅 → 在 `layerParamsSpec.ts` 的
 *   `CATEGORY_BY_LABEL` 補一列，或在該控制項寫 `category`。
 * - `buildParamControls` 的輸出名次單調不減（含 showWhen 條件成立後才出現的控件）。
 */
import { describe, expect, it } from "vitest";
import {
  LAYER_PARAMS_SPEC, PARAM_CONTROL_CATEGORY_ORDER, paramControlRank, paramControlCategory, type LayerParamSpec,
} from "../../data/layerParamsSpec";
import { buildParamControls } from "../layerParamsControls";

const SPEC = LAYER_PARAMS_SPEC as Readonly<Record<string, readonly LayerParamSpec[]>>;
const controlLabel = (spec: LayerParamSpec) => (spec.kind === "slider" ? spec.labelPrefix : spec.label);

describe("設定區順序（P5）", () => {
  it("每個控制項都分得出類別", () => {
    const unknown = Object.entries(SPEC).flatMap(([key, list]) =>
      list.filter((spec) => paramControlCategory(spec) === null).map((spec) => `${key}:${spec.name}「${controlLabel(spec)}」`));
    expect(unknown).toEqual([]);
  });

  it("buildParamControls 依 資料篩選→顏色→透明度→大小→其他外觀 輸出", () => {
    const violations: string[] = [];
    for (const [key, list] of Object.entries(SPEC)) {
      const controls = buildParamControls(key) ?? [];
      // 控件輸出沒有 name：用 label 前綴對回 spec（取最長的相符前綴；select 標籤隨值改變而對不到的略過）
      const ranks = controls.map((control) => {
        const matches = list.filter((candidate) => control.label.startsWith(controlLabel(candidate)));
        const spec = matches.sort((a, b) => controlLabel(b).length - controlLabel(a).length)[0];
        return spec ? paramControlRank(spec) : -1;
      });
      for (let i = 1; i < ranks.length; i += 1) {
        if (ranks[i]! >= 0 && ranks[i - 1]! >= 0 && ranks[i]! < ranks[i - 1]!) violations.push(`${key}: ${controls.map((c) => c.label).join(" / ")}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("汙染裁處與汙染設施：資料篩選在透明度之前（R7 留下的例外）", () => {
    for (const key of ["pollutionFacility", "pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"]) {
      const roles = (SPEC[key] ?? []).map((spec) => paramControlCategory(spec));
      expect(roles.length, key).toBeGreaterThan(0);
      const sorted = [...(SPEC[key] ?? [])].sort((a, b) => paramControlRank(a) - paramControlRank(b)).map((spec) => paramControlCategory(spec));
      expect(sorted.indexOf("opacity"), key).toBeGreaterThan(sorted.lastIndexOf("data"));
      expect(PARAM_CONTROL_CATEGORY_ORDER.indexOf("data")).toBeLessThan(PARAM_CONTROL_CATEGORY_ORDER.indexOf("opacity"));
    }
  });

  it("熱區層：顏色在透明度之前、資料篩選之後", () => {
    const sorted = [...(SPEC.religionTemples ?? [])].sort((a, b) => paramControlRank(a) - paramControlRank(b)).map((spec) => paramControlCategory(spec));
    expect(sorted).toEqual(["data", "data", "color", "opacity", "size"]);
  });
});
