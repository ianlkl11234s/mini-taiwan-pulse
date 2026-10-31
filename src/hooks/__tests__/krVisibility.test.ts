import { describe, expect, it } from "vitest";
import { LAYER_PARAMS_SPEC, type LayerParamSpec } from "../../data/layerParamsSpec";
import { KR_DATA_SPECS, krCatOptionIds, krGroupFilter, krSpecCatFilter } from "../../data/krDataLayers";
import { KR_FUEL_TYPES, KR_OIL_GAS_TYPES, KR_RAIL_LINE_CLASSES, KR_RAIL_NETWORKS, KR_VOLTAGE_CLASSES, KR_PLANT_FUELS, KR_RENEWABLE_FUELS } from "../../data/krInfraTypes";
import { KR_PLANT_FUEL_GROUPS, KR_RENEWABLE_FUEL_GROUPS, KR_PIPELINE_SUBSTANCES } from "../useKrEnergyLayers";

const specOf = (key: string) => (LAYER_PARAMS_SPEC as Record<string, readonly LayerParamSpec[]>)[key]!;
const optionValues = (key: string, name: string) => {
  const c = specOf(key).find((s) => s.kind === "multiSelect" && s.out === name);
  if (!c || c.kind !== "multiSelect") throw new Error(`${key}.${name} 沒有多選控件`);
  return c.options.map((o) => o.value);
};

describe("南韓 V-4 類別多選：規格選項與 filter 群組同序", () => {
  it.each(KR_DATA_SPECS.filter((s) => s.cats))("%s：控件選項＝cats＋其他", (spec) => {
    expect(optionValues(spec.key, `${spec.key}CatMask`)).toEqual(krCatOptionIds(spec));
  });
  it("手寫 hook 層的選項順序同圖例群組", () => {
    expect(optionValues("krRailStations", "krRailStationsCatMask")).toEqual(KR_RAIL_NETWORKS.map((n) => n.value));
    expect(optionValues("krRailLines", "krRailLinesCatMask")).toEqual(KR_RAIL_LINE_CLASSES.map((c) => c.value));
    expect(optionValues("krFuelStations", "krFuelStationsCatMask")).toEqual(KR_FUEL_TYPES.map((f) => f.value));
    expect(optionValues("krPowerPlants", "krPowerPlantsCatMask")).toEqual(KR_PLANT_FUEL_GROUPS.map((g) => g.id));
    expect(KR_PLANT_FUEL_GROUPS.map((g) => g.id)).toEqual([...KR_PLANT_FUELS]);
    expect(optionValues("krRenewables", "krRenewablesCatMask")).toEqual(KR_RENEWABLE_FUEL_GROUPS.map((g) => g.id));
    expect(KR_RENEWABLE_FUEL_GROUPS.map((g) => g.id)).toEqual([...KR_RENEWABLE_FUELS]);
    expect(optionValues("krPowerLines", "krPowerLinesCatMask")).toEqual(KR_VOLTAGE_CLASSES.map((v) => v.value));
    expect(optionValues("krSubstations", "krSubstationsCatMask")).toEqual(KR_VOLTAGE_CLASSES.map((v) => v.value));
    expect(optionValues("krOilGas", "krOilGasCatMask")).toEqual(KR_OIL_GAS_TYPES.map((t) => t.value));
    expect(optionValues("krOilGas", "krOilGasPipeMask")).toEqual(KR_PIPELINE_SUBSTANCES);
  });
});

describe("krGroupFilter", () => {
  const groups = [{ id: "a", values: ["A1", "A2"] }, { id: "b", values: ["B"] }];
  it("全選或未傳＝不篩（含缺值 feature）", () => {
    expect(krGroupFilter("g", groups, true, undefined)).toBeNull();
    expect(krGroupFilter("g", groups, true, 0b111)).toBeNull();
    expect(krGroupFilter("g", groups, false, 0b11)).toBeNull();
  });
  it("全關＝永假 sentinel", () => {
    expect(krGroupFilter("g", groups, true, 0)).toEqual(["==", "g", "__multi_select_none__"]);
  });
  it("部分選取：in；選『其他』補上不屬任何已列類別", () => {
    expect(krGroupFilter("g", groups, true, 0b001)).toEqual(["in", "g", ["literal", ["A1", "A2"]]]);
    expect(krGroupFilter("g", groups, true, 0b100)).toEqual(["!", ["in", "g", ["literal", ["A1", "A2", "B"]]]]);
    expect(krGroupFilter("g", groups, true, 0b110)).toEqual(["any", ["in", "g", ["literal", ["B"]]], ["!", ["in", "g", ["literal", ["A1", "A2", "B"]]]]]);
  });
  it("首爾地鐵擁擠度以尖峰值分級（無值＝其他）", () => {
    const spec = KR_DATA_SPECS.find((s) => s.key === "krSeoulSubwayCongestion")!;
    const f = JSON.stringify(krSpecCatFilter(spec, 0b00001));
    expect(f).toContain("peak_wkd");
    expect(f).toContain("<34");
  });
});

describe("南韓 V-1：點層 minzoom 不比圖磚晚超過 1 級（熱區層除外）", () => {
  it.each(KR_DATA_SPECS.filter((s) => s.geom === "point" && !s.heat))("%s", (spec) => {
    // 已知例外：首爾地鐵（272 站僅首爾）、位置標示板、行道樹（圖磚 z13 起）屬涵蓋範圍或另案重切
    const exempt = ["krSeoulSubwayCongestion", "krNpLocationSigns", "krStreetTrees"];
    if (exempt.includes(spec.key)) return;
    expect(spec.minzoom - Math.max(spec.srcMinzoom, 4)).toBeLessThanOrEqual(1);
  });
});
