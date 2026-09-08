import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrl, parseUrlState } from "../urlState";
afterEach(() => vi.unstubAllEnvs());
describe("coral local-only URL state", () => {
  it("does not advertise or accept the unavailable production layer", () => {
    vi.stubEnv("DEV", false);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toBeUndefined();
    expect(buildUrl({ layers: ["coralReefDistribution"] }, "https://example.test/")).not.toContain("coralReefDistribution");
  });
  it("retains the local research layer in development", () => {
    vi.stubEnv("DEV", true);
    expect(parseUrlState("?v=1&layers=coralReefDistribution").layers).toEqual(["coralReefDistribution"]);
  });
});
