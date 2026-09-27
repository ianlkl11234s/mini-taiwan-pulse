import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { VIZ_SPEC } from "../vizSpec";
import { WAREHOUSE_STYLE_RENDERERS } from "../warehouseResultStyle";

describe("viz-spec contract", () => {
  it("has not drifted from the checked-in sha256 (edit both the spec and the hash together, never just one)", () => {
    const bytes = readFileSync(resolve(__dirname, "../contracts/viz-spec.json"));
    const expected = readFileSync(resolve(__dirname, "../contracts/viz-spec.sha256"), "utf8").trim();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
  });

  it("keeps the warehouse style registry's key set in lockstep with the mcp STYLE_REGISTRY (stage B: 5 kinds)", () => {
    expect(Object.keys(WAREHOUSE_STYLE_RENDERERS).sort()).toEqual(["bivariate", "choropleth", "compare", "heatmap", "proportional"]);
  });

  it("exposes the two magnitude/heat ramps used by choropleth and heatmap defaults", () => {
    expect(VIZ_SPEC.styles.choropleth?.ramp).toBe("viridis");
    expect(VIZ_SPEC.styles.heatmap?.ramp).toBe("magma");
    expect(Object.keys(VIZ_SPEC.ramps)).toContain("viridis");
    expect(Object.keys(VIZ_SPEC.ramps)).toContain("magma");
  });
});
