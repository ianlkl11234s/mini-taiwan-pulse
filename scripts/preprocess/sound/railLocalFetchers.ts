/**
 * 鐵道 adapter 的 node 端 fetchers（讀 public/rail 本機檔，basis=local_template）。
 * grid-bench 與 W6-3 鐵道網格測試共用；瀏覽器端用 src/sound/sourceAdapters/railLiveFetchers.ts。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSystemSchedule, parseTraSchedule } from "../../../src/sound/sourceAdapters/railLiveFetchers";
import { RAIL_SYSTEMS, type RailFetchers, type RailTrackInput } from "../../../src/sound/sourceAdapters/railAdapter";

function readJson(p: string): unknown {
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

export function localRailFetchers(railDir: string): RailFetchers {
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
