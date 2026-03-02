import { H3HexagonLayer } from "@deck.gl/geo-layers";
import type { H3CellData } from "../data/h3Loader";

/** Color scales */
const DAY_COLORS: [number, number, number][] = [
  [255, 255, 178],  // light yellow
  [254, 204, 92],   // yellow
  [253, 141, 60],   // orange
  [240, 59, 32],    // red
  [189, 0, 38],     // dark red
];

const NIGHT_COLORS: [number, number, number][] = [
  [178, 226, 226],  // light cyan
  [102, 194, 164],  // teal
  [44, 162, 95],    // green
  [0, 109, 148],    // blue
  [1, 70, 99],      // dark blue
];

function interpolateColor(
  colors: [number, number, number][],
  t: number,
): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const idx = clamped * (colors.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, colors.length - 1);
  const frac = idx - lo;
  const c0 = colors[lo]!;
  const c1 = colors[hi]!;
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * frac),
    Math.round(c0[1] + (c1[1] - c0[1]) * frac),
    Math.round(c0[2] + (c1[2] - c0[2]) * frac),
    200,
  ];
}

export interface H3LayerParams {
  metric: "day" | "night";
  opacity: number;
  extruded: boolean;
  elevationScale: number;
}

/**
 * Log-based normalization: maps power-law distributed values to 0–1.
 * Ensures visual differentiation across orders of magnitude.
 */
function logNorm(value: number, maxVal: number): number {
  if (value <= 0 || maxVal <= 0) return 0;
  return Math.log1p(value) / Math.log1p(maxVal);
}

/**
 * Create a deck.gl H3HexagonLayer for population data.
 */
export function createH3PopulationLayer(
  cells: H3CellData[],
  params: H3LayerParams,
  visible: boolean,
): H3HexagonLayer<H3CellData> {
  const { metric, opacity, extruded, elevationScale } = params;
  const colors = metric === "day" ? DAY_COLORS : NIGHT_COLORS;

  // Calculate max value for normalization
  const getValue = (d: H3CellData) => (metric === "day" ? d.d : d.n);
  let maxVal = 0;
  for (const c of cells) {
    const v = getValue(c);
    if (v > maxVal) maxVal = v;
  }
  if (maxVal === 0) maxVal = 1;

  return new H3HexagonLayer<H3CellData>({
    id: "h3-population",
    data: cells,
    visible,
    pickable: true,
    filled: true,
    extruded,
    opacity,
    highPrecision: true,
    getHexagon: (d: H3CellData) => d.h,
    getFillColor: (d: H3CellData) => interpolateColor(colors, logNorm(getValue(d), maxVal)),
    getElevation: extruded ? (d: H3CellData) => logNorm(getValue(d), maxVal) : 0,
    elevationScale: extruded ? elevationScale * 100 : 0,
    updateTriggers: {
      getFillColor: [metric, maxVal],
      getElevation: [metric, extruded, elevationScale, maxVal],
    },
  });
}

/**
 * Determine H3 resolution based on map zoom level.
 */
export function getH3Resolution(zoom: number): number {
  if (zoom < 9.5) return 7;
  if (zoom < 12) return 8;
  return 9;
}
