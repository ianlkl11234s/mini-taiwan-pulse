export interface StatisticsColorStop {
  value: number;
  color: string;
}

/**
 * Converts non-decreasing SSOT breaks into Mapbox-compatible `step` stops.
 * When multiple breaks are equal, a value at that threshold has crossed all
 * of them, so the final colour is the only reachable one to retain.
 */
export function statisticsColorStops(breaks: readonly number[], colors: readonly string[]): StatisticsColorStop[] {
  if (colors.length < breaks.length + 1) throw new Error('statistics colors must contain one base color plus one color per break');
  const stops: StatisticsColorStop[] = [];
  for (const [index, value] of breaks.entries()) {
    if (!Number.isFinite(value)) throw new Error('statistics breaks must be finite numbers');
    const color = colors[index + 1]!;
    const previous = stops[stops.length - 1];
    if (!previous || value > previous.value) stops.push({ value, color });
    else if (value === previous.value) previous.color = color;
    else throw new Error('statistics breaks must be non-decreasing');
  }
  return stops;
}
