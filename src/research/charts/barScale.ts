/**
 * Shared bar-length scale for RankBars / CompareTable. The domain always includes zero
 * ([min(0, min), max(0, max)]), so all-positive data keeps the classic value/max length, while
 * negative values (diverging scales, change metrics) are measured over the full numeric range
 * instead of being clamped to a zero-width bar. When the domain spans negatives, every usable value
 * keeps a small visible stub so the lowest one is not invisible.
 */
const MIN_VISIBLE_FRACTION = 0.04;

export function barDomain(values: readonly (number | null)[]): { lo: number; hi: number } {
  const finite = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return { lo: Math.min(0, ...finite), hi: Math.max(0, ...finite) };
}

export function barFraction(value: number | null, domain: { lo: number; hi: number }): number {
  if (value === null || !Number.isFinite(value)) return 0;
  const span = domain.hi - domain.lo;
  if (span <= 0) return 0;
  const raw = Math.max(0, Math.min(1, (value - domain.lo) / span));
  return domain.lo < 0 ? Math.max(MIN_VISIBLE_FRACTION, raw) : raw;
}
