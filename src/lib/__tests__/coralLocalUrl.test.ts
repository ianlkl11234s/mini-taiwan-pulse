import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrl, parseUrlState } from "../urlState";
afterEach(() => vi.unstubAllEnvs());
describe("public coral and private Allen URL state", () => {
  it("shares public coral but never advertises private Allen", () => {
    vi.stubEnv("DEV", false);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toEqual(["coralReefDistribution"]);
    expect(buildUrl({ layers: ["coralReefDistribution"] }, "https://example.test/")).toContain("coralReefDistribution");
    expect(parseUrlState("?v=1&layers=allenCoralAtlas").layers).toBeUndefined();
    expect(buildUrl({ layers: ["allenCoralAtlas"] }, "https://example.test/")).not.toContain("allenCoralAtlas");
    expect(parseUrlState("?v=1&p.allenCoralAtlasOpacity=0.65").params).toBeUndefined();
    expect(buildUrl({ params: { allenCoralAtlasOpacity: 0.65 } }, "https://example.test/")).not.toContain("allenCoralAtlasOpacity");
  });
  it("also excludes private research layer from development URLs", () => {
    vi.stubEnv("DEV", true);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toEqual(["coralReefDistribution"]);
    expect(parseUrlState("?v=1&layers=allenCoralAtlas").layers).toBeUndefined();
  });
});
