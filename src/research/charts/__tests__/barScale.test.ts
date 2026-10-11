import { describe, expect, it } from "vitest";
import { barDomain, barFraction } from "../barScale";
import { minibarFraction } from "../CompareTable";

describe("barScale", () => {
  it("keeps value/max for all-positive data", () => {
    const domain = barDomain([10, 50, 100]);
    expect(barFraction(50, domain)).toBeCloseTo(0.5);
    expect(barFraction(100, domain)).toBe(1);
  });

  it("does not collapse all-negative values to zero width", () => {
    const domain = barDomain([-100, -20, -1]);
    const fractions = [-100, -20, -1].map(v => barFraction(v, domain));
    expect(fractions.every(f => f > 0)).toBe(true);
    expect(fractions[2]!).toBeGreaterThan(fractions[1]!);
    expect(fractions[1]!).toBeGreaterThan(fractions[0]!);
  });

  it("measures mixed-sign rows over the full range", () => {
    const domain = barDomain([-50, 0, 50]);
    expect(barFraction(50, domain)).toBe(1);
    expect(barFraction(0, domain)).toBeCloseTo(0.5);
    expect(barFraction(-50, domain)).toBeGreaterThan(0);
  });

  it("returns 0 for null and for an empty domain", () => {
    expect(barFraction(null, barDomain([1]))).toBe(0);
    expect(barFraction(0, barDomain([0, 0]))).toBe(0);
    expect(minibarFraction(-3, barDomain([-3, -6]))).toBeGreaterThan(0);
  });
});
