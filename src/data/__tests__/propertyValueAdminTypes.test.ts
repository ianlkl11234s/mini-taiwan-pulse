import { describe, expect, it } from "vitest";
import {
  PROPERTY_VALUE_ADMIN_MISSING_COLOR,
  formatPropertyValueTwd,
  propertyValueAdminColorExpression,
  propertyValueAdminFeatureState,
  resolvePropertyValueAdminLevel,
} from "../propertyValueAdminTypes";

describe("property value administrative statistics", () => {
  it("keeps missing values visually distinct from zero", () => {
    const expression = propertyValueAdminColorExpression("county");
    expect(expression).toContain(PROPERTY_VALUE_ADMIN_MISSING_COLOR);
    expect(JSON.stringify(expression)).toContain('"feature-state","value_market_corrected"');
  });

  it("serializes only popup-safe primitive state", () => {
    expect(propertyValueAdminFeatureState({
      name: "嘉義市", code: "10020", n_buildings: 1, n_buildings_non_market: 0,
      gfa_m2: 2, value_market_corrected: 3, value_all: 4,
      value_non_market_excluded: 0, gfa_factor_used: 1,
    }, "county")).toEqual(expect.objectContaining({ admin_name: "嘉義市", admin_code: "10020", value_market_corrected: 3 }));
  });

  it("resolves levels and formats yuan without confusing it with wan", () => {
    expect(resolvePropertyValueAdminLevel(0)).toBe("county");
    expect(resolvePropertyValueAdminLevel(1)).toBe("township");
    expect(formatPropertyValueTwd(204.105e12)).toBe("204.1 兆元");
    expect(formatPropertyValueTwd(12.34e8)).toBe("12.3 億元");
  });
});
