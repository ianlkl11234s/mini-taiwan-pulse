import { describe, expect, it } from "vitest";
import { VIZ_SPEC } from "../vizSpec";
import { buildNullHatchTile, ensureNullHatchImage, NULL_HATCH_IMAGE_ID } from "../vizNullPattern";

describe("buildNullHatchTile", () => {
  it("builds a spacingPx-square tile with a transparent background and a translucent stroke on the diagonal", () => {
    const tile = buildNullHatchTile("dark");
    expect(tile.width).toBe(VIZ_SPEC.nullStyle.spacingPx);
    expect(tile.height).toBe(VIZ_SPEC.nullStyle.spacingPx);
    expect(tile.data.length).toBe(tile.width * tile.height * 4);
    let onStroke = 0;
    let offStroke = 0;
    for (let index = 0; index < tile.data.length; index += 4) {
      const alpha = tile.data[index + 3]!;
      if (alpha > 0) onStroke += 1; else offStroke += 1;
      if (alpha === 0) { expect(tile.data[index]).toBe(0); expect(tile.data[index + 1]).toBe(0); expect(tile.data[index + 2]).toBe(0); }
    }
    expect(onStroke).toBeGreaterThan(0); // there is a visible line
    expect(offStroke).toBeGreaterThan(0); // and a transparent background around it (spec N1)
  });

  it("uses white on dark and black on light, at the spec's translucent alpha (never fully opaque or 0)", () => {
    const dark = buildNullHatchTile("dark");
    const light = buildNullHatchTile("light");
    const firstOpaque = (data: Uint8ClampedArray) => { for (let i = 0; i < data.length; i += 4) if (data[i + 3]! > 0) return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!]; throw new Error("no stroke pixel"); };
    const [dr, dg, db, da] = firstOpaque(dark.data);
    const [lr, lg, lb, la] = firstOpaque(light.data);
    expect([dr, dg, db]).toEqual([255, 255, 255]);
    expect([lr, lg, lb]).toEqual([0, 0, 0]);
    expect(da).toBeGreaterThan(0); expect(da).toBeLessThan(255);
    expect(la).toBeGreaterThan(0); expect(la).toBeLessThan(255);
  });
});

describe("ensureNullHatchImage", () => {
  function stubMap() {
    const images = new Set<string>();
    return { images, hasImage: (id: string) => images.has(id), addImage: (id: string) => { if (images.has(id)) throw new Error("DUPLICATE"); images.add(id); } };
  }

  it("registers each theme's tile once under its own id, and is a no-op if already registered", () => {
    const map = stubMap();
    expect(ensureNullHatchImage(map, "dark")).toBe(NULL_HATCH_IMAGE_ID.dark);
    expect(ensureNullHatchImage(map, "light")).toBe(NULL_HATCH_IMAGE_ID.light);
    expect(map.images.size).toBe(2);
    expect(() => ensureNullHatchImage(map, "dark")).not.toThrow(); // guarded re-add, e.g. after a redraw
    expect(map.images.size).toBe(2);
  });
});
