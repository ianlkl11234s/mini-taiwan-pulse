import { describe, expect, it } from "vitest";
import { discoverLayers } from "../discovery";
import { searchScore, searchTerms } from "../researchSearch";
describe("natural layer discovery", () => {
  it("finds existing display layers without requiring an analysis adapter", () => {
    expect(discoverLayers("我想要知道台灣農田分布情形", 0, 5).layers.map(layer => layer.key)).toContain("agriculture");
    expect(discoverLayers("想要知道可能台灣哪裡有殯葬場", 0, 5).layers.map(layer => layer.key)).toContain("funeralFacilities");
    expect(discoverLayers("目前跟教育有關的有哪些資料或是圖層", 0, 20).layers.map(layer => layer.key)).toContain("schools");
  });
  it("segments topics without a hand-written question template", () => {
    expect(searchTerms("我想看看台灣的海纜分布")).toContain("海纜");
    expect(searchScore("我想看看海纜分布", "海底電纜與海纜路線")).toBeGreaterThan(0);
    expect(searchScore("我想看看海纜分布", "台灣的公立學校")).toBe(0);
  });
});
