/**
 * W6-2 道路網格量測（開發用）：npx vite-node scripts/preprocess/sound/road-grid-bench.ts [日期…]
 * 讀本機 public/sound-atlas/grid/{road-network-v1,freeway-vd-<D>}.json 與 vd-baseline-taipei.json；
 * 印建格候選耗時、每幀耗時與各級格數（範圍內）。
 */
import { readFileSync } from "node:fs";
import { loadRoadTraffic } from "../../../src/sound/sourceAdapters/roadTrafficAdapter";
import { compileRoadNetwork, decodeRoadGridCode, type RoadNetworkFile } from "../../../src/sound/grid/roadNetwork";
import { buildRoadGridField, roadGridFrame } from "../../../src/sound/grid/roadGrid";
import { GRID_UNKNOWN } from "../../../src/sound/grid/gridSpec";
import type { SoundSourceSet } from "../../../src/sound/types";

const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const dates = process.argv.slice(2).length ? process.argv.slice(2) : ["2026-11-09", "2026-10-24"];
const file = json("public/sound-atlas/grid/road-network-v1.json") as RoadNetworkFile;
let t = performance.now();
const net = compileRoadNetwork(file);
console.log(`compile ${(performance.now() - t).toFixed(0)} ms, sources ${net.sources.length}`);
t = performance.now();
const field = buildRoadGridField(net);
const nearCounts = field.near.map((n) => n.idx.length).sort((a, b) => a - b);
console.log(`field ${(performance.now() - t).toFixed(0)} ms, cells ${field.cells.length}, near median ${nearCounts[nearCounts.length >> 1]} max ${nearCounts[nearCounts.length - 1]}`);
for (const date of dates) {
  const set = (await loadRoadTraffic({ date }, {
    network: async () => net,
    pack: async (d) => { try { return json(`public/sound-atlas/grid/freeway-vd-${d}.json`); } catch { return null; } },
    baseline: async () => json("public/sound-atlas/vd-baseline-taipei.json"),
  })) as SoundSourceSet;
  const day0 = Date.parse(`${date}T00:00:00+08:00`) / 1000;
  const ms: number[] = [];
  for (const h of [3, 8, 14, 18]) {
    const b = day0 + h * 3600;
    const t1 = performance.now();
    const f = roadGridFrame(set, field, b, b + 600 - 1e-6);
    ms.push(performance.now() - t1);
    const hist: Record<string, number> = {};
    for (const c of field.cells) {
      const v = f.values[c]!;
      const d = decodeRoadGridCode(v);
      const k = v === GRID_UNKNOWN ? "unknown" : `${d!.evidence}:${d!.level}`;
      hist[k] = (hist[k] ?? 0) + 1;
    }
    console.log(date, `${h}:00`, JSON.stringify(hist));
  }
  console.log(date, "frame ms", ms.map((x) => x.toFixed(1)).join(", "), "coverage", set.coverage[0]!.reason);
}
