import { describe, expect, it } from "vitest";
import { electionRingSegments } from "../electionGroupIcon";

describe("electionRingSegments（選舉群組外環）", () => {
  it("場次很多、某陣營只 1 場時，弧段仍是正掃角，不會繞近整圈（review F043）", () => {
    const segs = electionRingSegments({ dpp: 120, kmt: 1 }, ["dpp", "kmt"]);
    for (const seg of segs) expect(seg.end).toBeGreaterThan(seg.start);
    const total = segs.reduce((s, seg) => s + (seg.end - seg.start), 0);
    expect(total).toBeLessThan(2 * Math.PI);
  });

  it("一般情況段間留 0.06 rad 縫；只有一個陣營時不留縫", () => {
    const [a, b] = electionRingSegments({ dpp: 2, kmt: 2 }, ["dpp", "kmt"]);
    expect(b!.start - a!.end).toBeCloseTo(0.06);
    const [only] = electionRingSegments({ dpp: 3 }, ["dpp"]);
    expect(only!.end - only!.start).toBeCloseTo(2 * Math.PI);
  });
});
