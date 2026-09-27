import { VIZ_SPEC, type Theme } from "./vizSpec";

/**
 * Pixel data for the choropleth null-value hatch (spec N1/C6): a small repeating tile, transparent
 * background, theme-appropriate translucent 45° stroke. Built by pixel math (not canvas) so it stays
 * testable under jsdom/node and can be registered directly via `map.addImage(id, tile)`.
 */
export type VizNullPatternTile = { width: number; height: number; data: Uint8ClampedArray };

function parseRgba(value: string): [number, number, number, number] {
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (!match) throw new Error(`VIZ_NULL_PATTERN_BAD_STROKE:${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
}

/** One `spacingPx` x `spacingPx` tile; diagonal (x+y ≡ 0..lineWidthPx mod spacingPx) pixels carry the
 *  stroke colour at its spec alpha, everything else is fully transparent. */
export function buildNullHatchTile(theme: Theme): VizNullPatternTile {
  const spec = VIZ_SPEC.nullStyle;
  const size = Math.max(1, Math.round(spec.spacingPx));
  const [r, g, b, a] = parseRgba(spec.stroke[theme]);
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const onStroke = ((x + y) % size) < spec.lineWidthPx;
      data[index] = onStroke ? r : 0;
      data[index + 1] = onStroke ? g : 0;
      data[index + 2] = onStroke ? b : 0;
      data[index + 3] = onStroke ? alpha : 0;
    }
  }
  return { width: size, height: size, data };
}

export const NULL_HATCH_IMAGE_ID: Record<Theme, string> = { dark: "viz-null-hatch-dark", light: "viz-null-hatch-light" };

/** Registers the theme's hatch tile on `map` if it is not already present (a style/basemap switch
 *  clears every `addImage`d image, and `addImage` throws on a duplicate id). */
export function ensureNullHatchImage(map: { hasImage(id: string): boolean; addImage(id: string, image: VizNullPatternTile): void }, theme: Theme): string {
  const id = NULL_HATCH_IMAGE_ID[theme];
  if (!map.hasImage(id)) map.addImage(id, buildNullHatchTile(theme));
  return id;
}
