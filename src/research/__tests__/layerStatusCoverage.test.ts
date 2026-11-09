/**
 * AG-14：圖層總表（docs/features/general-analysis/layer-status.csv）涵蓋 manifest 全部國家。
 * 總表由 scripts/research/build-layer-status.mjs 產生（需 pulse-data 登記簿，見檔頭）；
 * 新增、刪除圖層或改國別後沒重產，這支測試就紅。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LAYER_MANIFEST } from "../../data/layerManifest";

const CSV = resolve(__dirname, "../../../docs/features/general-analysis/layer-status.csv");
const WAREHOUSE_STATUSES = new Set(["warehouse", "statistics", "no_upstream", "display_only", "missing"]);

/** 最小 CSV 解析（雙引號欄位、"" 轉義、欄內換行） */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const [header, ...body] = parseCsv(readFileSync(CSV, "utf-8"));
const col = (name: string) => header.indexOf(name);
const records = body.map((cells) => ({
  key: cells[col("layer_key")],
  country: cells[col("country")],
  warehouse: cells[col("warehouse_status")],
}));
const countBy = (list: string[]) => list.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

describe("layer-status.csv covers every country in the manifest (AG-14)", () => {
  const manifest = Object.values(LAYER_MANIFEST);

  it("has country and warehouse_status columns", () => {
    expect(col("country")).toBeGreaterThanOrEqual(0);
    expect(col("warehouse_status")).toBeGreaterThanOrEqual(0);
  });

  it("per-country layer counts equal the manifest (regenerate with build-layer-status.mjs when red)", () => {
    expect(countBy(records.map((r) => r.country))).toEqual(countBy(manifest.map((e) => e.country ?? "TW")));
  });

  it("lists exactly the manifest keys, each with its manifest country", () => {
    const fromCsv = Object.fromEntries(records.map((r) => [r.key, r.country]));
    const fromManifest = Object.fromEntries(manifest.map((e) => [e.key, e.country ?? "TW"]));
    expect(fromCsv).toEqual(fromManifest);
    expect(records.length).toBe(manifest.length);
  });

  it("every row carries a warehouse status", () => {
    expect(records.filter((r) => !WAREHOUSE_STATUSES.has(r.warehouse)).map((r) => r.key)).toEqual([]);
  });
});
