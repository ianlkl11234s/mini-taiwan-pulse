/**
 * 印尼規格驅動層的「欄位存在性」守門：規格的 tile layer 名、filter／expression／popup 用到的欄位、分類值，
 * 必須真的存在於 PMTiles metadata（fixture `id-tile-fields.json`，由 scripts/preprocess/dump-id-tile-fields.py 重產）。
 * 目的：欄名或分類值打錯時整層會靜默空白（沒有錯誤），上線前在這裡擋下。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ID_DATA_SPECS } from "../../countries/id/idDataLayers";
import { ID_RASTER_SPECS } from "../../countries/id/idWavesLayers";

interface TileLayer { minzoom: number; maxzoom: number; fields: string[]; values: Record<string, (string | number)[]> }
const FIXTURE = JSON.parse(readFileSync(new URL("./__fixtures__/id-tile-fields.json", import.meta.url), "utf8")) as Record<string, Record<string, TileLayer>>;
// 人口、行政界、IDM 走專用 hook（不在規格表）；它們用到的欄位另列在下方
const DEDICATED: Record<string, { layer: string; props: string[] }[]> = {
  "id_admin_boundaries.pmtiles": [{ layer: "country", props: ["country_en", "country_id", "level"] }, { layer: "province", props: ["province_name", "kabkota_count", "level"] }, { layer: "kabkota", props: ["kabkota_name", "kabkota_type", "province_name", "level"] }],
  "id_population.pmtiles": ["province", "kabkota"].map((layer) => ({ layer, props: ["density_per_km2", "population", "male", "female", "pct_65_plus", "area_km2", "province_name", ...(layer === "kabkota" ? ["kabkota_name", "kabkota_type"] : [])] })),
  "id_rural_development.pmtiles": ["province", "kabkota"].map((layer) => ({ layer, props: ["idm_mean", "villages", "n_mandiri", "n_maju", "n_berkembang", "n_tertinggal", "n_sangat_tertinggal", "pct_tertinggal_or_worse", "province_name", ...(layer === "kabkota" ? ["kabkota_name"] : [])] })),
};

/** 遞迴收集表達式裡 ["get"|"has", "<prop>"] 用到的屬性名。 */
function propsIn(expr: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(expr)) {
    if ((expr[0] === "get" || expr[0] === "has") && typeof expr[1] === "string") acc.add(expr[1]);
    for (const e of expr) propsIn(e, acc);
  }
  return acc;
}
const simpleProp = (expr: unknown): string | null => {
  const m = JSON.stringify(expr).match(/^\["to-string",\["coalesce",\["get","([^"]+)"\],""\]\]$/);
  return m ? m[1]! : null;
};

describe("印尼規格 × 圖磚欄位", () => {
  it("每個規格層的 PMTiles 檔都有 metadata fixture", () => {
    for (const s of ID_DATA_SPECS) expect(FIXTURE[s.file], `${s.key} ${s.file}`).toBeDefined();
    expect(Object.keys(FIXTURE).length).toBeGreaterThanOrEqual(ID_DATA_SPECS.length);
  });

  for (const spec of ID_DATA_SPECS) {
    describe(spec.key, () => {
      const layers = FIXTURE[spec.file] ?? {};
      it("子圖層的 source-layer 存在、起始縮放不早於圖磚", () => {
        for (const part of spec.parts) {
          const tl = layers[part.sourceLayer];
          expect(tl, `${part.id} source-layer ${part.sourceLayer}`).toBeDefined();
          expect(part.minzoom, `${part.id} minzoom 早於圖磚 ${tl?.minzoom}`).toBeGreaterThanOrEqual(tl!.minzoom);
          expect(part.minzoom, `${part.id} minzoom 超過圖磚上限 ${tl?.maxzoom}`).toBeLessThanOrEqual(tl!.maxzoom);
        }
      });

      it("子圖層的 filter／分類／大小／描邊用到的欄位都在該 tile layer", () => {
        for (const part of spec.parts) {
          const fields = new Set(layers[part.sourceLayer]?.fields);
          const used = new Set<string>([
            ...propsIn(part.cat.expr), ...propsIn(part.filter), ...propsIn(part.hollow?.when), ...propsIn(part.ring?.when),
            ...(part.size ? [part.size.prop] : []),
          ]);
          for (const p of used) expect(fields.has(p), `${part.id} 用到欄位 ${p}，圖磚 ${part.sourceLayer} 沒有`).toBe(true);
        }
      });

      it("popup 欄位、標題欄位至少在其中一個 tile layer 存在", () => {
        const all = new Set(Object.values(layers).flatMap((l) => l.fields));
        const props = [...spec.fields.map((f) => f.prop), ...spec.fields.flatMap((f) => (f.unlessSameAs ? [f.unlessSameAs] : [])), ...spec.title.props, ...(spec.title.fallbackBy ? [spec.title.fallbackBy.prop] : []), ...(spec.legendTitleNote ? [] : [])];
        for (const p of props) expect(all.has(p), `popup／標題欄位 ${p} 不在 ${spec.file} 任何 tile layer`).toBe(true);
      });

      it("直接取屬性值分類的類別值，真的出現在圖磚的屬性值裡（有列舉時）", () => {
        for (const part of spec.parts) {
          const prop = simpleProp(part.cat.expr);
          if (!prop) continue; // 衍生分類（級距、群組）不是屬性原值
          const observed = layers[part.sourceLayer]?.values[prop];
          if (!observed) continue; // 值太多沒列舉（distinct >60）
          const seen = new Set(observed.map(String));
          for (const c of spec.cats) {
            if (c.parts && !c.parts.includes(part.id)) continue;
            for (const v of c.values) expect(seen.has(v), `${part.id}：類別 ${c.id} 的值「${v}」不在圖磚 ${prop} 的實際值 ${[...seen].slice(0, 12).join("、")}`).toBe(true);
          }
        }
      });

      it("popup 的分類對照表（map）鍵都是圖磚的實際值（有列舉時）", () => {
        for (const f of spec.fields) {
          if (!f.map) continue;
          const sources = Object.values(layers).map((l) => l.values[f.prop]).filter((v): v is (string | number)[] => !!v);
          if (!sources.length) continue;
          const seen = new Set(sources.flat().map(String));
          for (const k of Object.keys(f.map)) expect(seen.has(k), `${spec.key} 欄位 ${f.prop} 的對照鍵「${k}」不在圖磚實際值`).toBe(true);
        }
      });
    });
  }

  it("專用 hook（行政界、人口、IDM）用到的欄位與 tile layer 存在", () => {
    for (const [file, items] of Object.entries(DEDICATED)) {
      for (const { layer, props } of items) {
        const tl = FIXTURE[file]?.[layer];
        expect(tl, `${file} ${layer}`).toBeDefined();
        for (const p of props) expect(tl!.fields.includes(p), `${file} ${layer} 缺欄位 ${p}`).toBe(true);
      }
    }
  });

  it("raster 規格的檔名都在 lock（圖磚檔存在才不會整層空白）", () => {
    const lock = JSON.parse(readFileSync(new URL("../../../deploy/public-assets.lock.json", import.meta.url), "utf8")) as { entries: { path: string }[] };
    const paths = new Set(lock.entries.map((e) => e.path));
    for (const s of ID_RASTER_SPECS) expect(paths.has(`public/world/${s.file}`), s.file).toBe(true);
    for (const s of ID_DATA_SPECS) expect(paths.has(`public/world/${s.file}`), s.file).toBe(true);
  });
});
