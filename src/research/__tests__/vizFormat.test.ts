import { describe, expect, it } from "vitest";
import { VIZ_SPEC } from "../vizSpec";
import { classifyVizNumberKind, formatVizNumber } from "../vizFormat";

describe("formatVizNumber", () => {
  it("passes every vector declared in the shared viz spec", () => {
    for (const vector of VIZ_SPEC.numberFormat.vectors) {
      expect(formatVizNumber(vector.value, vector.kind), `${vector.kind} ${vector.value}`).toBe(vector.expected);
    }
  });

  it("never turns a missing value into 0 or an empty string", () => {
    expect(formatVizNumber(null, "count")).toBe("無資料");
    expect(formatVizNumber(undefined, "ratio")).toBe("無資料");
    expect(formatVizNumber(Number.NaN, "density")).toBe("無資料");
  });
});

describe("classifyVizNumberKind", () => {
  it("reads a literal % unit as percent", () => {
    expect(classifyVizNumberKind(12.3, "%")).toBe("percent");
  });

  it("reads a per-X unit (slash or 每) as density", () => {
    expect(classifyVizNumberKind(1234, "人/km²")).toBe("density");
    expect(classifyVizNumberKind(1234, "每平方公里人數")).toBe("density");
  });

  it("falls back to the value's own shape when the unit gives no signal: whole numbers are count, fractions are ratio", () => {
    expect(classifyVizNumberKind(20, "cases")).toBe("count");
    expect(classifyVizNumberKind(12.5, "cases per 10000 persons")).toBe("ratio");
    expect(classifyVizNumberKind(4.2, null)).toBe("ratio");
    expect(classifyVizNumberKind(12, undefined)).toBe("count");
  });
});
