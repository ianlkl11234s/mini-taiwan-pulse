import { describe, expect, it } from "vitest";
import {
  GRID_BBOX,
  GRID_CELLS,
  GRID_COLS,
  GRID_ROWS,
  GRID_SPEC,
  cellCenter,
  cellColRow,
  cellIndexOf,
  countyOf,
  inScopeCells,
} from "../grid/gridSpec";
import { GRID_MASK_CELL_COUNT, GRID_MASK_COUNTY_CELLS, GRID_MASK_ROW_SPANS, GRID_MASK_SPEC_ID } from "../grid/gridMask.generated";

describe("北北 250 m 網格定義", () => {
  it("常數自洽：列行數涵蓋 bbox、遮罩對應同一份 spec", () => {
    expect(GRID_CELLS).toBe(GRID_COLS * GRID_ROWS);
    expect(GRID_BBOX[0]).toBeCloseTo(121.28, 9);
    expect(GRID_BBOX[2]).toBeGreaterThanOrEqual(122.0075); // 新北東界（三貂角）
    expect(GRID_BBOX[1]).toBeLessThanOrEqual(24.6732); // 新北南界
    expect(GRID_MASK_SPEC_ID).toBe(GRID_SPEC.id);
    expect(GRID_MASK_ROW_SPANS).toHaveLength(GRID_ROWS);
  });

  it("格心 → 索引 → 格心 來回一致；邊界外回 -1", () => {
    for (const i of [0, 1, GRID_COLS - 1, GRID_COLS, 12_345, GRID_CELLS - 1]) {
      const [lon, lat] = cellCenter(i);
      expect(cellIndexOf(lon, lat)).toBe(i);
      const [c, r] = cellColRow(i);
      expect(r * GRID_COLS + c).toBe(i);
    }
    expect(cellIndexOf(121.27, 25)).toBe(-1);
    expect(cellIndexOf(121.5, 25.4)).toBe(-1);
    expect(cellIndexOf(122.5, 25)).toBe(-1);
  });

  it("半開區間：西界、北界屬於格內，東界屬於下一格", () => {
    expect(cellIndexOf(GRID_SPEC.west, GRID_SPEC.north)).toBe(0);
    expect(cellIndexOf(GRID_SPEC.west + GRID_SPEC.dLon, GRID_SPEC.north - 1e-9)).toBe(1);
  });

  it("遮罩：縣市碼與已知地點對得上，基隆是洞", () => {
    expect(countyOf(cellIndexOf(121.5654, 25.0330))).toBe(1); // 臺北 101
    expect(countyOf(cellIndexOf(121.4627, 25.0120))).toBe(2); // 板橋車站
    expect(countyOf(cellIndexOf(121.7392, 25.1316))).toBe(0); // 基隆火車站
    expect(countyOf(cellIndexOf(121.3, 25.25))).toBe(0); // 外海
    const cells = inScopeCells();
    expect(cells.length).toBe(GRID_MASK_CELL_COUNT);
    expect(GRID_MASK_COUNTY_CELLS.taipei + GRID_MASK_COUNTY_CELLS.newTaipei).toBe(GRID_MASK_CELL_COUNT);
  });
});
