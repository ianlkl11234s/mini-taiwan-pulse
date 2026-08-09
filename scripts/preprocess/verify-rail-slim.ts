/**
 * 驗證 rail_slim.<hash>.json.gz 的列車位置與原始幾何一致
 *
 * 做法：用「原始幾何」與「瘦身幾何」各建一套引擎輸入（時刻表共用同一份物件），
 * 在一天中多個時間點各跑一次 TraTrainEngine / RailEngine，逐車比對 Haversine 偏差。
 *
 * 兩側的班次篩選條件（elapsed 範圍、findCurrentSegment）只跟時間有關、與幾何無關，
 * 且 tracks / stationProgress 的 key 集合兩側一致 → 輸出陣列 index 對齊，可直接逐項比。
 *
 * 驗收線：p95 < 30m、max < 100m（超線 exit 1）
 *
 * 用法：
 *   npx tsx scripts/preprocess/verify-rail-slim.ts
 *   npx tsx scripts/preprocess/verify-rail-slim.ts --p95 20 --max 60
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TraTrainEngine } from "../../src/engines/TraTrainEngine";
import { RailEngine } from "../../src/engines/RailEngine";
import type {
  RailSystem,
  RailSchedule,
  RailTrain,
  TraData,
  TraDeparture,
  TraSchedule,
  RailStationTime,
} from "../../src/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAIL_DIR = path.join(ROOT, "public", "rail");
const EMBED_RAIL_DIR = path.join(ROOT, "public", "embed-rail");
const MANIFEST = path.join(EMBED_RAIL_DIR, "rail-manifest.json");

/**
 * bundle 檔名帶內容雜湊 → 沒有固定路徑可寫死，一律先讀指標檔（前端也是這個順序）。
 * `--bundle <path>` 仍可 override（比較兩組參數產出的 bundle 時好用）。
 */
function resolveDefaultBundle(): string | null {
  if (!existsSync(MANIFEST)) return null;
  try {
    const name = (JSON.parse(readFileSync(MANIFEST, "utf-8")) as { bundle?: unknown }).bundle;
    if (typeof name !== "string") return null;
    return path.join(EMBED_RAIL_DIR, name);
  } catch {
    return null;
  }
}

/** 非 TRA 的 5 系統（比照 railLoader.RAIL_SYSTEMS） */
const RAIL_SYSTEMS = [
  { id: "trtc", schedulesKey: null },
  { id: "thsr", schedulesKey: "thsr_schedules" },
  { id: "krtc", schedulesKey: "krtc_schedules" },
  { id: "klrt", schedulesKey: "klrt_schedules" },
  { id: "tmrt", schedulesKey: "tmrt_schedules" },
] as const;

/** 取樣時刻（台灣時間 UTC+8，全部落在 05:50 延長日分界之後） */
const SAMPLE_TIMES = ["06:30", "07:30", "08:15", "11:00", "14:30", "17:45", "18:30", "22:30"];
const SAMPLE_DATE_UTC: [number, number, number] = [2026, 7, 8]; // 2026-08-08，month 0-based

// ── 工具 ──────────────────────────────────────────────────────────────────

function readJSON(file: string): any {
  return JSON.parse(readFileSync(file, "utf-8"));
}

function extractFeature(data: any): GeoJSON.Feature | null {
  if (!data) return null;
  if (data.type === "FeatureCollection" && data.features?.[0]) return data.features[0];
  if (data.type === "Feature") return data;
  return null;
}

/** Haversine 距離（公尺） */
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function makeFeature(coordinates: number[][], properties: Record<string, unknown>): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { ...properties },
    geometry: { type: "LineString", coordinates },
  } as GeoJSON.Feature;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

// ── 時刻表載入（純本地檔，不連 Supabase）─────────────────────────────────

function loadSchedules(systemId: string, schedulesKey: string | null): Map<string, RailSchedule> {
  const map = new Map<string, RailSchedule>();

  if (systemId === "trtc") {
    const dir = path.join(RAIL_DIR, "trtc", "schedules");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      map.set(f.replace(/\.json$/, ""), readJSON(path.join(dir, f)) as RailSchedule);
    }
    return map;
  }

  if (systemId === "thsr") {
    const daily = path.join(RAIL_DIR, "thsr", "schedules", "daily", "2026-02-18.json");
    const fallback = path.join(RAIL_DIR, "thsr", "schedules", "thsr_schedules.json");
    const file = existsSync(daily) ? daily : fallback;
    for (const [k, v] of Object.entries(readJSON(file))) map.set(k, v as RailSchedule);
    return map;
  }

  const top = path.join(RAIL_DIR, systemId, `${schedulesKey}.json`);
  const nested = path.join(RAIL_DIR, systemId, "schedules", `${schedulesKey}.json`);
  const file = existsSync(top) ? top : nested;
  for (const [k, v] of Object.entries(readJSON(file))) map.set(k, v as RailSchedule);
  return map;
}

/** 比照 railLoader.parseTraSchedules */
function parseTraSchedules(masterData: any): Map<string, TraSchedule> {
  const byTrack = new Map<string, TraDeparture[]>();
  for (const train of masterData.schedules) {
    const trackId = train.od_track_id;
    if (!trackId) continue;
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId)!.push({
      departure_time: train.departure_time,
      train_id: train.train_id,
      train_no: train.train_no,
      train_type: train.train_type,
      train_type_code: train.train_type_code,
      total_travel_time: train.total_travel_time,
      origin_station: train.origin_station || "",
      destination_station: train.destination_station || "",
      od_track_id: trackId,
      stations: train.stations as RailStationTime[],
    });
  }
  const map = new Map<string, TraSchedule>();
  for (const [trackId, departures] of byTrack) map.set(trackId, { departures });
  return map;
}

// ── 建兩套引擎輸入 ───────────────────────────────────────────────────────

interface SideInputs {
  tra: TraData;
  systems: RailSystem[];
}

function buildOriginalSide(
  traSchedules: Map<string, TraSchedule>,
  scheduleMaps: Map<string, Map<string, RailSchedule>>,
): SideInputs {
  const odTracks = new Map<string, GeoJSON.Feature>();
  const traTracksDir = path.join(RAIL_DIR, "tra", "tracks");
  for (const f of readdirSync(traTracksDir).filter((n) => n.endsWith(".geojson")).sort()) {
    const feat = extractFeature(readJSON(path.join(traTracksDir, f)));
    if (feat) odTracks.set(f.replace(/\.geojson$/, ""), feat);
  }

  const tra: TraData = {
    schedules: traSchedules,
    odTracks,
    stationProgress: readJSON(path.join(RAIL_DIR, "tra", "station_progress.json")),
    goldenTracks: [],
  };

  const systems: RailSystem[] = [];
  for (const sys of RAIL_SYSTEMS) {
    const tracks = new Map<string, GeoJSON.Feature>();
    const dir = path.join(RAIL_DIR, sys.id, "tracks");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".geojson")).sort()) {
      const feat = extractFeature(readJSON(path.join(dir, f)));
      if (feat) tracks.set(f.replace(/\.geojson$/, ""), feat);
    }
    systems.push({
      id: sys.id,
      tracks,
      schedules: scheduleMaps.get(sys.id)!,
      stationProgress: readJSON(path.join(RAIL_DIR, sys.id, "station_progress.json")),
    });
  }

  return { tra, systems };
}

function buildSlimSide(
  bundle: any,
  traSchedules: Map<string, TraSchedule>,
  scheduleMaps: Map<string, Map<string, RailSchedule>>,
): SideInputs {
  const toTrackMap = (obj: Record<string, any>): Map<string, GeoJSON.Feature> => {
    const m = new Map<string, GeoJSON.Feature>();
    for (const [id, entry] of Object.entries(obj)) {
      m.set(id, makeFeature(entry.coordinates, entry.properties ?? {}));
    }
    return m;
  };

  const traSys = bundle.systems.tra;
  const tra: TraData = {
    schedules: traSchedules,
    odTracks: toTrackMap(traSys.tracks),
    stationProgress: traSys.stationProgress,
    goldenTracks: [],
  };

  const systems: RailSystem[] = RAIL_SYSTEMS.map((sys) => ({
    id: sys.id,
    tracks: toTrackMap(bundle.systems[sys.id].tracks),
    schedules: scheduleMaps.get(sys.id)!,
    stationProgress: bundle.systems[sys.id].stationProgress,
  }));

  return { tra, systems };
}

/** 比照 railLoader.postProcess：排除貓空纜車（兩側同樣處理，維持 index 對齊） */
function filterMaokong(systems: RailSystem[], scheduleMaps: Map<string, Map<string, RailSchedule>>): void {
  for (const sys of systems) {
    if (sys.id !== "trtc") continue;
    for (const key of [...sys.tracks.keys()]) if (key.startsWith("MK-")) sys.tracks.delete(key);
  }
  const trtc = scheduleMaps.get("trtc");
  if (trtc) for (const key of [...trtc.keys()]) if (key.startsWith("MK-")) trtc.delete(key);
}

// ── 主流程 ───────────────────────────────────────────────────────────────

interface Bucket {
  running: number[];
  stopped: number[];
}

function main(): number {
  const argv = process.argv.slice(2);
  const argNum = (flag: string, dflt: number): number => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
  };
  const P95_LIMIT = argNum("--p95", 30);
  const MAX_LIMIT = argNum("--max", 100);
  const TOP_N = argNum("--top", 10);
  const bundleIdx = argv.indexOf("--bundle");
  const BUNDLE =
    bundleIdx >= 0 && argv[bundleIdx + 1] ? path.resolve(argv[bundleIdx + 1]!) : resolveDefaultBundle();

  if (!BUNDLE || !existsSync(BUNDLE)) {
    console.error(
      `✗ 找不到 bundle（${BUNDLE ?? `讀不到指標檔 ${MANIFEST}`}）\n` +
        "  先跑 python3 scripts/preprocess/build-rail-slim-bundle.py",
    );
    return 1;
  }
  console.log(`bundle：${path.basename(BUNDLE)}`);

  console.log("載入時刻表…");
  const traSchedules = parseTraSchedules(readJSON(path.join(RAIL_DIR, "tra", "master_schedule.json")));
  const scheduleMaps = new Map<string, Map<string, RailSchedule>>();
  for (const sys of RAIL_SYSTEMS) scheduleMaps.set(sys.id, loadSchedules(sys.id, sys.schedulesKey));

  console.log("載入原始幾何…");
  const orig = buildOriginalSide(traSchedules, scheduleMaps);
  console.log("載入瘦身 bundle…");
  const bundle = JSON.parse(gunzipSync(readFileSync(BUNDLE)).toString("utf-8"));
  const slim = buildSlimSide(bundle, traSchedules, scheduleMaps);

  filterMaokong(orig.systems, scheduleMaps);
  filterMaokong(slim.systems, scheduleMaps);

  // key 集合必須一致，否則兩側輸出無法 index 對齊
  const keyMismatch: string[] = [];
  const cmpKeys = (label: string, a: Iterable<string>, b: Iterable<string>) => {
    const sa = new Set(a);
    const sb = new Set(b);
    const only = [...sa].filter((k) => !sb.has(k)).concat([...sb].filter((k) => !sa.has(k)));
    if (only.length) keyMismatch.push(`${label}: ${only.slice(0, 5).join(", ")} (共 ${only.length})`);
  };
  cmpKeys("tra.odTracks", orig.tra.odTracks.keys(), slim.tra.odTracks.keys());
  cmpKeys("tra.stationProgress", Object.keys(orig.tra.stationProgress), Object.keys(slim.tra.stationProgress));
  for (let i = 0; i < orig.systems.length; i++) {
    cmpKeys(`${orig.systems[i]!.id}.tracks`, orig.systems[i]!.tracks.keys(), slim.systems[i]!.tracks.keys());
    cmpKeys(
      `${orig.systems[i]!.id}.stationProgress`,
      Object.keys(orig.systems[i]!.stationProgress),
      Object.keys(slim.systems[i]!.stationProgress),
    );
  }
  if (keyMismatch.length) {
    console.error("✗ 兩側 key 集合不一致：");
    for (const m of keyMismatch) console.error(`  - ${m}`);
    return 1;
  }

  const traOrig = new TraTrainEngine(orig.tra);
  const traSlim = new TraTrainEngine(slim.tra);
  const railOrig = new RailEngine(orig.systems);
  const railSlim = new RailEngine(slim.systems);

  const bySystem = new Map<string, Bucket>();
  const all: number[] = [];
  let compared = 0;
  const worst: { d: number; sys: string; train: string; track: string; status: string; at: string }[] = [];

  const compare = (a: RailTrain[], b: RailTrain[], label: string): number[] => {
    if (a.length !== b.length) {
      throw new Error(`${label}: 兩側列車數不同 ${a.length} vs ${b.length}`);
    }
    const out: number[] = [];
    for (let i = 0; i < a.length; i++) {
      const x = a[i]!;
      const y = b[i]!;
      if (x.trainId !== y.trainId || x.systemId !== y.systemId) {
        throw new Error(`${label}: index ${i} 對不上（${x.systemId}/${x.trainId} vs ${y.systemId}/${y.trainId}）`);
      }
      const d = haversine(x.position, y.position);
      if (!Number.isFinite(d)) {
        throw new Error(`${label}: ${x.systemId}/${x.trainId} 距離非有限值（${x.position} / ${y.position}）`);
      }
      let bucket = bySystem.get(x.systemId);
      if (!bucket) {
        bucket = { running: [], stopped: [] };
        bySystem.set(x.systemId, bucket);
      }
      (x.status === "running" ? bucket.running : bucket.stopped).push(d);
      out.push(d);
      all.push(d);
      worst.push({ d, sys: x.systemId, train: x.trainId, track: x.trackId, status: x.status, at: label });
      compared++;
    }
    return out;
  };

  console.log(`\n取樣 ${SAMPLE_TIMES.length} 個時刻（${SAMPLE_DATE_UTC[0]}-${String(SAMPLE_DATE_UTC[1] + 1).padStart(2, "0")}-${String(SAMPLE_DATE_UTC[2]).padStart(2, "0")} 台灣時間）\n`);
  for (const t of SAMPLE_TIMES) {
    const [hh, mm] = t.split(":").map(Number);
    const ts = Date.UTC(SAMPLE_DATE_UTC[0], SAMPLE_DATE_UTC[1], SAMPLE_DATE_UTC[2], hh! - 8, mm!) / 1000;
    const d1 = compare(traOrig.update(ts), traSlim.update(ts), `TRA@${t}`);
    const d2 = compare(railOrig.update(ts), railSlim.update(ts), `RAIL@${t}`);
    const merged = [...d1, ...d2].sort((a, b) => a - b);
    console.log(
      `  ${t}  在線 ${String(merged.length).padStart(4)} 車   p95 ${percentile(merged, 95).toFixed(2)} m   max ${(merged.length ? merged[merged.length - 1]! : 0).toFixed(2)} m`,
    );
  }

  const fmt = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return {
      n: s.length,
      p50: percentile(s, 50),
      p95: percentile(s, 95),
      p99: percentile(s, 99),
      max: s.length ? s[s.length - 1]! : 0,
    };
  };

  console.log("\n各系統偏差（公尺）：");
  console.log("  系統    狀態      樣本數      p50      p95      p99      max");
  const sysOrder = ["tra", "thsr", "trtc", "krtc", "klrt", "tmrt"];
  for (const sid of sysOrder) {
    const b = bySystem.get(sid);
    if (!b) continue;
    const rows: [string, number[]][] = [
      ["running", b.running],
      ["stopped", b.stopped],
      ["全部", [...b.running, ...b.stopped]],
    ];
    for (const [name, arr] of rows) {
      if (!arr.length) continue;
      const s = fmt(arr);
      console.log(
        `  ${sid.padEnd(6)}${name.padEnd(10)}${String(s.n).padStart(8)}` +
          `${s.p50.toFixed(2).padStart(9)}${s.p95.toFixed(2).padStart(9)}` +
          `${s.p99.toFixed(2).padStart(9)}${s.max.toFixed(2).padStart(9)}`,
      );
    }
  }

  if (TOP_N > 0) {
    worst.sort((a, b) => b.d - a.d);
    console.log(`\n偏差最大的 ${TOP_N} 筆：`);
    for (const w of worst.slice(0, TOP_N)) {
      console.log(`  ${w.d.toFixed(1).padStart(7)} m  ${w.sys}/${w.train.padEnd(12)} track=${w.track.padEnd(14)} ${w.status.padEnd(8)} @${w.at}`);
    }
  }

  const overall = fmt(all);
  console.log(
    `\n總計 ${compared} 次比對：p50 ${overall.p50.toFixed(2)} m / p95 ${overall.p95.toFixed(2)} m / p99 ${overall.p99.toFixed(2)} m / max ${overall.max.toFixed(2)} m`,
  );

  const p95Ok = overall.p95 < P95_LIMIT;
  const maxOk = overall.max < MAX_LIMIT;
  console.log(`\n驗收線 p95 < ${P95_LIMIT} m：${p95Ok ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`驗收線 max < ${MAX_LIMIT} m：${maxOk ? "✓ PASS" : "✗ FAIL"}`);

  if (!p95Ok || !maxOk) {
    const worst = [...bySystem.entries()]
      .map(([sid, b]) => [sid, fmt([...b.running, ...b.stopped])] as const)
      .sort((a, b) => b[1].max - a[1].max);
    console.error(`\n最差系統：${worst[0]![0]}（max ${worst[0]![1].max.toFixed(2)} m）`);
    return 1;
  }
  return 0;
}

process.exit(main());
