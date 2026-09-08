/** Portable adapter for the JSON whitelist. Import manifest from the handoff package.
 * UI enumerates options; do not infer a tuple from an opaque release id.
 */
export interface AgriOption {
  release_id: string;
  period_start: string;
  period_end: string;
  dimensions: Record<string, string>;
}
export interface AgriRecipe {
  enabled: boolean;
  dataset_id: string;
  indicator_id: string;
  boundary_version: string;
  release_options: AgriOption[];
}
const sameDimensions = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
export function resolveAgriRelease(
  recipe: AgriRecipe,
  release: { release_id: string; period_start: string; period_end: string },
  selectedDimensions: Record<string, string>,
) {
  if (!recipe.enabled) return null;
  const matches = recipe.release_options.filter(o => o.release_id === release.release_id &&
    o.period_start === release.period_start && o.period_end === release.period_end &&
    sameDimensions(o.dimensions, selectedDimensions));
  if (matches.length !== 1) return null;
  return { releaseId: matches[0]!.release_id, dimensions: matches[0]!.dimensions };
}
