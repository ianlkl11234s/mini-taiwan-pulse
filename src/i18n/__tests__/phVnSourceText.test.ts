import { describe, expect, it } from "vitest";
import { PH_ADMIN_SOURCE, PH_DATA_SPECS, PH_POPULATION_SOURCE } from "../../countries/ph/phDataLayers";
import { VN_ADMIN_SOURCE, VN_DATA_SPECS, VN_POPULATION_SOURCE } from "../../countries/vn/vnDataLayers";
import { VN_RASTER_SPECS, VN_WAVE_SPECS } from "../../countries/vn/vnWavesLayers";
import { PH_RASTER_SPECS, PH_WAVE_SPECS } from "../../countries/ph/phWavesLayers";

/** 菲律賓、越南圖層的來源、授權、單位、級距標籤：英／日介面不得出現中文（I18N-2，2026-11-21）。 */
const HAN = /[㐀-鿿]/;
const TEXT_KEYS = new Set(["sourceOrg", "license", "sourceShort", "unit", "org", "short", "label"]);

type Hit = { path: string; value: string };

/** 規格中凡是「來源、授權、單位、標籤」欄：純字串不得含漢字；L3 的 en 不得含漢字，ja 必須有值。 */
function collect(root: unknown, tag: string): Hit[] {
  const hits: Hit[] = [];
  const walk = (o: unknown, path: string, depth: number) => {
    if (!o || typeof o !== "object" || depth > 8) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      if (TEXT_KEYS.has(k)) {
        if (typeof v === "string") { if (HAN.test(v)) hits.push({ path: p, value: v }); continue; }
        const l = v as { zh?: unknown; en?: unknown; ja?: unknown } | null;
        if (l && typeof l.zh === "string" && typeof l.en === "string" && typeof l.ja === "string") {
          if (HAN.test(l.en)) hits.push({ path: `${p}.en`, value: l.en });
          if (!l.ja.trim()) hits.push({ path: `${p}.ja`, value: "(empty)" });
          continue;
        }
      }
      if (typeof v === "object") walk(v, p, depth + 1);
    }
  };
  walk(root, tag, 0);
  return hits;
}

describe("菲律賓、越南圖層來源／授權／單位不含中文（en／ja）", () => {
  it.each([
    ["PH", [...PH_DATA_SPECS, ...PH_WAVE_SPECS, ...PH_RASTER_SPECS, PH_ADMIN_SOURCE, PH_POPULATION_SOURCE]],
    ["VN", [...VN_DATA_SPECS, ...VN_WAVE_SPECS, ...VN_RASTER_SPECS, VN_ADMIN_SOURCE, VN_POPULATION_SOURCE]],
  ] as const)("%s", (tag, specs) => {
    const hits = specs.flatMap((s, i) => collect(s, `${tag}[${(s as { key?: string }).key ?? i}]`));
    expect(hits.slice(0, 20)).toEqual([]);
  });
});
