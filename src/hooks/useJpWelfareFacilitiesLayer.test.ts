import { describe, expect, it } from "vitest";
import {
  JP_WELFARE_CATEGORIES, JP_WELFARE_COLOR_EXPRESSION, JP_WELFARE_POINT_COUNT, JP_WELFARE_OTHER_COLOR,
  jpWelfareCategoriesOf, jpWelfareFilter, jpWelfareGroupsOf,
} from "../data/jpWelfareFacilityTypes";
import { paramDefault, LAYER_PARAMS_SPEC } from "../data/layerParamsSpec";

describe("日本福祉設施 PMTiles 契約", () => {
  it("20 個中分類：障礙 4、兒童 16；筆數合計 154,572 且與各層點數一致", () => {
    expect(jpWelfareCategoriesOf("disability").map((c) => c.code)).toEqual(["0301", "0302", "0303", "9911"]);
    expect(jpWelfareCategoriesOf("child")).toHaveLength(16);
    const sum = (m: "disability" | "child") => jpWelfareCategoriesOf(m).reduce((n, c) => n + c.count, 0);
    expect(sum("disability")).toBe(JP_WELFARE_POINT_COUNT.jpWelfareDisability);
    expect(sum("child")).toBe(JP_WELFARE_POINT_COUNT.jpWelfareChild);
    expect(JP_WELFARE_CATEGORIES.reduce((n, c) => n + c.count, 0)).toBe(154_572);
    expect(JP_WELFARE_COLOR_EXPRESSION.slice(0, 2)).toEqual(["match", ["get", "category_code"]]);
    expect(JP_WELFARE_COLOR_EXPRESSION[JP_WELFARE_COLOR_EXPRESSION.length - 1]).toBe(JP_WELFARE_OTHER_COLOR);
  });

  it("篩選：預設 major＋位置正確度 ≤3；色組用 in、中分類用 ==；無效 fail closed", () => {
    expect(jpWelfareFilter("child", 0, 0)).toEqual(["all", ["==", ["get", "major"], "child"], ["<=", ["get", "position_accuracy"], 3]]);
    expect(jpWelfareFilter("child", 0, 1)).toEqual(["all", ["==", ["get", "major"], "child"]]);
    const groups = jpWelfareGroupsOf("child");
    expect(groups[0]!.value).toBe("residential");
    expect(jpWelfareFilter("child", 1, 1)).toEqual(["all", ["==", ["get", "major"], "child"],
      ["in", ["get", "category_code"], ["literal", ["0502", "0507", "0508", "0510", "0511"]]]]);
    expect(jpWelfareFilter("disability", jpWelfareGroupsOf("disability").length + 4, 1))
      .toEqual(["all", ["==", ["get", "major"], "disability"], ["==", ["get", "category_code"], "9911"]]);
    expect(jpWelfareFilter("disability", 99, 0)).toEqual(["literal", false]);
    expect(jpWelfareFilter("disability", 0, 2)).toEqual(["literal", false]);
  });

  it("select 選項順序與 jpWelfareFilter 一致；預設只畫精確點", () => {
    for (const [key, major] of [["jpWelfareDisability", "disability"], ["jpWelfareChild", "child"]] as const) {
      const spec = LAYER_PARAMS_SPEC[key].find((s) => s.kind === "select" && s.name === `${key}Category`) as { options: { value: string }[] };
      expect(spec.options).toHaveLength(1 + jpWelfareGroupsOf(major).length + jpWelfareCategoriesOf(major).length);
      expect(paramDefault(key, `${key}Accuracy`)).toBe("precise");
    }
  });
});
