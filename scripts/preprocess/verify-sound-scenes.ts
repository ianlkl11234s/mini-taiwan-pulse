/**
 * City Sound Atlas 場景快照驗算：讀 public/sound-atlas/scenes/<id>.json，餵既有 adapter，
 * 對接收點跑 dayProfile（10 分鐘格），印出各家族 active 格數、unknown ratio、最強時刻。
 *
 * 快照 → SoundSourceSet 的轉換規則（UI 接快照時照抄）：
 *   - coverage 一律取快照的 health（ok／empty／error），**不可**用 bbox 內筆數重判：
 *     bbox 內 0 筆落雷／0 架飛機但 health=ok ＝ 真的沒有（inactive），不是 unknown。
 *   - 垃圾車不在快照 → 這裡不載入（family 會是 unavailable/source_not_loaded）。
 *
 * 不是 vitest 測試（CI 沒有 public 資料檔）。用法：
 *   npx vite-node scripts/preprocess/verify-sound-scenes.ts [--scene ID] [--receiver lon,lat] [--json OUT]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
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
import type { Receiver, SoundSourceFamily, SoundSourceSet, SourceCoverage, SourceHealth } from "../../src/sound/types";

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
const FAMILIES: SoundSourceFamily[] = ["aviation", "rain", "thunder"];

function cov(family: SoundSourceFamily, provider: string, date: string, status: SourceHealth): SourceCoverage {
  const start = taipeiMidnightMs(date) / 1000;
  return { family, provider, dateKey: date, status, windowStart: start, windowEnd: start + 86_400, temporalKind: "day_series" };
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

function summarize(s: Scene, receiver: Receiver) {
  const sets = sceneToSets(s);
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
    relativePotential: c.relativePotential == null ? null : Number(c.relativePotential.toFixed(3)),
    distanceM: c.spatialDistanceM == null ? null : Math.round(c.spatialDistanceM),
    delayS: c.thunderTiming?.delayS ?? null,
    unknownReason: c.unknownReason ?? null,
  }));
  const focusFamilies = Object.fromEntries(q.families.map((f) => [f.family, f.reason ? `${f.status}(${f.reason})` : f.status]));
  return { id: s.id, receiver: [receiver.longitude, receiver.latitude], families, focus: s.focus_time, focusFamilies, focusTop };
}

function main() {
  const args = process.argv.slice(2);
  const arg = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const only = arg("--scene");
  const recv = arg("--receiver");
  const out = arg("--json");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && (!only || f === `${only}.json`)).sort();
  if (!files.length) throw new Error(`no scene files in ${DIR}`);
  const results = files.map((f) => {
    const s = JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as Scene;
    if (s.schema !== "pulse-sound-scene-v1") throw new Error(`${f}: bad schema ${s.schema}`);
    const [lon, lat] = recv ? recv.split(",").map(Number) : [s.receiver.lon, s.receiver.lat];
    return summarize(s, { id: s.id, longitude: lon!, latitude: lat!, heightM: s.receiver.height_m, environment: "outdoor" });
  });
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
      const sets = sceneToSets(s);
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

main();
