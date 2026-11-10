/**
 * AG-13：layer-status.csv 的 missing 只准減少（scripts/research/check-warehouse-gate.mjs 的純函式）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CSV_PATH, diffMissing, parseStatusCsv } from "../../../scripts/research/check-warehouse-gate.mjs";

const csv = (rows: [string, string][]) =>
  ["layer_key,label,warehouse_status,description", ...rows.map(([k, s]) => `${k},"標籤, 含逗號",${s},"多行\n說明 ""引號"""`)].join("\n") + "\n";

describe("warehouse gate diff (AG-13)", () => {
  it("parses quoted cells, commas and embedded newlines", () => {
    const m = parseStatusCsv(csv([["a", "missing"], ["b", "warehouse"]]));
    expect([...m]).toEqual([["a", "missing"], ["b", "warehouse"]]);
  });

  it("fails on a CSV without the needed columns", () => {
    expect(() => parseStatusCsv("key,status\na,missing\n")).toThrow(/warehouse_status/);
  });

  it("new layer that is missing → added; new layer DISPLAY_ONLY or in warehouse → ok", () => {
    const base = parseStatusCsv(csv([["a", "missing"], ["b", "warehouse"]]));
    expect(diffMissing(base, parseStatusCsv(csv([["a", "missing"], ["b", "warehouse"], ["c", "missing"]]))).added).toEqual(["c"]);
    expect(diffMissing(base, parseStatusCsv(csv([["a", "missing"], ["b", "warehouse"], ["c", "display_only"], ["d", "warehouse"]]))).added).toEqual([]);
  });

  it("existing layer regressing to missing → added; shrinking is fine", () => {
    const base = parseStatusCsv(csv([["a", "missing"], ["b", "warehouse"]]));
    expect(diffMissing(base, parseStatusCsv(csv([["a", "missing"], ["b", "missing"]]))).added).toEqual(["b"]);
    const d = diffMissing(base, parseStatusCsv(csv([["a", "warehouse"], ["b", "warehouse"]])));
    expect(d).toEqual({ added: [], removed: ["a"], baseCount: 1, headCount: 0 });
  });

  it("renamed missing layer counts as a new missing layer", () => {
    const base = parseStatusCsv(csv([["old", "missing"]]));
    expect(diffMissing(base, parseStatusCsv(csv([["renamed", "missing"]]))).added).toEqual(["renamed"]);
  });

  it("the real layer-status.csv parses with the expected statuses", () => {
    const m = parseStatusCsv(readFileSync(resolve(__dirname, "../../..", CSV_PATH), "utf-8"));
    expect(m.size).toBeGreaterThan(1000);
    expect(new Set(m.values())).toEqual(new Set(["warehouse", "statistics", "no_upstream", "display_only", "missing"]));
  });
});
