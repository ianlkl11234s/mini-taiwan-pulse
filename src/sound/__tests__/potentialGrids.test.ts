/**
 * W6-3 連續潛勢網格（飛機、鐵道、風吹樹葉、海浪、河川）：碼與分箱、門檻、每日包、網格值＝queryReceiver(格心, 區間)。
 * 真實資料抽樣需要本機 public/sound-atlas/grid/（gitignore）與 public/rail（CI 沒有 → skip）。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { queryFamilyInterval } from "../engines/receiverQuery";
import { cellCenter, cellIndexOf, GRID_CELLS, GRID_SPEC, GRID_UNKNOWN, inScopeCells } from "../grid/gridSpec";
import {
  binLookup, codePotentialRange, familyResultCode, minCodeForPotential, potentialLevelOfCode, potentialLevelTable, quantizePotential,
} from "../grid/potentialCode";
import { AVIATION_GRID_GATES, AVIATION_PACK_EDGES, aviationGateFromSearch, aviationGatePotential, DEFAULT_AVIATION_GATE } from "../grid/aviationGates";
import { decodePotentialPack, potentialPackFrame, POTENTIAL_PACK_SCHEMA } from "../grid/potentialPack";
import { gridSourceApplies, gridSourceSha, loadAviationGridSource, loadNaturalGridSource, loadRainGridSource } from "../grid/gridSources";
import { decodeRadarRainPack } from "../grid/radarRainPack";
import { buildRainGaugeField, rainGridFrame } from "../grid/rainGrid";
import { cellReceiver } from "../grid/potentialGridState";
import { buildNaturalField, naturalGridFrame, type NaturalFamily } from "../grid/naturalGrid";
import { railGridFrame } from "../grid/railGrid";
import { SoundGridCore } from "../grid/gridComputeCore";
import { prefilterAviation, withRadarRain } from "../soundAtlasData";
import { loadRail } from "../sourceAdapters/railAdapter";
import type { AviationRecord } from "../sourceAdapters/aviationAdapter";
import type { SoundSourceSet } from "../types";
import { localRailFetchers } from "../../../scripts/preprocess/sound/railLocalFetchers";

const U = GRID_UNKNOWN;
const GRID_DIR = "public/sound-atlas/grid";

/** 測試用 fetch：讀本機 public/ 檔（缺檔 → 404） */
const localFetch = (async (url: string) => {
  const p = path.join("public", decodeURIComponent(String(url)));
  if (!existsSync(p)) return new Response("not found", { status: 404 });
  return new Response(readFileSync(p));
}) as typeof fetch;

function sampleCells(n: number, seed = 7): number[] {
  const all = inScopeCells();
  const out = new Set<number>();
  let s = seed;
  while (out.size < n) { s = (s * 1103515245 + 12345) % 2 ** 31; out.add(all[s % all.length]!); }
  return [...out];
}

/** (lon, lat) 周圍 r 格內的範圍內格 */
function cellsAround(lon: number, lat: number, r: number): number[] {
  const scope = new Set(inScopeCells());
  const c0 = cellIndexOf(lon, lat);
  const out: number[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = c0 + dy * GRID_SPEC.cols + dx;
    if (scope.has(c)) out.push(c);
  }
  return out;
}

describe("potentialCode", () => {
  it("量化：≤0／NaN → 0；>0 一律 ≥1；1 → 250", () => {
    expect([0, -1, Number.NaN, 1e-9, 0.004, 0.0999, 0.1, 0.2, 1, 5].map(quantizePotential)).toEqual([0, 0, 0, 1, 1, 20, 21, 41, 200, 200]);
    expect(familyResultCode({ status: "inactive", relativePotential: 0 })).toBe(0);
    expect(familyResultCode({ status: "unknown", relativePotential: null })).toBe(U);
    expect(familyResultCode({ status: "unavailable", relativePotential: null })).toBe(U);
    expect(codePotentialRange(21)).toEqual([0.1, 0.105]);
    expect(codePotentialRange(U)).toBeNull();
  });

  it("門檻 t（1/200 倍數）：潛勢 ≥ t ⇔ 碼 ≥ minCodeForPotential(t)", () => {
    for (const t of [0.02, 0.04, 0.1, 0.2, 0.25, 0.4, 0.5, 0.75]) {
      for (let k = 0; k <= 2000; k++) {
        const p = k / 2000;
        expect(quantizePotential(p) >= minCodeForPotential(t), `p=${p} t=${t}`).toBe(p >= t);
      }
    }
  });

  it("分級（含門檻）與色表一致；255 → null／-1", () => {
    expect(potentialLevelOfCode(0)).toBe(0);
    expect(potentialLevelOfCode(quantizePotential(0.1))).toBe(1);
    expect(potentialLevelOfCode(quantizePotential(0.1), 0.2)).toBe(0);
    expect(potentialLevelOfCode(quantizePotential(0.3))).toBe(2);
    expect(potentialLevelOfCode(quantizePotential(0.6))).toBe(3);
    expect(potentialLevelOfCode(quantizePotential(0.9))).toBe(4);
    expect(potentialLevelOfCode(U)).toBeNull();
    const tab = potentialLevelTable(0.2);
    expect(tab[U]).toBe(-1);
    for (let c = 0; c <= 200; c++) expect(tab[c]).toBe(potentialLevelOfCode(c, 0.2));
    expect(tab[201]).toBe(-1);
  });

  it("分箱後，對箱界上的任何門檻與分級，分級都和精確碼相同", () => {
    const lut = binLookup(AVIATION_PACK_EDGES);
    for (const g of AVIATION_GRID_GATES) {
      for (let c = 0; c <= 255; c++) expect(potentialLevelOfCode(lut[c]!, g.potential), `c=${c} gate=${g.id}`).toBe(potentialLevelOfCode(c, g.potential));
    }
    expect(lut[0]).toBe(0);
    expect(lut[U]).toBe(U);
    expect(lut[3]).toBe(1);
  });

  it("飛機門檻：三選一、預設中；網址參數只收合法值", () => {
    expect(AVIATION_GRID_GATES.map((g) => g.potential)).toEqual([0.1, 0.2, 0.4]);
    expect(DEFAULT_AVIATION_GATE).toBe("strict");
    expect(aviationGatePotential(undefined)).toBe(0.2);
    expect(aviationGatePotential("very_strict")).toBe(0.4);
    expect(aviationGateFromSearch("?soundAviationGate=current&x=1")).toBe("current");
    expect(aviationGateFromSearch("?soundAviationGate=0.3")).toBeNull();
  });

  it("全範圍來源檔適用：沒有接收點或在網格外框內；臺中和平不適用", () => {
    expect(gridSourceApplies(null)).toBe(true);
    expect(gridSourceApplies({ longitude: 121.52, latitude: 25.05 })).toBe(true);
    expect(gridSourceApplies({ longitude: 121.2, latitude: 24.25 })).toBe(false);
  });
});

describe("potentialPack", () => {
  const DATE = "2026-07-14";
  const DAY0 = Date.parse(`${DATE}T00:00:00+08:00`) / 1000;
  const meta = (over: Record<string, unknown> = {}) => ({
    schema: POTENTIAL_PACK_SCHEMA, family: "aviation", date_taiwan: DATE,
    grid: { id: GRID_SPEC.id, west: GRID_SPEC.west, north: GRID_SPEC.north, dLon: GRID_SPEC.dLon, dLat: GRID_SPEC.dLat, cols: GRID_SPEC.cols, rows: GRID_SPEC.rows },
    payload: { file: "x", encoding: "gzip", bytes: 0, raw_bytes: 2 * GRID_CELLS, sha256: "" },
    frames: { count: 2, step_s: 600, first_slot_utc: new Date(DAY0 * 1000).toISOString(), rule: "" },
    code: { scale: 200, max: 200, unknown: 255, bin_edges: [], rule: "" },
    source: { file: "a", sha256: "abc", schema: "s" },
    ...over,
  });
  it("解碼與驗證：碼表／網格／日期不符、長度錯、201–254 → null；幀＝[起點, +600)", async () => {
    const raw = new Uint8Array(2 * GRID_CELLS); raw[5] = 7; raw[GRID_CELLS + 5] = U;
    const p = await decodePotentialPack(meta(), new Uint8Array(gzipSync(raw)), "aviation", DATE);
    expect(p).not.toBeNull();
    expect(potentialPackFrame(p!, DAY0 + 599)![5]).toBe(7);
    expect(potentialPackFrame(p!, DAY0 + 600)![5]).toBe(U);
    expect(potentialPackFrame(p!, DAY0 + 1200)).toBeNull();
    expect(await decodePotentialPack(meta({ code: { scale: 100, max: 100, unknown: 255 } }), raw, "aviation", DATE)).toBeNull();
    expect(await decodePotentialPack(meta(), raw, "aviation", "2026-07-15")).toBeNull();
    expect(await decodePotentialPack(meta(), raw.subarray(1), "aviation", DATE)).toBeNull();
    const bad = raw.slice(); bad[9] = 252;
    expect(await decodePotentialPack(meta(), bad, "aviation", DATE)).toBeNull();
    expect(await decodePotentialPack(meta({ source: {} }), raw, "aviation", DATE)).toBeNull();
  });
});

// ── 真實資料：網格值＝queryReceiver(格心, 區間) ───────────────
const DATES = ["2026-11-09", "2026-10-24"];
const at = (date: string, h: number) => Date.parse(`${date}T00:00:00+08:00`) / 1000 + Math.round(h * 3600);
const binOf = (t: number) => Math.floor(t / 600) * 600;

describe.each(DATES)("飛機網格包（真實 %s）", (date) => {
  const have = existsSync(`${GRID_DIR}/aviation-src-${date}.json`) && existsSync(`${GRID_DIR}/aviation-${date}.class.bin`);
  it.skipIf(!have)("包的碼＝分箱(queryReceiver 碼)：≥200 格 × 4 個 10 分區間；來源雜湊一致", async () => {
    const set = (await loadAviationGridSource(date, Date.now() / 1000, localFetch))!;
    expect(set).not.toBeNull();
    const meta = JSON.parse(readFileSync(`${GRID_DIR}/aviation-${date}.meta.json`, "utf8"));
    const pack = (await decodePotentialPack(meta, new Uint8Array(readFileSync(`${GRID_DIR}/aviation-${date}.class.bin`)), "aviation", date))!;
    expect(pack).not.toBeNull();
    expect(pack.meta.source.sha256).toBe(gridSourceSha("aviation", date));
    const lut = binLookup(AVIATION_PACK_EDGES);
    // 亂數格＋松山機場、桃園進場航道附近（確保有足夠的「有飛機」樣本）
    const cells = [...new Set([...sampleCells(200, 3), ...cellsAround(121.552, 25.069, 4), ...cellsAround(121.43, 25.02, 3)])];
    const times = [8.1, 12.55, 18.2, 21.95].map((h) => binOf(at(date, h)));
    const hist: Record<string, number> = {};
    let mismatches = 0, checked = 0, activeN = 0;
    const examples: string[] = [];
    for (const c of cells) {
      const recv = cellReceiver(c);
      const local = { ...set, records: prefilterAviation(set.records as AviationRecord[], recv) } as SoundSourceSet;
      for (const b of times) {
        const r = queryFamilyInterval("aviation", [local], recv, b, b + 600 - 1e-6);
        const want = lut[familyResultCode(r)]!;
        const got = potentialPackFrame(pack, b)![c]!;
        checked++;
        if (want > 0 && want !== U) activeN++;
        const k = want === 0 ? "0" : want === U ? "255" : "active";
        hist[k] = (hist[k] ?? 0) + 1;
        if (got !== want) { mismatches++; if (examples.length < 5) examples.push(`c=${c} t=${b} got=${got} want=${want}`); }
      }
    }
    console.info(`[aviationGrid real ${date}] cells=${cells.length} checked=${checked} mismatches=${mismatches} active=${activeN} hist=${JSON.stringify(hist)}`);
    expect(cells.length).toBeGreaterThanOrEqual(200);
    expect(mismatches, examples.join("; ")).toBe(0);
    expect(activeN).toBeGreaterThanOrEqual(50);
  }, 120_000);
});

describe("鐵道網格（真實班表範本，2026-11-09）", () => {
  const have = existsSync("public/rail/trtc/station_progress.json");
  it.skipIf(!have)("網格碼＝queryReceiver 碼：≥200 格 × 4 個 10 分區間；冷算在 Worker、同格不重算（工作量計數）", async () => {
    const date = "2026-11-09";
    const set = (await loadRail({ date }, localRailFetchers(path.resolve("public/rail")))) as SoundSourceSet;
    const cells = [...new Set([...sampleCells(200, 5), ...cellsAround(121.517, 25.046, 5), ...cellsAround(121.463, 25.012, 4)])];
    const times = [7.6, 12.3, 17.9, 23.1].map((h) => binOf(at(date, h)));
    let mismatches = 0, checked = 0, activeN = 0;
    const examples: string[] = [];
    const buf = new Uint8Array(GRID_CELLS);
    for (const b of times) {
      const frame = railGridFrame(set, b, b + 600 - 1e-6, buf);
      for (const c of cells) {
        const want = familyResultCode(queryFamilyInterval("rail", [set], cellReceiver(c), b, b + 600 - 1e-6));
        checked++;
        if (want > 0 && want !== U) activeN++;
        if (frame.values[c] !== want) { mismatches++; if (examples.length < 5) examples.push(`c=${c} t=${b} got=${frame.values[c]} want=${want}`); }
      }
    }
    console.info(`[railGrid real] cells=${cells.length} checked=${checked} mismatches=${mismatches} active=${activeN}`);
    expect(mismatches, examples.join("; ")).toBe(0);
    expect(activeN).toBeGreaterThanOrEqual(50);
    // W6-4：冷算一幀 70–280 ms（受機器負載影響，不看牆鐘）改在 Worker 算；這裡驗工作量：
    // 同一格第二次是查表、主執行緒的 hook 不呼叫 railGridFrame（gridWorker.test.ts）。
    const core = new SoundGridCore();
    core.setFamily("rail", 1, "live", { kind: "plain", set });
    for (const b of [...times, ...times]) expect(core.frame("rail", b).values).toEqual(railGridFrame(set, b, b + 600 - 1e-6).values);
    expect(core.computeCount.rail).toBe(times.length);
  }, 120_000);
});

const NATURAL: { family: NaturalFamily; anchors: [number, number][] }[] = [
  { family: "wind_vegetation", anchors: [[121.54, 25.03], [121.6, 25.15]] },
  { family: "coastal_wave", anchors: [[121.64, 25.22], [121.93, 25.01]] },
  { family: "river_water", anchors: [[121.5, 25.0], [121.47, 25.06]] },
];

describe.each(DATES)("自然三族網格（真實 %s）", (date) => {
  const have = existsSync(`${GRID_DIR}/natural-${date}.json`) && existsSync(`${GRID_DIR}/canopy-cells-v1.bin`);
  it.skipIf(!have).each(NATURAL)("$family：網格碼＝queryReceiver 碼，≥200 格 × 4 區間；換幀 < 50 ms", async ({ family, anchors }) => {
    const set = (await loadNaturalGridSource(family, date, localFetch))!;
    expect(set).not.toBeNull();
    const field = buildNaturalField(family, set);
    const cells = [...new Set([...sampleCells(200, 9), ...anchors.flatMap(([lo, la]) => cellsAround(lo, la, 4))])];
    const times = [3.1, 9.7, 14.05, 20.4].map((h) => binOf(at(date, h)));
    let mismatches = 0, checked = 0, activeN = 0, unknownN = 0;
    const examples: string[] = [];
    const frameMs: number[] = [];
    const buf = new Uint8Array(GRID_CELLS);
    for (const b of times) {
      const s = performance.now();
      const frame = naturalGridFrame(field, b, b + 600 - 1e-6, buf);
      frameMs.push(performance.now() - s);
      for (const c of cells) {
        const want = familyResultCode(queryFamilyInterval(family, [set], cellReceiver(c), b, b + 600 - 1e-6));
        checked++;
        if (want === U) unknownN++; else if (want > 0) activeN++;
        if (frame.values[c] !== want) { mismatches++; if (examples.length < 5) examples.push(`c=${c} t=${b} got=${frame.values[c]} want=${want}`); }
      }
    }
    console.info(`[naturalGrid real ${date} ${family}] cells=${cells.length} checked=${checked} mismatches=${mismatches} active=${activeN} unknown=${unknownN} fieldMs=${field.buildMs.toFixed(0)} frameMs=${frameMs.map((x) => x.toFixed(1)).join(",")}`);
    expect(mismatches, examples.join("; ")).toBe(0);
    expect(activeN).toBeGreaterThanOrEqual(50);
    expect(Math.max(...frameMs)).toBeLessThan(50);
  }, 120_000);
});


// 雨（W6-1 網格）改讀全北北雨量站來源檔：場景快照只有接收點附近的站，遠處的格以前只靠雷達
const RAIN_REAL = [
  { date: "2026-11-09", hours: [7.67, 9.2, 14.05, 20.05] } /* 09:10、20:00 缺雷達幀 */,
  { date: "2026-10-24", hours: [3.1, 10.05, 14.05, 22.9] } /* 10:00 缺雷達幀 */,
];
describe.each(RAIN_REAL)("雨網格全範圍雨量站（真實 $date）", ({ date, hours }) => {
  const have = existsSync(`${GRID_DIR}/rain-gauge-${date}.json`) && existsSync(`${GRID_DIR}/radar-rain-${date}.class.bin`);
  it.skipIf(!have)("網格分級＝queryReceiver 分級：≥200 格 × 4 時刻（含缺雷達幀時刻）", async () => {
    const gauge = (await loadRainGridSource(date, localFetch))!;
    expect(gauge).not.toBeNull();
    const meta = JSON.parse(readFileSync(`${GRID_DIR}/radar-rain-${date}.meta.json`, "utf8"));
    const pack = await decodeRadarRainPack(meta, new Uint8Array(readFileSync(`${GRID_DIR}/radar-rain-${date}.class.bin`)), date);
    const set = await withRadarRain(gauge, date, async () => pack);
    const field = buildRainGaugeField(set.records as never);
    const stations = new Set((set.records as { payload: { stationId?: string } }[]).map((r) => r.payload.stationId).filter(Boolean));
    // 亂數格＋遠離小油坑／碧湖（舊快照範圍外）的格
    const cells = [...new Set([...sampleCells(220, 13), ...cellsAround(121.75, 24.9, 3), ...cellsAround(121.4, 24.85, 3)])];
    let mismatches = 0, checked = 0, gaugeOnly = 0;
    const hist: Record<string, number> = {};
    for (const h of hours) {
      const t = at(date, h);
      const b = binOf(t);
      const frame = rainGridFrame(set, field, b, b + 600 - 1e-6).values;
      for (const c of cells) {
        const r = queryFamilyInterval("rain", [set], cellReceiver(c), t, t);
        const want = r.status === "inactive" ? 0 : r.status !== "active" ? U : r.contributions[0]!.rainEstimate!.rainClass;
        if (r.status === "active" && r.contributions[0]!.rainEstimate!.source === "gauge") gaugeOnly++;
        checked++;
        hist[String(want)] = (hist[String(want)] ?? 0) + 1;
        if (frame[c] !== want) mismatches++;
      }
    }
    console.info(`[rainGrid full-area ${date}] stations=${stations.size} cells=${cells.length} checked=${checked} mismatches=${mismatches} gaugeSource=${gaugeOnly} hist=${JSON.stringify(hist)}`);
    expect(stations.size).toBeGreaterThan(200);
    expect(cells.length).toBeGreaterThanOrEqual(200);
    expect(mismatches).toBe(0);
  }, 120_000);
});

describe("全範圍來源缺 → null（呼叫端照舊）", () => {
  it("沒有檔、HTML、schema 不符都回 null", async () => {
    const html = (async () => new Response("<!doctype html>")) as unknown as typeof fetch;
    expect(await loadAviationGridSource("1999-01-01", 0, localFetch)).toBeNull();
    expect(await loadAviationGridSource("1999-01-01", 0, html)).toBeNull();
    expect(await loadNaturalGridSource("coastal_wave", "1999-01-02", html)).toBeNull();
  });
  it("cellReceiver 在格心", () => {
    const c = cellIndexOf(121.5, 25.05);
    const r = cellReceiver(c);
    expect([r.longitude, r.latitude]).toEqual(cellCenter(c));
  });
});
