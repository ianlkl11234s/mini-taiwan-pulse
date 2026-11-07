import type { ViewportRect } from "./viewportFit";

export type FramingCheck = {
  /** 0–1 (2 decimals): projected bbox of everything drawn ∩ safe rect ÷ safe rect. null = no analysis result on the map. */
  safeCoverage: number | null;
  /** Results drawn as outline only (lost the fill slot). */
  outlineOnlyResultIds: string[];
  /** Rows currently shown in the analysis legend. */
  legendCount: number;
};

export type ProjectFn = (lngLat: [number, number]) => { x: number; y: number };
export type LngLatBounds = readonly [number, number, number, number];

/** Merged [west, south, east, north] of lng/lat positions; null when none are finite. */
export function boundsOfPositions(positions: Iterable<readonly number[]>): [number, number, number, number] | null {
  let w = Infinity; let s = Infinity; let e = -Infinity; let n = -Infinity;
  for (const p of positions) {
    const lng = p[0]; const lat = p[1];
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat);
  }
  return w === Infinity ? null : [w, s, e, n];
}

/**
 * Share of the safe rectangle covered by the screen-space bbox of the drawn results.
 * Corners and edge midpoints are projected (curved globe edges); a point not on screen (non-finite) counts as
 * outside. A degenerate (point-like) box is widened to 1 px so a lone point inside the safe area is not "off screen".
 * Returns null when there is no bbox or the safe rect is empty.
 */
export function safeCoverageOf(project: ProjectFn, safe: ViewportRect, bounds: LngLatBounds | null): number | null {
  if (!bounds) return null;
  const safeArea = (safe.right - safe.left) * (safe.bottom - safe.top);
  if (!(safeArea > 0)) return null;
  const [w, s, e, n] = bounds;
  const mx = (w + e) / 2; const my = (s + n) / 2;
  const samples: [number, number][] = [[w, s], [mx, s], [e, s], [w, my], [e, my], [w, n], [mx, n], [e, n]];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  try {
    for (const lngLat of samples) {
      const p = project(lngLat);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return 0;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  } catch { return 0; }
  if (maxX - minX < 1) { const c = (minX + maxX) / 2; minX = c - 0.5; maxX = c + 0.5; }
  if (maxY - minY < 1) { const c = (minY + maxY) / 2; minY = c - 0.5; maxY = c + 0.5; }
  const ix = Math.min(maxX, safe.right) - Math.max(minX, safe.left);
  const iy = Math.min(maxY, safe.bottom) - Math.max(minY, safe.top);
  if (ix <= 0 || iy <= 0) return 0;
  return Math.round(Math.min(1, (ix * iy) / safeArea) * 100) / 100;
}

export function buildFramingCheck(input: { project: ProjectFn; safe: ViewportRect; bounds: LngLatBounds | null; outlineOnlyResultIds: readonly string[]; legendCount: number }): FramingCheck {
  return {
    safeCoverage: safeCoverageOf(input.project, input.safe, input.bounds),
    outlineOnlyResultIds: [...input.outlineOnlyResultIds],
    legendCount: input.legendCount,
  };
}
