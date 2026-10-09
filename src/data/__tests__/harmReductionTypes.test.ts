import { describe, expect, it } from "vitest";
import {
  DUI_YEAR_VALUES, NEEDLE_SERVICE_VALUES, TREATMENT_CATEGORY_VALUES,
  alcoholServiceFilter, duiCrashFilter, harmReductionPrecisionLabel, isEstimatedPrecision, needleServiceFilter,
  prepFundingFilter, treatmentCategoryFilter,
} from "../harmReductionTypes";
import { allMultiSelectBitmask } from "../multiSelectMapbox";

describe("harm reduction filters", () => {
  it("清潔針具：任一勾選服務存在即顯示；全關回傳恆假 filter", () => {
    const all = allMultiSelectBitmask(NEEDLE_SERVICE_VALUES);
    expect(needleServiceFilter(all)).toEqual(["any",
      ["==", ["get", "has_education_station"], true],
      ["==", ["get", "has_vending_machine"], true],
      ["==", ["get", "has_return_bin"], true],
    ]);
    expect(needleServiceFilter(0)).toEqual(["==", ["get", "name"], "__multi_select_none__"]);
  });

  it("清潔針具：只看 24 小時 = 勾選服務本身也要 24 小時", () => {
    expect(needleServiceFilter(2, 1)).toEqual(["any",
      ["all", ["==", ["get", "has_vending_machine"], true], ["==", ["get", "vending_is_24h"], true]],
    ]);
  });

  it("替代療法類別多選沿用共用 multiSelectFilter 語意", () => {
    expect(treatmentCategoryFilter(allMultiSelectBitmask(TREATMENT_CATEGORY_VALUES))).toEqual(["has", "category"]);
    expect(treatmentCategoryFilter(4)).toEqual(["in", ["get", "category"], ["literal", ["satellite_dosing_point"]]]);
  });

  it("座標精度：推估類明講，cached 不冒充門牌精確", () => {
    expect(isEstimatedPrecision("google_approximate")).toBe(true);
    expect(isEstimatedPrecision("interpolated")).toBe(true);
    expect(isEstimatedPrecision("cached")).toBe(false);
    expect(harmReductionPrecisionLabel("google_approximate")).toContain("推估");
    expect(harmReductionPrecisionLabel("cached")).toContain("精度未另標");
    expect(harmReductionPrecisionLabel("google_place_manual")).toContain("人工核對");
    expect(isEstimatedPrecision("google_place_manual")).toBe(false);
    expect(harmReductionPrecisionLabel("google_place")).toBe("依機構名稱查得位置");
    expect(isEstimatedPrecision("google_place")).toBe(false);
  });

  it("新精度值：健保登記地址與來源座標有明確文字，且不算推估", () => {
    expect(harmReductionPrecisionLabel("nhi_tgos")).toBe("依健保特約機構登記地址定位（TGOS）");
    expect(harmReductionPrecisionLabel("nhi_google")).toBe("依健保特約機構登記地址定位（Google）");
    expect(harmReductionPrecisionLabel("source")).toBe("座標由資料來源提供");
    for (const precision of ["nhi_tgos", "nhi_google", "source"]) expect(isEstimatedPrecision(precision)).toBe(false);
  });

  it("酒癮／PrEP：flag 多選任一成立；全關恆假", () => {
    expect(alcoholServiceFilter(4)).toEqual(["any", ["==", ["get", "is_dui_assessment"], true]]);
    expect(prepFundingFilter()).toEqual(["any",
      ["==", ["get", "public_funded"], true],
      ["==", ["get", "self_paid"], true],
    ]);
    expect(prepFundingFilter(0)).toEqual(["==", ["get", "name"], "__multi_select_none__"]);
  });

  it("酒駕事故：類別 × 年份（字串）× 判定口徑取交集", () => {
    expect(DUI_YEAR_VALUES[0]).toBe("107");
    expect(duiCrashFilter(1, 1 << 7, 1)).toEqual(["all",
      ["in", ["get", "accident_class"], ["literal", ["A1"]]],
      ["in", ["get", "year_roc"], ["literal", ["114"]]],
      ["in", ["get", "dui_cause_basis"], ["literal", ["primary"]]],
    ]);
    expect(duiCrashFilter()).toEqual(["all", ["has", "accident_class"], ["has", "year_roc"], ["has", "dui_cause_basis"]]);
  });
});
