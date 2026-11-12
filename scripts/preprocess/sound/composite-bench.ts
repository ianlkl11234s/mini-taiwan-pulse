/**
 * W6-4/5 量測：兩個場景日各族「偏活躍」比例、甲乙分布、Worker 核心算幀耗時（node）。
 * 用法：npx vite-node scripts/preprocess/sound/composite-bench.ts [YYYY-MM-DD…]
 */
import { COMPOSITE_FAMILIES, compositeCell, familyTerm } from "../../../src/sound/grid/compositeGrid";
import { SoundGridCore } from "../../../src/sound/grid/gridComputeCore";
import { inScopeCells } from "../../../src/sound/grid/gridSpec";
import { encodeRailSet, encodeRoadSet, NetRegistry, TrackRegistry } from "../../../src/sound/grid/gridWire";
import { loadRealGridSets } from "./loadRealGridSets";

const dates = process.argv.slice(2).length ? process.argv.slice(2) : ["2026-11-09", "2026-10-24"];
const GATE = 0.2;
for (const date of dates) {
  const { sets, aviationPack } = await loadRealGridSets(date);
  const core = new SoundGridCore();
  const tr = new TrackRegistry(), nr = new NetRegistry();
  for (const f of COMPOSITE_FAMILIES) {
    const set = sets[f];
    const data = f === "aviation" ? { kind: "aviation" as const, pack: aviationPack, note: null }
      : !set ? null : f === "rail" ? encodeRailSet(set, tr) : f === "road_traffic" ? encodeRoadSet(set, nr) : { kind: "plain" as const, set };
    core.setFamily(f, 1, f === "rail" || f === "road_traffic" ? "live" : "grid", data);
  }
  const cells = inScopeCells();
  for (const h of [3, 8, 14, 18]) {
    const bin = Date.parse(`${date}T${String(h).padStart(2, "0")}:00:00+08:00`) / 1000;
    const ms: Record<string, number> = {};
    for (const f of COMPOSITE_FAMILIES) { const s = performance.now(); core.frame(f, bin); ms[f] = Math.round(performance.now() - s); }
    const s = performance.now();
    core.composite(bin, GATE);
    const compMs = Math.round(performance.now() - s);
    const active: Record<string, number> = {}, unknown: Record<string, number> = {}, lv: Record<string, number[]> = {};
    const aHist = [0, 0, 0, 0], bHist = new Array(6).fill(0);
    const frames = COMPOSITE_FAMILIES.map((f) => core.frame(f, bin).values);
    const codes = new Uint8Array(7);
    for (const c of cells) {
      COMPOSITE_FAMILIES.forEach((f, i) => {
        codes[i] = frames[i]![c]!;
        const t = familyTerm(f, codes[i]!, GATE);
        if (!t) unknown[f] = (unknown[f] ?? 0) + 1;
        else { (lv[f] ??= [0, 0, 0, 0, 0])[t.level]!++; if (t.level >= 2) active[f] = (active[f] ?? 0) + 1; }
      });
      const r = compositeCell(codes, GATE);
      aHist[r.codeA === 255 ? 3 : r.codeA]!++;
      bHist[r.index == null ? 5 : Math.min(4, Math.floor(r.index * 5))]!++;
    }
    const pct = (n: number | undefined) => `${(((n ?? 0) / cells.length) * 100).toFixed(1)}%`;
    console.log(`\n${date} ${h}:00  frameMs=${JSON.stringify(ms)} compositeMs=${compMs}`);
    for (const f of COMPOSITE_FAMILIES) console.log(`  ${f.padEnd(16)} active(≥中)=${pct(active[f])} unknown=${pct(unknown[f])} levels=${JSON.stringify(lv[f])}`);
    console.log(`  甲 平靜/一般/熱鬧/斜線 = ${aHist.map(pct).join(" / ")}`);
    console.log(`  乙 [0,.2)/[.2,.4)/[.4,.6)/[.6,.8)/[.8,1]/斜線 = ${bHist.map(pct).join(" / ")}`);
  }
}
