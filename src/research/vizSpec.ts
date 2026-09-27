import rawSpec from "./contracts/viz-spec.json";

/**
 * Typed access to the shared Pulse visualization spec (SSOT: mcp `src/warehouse/vizSpec.json`;
 * this file is a byte-identical vendored copy, see docs/features/viz-library/DECISIONS.md).
 * Never edit `contracts/viz-spec.json` here — request a spec change from the main agent instead.
 */
export type Theme = "dark" | "light";

export type VizRamp = { role: string; dark: string[]; light: string[] };
export type VizNumberFormatVector = { kind: "count" | "density" | "ratio" | "percent"; value: number | null; expected: string };

export type VizSpec = {
  version: number;
  surfaces: { dark: string; light: string };
  ring: { dark: string; light: string };
  categorical: { names: string[]; dark: string[]; light: string[]; other: { dark: string; light: string } };
  ramps: Record<string, VizRamp>;
  nullStyle: { kind: string; angle: number; spacingPx: number; lineWidthPx: number; stroke: { dark: string; light: string }; label: string };
  styles: Record<string, Record<string, unknown>>;
  numberFormat: { rules: Record<string, string>; vectors: VizNumberFormatVector[] };
  validation: Record<string, unknown>;
};

export const VIZ_SPEC = rawSpec as VizSpec;

/** The 5 (or fewer) magnitude/heat colours for one named ramp, already oriented for `theme`. */
export function rampFor(name: string, theme: Theme): string[] {
  const ramp = VIZ_SPEC.ramps[name];
  if (!ramp) throw new Error(`VIZ_SPEC_UNKNOWN_RAMP:${name}`);
  return ramp[theme];
}

/** The fixed, non-cycling categorical palette (C2) for `theme`, plus its "other" overflow colour. */
export function categoricalFor(theme: Theme): { names: string[]; colors: string[]; other: string } {
  return { names: VIZ_SPEC.categorical.names, colors: VIZ_SPEC.categorical[theme], other: VIZ_SPEC.categorical.other[theme] };
}

/** Missing-value hatch spec (N1 = C6): transparent background, 45° stroke, theme-appropriate contrast. */
export function nullHatchFor(theme: Theme): { angle: number; spacingPx: number; lineWidthPx: number; stroke: string; label: string } {
  return { angle: VIZ_SPEC.nullStyle.angle, spacingPx: VIZ_SPEC.nullStyle.spacingPx, lineWidthPx: VIZ_SPEC.nullStyle.lineWidthPx, stroke: VIZ_SPEC.nullStyle.stroke[theme], label: VIZ_SPEC.nullStyle.label };
}

/** CSS-side hatch swatch (legend), matching the map-side pixel pattern built in vizNullPattern.ts. */
export function nullHatchCssGradient(theme: Theme): string {
  const spec = nullHatchFor(theme);
  return `repeating-linear-gradient(${spec.angle}deg, ${spec.stroke} 0 ${spec.lineWidthPx}px, transparent ${spec.lineWidthPx}px ${spec.spacingPx}px)`;
}

/**
 * Adapts the app's existing basemap-darkness flag (App.tsx:524 `isDarkTheme = !["light","streets"].includes(mapStyleId)`,
 * threaded into MainMapConnection as `props.isDarkTheme`) to a spec theme key. Deliberately does not
 * re-derive from a basemap style id — that allowlist lives once in App.tsx. Unknown/undefined defaults
 * to "dark" (never guess "light").
 */
export function vizThemeForBasemap(isDarkTheme: boolean | undefined): Theme {
  return isDarkTheme === false ? "light" : "dark";
}
