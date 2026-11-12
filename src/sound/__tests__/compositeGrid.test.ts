/**
 * W6-4/5 綜合網格（甲／乙預覽）：
 * - 依 MODEL_DECISIONS §10 的文字公式在測試裡**另寫一份**（不呼叫 compositeCell／familyTerm），對真實兩天各 4 個時刻、每次 ≥200 格逐格比對 Worker 核心的輸出。
 * - 斜線門檻（可判斷族數、權重占比）、乙的權重重新正規化、飛機顯示門檻連動。
 * 真實資料需要本機 public/sound-atlas/grid 與 public/rail（CI 沒有 → skip）；單元部分 CI 也跑。
 */
import { describe, expect, it } from "vitest";
import { COMPOSITE, ROAD_GRID } from "../model/soundProfiles";
import { rainPotential } from "../engines/relativePotentialKernel";
import { COMPOSITE_B_SCALE, COMPOSITE_FAMILIES, compositeCell, compositeFrames } from "../grid/compositeGrid";
import { GRID_STEP_S, SoundGridCore } from "../grid/gridComputeCore";
import { GRID_UNKNOWN, inScopeCells } from "../grid/gridSpec";
import { encodeRailSet, encodeRoadSet, NetRegistry, TrackRegistry } from "../grid/gridWire";
import { RAIN_CLASS_EDGES_MM_H } from "../grid/rainClass";
import { hasRealGridAssets, loadRealGridSets } from "../../../scripts/preprocess/sound/loadRealGridSets";

type Fam = (typeof COMPOSITE_FAMILIES)[number];
const W = COMPOSITE.weights.value;
const W_SUM = COMPOSITE_FAMILIES.reduce((a, f) => a + W[f]!, 0);

/** 文件公式（獨立實作）：碼 → {L, s}；255 → null */
function docTerm(f: Fam, code: number, gate: number): { L: number; s: number } | null {
  if (code === 255) return null;
  if (f === "rain") {
    if (code > 4) return null;
    return { L: code, s: code === 0 ? 0 : rainPotential(RAIN_CLASS_EDGES_MM_H[code - 1]!) ?? 0 };
  }
  if (f === "road_traffic") {
    const L = code % 10;
    return { L, s: [0, ...ROAD_GRID.potentialClassEdges.value][L]! };
  }
  if (code > 200) return null;
  if (code === 0) return { L: 0, s: 0 };
  const lo = (code - 1) / 200;
  const g = f === "aviation" ? gate : 0;
  if (lo < g - 1e-9) return { L: 0, s: 0 };
  const L = lo >= 0.75 - 1e-9 ? 4 : lo >= 0.5 - 1e-9 ? 3 : lo >= 0.25 - 1e-9 ? 2 : 1;
  return { L, s: lo };
}

function docCell(codes: ArrayLike<number>, gate: number): { a: number; b: number } {
  let known = 0, active = 0, kw = 0, ws = 0;
  COMPOSITE_FAMILIES.forEach((f, i) => {
    const t = docTerm(f, codes[i]!, gate);
    if (!t) return;
    known++;
    kw += W[f]!;
    ws += W[f]! * t.s;
    if (t.L >= COMPOSITE.activeMinLevel.value[f]!) active++;
  });
  const enough = known >= COMPOSITE.minKnownFamilies.value;
  const [c1, c2] = COMPOSITE.levelCuts.value;
  const a = !enough ? 255 : active < c1! ? 0 : active < c2! ? 1 : 2;
  const b = !enough || kw / W_SUM < COMPOSITE.minKnownWeightShare.value ? 255 : Math.round((ws / kw) * COMPOSITE_B_SCALE);
  return { a, b };
}

function codesOf(m: Partial<Record<Fam, number>>): number[] {
  return COMPOSITE_FAMILIES.map((f) => m[f] ?? GRID_UNKNOWN);
}

describe("綜合網格規則（單元）", () => {
  it("可判斷族 < 4 → 甲乙都斜線；= 4 → 甲有值", () => {
    const three = compositeCell(codesOf({ rain: 0, road_traffic: 3, rail: 0 }));
    expect(three.known).toBe(3);
    expect(three.codeA).toBe(GRID_UNKNOWN);
    expect(three.codeB).toBe(GRID_UNKNOWN); // 權重占比 2.4/4.6 > 0.5，但族數不夠
    const four = compositeCell(codesOf({ rain: 0, road_traffic: 3, rail: 0, aviation: 0 }));
    expect(four.codeA).toBe(1); // 道路 L=3 偏活躍 1 種＝一般
    expect(four.dominant).toBe("road_traffic");
  });

  it("可判斷 4 族但權重占比 < 0.5 → 甲有值、乙斜線", () => {
    const r = compositeCell(codesOf({ rain: 0, wind_vegetation: 0, coastal_wave: 0, river_water: 0 }));
    expect(r.knownWeightShare).toBeCloseTo(2.0 / W_SUM, 6);
    expect(r.codeA).toBe(0);
    expect(r.codeB).toBe(GRID_UNKNOWN);
  });

  it("乙只對可判斷的族重新正規化權重（未知族不當 0）", () => {
    // 道路很高（下緣 0.75）＋飛機、鐵道、雨沒有活動；風浪河未知
    const r = compositeCell(codesOf({ road_traffic: 4, aviation: 0, rail: 0, rain: 0 }));
    const kw = W.road_traffic! + W.aviation! + W.rail! + W.rain!;
    expect(r.index).toBeCloseTo((W.road_traffic! * 0.75) / kw, 9);
    // 同樣的四族，若把未知族當 0 會是 /W_SUM（更小）→ 確認不是
    expect(r.index!).toBeGreaterThan((W.road_traffic! * 0.75) / W_SUM + 1e-6);
  });

  it("飛機顯示門檻連動：低於門檻＝0（甲不數、乙 s=0）", () => {
    const avCode = 1 + Math.floor(0.3 * 200); // 潛勢 0.30
    const base = { rain: 0, road_traffic: 0, rail: 0, aviation: avCode };
    const low = compositeCell(codesOf(base), 0.2);
    const high = compositeCell(codesOf(base), 0.4);
    expect(low.activeCount).toBe(1);
    expect(low.codeA).toBe(1);
    expect(low.index!).toBeGreaterThan(0);
    expect(high.activeCount).toBe(0);
    expect(high.codeA).toBe(0);
    expect(high.index).toBe(0);
  });

  it("各族不相加：七族都「中」仍只是熱鬧（甲只數種數）；甲乙與文件公式一致（隨機 5,000 格）", () => {
    const mid = compositeCell(codesOf({ rain: 2, road_traffic: 2, aviation: 61, rail: 61, wind_vegetation: 61, coastal_wave: 61, river_water: 61 }));
    expect(mid.codeA).toBe(2);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const pick = (f: Fam) => {
      if (rnd() < 0.2) return 255;
      if (f === "rain") return Math.floor(rnd() * 5);
      if (f === "road_traffic") return [0, 10, 20][Math.floor(rnd() * 3)]! + Math.floor(rnd() * 5);
      return rnd() < 0.3 ? 0 : 1 + Math.floor(rnd() * 200);
    };
    for (let k = 0; k < 5000; k++) {
      const codes = COMPOSITE_FAMILIES.map(pick);
      const gate = [0, 0.1, 0.2, 0.4][k % 4]!;
      const r = compositeCell(codes, gate);
      expect({ a: r.codeA, b: r.codeB }, codes.join(",")).toEqual(docCell(codes, gate));
    }
  });

  it("整幀：缺幀的族＝整族無法判斷；範圍外＝255", () => {
    const cells = new Uint32Array([0, 1]);
    const f = (v: number) => new Uint8Array(4).fill(v);
    const { a, b } = compositeFrames([f(0), f(4), f(0), f(0), null, null, null], 0, new Uint8Array(4), new Uint8Array(4), cells);
    expect([a[0], a[1], a[2]]).toEqual([1, 1, 255]);
    expect(b[0]).toBe(Math.round(((W.road_traffic! * 0.75) / (W.rain! + W.road_traffic! + W.aviation! + W.rail!)) * COMPOSITE_B_SCALE));
  });
});

for (const DATE of ["2026-11-09", "2026-10-24"]) {
  describe.skipIf(!hasRealGridAssets(DATE))(`綜合網格＝文件公式逐格重算（真實 ${DATE}）`, () => {
    it("4 個 10 分格 × 每格 ≥200 格、兩個飛機門檻：甲乙都與獨立實作相同", async () => {
      const real = await loadRealGridSets(DATE);
      const core = new SoundGridCore();
      const tr = new TrackRegistry(), nr = new NetRegistry();
      for (const f of COMPOSITE_FAMILIES) {
        const set = real.sets[f];
        const data = f === "aviation" ? { kind: "aviation" as const, pack: real.aviationPack, note: null }
          : !set ? null : f === "rail" ? encodeRailSet(set, tr) : f === "road_traffic" ? encodeRoadSet(set, nr) : { kind: "plain" as const, set };
        core.setFamily(f, 1, f === "rail" || f === "road_traffic" ? "live" : "grid", data);
      }
      const scope = inScopeCells();
      const stride = Math.floor(scope.length / 250);
      const day0 = Date.parse(`${DATE}T00:00:00+08:00`) / 1000;
      let checked = 0, nonTrivialA = 0;
      for (const h of [3, 8, 14, 18.5]) {
        const bin = Math.floor((day0 + h * 3600) / GRID_STEP_S) * GRID_STEP_S;
        for (const gate of [0, 0.2]) {
          const out = core.composite(bin, gate);
          const frames = COMPOSITE_FAMILIES.map((f) => core.frame(f, bin).values);
          let n = 0;
          for (let k = 0; k < scope.length; k += stride) {
            const c = scope[k]!;
            const codes = frames.map((fr) => fr[c]!);
            const want = docCell(codes, gate);
            expect({ a: out.a[c], b: out.b[c] }, `${h}h gate ${gate} cell ${c} codes ${codes.join(",")}`).toEqual(want);
            if (want.a === 1 || want.a === 2) nonTrivialA++;
            n++;
          }
          expect(n).toBeGreaterThanOrEqual(200);
          checked += n;
        }
      }
      expect(checked).toBeGreaterThanOrEqual(200 * 8);
      expect(nonTrivialA).toBeGreaterThan(0); // 比對不是全為平靜／斜線的空測
    }, 300_000);
  });
}

