import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrl, parseUrlState } from "../urlState";
afterEach(() => vi.unstubAllEnvs());
describe("coral local-only URL state", () => {
  it("does not advertise or accept the unavailable production layer", () => {
    vi.stubEnv("DEV", false);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toBeUndefined();
    expect(buildUrl({ layers: ["coralReefDistribution"] }, "https://example.test/")).not.toContain("coralReefDistribution");
    expect(parseUrlState("?v=1&layers=allenCoralAtlas").layers).toBeUndefined();
    expect(buildUrl({ layers: ["allenCoralAtlas"] }, "https://example.test/")).not.toContain("allenCoralAtlas");
    expect(parseUrlState("?v=1&p.allenCoralAtlasOpacity=0.65").params).toBeUndefined();
    expect(buildUrl({ params: { allenCoralAtlasOpacity: 0.65 } }, "https://example.test/")).not.toContain("allenCoralAtlasOpacity");
  });
  it("also excludes private research layer from development URLs", () => {
    vi.stubEnv("DEV", true);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toBeUndefined();
    expect(parseUrlState("?v=1&layers=allenCoralAtlas").layers).toBeUndefined();
  });
});
