import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PORT_CLASSES,
  PORT_CLASS_COLOR_EXPRESSION,
  PORT_CLASS_FALLBACK,
  portClassColor,
} from "./transportHubTypes";

describe("transport hub port classes", () => {
  it("每個已知 port_class 都有唯一色，地圖 expression 與 popup 共用同值", () => {
    expect(new Set(PORT_CLASSES.map((entry) => entry.value)).size).toBe(PORT_CLASSES.length);
    expect(new Set(PORT_CLASSES.map((entry) => entry.color)).size).toBe(PORT_CLASSES.length);
    for (const entry of PORT_CLASSES) {
      expect(portClassColor(entry.value)).toBe(entry.color);
      expect(PORT_CLASS_COLOR_EXPRESSION).toContain(entry.value);
      expect(PORT_CLASS_COLOR_EXPRESSION).toContain(entry.color);
    }
  });

  it("缺值與未來新類別回灰色，不誤分到既有等級", () => {
    expect(portClassColor(null)).toBe(PORT_CLASS_FALLBACK.color);
    expect(portClassColor("未來新分類")).toBe(PORT_CLASS_FALLBACK.color);
    expect(PORT_CLASS_COLOR_EXPRESSION[PORT_CLASS_COLOR_EXPRESSION.length - 1]).toBe(PORT_CLASS_FALLBACK.color);
  });

  it("目前港口 GeoJSON 的所有 port_class 都已明確配色", () => {
    const asset = JSON.parse(readFileSync(
      new URL("../../public/geo/port_polygons.geojson", import.meta.url),
      "utf8",
    )) as GeoJSON.FeatureCollection;
    const actual = [...new Set(asset.features.map((feature) => feature.properties?.port_class))].sort();
    const covered = PORT_CLASSES.map((entry) => entry.value).sort();
    expect(actual).toEqual(covered);
  });
});
