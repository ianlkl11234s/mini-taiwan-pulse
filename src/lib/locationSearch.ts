import type { CameraPreset } from "../types";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/臺/g, "台")
    .replace(/[\s_\-/.]+/g, " ")
    .trim();
}

/**
 * Filters only the supplied local camera presets. It does not resolve arbitrary
 * addresses or infer a coordinate for text that has no preset match.
 */
export function searchLocationPresets<T extends CameraPreset>(presets: readonly T[], query: string): T[] {
  const terms = [...new Set(normalize(query).split(" ").filter(Boolean))];
  if (!terms.length) return [...presets];
  return presets.filter((preset) => {
    const haystack = normalize(`${preset.id} ${preset.name} ${preset.description ?? ""}`);
    const compact = haystack.replace(/ /g, "");
    return terms.every((term) => haystack.includes(term) || compact.includes(term.replace(/ /g, "")));
  });
}
