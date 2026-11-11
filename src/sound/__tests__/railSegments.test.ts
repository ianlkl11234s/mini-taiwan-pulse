import { describe, expect, it } from "vitest";
import { RAIL_SEGMENT_SOURCE, segmentStructure, structureAtProgress, trackStructureIntervals } from "../model/railSegments";

describe("railSegments（OSM 衍生站間結構表）", () => {
  it("已知地下段判為 underground：板南線、高鐵臺北段、台鐵臺北市區、文湖線松山機場–大直", () => {
    expect(segmentStructure("trtc", "BL01", "BL02").structure).toBe("underground");
    expect(segmentStructure("thsr", "0990", "1000").structure).toBe("underground");
    expect(segmentStructure("tra", "1000", "1010").structure).toBe("underground");
    expect(segmentStructure("trtc", "BR13", "BR14").structure).toBe("underground");
  });

  it("已知高架段判為 elevated：文湖線內湖段、淡水線圓山以北", () => {
    expect(segmentStructure("trtc", "BR18", "BR19").structure).toBe("elevated");
    expect(segmentStructure("trtc", "R14", "R15").structure).toBe("elevated");
  });

  it("洞口過渡段與表外站對 → unknown（不當地面）；站對順序無關", () => {
    expect(segmentStructure("trtc", "BR12", "BR13").structure).toBe("unknown");
    expect(segmentStructure("trtc", "R14", "R13").structure).toBe("unknown");
    expect(segmentStructure("trtc", "NOPE1", "NOPE2")).toMatchObject({ structure: "unknown", reason: "not_in_table", shares: null });
    expect(RAIL_SEGMENT_SOURCE.license).toContain("ODbL");
  });

  it("站點在兩種結構交界 → unknown；同結構 → 採用", () => {
    const iv = trackStructureIntervals("x", { A: 0, B: 0.5, C: 1 }, (_s, a) => ({ structure: a === "A" ? "underground" : "elevated", reason: "t", shares: null }));
    expect(structureAtProgress(iv, 0.25)).toBe("underground");
    expect(structureAtProgress(iv, 0.5)).toBe("unknown");
    expect(structureAtProgress(iv, 0.75)).toBe("elevated");
    expect(structureAtProgress(iv, 1.2)).toBe("unknown");
  });
});
