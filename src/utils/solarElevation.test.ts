import { describe, expect, it } from "vitest";
import { nightLightIntensity, solarElevationDeg, solarFrame } from "./solarElevation";

/** 台灣時間（UTC+8）→ unix 秒 */
const tw = (iso: string) => Date.parse(`${iso}+08:00`) / 1000;
const LAT = 23.7, LNG = 120.6;
const elev = (iso: string) => solarElevationDeg(solarFrame(tw(iso)), LAT, LNG);

describe("solarElevation", () => {
  it("台灣中部 11-16 正午太陽高、午夜在地平線下", () => {
    // 11 月中赤緯約 −18.6° → 正午高度約 90 − 23.7 − 18.6 ≈ 47.7°
    expect(elev("2026-11-16T11:50:00")).toBeGreaterThan(45);
    expect(elev("2026-11-16T11:50:00")).toBeLessThan(50);
    expect(elev("2026-11-16T23:50:00")).toBeLessThan(-40);
  });

  it("日落約 17:10（容許 ±10 分）", () => {
    expect(elev("2026-11-16T17:00:00")).toBeGreaterThan(0);
    expect(elev("2026-11-16T17:20:00")).toBeLessThan(0);
  });

  it("漁火強度：12:00 為 0、21:00 為 1、17–18 時遞增", () => {
    const at = (iso: string) => nightLightIntensity(elev(iso));
    expect(at("2026-11-16T12:00:00")).toBe(0);
    expect(at("2026-11-16T21:00:00")).toBe(1);
    const seq = ["17:00", "17:20", "17:30", "17:40", "18:00"].map((t) => at(`2026-11-16T${t}:00`));
    for (let i = 1; i < seq.length; i++) expect(seq[i]!).toBeGreaterThanOrEqual(seq[i - 1]!);
    expect(seq[0]).toBe(0);
    expect(seq[seq.length - 1]).toBe(1);
    expect(seq[2]).toBeGreaterThan(0);
    expect(seq[2]).toBeLessThan(1);
  });

  it("日出前漸暗：05:30 仍亮、07:00 熄", () => {
    const at = (iso: string) => nightLightIntensity(elev(iso));
    expect(at("2026-11-17T05:30:00")).toBe(1);
    expect(at("2026-11-17T07:00:00")).toBe(0);
  });
});
