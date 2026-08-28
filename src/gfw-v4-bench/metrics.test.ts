import { describe, expect, it } from "vitest";
import { attestedHeapBytes, frameWorkSummary, isHigherPeakFrame, percentile, summarizeFrame, type FrameTelemetry } from "./metrics";
import type { TrackFrame } from "./types";

describe("GFW v4 benchmark metrics", () => {
  it("uses nearest-rank percentiles for exported RAF deltas", () => {
    expect(percentile([40, 10, 30, 20], 0.5)).toBe(20);
    expect(percentile([40, 10, 30, 20], 0.95)).toBe(40);
    expect(percentile([], 0.95)).toBeNull();
  });

  it("keeps heap null unless precise-memory use is explicitly attested", () => {
    const performanceLike = { memory: { usedJSHeapSize: 26_000_000 } };
    expect(attestedHeapBytes(false, performanceLike)).toBeNull();
    expect(attestedHeapBytes(true, performanceLike)).toBe(26_000_000);
    expect(attestedHeapBytes(true, {})).toBeNull();
  });

  it("summarizes frames without exporting geometry and selects the worst observed scrub sample", () => {
    const frame = (values: Partial<FrameTelemetry>): TrackFrame => ({
      heads: [],
      trails: [],
      visibleHeadGroups: 100,
      visibleMembers: 110,
      visibleTrailVertices: 200,
      renderedHeadGroups: 100,
      renderedTrailVertices: 200,
      overBudgetHeads: 0,
      overBudgetTrailVertices: 0,
      ...values,
    });
    const baseline = summarizeFrame(frame({ visibleHeadGroups: 20_000, visibleTrailVertices: 100_000 }));
    const laterOverBudget = summarizeFrame(frame({ visibleHeadGroups: 21_035, overBudgetHeads: 1_035 }));
    expect(Object.keys(baseline)).not.toContain("heads");
    expect(isHigherPeakFrame(laterOverBudget, baseline)).toBe(true);
    expect(isHigherPeakFrame(baseline, laterOverBudget)).toBe(false);
  });

  it("exports frame-work p95 and max across the complete scrub sample set", () => {
    expect(frameWorkSummary([1, 2, 3, 80, 4])).toEqual({ samples: 5, p95Ms: 80, maxMs: 80 });
    expect(frameWorkSummary([])).toEqual({ samples: 0, p95Ms: null, maxMs: null });
  });
});
