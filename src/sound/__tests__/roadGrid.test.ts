/**
 * W6-2 道路車流網格：國道配 VD 取值、臺北典型的平日判定、三級取值、無法判斷傳遞、網格值＝queryReceiver(格心, t)、切幀耗時。
 * 路段配 VD（依里程）與臺北 VD 延伸的幾何規則在 Python：scripts/preprocess/sound/test_road_grid_lib.py。
 * 真實資料抽樣需要本機 public/sound-atlas/grid/{road-network-v1,freeway-vd-<日>}.json（gitignore；CI 沒有 → skip）。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { queryFamilyInterval, queryReceiver } from "../engines/receiverQuery";
import { cellCenter, cellIndexOf, GRID_UNKNOWN, inScopeCells } from "../grid/gridSpec";
import { buildRoadGridField, roadGridFrame } from "../grid/roadGrid";
import {
  compileRoadNetwork, decodeRoadGridCode, ROAD_EVIDENCE_BASE, ROAD_NETWORK_SCHEMA, roadLevelOf, FREEWAY_VD_SCHEMA,
  type FreewayVdPack, type RoadEvidence, type RoadNetwork, type RoadNetworkFile,
} from "../grid/roadNetwork";
import { ROAD_GRID } from "../model/soundProfiles";
import { loadRoadTraffic, type RoadTrafficFetchers } from "../sourceAdapters/roadTrafficAdapter";
import type { VdBaselineEntry, VdBaselineFile } from "../sourceAdapters/typicalTrafficAdapter";
import type { FamilyResult, Receiver, SoundSourceSet } from "../types";

const U = GRID_UNKNOWN;
const WEEKDAY = "2026-11-09"; // 週一
const SATURDAY = "2026-11-07";
const HOLIDAY = "2026-10-26"; // 週一，光復節補假（nonWorkdays）
const TYPHOON = "2026-10-24"; // anomalyDays
const OUT_OF_CALENDAR = "2027-03-03";
const day0 = (d: string) => Date.parse(`${d}T00:00:00+08:00`) / 1000;

// 合成路網（北北範圍內、遠離彼此）：
//   A 國道東西向線（25.20），配 VD-T-A；A2 同線東延但沒配到 VD
//   B 臺北延伸路段（25.10），VD VT01；C 臺北延伸不到的主要道路（25.05）
//   D 新北等級推估 primary（24.98）
//   小路格：121.70, 25.15 那一格
const LAT_A = 25.2, LAT_B = 25.1, LAT_C = 25.05, LAT_D = 24.98;
const line = (lat: number, x0 = 121.45, x1 = 121.55): [number, number][] => [[x0, lat], [x1, lat]];
const MINOR_PT: [number, number] = [121.7, 25.15];
const FILE: RoadNetworkFile = {
  schema: ROAD_NETWORK_SCHEMA,
  grid: { id: "nn-250m-v1" },
  freeway: [
    { sec: "S1", road: "國道測試", dir: "E", vd: "VD-T-A", km: [0, 10], c: line(LAT_A) },
    { sec: "S1", road: "國道測試", dir: "E", vd: null, km: [10, 12], c: line(LAT_A, 121.6, 121.62) },
  ],
  taipei: [{ vd: "VT01", c: line(LAT_B) }],
  taipeiUncovered: [{ name: "測試路", c: line(LAT_C) }],
  estimate: [{ cls: "primary", name: "新北測試路", c: line(LAT_D) }],
  minorCells: [cellIndexOf(...MINOR_PT)],
};
const NET: RoadNetwork = compileRoadNetwork(FILE);

const series = (f: (k: number) => number | null) => Array.from({ length: 144 }, (_, k) => f(k));
function packFor(date: string, v: (number | null)[] = series(() => 20), day = "ok"): FreewayVdPack {
  return {
    schema: FREEWAY_VD_SCHEMA, date_taiwan: date, unit: "veh_per_min",
    frames: { count: 144, step_s: 600, first_slot_utc: new Date(day0(date) * 1000).toISOString(), slots_missing: [], slot_fetch_utc: series(() => null) as null[] },
    vds: { "VD-T-A": { lanes: 3, day, v } },
  };
}
const VT01: VdBaselineEntry = {
  id: "VT01", road: "測試路", lon: 121.5, lat: LAT_B,
  wd_flow: Array.from({ length: 24 }, (_, h) => (h === 3 ? null : h === 4 ? 0 : 900)),
  wd_flow_days: Array.from({ length: 24 }, (_, h) => (h === 5 ? 2 : 8)), wd_speed: Array(24).fill(40),
};
const BASELINE: VdBaselineFile = { meta: {}, vds: [VT01] };

async function setFor(date: string, pack: FreewayVdPack | null = packFor(date), over: Partial<RoadTrafficFetchers> = {}): Promise<SoundSourceSet> {
  return (await loadRoadTraffic({ date }, { network: async () => NET, pack: async () => pack, baseline: async () => BASELINE, ...over })) as SoundSourceSet;
}
const recv = (lon: number, lat: number): Receiver => ({ id: "r", longitude: lon, latitude: lat, environment: "outdoor" });
const at = (date: string, h: number, m = 5) => day0(date) + h * 3600 + m * 60;
const fam = (set: SoundSourceSet, r: Receiver, t0: number, t1 = t0) => queryFamilyInterval("road_traffic", [set], r, t0, t1);

/** 家族結果 → 網格碼（獨立寫一次，和 roadGridCode 互相驗證） */
function codeOfFamily(f: FamilyResult<"road_traffic">): number {
  if (f.status === "unknown" || f.status === "unavailable") return U;
  if (f.status === "inactive") return 0;
  const top = f.contributions.find((c) => c.status === "active" && c.relativePotential === f.relativePotential)!;
  return ROAD_EVIDENCE_BASE[top.evidence as RoadEvidence] + roadLevelOf(f.relativePotential!);
}

describe("道路網格：國道當日實測", () => {
  it("值＝該 10 分槽的 1 分鐘流量 ×60；潛勢＝距離項(200 m)×(1−e^(−Q/600))；evidence=observed", async () => {
    const set = await setFor(WEEKDAY, packFor(WEEKDAY, series(() => 10)));
    const r = fam(set, recv(121.5, LAT_A + 200 / 111_195), at(WEEKDAY, 8));
    const c = r.contributions[0]!;
    expect(r.status).toBe("active");
    expect(c.evidence).toBe("observed");
    expect(c.proxyKind).toBe("observed_volume");
    expect(c.notes).toContain("veh_per_hour:600");
    expect(r.relativePotential!).toBeCloseTo(0.5 * (1 - Math.exp(-1)), 3);
  });

  it("區間內取最大槽；缺槽＝無法判斷（不回補、不當 0）；VD 整日故障＝無法判斷", async () => {
    const v = series((k) => (k === 48 ? 30 : k === 49 ? null : 5));
    const set = await setFor(WEEKDAY, packFor(WEEKDAY, v));
    const near = recv(121.5, LAT_A);
    expect(fam(set, near, day0(WEEKDAY) + 48 * 600, day0(WEEKDAY) + 50 * 600 - 1).contributions[0]!.notes).toContain("veh_per_hour:1800");
    const gap = fam(set, near, day0(WEEKDAY) + 49 * 600 + 10);
    expect(gap.status).toBe("unknown");
    expect(gap.reason).toBe("freeway_vd_sample_missing");
    const broken = fam(await setFor(WEEKDAY, packFor(WEEKDAY, series(() => null), "day_all_zero")), near, at(WEEKDAY, 8));
    expect(broken.reason).toBe("freeway_vd_day_all_zero");
  });

  it("沒有每日包 → 國道無法判斷（不退回其他級）；沒配到 VD 的路段 → 無法判斷", async () => {
    const r = fam(await setFor(WEEKDAY, null), recv(121.5, LAT_A), at(WEEKDAY, 8));
    expect(r.status).toBe("unknown");
    expect(r.reason).toBe("freeway_vd_pack_missing");
    const r2 = fam(await setFor(WEEKDAY), recv(121.61, LAT_A), at(WEEKDAY, 8));
    expect(r2.reason).toBe("freeway_no_vd_within_gap");
  });

  it("流量 0（夜間真的沒車）→ 有效的 0，不是無法判斷", async () => {
    const r = fam(await setFor(WEEKDAY, packFor(WEEKDAY, series(() => 0))), recv(121.5, LAT_A), at(WEEKDAY, 3));
    expect(r.status).toBe("inactive");
    expect(r.relativePotential).toBe(0);
  });
});

describe("道路網格：臺北 VD 典型（平日判定不放寬）", () => {
  const onB = recv(121.5, LAT_B);
  it("平日 → estimated／typical_weekday_volume，註記樣本天數", async () => {
    const r = fam(await setFor(WEEKDAY), onB, at(WEEKDAY, 8));
    expect(r.status).toBe("active");
    expect(r.contributions[0]!.evidence).toBe("estimated");
    expect(r.contributions[0]!.notes).toContain("flow_days:8");
    expect(r.relativePotential!).toBeCloseTo(1 - Math.exp(-900 / 600), 3);
  });

  it.each([
    [SATURDAY, "typical_not_applicable(weekend)"],
    [HOLIDAY, "typical_not_applicable(national_holiday)"],
    [TYPHOON, "typical_not_applicable(anomaly_day)"],
    [OUT_OF_CALENDAR, "typical_not_applicable(calendar_not_covered)"],
  ])("%s → 無法判斷（%s）；國道與新北推估不受影響", async (date, reason) => {
    const set = await setFor(date);
    expect(fam(set, onB, at(date, 8)).reason).toBe(reason);
    expect(fam(set, recv(121.5, LAT_A), at(date, 8)).status).toBe("active");
    expect(fam(set, recv(121.5, LAT_D), at(date, 8)).status).toBe("active");
  });

  it("典型流量 null／樣本不足 → 無法判斷；典型流量 0 → 有效的 0", async () => {
    const set = await setFor(WEEKDAY);
    expect(fam(set, onB, at(WEEKDAY, 3)).reason).toBe("typical_flow_null");
    expect(fam(set, onB, at(WEEKDAY, 5)).reason).toBe("typical_sample_insufficient");
    expect(fam(set, onB, at(WEEKDAY, 4)).status).toBe("inactive");
  });

  it("延伸不到的臺北主要道路 → 無法判斷", async () => {
    expect(fam(await setFor(WEEKDAY), recv(121.5, LAT_C), at(WEEKDAY, 8)).reason).toBe("taipei_road_not_reached_by_vd");
  });
});

describe("道路網格：新北等級推估、三級取值、無法判斷 vs 0", () => {
  it("新北 primary：inferred／road_type_no_volume，不隨時間變", async () => {
    const set = await setFor(WEEKDAY);
    const a = fam(set, recv(121.5, LAT_D), at(WEEKDAY, 3));
    const b = fam(set, recv(121.5, LAT_D), at(WEEKDAY, 8));
    expect(a.contributions[0]!.evidence).toBe("inferred");
    expect(a.contributions[0]!.proxyKind).toBe("road_type_no_volume");
    expect(a.relativePotential).toBe(b.relativePotential);
    expect(a.relativePotential!).toBeCloseTo(1 - Math.exp(-ROAD_GRID.estimateClassVehPerHour.value.primary! / 600), 3);
  });

  it("同一點多來源取最高、來源記貢獻最大者；有已知 >0 時勝過無法判斷，popup 另標", async () => {
    // 國道（200 m 外、流量很小）與臺北典型（貼路）同在 → 取較高的臺北
    const midAB = recv(121.5, LAT_B + 0.0009);
    const set = await setFor(WEEKDAY, packFor(WEEKDAY, series(() => 1)));
    const f = fam(set, midAB, at(WEEKDAY, 8));
    expect(f.status).toBe("active");
    const top = f.contributions.find((c) => c.relativePotential === f.relativePotential)!;
    expect(top.evidence).toBe("estimated");
    // 週末：臺北無法判斷、國道已知 → 取國道（已知勝過無法判斷），另列無法判斷候選
    const wk = fam(await setFor(SATURDAY, packFor(SATURDAY, series(() => 1))), recv(121.5, LAT_A + 0.0009), at(SATURDAY, 8));
    expect(wk.status).toBe("active");
  });

  it("離任何道路都遠＝0（平靜）；只有小路＝無法判斷（有路但沒資料）", async () => {
    const set = await setFor(WEEKDAY);
    const far = fam(set, recv(121.75, 25.25), at(WEEKDAY, 8));
    expect(far.status).toBe("inactive");
    expect(far.relativePotential).toBe(0);
    const [mx, my] = cellCenter(cellIndexOf(...MINOR_PT));
    const minor = fam(set, recv(mx, my), at(WEEKDAY, 8));
    expect(minor.status).toBe("unknown");
    expect(minor.reason).toBe("minor_road_no_data");
  });

  it("路網讀不到 → coverage error → 家族無法判斷、整幀 255", async () => {
    const set = await setFor(WEEKDAY, null, { network: () => Promise.reject(new Error("boom")) });
    expect(set.coverage[0]!.status).toBe("error");
    expect(queryReceiver(recv(121.5, LAT_A), at(WEEKDAY, 8), [set], ["road_traffic"]).families[0]!.status).toBe("unknown");
    const f = roadGridFrame(set, buildRoadGridField(NET), at(WEEKDAY, 8), at(WEEKDAY, 8) + 599);
    expect(f.gateReason).toContain("no_healthy_source");
    expect([...inScopeCells()].every((c) => f.values[c] === U)).toBe(true);
  });

  it("網格碼：證據基底＋分級可解回；255＝無法判斷", () => {
    expect(decodeRoadGridCode(ROAD_EVIDENCE_BASE.estimated + 3)).toEqual({ level: 3, evidence: "estimated" });
    expect(decodeRoadGridCode(ROAD_EVIDENCE_BASE.inferred + 1)).toEqual({ level: 1, evidence: "inferred" });
    expect(decodeRoadGridCode(U)).toBeNull();
    expect([0, 0.099, 0.1, 0.3, 0.5, 0.75, 1].map(roadLevelOf)).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });
});

describe("網格值＝queryReceiver(格心, t)（合成路網，全範圍逐格）", () => {
  it.each([WEEKDAY, SATURDAY])("%s 四個時刻 0 不符", async (date) => {
    const set = await setFor(date, packFor(date, series((k) => (k % 7 === 0 ? null : k % 30))));
    const field = buildRoadGridField(NET);
    for (const h of [3, 8, 14, 18]) {
      const t0 = day0(date) + h * 3600, t1 = t0 + 599.999;
      const frame = roadGridFrame(set, field, t0, t1);
      let bad = 0, checked = 0;
      for (let k = 0; k < field.cells.length; k++) {
        const c = field.cells[k]!;
        // 有道路候選或小路的格逐格比；其餘（應為 0）抽 1/50 也比
        if (field.near[k]!.idx.length === 0 && !field.near[k]!.minor && k % 50 !== 0) continue;
        const [lon, lat] = cellCenter(c);
        checked++;
        if (codeOfFamily(fam(set, recv(lon, lat), t0, t1)) !== frame.values[c]) bad++;
      }
      expect(checked).toBeGreaterThan(200);
      expect(bad).toBe(0);
    }
  });
});

// ── 真實資料（本機有資產才跑）─────────────────────────────
const NET_PATH = "public/sound-atlas/grid/road-network-v1.json";
const BASE_PATH = "public/sound-atlas/vd-baseline-taipei.json";
const hasReal = existsSync(NET_PATH) && existsSync(BASE_PATH);
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe.skipIf(!hasReal)("真實資料：11-09、10-24 抽樣 ≥200 格 × 4 時刻 × 兩天、切幀耗時", () => {
  const real = hasReal ? compileRoadNetwork(readJson(NET_PATH)) : null;
  const realField = real ? buildRoadGridField(real) : null;
  it.each(["2026-11-09", "2026-10-24"])("%s", async (date) => {
    const packPath = `public/sound-atlas/grid/freeway-vd-${date}.json`;
    const set = (await loadRoadTraffic({ date }, {
      network: async () => real!,
      pack: async () => (existsSync(packPath) ? readJson(packPath) : null),
      baseline: async () => readJson(BASE_PATH),
    })) as SoundSourceSet;
    const cells = realField!.cells;
    // 確定性抽樣：有道路的格優先（每 37 格取 1），再補一般格
    const sample: number[] = [];
    for (let k = 0; k < cells.length; k += 37) sample.push(k);
    const ms: number[] = [];
    for (const h of [3, 8, 14, 18]) {
      const t0 = day0(date) + h * 3600, t1 = t0 + 599.999;
      const s = performance.now();
      const frame = roadGridFrame(set, realField, t0, t1);
      ms.push(performance.now() - s);
      let bad = 0;
      const seen = new Set<number>();
      for (const k of sample) {
        const c = cells[k]!;
        const [lon, lat] = cellCenter(c);
        const code = codeOfFamily(fam(set, recv(lon, lat), t0, t1));
        seen.add(code);
        if (code !== frame.values[c]) bad++;
      }
      expect(sample.length).toBeGreaterThanOrEqual(200);
      expect(bad).toBe(0);
      expect(seen.size).toBeGreaterThan(2); // 抽樣確實涵蓋多種值
    }
    // 切幀耗時（4 幀取最大；CI 不跑，本機 load 高時可能偏慢）
    expect(Math.max(...ms)).toBeLessThan(50);
  });
});
