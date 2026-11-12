/**
 * W6-1 雨網格：分級、取高者真值表、雷達每日包解碼、255 傳遞、網格值＝queryReceiver(格心, t)。
 * 真實資料抽樣（11-09、10-24）需要本機 public/sound-atlas/{scenes,grid}/（gitignore；CI 沒有 → skip）。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { RainGaugeDayRow } from "../../data/rainGaugeLoader";
import { queryFamilyInterval } from "../engines/receiverQuery";
import { cellCenter, cellIndexOf, countyOf, GRID_CELLS, GRID_SPEC, GRID_UNKNOWN, inScopeCells } from "../grid/gridSpec";
import { combineRainClass, foldRainClasses, rainClassOfMmPerHour, RAIN_CLASS_SPEC } from "../grid/rainClass";
import { decodeRadarRainPack, radarClassAt, RADAR_RAIN_PROVIDER, RADAR_RAIN_SCHEMA, type RadarRainPack } from "../grid/radarRainPack";
import { buildRainGaugeField, rainGridFrame } from "../grid/rainGrid";
import { rainRowsToRecords } from "../sourceAdapters/rainFieldAdapter";
import { parseSceneSnapshot } from "../scenes";
import { snapshotSet, withRadarRain } from "../soundAtlasData";
import type { Receiver, SoundSourceSet } from "../types";

const U = GRID_UNKNOWN;

describe("rainClass", () => {
  it("門檻左閉右開；null／負值／NaN → 255（不當 0）", () => {
    expect([0, 0.49, 0.5, 2.49, 2.5, 9.99, 10, 39.9, 40, 300].map(rainClassOfMmPerHour)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(rainClassOfMmPerHour(null)).toBe(U);
    expect(rainClassOfMmPerHour(-1)).toBe(U);
    expect(rainClassOfMmPerHour(Number.NaN)).toBe(U);
  });

  it("取高者真值表：已知勝過無法判斷，兩邊都無法判斷才是 255", () => {
    expect(combineRainClass(3, 1)).toEqual({ rainClass: 3, source: "radar" });
    expect(combineRainClass(1, 3)).toEqual({ rainClass: 3, source: "gauge" });
    expect(combineRainClass(2, 2)).toEqual({ rainClass: 2, source: "both" });
    expect(combineRainClass(0, 0)).toEqual({ rainClass: 0, source: "both" });
    expect(combineRainClass(U, 2)).toEqual({ rainClass: 2, source: "gauge" });
    expect(combineRainClass(null, 0)).toEqual({ rainClass: 0, source: "gauge" });
    expect(combineRainClass(4, U)).toEqual({ rainClass: 4, source: "radar" });
    expect(combineRainClass(0, null)).toEqual({ rainClass: 0, source: "radar" });
    expect(combineRainClass(U, U)).toEqual({ rainClass: U, source: null });
    expect(combineRainClass(null, null)).toEqual({ rainClass: U, source: null });
    expect(combineRainClass(U, null)).toEqual({ rainClass: U, source: null });
  });

  it("區間合併：有雨取最大；只有乾與無法判斷 → 255；空 → null", () => {
    expect(foldRainClasses([0, 2, U, 1])).toBe(2);
    expect(foldRainClasses([0, U])).toBe(U);
    expect(foldRainClasses([0, 0])).toBe(0);
    expect(foldRainClasses([])).toBeNull();
  });
});

// ── 合成雷達包 ─────────────────────────────────────────
const DATE = "2026-07-14";
const DAY0 = Date.parse(`${DATE}T00:00:00+08:00`) / 1000;

function metaFor(count: number, over: Record<string, unknown> = {}) {
  return {
    schema: RADAR_RAIN_SCHEMA,
    date_taiwan: DATE,
    grid: { id: GRID_SPEC.id, west: GRID_SPEC.west, north: GRID_SPEC.north, dLon: GRID_SPEC.dLon, dLat: GRID_SPEC.dLat, cols: GRID_SPEC.cols, rows: GRID_SPEC.rows },
    payload: { file: "x", encoding: "gzip", bytes: 0, raw_bytes: count * GRID_CELLS },
    frames: { count, step_s: 600, first_slot_utc: new Date(DAY0 * 1000).toISOString() },
    frames_missing: [],
    classes: { version: RAIN_CLASS_SPEC.version, edges_mm_h: [...RAIN_CLASS_SPEC.edgesMmPerHour], unknown: 255 },
    ...over,
  };
}

async function packOf(frames: Uint8Array[]): Promise<RadarRainPack> {
  const raw = new Uint8Array(frames.length * GRID_CELLS);
  frames.forEach((f, k) => raw.set(f, k * GRID_CELLS));
  const p = await decodeRadarRainPack(metaFor(frames.length), new Uint8Array(gzipSync(raw)), DATE);
  if (!p) throw new Error("decode failed");
  return p;
}

describe("radarRainPack", () => {
  it("gzip 與未壓縮都能解；schema／網格／門檻不符或長度不對 → null", async () => {
    const raw = new Uint8Array(2 * GRID_CELLS).fill(1);
    expect(await decodeRadarRainPack(metaFor(2), new Uint8Array(gzipSync(raw)), DATE)).not.toBeNull();
    expect(await decodeRadarRainPack(metaFor(2), raw, DATE)).not.toBeNull();
    expect(await decodeRadarRainPack(metaFor(2, { schema: "v0" }), raw, DATE)).toBeNull();
    expect(await decodeRadarRainPack(metaFor(2), raw, "2026-07-15")).toBeNull();
    expect(await decodeRadarRainPack(metaFor(2, { grid: { ...metaFor(2).grid, cols: 100 } }), raw, DATE)).toBeNull();
    expect(await decodeRadarRainPack(metaFor(2, { classes: { version: RAIN_CLASS_SPEC.version, edges_mm_h: [1, 2, 3, 4], unknown: 255 } }), raw, DATE)).toBeNull();
    expect(await decodeRadarRainPack(metaFor(3), raw, DATE)).toBeNull();
    expect(await decodeRadarRainPack(metaFor(2), new TextEncoder().encode("<!doctype html>"), DATE)).toBeNull();
    const bad = raw.slice(); bad[5] = 7;
    expect(await decodeRadarRainPack(metaFor(2), bad, DATE)).toBeNull();
  });

  it("幀＝[起點, +600 s)；區間取最大、255 傳遞、範圍外 null", async () => {
    const c = 1234;
    const f = [0, 2, U, 0].map((v) => { const a = new Uint8Array(GRID_CELLS); a[c] = v; return a; });
    const p = await packOf(f);
    expect(radarClassAt(p, c, DAY0 + 599, DAY0 + 599)).toEqual({ rainClass: 0, slotStart: DAY0 });
    expect(radarClassAt(p, c, DAY0 + 600, DAY0 + 600)!.rainClass).toBe(2);
    expect(radarClassAt(p, c, DAY0 + 1200, DAY0 + 1200)!.rainClass).toBe(U);
    expect(radarClassAt(p, c, DAY0, DAY0 + 1799)).toEqual({ rainClass: 2, slotStart: DAY0 + 600 });
    expect(radarClassAt(p, c, DAY0 + 1200, DAY0 + 2399)!.rainClass).toBe(U); // 255＋0 → 255
    expect(radarClassAt(p, c, DAY0 + 2400, DAY0 + 2400)).toBeNull();
    expect(radarClassAt(p, c, DAY0 - 1, DAY0 - 1)).toBeNull();
  });
});

// ── 網格＝queryReceiver ───────────────────────────────
const recv = (c: number): Receiver => { const [lon, lat] = cellCenter(c); return { id: `cell-${c}`, longitude: lon, latitude: lat, environment: "outdoor" }; };

/** queryReceiver 的雨 → 分級碼（inactive＝0、unknown／unavailable＝255、active＝contribution 的 rainClass） */
function queryClass(sets: SoundSourceSet[], c: number, t: number): number {
  const r = queryFamilyInterval("rain", sets, recv(c), t, t);
  if (r.status === "inactive") return 0;
  if (r.status !== "active") return U;
  return r.contributions[0]!.rainEstimate!.rainClass;
}

function sampleCells(n: number, seed = 7): number[] {
  const all = inScopeCells();
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2 ** 31; out.push(all[s % all.length]!); }
  return out;
}

function compare(sets: SoundSourceSet[], cells: number[], times: number[]) {
  const set = sets[0]!;
  const field = buildRainGaugeField(set.records as never);
  const hist: Record<string, number> = {};
  let mismatches = 0;
  let checked = 0;
  for (const t of times) {
    const bin = Math.floor(t / 600) * 600;
    const frame = rainGridFrame(set, field, bin, bin + 600 - 1e-6).values;
    for (const c of cells) {
      const q = queryClass(sets, c, t);
      checked++;
      hist[String(q)] = (hist[String(q)] ?? 0) + 1;
      if (frame[c] !== q) mismatches++;
    }
  }
  return { mismatches, checked, hist };
}

function row(stationId: string, lon: number, lat: number, h: number, mm: number | null): RainGaugeDayRow {
  return {
    station_id: stationId, station_name: stationId, county: null, town: null, lat, lng: lon,
    bucket_at: new Date((DAY0 + h * 3600) * 1000).toISOString(), observed_at: new Date((DAY0 + h * 3600 + 3000) * 1000).toISOString(),
    precipitation_10min: null, precipitation_1hr: mm, precipitation_3hr: null, precipitation_24hr: null,
  };
}

describe("rainGrid（合成資料）", () => {
  it("網格值＝queryReceiver(格心, t)：300 格 × 4 時刻；有雷達、雨量站、缺幀、雜波 255", async () => {
    const cells = sampleCells(300);
    // 雨量站：三站，一站 10 時 null、一站 10 時缺列
    const st = [[121.52, 25.05], [121.6, 25.1], [121.45, 24.95]] as const;
    const rows: RainGaugeDayRow[] = [];
    for (let h = 0; h < 24; h++) {
      rows.push(row("A", st[0][0], st[0][1], h, h === 10 ? null : h % 4));
      if (h !== 10) rows.push(row("B", st[1][0], st[1][1], h, h * 2));
      rows.push(row("C", st[2][0], st[2][1], h, 0.2));
    }
    // 雷達：第 60 幀（10:00）整幀缺；其他幀依格號變化，部分格 255（雜波）
    const frames: Uint8Array[] = [];
    for (let k = 0; k < 144; k++) {
      const f = new Uint8Array(GRID_CELLS);
      if (k === 60) f.fill(U);
      else for (let c = 0; c < GRID_CELLS; c++) f[c] = (c * 7 + k) % 23 === 0 ? U : ((c + k) % 11 < 5 ? (c + k) % 5 : 0);
      frames.push(f);
    }
    const pack = await packOf(frames);
    const base: SoundSourceSet = {
      family: "rain", dateKey: DATE, records: rainRowsToRecords(rows),
      coverage: [{ family: "rain", provider: "cwa_rain_gauge", dateKey: DATE, status: "ok", windowStart: DAY0, windowEnd: DAY0 + 86_400, temporalKind: "day_series" }],
    };
    const set = await withRadarRain(base, DATE, async () => pack);
    expect(set.coverage.map((c) => c.provider)).toEqual(["cwa_rain_gauge", RADAR_RAIN_PROVIDER]);
    const times = [DAY0 + 3 * 3600 + 120, DAY0 + 10 * 3600 + 30, DAY0 + 10 * 3600 + 700, DAY0 + 17 * 3600 + 599];
    const r = compare([set], cells, times);
    expect(r.checked).toBe(1200);
    expect(r.mismatches).toBe(0);
    expect(r.hist[String(U)]).toBeGreaterThan(0);
    expect(Object.keys(r.hist).length).toBeGreaterThanOrEqual(4);
  });

  it("沒有雷達包（即時／其他日期）→ 只用雨量站，來源標 gauge；coverage 記 no_radar_pack_for_date", async () => {
    const lon = 121.52, lat = 25.05;
    const base: SoundSourceSet = {
      family: "rain", dateKey: DATE, records: rainRowsToRecords([row("A", lon, lat, 5, 12)]),
      coverage: [{ family: "rain", provider: "cwa_rain_gauge", dateKey: DATE, status: "ok", windowStart: DAY0, windowEnd: DAY0 + 86_400, temporalKind: "day_series" }],
    };
    const set = await withRadarRain(base, DATE, async () => null);
    expect(set.coverage[1]).toMatchObject({ provider: RADAR_RAIN_PROVIDER, status: "unavailable", reason: "no_radar_pack_for_date" });
    const c = cellIndexOf(lon, lat);
    const r = queryFamilyInterval("rain", [set], recv(c), DAY0 + 5.5 * 3600, DAY0 + 5.5 * 3600);
    expect(r.status).toBe("active");
    expect(r.contributions[0]!.rainEstimate).toMatchObject({ rainClass: 3, source: "gauge", radarClass: null });
    const frame = rainGridFrame(set, buildRainGaugeField(set.records as never), DAY0 + 5.5 * 3600, DAY0 + 5.5 * 3600).values;
    expect(frame[c]).toBe(3);
    // 遠離雨量站、又沒有雷達 → 255（不是無雨）
    const far = cellIndexOf(121.9, 24.8);
    expect(frame[far]).toBe(U);
  });

  it("雷達比雨量站高 → 取雷達、來源 radar；雨量站高 → 取雨量站", async () => {
    const lon = 121.52, lat = 25.05;
    const c = cellIndexOf(lon, lat);
    const f = new Uint8Array(GRID_CELLS); f[c] = 4;
    const frames = Array.from({ length: 144 }, (_, k) => (k === 30 ? f : new Uint8Array(GRID_CELLS)));
    const pack = await packOf(frames);
    const base: SoundSourceSet = {
      family: "rain", dateKey: DATE, records: rainRowsToRecords([row("A", lon, lat, 5, 1), row("A", lon, lat, 6, 1)]),
      coverage: [{ family: "rain", provider: "cwa_rain_gauge", dateKey: DATE, status: "ok", windowStart: DAY0, windowEnd: DAY0 + 86_400, temporalKind: "day_series" }],
    };
    const set = await withRadarRain(base, DATE, async () => pack);
    const at = (t: number) => queryFamilyInterval("rain", [set], recv(c), t, t).contributions[0]!;
    const radarWin = at(DAY0 + 30 * 600 + 10);
    expect(radarWin.rainEstimate).toMatchObject({ rainClass: 4, source: "radar", gaugeClass: 1, radarSlotStart: DAY0 + 30 * 600 });
    expect(radarWin.temporalPrecision).toBe("radar_10min");
    const gaugeWin = at(DAY0 + 31 * 600 + 10);
    expect(gaugeWin.rainEstimate).toMatchObject({ rainClass: 1, source: "gauge", radarClass: 0 });
    expect(gaugeWin.temporalPrecision).toBe("hourly");
  });
});

// ── 真實資料抽樣（本機資產存在才跑）────────────────────────
const REAL = [
  { date: "2026-11-09", scene: "taipei-1109", hours: [7.67, 1.2, 9.2, 20.05] } /* 09:10、20:00 是缺幀 */,
  { date: "2026-10-24", scene: "taipei-typhoon-1024", hours: [14.05, 0.2, 10.05, 22.9] } /* 00:10 有雜波格、10:00 缺幀 */,
];
const assets = (d: (typeof REAL)[number]) => ({
  scene: `public/sound-atlas/scenes/${d.scene}.json`,
  meta: `public/sound-atlas/grid/radar-rain-${d.date}.meta.json`,
  bin: `public/sound-atlas/grid/radar-rain-${d.date}.class.bin`,
});

describe.each(REAL)("rainGrid（真實資料 $date）", (d) => {
  const a = assets(d);
  const have = existsSync(a.scene) && existsSync(a.meta) && existsSync(a.bin);
  it.skipIf(!have)("網格值＝queryReceiver(格心, t)：≥200 格 × 4 時刻", async () => {
    const snapshot = parseSceneSnapshot(JSON.parse(readFileSync(a.scene, "utf8")))!;
    const pack = await decodeRadarRainPack(JSON.parse(readFileSync(a.meta, "utf8")), new Uint8Array(readFileSync(a.bin)), d.date);
    expect(pack).not.toBeNull();
    const gauge = (await snapshotSet(snapshot, "rain", Date.now() / 1000))!;
    const set = await withRadarRain(gauge, d.date, async () => pack);
    const day0 = Date.parse(`${d.date}T00:00:00+08:00`) / 1000;
    // 抽樣：亂數 240 格 ＋ 每個雨量站所在格（雨量站與雷達同時起作用的格）
    const cells = sampleCells(240, 11);
    // （只取縣市遮罩內的格：網格只算北北範圍內，範圍外由渲染器隱藏）
    for (const r of snapshot.rain!.rows) { const c = cellIndexOf(r.lng, r.lat); if (countyOf(c) > 0 && !cells.includes(c)) cells.push(c); }
    const times = d.hours.map((h) => day0 + Math.round(h * 3600));
    const r = compare([set], cells, times);
    console.info(`[rainGrid real ${d.date}] cells=${cells.length} checked=${r.checked} mismatches=${r.mismatches} classHist=${JSON.stringify(r.hist)}`);
    expect(cells.length).toBeGreaterThanOrEqual(200);
    expect(r.mismatches).toBe(0);
    expect(r.hist[String(U)], "缺幀時刻要有無法判斷格（遠離雨量站處）").toBeGreaterThan(0);
  });
});
