import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../layerManifest";
import {
  TW_MARINE_HEAT_PRODUCTS, twCrwBaaRasterColor, twCrwDhwRasterColor, twMarineHeatPeriod, twMhwRasterColor,
  type TwMarineHeatLayerKey,
} from "../twMarineHeatTypes";
import { yearAtlasCellIndex } from "../marineYearAtlas";

const KEYS: TwMarineHeatLayerKey[] = ["twMarineHeatwaves", "twCoralBleachingHeatStress"];

function stops(expr: unknown[]): number[] {
  // ["step", input, default, t1, c1, t2, c2, ...]
  return expr.slice(3).filter((_, i) => i % 2 === 0) as number[];
}

describe("海洋熱浪／珊瑚白化熱壓力（台灣圖層延伸 B6）", () => {
  it.each(KEYS)("%s：選單年份＝manifest longTerm 涵蓋年份，預設＝最後一期", (key) => {
    const p = TW_MARINE_HEAT_PRODUCTS[key];
    const lt = LAYER_MANIFEST[key].longTerm!;
    expect(p.years[0]).toBe(Number(lt.coverage.start.slice(0, 4)));
    expect(p.years[p.years.length - 1]).toBe(Number(String(lt.coverage.end).slice(0, 4)));
    expect(`${p.defaultYear}-${p.defaultMonth}`).toBe(String(lt.coverage.end).slice(0, 7));
  });

  it.each(KEYS)("%s：本機有幀清單時，年份與最新一期和清單一致（資料更新後要同步常數）", (key) => {
    const p = TW_MARINE_HEAT_PRODUCTS[key];
    const path = `public/${p.base.slice(2)}${p.framesKey}`;
    if (!existsSync(path)) return; // CI 沒有 public/ 資料檔
    const m = JSON.parse(readFileSync(path, "utf8")) as { period_first: string; period_last: string };
    expect(m.period_first.slice(0, 4)).toBe(String(p.years[0]));
    expect(m.period_last).toBe(`${p.defaultYear}-${p.defaultMonth}`);
  });

  it("raster-color step 門檻嚴格遞增，缺值 255 畫灰（含部分篩選）", () => {
    for (const expr of [twMhwRasterColor(), twMhwRasterColor(0b10110), twCrwBaaRasterColor(), twCrwBaaRasterColor(3), twCrwDhwRasterColor(), twCrwDhwRasterColor(1)]) {
      const s = stops(expr);
      s.forEach((v, i) => { if (i > 0) expect(v).toBeGreaterThan(s[i - 1]!); });
      expect(s[s.length - 1]).toBe(254.5);
    }
  });

  it("等級篩選：關掉的級畫透明", () => {
    const expr = twMhwRasterColor(0b00001); // 只開「無熱浪」
    expect(expr[6]).toBe("rgba(0, 0, 0, 0)"); // 中等
  });

  it("期別索引 → YYYY-MM，超界退回預設", () => {
    expect(twMarineHeatPeriod("twMarineHeatwaves", 0, 0)).toBe("1982-01");
    expect(twMarineHeatPeriod("twCoralBleachingHeatStress", 21, 7)).toBe("2024-08");
    expect(twMarineHeatPeriod("twMarineHeatwaves", 999, 99)).toBe("2026-10");
  });

  it("經緯度 → 格索引（row 0＝北緣）", () => {
    const grid = { edges: [115, 18, 126, 28] as [number, number, number, number], step_deg: 0.25, ncols: 44, nrows: 40 };
    expect(yearAtlasCellIndex(grid, 115.1, 27.9)).toBe(0);
    expect(yearAtlasCellIndex(grid, 125.9, 18.1)).toBe(40 * 44 - 1);
    expect(yearAtlasCellIndex(grid, 114.36, 10.38)).toBeNull(); // 太平島
  });
});
