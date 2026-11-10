/** AG-13 入倉守門的純函式（scripts/research/layer-warehouse-status.mjs）：CI 可跑的 fixture 測試。 */
import { describe, expect, it } from "vitest";
import { checkWarehouseGate, indexRegistry, parseLayerList, parseLayerListKeys } from "../../../scripts/research/layer-warehouse-status.mjs";

const FILES = [
  { name: "a.yaml", text: "id: a\nconsumers:\n  pulse_layers: [inWh]\nwarehouse:\n- table: ds_a\n  core: false\n" },
  { name: "stats_ds.yaml", text: "id: stats_ds\nconsumers:\n  pulse_layers:\n  - statsLayer\n" },
  { name: "gb_old.yaml", text: "id: gb_old\nconsumers:\n  pulse_layers: [oldLayer]\n" },
  { name: "kr_new.yaml", text: "id: kr_new\nconsumers:\n  pulse_layers: [newLayer, glow]\n" },
  { name: "_indicator_semantics.yaml", text: "indicators:\n- dataset: stats_ds\n  indicator: x\n" },
  { name: "_no_upstream.yaml", text: "layers:\n- layer: extTiles\n  reason: 外部圖磚\n" },
  { name: "_display_only.yaml", text: "layers:\n- layer: glow\n  reason: 純視覺\n  unlock: 不需解鎖\n" },
  { name: "_warehouse_baseline.yaml", text: "layers:\n- layer: oldLayer  # GB｜registered\n" },
  { name: "watchlist.yaml", text: "datasets:\n- x:\n  pulse_layers: [inWatchOnly]\n" },
];
const LAYERS = [
  { key: "inWh", datasets: [] },
  { key: "statsLayer", datasets: ["stats_ds"] },
  { key: "extTiles", datasets: [] },
  { key: "glow", datasets: [] },
  { key: "oldLayer", datasets: ["gb_old"] },
  { key: "newLayer", datasets: ["kr_new"] },
];

describe("layer warehouse gate (AG-13)", () => {
  it("classifies layers and flags a new layer without warehouse or DISPLAY_ONLY", () => {
    const gate = checkWarehouseGate(LAYERS, indexRegistry(FILES));
    expect(Object.fromEntries(gate.status)).toEqual({
      inWh: "warehouse", statsLayer: "statistics", extTiles: "no_upstream",
      glow: "display_only", oldLayer: "missing", newLayer: "missing",
    });
    expect(gate.violations).toEqual(["newLayer"]);
    expect(gate.staleBaseline).toEqual([]);
    expect(gate.incompleteDisplayOnly).toEqual([]);
  });

  it("baseline only shrinks: in-warehouse or removed layers must leave the baseline", () => {
    const files = FILES.map((f) => f.name === "_warehouse_baseline.yaml"
      ? { ...f, text: "layers:\n- layer: oldLayer\n- layer: inWh\n- layer: goneLayer\n" } : f);
    expect(checkWarehouseGate(LAYERS, indexRegistry(files)).staleBaseline).toEqual(["inWh", "goneLayer"]);
  });

  it("DISPLAY_ONLY needs both reason and unlock", () => {
    const files = FILES.map((f) => f.name === "_display_only.yaml"
      ? { ...f, text: "layers:\n- layer: glow\n  reason: 純視覺\n- layer: newLayer\n  reason: raster\n  unlock: 做區域統計後入倉\n" } : f);
    const gate = checkWarehouseGate(LAYERS, indexRegistry(files));
    expect(gate.violations).toEqual([]);
    expect(gate.incompleteDisplayOnly).toEqual(["glow"]);
  });

  it("parses list files with comments and nested fields", () => {
    const list = parseLayerList("# 註解\nlayers:\n- layer: a  # TW｜x\n- layer: b\n  reason: r\n  unlock: u\n");
    expect([...list.entries()]).toEqual([["a", { reason: "", unlock: "" }], ["b", { reason: "r", unlock: "u" }]]);
  });

  it("parseLayerListKeys keeps duplicates so _no_upstream.yaml duplicate checks can fire (review F072)", () => {
    expect(parseLayerListKeys("layers:\n- layer: a\n- layer: b\n- layer: a  # dup\n")).toEqual(["a", "b", "a"]);
  });
});
