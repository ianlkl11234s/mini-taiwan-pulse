import { describe, expect, it } from "vitest";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";
import { GB_CARE_KINDS, GB_COURT_KINDS, GB_HEALTH_KINDS, GB_SCHOOL_CATEGORIES } from "../gbCivicTypes";
import { GB_ARTS_KINDS, GB_CULTURAL_KINDS, GB_VISITOR_KINDS } from "../gbCultureTypes";
import { GB_HUB_TYPES, GB_LONDON_RAIL_MODES } from "../gbTransportTypes";
import { GB_FIELD_TYPES, GB_FUEL_GROUPS } from "../gbEnergyTypes";
import { GB_RECYCLING_KINDS } from "../gbEnvPlanningTypes";
import { GB_AQUACULTURE_KINDS, GB_FUNERAL_KINDS } from "../gbBusinessAgriTypes";
import { GB_ACCESS_TYPES, GB_MPA_TYPES, GB_RECREATION_CATEGORIES, GB_TREE_CATEGORIES } from "../gbNatureTypes";
import { GB_GREENSPACE_CATEGORIES } from "../gbOpenSpaceTypes";

/**
 * §3.8 V-4 英國類別多選：mask 的 bit 順序＝spec options 順序，hook 用同一份資料陣列解碼（gbMaskFilter）。
 * 兩邊順序或值不一致，勾選 A 會篩成 B——這裡逐層對齊 spec options 與 hook 篩選用的資料陣列。
 */
const HOOK_VALUES: Readonly<Record<string, readonly string[]>> = {
  gbSchools: GB_SCHOOL_CATEGORIES.map((c) => c.value),
  gbHealthFacilities: GB_HEALTH_KINDS.map((k) => k.value),
  gbCareHomes: GB_CARE_KINDS.filter((k) => k.home).map((k) => k.value),
  gbCareServices: GB_CARE_KINDS.filter((k) => !k.home).map((k) => k.value),
  gbCourts: GB_COURT_KINDS.map((k) => k.value),
  gbCulturalFacilities: GB_CULTURAL_KINDS.map((k) => k.value),
  gbArtsVenues: GB_ARTS_KINDS.map((k) => k.value),
  gbVisitorExperience: GB_VISITOR_KINDS.map((k) => k.value),
  gbTransportHubs: GB_HUB_TYPES.map((t) => t.value),
  gbLondonRailLines: GB_LONDON_RAIL_MODES.map((m) => m.value),
  gbPowerPlants: GB_FUEL_GROUPS.map((g) => g.value),
  gbOilGasFields: GB_FIELD_TYPES.map((f) => f.value),
  gbRecyclingCentres: GB_RECYCLING_KINDS.map((k) => k.value),
  gbFuneral: GB_FUNERAL_KINDS.map((k) => k.value),
  gbAquaculture: GB_AQUACULTURE_KINDS.map((k) => k.value),
  gbMarineProtectedAreas: GB_MPA_TYPES.map((m) => m.value),
  gbForestRecreation: GB_RECREATION_CATEGORIES.map((c) => c.value),
  gbOpenAccessLand: GB_ACCESS_TYPES.map((a) => a.value),
  gbTreeProtection: GB_TREE_CATEGORIES.map((c) => c.value),
  gbGreenspace: GB_GREENSPACE_CATEGORIES.gbGreenspace.functions.map((f) => f.value),
  gbSportsFacilities: GB_GREENSPACE_CATEGORIES.gbSportsFacilities.functions.map((f) => f.value),
  gbCemeteries: GB_GREENSPACE_CATEGORIES.gbCemeteries.functions.map((f) => f.value),
};

type Spec = { kind: string; name: string; options?: { value: string }[] };

describe("英國類別多選（§3.8 V-4）", () => {
  it.each(Object.entries(HOOK_VALUES))("%s：spec options 值與順序＝hook 篩選陣列", (key, values) => {
    const spec = (LAYER_PARAMS_SPEC as unknown as Record<string, Spec[]>)[key]!;
    const multi = spec.find((s) => s.kind === "multiSelect" && s.name === `${key}Category`);
    expect(multi, `${key} 沒有 ${key}Category 多選`).toBeDefined();
    expect(multi!.options!.map((o) => o.value)).toEqual(values);
  });

  it("運動場地不含高爾夫球場（已拆成 gbGolfCourses）", () => {
    expect(HOOK_VALUES.gbSportsFacilities).not.toContain("Golf Course");
    expect(GB_GREENSPACE_CATEGORIES.gbGolfCourses.functions.map((f) => f.value)).toEqual(["Golf Course"]);
  });
});
