import { describe, expect, it } from "vitest";
import { boundsOfPositions, buildFramingCheck, safeCoverageOf } from "../framingCheck";

const safe = { left: 100, top: 0, right: 500, bottom: 400 };
// 1 degree = 100 px, origin (0,0) at screen (0, 400): x = lng*100, y = 400 - lat*100
const project = ([lng, lat]: [number, number]) => ({ x: lng * 100, y: 400 - lat * 100 });

describe("safeCoverageOf", () => {
  it("full cover", () => expect(safeCoverageOf(project, safe, [0, 0, 6, 4])).toBe(1));
  it("partly outside the safe rect", () => expect(safeCoverageOf(project, safe, [1, 0, 3, 4])).toBe(0.5)); // 200x400 / 400x400
  it("bbox smaller than safe", () => expect(safeCoverageOf(project, safe, [2, 1, 4, 3])).toBe(0.25));
  it("fully off screen is 0", () => expect(safeCoverageOf(project, safe, [10, 10, 12, 12])).toBe(0));
  it("hidden behind a rail (inside viewport, outside safe) is 0", () => expect(safeCoverageOf(project, safe, [0, 0, 0.5, 4])).toBe(0));
  it("no results is null", () => expect(safeCoverageOf(project, safe, null)).toBeNull());
  it("tiny bbox inside stays distinguishable from off screen (0.01)", () => {
    const v = safeCoverageOf(project, safe, [3, 2, 3, 2]);
    expect(v).toBe(0.01);
    expect(v).not.toBeNull();
  });
  it("non-finite projection counts as off screen", () => expect(safeCoverageOf(() => ({ x: NaN, y: 0 }), safe, [0, 0, 1, 1])).toBe(0));
  it("empty safe rect is null", () => expect(safeCoverageOf(project, { left: 5, top: 5, right: 5, bottom: 9 }, [0, 0, 1, 1])).toBeNull());
});

describe("boundsOfPositions / buildFramingCheck", () => {
  it("merges positions and skips junk", () => {
    expect(boundsOfPositions([[1, 2], [3, 4], [NaN, 1], [0, 5]])).toEqual([0, 2, 3, 5]);
    expect(boundsOfPositions([])).toBeNull();
  });
  it("assembles the contract shape", () => {
    expect(buildFramingCheck({ project, safe, bounds: null, outlineOnlyResultIds: ["a"], legendCount: 2 })).toEqual({ safeCoverage: null, outlineOnlyResultIds: ["a"], legendCount: 2 });
  });
});
