import { describe, it, expect } from "vitest";
import { parseVoltageKv, powerLineTierKv } from "../energyLoader";

describe("parseVoltageKv", () => {
  it("parses single voltage in volts", () => {
    expect(parseVoltageKv("161000")).toEqual([161]);
    expect(parseVoltageKv("69000")).toEqual([69]);
    expect(parseVoltageKv("345000")).toEqual([345]);
  });

  it("parses dual-circuit semicolon", () => {
    expect(parseVoltageKv("161000;69000")).toEqual([69, 161]);
    expect(parseVoltageKv("161000;161000")).toEqual([161, 161]);
    expect(parseVoltageKv("345000;161000;69000")).toEqual([69, 161, 345]);
  });

  it("trims whitespace around parts", () => {
    expect(parseVoltageKv(" 161000 ; 69000 ")).toEqual([69, 161]);
  });

  it("returns empty for null/empty/non-numeric", () => {
    expect(parseVoltageKv(null)).toEqual([]);
    expect(parseVoltageKv(undefined)).toEqual([]);
    expect(parseVoltageKv("")).toEqual([]);
    expect(parseVoltageKv("foo")).toEqual([]);
    expect(parseVoltageKv("yes")).toEqual([]);
  });

  it("ignores 0 and negative", () => {
    expect(parseVoltageKv("0")).toEqual([]);
    expect(parseVoltageKv("-1000")).toEqual([]);
  });

  it("handles mixed valid/invalid parts", () => {
    expect(parseVoltageKv("161000;foo;69000")).toEqual([69, 161]);
  });
});

describe("powerLineTierKv", () => {
  it("maps voltage to 345/161/69/0 tier by max", () => {
    expect(powerLineTierKv("345000")).toBe(345);
    expect(powerLineTierKv("161000")).toBe(161);
    expect(powerLineTierKv("69000")).toBe(69);
    expect(powerLineTierKv("22000")).toBe(0);  // < 60kV → mixed
    expect(powerLineTierKv("")).toBe(0);
    expect(powerLineTierKv(null)).toBe(0);
  });

  it("uses max of dual-circuit", () => {
    expect(powerLineTierKv("161000;69000")).toBe(161);
    expect(powerLineTierKv("345000;161000")).toBe(345);
  });

  it("near-boundary voltages", () => {
    expect(powerLineTierKv("60000")).toBe(69);     // 60kV ≥ 60 → 69 tier
    expect(powerLineTierKv("150000")).toBe(161);   // 150kV ≥ 150 → 161 tier
    expect(powerLineTierKv("300000")).toBe(345);   // 300kV ≥ 300 → 345 tier
    expect(powerLineTierKv("59000")).toBe(0);      // 59kV < 60 → mixed
  });
});
