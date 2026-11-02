/** 族語方言與部落點位圖例只列地圖上實際塗色的值：寫死的清單要和 public 資料的 ethnic_group 一致。 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DIALECT_GROUP_OPTIONS, DIALECT_LEGEND_OPTIONS, DIALECT_MAPPED_GROUPS, TRIBE_ETHNIC_OPTIONS, TRIBE_LEGEND_OPTIONS, TRIBE_MAPPED_GROUPS,
} from "../atlasLayerTypes";

describe("indigenousLanguageDialects legend", () => {
  const fc = JSON.parse(readFileSync("public/indigenous_rural/indigenous_language_dialects.geojson", "utf8")) as {
    features: { properties: { ethnic_group: string } }[];
  };
  const inData = new Set(fc.features.map((f) => f.properties.ethnic_group));

  it("legend values equal the ethnic_group values present in the data", () => {
    expect([...DIALECT_MAPPED_GROUPS].sort()).toEqual([...inData].sort());
    expect(DIALECT_LEGEND_OPTIONS.map((o) => o.value).sort()).toEqual([...inData].sort());
  });

  it("every data value has a color in the full option list (popup)", () => {
    const known = new Set(DIALECT_GROUP_OPTIONS.map((o) => o.value));
    for (const v of inData) expect(known.has(v)).toBe(true);
  });
});

describe("indigenousTribes legend", () => {
  const fc = JSON.parse(readFileSync("public/indigenous_rural/indigenous_tribes.geojson", "utf8")) as {
    features: { properties: { ethnic_group: string | null; in_current_approved_list?: boolean } }[];
  };
  const known = new Set(TRIBE_ETHNIC_OPTIONS.map((o) => o.value));
  // 有族色的點：核定名單內、族別是 16 族之一（多族並列與非核定落灰，圖例另列灰色）
  const colored = new Set(
    fc.features
      .filter((f) => f.properties.in_current_approved_list !== false && known.has(String(f.properties.ethnic_group)))
      .map((f) => String(f.properties.ethnic_group)),
  );

  it("legend values equal the single-ethnic values present among approved points", () => {
    expect([...TRIBE_MAPPED_GROUPS].sort()).toEqual([...colored].sort());
    expect(TRIBE_LEGEND_OPTIONS.map((o) => o.value).sort()).toEqual([...colored].sort());
  });
});
