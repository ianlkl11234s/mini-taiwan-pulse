/**
 * 溫度網格色票（2026-10-06 調淺）：10 級固定 °C 分段、邊界語意與 paint step 表達式同源。
 */
import { describe, expect, it } from "vitest";
import { TEMPERATURE_GRID_BANDS, temperatureGridColor } from "../temperatureGridTypes";
import { microSensorTemperatureColor, MICRO_SENSOR_NO_DATA_COLOR } from "../microSensorTypes";
import { buildColorExpr } from "../../map/temperatureGridLayerFactory";

const colorOfLabel = (label: string) => TEMPERATURE_GRID_BANDS.find((b) => b.label === label)!.color;

describe("TEMPERATURE_GRID_BANDS", () => {
  it("10 級，斷點為 0/5/10/15/18/22/26/30/34", () => {
    expect(TEMPERATURE_GRID_BANDS).toHaveLength(10);
    expect(TEMPERATURE_GRID_BANDS.slice(1).map((b) => b.min)).toEqual([0, 5, 10, 15, 18, 22, 26, 30, 34]);
    expect(TEMPERATURE_GRID_BANDS[0]!.min).toBeNull();
    expect(TEMPERATURE_GRID_BANDS[9]!.max).toBeNull();
  });

  it("相鄰 band 首尾相接、色號不重複、標籤與斷點一致", () => {
    for (let i = 1; i < TEMPERATURE_GRID_BANDS.length; i++) {
      expect(TEMPERATURE_GRID_BANDS[i - 1]!.max).toBe(TEMPERATURE_GRID_BANDS[i]!.min);
    }
    expect(new Set(TEMPERATURE_GRID_BANDS.map((b) => b.color)).size).toBe(10);
    expect(TEMPERATURE_GRID_BANDS.map((b) => b.label)).toEqual([
      "< 0°C", "0–5°C", "5–10°C", "10–15°C", "15–18°C", "18–22°C", "22–26°C", "26–30°C", "30–34°C", "≥ 34°C",
    ]);
  });

  it("最熱一級是暗紅 #a50026（不再是近黑）", () => {
    expect(TEMPERATURE_GRID_BANDS[9]!.color).toBe("#a50026");
  });
});

describe("temperatureGridColor 邊界（與 Mapbox step 一致：剛好等於斷點歸上一級）", () => {
  it.each([
    [-5, "< 0°C"], [-0.01, "< 0°C"], [0, "0–5°C"], [14.99, "10–15°C"], [15, "15–18°C"],
    [17.99, "15–18°C"], [18, "18–22°C"], [21.99, "18–22°C"], [22, "22–26°C"], [26, "26–30°C"],
    [29.99, "26–30°C"], [30, "30–34°C"], [33.99, "30–34°C"], [34, "≥ 34°C"], [40, "≥ 34°C"],
  ])("%s°C → %s", (t, label) => {
    expect(temperatureGridColor(t)).toBe(colorOfLabel(label));
  });
});

describe("paint step 表達式與 bands 同源", () => {
  it("step = [step, expr, c0, 0, c1, …, 34, c9]（21 元素）", () => {
    const expr = buildColorExpr() as unknown[];
    const step = expr[expr.length - 1] as unknown[];
    expect(step[0]).toBe("step");
    expect(step).toHaveLength(3 + 2 * 9);
    expect(step[2]).toBe(TEMPERATURE_GRID_BANDS[0]!.color);
    for (let i = 1; i < 10; i++) {
      expect(step[1 + 2 * i]).toBe(TEMPERATURE_GRID_BANDS[i]!.min);
      expect(step[2 + 2 * i]).toBe(TEMPERATURE_GRID_BANDS[i]!.color);
    }
  });

  it("微型感測器溫度模式共用同一色階，哨兵值仍走無資料色", () => {
    expect(microSensorTemperatureColor(23)).toBe(colorOfLabel("22–26°C"));
    expect(microSensorTemperatureColor(-999)).toBe(MICRO_SENSOR_NO_DATA_COLOR);
  });
});
