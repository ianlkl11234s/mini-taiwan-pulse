import { describe, expect, it } from "vitest";
import { DIVERGING_STOPS } from "../temperatureWavePalette";

describe("temperatureWavePalette", () => {
  it("keeps normalized, ordered RdBu stops", () => {
    expect(DIVERGING_STOPS[0]).toMatchObject({ t: 0, r: 0x21 / 255, g: 0x66 / 255, b: 0xac / 255 });
    expect(DIVERGING_STOPS[DIVERGING_STOPS.length - 1]).toMatchObject({ t: 1, r: 0xb2 / 255, g: 0x18 / 255, b: 0x2b / 255 });
    expect(DIVERGING_STOPS.every((stop, index) => index === 0 || stop.t > DIVERGING_STOPS[index - 1]!.t)).toBe(true);
  });
});
