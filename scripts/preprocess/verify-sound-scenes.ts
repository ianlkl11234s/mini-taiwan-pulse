/**
 * City Sound Atlas 場景快照驗算：讀 public/sound-atlas/scenes/<id>.json，餵既有 adapter，
 * 對接收點跑 dayProfile（10 分鐘格），印出各家族 active 格數、unknown ratio、最強時刻。
 *
 * 快照 → SoundSourceSet 的轉換規則（UI 接快照時照抄）：
 *   - coverage 一律取快照的 health（ok／empty／error），**不可**用 bbox 內筆數重判：
 *     bbox 內 0 筆落雷／0 架飛機但 health=ok ＝ 真的沒有（inactive），不是 unknown。
 *   - 垃圾車不在快照 → 這裡不載入（family 會是 unavailable/source_not_loaded）。
 *
 * MVP-B（W4）：
 *   - 施工：讀快照 `roadwork` 區塊（mvpBSources.roadworkSnapshotSet，coverage 取 health）；沒有區塊 → 不載入（unavailable）。
 *   - 鐵道：班表類即時算。node 沒有 Supabase 環境變數，改讀本機 public/rail 的**固定時刻表範本**（--rail-dir，
 *     預設本 repo public/rail；worktree 沒有大檔時指向主 checkout）。範本不是該日實際班表（basis=local_template），
 *     結果只代表「這套班表下」的可能列車，不可當場景日的實際列車。
 *   - 道路車流：只能即時讀 get_freeway_congestion_day，node 讀不到 → 不載入（unavailable／source_not_loaded）。
 *
 * W5：自然聲源三族讀快照 `natural` 區塊（advancedSources.naturalSnapshotSet）；沒有區塊 → 不載入（unavailable）。
 *
 * 不是 vitest 測試（CI 沒有 public 資料檔）。用法：
 *   npx vite-node scripts/preprocess/verify-sound-scenes.ts [--scene ID] [--receiver lon,lat] [--json OUT] [--rail-dir DIR]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flightRowsToFlights, type FlightTrailRow } from "../../src/data/flightTrails";
import type { LightningSource, LightningStrike } from "../../src/data/lightningLoader";
import type { RainGaugeDayRow } from "../../src/data/rainGaugeLoader";
import { flightsToAviationRecords } from "../../src/sound/sourceAdapters/aviationAdapter";
import { dedupeAndLinkStrikes } from "../../src/sound/sourceAdapters/thunderAdapter";
import { rainRowsToRecords } from "../../src/sound/sourceAdapters/rainFieldAdapter";
import { dayProfile, queryReceiver } from "../../src/sound/engines/receiverQuery";
import { taipeiMidnightMs } from "../../src/lib/taipeiDay";
import type { AnySoundFamily, Receiver, SoundSourceFamily, SoundSourceSet, SourceCoverage, SourceHealth } from "../../src/sound/types";
import { parseMvpBSceneBlocks, parseSystemSchedule, parseTraSchedule, roadworkSnapshotSet } from "../../src/sound/mvpBSources";
import { naturalSnapshotSet, parseNaturalBlock } from "../../src/sound/advancedSources";
import { SOUND_FAMILIES_ADVANCED } from "../../src/sound/engines/receiverQuery";
import { loadRail, RAIL_SYSTEMS, type RailFetchers, type RailTrackInput } from "../../src/sound/sourceAdapters/railAdapter";

type Health = "ok" | "empty" | "error";
interface SceneEvent extends LightningStrike {
  source: LightningSource;
}
interface Scene {
  schema: string;
  id: string;
  date: string;
  focus_time: string;
  receiver: { lon: number; lat: number; height_m: number; label_zh: string };
  aviation: { origin: string; health?: Health; rows: FlightTrailRow[] };
  thunder: { origin: string; health: Record<string, Health>; events: SceneEvent[] };
  rain: { origin: string; health?: Health; rows: RainGaugeDayRow[] };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "public/sound-atlas/scenes");
const FAMILIES: AnySoundFamily[] = ["aviation", "rain", "thunder", "rail", "road_traffic", "roadwork", "wind_vegetation", "coastal_wave", "river_water"];

// ── 鐵道：本機固定時刻表範本（node 端，不經 Supabase） ─────────────
function readJson(p: string): unknown {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
function localRailFetchers(railDir: string): RailFetchers {
  const lineOf = (p: string): [number, number][] | null => {
    const d = readJson(p) as { type?: string; features?: GeoJSON.Feature[] } | GeoJSON.Feature | null;
    const f = d && (d as { type?: string }).type === "FeatureCollection" ? (d as { features: GeoJSON.Feature[] }).features[0] : (d as GeoJSON.Feature | null);
    return f?.geometry?.type === "LineString" ? (f.geometry.coordinates as [number, number][]) : null;
  };
  return {
    async network() {
      const out: RailTrackInput[] = [];
      for (const sys of RAIL_SYSTEMS) {
        const progress = (readJson(path.join(railDir, sys, "station_progress.json")) ?? {}) as Record<string, Record<string, number>>;
        for (const [trackId, sp] of Object.entries(progress)) {
          if (sys === "trtc" && trackId.startsWith("MK-")) continue;
          const coords = lineOf(path.join(railDir, sys, "tracks", `${trackId}.geojson`));
          if (coords && coords.length >= 2) out.push({ system: sys, trackId, coords, stationProgress: sp });
        }
      }
      return out;
    },
    async schedule(system) {
      if (system === "tra") return { departures: parseTraSchedule(readJson(path.join(railDir, "tra", "master_schedule.json")) as { schedules?: unknown[] } | null), basis: "local_template" };
      if (system === "trtc") {
        const progress = (readJson(path.join(railDir, "trtc", "station_progress.json")) ?? {}) as Record<string, unknown>;
        const arr = Object.keys(progress).filter((k) => !k.startsWith("MK-")).map((k) => readJson(path.join(railDir, "trtc", "schedules", `${k}.json`))).filter(Boolean);
        return { departures: parseSystemSchedule(arr), basis: "local_template" };
      }
      const file = system === "thsr" ? path.join(railDir, "thsr", "schedules", "thsr_schedules.json") : path.join(railDir, system, `${system}_schedules.json`);
      return { departures: parseSystemSchedule(readJson(file)), basis: "local_template" };
    },
  };
}
let RAIL_DIR = path.join(ROOT, "public/rail");
const railCache = new Map<string, Promise<SoundSourceSet<unknown, "rail">>>();
function railSet(date: string) {
  let p = railCache.get(date);
  if (!p) railCache.set(date, (p = loadRail({ date }, localRailFetchers(RAIL_DIR)) as Promise<SoundSourceSet<unknown, "rail">>));
  return p;
}

function cov(family: SoundSourceFamily, provider: string, date: string, status: SourceHealth): SourceCoverage {
  const start = taipeiMidnightMs(date) / 1000;
  return { family, provider, dateKey: date, status, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" };
}

export async function sceneToSetsWithMvpB(s: Scene): Promise<SoundSourceSet<unknown, AnySoundFamily>[]> {
  const sets: SoundSourceSet<unknown, AnySoundFamily>[] = [...sceneToSets(s)];
  const rw = parseMvpBSceneBlocks(s).roadwork;
  if (rw) sets.push(roadworkSnapshotSet(rw, s.date) as SoundSourceSet<unknown, AnySoundFamily>);
  if (existsSync(RAIL_DIR)) sets.push(await railSet(s.date));
  // W5：natural 區塊（風、浪、河川）；沒有區塊 → 不載入（unavailable／source_not_loaded）
  const nat = parseNaturalBlock(s);
  if (nat) for (const f of SOUND_FAMILIES_ADVANCED) {
    const set = naturalSnapshotSet(nat, f, s.date);
    if (set) sets.push(set as SoundSourceSet<unknown, AnySoundFamily>);
  }
  return sets;
}

export function sceneToSets(s: Scene): SoundSourceSet[] {
  const avHealth = s.aviation.health ?? (s.aviation.rows.length ? "ok" : "empty");
  const rainHealth = s.rain.health ?? (s.rain.rows.length ? "ok" : "empty");
  const sources = Object.keys(s.thunder.health) as LightningSource[];
  const bySource = sources
    .filter((src) => s.thunder.health[src] !== "error")
    .map((src) => ({ source: src, strikes: s.thunder.events.filter((e) => e.source === src) }));
  return [
    {
      family: "aviation",
      dateKey: s.date,
      records: flightsToAviationRecords(flightRowsToFlights(s.aviation.rows).flights),
      coverage: [cov("aviation", "flight_trails", s.date, avHealth)],
    },
    {
      family: "rain",
      dateKey: s.date,
      records: rainRowsToRecords(s.rain.rows),
      coverage: [cov("rain", "cwa_rain_gauge", s.date, rainHealth)],
    },
    {
      family: "thunder",
      dateKey: s.date,
      records: dedupeAndLinkStrikes(bySource),
      coverage: sources.map((src) => cov("thunder", src, s.date, s.thunder.health[src]!)),
    },
  ] as SoundSourceSet[];
}

const hhmm = (t: number) =>
  new Date(t * 1000).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, hour: "2-digit", minute: "2-digit" });

async function summarize(s: Scene, receiver: Receiver) {
  const sets = await sceneToSetsWithMvpB(s);
  const prof = dayProfile(receiver, s.date, 10, sets, FAMILIES);
  const families = prof.families.map((f) => {
    const count = (st: string) => f.statuses.filter((x) => x === st).length;
    let best = -1;
    let bestIdx = -1;
    f.values.forEach((v, i) => {
      if (v != null && v > best) {
        best = v;
        bestIdx = i;
      }
    });
    return {
      family: f.family,
      active: count("active"),
      inactive: count("inactive"),
      unknown: count("unknown"),
      unavailable: count("unavailable"),
      unknownRatio: Number(f.unknownRatio.toFixed(3)),
      maxPotential: best > 0 ? Number(best.toFixed(3)) : best === 0 ? 0 : null,
      maxAt: best > 0 ? hhmm(prof.binStarts[bestIdx]!) : null,
      activeBins: f.statuses.flatMap((st, i) => (st === "active" ? [`${hhmm(prof.binStarts[i]!)}=${f.values[i]!.toFixed(2)}`] : [])),
    };
  });
  const focus = Date.parse(s.focus_time) / 1000;
  const q = queryReceiver(receiver, focus, sets, FAMILIES);
  const focusTop = q.contributions.slice(0, 3).map((c) => ({
    family: c.family,
    status: c.status,
    proxyKind: c.proxyKind ?? null,
    railStructure: c.railStructure ?? null,
    relativePotential: c.relativePotential == null ? null : Number(c.relativePotential.toFixed(3)),
    distanceM: c.spatialDistanceM == null ? null : Math.round(c.spatialDistanceM),
    delayS: c.thunderTiming?.delayS ?? null,
    unknownReason: c.unknownReason ?? null,
  }));
  const focusFamilies = Object.fromEntries(q.families.map((f) => [f.family, f.reason ? `${f.status}(${f.reason})` : f.status]));
  return { id: s.id, receiver: [receiver.longitude, receiver.latitude], families, focus: s.focus_time, focusFamilies, focusTop };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const only = arg("--scene");
  const recv = arg("--receiver");
  const out = arg("--json");
  if (arg("--rail-dir")) RAIL_DIR = path.resolve(arg("--rail-dir")!);
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || f === `${only}.json`)).sort();
  if (!files.length) throw new Error(`no scene files in ${DIR}`);
  const results = [];
  for (const f of files) {
    const s = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Scene;
    if (s.schema !== "pulse-sound-scene-v1") throw new Error(`${f}: bad schema ${s.schema}`);
    const [lon, lat] = recv ? recv.split(",").map(Number) : [s.receiver.lon, s.receiver.lat];
    results.push(await summarize(s, { id: s.id, longitude: lon!, latitude: lat!, heightM: s.receiver.height_m, environment: "outdoor" }));
  }
  for (const r of results) {
    console.log(`\n## ${r.id} @ ${r.receiver.join(",")}`);
    console.table(r.families.map(({ activeBins: _a, ...rest }) => rest));
    console.log(`focus ${r.focus}:`, JSON.stringify(r.focusFamilies));
    console.log("focus top:", JSON.stringify(r.focusTop));
  }
  if (out) writeFileSync(out, JSON.stringify(results, null, 2));
  // --peak HH:MM-HH:MM：在該時段每 10 秒瞬時查詢，印各家族最強時刻（挑 focus_time 用）
  const peak = arg("--peak");
  if (peak) {
    const [a, b] = peak.split("-");
    for (const f of files) {
      const s = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Scene;
      const [lon, lat] = recv ? recv.split(",").map(Number) : [s.receiver.lon, s.receiver.lat];
      const receiver: Receiver = { id: s.id, longitude: lon!, latitude: lat!, heightM: s.receiver.height_m, environment: "outdoor" };
      const sets = await sceneToSetsWithMvpB(s);
      const t0 = Date.parse(`${s.date}T${a}:00+08:00`) / 1000;
      const t1 = Date.parse(`${s.date}T${b}:00+08:00`) / 1000;
      const best = new Map<string, { v: number; t: number }>();
      for (let t = t0; t <= t1; t += 10) {
        for (const fam of queryReceiver(receiver, t, sets, FAMILIES).families) {
          const v = fam.relativePotential ?? -1;
          if (v > (best.get(fam.family)?.v ?? -1)) best.set(fam.family, { v, t });
        }
      }
      for (const [fam, { v, t }] of best) {
        const iso = new Date((t + 8 * 3600) * 1000).toISOString().replace("Z", "+08:00").replace(".000", "");
        console.log(`peak ${s.id} ${fam}: ${v.toFixed(3)} @ ${iso}`);
      }
    }
  }
}

void main();
