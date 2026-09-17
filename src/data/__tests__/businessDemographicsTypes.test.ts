import { describe, expect, it } from "vitest";
import { COMPANY_INDUSTRY_MID_OPTIONS } from "../businessRegistryTypes";
import {
  COMPANY_DEMOGRAPHICS_SCALES, COMPANY_INDUSTRY_GROUPS, companyAgeColorExpr,
  companyDemographicsSumExpr, companyIndustryDominantColorExpr, companyIndustryFields,
} from "../businessDemographicsTypes";
// @ts-expect-error — style-spec 的 CJS 入口無型別宣告；需實際編譯／執行 Mapbox expression。
import { expression } from "mapbox-gl/dist/style-spec/index.cjs";

function evaluateColor(expr: unknown[], properties: Record<string, number>): string {
  const compiled = expression.createExpression(expr, {
    type: "color", "property-type": "data-driven",
    expression: { interpolated: false, parameters: ["feature"] },
  });
  if (compiled.result !== "success") throw new Error(String(compiled.value));
  const color = compiled.value.evaluate({ zoom: 8 }, { properties });
  return color.toString();
}

describe("公司人口結構格網契約", () => {
  it("十個產業群組只收 snapshot 合法中類，另有 unknown，預設全選不重複", () => {
    expect(COMPANY_INDUSTRY_GROUPS).toHaveLength(11);
    const known = COMPANY_INDUSTRY_GROUPS.slice(0, 10).flatMap((group) => group.codes);
    expect(new Set(known).size).toBe(89);
    expect(new Set(known)).toEqual(new Set(COMPANY_INDUSTRY_MID_OPTIONS.map((option) => option.value)));
    const fields = companyIndustryFields((1 << COMPANY_INDUSTRY_GROUPS.length) - 1);
    expect(fields).toHaveLength(90);
    expect(fields).toContain("i_unknown");
  });

  it("多選加總不以 0 填補缺失；單中類會覆蓋群組選擇", () => {
    const expression = companyDemographicsSumExpr(["i_01", "i_02"]);
    expect(JSON.stringify(expression)).not.toContain('"to-number"');
    expect(JSON.stringify(expression)).toContain('"typeof"');
    expect(companyIndustryFields(0, "62")).toEqual(["i_62"]);
  });

  it("兩個尺度與年齡分色保留 null 分支", () => {
    expect(COMPANY_DEMOGRAPHICS_SCALES.map((scale) => scale.sourceLayer)).toEqual(["company_demographics_grid", "company_demographics_grid"]);
    expect(companyAgeColorExpr(0)[0]).toBe("case");
    expect(companyAgeColorExpr(1)[0]).toBe("case");
  });

  it("主導群組顏色用 Mapbox 實際編譯並分開驗證最多、同量、真零、缺值與單中類", () => {
    const manufacturingAndRetail = (1 << 1) | (1 << 3);
    const props = Object.fromEntries(companyIndustryFields(manufacturingAndRetail).map((field) => [field, 0]));
    props.i_08 = 7; // 製造業
    props.i_45 = 3; // 批發零售
    expect(evaluateColor(companyIndustryDominantColorExpr(manufacturingAndRetail), props)).toBe("rgba(231,111,81,1)");

    props.i_45 = 7;
    expect(evaluateColor(companyIndustryDominantColorExpr(manufacturingAndRetail), props)).toBe("rgba(229,231,235,1)");

    props.i_08 = 0;
    props.i_45 = 0;
    expect(evaluateColor(companyIndustryDominantColorExpr(manufacturingAndRetail), props)).toBe("rgba(0,0,0,0)");

    const missing = { ...props };
    delete missing.i_08;
    expect(evaluateColor(companyIndustryDominantColorExpr(manufacturingAndRetail), missing)).toBe("rgba(71,85,105,1)");

    expect(evaluateColor(companyIndustryDominantColorExpr(0, "45"), { i_45: 1 })).toBe("rgba(69,123,157,1)");
  });
});
