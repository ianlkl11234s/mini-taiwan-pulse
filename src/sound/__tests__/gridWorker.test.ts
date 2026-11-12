/**
 * W6-4 網格 Worker：編碼還原後幀不變、核心＝各族原函式、同格不重算（工作量計數，不看牆鐘）、請求取代、亂序回應只套最後一次、
 * 主執行緒的 hook 不呼叫任何算格函式。真實資料需要本機 public/sound-atlas/grid 與 public/rail（CI 沒有 → skip）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { COMPOSITE_FAMILIES } from "../grid/compositeGrid";
import { GRID_STEP_S, SoundGridCore } from "../grid/gridComputeCore";
import { GRID_CELLS, GRID_UNKNOWN } from "../grid/gridSpec";
import { decodeRailSet, decodeRoadSet, encodeRailSet, encodeRoadSet, NetRegistry, TrackRegistry, type FromWorker, type GridFamily, type ToWorker } from "../grid/gridWire";
import { createGridHost } from "../grid/gridWorkerHost";
import { buildNaturalField, naturalGridFrame } from "../grid/naturalGrid";
import { potentialPackFrame } from "../grid/potentialPack";
import { railGridFrame } from "../grid/railGrid";
import { buildRainGaugeField, rainGridFrame } from "../grid/rainGrid";
import { buildRoadGridField, roadGridFrame, roadNetworkRecordOf } from "../grid/roadGrid";
import { createLatestGate, SoundGridClient, type Transport } from "../grid/soundGridClient";
import type { AnyRainRecord } from "../sourceAdapters/rainFieldAdapter";
import { hasRealGridAssets, loadRealGridSets } from "../../../scripts/preprocess/sound/loadRealGridSets";

const DATE = "2026-11-09";
const have = hasRealGridAssets(DATE);
const at = (h: number) => Math.floor((Date.parse(`${DATE}T00:00:00+08:00`) / 1000 + h * 3600) / GRID_STEP_S) * GRID_STEP_S;
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

function loadCore(real: Awaited<ReturnType<typeof loadRealGridSets>>): SoundGridCore {
  const core = new SoundGridCore();
  const tr = new TrackRegistry(), nr = new NetRegistry();
  for (const f of COMPOSITE_FAMILIES) {
    const set = real.sets[f];
    const data = f === "aviation" ? { kind: "aviation" as const, pack: real.aviationPack, note: null }
      : !set ? null : f === "rail" ? encodeRailSet(set, tr) : f === "road_traffic" ? encodeRoadSet(set, nr) : { kind: "plain" as const, set: structuredClone(set) };
    // 模擬 postMessage：整則訊息 structured clone
    core.setFamily(f, 1, f === "rail" || f === "road_traffic" ? "live" : "grid", structuredClone(data));
  }
  return core;
}

describe.skipIf(!have)(`Worker 核心＝各族原函式（真實 ${DATE}）`, () => {
  it("鐵道、道路編碼 → clone → 還原後，幀與原 set 相同；軌道只送一次", async () => {
    const real = await loadRealGridSets(DATE);
    const rail = real.sets.rail!, road = real.sets.road_traffic!;
    const tr = new TrackRegistry();
    const enc = encodeRailSet(rail, tr);
    expect(enc.tracks.length).toBeGreaterThan(100);
    expect(encodeRailSet(rail, tr).tracks.length).toBe(0); // 第二次不再送軌道
    const back = decodeRailSet(structuredClone(enc), new Map());
    for (const h of [7.6, 17.9]) {
      const b = at(h);
      expect(eq(railGridFrame(rail, b, b + 599.999).values, railGridFrame(back, b, b + 599.999).values)).toBe(true);
    }
    const nr = new NetRegistry();
    const renc = encodeRoadSet(road, nr);
    expect(renc.net).not.toBeNull();
    expect(encodeRoadSet(road, nr).net).toBeNull();
    const rback = decodeRoadSet(structuredClone(renc), new Map());
    const f0 = buildRoadGridField(roadNetworkRecordOf(road)!.payload.net), f1 = buildRoadGridField(roadNetworkRecordOf(rback)!.payload.net);
    const b = at(8);
    expect(eq(roadGridFrame(road, f0, b, b + 599.999).values, roadGridFrame(rback, f1, b, b + 599.999).values)).toBe(true);
  }, 180_000);

  it("七族：核心的幀＝直接呼叫各族函式（4 個 10 分格）；同格第二次是查表（重算次數不變）", async () => {
    const real = await loadRealGridSets(DATE);
    const core = loadCore(real);
    const s = real.sets;
    const rainField = buildRainGaugeField(s.rain!.records as AnyRainRecord[]);
    const roadField = buildRoadGridField(roadNetworkRecordOf(s.road_traffic!)!.payload.net);
    const nat = Object.fromEntries((["wind_vegetation", "coastal_wave", "river_water"] as const).map((f) => [f, buildNaturalField(f, s[f]!)]));
    for (const h of [3.1, 8.2, 14.05, 18.3]) {
      const b = at(h), t1 = b + GRID_STEP_S - 1e-6;
      const want: Record<GridFamily, Uint8Array> = {
        rain: rainGridFrame(s.rain!, rainField, b, t1).values,
        road_traffic: roadGridFrame(s.road_traffic!, roadField, b, t1).values,
        aviation: potentialPackFrame(real.aviationPack!, b)!.slice(),
        rail: railGridFrame(s.rail!, b, t1).values,
        wind_vegetation: naturalGridFrame(nat.wind_vegetation!, b, t1).values,
        coastal_wave: naturalGridFrame(nat.coastal_wave!, b, t1).values,
        river_water: naturalGridFrame(nat.river_water!, b, t1).values,
      };
      for (const f of COMPOSITE_FAMILIES) expect(eq(core.frame(f, b).values, want[f]), `${f} ${h}`).toBe(true);
    }
    const before = { ...core.computeCount };
    for (const h of [3.1, 8.2]) for (const f of COMPOSITE_FAMILIES) core.frame(f, at(h));
    expect(core.computeCount).toEqual(before);
  }, 180_000);
});

describe("Worker 排程與主執行緒路徑", () => {
  it("沒有全範圍來源（origin≠grid）的飛機／自然族整幀無法判斷；沒收過 set 的族 source_not_loaded", () => {
    const core = new SoundGridCore();
    core.setFamily("coastal_wave", 1, "scene", { kind: "plain", set: { family: "coastal_wave", dateKey: "2026-01-01", records: [], coverage: [] } as never });
    const r = core.frame("coastal_wave", 0);
    expect(r.note).toBe("no_full_area_source");
    expect(r.values.every((v) => v === GRID_UNKNOWN)).toBe(true);
    expect(core.frame("rail", 0).note).toBe("source_not_loaded");
  });

  it("同 key 的請求排隊中被新請求取代 → 舊的回 superseded、只算最後一筆（工作量計數）", () => {
    const out: FromWorker[] = [];
    const tasks: (() => void)[] = [];
    const host = createGridHost((m) => out.push(m), (fn) => tasks.push(fn));
    const req = (id: number, bin: number): ToWorker => ({ type: "frame", id, key: "layer", family: "rail", bin });
    host.onMessage({ type: "set", family: "rail", version: 1, origin: "live", data: { kind: "plain", set: { family: "rail", dateKey: "2026-11-09", records: [], coverage: [] } as never } });
    host.onMessage(req(1, 0));
    host.onMessage(req(2, 600));
    host.onMessage(req(3, 1200));
    while (tasks.length) tasks.shift()!();
    expect(out.filter((m) => m.type === "superseded").map((m) => m.id)).toEqual([1, 2]);
    const frames = out.filter((m) => m.type === "frame");
    expect(frames.map((m) => m.id)).toEqual([3]);
    // 只算了 1200 一格＋閒置預算前後各一格（1800、600）
    expect(host.core.computeCount.rail).toBe(3);
  });

  it("亂序回應：只套用最後一次請求（跳時間時晚回來的舊格不蓋新格）", async () => {
    const sent: Extract<ToWorker, { id: number }>[] = [];
    let deliver: (m: FromWorker) => void = () => {};
    const t: Transport = { kind: "inline", post: (m) => { if ("id" in m) sent.push(m); }, onMessage: (f) => { deliver = f; }, onError: () => {} };
    const client = new SoundGridClient(t, async () => null);
    const gate = createLatestGate();
    const applied: number[] = [];
    const ask = (bin: number) => {
      const tok = gate.next();
      return client.frame("k", "rail", bin).then((r) => { if (r && gate.isLatest(tok)) applied.push(r.bin); });
    };
    const p1 = ask(600);
    await new Promise((r) => setTimeout(r, 5)); // 第一筆已送出
    const p2 = ask(1200);
    await new Promise((r) => setTimeout(r, 5));
    expect(sent.map((m) => (m as { bin: number }).bin)).toEqual([600, 1200]);
    const mk = (id: number, bin: number): FromWorker => ({ type: "frame", id, family: "rail", bin, version: 1, values: new Uint8Array(GRID_CELLS), note: null, ms: 0 });
    deliver(mk(sent[1]!.id, 1200)); // 新的先回
    deliver(mk(sent[0]!.id, 600)); // 舊的後回
    await Promise.all([p1, p2]);
    expect(applied).toEqual([1200]);
  });

  it("主執行緒的網格 hook 不呼叫任何算格／建場函式（都在 Worker）", () => {
    const banned = /\b(railGridFrame|rainGridFrame|roadGridFrame|naturalGridFrame|buildNaturalField|buildRoadGridField|buildRainGaugeField|compositeFrames|potentialPackFrame)\b/;
    const hooks = readdirSync("src/hooks").filter((f) => /^useSound.*Grid.*\.ts$/.test(f));
    expect(hooks.length).toBeGreaterThanOrEqual(4);
    for (const f of hooks) {
      // 只看程式（去掉註解）：import 與呼叫都不可出現
      const code = readFileSync(`src/hooks/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, f).not.toMatch(banned);
    }
  });
});
